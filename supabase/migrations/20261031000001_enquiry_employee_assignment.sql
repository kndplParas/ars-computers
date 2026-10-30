-- ============================================================================
-- ARS Computers — Migration: 20261031000001_enquiry_employee_assignment.sql
-- ============================================================================
-- PURPOSE:
-- 1. Extend public.admin_users with normalized phone_number for engineer dispatch.
-- 2. Extend public.enquiries with assigned_employee_* and assigned_by_* metadata.
-- 3. Extend public.enquiry_activities activity_type constraint for assignment events:
--    ENQUIRY_ASSIGNED, ENQUIRY_REASSIGNED, ENQUIRY_UNASSIGNED, ENQUIRY_SELF_ASSIGNED.
-- 4. public.self_assign_enquiry RPC: atomic, server-derived, concurrency-safe employee self-assignment.
-- 5. public.assign_enquiry_employee RPC: server-authoritative Head assignment, reassignment, unassignment.
-- 6. public.get_eligible_enquiry_assignees RPC: superadmin-only on-demand assignee directory.
-- 7. public.update_staff_phone RPC: superadmin-governed staff phone management.
-- 8. Strengthen public.protect_enquiry_customer_and_archive_immutability() trigger
--    protecting all 8 assignment attributes after completion approval.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND admin_users WITH phone_number
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS phone_number TEXT NULL;

-- Ensure phone numbers follow E.164 or common 10-15 digit phone formats if provided
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_phone_format;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_phone_format
  CHECK (
    phone_number IS NULL OR
    phone_number ~* '^\+?[0-9]{10,15}$'
  );

-- ----------------------------------------------------------------------------
-- 2. EXTEND enquiries WITH ASSIGNMENT METADATA
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_phone TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by_employee_code TEXT;

CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_employee_id
  ON public.enquiries(assigned_employee_id);

-- ----------------------------------------------------------------------------
-- 3. EXTEND enquiry_activities ACTIVITY TYPE CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_activities
  DROP CONSTRAINT IF EXISTS enquiry_activities_activity_type_check;

ALTER TABLE public.enquiry_activities
  ADD CONSTRAINT enquiry_activities_activity_type_check CHECK (
    activity_type IN (
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
      'ENQUIRY_SELF_ASSIGNED'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. RPC: public.self_assign_enquiry (ATOMIC EMPLOYEE SELF-ASSIGNMENT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.self_assign_enquiry(
  p_enquiry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_actor_phone TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_activity_id UUID;
BEGIN
  -- 1. Validate authenticated session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active employee identity (Admin only; inventory_staff and unauthenticated blocked)
  SELECT email, role, full_name, employee_code, phone_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or technician privileges required to self-assign enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock target enquiry row for atomic concurrency protection
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Enquiry % does not exist.', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Check concurrency: Must be strictly unassigned
  IF v_enquiry.assigned_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'This enquiry has already been assigned to another employee.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Lifecycle eligibility checks
  IF v_enquiry.is_archived OR v_enquiry.completion_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid operation: Cannot assign an archived or completed enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot assign an enquiry currently in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('completion_requested', 'rejection_requested') THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry assignment is frozen while a review is pending.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status NOT IN ('new', 'in_progress', 'quoted', 'returned_for_rework') THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry in status "%" is not eligible for assignment.', v_enquiry.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Apply assignment (Server-derived identity only; status is NOT modified)
  UPDATE public.enquiries
  SET
    assigned_employee_id = v_actor_id,
    assigned_employee_name = COALESCE(v_actor_name, v_actor_email),
    assigned_employee_code = v_actor_code,
    assigned_employee_phone = v_actor_phone,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- 7. Record immutable activity trail
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
    'ENQUIRY_SELF_ASSIGNED',
    COALESCE(v_actor_name, v_actor_email) || ' self-assigned enquiry ' || COALESCE(v_enquiry.enquiry_number, v_enquiry.id::text),
    pg_catalog.jsonb_build_object(
      'enquiry_number', v_enquiry.enquiry_number,
      'assigned_employee_id', v_actor_id,
      'assigned_employee_name', COALESCE(v_actor_name, v_actor_email),
      'assigned_employee_code', v_actor_code,
      'assigned_employee_phone', v_actor_phone,
      'assigned_at', v_now
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'enquiry_number', v_enquiry.enquiry_number,
    'assigned_employee_id', v_actor_id,
    'assigned_employee_name', COALESCE(v_actor_name, v_actor_email),
    'assigned_employee_code', v_actor_code,
    'assigned_employee_phone', v_actor_phone,
    'assigned_at', v_now,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC: public.assign_enquiry_employee (HEAD ASSIGN / REASSIGN / UNASSIGN)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_enquiry_employee(
  p_enquiry_id UUID,
  p_employee_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_target_email TEXT;
  v_target_role TEXT;
  v_target_name TEXT;
  v_target_code TEXT;
  v_target_phone TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_event_type TEXT;
  v_event_content TEXT;
  v_activity_id UUID;
  v_clean_reason TEXT := pg_catalog.btrim(p_reason);
BEGIN
  -- 1. Validate caller is authenticated Superadmin (Head of Store)
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Superadministrator privileges required to assign, reassign, or unassign staff.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Lock target enquiry row
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Enquiry % does not exist.', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 3. Lifecycle checks
  IF v_enquiry.is_archived OR v_enquiry.completion_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid operation: Completed and permanently archived enquiries cannot be reassigned.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Invalid operation: Cannot assign an enquiry currently in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('completion_requested', 'rejection_requested') THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry assignment is frozen while a review is pending.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status NOT IN ('new', 'in_progress', 'quoted', 'returned_for_rework') THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry in status "%" is not eligible for assignment.', v_enquiry.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Branch: UNASSIGNMENT (p_employee_id IS NULL)
  IF p_employee_id IS NULL THEN
    IF v_enquiry.assigned_employee_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'message', 'Enquiry is already unassigned.',
        'enquiry_id', p_enquiry_id
      );
    END IF;

    UPDATE public.enquiries
    SET
      assigned_employee_id = NULL,
      assigned_employee_name = NULL,
      assigned_employee_code = NULL,
      assigned_employee_phone = NULL,
      assigned_at = NULL,
      assigned_by = v_actor_id,
      assigned_by_name = COALESCE(v_actor_name, v_actor_email),
      assigned_by_employee_code = v_actor_code,
      updated_at = v_now
    WHERE id = p_enquiry_id;

    v_event_content := 'Enquiry unassigned by Head (previously assigned to ' ||
      COALESCE(v_enquiry.assigned_employee_name, 'Unknown') ||
      CASE WHEN v_enquiry.assigned_employee_code IS NOT NULL THEN ' [' || v_enquiry.assigned_employee_code || ']' ELSE '' END || ')';

    IF v_clean_reason IS NOT NULL AND v_clean_reason != '' THEN
      v_event_content := v_event_content || '. Reason: ' || v_clean_reason;
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
      'ENQUIRY_UNASSIGNED',
      v_event_content,
      pg_catalog.jsonb_build_object(
        'enquiry_number', v_enquiry.enquiry_number,
        'previous_employee_id', v_enquiry.assigned_employee_id,
        'previous_employee_name', v_enquiry.assigned_employee_name,
        'previous_employee_code', v_enquiry.assigned_employee_code,
        'unassigned_by_id', v_actor_id,
        'unassigned_by_name', COALESCE(v_actor_name, v_actor_email),
        'reason', v_clean_reason,
        'unassigned_at', v_now
      ),
      v_now
    ) RETURNING id INTO v_activity_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'action', 'unassigned',
      'enquiry_id', p_enquiry_id,
      'activity_id', v_activity_id
    );
  END IF;

  -- 5. Branch: ASSIGNMENT or REASSIGNMENT (p_employee_id IS NOT NULL)
  SELECT email, role, full_name, employee_code, phone_number
  INTO v_target_email, v_target_role, v_target_name, v_target_code, v_target_phone
  FROM public.admin_users
  WHERE id = p_employee_id AND is_active = true;

  IF NOT FOUND OR v_target_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Validation error: Target employee % is not an active staff member.', p_employee_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.assigned_employee_id = p_employee_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'message', 'Enquiry is already assigned to this employee.',
      'enquiry_id', p_enquiry_id,
      'assigned_employee_id', p_employee_id
    );
  END IF;

  IF v_enquiry.assigned_employee_id IS NULL THEN
    v_event_type := 'ENQUIRY_ASSIGNED';
    v_event_content := 'Assigned to ' || COALESCE(v_target_name, v_target_email) ||
      CASE WHEN v_target_code IS NOT NULL THEN ' [' || v_target_code || ']' ELSE '' END ||
      ' by Head (' || COALESCE(v_actor_name, v_actor_email) || ')';
  ELSE
    v_event_type := 'ENQUIRY_REASSIGNED';
    v_event_content := 'Reassigned from ' || COALESCE(v_enquiry.assigned_employee_name, 'Unknown') ||
      ' to ' || COALESCE(v_target_name, v_target_email) ||
      CASE WHEN v_target_code IS NOT NULL THEN ' [' || v_target_code || ']' ELSE '' END ||
      ' by Head (' || COALESCE(v_actor_name, v_actor_email) || ')';
  END IF;

  IF v_clean_reason IS NOT NULL AND v_clean_reason != '' THEN
    v_event_content := v_event_content || '. Reason: ' || v_clean_reason;
  END IF;

  -- Update assignment on enquiry (Status remains unchanged!)
  UPDATE public.enquiries
  SET
    assigned_employee_id = p_employee_id,
    assigned_employee_name = COALESCE(v_target_name, v_target_email),
    assigned_employee_code = v_target_code,
    assigned_employee_phone = v_target_phone,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
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
    v_event_type,
    v_event_content,
    pg_catalog.jsonb_build_object(
      'enquiry_number', v_enquiry.enquiry_number,
      'previous_employee_id', v_enquiry.assigned_employee_id,
      'previous_employee_name', v_enquiry.assigned_employee_name,
      'previous_employee_code', v_enquiry.assigned_employee_code,
      'new_employee_id', p_employee_id,
      'new_employee_name', COALESCE(v_target_name, v_target_email),
      'new_employee_code', v_target_code,
      'new_employee_phone', v_target_phone,
      'assigned_by_id', v_actor_id,
      'assigned_by_name', COALESCE(v_actor_name, v_actor_email),
      'reason', v_clean_reason,
      'assigned_at', v_now
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'action', v_event_type,
    'enquiry_id', p_enquiry_id,
    'assigned_employee_id', p_employee_id,
    'assigned_employee_name', COALESCE(v_target_name, v_target_email),
    'assigned_employee_code', v_target_code,
    'assigned_employee_phone', v_target_phone,
    'assigned_at', v_now,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. RPC: public.get_eligible_enquiry_assignees (SUPERADMIN ONLY DIRECTORY)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_eligible_enquiry_assignees()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  employee_code TEXT,
  phone_number TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role INTO v_actor_role
  FROM public.admin_users au
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can query the eligible enquiry assignees directory.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT au.id, au.full_name, au.employee_code, au.phone_number, au.role
  FROM public.admin_users au
  WHERE au.is_active = true
    AND au.role IN ('superadmin', 'admin')
  ORDER BY au.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_eligible_enquiry_assignees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_eligible_enquiry_assignees() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPC: public.update_staff_phone (HEAD-GOVERNED PHONE MANAGEMENT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_staff_phone(
  p_user_id UUID,
  p_phone_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_clean_phone TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role INTO v_actor_role
  FROM public.admin_users au
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can update staff phone numbers.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Clean and normalize phone number
  v_clean_phone := pg_catalog.btrim(p_phone_number);
  IF v_clean_phone = '' THEN
    v_clean_phone := NULL;
  END IF;

  IF v_clean_phone IS NOT NULL THEN
    -- Strip common punctuation (spaces, dashes, parens)
    v_clean_phone := pg_catalog.regexp_replace(v_clean_phone, '[\s\-\(\)]', '', 'g');
    IF v_clean_phone !~* '^\+?[0-9]{10,15}$' THEN
      RAISE EXCEPTION 'Validation error: Phone number must contain between 10 and 15 digits.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.admin_users
  SET
    phone_number = v_clean_phone,
    updated_at = clock_timestamp()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found.'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'phone_number', v_clean_phone,
    'message', 'Staff phone number updated successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_staff_phone(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_phone(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. REVISE protect_enquiry_customer_and_archive_immutability() TRIGGER
-- ----------------------------------------------------------------------------
-- Preserves ALL existing customer immutability checks and completed archive
-- protections, while explicitly protecting all 8 new assignment attributes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

    -- Strict Assignment Immutability on Completed Records
    IF NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id OR
       NEW.assigned_employee_name IS DISTINCT FROM OLD.assigned_employee_name OR
       NEW.assigned_employee_code IS DISTINCT FROM OLD.assigned_employee_code OR
       NEW.assigned_employee_phone IS DISTINCT FROM OLD.assigned_employee_phone OR
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

