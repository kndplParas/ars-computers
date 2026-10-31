-- Migration: 20261031000011_add_account_role_and_arrival_duration.sql
-- Description:
-- 1. Adds 'account' role to public.admin_users for finance and billing operations.
-- 2. Adds 'expected_arrival' TEXT column to public.enquiries for arrival duration dropdown
--    ('Within 1 hour', 'Within 2 hours', 'Within 4 hours', 'Within 6 hours',
--     'Within 12 hours', 'Within 24 hours', 'Tomorrow', 'To be confirmed').
-- 3. Updates assign_enquiry_employee and self_assign_enquiry RPCs to accept and record expected_arrival.
-- 4. Preserves historical expected_visit_at timestamps and assignment reason / visit notes.

-- ----------------------------------------------------------------------------
-- 1. ADD 'account' ROLE TO public.admin_users
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account'));

-- Helper function: is_account()
CREATE OR REPLACE FUNCTION public.is_account()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'account'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account() TO authenticated;

-- Update public.is_staff() to include 'account'
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Update public.update_staff_profile RPC to permit 'account' role
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

  -- 2. Validate caller is an active Superadministrator or HR
  SELECT role INTO v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'hr') THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator or HR can manage employee profiles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Fetch existing target staff record
  SELECT * INTO v_target
  FROM public.admin_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found: %', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Validate full name (2-100 characters)
  v_clean_name := pg_catalog.btrim(p_full_name);
  IF v_clean_name IS NULL OR pg_catalog.length(v_clean_name) < 2 OR pg_catalog.length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 100 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Sanitize optional employee code
  v_clean_code := pg_catalog.btrim(p_employee_code);
  IF v_clean_code = '' THEN
    v_clean_code := NULL;
  END IF;

  -- 6. Sanitize optional phone number
  v_clean_phone := pg_catalog.btrim(p_phone_number);
  IF v_clean_phone = '' THEN
    v_clean_phone := NULL;
  END IF;

  -- 7. Sanitize and validate optional Aadhaar (12 numeric digits)
  v_clean_aadhaar := pg_catalog.regexp_replace(COALESCE(p_aadhaar_number, ''), '[^0-9]', '', 'g');
  IF v_clean_aadhaar = '' THEN
    v_clean_aadhaar := NULL;
  ELSIF pg_catalog.length(v_clean_aadhaar) != 12 THEN
    RAISE EXCEPTION 'Aadhaar number must be exactly 12 numeric digits.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Sanitize role if passed
  IF p_role IS NOT NULL THEN
    v_clean_role := pg_catalog.btrim(p_role);
    IF v_clean_role NOT IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account') THEN
      RAISE EXCEPTION 'Invalid staff role: %', p_role
        USING ERRCODE = 'check_violation';
    END IF;

    -- Only superadmin can assign/unassign superadmin role
    IF (v_clean_role = 'superadmin' OR v_target.role = 'superadmin') AND v_actor_role != 'superadmin' THEN
      RAISE EXCEPTION 'Access denied: Only Superadministrator can modify Superadministrator accounts.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    v_clean_role := v_target.role;
  END IF;

  -- 9. Active status validation (cannot deactivate last active superadmin)
  v_clean_active := COALESCE(p_is_active, v_target.is_active);
  IF v_target.role = 'superadmin' AND v_clean_active = false THEN
    SELECT COUNT(*) INTO v_superadmin_count
    FROM public.admin_users
    WHERE role = 'superadmin' AND is_active = true;

    IF v_superadmin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active superadministrator.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 10. Update the staff record
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

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'full_name', v_clean_name,
    'employee_code', v_clean_code,
    'phone_number', v_clean_phone,
    'aadhaar_number', v_clean_aadhaar,
    'role', v_clean_role,
    'is_active', v_clean_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_staff_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. EXTEND public.enquiries WITH expected_arrival TEXT
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS expected_arrival TEXT NULL;

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_expected_arrival_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_expected_arrival_check
  CHECK (expected_arrival IS NULL OR expected_arrival IN (
    'Within 1 hour',
    'Within 2 hours',
    'Within 4 hours',
    'Within 6 hours',
    'Within 12 hours',
    'Within 24 hours',
    'Tomorrow',
    'To be confirmed'
  ));

-- ----------------------------------------------------------------------------
-- 3. UPDATE public.assign_enquiry_employee RPC WITH expected_arrival
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.assign_enquiry_employee(
  p_enquiry_id UUID,
  p_employee_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expected_visit_at TIMESTAMPTZ DEFAULT NULL,
  p_visit_note TEXT DEFAULT NULL,
  p_expected_arrival TEXT DEFAULT NULL
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
  v_clean_arrival TEXT := pg_catalog.btrim(p_expected_arrival);
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

  -- Validate expected_arrival if provided
  IF v_clean_arrival = '' THEN
    v_clean_arrival := NULL;
  END IF;
  IF v_clean_arrival IS NOT NULL AND v_clean_arrival NOT IN (
    'Within 1 hour', 'Within 2 hours', 'Within 4 hours', 'Within 6 hours',
    'Within 12 hours', 'Within 24 hours', 'Tomorrow', 'To be confirmed'
  ) THEN
    RAISE EXCEPTION 'Invalid expected arrival duration: %', v_clean_arrival
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
      expected_arrival = NULL,
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

  IF NOT FOUND OR v_target_role NOT IN ('superadmin', 'admin', 'engineer', 'technical') THEN
    RAISE EXCEPTION 'Validation error: Target employee % is not an active staff member eligible for assignment.', p_employee_id
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

  IF v_clean_arrival IS NOT NULL THEN
    v_event_content := v_event_content || ' (Expected Arrival: ' || v_clean_arrival || ')';
  ELSIF p_expected_visit_at IS NOT NULL THEN
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
    expected_arrival = v_clean_arrival,
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
      'expected_arrival', v_clean_arrival,
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
    'expected_arrival', v_clean_arrival,
    'assignment_visit_note', v_clean_visit_note,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. UPDATE public.self_assign_enquiry RPC WITH expected_arrival
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.self_assign_enquiry(
  p_enquiry_id UUID,
  p_expected_visit_at TIMESTAMPTZ DEFAULT NULL,
  p_visit_note TEXT DEFAULT NULL,
  p_expected_arrival TEXT DEFAULT NULL
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
  v_clean_arrival TEXT := pg_catalog.btrim(p_expected_arrival);
  v_content TEXT;
BEGIN
  -- 1. Validate authenticated session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active employee identity
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'engineer', 'technical') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or technician privileges required to self-assign enquiries.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock target enquiry row
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

  -- Validate expected_arrival if provided
  IF v_clean_arrival = '' THEN
    v_clean_arrival := NULL;
  END IF;
  IF v_clean_arrival IS NOT NULL AND v_clean_arrival NOT IN (
    'Within 1 hour', 'Within 2 hours', 'Within 4 hours', 'Within 6 hours',
    'Within 12 hours', 'Within 24 hours', 'Tomorrow', 'To be confirmed'
  ) THEN
    RAISE EXCEPTION 'Invalid expected arrival duration: %', v_clean_arrival
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Apply assignment
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
    expected_arrival = v_clean_arrival,
    assignment_visit_note = v_clean_visit_note,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  v_content := COALESCE(v_actor_name, v_actor_email) || ' self-assigned enquiry ' || COALESCE(v_enquiry.enquiry_number, v_enquiry.id::text);
  IF v_clean_arrival IS NOT NULL THEN
    v_content := v_content || ' (Expected Arrival: ' || v_clean_arrival || ')';
  ELSIF p_expected_visit_at IS NOT NULL THEN
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
      'expected_arrival', v_clean_arrival,
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
    'expected_arrival', v_clean_arrival,
    'assignment_visit_note', v_clean_visit_note,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

