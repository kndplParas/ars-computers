-- ============================================================================
-- ARS Computers — Step 7: Head-Only Current-Month Fake/Spam Enquiry Removal
-- ============================================================================
-- Migration: 20261031000013_head_only_current_month_enquiry_removal.sql
--
-- Core Requirements:
-- 1. Head-Admin / Superadmin only authorization.
-- 2. Non-superadmin roles (Admin, Technical, Engineer, HR, Accounts, Inventory)
--    must never see, query, or execute soft-removal.
-- 3. Soft-removal only: never physically delete enquiry records.
-- 4. Mandatory category and reason (Spam, Fake enquiry, Duplicate enquiry,
--    Invalid contact details, Test enquiry, Other).
-- 5. Excluded from active enquiry queues, counts, daily and monthly reports.
-- 6. Audit history preservation: actor, timestamp, category, and reason.
-- 7. Current-month restriction: locked historical months can never be removed.
-- 8. Permanent record protection: completed and approved enquiries cannot be removed.
-- 9. PostgreSQL RLS & RPC level enforcement.
-- 10. Audit availability: Superadmin can inspect removed records.
-- ============================================================================

-- 1. Extend public.enquiries with soft-removal columns
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS removed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS removed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS removal_category TEXT,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_previous_status TEXT;

-- Index for high-performance exclusion from active queues
CREATE INDEX IF NOT EXISTS idx_enquiries_is_removed
  ON public.enquiries (is_removed)
  WHERE is_removed = true;

-- 2. Update enquiry_activities activity_type constraint to include 'removed' while preserving all existing activity types
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
    'bin_purged',
    'ENQUIRY_ASSIGNED',
    'ENQUIRY_REASSIGNED',
    'ENQUIRY_UNASSIGNED',
    'ENQUIRY_SELF_ASSIGNED',
    'STAFF_AADHAAR_UPDATED',
    'VISIT_SCHEDULED',
    'VISIT_NOTE_ADDED',
    'SERVICE_PROOF_UPLOADED',
    'SERVICE_PROOF_VOIDED',
    'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE',
    'ATTACHMENT_MARKED_INTERNAL',
    'removed'
  ));

-- 3. Update customer & archive immutability trigger to protect approved enquiries from removal
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
    -- Rule 8: Approved completed enquiries cannot be soft-removed
    IF NEW.is_removed = true AND (OLD.is_removed IS FALSE OR OLD.is_removed IS NULL) THEN
      RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.' USING ERRCODE = 'check_violation';
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

-- 4. Head-Only Current-Month Soft-Removal RPC
CREATE OR REPLACE FUNCTION public.remove_current_month_enquiry(
  p_enquiry_id UUID,
  p_category TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_clean_category TEXT;
  v_clean_reason TEXT;
  v_now_month TIMESTAMPTZ;
  v_enq_month TIMESTAMPTZ;
BEGIN
  -- 1. Authentication & Role Verification: Strictly Superadmin
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.email
  INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users au
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can remove fake, spam, or invalid enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Input validation
  IF p_enquiry_id IS NULL THEN
    RAISE EXCEPTION 'Validation error: Target enquiry ID is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_clean_category := LOWER(TRIM(COALESCE(p_category, '')));
  v_clean_reason := TRIM(COALESCE(p_reason, ''));

  -- Validate permitted category
  IF v_clean_category IN ('spam') THEN
    v_clean_category := 'spam';
  ELSIF v_clean_category IN ('fake enquiry', 'fake_enquiry', 'fake') THEN
    v_clean_category := 'fake_enquiry';
  ELSIF v_clean_category IN ('duplicate enquiry', 'duplicate_enquiry', 'duplicate') THEN
    v_clean_category := 'duplicate';
  ELSIF v_clean_category IN ('invalid contact details', 'invalid_contact', 'invalid contact', 'invalid_contact_details') THEN
    v_clean_category := 'invalid_contact';
  ELSIF v_clean_category IN ('test enquiry', 'test_enquiry', 'test') THEN
    v_clean_category := 'test_enquiry';
  ELSIF v_clean_category IN ('other') THEN
    v_clean_category := 'other';
  ELSE
    RAISE EXCEPTION 'Validation error: Removal category must be one of: Spam, Fake enquiry, Duplicate enquiry, Invalid contact details, Test enquiry, or Other.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF LENGTH(v_clean_reason) < 3 THEN
    RAISE EXCEPTION 'Validation error: Mandatory removal reason is required (minimum 3 characters).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_clean_category = 'other' AND (LENGTH(v_clean_reason) < 5 OR LOWER(v_clean_reason) IN ('other', 'others', 'n/a', 'none')) THEN
    RAISE EXCEPTION 'Validation error: Detailed explanation required for "Other" category (minimum 5 characters).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Fetch enquiry with row lock
  SELECT *
  INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Check if already removed
  IF v_enquiry.is_removed = true THEN
    RAISE EXCEPTION 'Conflict: Enquiry is already marked as removed.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Rule 8: Protection of completed & approved genuine enquiries
  IF v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed' THEN
    RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Rule 7: Current calendar month restriction & future-dated protection
  IF v_enquiry.created_at > v_now THEN
    RAISE EXCEPTION 'Validation error: Future-dated enquiries cannot be processed.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now_month := date_trunc('month', v_now AT TIME ZONE 'Asia/Kolkata');
  v_enq_month := date_trunc('month', v_enquiry.created_at AT TIME ZONE 'Asia/Kolkata');

  IF v_enq_month IS DISTINCT FROM v_now_month THEN
    RAISE EXCEPTION 'Historical lock violation: Only enquiries created in the current calendar month can be removed.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Execute soft-removal (Never physically delete!)
  UPDATE public.enquiries
  SET
    is_removed = true,
    removed_at = v_now,
    removed_by = v_actor_id,
    removed_by_name = COALESCE(v_actor_name, v_actor_email),
    removed_by_email = v_actor_email,
    removal_category = v_clean_category,
    removal_reason = v_clean_reason,
    removed_previous_status = v_enquiry.status,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- 8. Record audit activity
  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'removed',
    'Enquiry soft-removed as ' || v_clean_category || ': ' || v_clean_reason,
    jsonb_build_object(
      'action', 'soft_remove',
      'removal_category', v_clean_category,
      'removal_reason', v_clean_reason,
      'removed_by_id', v_actor_id,
      'removed_by_name', COALESCE(v_actor_name, v_actor_email),
      'removed_by_email', v_actor_email,
      'removed_at', v_now,
      'previous_status', v_enquiry.status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'is_removed', true,
    'removal_category', v_clean_category,
    'removal_reason', v_clean_reason,
    'removed_at', v_now,
    'message', 'Enquiry soft-removed successfully.'
  );
END;
$$;

-- 5. Head-Only Restore Soft-Removed Enquiry RPC
CREATE OR REPLACE FUNCTION public.restore_removed_enquiry(
  p_enquiry_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_target_status TEXT;
BEGIN
  -- Superadmin only
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.email
  INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users au
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can restore removed enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.is_removed IS NOT TRUE THEN
    RAISE EXCEPTION 'Conflict: Enquiry is not currently removed.' USING ERRCODE = 'check_violation';
  END IF;

  v_target_status := COALESCE(v_enquiry.removed_previous_status, 'new');

  UPDATE public.enquiries
  SET
    is_removed = false,
    removed_at = NULL,
    removed_by = NULL,
    removed_by_name = NULL,
    removed_by_email = NULL,
    removal_category = NULL,
    removal_reason = NULL,
    removed_previous_status = NULL,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'restored',
    'Enquiry restored from soft-removed status: ' || COALESCE(p_reason, 'Restored by Head Person'),
    jsonb_build_object(
      'action', 'restore_removed',
      'restored_by_id', v_actor_id,
      'restored_by_name', COALESCE(v_actor_name, v_actor_email),
      'restored_at', v_now,
      'restored_status', v_target_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'is_removed', false,
    'status', v_target_status,
    'message', 'Enquiry restored successfully.'
  );
END;
$$;

-- 6. RPC Grants & Security
REVOKE ALL ON FUNCTION public.remove_current_month_enquiry(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_current_month_enquiry(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_removed_enquiry(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_removed_enquiry(UUID, TEXT) TO authenticated;

-- 7. RLS Policy: Non-superadmin roles can never view soft-removed enquiries
DROP POLICY IF EXISTS "Admins can view enquiries" ON public.enquiries;
CREATE POLICY "Admins can view enquiries"
  ON public.enquiries
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin() OR (public.is_admin() AND (is_removed IS FALSE OR is_removed IS NULL))
  );

-- 8. Record in schema migrations
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261031000013', 'head_only_current_month_enquiry_removal')
ON CONFLICT (version) DO NOTHING;

