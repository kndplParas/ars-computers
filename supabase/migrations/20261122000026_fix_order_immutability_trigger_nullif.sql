-- ============================================================================
-- ARS Computers — Step 26: Fix trg_protect_order_immutability NULLIF Syntax
-- Migration: 20261122000026_fix_order_immutability_trigger_nullif.sql
-- Status: PREPARED LOCAL MIGRATION (Phase 3A Financial Security Hardening)
-- ============================================================================
-- Objectives:
-- 1. Correct syntax error in public.trg_protect_order_immutability() where
--    pg_catalog.nullif was used instead of the standard SQL NULLIF operator.
--    In PostgreSQL, NULLIF is a syntactic construct rather than a catalog function;
--    invoking pg_catalog.nullif throws "function pg_catalog.nullif does not exist".
-- 2. Preserve ALL existing immutability rules, superadmin correction allowlists,
--    and authorization checks without alteration.
-- ============================================================================

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
    -- Verify transaction-scoped Super Admin correction authorization (Standard SQL NULLIF operator)
    v_correction_actor_str := NULLIF(pg_catalog.current_setting('ars.superadmin_order_correction', true), '');
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
