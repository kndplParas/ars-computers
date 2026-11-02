-- ============================================================================
-- Migration: 20261101000019_orders_sales_complete_implementation.sql
-- Description: Complete Orders & Sales Architecture Implementation:
--   1. Engineer Assignment & Delivery Tracking on Orders
--   2. Atomic Sales Order Editing (update_sales_order RPC)
--   3. Dedicated Engineer Assignment RPC (assign_order_engineer)
--   4. Delete/Cancellation & Bin Workflow for Orders mirroring Enquiries
--   5. Extended Activity Audit Trail for Order Operations
--   6. Hardening immutability triggers for Bin/Removal operations
-- ============================================================================

-- 1. Schema Additions on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_engineer_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_engineer_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_engineer_code TEXT,
  ADD COLUMN IF NOT EXISTS assigned_engineer_phone TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_name TEXT,
  ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_in_bin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT,
  ADD COLUMN IF NOT EXISTS removal_category TEXT;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_orders_assigned_engineer ON public.orders(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_in_bin ON public.orders(is_in_bin);
CREATE INDEX IF NOT EXISTS idx_orders_is_removed ON public.orders(is_removed);

-- 2. Expand check constraint on order_activities to support new operations
DO $$
BEGIN
  ALTER TABLE public.order_activities DROP CONSTRAINT IF EXISTS order_activities_activity_type_check;
  ALTER TABLE public.order_activities ADD CONSTRAINT order_activities_activity_type_check
    CHECK (activity_type = ANY (ARRAY[
      'ORDER_CREATED'::text,
      'ORDER_PROCESSING_STARTED'::text,
      'ORDER_COMPLETION_SUBMITTED'::text,
      'ORDER_COMPLETION_APPROVED'::text,
      'ORDER_CANCELLED'::text,
      'ORDER_PAYMENT_RECORDED'::text,
      'ORDER_ATTACHMENT_ADDED'::text,
      'ATTACHMENT_SHARE_REQUESTED'::text,
      'ATTACHMENT_SHARE_REJECTED'::text,
      'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE'::text,
      'ATTACHMENT_MARKED_INTERNAL'::text,
      'ATTACHMENT_SHARE_CREATED'::text,
      'ATTACHMENT_SHARE_REVOKED'::text,
      'ORDER_EDITED'::text,
      'ORDER_ENGINEER_ASSIGNED'::text,
      'ORDER_ENGINEER_REASSIGNED'::text,
      'ORDER_REMOVED'::text,
      'ORDER_RESTORED'::text,
      'ORDER_DELETION_REQUESTED'::text,
      'ORDER_DELETION_REVIEWED'::text
    ]));
END $$;

-- 3. Update trg_protect_order_immutability to allow soft removal and Bin state changes
CREATE OR REPLACE FUNCTION public.trg_protect_order_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Cancelled orders: Core attributes are permanently locked, but Bin/Removal audit columns may be updated
  IF OLD.status = 'cancelled' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.order_number IS DISTINCT FROM OLD.order_number OR
       NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.contact_info IS DISTINCT FROM OLD.contact_info OR
       NEW.customer_email IS DISTINCT FROM OLD.customer_email OR
       NEW.customer_phone IS DISTINCT FROM OLD.customer_phone OR
       NEW.customer_address IS DISTINCT FROM OLD.customer_address OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.paid_amount IS DISTINCT FROM OLD.paid_amount OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
       NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
       NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
      RAISE EXCEPTION 'Order immutability violation: Cancelled orders are permanently finalized and cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Completed orders: Core financial and workflow attributes are permanently locked.
  -- Permitted updates:
  --   1. paid_amount, payment_status, updated_at (via record_order_payment)
  --   2. Bin and Removal audit columns (via remove/restore RPCs)
  IF OLD.status = 'completed' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.order_number IS DISTINCT FROM OLD.order_number OR
       NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.contact_info IS DISTINCT FROM OLD.contact_info OR
       NEW.customer_email IS DISTINCT FROM OLD.customer_email OR
       NEW.customer_phone IS DISTINCT FROM OLD.customer_phone OR
       NEW.customer_address IS DISTINCT FROM OLD.customer_address OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.created_by_name IS DISTINCT FROM OLD.created_by_name OR
       NEW.created_by_employee_code IS DISTINCT FROM OLD.created_by_employee_code OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at OR
       NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by OR
       NEW.completed_by_name IS DISTINCT FROM OLD.completed_by_name OR
       NEW.completed_by_employee_code IS DISTINCT FROM OLD.completed_by_employee_code OR
       NEW.employee_remarks IS DISTINCT FROM OLD.employee_remarks OR
       NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at OR
       NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by OR
       NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name OR
       NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code OR
       NEW.head_remarks IS DISTINCT FROM OLD.head_remarks OR
       NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason OR
       NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
       NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
       NEW.cancelled_by_name IS DISTINCT FROM OLD.cancelled_by_name OR
       NEW.is_archived IS DISTINCT FROM OLD.is_archived OR
       NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      RAISE EXCEPTION 'Order immutability violation: Completed orders are permanently locked. Core workflow, customer, and audit attributes cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Overhaul create_sales_order with engineer assignment & delivery tracking
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
  v_prod RECORD;
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

  -- Insert Line Items
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

    IF v_item.product_id IS NOT NULL THEN
      SELECT name, brand, model, sku INTO v_prod
      FROM public.products WHERE id = v_item.product_id;
    ELSE
      v_prod := NULL;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      brand_snapshot,
      model_snapshot,
      sku_snapshot,
      quantity,
      unit_price,
      line_total,
      created_at
    ) VALUES (
      v_order_id,
      v_item.product_id,
      COALESCE(v_prod.name, v_item.product_name, 'Hardware Product'),
      COALESCE(v_prod.brand, v_item.brand, ''),
      COALESCE(v_prod.model, v_item.model, ''),
      COALESCE(v_prod.sku, v_item.sku, ''),
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
      recorded_by,
      recorded_by_name,
      recorded_by_employee_code,
      received_at,
      remarks,
      created_at
    ) VALUES (
      v_order_id,
      p_paid_amount,
      p_payment_method,
      v_actor_id,
      COALESCE(v_actor_name, v_actor_email),
      v_actor_code,
      clock_timestamp(),
      'Initial advance payment received at order creation',
      clock_timestamp()
    );
  END IF;

  -- Log Activity
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
    'Order ' || v_order_number || ' created by ' || COALESCE(v_actor_name, v_actor_email) || ' for total ₹' || v_calc_total,
    jsonb_build_object(
      'order_number', v_order_number,
      'total_amount', v_calc_total,
      'paid_amount', p_paid_amount,
      'payment_status', v_payment_status,
      'assigned_engineer', v_eng_name,
      'items_count', v_item_count
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_calc_total,
    'paid_amount', p_paid_amount,
    'payment_status', v_payment_status,
    'status', 'new',
    'assigned_engineer_name', v_eng_name,
    'customer_email', v_clean_email,
    'customer_phone', v_clean_phone
  );
END;
$$;

-- 5. Atomic Sales Order Editing RPC: update_sales_order
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
  v_prod RECORD;
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
    v_new_status := p_order_status;
  END IF;

  -- Update Order row
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

    IF v_item.product_id IS NOT NULL THEN
      SELECT name, brand, model, sku INTO v_prod
      FROM public.products WHERE id = v_item.product_id;
    ELSE
      v_prod := NULL;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      brand_snapshot,
      model_snapshot,
      sku_snapshot,
      quantity,
      unit_price,
      line_total,
      created_at
    ) VALUES (
      p_order_id,
      v_item.product_id,
      COALESCE(v_prod.name, v_item.product_name, 'Hardware Product'),
      COALESCE(v_prod.brand, v_item.brand, ''),
      COALESCE(v_prod.model, v_item.model, ''),
      COALESCE(v_prod.sku, v_item.sku, ''),
      v_qty,
      v_unit_price,
      v_line_total,
      clock_timestamp()
    );
  END LOOP;

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
    p_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_EDITED',
    'Order updated by ' || COALESCE(v_actor_name, v_actor_email) || ' (Total: ₹' || v_calc_total || ', Status: ' || v_new_status || ')',
    jsonb_build_object(
      'previous_total', v_order.total_amount,
      'new_total', v_calc_total,
      'previous_engineer', v_order.assigned_engineer_name,
      'new_engineer', v_eng_name,
      'items_count', v_item_count,
      'updated_by', COALESCE(v_actor_name, v_actor_email)
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_order_id,
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

-- 6. Dedicated Engineer Assignment RPC: assign_order_engineer
CREATE OR REPLACE FUNCTION public.assign_order_engineer(
  p_order_id uuid,
  p_engineer_id uuid,
  p_expected_delivery_date timestamptz DEFAULT NULL::timestamptz,
  p_notes text DEFAULT NULL::text
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
  v_order RECORD;
  v_eng RECORD;
  v_prev_eng_name TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot assign engineer to a cancelled order.' USING ERRCODE = 'check_violation';
  END IF;

  v_prev_eng_name := v_order.assigned_engineer_name;

  IF p_engineer_id IS NOT NULL THEN
    SELECT id, full_name, employee_code, phone_number INTO v_eng
    FROM public.admin_users WHERE id = p_engineer_id AND is_active = true;

    IF v_eng.id IS NULL THEN
      RAISE EXCEPTION 'Assigned engineer does not exist or is inactive.' USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.orders
    SET
      assigned_engineer_id = v_eng.id,
      assigned_engineer_name = v_eng.full_name,
      assigned_engineer_code = v_eng.employee_code,
      assigned_engineer_phone = v_eng.phone_number,
      assigned_at = clock_timestamp(),
      assigned_by = v_actor_id,
      assigned_by_name = COALESCE(v_actor_name, v_actor_email),
      expected_delivery_date = COALESCE(p_expected_delivery_date, expected_delivery_date),
      updated_at = clock_timestamp()
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      CASE WHEN v_prev_eng_name IS NULL THEN 'ORDER_ENGINEER_ASSIGNED' ELSE 'ORDER_ENGINEER_REASSIGNED' END,
      'Order assigned to ' || v_eng.full_name || ' by ' || COALESCE(v_actor_name, v_actor_email),
      jsonb_build_object(
        'previous_engineer', v_prev_eng_name,
        'new_engineer_id', v_eng.id,
        'new_engineer_name', v_eng.full_name,
        'notes', p_notes
      ),
      clock_timestamp()
    );
  ELSE
    -- Unassign engineer
    UPDATE public.orders
    SET
      assigned_engineer_id = NULL,
      assigned_engineer_name = NULL,
      assigned_engineer_code = NULL,
      assigned_engineer_phone = NULL,
      assigned_at = NULL,
      assigned_by = NULL,
      assigned_by_name = NULL,
      updated_at = clock_timestamp()
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_ENGINEER_REASSIGNED',
      'Engineer unassigned from order by ' || COALESCE(v_actor_name, v_actor_email),
      jsonb_build_object('previous_engineer', v_prev_eng_name, 'notes', p_notes),
      clock_timestamp()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'assigned_engineer_name', v_eng.full_name,
    'message', 'Engineer assignment updated successfully.'
  );
END;
$$;

-- 7. Orders Delete / Cancellation & Bin Workflow RPCs
-- 7a. Request Order Deletion / Direct Soft Remove
CREATE OR REPLACE FUNCTION public.request_order_deletion(
  p_order_id uuid,
  p_reason text,
  p_category text DEFAULT 'Customer Cancelled'::text
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
  v_order RECORD;
  v_clean_reason TEXT;
  v_clean_cat TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A valid reason of at least 5 characters is required.' USING ERRCODE = 'check_violation';
  END IF;

  v_clean_reason := trim(p_reason);
  v_clean_cat := COALESCE(trim(p_category), 'Customer Cancelled');

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- If Superadmin: execute direct soft-removal to Bin immediately
  IF v_actor_role = 'superadmin' THEN
    UPDATE public.orders
    SET
      is_in_bin = true,
      is_removed = true,
      removed_at = v_now,
      removed_by = v_actor_id,
      removed_by_name = COALESCE(v_actor_name, v_actor_email),
      removal_reason = v_clean_reason,
      removal_category = v_clean_cat,
      scheduled_deletion_at = v_now + INTERVAL '7 days',
      updated_at = v_now
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_REMOVED',
      'Order soft-removed to Bin by Head Superadmin: ' || v_clean_reason,
      jsonb_build_object('category', v_clean_cat, 'reason', v_clean_reason),
      v_now
    );

    RETURN jsonb_build_object(
      'success', true,
      'is_in_bin', true,
      'message', 'Order soft-removed to Bin successfully.'
    );
  ELSE
    -- Employee/Admin request: submit for Superadmin review
    UPDATE public.orders
    SET
      deletion_requested_by = v_actor_id,
      deletion_requested_at = v_now,
      deletion_reason = v_clean_reason,
      removal_category = v_clean_cat,
      updated_at = v_now
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_DELETION_REQUESTED',
      'Order deletion requested by ' || COALESCE(v_actor_name, v_actor_email) || ': ' || v_clean_reason,
      jsonb_build_object('category', v_clean_cat, 'reason', v_clean_reason),
      v_now
    );

    RETURN jsonb_build_object(
      'success', true,
      'deletion_requested', true,
      'message', 'Order deletion request submitted for Head review.'
    );
  END IF;
END;
$$;

-- 7b. Review Order Deletion (Superadmin Only)
CREATE OR REPLACE FUNCTION public.review_order_deletion(
  p_order_id uuid,
  p_decision text,
  p_review_notes text DEFAULT NULL::text
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
  v_order RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_decision TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized: Only Superadministrators can review order deletions.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_decision := lower(trim(COALESCE(p_decision, '')));
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be "approved" or "rejected".' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_decision = 'approved' THEN
    UPDATE public.orders
    SET
      is_in_bin = true,
      is_removed = true,
      removed_at = v_now,
      removed_by = v_actor_id,
      removed_by_name = COALESCE(v_actor_name, v_actor_email),
      removal_reason = COALESCE(v_order.deletion_reason, 'Deletion approved by Head'),
      scheduled_deletion_at = v_now + INTERVAL '7 days',
      updated_at = v_now
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_REMOVED',
      'Order deletion approved and moved to Bin: ' || COALESCE(p_review_notes, 'Approved'),
      jsonb_build_object('review_notes', p_review_notes, 'decision', 'approved'),
      v_now
    );

    RETURN jsonb_build_object(
      'success', true,
      'is_in_bin', true,
      'message', 'Order deletion approved and moved to Bin.'
    );
  ELSE
    -- Rejected: clear deletion request
    UPDATE public.orders
    SET
      deletion_requested_by = NULL,
      deletion_requested_at = NULL,
      deletion_reason = NULL,
      updated_at = v_now
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_DELETION_REVIEWED',
      'Order deletion rejected by Head: ' || COALESCE(p_review_notes, 'Rejected'),
      jsonb_build_object('review_notes', p_review_notes, 'decision', 'rejected'),
      v_now
    );

    RETURN jsonb_build_object(
      'success', true,
      'deletion_requested', false,
      'message', 'Order deletion request was rejected.'
    );
  END IF;
END;
$$;

-- 7c. Direct Soft Remove Order to Bin (Superadmin Only)
CREATE OR REPLACE FUNCTION public.remove_current_month_order(
  p_order_id uuid,
  p_category text,
  p_reason text
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
  v_order RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized: Only Superadministrators can remove orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A valid reason of at least 5 characters is required.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.orders
  SET
    is_in_bin = true,
    is_removed = true,
    removed_at = v_now,
    removed_by = v_actor_id,
    removed_by_name = COALESCE(v_actor_name, v_actor_email),
    removal_reason = trim(p_reason),
    removal_category = trim(p_category),
    scheduled_deletion_at = v_now + INTERVAL '7 days',
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role,
    'ORDER_REMOVED',
    'Order removed to Bin as ' || trim(p_category) || ': ' || trim(p_reason),
    jsonb_build_object(
      'category', trim(p_category),
      'reason', trim(p_reason),
      'removed_by', COALESCE(v_actor_name, v_actor_email)
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_in_bin', true,
    'message', 'Order removed to Bin successfully.'
  );
END;
$$;

-- 7d. Restore Order from Bin (Superadmin Only)
CREATE OR REPLACE FUNCTION public.restore_order_from_bin(
  p_order_id uuid,
  p_reason text DEFAULT 'Restored from Bin'::text
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
  v_order RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized: Only Superadministrators can restore orders from the Bin.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT v_order.is_in_bin AND NOT v_order.is_removed THEN
    RAISE EXCEPTION 'Order is not currently in the Bin.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.orders
  SET
    is_in_bin = false,
    is_removed = false,
    removed_at = NULL,
    removed_by = NULL,
    removed_by_name = NULL,
    removal_reason = NULL,
    removal_category = NULL,
    scheduled_deletion_at = NULL,
    deletion_requested_by = NULL,
    deletion_requested_at = NULL,
    deletion_reason = NULL,
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role,
    'ORDER_RESTORED',
    'Order restored from Bin by Head Superadmin: ' || COALESCE(p_reason, 'Restored'),
    jsonb_build_object('reason', p_reason, 'restored_by', COALESCE(v_actor_name, v_actor_email)),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_in_bin', false,
    'message', 'Order restored from Bin successfully.'
  );
END;
$$;

-- 8. Grant Execution Privileges to authenticated role
GRANT EXECUTE ON FUNCTION public.create_sales_order(
  text, text, jsonb, numeric, text, text, text, text, text, uuid, timestamptz, numeric, numeric
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_sales_order(
  uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.assign_order_engineer(
  uuid, uuid, timestamptz, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_order_deletion(
  uuid, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.review_order_deletion(
  uuid, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.remove_current_month_order(
  uuid, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.restore_order_from_bin(
  uuid, text
) TO authenticated;

