-- ============================================================================
-- ARS Computers — Migration: 20261031000002_staff_profile_aadhaar_and_visit_timeline.sql
-- ============================================================================
-- PURPOSE:
-- 1. Extend public.admin_users with normalized aadhaar_number (12 digits, Head-controlled).
-- 2. Extend public.enquiries with:
--    - assigned_employee_aadhaar (snapshot of engineer Aadhaar at time of assignment)
--    - expected_visit_at (TIMESTAMPTZ for scheduled engineer arrival/visit)
--    - assignment_visit_note (operational notes/instructions for engineer visit)
-- 3. public.update_staff_profile RPC:
--    Superadmin-only atomic RPC to manage official staff details (name, code, phone,
--    Aadhaar, role, active status) without touching Auth passwords or credentials.
-- 4. Update public.assign_enquiry_employee RPC:
--    Extend Head assignment/reassignment/unassignment with expected visit date/time and visit notes.
-- 5. Update public.self_assign_enquiry RPC:
--    Extend employee self-assignment with expected visit date/time and visit notes,
--    while deriving all official employee identity attributes server-side.
-- 6. Update public.protect_enquiry_customer_and_archive_immutability() trigger:
--    Protect assigned_employee_aadhaar, expected_visit_at, and assignment_visit_note
--    from post-approval mutation on completed/archived records.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND admin_users WITH aadhaar_number
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS aadhaar_number TEXT NULL;

-- Strict 12-digit numeric constraint if provided
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_aadhaar_format;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_aadhaar_format
  CHECK (
    aadhaar_number IS NULL OR
    aadhaar_number ~ '^[0-9]{12}$'
  );

-- Uniqueness constraint across staff members when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_aadhaar_number
  ON public.admin_users (aadhaar_number)
  WHERE aadhaar_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. EXTEND enquiries WITH VISIT TIMELINE AND AADHAAR SNAPSHOT
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS assigned_employee_aadhaar TEXT NULL,
  ADD COLUMN IF NOT EXISTS expected_visit_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS assignment_visit_note TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_expected_visit_at
  ON public.enquiries (expected_visit_at)
  WHERE expected_visit_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. RPC: public.update_staff_profile (SUPERADMIN ONLY STAFF PROFILE GOVERNANCE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_staff_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_employee_code TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_aadhaar_number TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_target RECORD;
  v_clean_name TEXT;
  v_clean_code TEXT;
  v_clean_phone TEXT;
  v_clean_aadhaar TEXT;
  v_clean_role TEXT;
  v_clean_active BOOLEAN;
  v_superadmin_count INTEGER;
BEGIN
  -- 1. Validate caller is authenticated
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validate caller is an active Superadministrator (Head of Store)
  SELECT role INTO v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Superadministrator privileges required to manage staff profiles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Verify target employee exists
  SELECT * INTO v_target
  FROM public.admin_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Validate full_name (2 to 100 chars)
  v_clean_name := pg_catalog.btrim(p_full_name);
  IF v_clean_name IS NULL OR char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'Validation error: Full name must be between 2 and 100 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Validate employee_code (optional, 2 to 50 chars, unique)
  v_clean_code := pg_catalog.btrim(p_employee_code);
  IF v_clean_code = '' THEN
    v_clean_code := NULL;
  END IF;

  IF v_clean_code IS NOT NULL THEN
    IF char_length(v_clean_code) < 2 OR char_length(v_clean_code) > 50 THEN
      RAISE EXCEPTION 'Validation error: Employee code must be between 2 and 50 characters.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE employee_code = v_clean_code AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Validation error: Employee code "%" is already in use by another staff member.', v_clean_code
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- 6. Validate phone_number (optional, normalized 10 to 15 digits)
  v_clean_phone := pg_catalog.btrim(p_phone_number);
  IF v_clean_phone = '' THEN
    v_clean_phone := NULL;
  END IF;

  IF v_clean_phone IS NOT NULL THEN
    v_clean_phone := pg_catalog.regexp_replace(v_clean_phone, '[\s\-\(\)]', '', 'g');
    IF v_clean_phone !~* '^\+?[0-9]{10,15}$' THEN
      RAISE EXCEPTION 'Validation error: Phone number must contain between 10 and 15 digits.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 7. Validate aadhaar_number (optional, exactly 12 numeric digits, unique)
  v_clean_aadhaar := pg_catalog.btrim(p_aadhaar_number);
  IF v_clean_aadhaar = '' THEN
    v_clean_aadhaar := NULL;
  END IF;

  IF v_clean_aadhaar IS NOT NULL THEN
    v_clean_aadhaar := pg_catalog.regexp_replace(v_clean_aadhaar, '[\s\-]', '', 'g');
    IF v_clean_aadhaar !~ '^[0-9]{12}$' THEN
      RAISE EXCEPTION 'Validation error: Aadhaar number must be exactly 12 numeric digits.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE aadhaar_number = v_clean_aadhaar AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Validation error: Aadhaar number is already registered to another staff member.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- 8. Validate role
  IF p_role IS NOT NULL THEN
    v_clean_role := pg_catalog.btrim(p_role);
    IF v_clean_role NOT IN ('superadmin', 'admin', 'inventory_staff') THEN
      RAISE EXCEPTION 'Validation error: Invalid role "%". Permitted roles are superadmin, admin, or inventory_staff.', v_clean_role
        USING ERRCODE = 'check_violation';
    END IF;

    -- Safety check: Caller cannot demote self
    IF p_user_id = v_actor_id AND v_clean_role <> 'superadmin' THEN
      RAISE EXCEPTION 'Safety check failed: You cannot demote your own superadministrator role.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_clean_role := v_target.role;
  END IF;

  -- 9. Validate is_active
  IF p_is_active IS NOT NULL THEN
    -- Safety check: Caller cannot deactivate self
    IF p_user_id = v_actor_id AND p_is_active = false THEN
      RAISE EXCEPTION 'Safety check failed: You cannot deactivate your own superadministrator account.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Safety check: Cannot deactivate last superadmin
    IF v_target.role = 'superadmin' AND p_is_active = false THEN
      SELECT count(*) INTO v_superadmin_count
      FROM public.admin_users
      WHERE role = 'superadmin' AND is_active = true AND id <> p_user_id;

      IF v_superadmin_count < 1 THEN
        RAISE EXCEPTION 'Safety check failed: Cannot deactivate the last remaining active superadministrator.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    v_clean_active := p_is_active;
  ELSE
    v_clean_active := v_target.is_active;
  END IF;

  -- 10. Update admin_users directory (Auth credentials remain untouched)
  UPDATE public.admin_users
  SET
    full_name = v_clean_name,
    employee_code = v_clean_code,
    phone_number = v_clean_phone,
    aadhaar_number = v_clean_aadhaar,
    role = v_clean_role,
    is_active = v_clean_active,
    updated_at = clock_timestamp()
  WHERE id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'full_name', v_clean_name,
    'employee_code', v_clean_code,
    'phone_number', v_clean_phone,
    'aadhaar_number', v_clean_aadhaar,
    'role', v_clean_role,
    'is_active', v_clean_active,
    'message', 'Staff profile updated successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_staff_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. UPDATE public.assign_enquiry_employee (HEAD ASSIGN WITH VISIT & AADHAAR SNAPSHOT)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assign_enquiry_employee(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.assign_enquiry_employee(
  p_enquiry_id UUID,
  p_employee_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expected_visit_at TIMESTAMPTZ DEFAULT NULL,
  p_visit_note TEXT DEFAULT NULL
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
  v_target_aadhaar TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_event_type TEXT;
  v_event_content TEXT;
  v_activity_id UUID;
  v_clean_reason TEXT := pg_catalog.btrim(p_reason);
  v_clean_visit_note TEXT := pg_catalog.btrim(p_visit_note);
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
      assigned_employee_aadhaar = NULL,
      assigned_at = NULL,
      expected_visit_at = NULL,
      assignment_visit_note = NULL,
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
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_target_email, v_target_role, v_target_name, v_target_code, v_target_phone, v_target_aadhaar
  FROM public.admin_users
  WHERE id = p_employee_id AND is_active = true;

  IF NOT FOUND OR v_target_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Validation error: Target employee % is not an active staff member.', p_employee_id
      USING ERRCODE = 'check_violation';
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

  IF p_expected_visit_at IS NOT NULL THEN
    v_event_content := v_event_content || ' (Expected Visit: ' || to_char(p_expected_visit_at, 'YYYY-MM-DD HH24:MI') || ')';
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
    assigned_employee_aadhaar = v_target_aadhaar,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
    expected_visit_at = p_expected_visit_at,
    assignment_visit_note = v_clean_visit_note,
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
      'expected_visit_at', p_expected_visit_at,
      'visit_note', v_clean_visit_note,
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
    'assigned_employee_aadhaar', v_target_aadhaar,
    'assigned_at', v_now,
    'expected_visit_at', p_expected_visit_at,
    'assignment_visit_note', v_clean_visit_note,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. UPDATE public.self_assign_enquiry (SELF-ASSIGN WITH VISIT & AADHAAR SNAPSHOT)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.self_assign_enquiry(UUID);
DROP FUNCTION IF EXISTS public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.self_assign_enquiry(
  p_enquiry_id UUID,
  p_expected_visit_at TIMESTAMPTZ DEFAULT NULL,
  p_visit_note TEXT DEFAULT NULL
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
  v_actor_aadhaar TEXT;
  v_enquiry RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_activity_id UUID;
  v_clean_visit_note TEXT := pg_catalog.btrim(p_visit_note);
  v_content TEXT;
BEGIN
  -- 1. Validate authenticated session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active employee identity (Admin only; inventory_staff and unauthenticated blocked)
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
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
    assigned_employee_aadhaar = v_actor_aadhaar,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
    expected_visit_at = p_expected_visit_at,
    assignment_visit_note = v_clean_visit_note,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  v_content := COALESCE(v_actor_name, v_actor_email) || ' self-assigned enquiry ' || COALESCE(v_enquiry.enquiry_number, v_enquiry.id::text);
  IF p_expected_visit_at IS NOT NULL THEN
    v_content := v_content || ' (Expected Visit: ' || to_char(p_expected_visit_at, 'YYYY-MM-DD HH24:MI') || ')';
  END IF;

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
    v_content,
    pg_catalog.jsonb_build_object(
      'enquiry_number', v_enquiry.enquiry_number,
      'assigned_employee_id', v_actor_id,
      'assigned_employee_name', COALESCE(v_actor_name, v_actor_email),
      'assigned_employee_code', v_actor_code,
      'assigned_employee_phone', v_actor_phone,
      'expected_visit_at', p_expected_visit_at,
      'visit_note', v_clean_visit_note,
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
    'assigned_employee_aadhaar', v_actor_aadhaar,
    'assigned_at', v_now,
    'expected_visit_at', p_expected_visit_at,
    'assignment_visit_note', v_clean_visit_note,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. REVISE protect_enquiry_customer_and_archive_immutability() TRIGGER
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
       NEW.assigned_employee_aadhaar IS DISTINCT FROM OLD.assigned_employee_aadhaar OR
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

