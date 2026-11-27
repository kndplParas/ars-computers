-- ============================================================================
-- ARS Computers — Migration 20261127000001: Complete Enquiry Editing & Audit RPC
-- ============================================================================
-- PURPOSE:
-- 1. Safely add missing business columns (company, service_requested) to public.enquiries.
-- 2. Strip direct table UPDATE privileges on public.enquiries from anon and authenticated
--    to prevent any direct SQL tampering or audit bypass (even by Superadmin).
-- 3. Provision private internal authorization schema (ars_internal) and single-use
--    transaction ledger (ars_internal.active_enquiry_edits) accessible ONLY to postgres/service_role.
-- 4. Update immutability trigger (protect_enquiry_customer_and_archive_immutability)
--    with independent ledger-based verification:
--    - Eliminates forgeable custom GUC settings (set_config bypass).
--    - Eliminates fragile PG_CONTEXT stack string matching.
--    - Independently verifies and atomically consumes the single-use authorization token.
--    - Protects admin_notes alongside customer identification, service specs, and requirement fields.
--    - Preserves all assignment immutability, completion approval provenance, and archive invariants.
--    - Preserves compatibility with existing dedicated workflow RPCs (self_assign, status, etc.).
-- 5. Provide atomic, secure backend RPC (update_enquiry_details) with:
--    - Active administrative staff authentication & role-based access control.
--    - Strict validation (10-digit Indian phone, email format, string lengths).
--    - Explicit, safe distinction between omitted fields and intentionally cleared optional fields.
--    - Head-Person (superadmin) restriction for completed/closed enquiry corrections.
--    - Atomic dual audit trail (public.audit_logs and public.enquiry_activities).
--    - Transaction-safe: audit failure rolls back the entire edit.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SAFELY ADD MISSING BUSINESS COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS service_requested TEXT;

-- ----------------------------------------------------------------------------
-- 2. ENFORCE STRICT PRIVILEGE BOUNDARY ON public.enquiries
-- ----------------------------------------------------------------------------
-- Drop direct table UPDATE policy; revoke UPDATE from anon and authenticated.
-- All enquiry mutations MUST proceed through audited SECURITY DEFINER procedures.
DROP POLICY IF EXISTS "Superadmins can update enquiries" ON public.enquiries;
REVOKE ALL ON public.enquiries FROM PUBLIC, anon;
REVOKE UPDATE, DELETE ON public.enquiries FROM authenticated;
GRANT SELECT ON public.enquiries TO authenticated;
GRANT INSERT ON public.enquiries TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. PROVISION PRIVATE AUTHORIZATION SCHEMA & TRANSACTION LEDGER
-- ----------------------------------------------------------------------------
-- Schema ars_internal is strictly inaccessible to PUBLIC, anon, authenticated, and service_role.
-- Only trusted SECURITY DEFINER functions owned by postgres can access it.
CREATE SCHEMA IF NOT EXISTS ars_internal;
REVOKE ALL ON SCHEMA ars_internal FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ars_internal TO postgres;

CREATE TABLE IF NOT EXISTS ars_internal.active_enquiry_edits (
  enquiry_id UUID PRIMARY KEY,
  actor_id UUID NOT NULL,
  nonce TEXT NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON TABLE ars_internal.active_enquiry_edits FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE ars_internal.active_enquiry_edits TO postgres;
ALTER TABLE ars_internal.active_enquiry_edits OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 4. INDEPENDENT LEDGER-VERIFIED IMMUTABILITY TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'ars_internal'
AS $$
DECLARE
  v_consumed_nonce TEXT := NULL;
  v_is_authorized_edit BOOLEAN := false;
  v_is_authorized_superadmin BOOLEAN := false;
  v_actor_role TEXT;
  v_caller_id UUID;
BEGIN
  -- RULE 1: Core primary key and immutable provenance CANNOT be modified by anyone, ever
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Immutability violation: enquiry id cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.enquiry_number IS NOT NULL AND NEW.enquiry_number IS DISTINCT FROM OLD.enquiry_number THEN
    RAISE EXCEPTION 'Immutability violation: enquiry_number cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutability violation: original created_at timestamp cannot be modified.' USING ERRCODE = 'check_violation';
  END IF;

  -- RULE 2: Independent Transaction Ledger Verification
  -- Atomically consume the single-use authorization token recorded by update_enquiry_details().
  -- External callers (direct SQL, forged GUCs, wrapper functions) cannot insert into ars_internal
  -- because all privileges on ars_internal are revoked from PUBLIC, anon, and authenticated.
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    DELETE FROM ars_internal.active_enquiry_edits
    WHERE enquiry_id = OLD.id
      AND actor_id = v_caller_id
      AND authorized_at >= (clock_timestamp() - INTERVAL '15 seconds')
    RETURNING nonce INTO v_consumed_nonce;

    IF v_consumed_nonce IS NOT NULL THEN
      v_is_authorized_edit := true;

      SELECT role INTO v_actor_role
      FROM public.admin_users
      WHERE id = v_caller_id AND is_active = true;

      IF v_actor_role = 'superadmin' THEN
        v_is_authorized_superadmin := true;
      END IF;
    END IF;
  END IF;

  -- RULE 3: Permanent archive & completion protections once completion has been approved
  IF OLD.completion_approved_at IS NOT NULL THEN
    -- Only authorized Super Admin privileged correction via update_enquiry_details() may modify completed enquiries
    IF NOT (v_is_authorized_edit AND v_is_authorized_superadmin) THEN
      RAISE EXCEPTION 'Permanent archive protection: Approved completed enquiries cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;

    -- Even for Super Admin privileged correction, completion and approval provenance is strictly IMMUTABLE:
    IF NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at THEN
      RAISE EXCEPTION 'Permanent archive protection: completion_approved_at timestamp cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by THEN
      RAISE EXCEPTION 'Permanent archive protection: Head approval identity UUID cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name THEN
      RAISE EXCEPTION 'Permanent archive protection: Head approval name snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Head approval employee code snapshot cannot be modified.' USING ERRCODE = 'check_violation';
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
    IF NEW.is_removed = true AND (OLD.is_removed IS FALSE OR OLD.is_removed IS NULL) THEN
      RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.' USING ERRCODE = 'check_violation';
    END IF;

    -- Strict Assignment Immutability on Completed Records (preserved from Phase 2 Hardening)
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

  -- RULE 4: Direct unauthorized SQL modification of customer-submitted, service, and detail fields is strictly blocked.
  -- Notice: admin_notes is explicitly guarded here. Other workflow procedures (self_assign, status updates)
  -- do not touch any of these protected fields and remain 100% operational.
  IF NOT v_is_authorized_edit THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Immutability violation: customer name can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.customer_name IS DISTINCT FROM OLD.customer_name THEN
      RAISE EXCEPTION 'Immutability violation: customer_name can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.customer_phone IS DISTINCT FROM OLD.customer_phone THEN
      RAISE EXCEPTION 'Immutability violation: customer_phone can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.customer_email IS DISTINCT FROM OLD.customer_email THEN
      RAISE EXCEPTION 'Immutability violation: customer_email can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.customer_address IS DISTINCT FROM OLD.customer_address THEN
      RAISE EXCEPTION 'Immutability violation: customer_address can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.company IS DISTINCT FROM OLD.company THEN
      RAISE EXCEPTION 'Immutability violation: company can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.contact_info IS DISTINCT FROM OLD.contact_info THEN
      RAISE EXCEPTION 'Immutability violation: customer contact_info can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.message IS DISTINCT FROM OLD.message THEN
      RAISE EXCEPTION 'Immutability violation: customer message can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.category_interest IS DISTINCT FROM OLD.category_interest THEN
      RAISE EXCEPTION 'Immutability violation: category_interest can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.enquiry_type IS DISTINCT FROM OLD.enquiry_type THEN
      RAISE EXCEPTION 'Immutability violation: enquiry_type can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.service_requested IS DISTINCT FROM OLD.service_requested THEN
      RAISE EXCEPTION 'Immutability violation: service_requested can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.service_details IS DISTINCT FROM OLD.service_details THEN
      RAISE EXCEPTION 'Immutability violation: service_details can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Immutability violation: admin_notes can only be modified through update_enquiry_details().' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trg_protect_enquiry_customer_immutability ON public.enquiries;
CREATE TRIGGER trg_protect_enquiry_customer_immutability
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_enquiry_customer_and_archive_immutability();

ALTER FUNCTION public.protect_enquiry_customer_and_archive_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_enquiry_customer_and_archive_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_enquiry_customer_and_archive_immutability() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. COMPLETE ENQUIRY EDITING RPC FUNCTION WITH TRANSACTION HANDSHAKE & DUAL AUDIT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_enquiry_details(
  p_enquiry_id UUID,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_category_interest TEXT DEFAULT NULL,
  p_enquiry_type TEXT DEFAULT NULL,
  p_service_requested TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL,
  p_service_details JSONB DEFAULT NULL,
  p_edit_summary TEXT DEFAULT NULL,
  p_cleared_fields TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'ars_internal'
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;

  v_enquiry RECORD;
  v_is_approved BOOLEAN := false;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_tx_nonce TEXT;

  v_clean_name TEXT;
  v_clean_phone TEXT;
  v_clean_email TEXT;
  v_clean_company TEXT;
  v_clean_address TEXT;
  v_clean_category TEXT;
  v_clean_type TEXT;
  v_clean_req TEXT;
  v_clean_message TEXT;
  v_clean_notes TEXT;
  v_merged_service_details JSONB;

  v_old_values JSONB := '{}'::jsonb;
  v_new_values JSONB := '{}'::jsonb;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
  v_change_descriptions TEXT[] := ARRAY[]::TEXT[];
  v_activity_content TEXT;
  v_invalid_clear TEXT;
BEGIN
  -- 1. Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to edit enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email, employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  -- 2. Role-based check: Authorized roles only
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Enquiry editing is restricted to authorized administrative staff.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock enquiry row for update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Check bin and removal state
  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Cannot edit an enquiry currently in the Bin.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_removed THEN
    RAISE EXCEPTION 'Cannot edit a removed enquiry record.' USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Approval State Enforcement
  v_is_approved := (v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed');
  IF v_is_approved AND v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Enquiry completion has already been approved by Head Admin. Editing completed records is strictly restricted to Head-Person.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Closed/rejected enquiries require Head approval to edit
  IF (v_enquiry.status IN ('rejected', 'closed')) AND v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Editing closed or rejected enquiries is restricted to Head-Person (Super Admin).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 6. Validate cleared fields: Mandatory fields can NEVER be cleared
  FOREACH v_invalid_clear IN ARRAY p_cleared_fields LOOP
    IF v_invalid_clear IN ('customer_name', 'name', 'customer_phone', 'category_interest', 'enquiry_type', 'message') THEN
      RAISE EXCEPTION 'Mandatory field "%" cannot be cleared.', v_invalid_clear
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- 7. Clean and validate inputs (distinguishing Omitted vs Cleared vs Updated)
  -- Customer Name (Mandatory)
  IF p_customer_name IS NOT NULL THEN
    v_clean_name := trim(p_customer_name);
    IF length(v_clean_name) < 2 THEN
      RAISE EXCEPTION 'Customer Name must be at least 2 characters.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_name := COALESCE(v_enquiry.customer_name, v_enquiry.name);
  END IF;

  -- Customer Phone (Mandatory Indian 10-digit)
  IF p_customer_phone IS NOT NULL THEN
    v_clean_phone := trim(regexp_replace(p_customer_phone, '[\s\-\(\)\.]', '', 'g'));
    IF v_clean_phone LIKE '+91%' THEN v_clean_phone := substring(v_clean_phone FROM 4); END IF;
    IF v_clean_phone LIKE '91%' AND length(v_clean_phone) = 12 THEN v_clean_phone := substring(v_clean_phone FROM 3); END IF;
    IF v_clean_phone LIKE '0%' AND length(v_clean_phone) = 11 THEN v_clean_phone := substring(v_clean_phone FROM 2); END IF;
    IF v_clean_phone = '' OR length(v_clean_phone) <> 10 OR v_clean_phone !~ '^[6-9][0-9]{9}$' THEN
      RAISE EXCEPTION 'Customer Phone must be a valid 10-digit Indian mobile number.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_phone := v_enquiry.customer_phone;
  END IF;

  -- Customer Email (Optional: can be cleared)
  IF 'customer_email' = ANY(p_cleared_fields) OR (p_customer_email IS NOT NULL AND trim(p_customer_email) = '') THEN
    v_clean_email := NULL;
  ELSIF p_customer_email IS NOT NULL THEN
    v_clean_email := lower(trim(p_customer_email));
    IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Customer Email format is invalid.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_email := v_enquiry.customer_email;
  END IF;

  -- Company (Optional: can be cleared)
  IF 'company' = ANY(p_cleared_fields) OR (p_company IS NOT NULL AND trim(p_company) = '') THEN
    v_clean_company := NULL;
  ELSIF p_company IS NOT NULL THEN
    v_clean_company := trim(p_company);
  ELSE
    v_clean_company := v_enquiry.company;
  END IF;

  -- Customer Address (Optional: can be cleared)
  IF 'customer_address' = ANY(p_cleared_fields) OR (p_customer_address IS NOT NULL AND trim(p_customer_address) = '') THEN
    v_clean_address := NULL;
  ELSIF p_customer_address IS NOT NULL THEN
    v_clean_address := trim(p_customer_address);
  ELSE
    v_clean_address := v_enquiry.customer_address;
  END IF;

  -- Category Interest (Mandatory)
  IF p_category_interest IS NOT NULL THEN
    v_clean_category := trim(p_category_interest);
    IF length(v_clean_category) < 2 THEN
      RAISE EXCEPTION 'Category interest must be at least 2 characters.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_category := v_enquiry.category_interest;
  END IF;

  -- Enquiry Type (Mandatory enum)
  IF p_enquiry_type IS NOT NULL THEN
    v_clean_type := trim(p_enquiry_type);
    IF v_clean_type NOT IN ('general', 'product', 'quotation', 'service_request') THEN
      RAISE EXCEPTION 'Invalid enquiry type specified.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_type := v_enquiry.enquiry_type;
  END IF;

  -- Service Requested / Requirement (Optional: can be cleared)
  IF 'service_requested' = ANY(p_cleared_fields) OR (p_service_requested IS NOT NULL AND trim(p_service_requested) = '') THEN
    v_clean_req := NULL;
  ELSIF p_service_requested IS NOT NULL THEN
    v_clean_req := trim(p_service_requested);
  ELSE
    v_clean_req := v_enquiry.service_requested;
  END IF;

  -- Message (Mandatory)
  IF p_message IS NOT NULL THEN
    v_clean_message := trim(p_message);
    IF length(v_clean_message) < 3 THEN
      RAISE EXCEPTION 'Enquiry message must be at least 3 characters.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_message := v_enquiry.message;
  END IF;

  -- Admin Notes (Optional: can be cleared)
  IF 'admin_notes' = ANY(p_cleared_fields) OR (p_admin_notes IS NOT NULL AND trim(p_admin_notes) = '') THEN
    v_clean_notes := NULL;
  ELSIF p_admin_notes IS NOT NULL THEN
    v_clean_notes := trim(p_admin_notes);
  ELSE
    v_clean_notes := v_enquiry.admin_notes;
  END IF;

  -- Service Details JSONB
  IF p_service_details IS NOT NULL THEN
    IF jsonb_typeof(p_service_details) = 'object' THEN
      v_merged_service_details := COALESCE(v_enquiry.service_details, '{}'::jsonb) || p_service_details;
    ELSE
      v_merged_service_details := v_enquiry.service_details;
    END IF;
  ELSE
    v_merged_service_details := v_enquiry.service_details;
  END IF;

  -- 8. Delta detection & Audit trail generation
  IF p_customer_name IS NOT NULL AND v_clean_name IS DISTINCT FROM COALESCE(v_enquiry.customer_name, v_enquiry.name) THEN
    v_old_values := v_old_values || jsonb_build_object('customer_name', COALESCE(v_enquiry.customer_name, v_enquiry.name));
    v_new_values := v_new_values || jsonb_build_object('customer_name', v_clean_name);
    v_changed_fields := array_append(v_changed_fields, 'customer_name');
    v_change_descriptions := array_append(v_change_descriptions, 'Name: "' || COALESCE(v_enquiry.customer_name, v_enquiry.name, '') || '" → "' || v_clean_name || '"');
  END IF;

  IF p_customer_phone IS NOT NULL AND v_clean_phone IS DISTINCT FROM v_enquiry.customer_phone THEN
    v_old_values := v_old_values || jsonb_build_object('customer_phone', v_enquiry.customer_phone);
    v_new_values := v_new_values || jsonb_build_object('customer_phone', v_clean_phone);
    v_changed_fields := array_append(v_changed_fields, 'customer_phone');
    v_change_descriptions := array_append(v_change_descriptions, 'Phone: "' || COALESCE(v_enquiry.customer_phone, 'None') || '" → "' || COALESCE(v_clean_phone, 'None') || '"');
  END IF;

  IF ('customer_email' = ANY(p_cleared_fields) OR p_customer_email IS NOT NULL) AND v_clean_email IS DISTINCT FROM v_enquiry.customer_email THEN
    v_old_values := v_old_values || jsonb_build_object('customer_email', v_enquiry.customer_email);
    v_new_values := v_new_values || jsonb_build_object('customer_email', v_clean_email);
    v_changed_fields := array_append(v_changed_fields, 'customer_email');
    v_change_descriptions := array_append(v_change_descriptions, 'Email: "' || COALESCE(v_enquiry.customer_email, 'None') || '" → "' || COALESCE(v_clean_email, 'None') || '"');
  END IF;

  IF ('company' = ANY(p_cleared_fields) OR p_company IS NOT NULL) AND v_clean_company IS DISTINCT FROM v_enquiry.company THEN
    v_old_values := v_old_values || jsonb_build_object('company', v_enquiry.company);
    v_new_values := v_new_values || jsonb_build_object('company', v_clean_company);
    v_changed_fields := array_append(v_changed_fields, 'company');
    v_change_descriptions := array_append(v_change_descriptions, 'Company: "' || COALESCE(v_enquiry.company, 'None') || '" → "' || COALESCE(v_clean_company, 'None') || '"');
  END IF;

  IF ('customer_address' = ANY(p_cleared_fields) OR p_customer_address IS NOT NULL) AND v_clean_address IS DISTINCT FROM v_enquiry.customer_address THEN
    v_old_values := v_old_values || jsonb_build_object('customer_address', v_enquiry.customer_address);
    v_new_values := v_new_values || jsonb_build_object('customer_address', v_clean_address);
    v_changed_fields := array_append(v_changed_fields, 'customer_address');
    v_change_descriptions := array_append(v_change_descriptions, 'Address updated');
  END IF;

  IF p_category_interest IS NOT NULL AND v_clean_category IS DISTINCT FROM v_enquiry.category_interest THEN
    v_old_values := v_old_values || jsonb_build_object('category_interest', v_enquiry.category_interest);
    v_new_values := v_new_values || jsonb_build_object('category_interest', v_clean_category);
    v_changed_fields := array_append(v_changed_fields, 'category_interest');
    v_change_descriptions := array_append(v_change_descriptions, 'Category: "' || COALESCE(v_enquiry.category_interest, '') || '" → "' || v_clean_category || '"');
  END IF;

  IF p_enquiry_type IS NOT NULL AND v_clean_type IS DISTINCT FROM v_enquiry.enquiry_type THEN
    v_old_values := v_old_values || jsonb_build_object('enquiry_type', v_enquiry.enquiry_type);
    v_new_values := v_new_values || jsonb_build_object('enquiry_type', v_clean_type);
    v_changed_fields := array_append(v_changed_fields, 'enquiry_type');
    v_change_descriptions := array_append(v_change_descriptions, 'Type: ' || v_enquiry.enquiry_type || ' → ' || v_clean_type);
  END IF;

  IF ('service_requested' = ANY(p_cleared_fields) OR p_service_requested IS NOT NULL) AND v_clean_req IS DISTINCT FROM v_enquiry.service_requested THEN
    v_old_values := v_old_values || jsonb_build_object('service_requested', v_enquiry.service_requested);
    v_new_values := v_new_values || jsonb_build_object('service_requested', v_clean_req);
    v_changed_fields := array_append(v_changed_fields, 'service_requested');
    v_change_descriptions := array_append(v_change_descriptions, 'Requirement title updated');
  END IF;

  IF p_message IS NOT NULL AND v_clean_message IS DISTINCT FROM v_enquiry.message THEN
    v_old_values := v_old_values || jsonb_build_object('message', v_enquiry.message);
    v_new_values := v_new_values || jsonb_build_object('message', v_clean_message);
    v_changed_fields := array_append(v_changed_fields, 'message');
    v_change_descriptions := array_append(v_change_descriptions, 'Problem description / message updated');
  END IF;

  IF ('admin_notes' = ANY(p_cleared_fields) OR p_admin_notes IS NOT NULL) AND v_clean_notes IS DISTINCT FROM v_enquiry.admin_notes THEN
    v_old_values := v_old_values || jsonb_build_object('admin_notes', v_enquiry.admin_notes);
    v_new_values := v_new_values || jsonb_build_object('admin_notes', v_clean_notes);
    v_changed_fields := array_append(v_changed_fields, 'admin_notes');
    v_change_descriptions := array_append(v_change_descriptions, 'Internal admin notes updated');
  END IF;

  IF p_service_details IS NOT NULL AND v_merged_service_details IS DISTINCT FROM v_enquiry.service_details THEN
    v_old_values := v_old_values || jsonb_build_object('service_details', v_enquiry.service_details);
    v_new_values := v_new_values || jsonb_build_object('service_details', v_merged_service_details);
    v_changed_fields := array_append(v_changed_fields, 'service_details');
    v_change_descriptions := array_append(v_change_descriptions, 'Service & repair specifications updated');
  END IF;

  -- If no fields actually changed, return early
  IF array_length(v_changed_fields, 1) IS NULL OR array_length(v_changed_fields, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'enquiry_id', p_enquiry_id,
      'changed_fields', '[]'::jsonb,
      'message', 'No changes detected.'
    );
  END IF;

  -- 9. Authorize Trigger Execution via Private Ledger
  -- Generate cryptographically random ephemeral nonce and insert single-use authorization ledger entry
  v_tx_nonce := gen_random_uuid()::text;
  INSERT INTO ars_internal.active_enquiry_edits (enquiry_id, actor_id, nonce, authorized_at)
  VALUES (p_enquiry_id, v_actor_id, v_tx_nonce, v_now)
  ON CONFLICT (enquiry_id) DO UPDATE
  SET actor_id = EXCLUDED.actor_id, nonce = EXCLUDED.nonce, authorized_at = EXCLUDED.authorized_at;

  -- 10. Perform atomic update on verified production columns
  UPDATE public.enquiries
  SET
    name = v_clean_name,
    customer_name = v_clean_name,
    customer_phone = v_clean_phone,
    customer_email = v_clean_email,
    contact_info = CASE
      WHEN v_clean_email IS NOT NULL AND v_clean_phone IS NOT NULL THEN v_clean_phone || ' | ' || v_clean_email
      WHEN v_clean_phone IS NOT NULL THEN v_clean_phone
      ELSE COALESCE(v_clean_email, 'Not Provided')
    END,
    company = v_clean_company,
    customer_address = v_clean_address,
    category_interest = v_clean_category,
    enquiry_type = v_clean_type,
    service_requested = v_clean_req,
    message = v_clean_message,
    admin_notes = v_clean_notes,
    service_details = v_merged_service_details,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- 11. Insert into permanent audit_logs (Strict: any failure rolls back transaction)
  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'UPDATE',
    'enquiries',
    p_enquiry_id::text,
    v_old_values,
    v_new_values,
    v_now
  );

  -- 12. Insert user-facing activity record into enquiry_activities
  -- Bounded safely to 3,000 characters to strictly satisfy public.enquiry_activities constraint
  v_activity_content := CASE
    WHEN p_edit_summary IS NOT NULL AND trim(p_edit_summary) <> '' THEN
      substring(trim(p_edit_summary) FROM 1 FOR 3000)
    ELSE
      CASE
        WHEN char_length('Enquiry details updated (' || array_to_string(v_change_descriptions, '; ') || ')') > 3000 THEN
          substring('Enquiry details updated (' || array_to_string(v_change_descriptions, '; ') || ')' FROM 1 FOR 2997) || '...'
        ELSE
          'Enquiry details updated (' || array_to_string(v_change_descriptions, '; ') || ')'
      END
  END;

  IF v_activity_content IS NULL OR trim(v_activity_content) = '' THEN
    v_activity_content := 'Enquiry details updated';
  END IF;

  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'note',
    v_activity_content,
    jsonb_build_object(
      'action', 'ENQUIRY_DETAILS_EDITED',
      'changed_fields', to_jsonb(v_changed_fields),
      'is_privileged_correction', (v_is_approved AND v_actor_role = 'superadmin')
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'changed_fields', to_jsonb(v_changed_fields),
    'is_privileged_correction', (v_is_approved AND v_actor_role = 'superadmin'),
    'message', CASE
      WHEN v_is_approved AND v_actor_role = 'superadmin'
        THEN 'Superadministrator privileged correction saved and recorded in audit log.'
      ELSE 'Enquiry details updated successfully.'
    END
  );
END;
$$;

-- Explicitly enforce function ownership by postgres (the database superuser)
ALTER FUNCTION public.update_enquiry_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT[]
) OWNER TO postgres;

-- Revoke public access; grant strictly to authenticated staff and service_role
REVOKE ALL ON FUNCTION public.update_enquiry_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_enquiry_details(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT[]
) TO authenticated, service_role;

COMMIT;
