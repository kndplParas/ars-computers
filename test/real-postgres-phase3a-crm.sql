-- ============================================================================
-- ARS Computers — Phase 3A + CRM Corrected PostgreSQL Integration Test Harness
-- Scope: Local / Isolated Test Environment ONLY (http://127.0.0.1:54322)
--
-- Safety & Invariant Principles:
-- 1. All tests execute inside a transaction block and end with ROLLBACK.
-- 2. Direct-table access tests execute strictly under 'authenticated' role.
-- 3. Row-count checks and fixture assertions run under privileged context (RESET ROLE).
-- 4. Never grants extra table-level permissions to 'authenticated' just to pass tests.
-- 5. Exact function signatures and valid argument types verified against migrations.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. APPLY PREPARED MIGRATIONS (22, 23, 24, 25)
-- ----------------------------------------------------------------------------
-- ============================================================================
-- INLINED MIGRATION 22: Correct Assign Order Engineer Security
-- ============================================================================
-- ============================================================================
-- ARS Computers — Step 22: Correct Engineer Assignment Security & Concurrency
-- Migration: 20261120000022_correct_assign_order_engineer_security.sql
-- Status: PREPARED LOCAL MIGRATION (Phase 3A Financial Security Hardening)
-- ============================================================================
-- Objectives:
-- 1. Preserve atomic row-level locking (SELECT ... FOR UPDATE) on public.orders.
-- 2. Enforce that field engineers cannot overwrite or reassign orders already
--    assigned to another engineer.
-- 3. Enforce that field engineers may only self-assign unassigned orders to
--    themselves (cannot assign orders to third-party colleagues).
-- 4. Restrict reassigning already-assigned orders exclusively to Management
--    and Technical Leads (superadmin, admin, technical).
-- 5. Preserve existing authorized assignment workflows and activity audit logging.
-- ============================================================================

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
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity
  SELECT role, full_name, email INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Atomic row lock on target order to eliminate assignment race conditions
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Status validations
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot assign engineer to a cancelled order.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.is_in_bin OR v_order.is_removed THEN
    RAISE EXCEPTION 'Cannot assign engineer to an order currently in the Bin.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.status = 'completed' AND v_order.is_archived THEN
    RAISE EXCEPTION 'Cannot reassign a permanently archived and completed order.' USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Role-Specific Concurrency & Reassignment Guard
  -- If caller is a field engineer:
  -- - Cannot claim an order that is already assigned to a different engineer
  -- - Can only assign to themselves (self-assign)
  IF v_actor_role = 'engineer' THEN
    IF v_order.assigned_engineer_id IS NOT NULL AND v_order.assigned_engineer_id <> v_actor_id THEN
      RAISE EXCEPTION 'Cannot claim or reassign an order already assigned to another technician.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_engineer_id IS NOT NULL AND p_engineer_id <> v_actor_id THEN
      RAISE EXCEPTION 'Field engineers may only assign orders to themselves.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  v_prev_eng_name := v_order.assigned_engineer_name;

  -- 6. Execute Assignment or Unassignment
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
      assigned_at = v_now,
      assigned_by = v_actor_id,
      assigned_by_name = COALESCE(v_actor_name, v_actor_email),
      expected_delivery_date = COALESCE(p_expected_delivery_date, expected_delivery_date),
      updated_at = v_now
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
      v_now
    );
  ELSE
    -- Unassign engineer (Only Superadmin, Admin, Technical, or the assigned engineer themselves)
    IF v_actor_role = 'engineer' AND v_order.assigned_engineer_id IS NOT NULL AND v_order.assigned_engineer_id <> v_actor_id THEN
      RAISE EXCEPTION 'Cannot unassign an order assigned to another engineer.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.orders
    SET
      assigned_engineer_id = NULL,
      assigned_engineer_name = NULL,
      assigned_engineer_code = NULL,
      assigned_engineer_phone = NULL,
      assigned_at = NULL,
      assigned_by = NULL,
      assigned_by_name = NULL,
      updated_at = v_now
    WHERE id = p_order_id;

    INSERT INTO public.order_activities (
      order_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
    ) VALUES (
      p_order_id, v_actor_id, v_actor_email, v_actor_role,
      'ORDER_ENGINEER_UNASSIGNED',
      'Engineer assignment removed by ' || COALESCE(v_actor_name, v_actor_email),
      jsonb_build_object('previous_engineer', v_prev_eng_name, 'notes', p_notes),
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'assigned_engineer_id', p_engineer_id,
    'assigned_engineer_name', v_eng.full_name,
    'message', CASE WHEN p_engineer_id IS NOT NULL THEN 'Engineer assigned successfully.' ELSE 'Engineer unassigned successfully.' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_order_engineer(uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_engineer(uuid, uuid, timestamptz, text) TO authenticated;


-- ============================================================================
-- INLINED MIGRATION 23: Secure Order Financial RPCs
-- ============================================================================
-- ============================================================================
-- ARS Computers — Step 23: Secure Role-Based Order Financial Projections & Analytics RPCs
-- Migration: 20261120000023_secure_order_financial_rpcs.sql
-- Status: PREPARED LOCAL MIGRATION (Phase 3A Financial Security Hardening)
-- ============================================================================
-- Objectives:
-- 1. Create SECURITY DEFINER RPC public.get_admin_orders:
--    - Enforces row-level visibility per staff role (Inventory Staff sees only
--      dispatchable non-cancelled orders; Engineer sees only assigned/pool orders;
--      Non-management excluded from Bin/Removed orders).
--    - Enforces field-level masking (HR customer PII masked; Inventory Staff
--      prices/totals masked to NULL; Cost snapshots hidden from Engineer,
--      Technical, HR, and Inventory Staff; Full financials restricted to
--      Management & Accounts: superadmin, admin, account).
--    - Supports reliable pagination with explicit total_count and has_more metadata.
-- 2. Create SECURITY DEFINER RPC public.get_admin_order_payments:
--    - Restricted strictly to Management & Accounts (superadmin, admin, account).
--    - Pre-verifies order-level visibility before returning transaction ledgers.
-- 3. Create SECURITY DEFINER RPC public.get_monthly_business_analytics:
--    - Restricted strictly to Management & Accounts (superadmin, admin, account).
--    - Computes metrics using Asia/Kolkata timezone and exact half-open monthly ranges.
--    - Prevents any financial aggregate leakage to operational staff.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORED PROCEDURE: public.get_admin_orders
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_orders(
  p_status text DEFAULT NULL::text,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_total_count INTEGER;
  v_effective_limit INTEGER;
  v_effective_offset INTEGER;
  v_has_more BOOLEAN;
  v_orders JSONB;
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role
  v_role := public.get_staff_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Compute total count for reliable pagination under exact role-visibility rules
  SELECT count(*)
  INTO v_total_count
  FROM public.orders o
  WHERE
    -- Inventory Staff: Only dispatchable orders (new, processing, completion_requested, non-bin completed)
    -- Strictly no cancelled, bin, or removed orders
    (v_role != 'inventory_staff' OR (
      o.is_in_bin = false AND o.is_removed = false AND o.status != 'cancelled'
    ))
    -- Engineer: Restricted strictly to assigned orders, orders created by self, or unassigned active pool
    AND (v_role != 'engineer' OR (
      o.is_in_bin = false AND o.is_removed = false AND (
        o.assigned_engineer_id = v_actor_id OR
        o.created_by = v_actor_id OR
        (o.assigned_engineer_id IS NULL AND o.status IN ('new', 'processing'))
      )
    ))
    -- Technical & HR: Shop-floor operations, never see bin or removed orders
    AND (v_role NOT IN ('technical', 'hr') OR (
      o.is_in_bin = false AND o.is_removed = false
    ))
    -- Account: Exclude bin/removed orders from general accounting view
    AND (v_role != 'account' OR (
      o.is_in_bin = false AND o.is_removed = false
    ))
    -- Caller status filter (if provided)
    AND (p_status IS NULL OR o.status = p_status);

  -- 4. Calculate pagination offsets & limits
  v_effective_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_effective_limit := CASE 
    WHEN p_limit IS NOT NULL AND p_limit > 0 THEN p_limit 
    ELSE v_total_count 
  END;
  v_has_more := (v_effective_offset + v_effective_limit) < v_total_count;

  -- 5. Query and project role-tailored order records
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_name', o.customer_name,
      'contact_info', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE o.contact_info 
      END,
      'customer_email', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE o.customer_email 
      END,
      'customer_phone', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE o.customer_phone 
      END,
      'customer_address', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE o.customer_address 
      END,
      'status', o.status,
      'payment_status', CASE 
        WHEN v_role = 'inventory_staff' THEN NULL 
        ELSE o.payment_status 
      END,
      'payment_method', CASE 
        WHEN v_role = 'inventory_staff' THEN NULL 
        ELSE o.payment_method 
      END,
      'total_amount', CASE 
        WHEN v_role = 'inventory_staff' THEN NULL 
        ELSE o.total_amount 
      END,
      'paid_amount', CASE 
        WHEN v_role = 'inventory_staff' THEN NULL 
        ELSE o.paid_amount 
      END,
      'assigned_engineer_id', o.assigned_engineer_id,
      'assigned_engineer_name', o.assigned_engineer_name,
      'assigned_engineer_code', o.assigned_engineer_code,
      'assigned_engineer_phone', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE o.assigned_engineer_phone 
      END,
      'assigned_at', o.assigned_at,
      'assigned_by', o.assigned_by,
      'assigned_by_name', o.assigned_by_name,
      'expected_delivery_date', o.expected_delivery_date,
      'created_by', o.created_by,
      'created_by_name', o.created_by_name,
      'created_by_employee_code', o.created_by_employee_code,
      'created_at', o.created_at,
      'completion_requested_by', o.completion_requested_by,
      'completion_requested_at', o.completion_requested_at,
      'completed_by_name', o.completed_by_name,
      'completed_by_employee_code', o.completed_by_employee_code,
      'employee_remarks', o.employee_remarks,
      'completion_approved_by', o.completion_approved_by,
      'completion_approved_at', o.completion_approved_at,
      'approved_by_name', o.approved_by_name,
      'approved_by_employee_code', o.approved_by_employee_code,
      'head_remarks', o.head_remarks,
      'cancelled_by', o.cancelled_by,
      'cancelled_at', o.cancelled_at,
      'cancelled_by_name', o.cancelled_by_name,
      'cancellation_reason', o.cancellation_reason,
      'is_archived', o.is_archived,
      'archived_at', o.archived_at,
      'is_in_bin', o.is_in_bin,
      'is_removed', o.is_removed,
      'updated_at', o.updated_at,
      'order_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'product_name_snapshot', oi.product_name_snapshot,
            'brand_snapshot', oi.brand_snapshot,
            'model_snapshot', oi.model_snapshot,
            'sku_snapshot', oi.sku_snapshot,
            'quantity', oi.quantity,
            'unit_price', CASE 
              WHEN v_role = 'inventory_staff' THEN NULL 
              ELSE oi.unit_price 
            END,
            'line_total', CASE 
              WHEN v_role = 'inventory_staff' THEN NULL 
              ELSE oi.line_total 
            END,
            'cost_price_snapshot', CASE 
              WHEN v_role IN ('superadmin', 'admin', 'account') THEN oi.cost_price_snapshot 
              ELSE NULL 
            END,
            'created_at', oi.created_at
          ) ORDER BY oi.created_at ASC
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT o_inner.*
    FROM public.orders o_inner
    WHERE
      (v_role != 'inventory_staff' OR (
        o_inner.is_in_bin = false AND o_inner.is_removed = false AND o_inner.status != 'cancelled'
      ))
      AND (v_role != 'engineer' OR (
        o_inner.is_in_bin = false AND o_inner.is_removed = false AND (
          o_inner.assigned_engineer_id = v_actor_id OR
          o_inner.created_by = v_actor_id OR
          (o_inner.assigned_engineer_id IS NULL AND o_inner.status IN ('new', 'processing'))
        )
      ))
      AND (v_role NOT IN ('technical', 'hr') OR (
        o_inner.is_in_bin = false AND o_inner.is_removed = false
      ))
      AND (v_role != 'account' OR (
        o_inner.is_in_bin = false AND o_inner.is_removed = false
      ))
      AND (p_status IS NULL OR o_inner.status = p_status)
    ORDER BY o_inner.created_at DESC
    LIMIT v_effective_limit
    OFFSET v_effective_offset
  ) o;

  RETURN jsonb_build_object(
    'orders', v_orders,
    'total_count', v_total_count,
    'has_more', v_has_more,
    'limit', p_limit,
    'offset', v_effective_offset,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_orders(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_orders(text, integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. STORED PROCEDURE: public.get_admin_order_payments
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_order_payments(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_payments JSONB;
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validate role authorization: Management & Accounts only
  v_role := public.get_staff_role();
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'admin', 'account') THEN
    RAISE EXCEPTION 'Access denied: Payment transaction records are restricted to Management & Accounts.'
      USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID is required.' USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Verify order existence and order-level visibility for caller
  SELECT id, is_in_bin, is_removed INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Account role cannot inspect payments for orders in the Bin/removed
  IF v_role = 'account' AND (v_order.is_in_bin OR v_order.is_removed) THEN
    RAISE EXCEPTION 'Access denied: Order is in Bin or has been removed.'
      USING ERRCODE = '42501';
  END IF;

  -- 4. Query payment history
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', op.id,
      'order_id', op.order_id,
      'amount_received', op.amount_received,
      'payment_method', op.payment_method,
      'transaction_reference', op.transaction_reference,
      'remarks', op.remarks,
      'received_by', op.received_by,
      'received_by_name', op.received_by_name,
      'received_by_employee_code', op.received_by_employee_code,
      'received_at', op.received_at,
      'created_at', op.created_at
    ) ORDER BY op.received_at ASC
  ), '[]'::jsonb)
  INTO v_payments
  FROM public.order_payments op
  WHERE op.order_id = p_order_id;

  RETURN v_payments;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_order_payments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_order_payments(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. STORED PROCEDURE: public.get_monthly_business_analytics
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_business_analytics(
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_start_ts TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ;
  v_prev_start_ts TIMESTAMPTZ;
  v_prev_end_ts TIMESTAMPTZ;
  v_orders JSONB;
  v_payments JSONB;
  v_prev_orders JSONB;
  v_prev_payments JSONB;
  v_prev_orders_created_count INTEGER;
  v_products JSONB;
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validate role authorization: Management & Accounts only
  v_role := public.get_staff_role();
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'admin', 'account') THEN
    RAISE EXCEPTION 'Access denied: Monthly business analytics and financial reporting are restricted to Management & Accounts.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Validate input parameters (p_month is 0-indexed: 0 = January, 11 = December)
  IF p_year < 2024 OR p_year > 2050 OR p_month < 0 OR p_month > 11 THEN
    RAISE EXCEPTION 'Invalid year (% ) or month (%) parameter.', p_year, p_month
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Calculate exact half-open boundaries in Asia/Kolkata timezone
  v_start_ts := make_timestamptz(p_year, p_month + 1, 1, 0, 0, 0, 'Asia/Kolkata');
  v_end_ts := v_start_ts + interval '1 month';
  v_prev_start_ts := v_start_ts - interval '1 month';
  v_prev_end_ts := v_start_ts;

  -- 5. Target month orders (created in month OR completion approved in month)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_name', o.customer_name,
      'status', o.status,
      'total_amount', o.total_amount,
      'paid_amount', o.paid_amount,
      'created_at', o.created_at,
      'completion_approved_at', o.completion_approved_at,
      'order_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name_snapshot', oi.product_name_snapshot,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'line_total', oi.line_total,
            'cost_price_snapshot', oi.cost_price_snapshot
          )
        ) FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  WHERE (o.created_at >= v_start_ts AND o.created_at < v_end_ts)
     OR (o.completion_approved_at >= v_start_ts AND o.completion_approved_at < v_end_ts);

  -- 6. Target month collections (payments received within exact date range)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', op.id,
      'amount_received', op.amount_received,
      'payment_method', op.payment_method,
      'received_at', op.received_at,
      'orders', jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'created_at', o.created_at,
        'status', o.status
      )
    )
  ), '[]'::jsonb)
  INTO v_payments
  FROM public.order_payments op
  JOIN public.orders o ON o.id = op.order_id
  WHERE op.received_at >= v_start_ts AND op.received_at < v_end_ts;

  -- 7. Previous month completed sales & payments for comparative growth trends
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'total_amount', o.total_amount,
      'paid_amount', o.paid_amount,
      'status', o.status,
      'created_at', o.created_at,
      'completion_approved_at', o.completion_approved_at,
      'order_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('quantity', oi.quantity, 'line_total', oi.line_total)
        ) FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  INTO v_prev_orders
  FROM public.orders o
  WHERE o.status = 'completed'
    AND o.completion_approved_at >= v_prev_start_ts
    AND o.completion_approved_at < v_prev_end_ts;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('amount_received', op.amount_received)
  ), '[]'::jsonb)
  INTO v_prev_payments
  FROM public.order_payments op
  WHERE op.received_at >= v_prev_start_ts AND op.received_at < v_prev_end_ts;

  SELECT count(*)
  INTO v_prev_orders_created_count
  FROM public.orders o
  WHERE o.created_at >= v_prev_start_ts AND o.created_at < v_prev_end_ts;

  -- 8. Catalog product purchase costs
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'brand', p.brand,
      'model', p.model,
      'price', p.price,
      'cost_price', p.cost_price,
      'category_id', p.category_id
    )
  ), '[]'::jsonb)
  INTO v_products
  FROM public.products p;

  RETURN jsonb_build_object(
    'orders', v_orders,
    'payments', v_payments,
    'prev_orders', v_prev_orders,
    'prev_payments', v_prev_payments,
    'prev_orders_created_count', v_prev_orders_created_count,
    'products', v_products,
    'year', p_year,
    'month_index', p_month,
    'start_ts', v_start_ts,
    'end_ts', v_end_ts,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_business_analytics(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_business_analytics(integer, integer) TO authenticated;


-- ============================================================================
-- INLINED MIGRATION 24: Revoke Direct Order Table SELECT
-- ============================================================================
-- ============================================================================
-- ARS Computers — Step 24: Revoke Direct Table SELECT on Order Financial Tables
-- Migration: 20261120000024_revoke_direct_order_table_select.sql
-- Status: PREPARED LOCAL MIGRATION (LATER-STAGE SECURITY LOCKDOWN)
-- ============================================================================
-- IMPORTANT NOTICE:
-- Apply this migration ONLY after the client application code has been deployed
-- with the get_admin_orders, get_admin_order_payments, and
-- get_monthly_business_analytics RPC implementations.
--
-- Objective:
-- Permanently revoke table-level SELECT on public.orders, public.order_items,
-- and public.order_payments from public, anon, and authenticated roles.
-- Direct PostgREST table queries (e.g. /rest/v1/order_items?select=*) are blocked
-- with 42501 permission denied, enforcing that all order data flows exclusively
-- through audited SECURITY DEFINER RPCs with role-tailored projections.
-- ============================================================================

-- 1. Revoke table-level SELECT from client roles
REVOKE SELECT ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.order_payments FROM PUBLIC, anon, authenticated;

-- 2. DML operations on orders and order_payments remain revoked (as set in 20261029000001)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_payments FROM PUBLIC, anon, authenticated;

-- 3. Confirm EXECUTE on secure RPCs is granted to authenticated
GRANT EXECUTE ON FUNCTION public.get_admin_orders(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_order_payments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_business_analytics(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_order_engineer(uuid, uuid, timestamptz, text) TO authenticated;


-- ============================================================================
-- INLINED MIGRATION 25: Create Permanent Customers CRM
-- ============================================================================
-- ============================================================================
-- ARS Computers — Step 25: Permanent Regular Customers & CRM Directory Table
-- Migration: 20261121000025_create_permanent_customers_crm.sql
-- Status: PREPARED LOCAL MIGRATION (Phase 3A + CRM Regular Customer Module)
-- ============================================================================
-- Objectives:
-- 1. Create table public.customers for permanent, first-class CRM records
--    independent of transactional orders or enquiries.
-- 2. Support customer name, mobile, email, company, address, customer_type,
--    gst_number, notes, is_regular flag, and audit metadata.
-- 3. Implement SECURITY DEFINER RPCs:
--    - public.create_regular_customer: Validates active staff role, normalizes phone/email,
--      detects duplicates, and inserts customer.
--    - public.get_admin_customers: Returns permanent customers with role-appropriate
--      masking (HR PII redaction).
--    - public.search_duplicate_customers: Fast phone/email/name/company matching for
--      in-form duplicate customer suggestions.
-- 4. Follow strict Phase 3A security architecture: revoke table-level access from
--    client roles and grant execute strictly on vetted RPCs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  normalized_phone TEXT,
  email TEXT,
  normalized_email TEXT,
  company TEXT,
  customer_type TEXT DEFAULT 'Individual' CHECK (customer_type IN ('Individual', 'Commercial', 'Government', 'Dealer / Partner', 'Other')),
  gst_number TEXT,
  address TEXT,
  notes TEXT,
  is_regular BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Indexes for high-speed matching and directory filtering
CREATE INDEX IF NOT EXISTS idx_customers_normalized_phone ON public.customers (normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_normalized_email ON public.customers (normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers (company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Revoke direct table SELECT and DML from client roles
REVOKE ALL ON TABLE public.customers FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. STORED PROCEDURE: public.create_regular_customer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_regular_customer(
  p_name text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_company text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_customer_type text DEFAULT 'Individual'::text,
  p_gst_number text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_allow_duplicate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_actor_name TEXT;
  v_raw_phone TEXT;
  v_norm_phone TEXT := NULL;
  v_norm_email TEXT := NULL;
  v_new_customer RECORD;
  v_duplicate_id UUID := NULL;
  v_duplicate_name TEXT := NULL;
  v_lock_phone BIGINT := NULL;
  v_lock_email BIGINT := NULL;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role (Inventory staff is restricted read-only)
  v_role := public.get_staff_role();
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'admin', 'account', 'technical', 'engineer', 'hr') THEN
    RAISE EXCEPTION 'Access denied: Active administrative staff privileges required to register regular customers.'
      USING ERRCODE = '42501';
  END IF;

  -- Get actor name
  SELECT full_name INTO v_actor_name FROM public.admin_users WHERE id = v_actor_id;

  -- 3. Name validation
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Customer name is mandatory.' USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Indian Mobile Normalization (10-digit starting with 6-9)
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_raw_phone := regexp_replace(p_phone, '\D', '', 'g');
    IF length(v_raw_phone) = 10 AND v_raw_phone ~ '^[6-9]\d{9}$' THEN
      v_norm_phone := v_raw_phone;
    ELSIF length(v_raw_phone) = 11 AND v_raw_phone ~ '^0[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 2);
    ELSIF length(v_raw_phone) = 12 AND v_raw_phone ~ '^91[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 3);
    ELSIF length(v_raw_phone) = 13 AND v_raw_phone ~ '^091[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 4);
    ELSE
      v_norm_phone := NULL;
    END IF;
  END IF;

  -- 5. Email Normalization
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_norm_email := lower(trim(p_email));
    IF v_norm_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      v_norm_email := NULL;
    END IF;
  END IF;

  -- Concurrency Protection: Acquire advisory transaction locks for both normalized phone
  -- and normalized email in a deterministic ascending order to provably eliminate deadlocks.
  IF v_norm_phone IS NOT NULL THEN
    v_lock_phone := hashtext('customer_phone:' || v_norm_phone)::bigint;
  END IF;

  IF v_norm_email IS NOT NULL THEN
    v_lock_email := hashtext('customer_email:' || v_norm_email)::bigint;
  END IF;

  IF v_lock_phone IS NOT NULL AND v_lock_email IS NOT NULL THEN
    IF v_lock_phone < v_lock_email THEN
      PERFORM pg_advisory_xact_lock(v_lock_phone);
      PERFORM pg_advisory_xact_lock(v_lock_email);
    ELSIF v_lock_phone > v_lock_email THEN
      PERFORM pg_advisory_xact_lock(v_lock_email);
      PERFORM pg_advisory_xact_lock(v_lock_phone);
    ELSE
      PERFORM pg_advisory_xact_lock(v_lock_phone);
    END IF;
  ELSIF v_lock_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(v_lock_phone);
  ELSIF v_lock_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(v_lock_email);
  END IF;

  -- 6. Duplicate check against existing permanent customers (rechecked after acquiring locks)
  IF v_norm_phone IS NOT NULL THEN
    SELECT id, name INTO v_duplicate_id, v_duplicate_name
    FROM public.customers
    WHERE normalized_phone = v_norm_phone
    LIMIT 1;
  END IF;

  IF v_duplicate_id IS NULL AND v_norm_email IS NOT NULL THEN
    SELECT id, name INTO v_duplicate_id, v_duplicate_name
    FROM public.customers
    WHERE normalized_email = v_norm_email
    LIMIT 1;
  END IF;

  -- Guard: If duplicate is detected and caller did not explicitly confirm bypass,
  -- abort insertion and return duplicate warning without creating a duplicate record.
  IF v_duplicate_id IS NOT NULL AND NOT p_allow_duplicate THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate_detected', true,
      'customer', NULL,
      'potential_duplicate', jsonb_build_object('id', v_duplicate_id, 'name', v_duplicate_name),
      'message', 'A customer with matching contact details already exists in CRM. Confirm explicit bypass to save as a distinct profile.'
    );
  END IF;

  -- 7. Insert permanent customer record
  INSERT INTO public.customers (
    name,
    phone,
    normalized_phone,
    email,
    normalized_email,
    company,
    customer_type,
    gst_number,
    address,
    notes,
    is_regular,
    created_by,
    created_by_name,
    created_by_role,
    created_at,
    updated_at
  ) VALUES (
    trim(p_name),
    nullif(trim(p_phone), ''),
    v_norm_phone,
    nullif(trim(p_email), ''),
    v_norm_email,
    nullif(trim(p_company), ''),
    COALESCE(p_customer_type, 'Individual'),
    nullif(upper(trim(p_gst_number)), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_notes), ''),
    true,
    v_actor_id,
    COALESCE(v_actor_name, 'Staff Member'),
    v_role,
    v_now,
    v_now
  )
  RETURNING * INTO v_new_customer;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate_detected', false,
    'customer', jsonb_build_object(
      'id', v_new_customer.id,
      'name', v_new_customer.name,
      'phone', v_new_customer.phone,
      'normalized_phone', v_new_customer.normalized_phone,
      'email', v_new_customer.email,
      'normalized_email', v_new_customer.normalized_email,
      'company', v_new_customer.company,
      'customer_type', v_new_customer.customer_type,
      'gst_number', v_new_customer.gst_number,
      'address', v_new_customer.address,
      'notes', v_new_customer.notes,
      'is_regular', v_new_customer.is_regular,
      'created_at', v_new_customer.created_at,
      'created_by_name', v_new_customer.created_by_name
    ),
    'potential_duplicate', CASE 
      WHEN v_duplicate_id IS NOT NULL THEN jsonb_build_object('id', v_duplicate_id, 'name', v_duplicate_name)
      ELSE NULL 
    END,
    'message', 'Regular customer registered successfully in CRM.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_regular_customer(text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_regular_customer(text, text, text, text, text, text, text, text, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. STORED PROCEDURE: public.get_admin_customers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_customers(
  p_query text DEFAULT NULL::text,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_total_count INTEGER;
  v_effective_limit INTEGER;
  v_effective_offset INTEGER;
  v_has_more BOOLEAN;
  v_customers JSONB;
  v_clean_query TEXT := NULL;
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role
  v_role := public.get_staff_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_query IS NOT NULL AND length(trim(p_query)) > 0 THEN
    v_clean_query := '%' || lower(trim(p_query)) || '%';
  END IF;

  -- 3. Calculate total count
  SELECT count(*)
  INTO v_total_count
  FROM public.customers c
  WHERE (v_clean_query IS NULL OR (
    lower(c.name) LIKE v_clean_query OR
    lower(COALESCE(c.company, '')) LIKE v_clean_query OR
    COALESCE(c.normalized_phone, '') LIKE v_clean_query OR
    lower(COALESCE(c.email, '')) LIKE v_clean_query
  ));

  v_effective_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_effective_limit := CASE 
    WHEN p_limit IS NOT NULL AND p_limit > 0 THEN p_limit 
    ELSE v_total_count 
  END;
  v_has_more := (v_effective_offset + v_effective_limit) < v_total_count;

  -- 4. Project role-tailored customers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.phone 
      END,
      'normalized_phone', CASE 
        WHEN v_role = 'hr' THEN NULL
        ELSE c.normalized_phone 
      END,
      'email', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.email 
      END,
      'normalized_email', CASE 
        WHEN v_role = 'hr' THEN NULL
        ELSE c.normalized_email 
      END,
      'company', c.company,
      'customer_type', c.customer_type,
      'gst_number', c.gst_number,
      'address', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.address 
      END,
      'notes', CASE 
        WHEN v_role IN ('hr', 'inventory_staff') THEN NULL
        ELSE c.notes 
      END,
      'is_regular', c.is_regular,
      'created_by_name', c.created_by_name,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_customers
  FROM (
    SELECT *
    FROM public.customers c_inner
    WHERE (v_clean_query IS NULL OR (
      lower(c_inner.name) LIKE v_clean_query OR
      lower(COALESCE(c_inner.company, '')) LIKE v_clean_query OR
      COALESCE(c_inner.normalized_phone, '') LIKE v_clean_query OR
      lower(COALESCE(c_inner.email, '')) LIKE v_clean_query
    ))
    ORDER BY c_inner.created_at DESC
    LIMIT v_effective_limit
    OFFSET v_effective_offset
  ) c;

  RETURN jsonb_build_object(
    'customers', v_customers,
    'total_count', v_total_count,
    'has_more', v_has_more,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_customers(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_customers(text, integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. STORED PROCEDURE: public.search_duplicate_customers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_duplicate_customers(
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_company text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_raw_phone TEXT;
  v_norm_phone TEXT := NULL;
  v_norm_email TEXT := NULL;
  v_clean_name TEXT := NULL;
  v_clean_comp TEXT := NULL;
  v_results JSONB;
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.get_staff_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Normalize search inputs
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_raw_phone := regexp_replace(p_phone, '\D', '', 'g');
    IF length(v_raw_phone) = 10 AND v_raw_phone ~ '^[6-9]\d{9}$' THEN
      v_norm_phone := v_raw_phone;
    ELSIF length(v_raw_phone) = 11 AND v_raw_phone ~ '^0[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 2);
    ELSIF length(v_raw_phone) = 12 AND v_raw_phone ~ '^91[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 3);
    ELSIF length(v_raw_phone) = 13 AND v_raw_phone ~ '^091[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 4);
    END IF;
  END IF;

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_norm_email := lower(trim(p_email));
  END IF;

  IF p_name IS NOT NULL AND length(trim(p_name)) >= 2 THEN
    v_clean_name := lower(trim(p_name));
  END IF;

  IF p_company IS NOT NULL AND length(trim(p_company)) >= 2 THEN
    v_clean_comp := lower(trim(p_company));
  END IF;

  -- 3. Match candidates across permanent customers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.phone END,
      'normalized_phone', CASE WHEN v_role = 'hr' THEN NULL ELSE c.normalized_phone END,
      'email', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.email END,
      'company', c.company,
      'address', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.address END,
      'customer_type', c.customer_type,
      'is_regular', c.is_regular,
      'match_reason', c.match_reason,
      'match_confidence', c.match_confidence
    )
  ), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT
      cust.*,
      CASE
        WHEN v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone THEN 'Matched Mobile Number'
        WHEN v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email THEN 'Matched Email Address'
        WHEN v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp THEN 'Matched Company Name'
        WHEN v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name THEN 'Matched Full Name'
        ELSE 'Similar Details'
      END as match_reason,
      CASE
        WHEN v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone THEN 100
        WHEN v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email THEN 90
        WHEN v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp THEN 75
        WHEN v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name THEN 60
        ELSE 40
      END as match_confidence
    FROM public.customers cust
    WHERE
      (v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone)
      OR (v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email)
      OR (v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp)
      OR (v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name)
    ORDER BY match_confidence DESC, cust.created_at DESC
    LIMIT 5
  ) c;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.search_duplicate_customers(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_duplicate_customers(text, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. PRIVILEGED CONTEXT: SEED 7 STAFF IDENTITIES + FIXTURES
-- ----------------------------------------------------------------------------
-- Running in default privileged session (postgres / superuser)
CREATE TEMP TABLE test_identities (
  role_name TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL
);

INSERT INTO test_identities (role_name, user_id, email, full_name) VALUES
  ('superadmin',      '11111111-1111-1111-1111-111111111111', 'superadmin.test@arscomputers.in', 'Test Superadmin'),
  ('admin',           '22222222-2222-2222-2222-222222222222', 'admin.test@arscomputers.in',      'Test Admin'),
  ('account',         '33333333-3333-3333-3333-333333333333', 'account.test@arscomputers.in',    'Test Account Head'),
  ('technical',       '44444444-4444-4444-4444-444444444444', 'technical.test@arscomputers.in',  'Test Technical Lead'),
  ('engineer_a',      '55555555-5555-5555-5555-555555555555', 'engineer_a.test@arscomputers.in', 'Test Field Engineer A'),
  ('engineer_b',      '66666666-6666-6666-6666-666666666666', 'engineer_b.test@arscomputers.in', 'Test Field Engineer B'),
  ('hr',              '77777777-7777-7777-7777-777777777777', 'hr.test@arscomputers.in',         'Test HR Manager'),
  ('inventory_staff', '88888888-8888-8888-8888-888888888888', 'inventory.test@arscomputers.in',  'Test Inventory Staff'),
  ('inactive_admin',  '99999999-9999-9999-9999-999999999999', 'inactive.test@arscomputers.in',   'Test Inactive Staff');

-- Seed auth.users for FK integrity
INSERT INTO auth.users (id, email)
SELECT user_id, email FROM test_identities
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Seed public.admin_users
INSERT INTO public.admin_users (id, email, full_name, role, is_active)
SELECT
  user_id,
  email,
  full_name,
  CASE
    WHEN role_name = 'inactive_admin' THEN 'admin'
    WHEN role_name LIKE 'engineer%' THEN 'engineer'
    ELSE role_name
  END,
  role_name <> 'inactive_admin'
FROM test_identities
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

CREATE TEMP TABLE test_fixtures (
  order_id_assigned UUID,
  order_id_unassigned UUID,
  order_id_bin UUID
);

INSERT INTO test_fixtures (order_id_assigned, order_id_unassigned, order_id_bin)
VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
GRANT SELECT ON test_fixtures TO authenticated;

-- Seed test orders conforming to schema constraints
INSERT INTO public.orders (
  id, order_number, customer_name, contact_info, customer_phone, customer_email, customer_address,
  status, is_in_bin, is_removed, assigned_engineer_id, assigned_engineer_name, total_amount, paid_amount, payment_status, payment_method, created_at
)
SELECT
  f.order_id_assigned, 'ARS-ORD-P3A-01', 'Test Customer Alpha', '9876543210 | alpha@customer.in', '9876543210', 'alpha@customer.in', 'Connaught Place, New Delhi',
  'processing', false, false, '55555555-5555-5555-5555-555555555555'::uuid, 'Test Field Engineer A', 65000.00, 25000.00, 'partial', 'bank_transfer', clock_timestamp()
FROM test_fixtures f;

INSERT INTO public.orders (
  id, order_number, customer_name, contact_info, customer_phone, customer_email, customer_address,
  status, is_in_bin, is_removed, assigned_engineer_id, total_amount, paid_amount, payment_status, payment_method, created_at
)
SELECT
  f.order_id_unassigned, 'ARS-ORD-P3A-02', 'Test Customer Beta', '9811122233 | beta@customer.in', '9811122233', 'beta@customer.in', 'Sector 62, Noida',
  'new', false, false, NULL, 18000.00, 0.00, 'pending', 'cash', clock_timestamp()
FROM test_fixtures f;

INSERT INTO public.orders (
  id, order_number, customer_name, contact_info, customer_phone, customer_email, customer_address,
  status, is_in_bin, is_removed, assigned_engineer_id, total_amount, paid_amount, payment_status, payment_method, created_at
)
SELECT
  f.order_id_bin, 'ARS-ORD-P3A-BIN', 'Bin Customer', '9899988877 | bin@customer.in', '9899988877', 'bin@customer.in', 'Old Facility',
  'new', true, false, NULL, 7500.00, 0.00, 'pending', 'cash', clock_timestamp()
FROM test_fixtures f;

-- Seed line items with cost price snapshots
INSERT INTO public.order_items (
  id, order_id, product_name_snapshot, quantity, unit_price, line_total, cost_price_snapshot
)
SELECT
  gen_random_uuid(), f.order_id_assigned, 'Workstation Core i9', 1, 65000.00, 65000.00, 48000.00
FROM test_fixtures f
UNION ALL
SELECT
  gen_random_uuid(), f.order_id_unassigned, 'RAM DDR5 32GB', 2, 9000.00, 18000.00, 13000.00
FROM test_fixtures f
UNION ALL
SELECT
  gen_random_uuid(), f.order_id_bin, 'SSD 1TB NVMe', 1, 5500.00, 5500.00, 3800.00
FROM test_fixtures f;

-- Seed payment
INSERT INTO public.order_payments (
  id, order_id, amount_received, payment_method, transaction_reference, remarks, created_at, received_at
)
SELECT
  gen_random_uuid(), f.order_id_assigned, 25000.00, 'bank_transfer', 'NEFT-883399', 'Advance 40%', clock_timestamp(), clock_timestamp()
FROM test_fixtures f;

-- ----------------------------------------------------------------------------
-- 3. CLIENT CONTEXT (authenticated): VERIFY DIRECT TABLE ACCESS REVOCATION
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

DO $$
BEGIN
  -- 3.1: Direct SELECT on public.orders MUST be blocked with 42501
  BEGIN
    PERFORM * FROM public.orders LIMIT 1;
    RAISE EXCEPTION 'MIGRATION 24 REGRESSION: Direct SELECT on public.orders was not blocked!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 24]: Direct SELECT on public.orders correctly denied (42501)';
  END;

  -- 3.2: Direct SELECT on public.order_items MUST be blocked with 42501
  BEGIN
    PERFORM * FROM public.order_items LIMIT 1;
    RAISE EXCEPTION 'MIGRATION 24 REGRESSION: Direct SELECT on public.order_items was not blocked!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 24]: Direct SELECT on public.order_items correctly denied (42501)';
  END;

  -- 3.3: Direct SELECT on public.order_payments MUST be blocked with 42501
  BEGIN
    PERFORM * FROM public.order_payments LIMIT 1;
    RAISE EXCEPTION 'MIGRATION 24 REGRESSION: Direct SELECT on public.order_payments was not blocked!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 24]: Direct SELECT on public.order_payments correctly denied (42501)';
  END;

  -- 3.4: Direct SELECT on public.customers MUST be blocked with 42501
  BEGIN
    PERFORM * FROM public.customers LIMIT 1;
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Direct SELECT on public.customers was not blocked!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 25]: Direct SELECT on public.customers correctly denied (42501)';
  END;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CLIENT CONTEXT (authenticated): VERIFY MIGRATION 22 ASSIGNMENT RULES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_assigned_order UUID;
  v_unassigned_order UUID;
  v_res JSONB;
BEGIN
  SELECT order_id_assigned, order_id_unassigned INTO v_assigned_order, v_unassigned_order FROM test_fixtures;

  -- 4.1: Engineer B cannot claim or steal an order already assigned to Engineer A
  PERFORM set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
  BEGIN
    PERFORM public.assign_order_engineer(v_assigned_order, '66666666-6666-6666-6666-666666666666'::uuid, NULL::timestamptz, 'Steal attempt'::text);
    RAISE EXCEPTION 'MIGRATION 22 REGRESSION: Field engineer was able to claim another engineer''s order!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ PASS [Migration 22]: Field engineer prevented from stealing peer order (check_violation)';
  END;

  -- 4.2: Engineer B cannot assign an unassigned order to Engineer A (self-assign only)
  BEGIN
    PERFORM public.assign_order_engineer(v_unassigned_order, '55555555-5555-5555-5555-555555555555'::uuid, NULL::timestamptz, 'Third-party assignment'::text);
    RAISE EXCEPTION 'MIGRATION 22 REGRESSION: Field engineer was able to assign to another colleague!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 22]: Field engineers restricted to self-assignment only (42501)';
  END;

  -- 4.3: Engineer B CAN self-assign an unassigned active pool order
  v_res := public.assign_order_engineer(v_unassigned_order, '66666666-6666-6666-6666-666666666666'::uuid, NULL::timestamptz, 'Self-claim pool'::text);
  IF (v_res->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 22 REGRESSION: Self-assignment on unassigned order failed';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 22]: Field engineer successfully self-assigned unassigned pool order';

  -- 4.4: Technical Lead CAN reassign orders between engineers
  PERFORM set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  v_res := public.assign_order_engineer(v_assigned_order, '66666666-6666-6666-6666-666666666666'::uuid, NULL::timestamptz, 'Lead rebalance'::text);
  IF (v_res->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 22 REGRESSION: Technical lead failed to reassign order';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 22]: Technical Lead successfully reassigned order between technicians';
END $$;

-- ----------------------------------------------------------------------------
-- 5. CLIENT CONTEXT (authenticated): VERIFY MIGRATION 23 ROLE PROJECTIONS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_assigned_order UUID;
  v_res JSONB;
  v_order_json JSONB;
  v_item JSONB;
BEGIN
  SELECT order_id_assigned INTO v_assigned_order FROM test_fixtures;

  -- 5.1: Superadmin (full financials, cost snapshot, payments ledger, business analytics)
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'cost_price_snapshot') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Superadmin cost_price_snapshot was masked!';
  END IF;
  v_res := public.get_admin_order_payments(v_assigned_order);
  IF jsonb_array_length(v_res) = 0 THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Superadmin payments ledger was empty!';
  END IF;
  v_res := public.get_monthly_business_analytics(2026, 11);
  IF (v_res->'orders') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Superadmin business analytics failed!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 23]: Superadmin verified with full financial & cost snapshot visibility';

  -- 5.2: Admin (full financials, cost snapshot, payments ledger, business analytics)
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'cost_price_snapshot') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Admin cost_price_snapshot was masked!';
  END IF;
  v_res := public.get_admin_order_payments(v_assigned_order);
  IF jsonb_array_length(v_res) = 0 THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Admin payments ledger was empty!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 23]: Admin verified with full financial & cost snapshot visibility';

  -- 5.3: Account Role (Option B Approved: full financials, cost snapshot, payments ledger, business analytics)
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'cost_price_snapshot') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Account role cost_price_snapshot was masked!';
  END IF;
  v_res := public.get_admin_order_payments(v_assigned_order);
  IF jsonb_array_length(v_res) = 0 THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Account role payments ledger was blocked!';
  END IF;
  v_res := public.get_monthly_business_analytics(2026, 11);
  IF (v_res->'orders') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Account role business analytics was blocked!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 23]: Account role verified with full financial & gross margin visibility (Option B)';

  -- 5.4: Technical Lead (Sales totals visible; cost snapshot = NULL; payments access = BLOCKED)
  PERFORM set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'cost_price_snapshot') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Technical lead leaked cost_price_snapshot!';
  END IF;
  BEGIN
    PERFORM public.get_admin_order_payments(v_assigned_order);
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Technical lead accessed payments ledger!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 23]: Technical lead masked from cost snapshots and payments (42501)';
  END;

  -- 5.5: Field Engineer (Assigned orders only; cost snapshot = NULL; payments access = BLOCKED)
  PERFORM set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'cost_price_snapshot') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Field engineer leaked cost_price_snapshot!';
  END IF;
  BEGIN
    PERFORM public.get_admin_order_payments(v_assigned_order);
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Field engineer accessed payments ledger!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 23]: Field engineer masked from cost snapshots and payments (42501)';
  END;

  -- 5.6: HR Role (Customer PII = [REDACTED: HR Privacy Policy]; cost snapshot = NULL)
  PERFORM set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  IF (v_order_json->>'customer_phone') <> '[REDACTED: HR Privacy Policy]' THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: HR role leaked customer phone number!';
  END IF;
  IF (v_order_json->>'customer_email') <> '[REDACTED: HR Privacy Policy]' THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: HR role leaked customer email address!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 23]: HR role customer contact PII successfully redacted';

  -- 5.7: Inventory Staff (Dispatch view only; prices, totals and costs masked to NULL)
  PERFORM set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
  v_res := public.get_admin_orders(NULL::text, 10, 0);
  SELECT ord INTO v_order_json FROM jsonb_array_elements(v_res->'orders') ord WHERE (ord->>'id')::uuid = v_assigned_order;
  IF (v_order_json->>'total_amount') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Inventory staff leaked total_amount!';
  END IF;
  v_item := (v_order_json->'order_items'->0);
  IF (v_item->>'unit_price') IS NOT NULL OR (v_item->>'cost_price_snapshot') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION 23 REGRESSION: Inventory staff leaked unit price or cost price!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 23]: Inventory staff pricing completely masked to NULL';
END $$;

-- ----------------------------------------------------------------------------
-- 6. CLIENT CONTEXT (authenticated): VERIFY MIGRATION 25 CRM & DUPLICATES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_res JSONB;
BEGIN
  -- 6.1: Inventory staff cannot create regular customers (42501)
  PERFORM set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
  BEGIN
    PERFORM public.create_regular_customer('Unauthorized Customer'::text, '9876543210'::text, 'test@test.com'::text, NULL, NULL, 'Individual', NULL, NULL, false);
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Inventory staff was able to create regular customer!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ PASS [Migration 25]: Inventory staff customer creation blocked (42501)';
  END;

  -- 6.2: Admin registers regular customer
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  v_res := public.create_regular_customer(
    'Ramesh Verma'::text, '9876543210'::text, 'ramesh@verma.com'::text,
    'Verma Tech'::text, 'Connaught Place, Delhi'::text, 'Commercial'::text,
    '07AAAAA0000A1Z5'::text, 'High Priority VIP'::text, false
  );
  IF (v_res->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Failed to create valid regular customer!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: Admin successfully created regular customer';

  -- 6.3a: Duplicate detection sharing ONLY PHONE (different email) halts insertion
  v_res := public.create_regular_customer(
    'Ramesh Phone Duplicate'::text, '9876543210'::text, 'different_email@domain.com'::text,
    NULL, NULL, 'Individual', NULL, NULL, false
  );
  IF (v_res->>'success')::boolean = true OR (v_res->>'duplicate_detected')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Accidental duplicate record inserted on shared phone!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: Duplicate sharing ONLY PHONE detected and aborted safely';

  -- 6.3b: Duplicate detection sharing ONLY EMAIL (different phone) halts insertion
  v_res := public.create_regular_customer(
    'Ramesh Email Duplicate'::text, '9812345678'::text, 'ramesh@verma.com'::text,
    NULL, NULL, 'Individual', NULL, NULL, false
  );
  IF (v_res->>'success')::boolean = true OR (v_res->>'duplicate_detected')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Accidental duplicate record inserted on shared email!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: Duplicate sharing ONLY EMAIL detected and aborted safely';

  -- 6.3c: Duplicate detection sharing BOTH PHONE AND EMAIL halts insertion
  v_res := public.create_regular_customer(
    'Ramesh Both Duplicate'::text, '9876543210'::text, 'ramesh@verma.com'::text,
    NULL, NULL, 'Individual', NULL, NULL, false
  );
  IF (v_res->>'success')::boolean = true OR (v_res->>'duplicate_detected')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Accidental duplicate record inserted on both phone and email!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: Duplicate sharing BOTH identifiers detected and aborted safely';

  -- 6.4: Explicit bypass (p_allow_duplicate = true) enables deliberate distinct profile creation
  v_res := public.create_regular_customer(
    'Ramesh Separate Account'::text, '9876543210'::text, 'ramesh@other.com'::text,
    NULL, NULL, 'Individual', NULL, NULL, true
  );
  IF (v_res->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: Explicit bypass failed to save separate customer!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: Explicit bypass successfully created distinct customer';

  -- 6.5: HR role receives masked PII from get_admin_customers
  PERFORM set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
  v_res := public.get_admin_customers(NULL::text, 10, 0);
  IF (v_res->'customers'->0->>'phone') <> '[REDACTED: HR Privacy Policy]' THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: HR customer phone was not redacted!';
  END IF;
  IF (v_res->'customers'->0->>'email') <> '[REDACTED: HR Privacy Policy]' THEN
    RAISE EXCEPTION 'MIGRATION 25 REGRESSION: HR customer email was not redacted!';
  END IF;
  RAISE NOTICE '✓ PASS [Migration 25]: HR role customer directory PII is successfully redacted';
END $$;

-- ----------------------------------------------------------------------------
-- 7. PRIVILEGED CONTEXT (RESET ROLE): COUNT & AUDIT VERIFICATION
-- ----------------------------------------------------------------------------
-- Running under postgres / superuser to verify row counts without granting table SELECT to authenticated
RESET ROLE;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify customers table has exactly 2 records (1 regular + 1 explicit distinct bypass)
  SELECT count(*) INTO v_count FROM public.customers WHERE normalized_phone = '9876543210';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'DATABASE INTEGRITY ERROR: Expected exactly 2 customers for phone 9876543210, found %', v_count;
  END IF;
  RAISE NOTICE '✓ PASS [Privileged Audit]: Verified exact customer row count in public.customers (% rows)', v_count;
END $$;

-- ----------------------------------------------------------------------------
-- 8. CLEANUP: COMPLETE TRANSACTION ROLLBACK
-- ----------------------------------------------------------------------------
ROLLBACK;
