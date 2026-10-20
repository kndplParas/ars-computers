-- ============================================================================
-- ARS Computers — Step 8 (Phase 2): Enquiry Workflow & Head-Person Approval
-- Migration: 20261022000004_enquiry_workflow_and_approvals.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Extend public.enquiries with dedicated archive and rejection workflow columns.
-- 2. Extend status check constraint to include 'rejection_requested' and 'rejected'.
-- 3. Implement secure, transactional, atomic RPC functions with strict authorization:
--    - add_enquiry_note(enquiry_id, content) [Admin & Superadmin]
--    - update_enquiry_progress(enquiry_id, next_status) [Admin & Superadmin]
--    - request_enquiry_rejection(enquiry_id, reason) [Admin & Superadmin]
--    - review_enquiry_rejection(enquiry_id, decision, review_notes) [Superadmin Only]
--    - archive_enquiry(enquiry_id) [Superadmin Only]
--    - restore_enquiry(enquiry_id) [Superadmin Only]
-- 4. Preserve existing rows, audit triggers, customer immutability, and least privilege.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS: public.enquiries
-- ----------------------------------------------------------------------------

-- A. Add workflow and archive columns safely with idempotent defaults
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- B. Indexes for fast tab/filter queries
CREATE INDEX IF NOT EXISTS idx_enquiries_archived
  ON public.enquiries (is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enquiries_status_archived
  ON public.enquiries (status, is_archived);

-- C. Update status enum constraint to include workflow states
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_enum;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_enum
  CHECK (status IN (
    'new',
    'in_progress',
    'quoted',
    'converted',
    'closed',
    'rejection_requested',
    'rejected'
  ));

-- ----------------------------------------------------------------------------
-- 2. SECURE WORKFLOW RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2.1 FUNCTION: add_enquiry_note
-- Allows active staff (admin/superadmin) to append a timestamped follow-up note.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_enquiry_note(
  p_enquiry_id UUID,
  p_content TEXT
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
  v_activity_id UUID;
  v_clean_content TEXT;
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
    RAISE EXCEPTION 'Unauthorized: Active administrator privileges required to add enquiry notes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_content := pg_catalog.btrim(p_content);
  IF v_clean_content IS NULL OR pg_catalog.char_length(v_clean_content) < 2 OR pg_catalog.char_length(v_clean_content) > 3000 THEN
    RAISE EXCEPTION 'Validation error: Follow-up note content must be between 2 and 3000 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Ensure enquiry exists
  IF NOT EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_enquiry_id) THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Insert immutable activity record
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
    v_clean_content,
    pg_catalog.jsonb_build_object('source', 'internal_portal'),
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  ) RETURNING id INTO v_activity_id;

  -- Bump updated_at on enquiry
  UPDATE public.enquiries
  SET updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
  WHERE id = p_enquiry_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'message', 'Follow-up note recorded successfully.'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.2 FUNCTION: update_enquiry_progress
-- Allows active staff to update operational progress subject to transition rules.
-- ----------------------------------------------------------------------------
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
    -- Superadmin can progress to any valid status
    IF p_next_status NOT IN ('new', 'in_progress', 'quoted', 'converted', 'closed') THEN
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


-- ----------------------------------------------------------------------------
-- 2.3 FUNCTION: request_enquiry_rejection
-- Submits a rejection request with a mandatory reason for head-person approval.
-- ----------------------------------------------------------------------------
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

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Conflict: A rejection request is already pending review for this enquiry.'
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


-- ----------------------------------------------------------------------------
-- 2.4 FUNCTION: review_enquiry_rejection
-- Head-person (superadmin) ONLY decision to approve or deny a rejection request.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_enquiry_rejection(
  p_enquiry_id UUID,
  p_decision TEXT,
  p_review_notes TEXT DEFAULT NULL
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

  -- Strictly head person (superadmin)
  IF v_actor_role != 'superadmin' OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can review rejection requests.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_decision NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Validation error: Decision must be either "approved" or "denied".'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_notes := pg_catalog.btrim(p_review_notes);
  IF v_clean_notes IS NOT NULL AND pg_catalog.char_length(v_clean_notes) > 1000 THEN
    RAISE EXCEPTION 'Validation error: Review notes cannot exceed 1000 characters.'
      USING ERRCODE = 'check_violation';
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

  IF v_enquiry.status != 'rejection_requested' THEN
    RAISE EXCEPTION 'Invalid state: Enquiry is not currently pending rejection review.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_decision = 'approved' THEN
    v_target_status := 'rejected';

    UPDATE public.enquiries
    SET
      status = 'rejected',
      updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = p_enquiry_id;
  ELSE
    -- Denied: revert to previous status (fallback to 'in_progress')
    v_target_status := COALESCE(v_enquiry.previous_status, 'in_progress');

    UPDATE public.enquiries
    SET
      status = v_target_status,
      rejection_reason = NULL,
      rejection_requested_by = NULL,
      rejection_requested_at = NULL,
      updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = p_enquiry_id;
  END IF;

  -- Record rejection_reviewed activity
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
    'rejection_reviewed',
    COALESCE(
      NULLIF(v_clean_notes, ''),
      'Rejection request ' || p_decision || ' by head person.'
    ),
    pg_catalog.jsonb_build_object(
      'decision', p_decision,
      'original_reason', v_enquiry.rejection_reason,
      'previous_status', v_enquiry.previous_status,
      'resulting_status', v_target_status,
      'reviewer_email', v_actor_email,
      'review_notes', v_clean_notes,
      'rejection_requested_by', v_enquiry.rejection_requested_by,
      'rejection_requested_at', v_enquiry.rejection_requested_at
    ),
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'decision', p_decision,
    'new_status', v_target_status,
    'message', 'Rejection request ' || p_decision || ' successfully.'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.5 FUNCTION: archive_enquiry
-- Head-person (superadmin) ONLY: Archives an enquiry without erasing status.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_enquiry(
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
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can archive enquiries.'
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

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Conflict: Enquiry is already archived.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot archive an enquiry with a pending rejection review.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.enquiries
  SET
    is_archived = true,
    archived_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
    archived_by = v_actor_id,
    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
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
    'archived',
    'Enquiry moved to archive by head person.',
    pg_catalog.jsonb_build_object(
      'archived_by_email', v_actor_email,
      'status_at_archive', v_enquiry.status
    ),
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'is_archived', true,
    'message', 'Enquiry archived successfully.'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.6 FUNCTION: restore_enquiry
-- Head-person (superadmin) ONLY: Restores an archived enquiry.
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

  UPDATE public.enquiries
  SET
    is_archived = false,
    archived_at = NULL,
    archived_by = NULL,
    updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
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
    pg_catalog.timezone('utc'::text, pg_catalog.now())
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
-- 3. FUNCTION PERMISSIONS & GRANTS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.add_enquiry_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_enquiry_note(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_enquiry_progress(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_enquiry_progress(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_enquiry_rejection(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_enquiry_rejection(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.review_enquiry_rejection(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_enquiry_rejection(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_enquiry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_enquiry(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_enquiry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_enquiry(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. HARDENED PUBLIC SUBMISSION POLICIES & INSERT TRIGGER (Safeguard 5)
-- ----------------------------------------------------------------------------

-- A. Dedicated policy for anonymous customer submissions:
-- Strictly limited to status = 'new', admin_notes IS NULL, is_archived = false, and no workflow fields
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
    previous_status IS NULL
  );

-- B. Authenticated submissions policy:
-- Allows active staff full flexibility, while constraining non-admin authenticated users
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
      previous_status IS NULL
    )
  );

-- C. Defense-in-depth trigger: Enforce default status & reject notes/workflow data on INSERT for non-admins
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
  END IF;

  RETURN NEW;
END;
$$;
