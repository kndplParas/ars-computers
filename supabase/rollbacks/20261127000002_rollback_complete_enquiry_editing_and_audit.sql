-- ============================================================================
-- ARS Computers — Rollback Migration 20261127000002
-- Rolls back: 20261127000001_complete_enquiry_editing_and_audit.sql
-- Status: Standalone rollback procedure (MUST remain outside supabase/migrations/)
-- ============================================================================
-- PURPOSE:
-- 1. Drops public.update_enquiry_details() RPC function.
-- 2. Drops private internal authorization ledger ars_internal.active_enquiry_edits
--    and schema ars_internal.
-- 3. Restores the exact prior definition of public.protect_enquiry_customer_and_archive_immutability()
--    from 20261101000018_phase2_security_hardening.sql (strictly locking customer-submitted fields).
-- 4. Restores trigger trg_protect_enquiry_customer_immutability on public.enquiries.
-- 5. Restores table-level update grants and superadmin update RLS policy.
-- 6. Explicitly restores EXECUTE grants on the trigger function.
-- 7. Preserves existing columns (company, service_requested) safely without dropping data.
-- ============================================================================

BEGIN;

-- 1. DROP RPC FUNCTION
DROP FUNCTION IF EXISTS public.update_enquiry_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT[]
);

DROP FUNCTION IF EXISTS public.update_enquiry_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
);

-- 2. DROP PRIVATE AUTHORIZATION LEDGER & SCHEMA
-- Drop specifically created ledger table without CASCADE to prevent collateral deletion
DROP TABLE IF EXISTS ars_internal.active_enquiry_edits RESTRICT;
-- Drop schema with RESTRICT (fails if any unexpected objects exist in ars_internal)
DROP SCHEMA IF EXISTS ars_internal RESTRICT;

-- 3. RESTORE EXACT PRIOR IMMUTABILITY TRIGGER FUNCTION (from 20261101000018)
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Customer submitted fields are strictly immutable
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Immutability violation: enquiry id cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'Immutability violation: customer name cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.contact_info IS DISTINCT FROM OLD.contact_info THEN
    RAISE EXCEPTION 'Immutability violation: customer contact_info cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'Immutability violation: customer message cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.category_interest IS DISTINCT FROM OLD.category_interest THEN
    RAISE EXCEPTION 'Immutability violation: category_interest cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.enquiry_number IS NOT NULL AND NEW.enquiry_number IS DISTINCT FROM OLD.enquiry_number THEN
    RAISE EXCEPTION 'Immutability violation: enquiry_number cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;

  -- Permanent archive protections once completion has been approved
  IF OLD.completion_approved_at IS NOT NULL THEN
    IF NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at THEN
      RAISE EXCEPTION 'Permanent archive protection: completion_approved_at timestamp cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by THEN
      RAISE EXCEPTION 'Permanent archive protection: completion_approved_by identity UUID cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver name snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver employee code snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by THEN
      RAISE EXCEPTION 'Permanent archive protection: Employee completion identity UUID cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completed_by_name IS DISTINCT FROM OLD.completed_by_name THEN
      RAISE EXCEPTION 'Permanent archive protection: Employee completion name snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completed_by_employee_code IS DISTINCT FROM OLD.completed_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Employee completion code snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at THEN
      RAISE EXCEPTION 'Permanent archive protection: Completion timestamp cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completion_summary IS DISTINCT FROM OLD.completion_summary THEN
      RAISE EXCEPTION 'Permanent archive protection: Completion summary cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.is_archived = true AND NEW.is_archived = false THEN
      RAISE EXCEPTION 'Permanent archive protection: Approved completed enquiries cannot be unarchived or reopened.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IS DISTINCT FROM 'completed' AND OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Permanent archive protection: Approved completed enquiries cannot change status.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.is_in_bin = true OR NEW.scheduled_deletion_at IS NOT NULL THEN
      RAISE EXCEPTION 'Permanent archive protection: Approved completed enquiries cannot enter Bin or have scheduled deletion.' USING ERRCODE = 'check_violation';
    END IF;
    -- Rule: Approved completed enquiries cannot be soft-removed
    IF NEW.is_removed = true AND (OLD.is_removed IS FALSE OR OLD.is_removed IS NULL) THEN
      RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.' USING ERRCODE = 'check_violation';
    END IF;

    -- Strict Assignment Immutability on Completed Records
    IF NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id OR
       NEW.assigned_employee_name IS DISTINCT FROM OLD.assigned_employee_name OR
       NEW.assigned_employee_code IS DISTINCT FROM OLD.assigned_employee_code OR
       NEW.assigned_employee_phone IS DISTINCT FROM OLD.assigned_employee_phone OR
       NEW.assigned_engineer_aadhaar IS DISTINCT FROM OLD.assigned_engineer_aadhaar OR
       NEW.expected_visit_at IS DISTINCT FROM OLD.expected_visit_at OR
       NEW.assignment_visit_note IS DISTINCT FROM OLD.assignment_visit_note OR
       NEW.assigned_at IS DISTINCT FROM OLD.assigned_at OR
       NEW.assigned_by IS DISTINCT FROM OLD.assigned_by OR
       NEW.assigned_by_name IS DISTINCT FROM OLD.assigned_by_name OR
       NEW.assigned_by_employee_code IS DISTINCT FROM OLD.assigned_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Assignment attributes cannot be modified on approved completed enquiries.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. ENSURE TRIGGER USES RESTORED FUNCTION
DROP TRIGGER IF EXISTS trg_protect_enquiry_customer_immutability ON public.enquiries;
CREATE TRIGGER trg_protect_enquiry_customer_immutability
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_enquiry_customer_and_archive_immutability();

ALTER FUNCTION public.protect_enquiry_customer_and_archive_immutability() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.protect_enquiry_customer_and_archive_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_enquiry_customer_and_archive_immutability() TO authenticated, service_role;

-- 5. RESTORE TABLE UPDATE PRIVILEGES AND SUPERADMIN UPDATE POLICY
GRANT UPDATE ON public.enquiries TO authenticated;

DROP POLICY IF EXISTS "Superadmins can update enquiries" ON public.enquiries;
CREATE POLICY "Superadmins can update enquiries"
  ON public.enquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

COMMIT;
