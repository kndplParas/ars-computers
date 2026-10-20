-- ============================================================================
-- ARS Computers — Step 8 (Phase 2 Hardening): Direct DELETE, Audit Protection, & Submission Hardening
-- Migration: 20261024000001_phase1_security_hardening.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- REMEDIATIONS IMPLEMENTED:
-- 1. Finding 1: Direct DELETE on public.enquiries bypasses Bin retention:
--    - Drop "Superadmins can delete enquiries" policy.
--    - REVOKE DELETE ON public.enquiries FROM anon, authenticated.
--    - All enquiry purges MUST proceed through SECURITY DEFINER RPC:
--      purge_expired_bin_enquiries().
-- 2. Finding 2: Direct INSERT on public.enquiry_activities allows audit forgery:
--    - Drop "Superadmins can insert enquiry activities" policy.
--    - REVOKE INSERT ON public.enquiry_activities FROM anon, authenticated.
--    - All activity logging MUST proceed through SECURITY DEFINER workflow functions.
-- 3. Finding 6: Defense-in-depth on purge_expired_bin_enquiries():
--    - Assert session_user IN ('postgres', 'supabase_admin') when auth.uid() IS NULL.
--    - Explicitly REVOKE EXECUTE on purge functions from anon and PUBLIC.
-- 4. Audit & Immutability Integrity:
--    - Re-affirm prevent_audit_log_tampering() with authorized app.enquiry_purging bypass.
--    - Re-affirm record_audit_event() with privacy-conscious customer PII redaction on DELETE.
-- 5. Submission Protection:
--    - Ensure anonymous submission policy & trigger reject all workflow, completion, and Bin fields.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENFORCE BIN RETENTION LIFECYCLE: Remove direct table DELETE on enquiries
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmins can delete enquiries" ON public.enquiries;
REVOKE DELETE ON public.enquiries FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. ENFORCE AUDIT INTEGRITY: Remove direct table INSERT on enquiry_activities
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmins can insert enquiry activities" ON public.enquiry_activities;
REVOKE INSERT ON public.enquiry_activities FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. AUDIT IMMUTABILITY & PURGE INTEGRITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow cascaded deletion of enquiry_activities strictly during an authorized Bin purge
  IF TG_TABLE_NAME = 'enquiry_activities' AND TG_OP = 'DELETE' AND pg_catalog.current_setting('app.enquiry_purging', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Security violation: Audit logs and activity histories are strictly append-only and cannot be updated, deleted, or truncated.'
    USING ERRCODE = 'feature_not_supported';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_tampering() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_audit_log_tampering() TO authenticated;

-- Privacy-conscious audit logging: Redact customer PII on permanent DELETE
CREATE OR REPLACE FUNCTION public.record_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_entity_id TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
  v_action TEXT;
BEGIN
  v_actor_id := auth.uid();
  v_action := TG_OP;

  -- Determine reliable actor identity and role
  IF v_actor_id IS NOT NULL THEN
    SELECT email, role INTO v_actor_email, v_actor_role
    FROM public.admin_users
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
      v_actor_role := 'authenticated';
    END IF;
  ELSE
    IF session_user IN ('postgres', 'supabase_admin') THEN
      v_actor_role := 'database_system';
      v_actor_email := session_user;
    ELSE
      v_actor_role := 'anonymous';
      v_actor_email := 'anonymous@arscomputers.in';
    END IF;
  END IF;

  -- Build entity ID and JSON snapshots
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (OLD.id)::text;
    
    -- If deleting an enquiry, redact customer personal data to satisfy privacy requirement
    IF TG_TABLE_NAME = 'enquiries' THEN
      v_old_json := pg_catalog.jsonb_build_object(
        'id', OLD.id,
        'status', OLD.status,
        'is_in_bin', OLD.is_in_bin,
        'bin_entered_at', OLD.bin_entered_at,
        'scheduled_deletion_at', OLD.scheduled_deletion_at,
        'completion_approved_by', OLD.completion_approved_by,
        'completion_approved_at', OLD.completion_approved_at,
        'completion_requested_by', OLD.completion_requested_by,
        'created_at', OLD.created_at,
        'customer_pii_redacted', true
      );
    ELSE
      v_old_json := pg_catalog.to_jsonb(OLD);
    END IF;

    v_new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_entity_id := (NEW.id)::text;
    v_old_json := NULL;
    v_new_json := pg_catalog.to_jsonb(NEW);
  ELSE -- UPDATE
    v_entity_id := (NEW.id)::text;
    v_old_json := pg_catalog.to_jsonb(OLD);
    v_new_json := pg_catalog.to_jsonb(NEW);
  END IF;

  -- Mask any potential sensitive internal hash fields if ever present
  IF v_old_json ? 'password_hash' THEN
    v_old_json := v_old_json - 'password_hash';
  END IF;
  IF v_new_json ? 'password_hash' THEN
    v_new_json := v_new_json - 'password_hash';
  END IF;

  -- Insert into append-only audit_logs
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
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old_json,
    v_new_json,
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  );

  -- For enquiries, record lifecycle activity events for INSERT and standard UPDATE
  IF TG_TABLE_NAME = 'enquiries' THEN
    IF TG_OP = 'INSERT' THEN
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
        NEW.id,
        v_actor_id,
        v_actor_email,
        v_actor_role,
        'system_event',
        'Customer enquiry received via public portal.',
        pg_catalog.jsonb_build_object('source', 'public_submission', 'initial_status', NEW.status),
        pg_catalog.timezone('utc'::text, pg_catalog.now())
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF (NEW.status IS DISTINCT FROM OLD.status) AND NEW.status NOT IN ('rejection_requested', 'completion_requested', 'in_bin', 'returned_for_rework') THEN
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
          NEW.id,
          v_actor_id,
          v_actor_email,
          v_actor_role,
          'status_change',
          'Enquiry status updated from ' || OLD.status || ' to ' || NEW.status || '.',
          pg_catalog.jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
          pg_catalog.timezone('utc'::text, pg_catalog.now())
        );
      END IF;

      IF (NEW.admin_notes IS DISTINCT FROM OLD.admin_notes) AND NEW.admin_notes IS NOT NULL THEN
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
          NEW.id,
          v_actor_id,
          v_actor_email,
          v_actor_role,
          'note',
          'Internal note updated: ' || NEW.admin_notes,
          pg_catalog.jsonb_build_object('has_notes', true),
          pg_catalog.timezone('utc'::text, pg_catalog.now())
        );
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_audit_event() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. PUBLIC SUBMISSION SECURITY POLICIES & INSERT DEFAULTS TRIGGER
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anonymous can submit new enquiries" ON public.enquiries;
CREATE POLICY "Anonymous can submit new enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'new' AND
    admin_notes IS NULL AND
    is_archived = false AND
    archived_at IS NULL AND
    archived_by IS NULL AND
    rejection_reason IS NULL AND
    rejection_requested_by IS NULL AND
    rejection_requested_at IS NULL AND
    previous_status IS NULL AND
    completion_summary IS NULL AND
    completion_requested_by IS NULL AND
    completion_requested_at IS NULL AND
    completion_approved_by IS NULL AND
    completion_approved_at IS NULL AND
    completion_rework_reason IS NULL AND
    is_in_bin = false AND
    bin_entered_at IS NULL AND
    scheduled_deletion_at IS NULL
  );

DROP POLICY IF EXISTS "Authenticated can submit enquiries" ON public.enquiries;
CREATE POLICY "Authenticated can submit enquiries"
  ON public.enquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR
    (
      status = 'new' AND
      admin_notes IS NULL AND
      is_archived = false AND
      archived_at IS NULL AND
      archived_by IS NULL AND
      rejection_reason IS NULL AND
      rejection_requested_by IS NULL AND
      rejection_requested_at IS NULL AND
      previous_status IS NULL AND
      completion_summary IS NULL AND
      completion_requested_by IS NULL AND
      completion_requested_at IS NULL AND
      completion_approved_by IS NULL AND
      completion_approved_at IS NULL AND
      completion_rework_reason IS NULL AND
      is_in_bin = false AND
      bin_entered_at IS NULL AND
      scheduled_deletion_at IS NULL
    )
  );

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

    -- Reject any archive flags or workflow metadata
    IF NEW.is_archived IS TRUE OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot be created as archived.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.rejection_reason IS NOT NULL OR NEW.rejection_requested_by IS NOT NULL OR NEW.rejection_requested_at IS NOT NULL OR NEW.previous_status IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot supply rejection workflow fields.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Reject any completion or Bin workflow fields
    IF NEW.completion_summary IS NOT NULL OR NEW.completion_requested_by IS NOT NULL OR NEW.completion_requested_at IS NOT NULL OR
       NEW.completion_approved_by IS NOT NULL OR NEW.completion_approved_at IS NOT NULL OR NEW.completion_rework_reason IS NOT NULL OR
       NEW.is_in_bin IS TRUE OR NEW.bin_entered_at IS NOT NULL OR NEW.scheduled_deletion_at IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot supply completion or Bin workflow fields.'
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
-- 5. DEFENSE-IN-DEPTH: Harden purge_expired_bin_enquiries()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_bin_enquiries(
  p_retention_grace_seconds INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_now TIMESTAMPTZ;
  v_cutoff TIMESTAMPTZ;
  v_purged_ids UUID[];
  v_purged_count INT := 0;
BEGIN
  v_actor_id := auth.uid();
  -- If invoked via RPC by an authenticated user, verify superadmin role
  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role
    FROM public.admin_users
    WHERE id = v_actor_id AND is_active = true;

    IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Only superadministrators or server cron can execute Bin purge.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    -- When auth.uid() IS NULL (system cron / background task), verify caller is postgres or supabase_admin
    IF CURRENT_USER NOT IN ('postgres', 'supabase_admin') AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Unauthorized: Direct anonymous execution of Bin purge is forbidden.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());
  v_cutoff := v_now - (COALESCE(p_retention_grace_seconds, 0) || ' seconds')::INTERVAL;

  -- Lock and collect eligible expired enquiry IDs
  SELECT pg_catalog.array_agg(id) INTO v_purged_ids
  FROM (
    SELECT id
    FROM public.enquiries
    WHERE is_in_bin = true
      AND scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= v_cutoff
    FOR UPDATE SKIP LOCKED
  ) expired;

  IF v_purged_ids IS NOT NULL AND pg_catalog.array_length(v_purged_ids, 1) > 0 THEN
    -- Authorize cascaded activity history cleanup strictly for this transaction
    PERFORM pg_catalog.set_config('app.enquiry_purging', 'on', true);

    -- Delete the expired enquiries (audit trigger handles audit_log insertion with customer PII redacted)
    DELETE FROM public.enquiries
    WHERE id = ANY(v_purged_ids);

    GET DIAGNOSTICS v_purged_count = ROW_COUNT;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'purged_count', v_purged_count,
    'cutoff_timestamp', v_cutoff,
    'message', 'Purged ' || v_purged_count || ' expired enquiry records from Bin.'
  );
END;
$$;

-- Explicitly revoke execute privileges from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) TO authenticated;
