-- ============================================================================
-- ARS Computers — Step 10: Permanent Archive, Server-Derived Accountability,
--                          Concurrency-Safe Enquiry Reference & Reporting
-- Migration: 20261028000001_permanent_archive_and_accountability.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Permanent Archive:
--    - Completed + Head-approved enquiries become permanent historical records.
--    - Remove 7-day Bin deletion for approved completed enquiries.
--    - Database-level rules (CHECK constraint & BEFORE DELETE trigger) guarantee
--      that approved enquiries cannot enter Bin or automatic deletion lifecycle.
--    - Existing Bin behavior for other workflow cases preserved without breakage.
-- 2. Server-Derived Employee Completion Identity:
--    - Securely records auth UUID, employee full_name snapshot, employee_code snapshot,
--      completion timestamp, and completion summary/remarks derived server-side.
-- 3. Server-Derived Head Approval Identity:
--    - Securely preserves Head auth UUID, Head full_name snapshot, Head employee_code snapshot,
--      approval timestamp, and approval remarks.
-- 4. Employee Code in public.admin_users:
--    - Business-readable code (e.g. ARS-HEAD-001, ARS-EMP-001).
--    - Authorization strictly from auth.uid() + role, NOT from employee_code.
--    - Nullable, safe for historical staff.
-- 5. Human-Readable Enquiry Number:
--    - Safe PostgreSQL sequence (public.enquiry_reference_seq).
--    - Atomic, collision-free, concurrency-safe (e.g. ARS-ENQ-01001).
--    - Real database primary key remains the UUID.
-- 6. Customer Data Protection & Permanent Archive Immutability:
--    - Protects customer data, enquiry_number, completion identity, and Head approval identity.
--    - Blocks reopening, altering approval timestamps, or deleting approved records.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND public.admin_users WITH BUSINESS-READABLE employee_code
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS employee_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_employee_code
  ON public.admin_users (employee_code)
  WHERE employee_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. CONCURRENCY-SAFE HUMAN-READABLE ENQUIRY NUMBER (POSTGRESQL SEQUENCE)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.enquiry_reference_seq
  START WITH 1001;

GRANT USAGE, SELECT ON SEQUENCE public.enquiry_reference_seq TO anon, authenticated;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS enquiry_number TEXT;

ALTER TABLE public.enquiries
  ALTER COLUMN enquiry_number
  SET DEFAULT ('ARS-ENQ-' || pg_catalog.lpad(pg_catalog.nextval('public.enquiry_reference_seq')::text, 5, '0'));

-- Safe backfill for historical rows without enquiry_number
UPDATE public.enquiries
SET enquiry_number = ('ARS-ENQ-' || pg_catalog.lpad(pg_catalog.nextval('public.enquiry_reference_seq')::text, 5, '0'))
WHERE enquiry_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enquiries_enquiry_number
  ON public.enquiries (enquiry_number)
  WHERE enquiry_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. EXTEND public.enquiries WITH AUDIT SNAPSHOT COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS completed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS completed_by_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS approval_remarks TEXT;

-- ----------------------------------------------------------------------------
-- 4. EXTEND STATUS CONSTRAINT WITH 'completed'
-- ----------------------------------------------------------------------------
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
    'in_bin',
    'completed'
  ));

-- ----------------------------------------------------------------------------
-- 5. HISTORICAL TRANSITION: MIGRATE APPROVED LEGACY BIN RECORDS TO PERMANENT ARCHIVE
-- ----------------------------------------------------------------------------
-- Existing Head-approved enquiries from Phase 1 entered the 7-day Bin lifecycle.
-- Transition them safely into the permanent archive before enforcing the anti-bin check constraint.
UPDATE public.enquiries
SET
  is_in_bin = false,
  scheduled_deletion_at = NULL,
  is_archived = true,
  status = 'completed'
WHERE completion_approved_at IS NOT NULL
  AND (
    is_in_bin = true
    OR scheduled_deletion_at IS NOT NULL
    OR status = 'in_bin'
  );

-- ----------------------------------------------------------------------------
-- 6. DATABASE-LEVEL RULES: PERMANENT ARCHIVE PROTECTION
-- ----------------------------------------------------------------------------
-- A. CHECK constraint: approved enquiry CANNOT enter Bin or have scheduled deletion
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS chk_enquiries_approved_not_in_bin;
ALTER TABLE public.enquiries ADD CONSTRAINT chk_enquiries_approved_not_in_bin
  CHECK (NOT (completion_approved_at IS NOT NULL AND (is_in_bin = true OR scheduled_deletion_at IS NOT NULL)));

-- B. BEFORE DELETE TRIGGER: Block deletion of Head-approved enquiries
CREATE OR REPLACE FUNCTION public.trg_prevent_approved_enquiry_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.completion_approved_at IS NOT NULL OR (OLD.is_archived = true AND OLD.status = 'completed') THEN
    RAISE EXCEPTION 'Permanent archive protection: Completed and Head-approved enquiries cannot be deleted.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_approved_enquiry_deletion ON public.enquiries;
CREATE TRIGGER trg_protect_approved_enquiry_deletion
  BEFORE DELETE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_approved_enquiry_deletion();

-- C. BEFORE UPDATE TRIGGER: Protect customer immutability and archive immutability
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_enquiry_customer_immutability ON public.enquiries;
CREATE TRIGGER trg_protect_enquiry_customer_immutability
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_enquiry_customer_and_archive_immutability();

-- ----------------------------------------------------------------------------
-- 6. WORKFLOW RPC: submit_enquiry_completion
-- Server-side identity: auth.uid(), full_name snapshot, employee_code snapshot.
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
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_enquiry RECORD;
  v_clean_summary TEXT;
  v_activity_id UUID;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
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

  IF v_enquiry.status IN ('closed', 'converted', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Invalid state: Cannot submit completion for an enquiry that is already finalized.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  -- Update enquiry atomically with server-derived identity
  UPDATE public.enquiries
  SET
    previous_status = v_enquiry.status,
    status = 'completion_requested',
    completion_summary = v_clean_summary,
    completion_requested_by = v_actor_id,
    completion_requested_at = v_now,
    completed_by_name = COALESCE(v_actor_name, v_actor_email),
    completed_by_employee_code = v_actor_code,
    completion_rework_reason = NULL,
    updated_at = v_now
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
      'requested_by_email', v_actor_email,
      'requested_by_name', COALESCE(v_actor_name, v_actor_email),
      'employee_code', v_actor_code
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completion_requested',
    'activity_id', v_activity_id,
    'completed_by_name', COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code,
    'message', 'Work-completion summary submitted for head-person review.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. WORKFLOW RPC: review_enquiry_completion
-- Head-person (superadmin) approval PERMANENTLY archives the enquiry.
-- NO 7-day Bin lifecycle. Preserves Head identity & snapshot.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_enquiry_completion(
  p_enquiry_id UUID,
  p_decision TEXT,
  p_review_notes TEXT DEFAULT NULL,
  p_retention_days INT DEFAULT NULL
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
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_enquiry RECORD;
  v_clean_notes TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
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

  -- Defend against self-approval if an admin tries to promote themselves or bypass rules
  IF v_enquiry.completion_requested_by = v_actor_id AND v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized: Employees cannot approve their own work submission.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  IF p_decision = 'approved' THEN
    -- PERMANENT ARCHIVE:
    -- Moves to permanent historical archive.
    -- status = 'completed', is_archived = true, scheduled_deletion_at = NULL, is_in_bin = false.
    UPDATE public.enquiries
    SET
      status = 'completed',
      is_archived = true,
      archived_at = v_now,
      archived_by = v_actor_id,
      is_in_bin = false,
      bin_entered_at = NULL,
      scheduled_deletion_at = NULL,
      completion_approved_by = v_actor_id,
      completion_approved_at = v_now,
      approved_by_name = COALESCE(v_actor_name, v_actor_email),
      approved_by_employee_code = v_actor_code,
      approval_remarks = v_clean_notes,
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
        'Work completion approved by Head Person. Record permanently archived.'
      ),
      pg_catalog.jsonb_build_object(
        'decision', 'approved',
        'reviewer_email', v_actor_email,
        'reviewer_name', COALESCE(v_actor_name, v_actor_email),
        'reviewer_employee_code', v_actor_code,
        'review_notes', v_clean_notes,
        'completion_summary', v_enquiry.completion_summary,
        'completed_by_name', v_enquiry.completed_by_name,
        'completed_by_employee_code', v_enquiry.completed_by_employee_code,
        'is_permanent_archive', true
      ),
      v_now
    );

    -- Record permanent archive event in enquiry_activities
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
      'archived',
      'Enquiry permanently archived following Head-Person completion approval.',
      pg_catalog.jsonb_build_object(
        'archived_by_email', v_actor_email,
        'archived_by_name', COALESCE(v_actor_name, v_actor_email),
        'archived_at', v_now,
        'final_status', 'completed'
      ),
      v_now
    );

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'decision', 'approved',
      'status', 'completed',
      'is_archived', true,
      'is_in_bin', false,
      'completion_approved_at', v_now,
      'approved_by_name', COALESCE(v_actor_name, v_actor_email),
      'approved_by_employee_code', v_actor_code,
      'message', 'Work approved successfully. Enquiry permanently archived.'
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
        'reviewer_name', COALESCE(v_actor_name, v_actor_email),
        'reviewer_employee_code', v_actor_code,
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
-- 8. RESTORE ENQUIRY HARDENING
-- Permanent archive records (Head-approved) cannot be silently unarchived.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_enquiry(
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
  v_now TIMESTAMPTZ;
  v_target_status TEXT;
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
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can restore enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Conflict: Enquiry is not currently archived.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block unarchiving of permanently approved completed records
  IF v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed' THEN
    RAISE EXCEPTION 'Permanent archive protection: Head-approved completed enquiries cannot be unarchived or reopened.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.enquiries
  SET
    is_archived = false,
    archived_at = NULL,
    archived_by = NULL,
    updated_at = v_now
  WHERE id = p_enquiry_id;

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
    'restored',
    'Enquiry restored from archive by head person.',
    pg_catalog.jsonb_build_object(
      'restored_by_email', v_actor_email,
      'status', v_enquiry.status
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'is_archived', false,
    'status', v_enquiry.status,
    'message', 'Enquiry restored successfully.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. PURGE RPC HARDENING
-- Approved completed enquiries are strictly excluded and can NEVER be purged.
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
  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role
    FROM public.admin_users
    WHERE id = v_actor_id AND is_active = true;

    IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Only superadministrators or server cron can execute Bin purge.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF pg_catalog.current_user NOT IN ('postgres', 'supabase_admin') AND
       pg_catalog.session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Unauthorized: Scheduled Bin purge invocation requires postgres or supabase_admin system privileges.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());
  v_cutoff := v_now - (COALESCE(p_retention_grace_seconds, 0) || ' seconds')::INTERVAL;

  -- Lock and collect eligible expired enquiry IDs
  -- STRICT EXCLUSION: completion_approved_at MUST BE NULL and status != 'completed'
  SELECT pg_catalog.array_agg(id) INTO v_purged_ids
  FROM (
    SELECT id
    FROM public.enquiries
    WHERE is_in_bin = true
      AND scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= v_cutoff
      AND completion_approved_at IS NULL
      AND status != 'completed'
    FOR UPDATE SKIP LOCKED
  ) expired;

  IF v_purged_ids IS NOT NULL AND pg_catalog.array_length(v_purged_ids, 1) > 0 THEN
    PERFORM pg_catalog.set_config('app.enquiry_purging', 'on', true);

    DELETE FROM public.enquiries
    WHERE id = ANY(v_purged_ids)
      AND completion_approved_at IS NULL
      AND status != 'completed';

    GET DIAGNOSTICS v_purged_count = ROW_COUNT;

    PERFORM pg_catalog.set_config('app.enquiry_purging', 'off', true);
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'purged_count', v_purged_count,
    'cutoff_timestamp', v_cutoff,
    'message', 'Expired Bin cleanup executed safely. ' || v_purged_count || ' item(s) permanently purged.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. RPC EXECUTION PERMISSIONS
-- Revoke from PUBLIC/anon, grant strictly to authenticated
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_enquiry_completion(UUID, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_enquiry_completion(UUID, TEXT, TEXT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_enquiry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_enquiry(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.purge_expired_bin_enquiries(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) TO authenticated;
