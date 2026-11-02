-- ============================================================================
-- ARS Computers — Forward-Only Migration: Order Items Purchase Cost Snapshot
-- Migration: 20261102000020_order_items_purchase_cost_snapshot.sql
-- Status: PREPARED LOCAL DRAFT
-- ============================================================================
-- Objective:
-- 1. Add nullable `cost_price_snapshot` column to public.order_items.
-- 2. Update `create_sales_order` to snapshot the catalog product's verified
--    purchase cost (`products.cost_price`) at order creation.
-- 3. Update `update_sales_order` to preserve previously established snapshots
--    for existing items, while snapshotting newly added products.
-- 4. Update `review_order_completion` to snapshot cost for any items where
--    cost was initially unavailable before permanently locking into the archive.
-- 5. Strict Historical Integrity:
--    - Existing historical order_items remain NULL (no backfill or invented costs).
--    - When cost is NULL, Business Analytics displays "Cost unavailable" and "N/A"
--      for profit, and never silently substitutes today's catalog cost.
-- ============================================================================

-- Step 1: Add cost_price_snapshot column (nullable, numeric(12,2))
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_price_snapshot NUMERIC(12, 2) DEFAULT NULL;

COMMENT ON COLUMN public.order_items.cost_price_snapshot IS
  'Verified acquisition/purchase cost per unit snapshotted at time of sale. NULL indicates cost was unrecorded/unverified at time of booking.';

-- Step 2: Update public.create_sales_order to snapshot cost_price
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_customer_name text,
  p_contact_info text,
  p_items jsonb,
  p_paid_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash'::text,
  p_employee_remarks text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text,
  p_assigned_engineer_id uuid DEFAULT NULL::uuid,
  p_expected_delivery_date timestamptz DEFAULT NULL::timestamptz,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;

  v_eng_id UUID := NULL;
  v_eng_name TEXT := NULL;
  v_eng_code TEXT := NULL;
  v_eng_phone TEXT := NULL;

  v_order_id UUID;
  v_order_number TEXT;
  v_calc_subtotal NUMERIC(12,2) := 0.00;
  v_calc_total NUMERIC(12,2) := 0.00;
  v_discount NUMERIC(12,2) := 0.00;
  v_tax NUMERIC(12,2) := 0.00;
  v_payment_status TEXT;

  v_item RECORD;
  v_prod_name TEXT;
  v_prod_brand TEXT;
  v_prod_model TEXT;
  v_prod_sku TEXT;
  v_prod_cost NUMERIC(12,2);
  v_qty INT;
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_item_count INT := 0;

  v_clean_email TEXT := NULL;
  v_clean_phone TEXT := NULL;
  v_clean_address TEXT := NULL;
BEGIN
  -- Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email, employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to create orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validate inputs
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Customer Name must be at least 2 characters.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_contact_info IS NULL OR length(trim(p_contact_info)) < 5 THEN
    RAISE EXCEPTION 'Contact Information must be at least 5 characters.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one product item.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_paid_amount < 0 THEN
    RAISE EXCEPTION 'Paid amount cannot be negative.' USING ERRCODE = 'check_violation';
  END IF;

  v_discount := GREATEST(0, COALESCE(p_discount_amount, 0));
  v_tax := GREATEST(0, COALESCE(p_tax_amount, 0));

  -- Clean contact attributes
  IF p_customer_email IS NOT NULL AND trim(p_customer_email) <> '' THEN
    v_clean_email := lower(trim(p_customer_email));
  END IF;
  IF p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> '' THEN
    v_clean_phone := trim(p_customer_phone);
  END IF;
  IF p_customer_address IS NOT NULL AND trim(p_customer_address) <> '' THEN
    v_clean_address := trim(p_customer_address);
  END IF;

  -- Resolve engineer assignment if provided
  IF p_assigned_engineer_id IS NOT NULL THEN
    SELECT id, full_name, employee_code, phone_number
    INTO v_eng_id, v_eng_name, v_eng_code, v_eng_phone
    FROM public.admin_users
    WHERE id = p_assigned_engineer_id AND is_active = true;

    IF v_eng_id IS NULL THEN
      RAISE EXCEPTION 'Assigned engineer does not exist or is inactive.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Pre-calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id uuid,
    product_name text,
    quantity int,
    unit_price numeric
  )
  LOOP
    v_item_count := v_item_count + 1;
    v_qty := COALESCE(v_item.quantity, 0);
    v_unit_price := COALESCE(v_item.unit_price, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item #% quantity must be at least 1.', v_item_count USING ERRCODE = 'check_violation';
    END IF;
    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Item #% unit price cannot be negative.', v_item_count USING ERRCODE = 'check_violation';
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_qty * v_unit_price);
  END LOOP;

  v_calc_total := GREATEST(0, v_calc_subtotal - v_discount + v_tax);

  IF p_paid_amount > v_calc_total THEN
    RAISE EXCEPTION 'Paid amount (%) cannot exceed total order amount (%).', p_paid_amount, v_calc_total
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_paid_amount = 0 THEN
    v_payment_status := 'pending';
  ELSIF p_paid_amount = v_calc_total THEN
    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'partial';
  END IF;

  v_order_id := gen_random_uuid();
  v_order_number := 'ARS-ORD-' || lpad(nextval('public.order_reference_seq'::regclass)::text, 5, '0');

  -- Insert Order
  INSERT INTO public.orders (
    id,
    order_number,
    customer_name,
    contact_info,
    customer_email,
    customer_phone,
    customer_address,
    status,
    total_amount,
    paid_amount,
    payment_status,
    payment_method,
    discount_amount,
    tax_amount,
    assigned_engineer_id,
    assigned_engineer_name,
    assigned_engineer_code,
    assigned_engineer_phone,
    assigned_at,
    assigned_by,
    assigned_by_name,
    expected_delivery_date,
    created_by,
    created_by_name,
    created_by_employee_code,
    employee_remarks,
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    v_order_number,
    trim(p_customer_name),
    trim(p_contact_info),
    v_clean_email,
    v_clean_phone,
    v_clean_address,
    'new',
    v_calc_total,
    p_paid_amount,
    v_payment_status,
    p_payment_method,
    v_discount,
    v_tax,
    v_eng_id,
    v_eng_name,
    v_eng_code,
    v_eng_phone,
    CASE WHEN v_eng_id IS NOT NULL THEN clock_timestamp() ELSE NULL END,
    CASE WHEN v_eng_id IS NOT NULL THEN v_actor_id ELSE NULL END,
    CASE WHEN v_eng_id IS NOT NULL THEN COALESCE(v_actor_name, v_actor_email) ELSE NULL END,
    p_expected_delivery_date,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    trim(p_employee_remarks),
    clock_timestamp(),
    clock_timestamp()
  );

  -- Insert Line Items with cost_price_snapshot
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id uuid,
    product_name text,
    brand text,
    model text,
    sku text,
    quantity int,
    unit_price numeric
  )
  LOOP
    v_qty := v_item.quantity;
    v_unit_price := v_item.unit_price;
    v_line_total := v_qty * v_unit_price;

    v_prod_name := NULL;
    v_prod_brand := NULL;
    v_prod_model := NULL;
    v_prod_sku := NULL;
    v_prod_cost := NULL;

    IF v_item.product_id IS NOT NULL THEN
      SELECT name, brand, model, sku, cost_price
      INTO v_prod_name, v_prod_brand, v_prod_model, v_prod_sku, v_prod_cost
      FROM public.products WHERE id = v_item.product_id;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      brand_snapshot,
      model_snapshot,
      sku_snapshot,
      cost_price_snapshot,
      quantity,
      unit_price,
      line_total,
      created_at
    ) VALUES (
      v_order_id,
      v_item.product_id,
      COALESCE(v_prod_name, v_item.product_name, 'Hardware Product'),
      COALESCE(v_prod_brand, v_item.brand, ''),
      COALESCE(v_prod_model, v_item.model, ''),
      COALESCE(v_prod_sku, v_item.sku, ''),
      CASE
        WHEN v_prod_cost IS NOT NULL AND v_prod_cost >= 0 THEN v_prod_cost
        ELSE NULL
      END,
      v_qty,
      v_unit_price,
      v_line_total,
      clock_timestamp()
    );
  END LOOP;

  -- Record initial payment in ledger if paid > 0
  IF p_paid_amount > 0 THEN
    INSERT INTO public.order_payments (
      order_id,
      amount_received,
      payment_method,
      transaction_reference,
      remarks,
      received_by,
      received_by_name,
      received_by_employee_code,
      received_at,
      created_at
    ) VALUES (
      v_order_id,
      p_paid_amount,
      p_payment_method,
      'INITIAL_DOWNPAYMENT',
      'Initial downpayment recorded upon order creation.',
      v_actor_id,
      COALESCE(v_actor_name, v_actor_email),
      v_actor_code,
      clock_timestamp(),
      clock_timestamp()
    );
  END IF;

  -- Record audit activity
  INSERT INTO public.order_activities (
    order_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata,
    created_at
  ) VALUES (
    v_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_CREATED',
    'Order ' || v_order_number || ' created for ' || trim(p_customer_name) || ' (₹' || v_calc_total || ')',
    jsonb_build_object(
      'total_amount', v_calc_total,
      'paid_amount', p_paid_amount,
      'payment_status', v_payment_status,
      'items_count', v_item_count,
      'discount_amount', v_discount,
      'tax_amount', v_tax,
      'assigned_engineer_name', v_eng_name
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_calc_total,
    'paid_amount', p_paid_amount,
    'payment_status', v_payment_status,
    'status', 'new',
    'assigned_engineer_name', v_eng_name,
    'customer_email', v_clean_email,
    'customer_phone', v_clean_phone,
    'message', 'Sales order created successfully.'
  );
END;
$$;

-- Step 3: Update public.update_sales_order preserving existing snapshots
CREATE OR REPLACE FUNCTION public.update_sales_order(
  p_order_id uuid,
  p_customer_name text,
  p_contact_info text,
  p_items jsonb,
  p_customer_email text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text,
  p_assigned_engineer_id uuid DEFAULT NULL::uuid,
  p_expected_delivery_date timestamptz DEFAULT NULL::timestamptz,
  p_employee_remarks text DEFAULT NULL::text,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_order_status text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;

  v_order RECORD;
  v_eng_id UUID := NULL;
  v_eng_name TEXT := NULL;
  v_eng_code TEXT := NULL;
  v_eng_phone TEXT := NULL;

  v_calc_subtotal NUMERIC(12,2) := 0.00;
  v_calc_total NUMERIC(12,2) := 0.00;
  v_discount NUMERIC(12,2) := 0.00;
  v_tax NUMERIC(12,2) := 0.00;
  v_new_payment_status TEXT;
  v_new_status TEXT;

  v_item RECORD;
  v_prod_name TEXT;
  v_prod_brand TEXT;
  v_prod_model TEXT;
  v_prod_sku TEXT;
  v_prod_cost NUMERIC(12,2);
  v_qty INT;
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_item_count INT := 0;
  v_existing_costs JSONB;
  v_prev_cost NUMERIC(12,2);

  v_clean_email TEXT := NULL;
  v_clean_phone TEXT := NULL;
  v_clean_address TEXT := NULL;
BEGIN
  -- Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email, employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to edit orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot edit a cancelled order.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.status = 'completed' AND v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Only Superadministrators can make administrative updates to completed orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validate inputs
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Customer Name must be at least 2 characters.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_contact_info IS NULL OR length(trim(p_contact_info)) < 5 THEN
    RAISE EXCEPTION 'Contact Information must be at least 5 characters.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one product item.' USING ERRCODE = 'check_violation';
  END IF;

  v_discount := GREATEST(0, COALESCE(p_discount_amount, 0));
  v_tax := GREATEST(0, COALESCE(p_tax_amount, 0));

  -- Clean contact attributes
  IF p_customer_email IS NOT NULL AND trim(p_customer_email) <> '' THEN
    v_clean_email := lower(trim(p_customer_email));
  END IF;
  IF p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> '' THEN
    v_clean_phone := trim(p_customer_phone);
  END IF;
  IF p_customer_address IS NOT NULL AND trim(p_customer_address) <> '' THEN
    v_clean_address := trim(p_customer_address);
  END IF;

  -- Resolve engineer assignment
  IF p_assigned_engineer_id IS NOT NULL THEN
    SELECT id, full_name, employee_code, phone_number
    INTO v_eng_id, v_eng_name, v_eng_code, v_eng_phone
    FROM public.admin_users
    WHERE id = p_assigned_engineer_id AND is_active = true;

    IF v_eng_id IS NULL THEN
      RAISE EXCEPTION 'Assigned engineer does not exist or is inactive.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Calculate new totals from items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id uuid,
    product_name text,
    quantity int,
    unit_price numeric
  )
  LOOP
    v_item_count := v_item_count + 1;
    v_qty := COALESCE(v_item.quantity, 0);
    v_unit_price := COALESCE(v_item.unit_price, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item #% quantity must be at least 1.', v_item_count USING ERRCODE = 'check_violation';
    END IF;
    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Item #% unit price cannot be negative.', v_item_count USING ERRCODE = 'check_violation';
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_qty * v_unit_price);
  END LOOP;

  v_calc_total := GREATEST(0, v_calc_subtotal - v_discount + v_tax);

  -- Financial consistency check: cannot reduce total below already paid amount
  IF v_calc_total < v_order.paid_amount THEN
    RAISE EXCEPTION 'Updated order total (₹%) cannot be less than already collected payment (₹%). Please record an accounting adjustment first.',
      v_calc_total, v_order.paid_amount USING ERRCODE = 'check_violation';
  END IF;

  -- Derive payment status
  IF v_order.paid_amount = 0 THEN
    v_new_payment_status := 'pending';
  ELSIF v_order.paid_amount = v_calc_total THEN
    v_new_payment_status := 'paid';
  ELSE
    v_new_payment_status := 'partial';
  END IF;

  -- Determine target status
  v_new_status := v_order.status;
  IF p_order_status IS NOT NULL AND p_order_status IN ('new', 'processing', 'completion_requested') THEN
    IF v_order.status <> 'completed' THEN
      v_new_status := p_order_status;
    END IF;
  END IF;

  -- Update order record
  UPDATE public.orders
  SET
    customer_name = trim(p_customer_name),
    contact_info = trim(p_contact_info),
    customer_email = v_clean_email,
    customer_phone = v_clean_phone,
    customer_address = v_clean_address,
    status = v_new_status,
    total_amount = v_calc_total,
    payment_status = v_new_payment_status,
    discount_amount = v_discount,
    tax_amount = v_tax,
    assigned_engineer_id = v_eng_id,
    assigned_engineer_name = v_eng_name,
    assigned_engineer_code = v_eng_code,
    assigned_engineer_phone = v_eng_phone,
    assigned_at = CASE
      WHEN v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN clock_timestamp()
      ELSE v_order.assigned_at
    END,
    assigned_by = CASE
      WHEN v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN v_actor_id
      ELSE v_order.assigned_by
    END,
    assigned_by_name = CASE
      WHEN v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN COALESCE(v_actor_name, v_actor_email)
      ELSE v_order.assigned_by_name
    END,
    expected_delivery_date = p_expected_delivery_date,
    employee_remarks = trim(p_employee_remarks),
    updated_at = clock_timestamp()
  WHERE id = p_order_id;

  -- Capture existing cost snapshots to preserve them across updates
  SELECT COALESCE(
    jsonb_object_agg(product_id::text, cost_price_snapshot),
    '{}'::jsonb
  ) INTO v_existing_costs
  FROM public.order_items
  WHERE order_id = p_order_id
    AND product_id IS NOT NULL
    AND cost_price_snapshot IS NOT NULL;

  -- Atomically replace line items
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id uuid,
    product_name text,
    brand text,
    model text,
    sku text,
    quantity int,
    unit_price numeric
  )
  LOOP
    v_qty := v_item.quantity;
    v_unit_price := v_item.unit_price;
    v_line_total := v_qty * v_unit_price;

    v_prod_name := NULL;
    v_prod_brand := NULL;
    v_prod_model := NULL;
    v_prod_sku := NULL;
    v_prod_cost := NULL;

    IF v_item.product_id IS NOT NULL THEN
      SELECT name, brand, model, sku, cost_price
      INTO v_prod_name, v_prod_brand, v_prod_model, v_prod_sku, v_prod_cost
      FROM public.products WHERE id = v_item.product_id;

      -- Check if previous cost snapshot exists for this product
      IF v_existing_costs ? v_item.product_id::text THEN
        v_prev_cost := (v_existing_costs ->> v_item.product_id::text)::numeric;
      ELSE
        v_prev_cost := NULL;
      END IF;
    ELSE
      v_prev_cost := NULL;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      brand_snapshot,
      model_snapshot,
      sku_snapshot,
      cost_price_snapshot,
      quantity,
      unit_price,
      line_total,
      created_at
    ) VALUES (
      p_order_id,
      v_item.product_id,
      COALESCE(v_prod_name, v_item.product_name, 'Hardware Product'),
      COALESCE(v_prod_brand, v_item.brand, ''),
      COALESCE(v_prod_model, v_item.model, ''),
      COALESCE(v_prod_sku, v_item.sku, ''),
      COALESCE(
        v_prev_cost,
        CASE
          WHEN v_prod_cost IS NOT NULL AND v_prod_cost >= 0 THEN v_prod_cost
          ELSE NULL
        END
      ),
      v_qty,
      v_unit_price,
      v_line_total,
      clock_timestamp()
    );
  END LOOP;

  -- Record order update activity
  INSERT INTO public.order_activities (
    order_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata,
    created_at
  ) VALUES (
    p_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_EDITED',
    'Order ' || v_order.order_number || ' updated by ' || COALESCE(v_actor_name, v_actor_email) || ' (' || v_actor_role || ')',
    jsonb_build_object(
      'total_amount', v_calc_total,
      'items_count', v_item_count,
      'discount_amount', v_discount,
      'tax_amount', v_tax
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_order_id,
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'total_amount', v_calc_total,
    'paid_amount', v_order.paid_amount,
    'payment_status', v_new_payment_status,
    'status', v_new_status,
    'assigned_engineer_name', v_eng_name,
    'message', 'Order updated successfully.'
  );
END;
$$;

-- Step 4: Update review_order_completion to snapshot unrecorded costs before archiving
CREATE OR REPLACE FUNCTION public.review_order_completion(
  p_order_id UUID,
  p_head_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_order RECORD;
  v_clean_remarks TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Superadministrators can review and approve orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status != 'completion_requested' THEN
    RAISE EXCEPTION 'Invalid state: Order is not pending completion review.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block employee self-approval (superadmin who submitted completion cannot self-approve)
  IF v_order.completion_requested_by = v_actor_id THEN
    RAISE EXCEPTION 'Unauthorized: Staff members cannot approve their own work completion.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_remarks := pg_catalog.btrim(p_head_remarks);
  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  -- Ensure any item without cost snapshot gets captured from verified catalog cost before permanent archive locking
  UPDATE public.order_items oi
  SET cost_price_snapshot = p.cost_price
  FROM public.products p
  WHERE oi.order_id = p_order_id
    AND oi.product_id = p.id
    AND oi.cost_price_snapshot IS NULL
    AND p.cost_price IS NOT NULL
    AND p.cost_price >= 0;

  UPDATE public.orders
  SET
    status = 'completed',
    is_archived = true,
    archived_at = v_now,
    completion_approved_by = v_actor_id,
    completion_approved_at = v_now,
    approved_by_name = COALESCE(v_actor_name, v_actor_email),
    approved_by_employee_code = v_actor_code,
    head_remarks = v_clean_remarks,
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_COMPLETION_APPROVED',
    COALESCE(v_clean_remarks, 'Order completion approved.'), v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completed',
    'approved_by_name', COALESCE(v_actor_name, v_actor_email),
    'approved_by_employee_code', v_actor_code,
    'completion_approved_at', v_now,
    'message', 'Order completion approved and permanently archived.'
  );
END;
$$;

-- Step 5: Secure EXECUTE permissions
REVOKE ALL ON FUNCTION public.create_sales_order(text, text, jsonb, numeric, text, text, text, text, text, uuid, timestamptz, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_order(text, text, jsonb, numeric, text, text, text, text, text, uuid, timestamptz, numeric, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.update_sales_order(uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sales_order(uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.review_order_completion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_order_completion(uuid, text) TO authenticated;
