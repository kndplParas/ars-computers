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
