-- ============================================================================
-- ARS COMPUTERS — ORDER EDIT PERMISSIONS & SUPER ADMIN APPROVAL WORKFLOW
-- Migration: 20261103000023_order_edit_permissions_and_superadmin_approval.sql
-- ============================================================================
-- Business Rules:
-- 1. Before Super Admin approval, order editing is allowed ONLY for:
--    - HR ('hr')
--    - Accountant ('account')
--    - Technical ('technical')
--    - Super Admin ('superadmin')
--    All other roles (engineer, inventory_staff, admin) have read-only access.
-- 2. Pending and Active status do NOT restrict editing for these authorized roles.
-- 3. Once Super Admin explicitly approves the order (completion_approved_at IS NOT NULL
--    or status = 'completed'), ordinary editing is strictly BLOCKED for all three roles.
-- 4. Super Admin may perform privileged corrections on approved orders, with
--    mandatory audit logging (SUPERADMIN_ORDER_CORRECTION in order_activities).
-- 5. Atomic row locking (FOR UPDATE) prevents race conditions where an edit could
--    bypass concurrent Super Admin approval.
-- 6. Supports editing payment details (p_payment_method, p_paid_amount, p_payment_status)
--    with deterministic derivation preserving chk_orders_payment_status_consistency.
-- ============================================================================

-- ============================================================================
-- STEP 1: IDEMPOTENT CUSTOMER CONTACT SCHEMA ON public.orders
-- ============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

COMMENT ON COLUMN public.orders.customer_email IS 'Customer contact email address for dispatch notifications and order correspondence.';
COMMENT ON COLUMN public.orders.customer_phone IS 'Customer secondary contact telephone/mobile number.';
COMMENT ON COLUMN public.orders.customer_address IS 'Site/delivery street address for equipment installations and deliveries.';

-- ============================================================================
-- STEP 2: EXPAND CHECK CONSTRAINT ON public.order_activities
-- ============================================================================
-- Safely preserves all 21 existing activity types (including ORDER_AUDIT_RECONCILIATION
-- from migration 21) and adds:
-- - 'SUPERADMIN_ORDER_CORRECTION'
-- - 'ORDER_UPDATED'
-- Total allowed activity types: 23
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
      'ORDER_DELETION_REVIEWED'::text,
      'ORDER_AUDIT_RECONCILIATION'::text,
      'SUPERADMIN_ORDER_CORRECTION'::text,
      'ORDER_UPDATED'::text
    ]));
END $$;

-- ============================================================================
-- STEP 3: UPDATE IMMUTABILITY TRIGGER (trg_protect_order_immutability)
-- ============================================================================
-- Completed orders: Core financial and workflow attributes are permanently locked.
-- Permitted exceptions:
--   1. Incremental payment updates via record_order_payment
--   2. Bin and Removal audit columns via remove/restore RPCs
--   3. Authenticated Super Admin corrections via update_sales_order with
--      transaction-scoped override verified against public.admin_users
CREATE OR REPLACE FUNCTION public.trg_protect_order_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_correction_actor_str TEXT;
  v_is_authorized_superadmin BOOLEAN := false;
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
  IF OLD.status = 'completed' THEN
    -- Verify transaction-scoped Super Admin correction authorization
    v_correction_actor_str := pg_catalog.nullif(pg_catalog.current_setting('ars.superadmin_order_correction', true), '');
    IF v_correction_actor_str IS NOT NULL THEN
      IF auth.uid() IS NOT NULL AND auth.uid()::text = v_correction_actor_str THEN
        IF EXISTS (
          SELECT 1 FROM public.admin_users
          WHERE id = auth.uid()
            AND role = 'superadmin'
            AND is_active = true
        ) THEN
          v_is_authorized_superadmin := true;
        END IF;
      END IF;
    END IF;

    -- If authorized Super Admin correction:
    -- Strict allowlist: ONLY customer contact and commercial pricing fields may change.
    -- All workflow status, assignment, creation provenance, completion submission provenance,
    -- approval provenance, cancellation, archival, bin, and removal fields are strictly locked.
    IF v_is_authorized_superadmin THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR
         NEW.order_number IS DISTINCT FROM OLD.order_number OR
         NEW.status IS DISTINCT FROM OLD.status OR
         NEW.created_by IS DISTINCT FROM OLD.created_by OR
         NEW.created_by_name IS DISTINCT FROM OLD.created_by_name OR
         NEW.created_by_employee_code IS DISTINCT FROM OLD.created_by_employee_code OR
         NEW.created_at IS DISTINCT FROM OLD.created_at OR
         NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id OR
         NEW.assigned_engineer_name IS DISTINCT FROM OLD.assigned_engineer_name OR
         NEW.assigned_engineer_code IS DISTINCT FROM OLD.assigned_engineer_code OR
         NEW.assigned_engineer_phone IS DISTINCT FROM OLD.assigned_engineer_phone OR
         NEW.assigned_at IS DISTINCT FROM OLD.assigned_at OR
         NEW.assigned_by IS DISTINCT FROM OLD.assigned_by OR
         NEW.assigned_by_name IS DISTINCT FROM OLD.assigned_by_name OR
         NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at OR
         NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by OR
         NEW.completed_by_name IS DISTINCT FROM OLD.completed_by_name OR
         NEW.completed_by_employee_code IS DISTINCT FROM OLD.completed_by_employee_code OR
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
         NEW.archived_at IS DISTINCT FROM OLD.archived_at OR
         NEW.is_in_bin IS DISTINCT FROM OLD.is_in_bin OR
         NEW.scheduled_deletion_at IS DISTINCT FROM OLD.scheduled_deletion_at OR
         NEW.deletion_reason IS DISTINCT FROM OLD.deletion_reason OR
         NEW.deletion_requested_by IS DISTINCT FROM OLD.deletion_requested_by OR
         NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at OR
         NEW.is_removed IS DISTINCT FROM OLD.is_removed OR
         NEW.removed_at IS DISTINCT FROM OLD.removed_at OR
         NEW.removed_by IS DISTINCT FROM OLD.removed_by OR
         NEW.removed_by_name IS DISTINCT FROM OLD.removed_by_name OR
         NEW.removal_reason IS DISTINCT FROM OLD.removal_reason OR
         NEW.removal_category IS DISTINCT FROM OLD.removal_category THEN
        RAISE EXCEPTION 'Order immutability violation: Super Admin correction is restricted to customer and commercial attributes. Workflow status, assignment provenance, approval provenance, and archive fields cannot be modified.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      -- Ordinary users or unauthorized attempts: enforce complete immutability
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_immutability ON public.orders;
CREATE TRIGGER trg_protect_order_immutability
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_order_immutability();

-- ============================================================================
-- STEP 4: CLEAN UP OBSOLETE update_sales_order FUNCTION SIGNATURES
-- ============================================================================
-- Explicitly drop 13-parameter signature from 20261102000020
DROP FUNCTION IF EXISTS public.update_sales_order(
  uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text
);

-- Drop previous 16-parameter signature if re-running
DROP FUNCTION IF EXISTS public.update_sales_order(
  uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text, text, numeric, text
);

-- ============================================================================
-- STEP 5: ATOMIC update_sales_order RPC WITH SUPER ADMIN APPROVAL ENFORCEMENT
-- ============================================================================
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
  p_order_status text DEFAULT NULL::text,
  p_payment_method text DEFAULT NULL::text,
  p_paid_amount numeric DEFAULT NULL::numeric,
  p_payment_status text DEFAULT NULL::text
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
  v_target_paid NUMERIC(12,2);
  v_target_payment_method TEXT;
  v_new_payment_status TEXT;
  v_new_status TEXT;
  v_is_approved BOOLEAN := false;

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
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email, employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  -- 2. Strict Role-Based Order Editing: Only HR, Accountant, Technical, and Super Admin permitted
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'hr', 'account', 'technical') THEN
    RAISE EXCEPTION 'Access denied: Order editing is restricted to HR, Accountant, and Technical roles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock order row atomically (FOR UPDATE prevents race conditions with concurrent approvals)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Cancelled orders are finalized and immutable
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot edit a cancelled order.' USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Approval State Enforcement:
  -- An order is Super Admin approved if completion_approved_at IS NOT NULL or status = 'completed'.
  -- Once approved, ordinary editing is BLOCKED for all non-superadmin roles (HR, Accountant, Technical).
  v_is_approved := (v_order.completion_approved_at IS NOT NULL OR v_order.status = 'completed');

  IF v_is_approved AND v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Order has been approved by Super Admin. Editing is restricted to Superadministrators.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Set transaction-scoped Super Admin override if performing privileged correction on approved order
  IF v_is_approved AND v_actor_role = 'superadmin' THEN
    PERFORM pg_catalog.set_config('ars.superadmin_order_correction', v_actor_id::text, true);
  END IF;

  -- 6. Validate inputs
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

  -- 7. Payment details handling: Allow editing payment forward or backward freely up to total amount
  IF p_paid_amount IS NOT NULL THEN
    v_target_paid := GREATEST(0, p_paid_amount);
  ELSE
    v_target_paid := COALESCE(v_order.paid_amount, 0);
  END IF;

  -- Flexible payment editing: Clamping paid amount to order total ensures payment never
  -- exceeds total amount (preserving table check constraint chk_orders_payment_status_consistency)
  -- while allowing order totals to be reduced or payments adjusted freely forward and backward.
  IF v_target_paid > v_calc_total THEN
    v_target_paid := v_calc_total;
  END IF;

  -- Payment method
  IF p_payment_method IS NOT NULL AND trim(p_payment_method) <> '' THEN
    v_target_payment_method := lower(trim(p_payment_method));
    IF v_target_payment_method NOT IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN
      v_target_payment_method := 'cash';
    END IF;
  ELSE
    v_target_payment_method := COALESCE(v_order.payment_method, 'cash');
  END IF;

  -- Payment status: Derived strictly and deterministically from paid_amount and total_amount
  -- to guarantee full compliance with chk_orders_payment_status_consistency
  IF v_calc_total = 0 THEN
    v_new_payment_status := 'paid';
  ELSIF v_target_paid = 0 THEN
    v_new_payment_status := 'pending';
  ELSIF v_target_paid >= v_calc_total THEN
    v_target_paid := v_calc_total; -- Clamp to total per check constraint
    v_new_payment_status := 'paid';
  ELSE
    v_new_payment_status := 'partial';
  END IF;

  -- Determine target status (Pending and Active orders remain editable)
  v_new_status := v_order.status;
  IF p_order_status IS NOT NULL AND p_order_status IN ('new', 'processing', 'completion_requested') THEN
    IF NOT v_is_approved THEN
      v_new_status := p_order_status;
    END IF;
  END IF;

  -- 8. Update order record
  UPDATE public.orders
  SET
    customer_name = trim(p_customer_name),
    contact_info = trim(p_contact_info),
    customer_email = v_clean_email,
    customer_phone = v_clean_phone,
    customer_address = v_clean_address,
    status = v_new_status,
    total_amount = v_calc_total,
    paid_amount = v_target_paid,
    payment_method = v_target_payment_method,
    payment_status = v_new_payment_status,
    discount_amount = v_discount,
    tax_amount = v_tax,
    assigned_engineer_id = CASE WHEN v_is_approved THEN v_order.assigned_engineer_id ELSE v_eng_id END,
    assigned_engineer_name = CASE WHEN v_is_approved THEN v_order.assigned_engineer_name ELSE v_eng_name END,
    assigned_engineer_code = CASE WHEN v_is_approved THEN v_order.assigned_engineer_code ELSE v_eng_code END,
    assigned_engineer_phone = CASE WHEN v_is_approved THEN v_order.assigned_engineer_phone ELSE v_eng_phone END,
    assigned_at = CASE
      WHEN NOT v_is_approved AND v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN v_now
      ELSE v_order.assigned_at
    END,
    assigned_by = CASE
      WHEN NOT v_is_approved AND v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN v_actor_id
      ELSE v_order.assigned_by
    END,
    assigned_by_name = CASE
      WHEN NOT v_is_approved AND v_eng_id IS NOT NULL AND (v_order.assigned_engineer_id IS NULL OR v_order.assigned_engineer_id <> v_eng_id)
        THEN COALESCE(v_actor_name, v_actor_email)
      ELSE v_order.assigned_by_name
    END,
    expected_delivery_date = p_expected_delivery_date,
    employee_remarks = trim(p_employee_remarks),
    updated_at = v_now
  WHERE id = p_order_id;

  -- 9. Reconcile payment adjustments with immutable order_payments ledger & audit log
  IF v_target_paid > COALESCE(v_order.paid_amount, 0) THEN
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
      p_order_id,
      (v_target_paid - COALESCE(v_order.paid_amount, 0)),
      v_target_payment_method,
      'ORDER-EDIT-ADJUSTMENT',
      COALESCE(trim(p_employee_remarks), 'Incremental payment recorded during order edit.'),
      v_actor_id,
      COALESCE(v_actor_name, v_actor_email),
      v_actor_code,
      v_now,
      v_now
    );
  ELSIF v_target_paid < COALESCE(v_order.paid_amount, 0) THEN
    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_PAYMENT_RECORDED',
      'Payment adjustment: Paid amount revised from ₹' || v_order.paid_amount || ' to ₹' || v_target_paid || '. Reason: ' || COALESCE(trim(p_employee_remarks), 'Adjustment during order edit.'),
      v_now
    );
  END IF;

  -- 10. Preserve existing purchase cost snapshots across edits
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
      quantity,
      unit_price,
      line_total,
      cost_price_snapshot,
      created_at
    ) VALUES (
      p_order_id,
      v_item.product_id,
      COALESCE(v_prod_name, v_item.product_name, 'Custom Item'),
      COALESCE(v_prod_brand, v_item.brand, ''),
      COALESCE(v_prod_model, v_item.model, ''),
      COALESCE(v_prod_sku, v_item.sku, ''),
      v_qty,
      v_unit_price,
      v_line_total,
      COALESCE(v_prev_cost, v_prod_cost),
      v_now
    );
  END LOOP;

  -- 11. Audit Logging:
  -- Privileged Super Admin correction vs Ordinary Staff edit
  IF v_is_approved AND v_actor_role = 'superadmin' THEN
    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role, 'SUPERADMIN_ORDER_CORRECTION',
      COALESCE(trim(p_employee_remarks), 'Superadministrator made privileged correction to approved order.'),
      v_now
    );
  ELSE
    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_UPDATED',
      COALESCE(trim(p_employee_remarks), 'Order updated by ' || upper(v_actor_role)),
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_amount', v_calc_total,
    'paid_amount', v_target_paid,
    'payment_status', v_new_payment_status,
    'is_superadmin_correction', (v_is_approved AND v_actor_role = 'superadmin'),
    'message', CASE
      WHEN v_is_approved AND v_actor_role = 'superadmin'
        THEN 'Superadministrator privileged correction saved and audited.'
      ELSE 'Order updated successfully.'
    END
  );
END;
$$;

-- Secure grants
REVOKE ALL ON FUNCTION public.update_sales_order(
  uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text, text, numeric, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_sales_order(
  uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text, text, numeric, text
) TO authenticated, service_role;
