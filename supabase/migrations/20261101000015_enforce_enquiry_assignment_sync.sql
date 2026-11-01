-- ============================================================================
-- ARS Computers — Step 3: Enforce Enquiry Assignment Dual-Column Synchronization
-- Migration: 20261101000015_enforce_enquiry_assignment_sync.sql
-- Sequential following 20261031000014_enquiry_customer_communication_and_proof_privacy
-- ============================================================================
-- PURPOSE:
-- 1. Eliminate any possibility of divergence between public.enquiries.assigned_employee_id
--    and public.enquiries.assigned_to.
-- 2. Prevent the "two-user divergence attack" where conflicting assignment columns
--    could grant service proof and storage access to two different staff members.
-- 3. Provide automated bidirectional mirroring on INSERT and UPDATE when a single
--    column is updated (such as third-party tools or partial update payloads).
-- 4. Strictly REJECT conflicting assignment values (different non-null UUIDs).
-- 5. Enforce bidirectional unassignment: setting either column to NULL unassigns both.
-- 6. Add database-level CHECK constraint (assigned_employee_id IS NOT DISTINCT FROM assigned_to).
-- 7. Register migration in supabase_migrations.schema_migrations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRE-VALIDATION & BACKFILL CLEANUP
-- Ensure all existing rows are 100% synchronized before adding CHECK constraint
-- ----------------------------------------------------------------------------
UPDATE public.enquiries
SET assigned_to = assigned_employee_id
WHERE assigned_employee_id IS NOT NULL AND assigned_to IS NULL;

UPDATE public.enquiries
SET assigned_employee_id = assigned_to
WHERE assigned_to IS NOT NULL AND assigned_employee_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. TRIGGER FUNCTION: sync_enquiry_assignment_columns
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_enquiry_assignment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- If both are supplied with conflicting non-null values, reject insert
    IF NEW.assigned_employee_id IS NOT NULL 
       AND NEW.assigned_to IS NOT NULL 
       AND NEW.assigned_employee_id <> NEW.assigned_to THEN
      RAISE EXCEPTION 'Assignment conflict: assigned_employee_id (%) and assigned_to (%) cannot refer to different staff members.',
        NEW.assigned_employee_id, NEW.assigned_to
        USING ERRCODE = 'check_violation';

    -- If only assigned_employee_id is provided, populate assigned_to
    ELSIF NEW.assigned_employee_id IS NOT NULL AND NEW.assigned_to IS NULL THEN
      NEW.assigned_to := NEW.assigned_employee_id;

    -- If only assigned_to is provided, populate assigned_employee_id
    ELSIF NEW.assigned_to IS NOT NULL AND NEW.assigned_employee_id IS NULL THEN
      NEW.assigned_employee_id := NEW.assigned_to;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Scenario 1: Both columns explicitly updated to different non-matching values -> REJECT
    IF (NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id)
       AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
       AND (NEW.assigned_employee_id IS DISTINCT FROM NEW.assigned_to) THEN
      RAISE EXCEPTION 'Assignment conflict: Cannot assign enquiry to conflicting staff members (assigned_employee_id: %, assigned_to: %).',
        NEW.assigned_employee_id, NEW.assigned_to
        USING ERRCODE = 'check_violation';

    -- Scenario 2: Only assigned_employee_id was modified -> mirror to assigned_to
    ELSIF (NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id)
          AND (NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to) THEN
      NEW.assigned_to := NEW.assigned_employee_id;

    -- Scenario 3: Only assigned_to was modified -> mirror to assigned_employee_id
    ELSIF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
          AND (NEW.assigned_employee_id IS NOT DISTINCT FROM OLD.assigned_employee_id) THEN
      NEW.assigned_employee_id := NEW.assigned_to;

    -- Scenario 4: Neither modified or both modified together -> verify equality
    ELSIF NEW.assigned_employee_id IS DISTINCT FROM NEW.assigned_to THEN
      RAISE EXCEPTION 'Assignment conflict: Inconsistent assignment values detected (% vs %).',
        NEW.assigned_employee_id, NEW.assigned_to
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke direct execute from untrusted roles
REVOKE EXECUTE ON FUNCTION public.sync_enquiry_assignment_columns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_enquiry_assignment_columns() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. BIND TRIGGER TO public.enquiries
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_enquiry_assignment_columns ON public.enquiries;
CREATE TRIGGER trg_sync_enquiry_assignment_columns
  BEFORE INSERT OR UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_enquiry_assignment_columns();

-- ----------------------------------------------------------------------------
-- 4. ADD ENGINE CHECK CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  DROP CONSTRAINT IF EXISTS chk_enquiries_assignment_sync;

ALTER TABLE public.enquiries
  ADD CONSTRAINT chk_enquiries_assignment_sync
  CHECK (assigned_employee_id IS NOT DISTINCT FROM assigned_to);

