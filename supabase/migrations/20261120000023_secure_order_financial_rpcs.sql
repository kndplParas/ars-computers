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
