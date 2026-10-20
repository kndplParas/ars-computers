-- ============================================================================
-- ARS Computers — Step 9 (Phase 3): Employee Task Completion, Head-Person Approval,
--                                   Rework Workflow & Bin Lifecycle Management
-- Migration: 20261022000005_employee_task_completion_and_bin_workflow.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Extend public.enquiries with dedicated task completion and Bin lifecycle columns:
--    - completion_summary TEXT
--    - completion_requested_by UUID REFERENCES auth.users(id)
--    - completion_requested_at TIMESTAMPTZ
--    - completion_approved_by UUID REFERENCES auth.users(id)
--    - completion_approved_at TIMESTAMPTZ
--    - completion_rework_reason TEXT
--    - is_in_bin BOOLEAN NOT NULL DEFAULT false
--    - bin_entered_at TIMESTAMPTZ
--    - scheduled_deletion_at TIMESTAMPTZ
-- 2. Extend status check constraint:
--    'new', 'in_progress', 'quoted', 'converted', 'closed',
--    'rejection_requested', 'rejected',
--    'completion_requested', 'returned_for_rework', 'in_bin'
-- 3. Extend public.enquiry_activities activity_type constraint:
--    'system_event', 'note', 'status_change', 'rejection_requested', 'rejection_reviewed',
--    'archived', 'restored', 'completion_requested', 'completion_reviewed',
--    'bin_entered', 'bin_restored', 'bin_purged'
-- 4. Implement secure, transactional, atomic RPC functions with strict authorization:
--    - submit_enquiry_completion(enquiry_id, completion_summary) [Admin & Superadmin]
--    - review_enquiry_completion(enquiry_id, decision, review_notes, retention_days) [Superadmin Only]
--    - restore_enquiry_from_bin(enquiry_id) [Superadmin Only]
--    - purge_expired_bin_enquiries(retention_grace_seconds) [Superadmin / System Daemon]
-- 5. Harden existing update_enquiry_progress, request_enquiry_rejection, and customer immutability.
-- 6. Privacy-conscious audit logging for permanent deletions (redact customer PII).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS: public.enquiries
-- ----------------------------------------------------------------------------

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS completion_summary TEXT,
  ADD COLUMN IF NOT EXISTS completion_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_rework_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_in_bin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bin_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

-- Fast query indexes for Bin retention and completion workflow queues
CREATE INDEX IF NOT EXISTS idx_enquiries_bin_scheduled
  ON public.enquiries (is_in_bin, scheduled_deletion_at)
  WHERE is_in_bin = true;

CREATE INDEX IF NOT EXISTS idx_enquiries_completion_status
  ON public.enquiries (status, is_in_bin);

-- Update status check constraint on public.enquiries
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_enum;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_enum
  CHECK (status IN (
    'new',
    'in_progress',
    'quoted',
    'converted',
    'closed',
    'rejection_requested',
    'rejected',
    'completion_requested',
    'returned_for_rework',
    'in_bin'
  ));

-- Update activity_type check constraint on public.enquiry_activities
ALTER TABLE public.enquiry_activities DROP CONSTRAINT IF EXISTS enquiry_activities_activity_type_check;
ALTER TABLE public.enquiry_activities ADD CONSTRAINT enquiry_activities_activity_type_check
  CHECK (activity_type IN (
    'system_event',
    'note',
    'status_change',
    'rejection_requested',
    'rejection_reviewed',
    'archived',
    'restored',
    'completion_requested',
    'completion_reviewed',
    'bin_entered',
    'bin_restored',
    'bin_purged'
  ));

-- ----------------------------------------------------------------------------
-- 2. WORKFLOW RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2.1 FUNCTION: submit_enquiry_completion
-- Allows active employee or superadmin to submit work for head-person approval
-- Requires a meaningful completion summary (10 - 3000 chars)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_enquiry_completion(
  p_enquiry_id UUID,
  p_completion_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_enquiry RECORD;
  v_clean_summary TEXT;
  v_activity_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_summary := pg_catalog.btrim(p_completion_summary);
  IF v_clean_summary IS NULL OR pg_catalog.char_length(v_clean_summary) < 10 OR pg_catalog.char_length(v_clean_summary) > 3000 THEN
    RAISE EXCEPTION 'Validation error: A meaningful work-completion summary between 10 and 3000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock enquiry row for atomic update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Invalid operation: Cannot submit completion for an archived enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot submit completion for an enquiry currently in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'completion_requested' THEN
    RAISE EXCEPTION 'Conflict: A completion request is already pending review for this enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Conflict: Enquiry has a pending rejection review. Resolve rejection review before submitting completion.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('closed', 'converted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid state: Cannot submit completion for an enquiry that is already closed, converted, or rejected.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update enquiry atomically
  UPDATE public.enquiries
  SET
    previous_status = v_enquiry.status,
    status = 'completion_requested',
    completion_summary = v_clean_summary,
    completion_requested_by = v_actor_id,
    completion_requested_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
    completion_rework_reason = NULL,
    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
  WHERE id = p_enquiry_id;

  -- Record append-only activity history
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
    'completion_requested',
    v_clean_summary,
    pg_catalog.jsonb_build_object(
      'previous_status', v_enquiry.status,
      'completion_summary', v_clean_summary,
      'requested_by_email', v_actor_email
    ),
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completion_requested',
    'activity_id', v_activity_id,
    'message', 'Work-completion summary submitted for head-person review.'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.2 FUNCTION: review_enquiry_completion
-- Head-person (superadmin) ONLY decision to approve completion (move to Bin)
-- or return for rework (with mandatory reason).
-- Default retention: 7 days (configurable via p_retention_days parameter).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_enquiry_completion(
  p_enquiry_id UUID,
  p_decision TEXT,
  p_review_notes TEXT DEFAULT NULL,
  p_retention_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_enquiry RECORD;
  v_clean_notes TEXT;
  v_now TIMESTAMPTZ;
  v_retention_days INT;
  v_deletion_at TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  -- Strictly head person (superadmin)
  IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can review completion requests.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_decision NOT IN ('approved', 'returned_for_rework') THEN
    RAISE EXCEPTION 'Validation error: Decision must be either "approved" or "returned_for_rework".'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_notes := pg_catalog.btrim(p_review_notes);

  -- Validate configurable retention days
  v_retention_days := COALESCE(p_retention_days, 7);
  IF v_retention_days < 1 OR v_retention_days > 90 THEN
    RAISE EXCEPTION 'Validation error: Retention period must be between 1 and 90 days.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- If returning for rework, a mandatory reason is required (min 5 chars)
  IF p_decision = 'returned_for_rework' THEN
    IF v_clean_notes IS NULL OR pg_catalog.char_length(v_clean_notes) < 5 OR pg_catalog.char_length(v_clean_notes) > 1000 THEN
      RAISE EXCEPTION 'Validation error: A mandatory rework reason between 5 and 1000 characters is required when returning work.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- If approved, review notes are optional but capped at 1000 chars
    IF v_clean_notes IS NOT NULL AND pg_catalog.char_length(v_clean_notes) > 1000 THEN
      RAISE EXCEPTION 'Validation error: Review notes cannot exceed 1000 characters.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Lock enquiry row for atomic update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.status != 'completion_requested' THEN
    RAISE EXCEPTION 'Invalid state: Enquiry is not currently pending completion review.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  IF p_decision = 'approved' THEN
    v_deletion_at := v_now + (v_retention_days || ' days')::INTERVAL;

    -- Move enquiry to Bin
    UPDATE public.enquiries
    SET
      status = 'in_bin',
      is_in_bin = true,
      bin_entered_at = v_now,
      scheduled_deletion_at = v_deletion_at,
      completion_approved_by = v_actor_id,
      completion_approved_at = v_now,
      previous_status = COALESCE(v_enquiry.previous_status, 'in_progress'),
      updated_at = v_now
    WHERE id = p_enquiry_id;

    -- Record completion_reviewed activity
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
      'completion_reviewed',
      COALESCE(
        NULLIF(v_clean_notes, ''),
        'Work completion approved by head person. Moved to Bin with ' || v_retention_days || '-day retention.'
      ),
      pg_catalog.jsonb_build_object(
        'decision', 'approved',
        'reviewer_email', v_actor_email,
        'review_notes', v_clean_notes,
        'completion_summary', v_enquiry.completion_summary,
        'retention_days', v_retention_days,
        'scheduled_deletion_at', v_deletion_at
      ),
      v_now
    );

    -- Record bin_entered activity
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
      'bin_entered',
      'Enquiry moved to Bin. Scheduled for automatic deletion on ' || pg_catalog.to_char(v_deletion_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      pg_catalog.jsonb_build_object(
        'retention_days', v_retention_days,
        'bin_entered_at', v_now,
        'scheduled_deletion_at', v_deletion_at
      ),
      v_now
    );

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'decision', 'approved',
      'status', 'in_bin',
      'is_in_bin', true,
      'retention_days', v_retention_days,
      'scheduled_deletion_at', v_deletion_at,
      'message', 'Work approved successfully. Enquiry moved to Bin with ' || v_retention_days || '-day retention.'
    );
  ELSE
    -- Returned for rework: stays in Active Enquiries with status 'returned_for_rework'
    UPDATE public.enquiries
    SET
      status = 'returned_for_rework',
      completion_rework_reason = v_clean_notes,
      updated_at = v_now
    WHERE id = p_enquiry_id;

    -- Record completion_reviewed activity
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
      'completion_reviewed',
      'Task returned for rework: ' || v_clean_notes,
      pg_catalog.jsonb_build_object(
        'decision', 'returned_for_rework',
        'rework_reason', v_clean_notes,
        'reviewer_email', v_actor_email,
        'completion_summary', v_enquiry.completion_summary,
        'previous_status', v_enquiry.previous_status
      ),
      v_now
    );

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'decision', 'returned_for_rework',
      'status', 'returned_for_rework',
      'message', 'Task returned for rework. Rework reason recorded in immutable history.'
    );
  END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.3 FUNCTION: restore_enquiry_from_bin
-- Head-person (superadmin) ONLY decision to restore an enquiry from Bin
-- during the retention period.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_enquiry_from_bin(
  p_enquiry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_enquiry RECORD;
  v_target_status TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can restore enquiries from the Bin.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock enquiry row
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT v_enquiry.is_in_bin THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry is not currently in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  -- Determine restored operational status (revert to workable state)
  IF v_enquiry.previous_status IN ('new', 'in_progress', 'quoted') THEN
    v_target_status := v_enquiry.previous_status;
  ELSE
    v_target_status := 'in_progress';
  END IF;

  -- Restore enquiry from Bin
  UPDATE public.enquiries
  SET
    status = v_target_status,
    is_in_bin = false,
    bin_entered_at = NULL,
    scheduled_deletion_at = NULL,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- Record bin_restored activity
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
    'bin_restored',
    'Enquiry restored from Bin by head person to status "' || v_target_status || '".',
    pg_catalog.jsonb_build_object(
      'restored_by_email', v_actor_email,
      'restored_status', v_target_status,
      'previous_completion_summary', v_enquiry.completion_summary
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'is_in_bin', false,
    'status', v_target_status,
    'message', 'Enquiry successfully restored from Bin.'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.4 FUNCTION: purge_expired_bin_enquiries
-- Server-side scheduled cleanup function.
-- Permanently deletes enquiries whose scheduled_deletion_at <= now().
-- Idempotent, concurrency-safe (SKIP LOCKED), and blocks premature deletion.
-- Preserves audit_logs (with customer PII redacted).
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


-- ----------------------------------------------------------------------------
-- 2.5 FUNCTION: prevent_audit_log_tampering
-- Ensure audit_logs are 100% immutable and append-only.
-- Allow cascaded deletion of enquiry_activities strictly during an authorized Bin purge.
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


-- ----------------------------------------------------------------------------
-- 3. HARDENING EXISTING FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- 3.1 Update update_enquiry_progress to account for new workflow statuses
CREATE OR REPLACE FUNCTION public.update_enquiry_progress(
  p_enquiry_id UUID,
  p_next_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_enquiry RECORD;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator privileges required to update progress.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock enquiry row for update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Invalid operation: Cannot update progress of an archived enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot update progress of an enquiry in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'completion_requested' THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry has a pending completion review. Wait for head-person decision before changing progress.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry has a pending rejection review. Complete or cancel the review before changing progress.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Role-specific state transitions:
  IF v_actor_role = 'admin' THEN
    -- Admin employees are restricted to active operational stages
    IF p_next_status NOT IN ('new', 'in_progress', 'quoted') THEN
      RAISE EXCEPTION 'Unauthorized transition: Employees can only progress enquiries to "new", "in_progress", or "quoted".'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_enquiry.status IN ('closed', 'converted', 'rejected') THEN
      RAISE EXCEPTION 'Unauthorized transition: Employees cannot reopen completed or terminal enquiries.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    -- Superadmin can progress to any valid operational status
    IF p_next_status NOT IN ('new', 'in_progress', 'quoted', 'converted', 'closed', 'returned_for_rework') THEN
      RAISE EXCEPTION 'Invalid status specified: %', p_next_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_enquiry.status = p_next_status THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'status', p_next_status,
      'message', 'Status is already set to ' || p_next_status
    );
  END IF;

  -- Apply status change atomically
  UPDATE public.enquiries
  SET
    status = p_next_status,
    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
  WHERE id = p_enquiry_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'old_status', v_enquiry.status,
    'new_status', p_next_status,
    'message', 'Progress updated to ' || p_next_status
  );
END;
$$;


-- 3.2 Update request_enquiry_rejection to block if in Bin or pending completion
CREATE OR REPLACE FUNCTION public.request_enquiry_rejection(
  p_enquiry_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_enquiry RECORD;
  v_clean_reason TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(p_reason);
  IF v_clean_reason IS NULL OR pg_catalog.char_length(v_clean_reason) < 5 OR pg_catalog.char_length(v_clean_reason) > 1000 THEN
    RAISE EXCEPTION 'Validation error: A mandatory rejection reason between 5 and 1000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock enquiry row for update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Invalid operation: Cannot request rejection for an archived enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot request rejection for an enquiry in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Conflict: A rejection request is already pending review for this enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'completion_requested' THEN
    RAISE EXCEPTION 'Conflict: A completion request is already pending review for this enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Invalid state: Enquiry is already closed or rejected.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update enquiry to rejection_requested atomically
  UPDATE public.enquiries
  SET
    previous_status = v_enquiry.status,
    status = 'rejection_requested',
    rejection_reason = v_clean_reason,
    rejection_requested_by = v_actor_id,
    rejection_requested_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
  WHERE id = p_enquiry_id;

  -- Insert immutable rejection_requested activity record
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
    'rejection_requested',
    v_clean_reason,
    pg_catalog.jsonb_build_object(
      'previous_status', v_enquiry.status,
      'reason', v_clean_reason,
      'requested_by_email', v_actor_email
    ),
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'rejection_requested',
    'message', 'Rejection request submitted for head-person review.'
  );
END;
$$;


-- 3.3 Privacy-conscious audit logging: Redact customer PII on permanent DELETE
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


-- 3.4 Public Submission Policy Hardening: Reject any new completion/bin fields
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

-- 3.5 Defense-in-depth trigger: Enforce default status & reject notes/workflow data on INSERT for non-admins
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


-- ----------------------------------------------------------------------------
-- 4. FUNCTION PERMISSIONS & GRANTS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_enquiry_completion(UUID, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_enquiry_completion(UUID, TEXT, TEXT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_enquiry_from_bin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_enquiry_from_bin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.purge_expired_bin_enquiries(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) TO authenticated;
