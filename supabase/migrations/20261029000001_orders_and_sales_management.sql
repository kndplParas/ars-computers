-- ============================================================================
-- ARS Computers — Migration: 20261029000001_orders_and_sales_management.sql
-- ============================================================================
-- PURPOSE:
-- 1. Introduces public.orders and public.order_items tables for sales operations.
-- 2. Concurrency-safe human-readable order number sequence: ARS-ORD-01001+.
-- 3. Normalized order line items with frozen transaction-time snapshots.
-- 4. Server-enforced financial validations (NUMERIC storage, paid <= total, payment status).
-- 5. Strict lifecycle state machine: new -> processing -> completion_requested -> completed / cancelled.
-- 6. Superadmin final review requirement with self-approval protection.
-- 7. Permanent archive & anti-deletion triggers.
-- 8. Activity logging in dedicated public.order_activities.
-- 9. Row Level Security policies adhering to ARS role model.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ORDER REFERENCE SEQUENCE
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_reference_seq START WITH 1001;

REVOKE ALL ON SEQUENCE public.order_reference_seq FROM PUBLIC, anon;
GRANT USAGE, SELECT ON SEQUENCE public.order_reference_seq TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT (
    'ARS-ORD-' || pg_catalog.lpad(pg_catalog.nextval('public.order_reference_seq')::text, 5, '0')
  ),

  -- Customer Information
  customer_name TEXT NOT NULL,
  contact_info TEXT NOT NULL,

  -- Lifecycle Status
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'processing', 'completion_requested', 'completed', 'cancelled')),

  -- Financials
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00
    CHECK (total_amount >= 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00
    CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),

  -- Accountability: Creation
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_employee_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Accountability: Completion Request
  completion_requested_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  completion_requested_at TIMESTAMPTZ,
  completed_by_name TEXT,
  completed_by_employee_code TEXT,
  employee_remarks TEXT,

  -- Accountability: Head Approval
  completion_approved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  completion_approved_at TIMESTAMPTZ,
  approved_by_name TEXT,
  approved_by_employee_code TEXT,
  head_remarks TEXT,

  -- Accountability: Cancellation
  cancelled_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_name TEXT,
  cancellation_reason TEXT,

  -- Archival
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Constraints
  CONSTRAINT chk_orders_customer_name_not_empty CHECK (pg_catalog.char_length(pg_catalog.btrim(customer_name)) >= 2),
  CONSTRAINT chk_orders_contact_info_not_empty CHECK (pg_catalog.char_length(pg_catalog.btrim(contact_info)) >= 5),
  CONSTRAINT chk_orders_payment_status_consistency CHECK (
    (payment_status = 'pending' AND paid_amount = 0) OR
    (payment_status = 'partial' AND paid_amount > 0 AND paid_amount < total_amount) OR
    (payment_status = 'paid' AND paid_amount = total_amount)
  ),
  CONSTRAINT chk_orders_cancellation_reason_required CHECK (
    (status != 'cancelled') OR (cancellation_reason IS NOT NULL AND pg_catalog.char_length(pg_catalog.btrim(cancellation_reason)) >= 5)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_approved_at ON public.orders (completion_approved_at DESC) WHERE completion_approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders (created_by);
CREATE INDEX IF NOT EXISTS idx_orders_archived ON public.orders (is_archived);

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.order_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,

  -- Transaction-time frozen product snapshots
  product_name_snapshot TEXT NOT NULL,
  brand_snapshot TEXT,
  model_snapshot TEXT,
  sku_snapshot TEXT,

  -- Quantities & Financials
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT chk_order_items_line_total CHECK (line_total = (quantity * unit_price))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

-- ----------------------------------------------------------------------------
-- 4. TABLE: public.order_activities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'ORDER_CREATED',
      'ORDER_PROCESSING_STARTED',
      'ORDER_COMPLETION_SUBMITTED',
      'ORDER_COMPLETION_APPROVED',
      'ORDER_CANCELLED'
    )
  ),
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_activities_order ON public.order_activities (order_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 5. EXTEND AUDIT LOGS ENTITY TYPE CHECK
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_logs_entity_type_check'
      AND conrelid = 'public.audit_logs'::regclass
  ) THEN
    ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_entity_type_check;
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
      CHECK (entity_type IN ('enquiries', 'products', 'categories', 'admin_users', 'storage', 'orders'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. DATABASE PROTECTION TRIGGERS
-- ----------------------------------------------------------------------------

-- A. Prevent physical deletion of orders
CREATE OR REPLACE FUNCTION public.trg_prevent_order_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Permanent archive protection: Orders cannot be physically deleted. Use cancellation instead.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_orders_deletion ON public.orders;
CREATE TRIGGER trg_protect_orders_deletion
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_order_deletion();

-- B. Prevent modifications to completed or cancelled orders
CREATE OR REPLACE FUNCTION public.trg_protect_order_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('completed', 'cancelled') THEN
    IF NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.contact_info IS DISTINCT FROM OLD.contact_info OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.paid_amount IS DISTINCT FROM OLD.paid_amount OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.order_number IS DISTINCT FROM OLD.order_number THEN
      RAISE EXCEPTION 'Order immutability violation: Finalized or cancelled orders cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_immutability ON public.orders;
CREATE TRIGGER trg_protect_order_immutability
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_order_immutability();

-- C. Prevent item modifications on finalized orders
CREATE OR REPLACE FUNCTION public.trg_protect_order_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_status TEXT;
  v_target_order_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_order_id := OLD.order_id;
  ELSE
    v_target_order_id := NEW.order_id;
  END IF;

  SELECT status INTO v_parent_status
  FROM public.orders
  WHERE id = v_target_order_id;

  IF v_parent_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Order item immutability violation: Cannot modify items of a finalized or cancelled order.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_items_immutability ON public.order_items;
CREATE TRIGGER trg_protect_order_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_order_items_immutability();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_activities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_activities FROM PUBLIC, anon, authenticated;

-- Allow SELECT for active staff members (superadmin, admin, inventory_staff)
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.order_activities TO authenticated;

DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
CREATE POLICY "Staff can view orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can view order items" ON public.order_items;
CREATE POLICY "Staff can view order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Staff can view order activities" ON public.order_activities;
CREATE POLICY "Staff can view order activities"
  ON public.order_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 8. WORKFLOW RPC: create_sales_order
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_sales_order(TEXT, TEXT, JSONB, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_customer_name TEXT,
  p_contact_info TEXT,
  p_items JSONB,
  p_paid_amount NUMERIC DEFAULT 0.00,
  p_payment_method TEXT DEFAULT 'cash',
  p_employee_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_code TEXT;

  v_clean_name TEXT;
  v_clean_contact TEXT;
  v_clean_method TEXT;

  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_calc_total NUMERIC(12, 2) := 0.00;

  v_product RECORD;
  v_payment_status TEXT;
  v_order_id UUID;
  v_order_number TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  -- Only superadmin and admin (store employee) can create orders. inventory_staff is read-only.
  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator or store employee privileges required to create orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_name := pg_catalog.btrim(p_customer_name);
  IF v_clean_name IS NULL OR pg_catalog.char_length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Validation error: A valid customer name (at least 2 characters) is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_contact := pg_catalog.btrim(p_contact_info);
  IF v_clean_contact IS NULL OR pg_catalog.char_length(v_clean_contact) < 5 THEN
    RAISE EXCEPTION 'Validation error: Valid customer contact information (at least 5 characters) is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_method := pg_catalog.lower(pg_catalog.btrim(p_payment_method));
  IF v_clean_method NOT IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Validation error: Invalid payment method "%".', p_payment_method
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Validation error: Order must contain at least one item.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_paid_amount < 0 THEN
    RAISE EXCEPTION 'Validation error: Paid amount cannot be negative.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Pre-calculate and validate all line items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::INT;
    v_price := (v_item ->> 'unit_price')::NUMERIC(12, 2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Validation error: Line item quantity must be greater than zero.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Validation error: Line item unit price cannot be negative.'
        USING ERRCODE = 'check_violation';
    END IF;

    v_line_total := v_qty * v_price;
    v_calc_total := v_calc_total + v_line_total;
  END LOOP;

  IF p_paid_amount > v_calc_total THEN
    RAISE EXCEPTION 'Validation error: Paid amount (%) cannot exceed total amount (%).', p_paid_amount, v_calc_total
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_paid_amount = 0 THEN
    v_payment_status := 'pending';
  ELSIF p_paid_amount = v_calc_total THEN
    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'partial';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  -- Create order row
  INSERT INTO public.orders (
    customer_name,
    contact_info,
    status,
    total_amount,
    paid_amount,
    payment_status,
    payment_method,
    created_by,
    created_by_name,
    created_by_employee_code,
    employee_remarks,
    created_at,
    updated_at
  ) VALUES (
    v_clean_name,
    v_clean_contact,
    'new',
    v_calc_total,
    p_paid_amount,
    v_payment_status,
    v_clean_method,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    pg_catalog.btrim(p_employee_remarks),
    v_now,
    v_now
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert order items with snapshots
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::INT;
    v_price := (v_item ->> 'unit_price')::NUMERIC(12, 2);
    v_line_total := v_qty * v_price;

    IF (v_item ->> 'product_id') IS NOT NULL AND (v_item ->> 'product_id') != '' THEN
      v_product_id := (v_item ->> 'product_id')::UUID;
      SELECT name, brand, model, sku INTO v_product
      FROM public.products
      WHERE id = v_product_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Validation error: Product ID % does not exist in catalogue.', v_product_id
          USING ERRCODE = 'no_data_found';
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
        v_product_id,
        v_product.name,
        v_product.brand,
        v_product.model,
        v_product.sku,
        v_qty,
        v_price,
        v_line_total,
        v_now
      );
    ELSE
      -- Custom/Ad-hoc order item
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
        NULL,
        pg_catalog.btrim(COALESCE(v_item ->> 'product_name', 'Custom Hardware Item')),
        v_item ->> 'brand',
        v_item ->> 'model',
        v_item ->> 'sku',
        v_qty,
        v_price,
        v_line_total,
        v_now
      );
    END IF;
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
    v_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_CREATED',
    'Order created with total amount ₹' || v_calc_total::text,
    pg_catalog.jsonb_build_object(
      'order_number', v_order_number,
      'total_amount', v_calc_total,
      'paid_amount', p_paid_amount,
      'payment_status', v_payment_status,
      'payment_method', v_clean_method
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_calc_total,
    'paid_amount', p_paid_amount,
    'payment_status', v_payment_status,
    'message', 'Sales order created successfully.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. WORKFLOW RPC: start_sales_order
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_order RECORD;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Administrator or store employee privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status != 'new' THEN
    RAISE EXCEPTION 'Invalid state: Order must be in "new" status to start processing.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.orders
  SET status = 'processing', updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_PROCESSING_STARTED',
    'Order processing started.', v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'processing',
    'message', 'Order is now processing.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. WORKFLOW RPC: submit_order_completion
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_order_completion(
  p_order_id UUID,
  p_employee_remarks TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Administrator or store employee privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_remarks := pg_catalog.btrim(p_employee_remarks);
  IF v_clean_remarks IS NULL OR pg_catalog.char_length(v_clean_remarks) < 5 THEN
    RAISE EXCEPTION 'Validation error: Meaningful completion remarks (at least 5 characters) are required.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status NOT IN ('new', 'processing') THEN
    RAISE EXCEPTION 'Invalid state: Cannot submit completion for an order with status "%".', v_order.status
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.orders
  SET
    status = 'completion_requested',
    completion_requested_by = v_actor_id,
    completion_requested_at = v_now,
    completed_by_name = COALESCE(v_actor_name, v_actor_email),
    completed_by_employee_code = v_actor_code,
    employee_remarks = v_clean_remarks,
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_COMPLETION_SUBMITTED',
    v_clean_remarks, v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completion_requested',
    'completed_by_name', COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code,
    'message', 'Order completion submitted for Head approval.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. WORKFLOW RPC: review_order_completion (Superadmin Only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_order_completion(
  p_order_id UUID,
  p_head_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ----------------------------------------------------------------------------
-- 12. WORKFLOW RPC: cancel_sales_order (Superadmin Only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_sales_order(
  p_order_id UUID,
  p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_order RECORD;
  v_clean_reason TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name INTO v_actor_email, v_actor_role, v_actor_name
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Superadministrators can cancel sales orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(p_cancellation_reason);
  IF v_clean_reason IS NULL OR pg_catalog.char_length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'Validation error: A mandatory cancellation reason (at least 5 characters) is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid state: Cannot cancel an order that is already finalized or cancelled.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.orders
  SET
    status = 'cancelled',
    is_archived = true,
    archived_at = v_now,
    cancelled_by = v_actor_id,
    cancelled_at = v_now,
    cancelled_by_name = COALESCE(v_actor_name, v_actor_email),
    cancellation_reason = v_clean_reason,
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_CANCELLED',
    v_clean_reason, v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'cancelled_by_name', COALESCE(v_actor_name, v_actor_email),
    'cancelled_at', v_now,
    'message', 'Order cancelled and preserved in permanent audit archive.'
  );
END;
$$;

-- Grant EXECUTE strictly to authenticated users
REVOKE ALL ON FUNCTION public.create_sales_order(TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_order(TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.start_sales_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_sales_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_order_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_completion(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_order_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_order_completion(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_sales_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sales_order(UUID, TEXT) TO authenticated;
