-- ============================================================================
-- ARS Computers — Step 7 (Phase 1 Remediation): Security Review Hardening
-- Migration: 20261022000003_phase1_security_remediations.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- REMEDIATIONS IMPLEMENTED:
-- 1. Finding 1: Restrict anonymous enquiry creation:
--    - Enforce at both RLS policy and trigger level that public/non-admin enquiry
--      submissions must have status = 'new' and admin_notes IS NULL.
--    - Use dedicated policy for `anon` without calling admin functions.
-- 2. Finding 3: Protect enquiry ID immutability:
--    - Update protect_enquiry_customer_immutability() to strictly check
--      NEW.id IS DISTINCT FROM OLD.id and reject modifications.
-- 3. Finding 4: Audit-table hardening:
--    - Add BEFORE TRUNCATE triggers to audit_logs and enquiry_activities.
--    - Update prevent_audit_log_tampering() error messaging.
--    - Restrict function EXECUTE privileges from PUBLIC and anon where appropriate
--      while preserving necessary trigger execution permissions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FINDING 1: Restrict Public / Anonymous Enquiry Creation
-- ----------------------------------------------------------------------------

-- Clean up any prior versions of submission policies
DROP POLICY IF EXISTS "Public and authenticated can submit enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Public and non-admin can submit enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Anonymous can submit new enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Authenticated can submit enquiries" ON public.enquiries;

-- A. Dedicated policy for unauthenticated (anon) public visitors:
-- Strictly limits submission to status = 'new' and admin_notes IS NULL.
-- Evaluates without calling admin helper functions.
CREATE POLICY "Anonymous can submit new enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'new' AND
    admin_notes IS NULL
  );

-- B. Policy for authenticated users:
-- Allows active administrators full flexibility, while constraining non-admin authenticated users.
CREATE POLICY "Authenticated can submit enquiries"
  ON public.enquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR
    (status = 'new' AND admin_notes IS NULL)
  );

-- C. Defense-in-depth trigger: Enforce default status & reject notes on INSERT for non-admins
CREATE OR REPLACE FUNCTION public.enforce_enquiry_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If actor is not an active admin or superadmin
  IF NOT public.is_admin() THEN
    -- If status is not supplied or empty, default to 'new'
    IF NEW.status IS NULL THEN
      NEW.status := 'new';
    ELSIF NEW.status != 'new' THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions must have status "new".'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Reject any non-null admin_notes on public submission
    IF NEW.admin_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Internal admin notes cannot be supplied during public enquiry submission.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_enquiry_insert_defaults ON public.enquiries;
CREATE TRIGGER trg_enforce_enquiry_insert_defaults
  BEFORE INSERT ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_enquiry_insert_defaults();


-- ----------------------------------------------------------------------------
-- 2. FINDING 3: Protect Enquiry ID Immutability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Prevent altering enquiry primary key ID
  IF (NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Customer submission protection: Enquiry ID is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Prevent altering customer submission data once created
  IF (NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer name is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.contact_info IS DISTINCT FROM OLD.contact_info) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer contact details are immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.category_interest IS DISTINCT FROM OLD.category_interest) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer requested category is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.message IS DISTINCT FROM OLD.message) THEN
    RAISE EXCEPTION 'Customer submission protection: Original customer message is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Customer submission protection: Submission timestamp is immutable.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. FINDING 4: Audit Table & Activity Hardening (Truncate Guards & Grants)
-- ----------------------------------------------------------------------------

-- A. Update prevent_audit_log_tampering to explicitly handle and mention TRUNCATE
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: Audit logs and activity histories are strictly append-only and cannot be updated, deleted, or truncated.'
    USING ERRCODE = 'feature_not_supported';
END;
$$;

-- B. Add BEFORE TRUNCATE triggers on audit_logs and enquiry_activities
DROP TRIGGER IF EXISTS trg_prevent_audit_logs_truncate ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS trg_prevent_enquiry_activities_truncate ON public.enquiry_activities;
CREATE TRIGGER trg_prevent_enquiry_activities_truncate
  BEFORE TRUNCATE ON public.enquiry_activities
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- C. Review and tighten EXECUTE privileges on trigger functions
-- Revoke PUBLIC/anon execute on update-only/admin trigger functions
REVOKE EXECUTE ON FUNCTION public.protect_enquiry_customer_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_enquiry_customer_immutability() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_tampering() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_audit_log_tampering() TO authenticated;

-- Functions executed during anonymous enquiry insertion (record_audit_event & enforce_enquiry_insert_defaults)
-- must be executable by anon and authenticated so triggers can fire without permission error.
GRANT EXECUTE ON FUNCTION public.enforce_enquiry_insert_defaults() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_audit_event() TO anon, authenticated;
