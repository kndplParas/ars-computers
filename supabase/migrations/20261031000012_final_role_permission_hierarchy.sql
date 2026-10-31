-- Migration: 20261031000012_final_role_permission_hierarchy.sql
-- Description: Establishes authoritative 7-role permission hierarchy with exact parity:
-- 1. Head Admin / Superadmin — Full control.
-- 2. Admin — Existing Admin-level permissions.
-- 3. Technical — Exactly Admin-level operational permissions, without Head-only privileges.
-- 4. Engineer — Existing Engineer-level permissions.
-- 5. HR — Exactly Engineer-level permissions (exact parity with Engineer; Head/Admin staff management revoked).
-- 6. Accounts — Exactly Engineer-level permissions (exact parity with Engineer).
-- 7. Inventory Staff — Preserved restricted permissions (catalog stock, orders fulfillment; denied enquiries, categories, staff).

-- ----------------------------------------------------------------------------
-- 1. ROLE CHECK CONSTRAINT REASSERTION
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account'));

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
-- is_admin(): Returns true for superadmin, admin, and technical (admin parity),
-- and operational field roles (engineer, hr, account) that share standard module access.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- is_engineer(): True for superadmin, engineer, and exact-parity roles hr & account
CREATE OR REPLACE FUNCTION public.is_engineer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'engineer', 'technical', 'hr', 'account'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_engineer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_engineer() TO authenticated;

-- is_technical(): True for superadmin, technical, and admin
CREATE OR REPLACE FUNCTION public.is_technical()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'technical'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_technical() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_technical() TO authenticated;

-- is_hr(): Helper for HR identity
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'hr'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_hr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr() TO authenticated;

-- is_account(): Helper for account identity
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

-- is_staff(): Returns true for any authenticated active staff member
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

-- ----------------------------------------------------------------------------
-- 3. RLS: REVOKE HR PRIVILEGES FROM public.admin_users (HEAD-ONLY ACCESS)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmins and HR can view all admin profiles" ON public.admin_users;
DROP POLICY IF EXISTS "Superadmins can view all admin profiles" ON public.admin_users;

CREATE POLICY "Superadmins can view all admin profiles"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 4. UPDATE update_staff_profile: SUPERADMIN ONLY (HEAD-ONLY POWER)
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

  -- 2. Validate caller is an active Superadministrator ONLY
  SELECT role INTO v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Superadministrator privileges required to manage staff profiles.'
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

  IF v_clean_code IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE employee_code = v_clean_code AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Validation error: Employee code "%" is already in use by another staff member.', v_clean_code
        USING ERRCODE = 'unique_violation';
    END IF;
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

  IF v_clean_aadhaar IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE aadhaar_number = v_clean_aadhaar AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Validation error: Aadhaar number is already registered to another staff member.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- 8. Sanitize role if passed
  IF p_role IS NOT NULL THEN
    v_clean_role := pg_catalog.btrim(p_role);
    IF v_clean_role NOT IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account') THEN
      RAISE EXCEPTION 'Invalid staff role: %', p_role
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

  -- 9. Active status validation (cannot deactivate last active superadmin or self)
  v_clean_active := COALESCE(p_is_active, v_target.is_active);
  IF p_user_id = v_actor_id AND v_clean_active = false THEN
    RAISE EXCEPTION 'Safety check failed: You cannot deactivate your own superadministrator account.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_target.role = 'superadmin' AND v_clean_active = false THEN
    SELECT COUNT(*) INTO v_superadmin_count
    FROM public.admin_users
    WHERE role = 'superadmin' AND is_active = true AND id <> p_user_id;

    IF v_superadmin_count < 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active superadministrator.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 10. Update staff record
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
    'id', p_user_id,
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
-- 5. UPDATE assign_enquiry_employee: HEAD CALLER ONLY, PERMITS ALL 6 STAFF ROLES
-- ----------------------------------------------------------------------------
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

  -- 2. Lock target enquiry
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
        'enquiry_id', p_enquiry_id,
        'assigned_employee_id', NULL
      );
    END IF;

    UPDATE public.enquiries
    SET
      assigned_employee_id = NULL,
      assigned_employee_name = NULL,
      assigned_employee_email = NULL,
      assigned_employee_code = NULL,
      assigned_employee_phone = NULL,
      assigned_engineer_aadhaar = NULL,
      assigned_to = NULL,
      assigned_at = NULL,
      assigned_by = v_actor_id,
      assigned_by_name = COALESCE(v_actor_name, v_actor_email),
      assigned_by_employee_code = v_actor_code,
      expected_visit_at = NULL,
      expected_arrival = NULL,
      assignment_visit_note = NULL,
      updated_at = v_now
    WHERE id = p_enquiry_id;

    v_event_type := 'ENQUIRY_UNASSIGNED';
    v_event_content := 'Unassigned from ' || COALESCE(v_enquiry.assigned_employee_name, 'previous staff') ||
      ' by Head (' || COALESCE(v_actor_name, v_actor_email) || ')';
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

  IF NOT FOUND OR v_target_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
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

  UPDATE public.enquiries
  SET
    assigned_employee_id = p_employee_id,
    assigned_employee_name = COALESCE(v_target_name, v_target_email),
    assigned_employee_email = v_target_email,
    assigned_employee_code = v_target_code,
    assigned_employee_phone = v_target_phone,
    assigned_engineer_aadhaar = v_target_aadhaar,
    assigned_to = p_employee_id,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
    expected_visit_at = COALESCE(p_expected_visit_at, v_enquiry.expected_visit_at),
    expected_arrival = v_clean_arrival,
    assignment_visit_note = v_clean_visit_note,
    status = CASE WHEN v_enquiry.status = 'new' THEN 'in_progress' ELSE v_enquiry.status END,
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
      'assigned_employee_id', p_employee_id,
      'assigned_employee_name', COALESCE(v_target_name, v_target_email),
      'assigned_employee_code', v_target_code,
      'assigned_by_id', v_actor_id,
      'assigned_by_name', COALESCE(v_actor_name, v_actor_email),
      'expected_visit_at', p_expected_visit_at,
      'expected_arrival', v_clean_arrival,
      'visit_note', v_clean_visit_note,
      'reason', v_clean_reason,
      'assigned_at', v_now
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'action', CASE WHEN v_enquiry.assigned_employee_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    'enquiry_id', p_enquiry_id,
    'assigned_employee_id', p_employee_id,
    'assigned_employee_name', COALESCE(v_target_name, v_target_email),
    'expected_visit_at', p_expected_visit_at,
    'expected_arrival', v_clean_arrival,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. UPDATE self_assign_enquiry: PERMIT ALL OPERATIONAL ROLES
-- ----------------------------------------------------------------------------
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
  v_clean_visit_note TEXT := pg_catalog.btrim(p_visit_note);
  v_clean_arrival TEXT := pg_catalog.btrim(p_expected_arrival);
  v_activity_id UUID;
  v_event_content TEXT;
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active employee identity (Admin parity: technical; Engineer parity: hr, account)
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to self-assign enquiries.'
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

  -- 4. Unassigned check
  IF v_enquiry.assigned_employee_id IS NOT NULL AND v_enquiry.assigned_employee_id <> v_actor_id THEN
    RAISE EXCEPTION 'Enquiry is already assigned to another staff member. Contact Head of Store to request reassignment.'
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
    assigned_employee_email = v_actor_email,
    assigned_employee_code = v_actor_code,
    assigned_employee_phone = v_actor_phone,
    assigned_engineer_aadhaar = v_actor_aadhaar,
    assigned_to = v_actor_id,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    assigned_by_employee_code = v_actor_code,
    expected_visit_at = COALESCE(p_expected_visit_at, v_enquiry.expected_visit_at),
    expected_arrival = v_clean_arrival,
    assignment_visit_note = v_clean_visit_note,
    status = CASE WHEN v_enquiry.status = 'new' THEN 'in_progress' ELSE v_enquiry.status END,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  v_event_content := 'Self-assigned by ' || COALESCE(v_actor_name, v_actor_email) ||
    CASE WHEN v_actor_code IS NOT NULL THEN ' [' || v_actor_code || ']' ELSE '' END;

  IF v_clean_arrival IS NOT NULL THEN
    v_event_content := v_event_content || ' (Expected Arrival: ' || v_clean_arrival || ')';
  ELSIF p_expected_visit_at IS NOT NULL THEN
    v_event_content := v_event_content || ' (Expected Visit: ' || to_char(p_expected_visit_at, 'YYYY-MM-DD HH24:MI') || ')';
  END IF;

  IF v_clean_visit_note IS NOT NULL AND v_clean_visit_note != '' THEN
    v_event_content := v_event_content || '. Note: ' || v_clean_visit_note;
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
    'ENQUIRY_SELF_ASSIGNED',
    v_event_content,
    pg_catalog.jsonb_build_object(
      'enquiry_number', v_enquiry.enquiry_number,
      'assigned_employee_id', v_actor_id,
      'assigned_employee_name', COALESCE(v_actor_name, v_actor_email),
      'assigned_employee_code', v_actor_code,
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
    'assigned_employee_id', v_actor_id,
    'assigned_employee_name', COALESCE(v_actor_name, v_actor_email),
    'expected_visit_at', p_expected_visit_at,
    'expected_arrival', v_clean_arrival,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. UPDATE ENQUIRY OPERATIONAL RPCS: NOTES, PROGRESS, REJECTION, COMPLETION
-- ----------------------------------------------------------------------------
-- 7.1 add_enquiry_note
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

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator or technician privileges required to add enquiry notes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_content := pg_catalog.btrim(p_content);
  IF v_clean_content IS NULL OR pg_catalog.char_length(v_clean_content) < 2 OR pg_catalog.char_length(v_clean_content) > 3000 THEN
    RAISE EXCEPTION 'Validation error: Follow-up note content must be between 2 and 3000 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.enquiries WHERE id = p_enquiry_id) THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.'
      USING ERRCODE = 'no_data_found';
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
    v_clean_content,
    pg_catalog.jsonb_build_object('source', 'admin_portal'),
    clock_timestamp()
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'activity_id', v_activity_id
  );
END;
$$;

-- 7.2 update_enquiry_progress
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
  v_current_status TEXT;
  v_is_archived BOOLEAN;
  v_is_in_bin BOOLEAN;
  v_activity_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authorized staff privileges required to update progress.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status, is_archived, is_in_bin
  INTO v_current_status, v_is_archived, v_is_in_bin
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_is_archived OR v_is_in_bin THEN
    RAISE EXCEPTION 'Cannot update progress on an archived or binned enquiry.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_next_status NOT IN ('new', 'in_progress', 'quoted', 'returned_for_rework') THEN
    RAISE EXCEPTION 'Invalid target progress status: %', p_next_status USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.enquiries
  SET status = p_next_status, updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
  ) VALUES (
    p_enquiry_id, v_actor_id, v_actor_email, v_actor_role, 'status_change',
    'Status transitioned from ' || v_current_status || ' to ' || p_next_status,
    pg_catalog.jsonb_build_object('old_status', v_current_status, 'new_status', p_next_status),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'status', p_next_status, 'activity_id', v_activity_id);
END;
$$;

-- 7.3 request_enquiry_rejection
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
  v_current_status TEXT;
  v_clean_reason TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_activity_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authorized staff privileges required to request rejection.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(p_reason);
  IF v_clean_reason IS NULL OR pg_catalog.char_length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'Validation error: Rejection request requires an explanatory reason (min 5 characters).'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT status INTO v_current_status
  FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.enquiries
  SET status = 'rejection_requested', rejection_reason = v_clean_reason, updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id, actor_id, actor_email, actor_role, activity_type, content, metadata, created_at
  ) VALUES (
    p_enquiry_id, v_actor_id, v_actor_email, v_actor_role, 'rejection_requested',
    'Rejection requested by ' || v_actor_email || '. Reason: ' || v_clean_reason,
    pg_catalog.jsonb_build_object('reason', v_clean_reason, 'previous_status', v_current_status),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'status', 'rejection_requested', 'activity_id', v_activity_id);
END;
$$;

-- 7.4 request_enquiry_service_completion
CREATE OR REPLACE FUNCTION public.request_enquiry_service_completion(
  p_enquiry_id UUID,
  p_proof_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_name TEXT;
  v_actor_role TEXT;
  v_actor_code TEXT;
  v_actor_email TEXT;
  v_enquiry RECORD;
  v_proof RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_activity_id UUID;
  v_clean_notes TEXT := pg_catalog.btrim(p_notes);
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Authorized staff role required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry
  FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Non-superadmins can only complete enquiries assigned to themselves
  IF v_actor_role <> 'superadmin' AND v_enquiry.assigned_employee_id IS DISTINCT FROM v_actor_id AND v_enquiry.assigned_to IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Access denied: You can only complete services for enquiries assigned to you.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_proof
  FROM public.enquiry_service_proofs
  WHERE id = p_proof_id AND enquiry_id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proof record not found for this enquiry.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_proof.proof_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Invalid proof state: Only pending_review proofs can be attached.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.enquiries
  SET status = 'completion_requested', updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id, actor_id, actor_email, actor_name, actor_role, activity_type, notes, created_at
  ) VALUES (
    p_enquiry_id, v_actor_id, v_actor_email, v_actor_name, v_actor_role, 'service_completion_requested',
    COALESCE(v_clean_notes, 'Staff submitted signed proof for Head review'),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'status', 'completion_requested',
    'active_proof_id', p_proof_id,
    'activity_id', v_activity_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. ORDERS OPERATIONAL RPCS: CREATE, RECORD PAYMENT, ATTACHMENTS, PROGRESS
-- ----------------------------------------------------------------------------
-- 8.1 create_sales_order
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_customer_name TEXT,
  p_contact_info TEXT,
  p_delivery_address TEXT,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_initial_amount_paid NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;
  v_seq_num BIGINT;
  v_order_number TEXT;
  v_order_id UUID;
  v_calc_total NUMERIC(12, 2) := 0;
  v_item JSONB;
  v_qty INT;
  v_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_product_id UUID;
  v_product RECORD;
  v_payment_status TEXT;
  v_clean_method TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Operational roles allowed; inventory_staff blocked from order creation
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to create orders.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_customer_name IS NULL OR pg_catalog.btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Validation error: Customer name is required.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_contact_info IS NULL OR pg_catalog.btrim(p_contact_info) = '' THEN
    RAISE EXCEPTION 'Validation error: Customer contact info is required.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Validation error: At least one item is required.' USING ERRCODE = 'check_violation';
  END IF;

  -- Generate order number
  v_seq_num := nextval('public.orders_seq');
  v_order_number := 'ARS-ORD-' || LPAD(v_seq_num::TEXT, 5, '0');

  -- Calculate order items total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::INT;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_calc_total := v_calc_total + (v_qty * v_price);
  END LOOP;

  v_clean_method := LOWER(COALESCE(p_payment_method, 'cash'));
  IF p_initial_amount_paid >= v_calc_total THEN
    v_payment_status := 'paid';
  ELSIF p_initial_amount_paid > 0 THEN
    v_payment_status := 'partially_paid';
  ELSE
    v_payment_status := 'pending';
  END IF;

  INSERT INTO public.orders (
    order_number, customer_name, contact_info, delivery_address, total_amount,
    amount_paid, payment_status, payment_method, status, notes, created_by, created_at, updated_at
  ) VALUES (
    v_order_number, p_customer_name, p_contact_info, p_delivery_address, v_calc_total,
    COALESCE(p_initial_amount_paid, 0), v_payment_status, v_clean_method, 'new', p_notes, v_actor_id, v_now, v_now
  ) RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::INT;
    v_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := v_qty * v_price;
    v_product_id := (v_item->>'product_id')::UUID;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, line_total, created_at
    ) VALUES (
      v_order_id, v_product_id, COALESCE(v_item->>'product_name', 'Item'), v_qty, v_price, v_line_total, v_now
    );
  END LOOP;

  -- Record initial payment activity if paid
  IF p_initial_amount_paid > 0 THEN
    INSERT INTO public.order_payments (
      order_id, amount_received, payment_method, recorded_by, created_at
    ) VALUES (
      v_order_id, p_initial_amount_paid, v_clean_method, v_actor_id, v_now
    );
  END IF;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    v_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_CREATED',
    'Order ' || v_order_number || ' created by ' || COALESCE(v_actor_name, v_actor_email), v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_calc_total
  );
END;
$$;

-- 8.2 register_order_attachment
CREATE OR REPLACE FUNCTION public.register_order_attachment(
  p_order_id UUID,
  p_storage_path TEXT,
  p_original_filename TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_attachment_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, u.email
  INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to register order attachments.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.order_attachments (
    order_id, storage_path, original_filename, mime_type, file_size, uploaded_by, created_at
  ) VALUES (
    p_order_id, p_storage_path, p_original_filename, p_mime_type, p_file_size, v_actor_id, v_now
  ) RETURNING id INTO v_attachment_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ATTACHMENT_UPLOADED',
    'Document ' || p_original_filename || ' attached by ' || COALESCE(v_actor_name, v_actor_email), v_now
  );

  RETURN pg_catalog.jsonb_build_object('success', true, 'attachment_id', v_attachment_id);
END;
$$;

-- 8.3 record_order_payment
CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id UUID,
  p_amount_received NUMERIC,
  p_payment_method TEXT,
  p_transaction_reference TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_order RECORD;
  v_new_paid NUMERIC(12, 2);
  v_new_status TEXT;
  v_payment_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, u.email
  INTO v_actor_role, v_actor_name, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to record payments.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record payment on a cancelled order.' USING ERRCODE = 'check_violation';
  END IF;

  v_new_paid := v_order.amount_paid + p_amount_received;
  IF v_new_paid >= v_order.total_amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE public.orders
  SET amount_paid = v_new_paid, payment_status = v_new_status, updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_payments (
    order_id, amount_received, payment_method, transaction_reference, remarks, recorded_by, created_at
  ) VALUES (
    p_order_id, p_amount_received, p_payment_method, p_transaction_reference, p_remarks, v_actor_id, v_now
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'PAYMENT_RECORDED',
    'Payment of Rs ' || p_amount_received || ' recorded via ' || p_payment_method, v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount_paid', v_new_paid,
    'payment_status', v_new_status
  );
END;
$$;



-- ----------------------------------------------------------------------------
-- 9. RPC: public.get_eligible_enquiry_assignees (SUPERADMIN ONLY DIRECTORY)
-- Returns all active staff across operational roles: superadmin, admin, technical, engineer, hr, account
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
    AND au.role IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account')
  ORDER BY au.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_eligible_enquiry_assignees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_eligible_enquiry_assignees() TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. ENQUIRY SERVICE COMPLETION & PROOF RPCS
-- ----------------------------------------------------------------------------
-- 10.1 register_enquiry_service_proof
CREATE OR REPLACE FUNCTION public.register_enquiry_service_proof(
  p_enquiry_id        UUID,
  p_storage_path      TEXT,
  p_original_filename TEXT,
  p_mime_type         TEXT,
  p_file_size_bytes   BIGINT,
  p_document_type     TEXT    DEFAULT 'CUSTOMER_SIGNED_SERVICE_REPORT',
  p_description       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id        UUID;
  v_actor_email     TEXT;
  v_actor_role      TEXT;
  v_actor_name      TEXT;
  v_actor_code      TEXT;
  v_enquiry         RECORD;
  v_path_enquiry_id TEXT;
  v_clean_filename  TEXT;
  v_clean_desc      TEXT;
  v_clean_doctype   TEXT;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_proof_id        UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to register service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry
  FROM   public.enquiries
  WHERE  id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Enquiry % does not exist.', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed' THEN
    RAISE EXCEPTION 'Validation error: Cannot upload service proofs for a completed and approved enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Validation error: Cannot upload service proofs for an archived enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.is_in_bin OR v_enquiry.status = 'in_bin' THEN
    RAISE EXCEPTION 'Validation error: Cannot upload service proofs for an enquiry in the Bin.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('closed', 'converted', 'rejected') THEN
    RAISE EXCEPTION 'Validation error: Cannot upload service proofs for a closed, converted, or rejected enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Non-superadmin employee MUST be assigned to this enquiry
  IF v_actor_role <> 'superadmin' THEN
    IF (v_enquiry.assigned_employee_id IS NULL OR v_enquiry.assigned_employee_id IS DISTINCT FROM v_actor_id)
       AND (v_enquiry.assigned_to IS NULL OR v_enquiry.assigned_to IS DISTINCT FROM v_actor_id) THEN
      RAISE EXCEPTION 'Access denied: Employees may only upload service proofs for enquiries assigned to them.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF p_storage_path IS NULL OR pg_catalog.btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'Validation error: Storage path cannot be empty.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_storage_path LIKE '%..%' OR p_storage_path LIKE '%\\%' OR p_storage_path LIKE '//%' THEN
    RAISE EXCEPTION 'Security violation: Path traversal or invalid characters detected in storage path.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_path_enquiry_id := pg_catalog.split_part(p_storage_path, '/', 1);
  IF v_path_enquiry_id IS DISTINCT FROM p_enquiry_id::text THEN
    RAISE EXCEPTION 'Security violation: Storage path must match the target enquiry ID.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_doctype := COALESCE(pg_catalog.btrim(p_document_type), 'CUSTOMER_SIGNED_SERVICE_REPORT');
  IF v_clean_doctype NOT IN ('CUSTOMER_SIGNED_SERVICE_REPORT', 'DIAGNOSTIC_REPORT', 'HANDOVER_RECEIPT') THEN
    RAISE EXCEPTION 'Validation error: Invalid document type "%".', p_document_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN
    RAISE EXCEPTION 'Validation error: Disallowed MIME type "%". Only JPEG, PNG, and PDF are permitted.', p_mime_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 OR p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Validation error: File size must be between 1 byte and 10 MB.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_filename := pg_catalog.btrim(COALESCE(p_original_filename, 'attachment'));
  v_clean_desc := pg_catalog.btrim(p_description);
  IF v_clean_desc = '' THEN v_clean_desc := NULL; END IF;

  INSERT INTO public.enquiry_service_proofs (
    enquiry_id,
    storage_path,
    original_filename,
    mime_type,
    file_size_bytes,
    document_type,
    description,
    uploaded_by,
    uploaded_by_name,
    uploaded_by_employee_code,
    uploaded_at,
    is_customer_signed,
    is_voided,
    created_at
  ) VALUES (
    p_enquiry_id,
    p_storage_path,
    v_clean_filename,
    p_mime_type,
    p_file_size_bytes,
    v_clean_doctype,
    v_clean_desc,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    v_now,
    true,
    false,
    v_now
  ) RETURNING id INTO v_proof_id;

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
    'SERVICE_PROOF_UPLOADED',
    'Customer-signed service report "' || v_clean_filename || '" uploaded by ' || COALESCE(v_actor_name, v_actor_email),
    pg_catalog.jsonb_build_object(
      'proof_id', v_proof_id,
      'document_type', v_clean_doctype,
      'original_filename', v_clean_filename,
      'mime_type', p_mime_type,
      'file_size_bytes', p_file_size_bytes,
      'storage_path', p_storage_path
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'proof_id', v_proof_id,
    'enquiry_id', p_enquiry_id,
    'document_type', v_clean_doctype,
    'uploaded_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_enquiry_service_proof(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_enquiry_service_proof(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

-- 10.2 void_enquiry_service_proof
CREATE OR REPLACE FUNCTION public.void_enquiry_service_proof(
  p_proof_id    UUID,
  p_void_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id     UUID;
  v_actor_email  TEXT;
  v_actor_role   TEXT;
  v_actor_name   TEXT;
  v_actor_code   TEXT;
  v_proof        RECORD;
  v_enquiry      RECORD;
  v_clean_reason TEXT;
  v_now          TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to void service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(COALESCE(p_void_reason, ''));
  IF pg_catalog.char_length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'Validation error: Void reason must be at least 5 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_proof
  FROM   public.enquiry_service_proofs
  WHERE  id = p_proof_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Service proof % does not exist.', p_proof_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_proof.is_voided THEN
    RAISE EXCEPTION 'Conflict: Service proof is already voided.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_enquiry
  FROM   public.enquiries
  WHERE  id = v_proof.enquiry_id;

  IF v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed' THEN
    RAISE EXCEPTION 'Permanent archive protection: Service proofs cannot be voided after enquiry completion has been approved.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_actor_role <> 'superadmin' THEN
    IF v_proof.uploaded_by IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Access denied: Employees may only void their own uploaded service proofs.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_enquiry.status = 'completion_requested' THEN
      RAISE EXCEPTION 'Invalid operation: Cannot void a service proof while a completion request is under review.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.enquiry_service_proofs
  SET
    is_voided      = true,
    voided_at      = v_now,
    voided_by      = v_actor_id,
    voided_by_name = COALESCE(v_actor_name, v_actor_email),
    void_reason    = v_clean_reason
  WHERE id = p_proof_id;

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
    v_proof.enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'SERVICE_PROOF_VOIDED',
    'Service proof "' || v_proof.original_filename || '" was voided by ' ||
      COALESCE(v_actor_name, v_actor_email) || '. Reason: ' || v_clean_reason,
    pg_catalog.jsonb_build_object(
      'proof_id', p_proof_id,
      'original_filename', v_proof.original_filename,
      'void_reason', v_clean_reason,
      'voided_by_id', v_actor_id
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'proof_id', p_proof_id,
    'is_voided', true,
    'voided_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_enquiry_service_proof(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_enquiry_service_proof(UUID, TEXT) TO authenticated;

-- 10.3 submit_enquiry_completion
CREATE OR REPLACE FUNCTION public.submit_enquiry_completion(
  p_enquiry_id        UUID,
  p_completion_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id        UUID;
  v_actor_email     TEXT;
  v_actor_role      TEXT;
  v_actor_name      TEXT;
  v_actor_code      TEXT;
  v_enquiry         RECORD;
  v_clean_summary   TEXT;
  v_activity_id     UUID;
  v_proof_count     INT;
  v_now             TIMESTAMPTZ;
  v_is_service      BOOLEAN;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO   v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM   public.admin_users au
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator or technician privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_summary := pg_catalog.btrim(p_completion_summary);
  IF v_clean_summary IS NULL OR pg_catalog.char_length(v_clean_summary) < 10 OR pg_catalog.char_length(v_clean_summary) > 3000 THEN
    RAISE EXCEPTION 'Validation error: A meaningful work-completion summary between 10 and 3000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_enquiry
  FROM   public.enquiries
  WHERE  id = p_enquiry_id
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

  -- Non-superadmins can only complete enquiries assigned to themselves
  IF v_actor_role <> 'superadmin' AND v_enquiry.assigned_employee_id IS DISTINCT FROM v_actor_id AND v_enquiry.assigned_to IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Access denied: You can only complete services for enquiries assigned to you.'
      USING ERRCODE = 'insufficient_privilege';
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

  -- Proof check for service enquiries
  v_is_service := (
    v_enquiry.enquiry_type = 'service_request'
    OR (v_enquiry.category_interest IS NOT NULL AND v_enquiry.category_interest ILIKE 'service%')
    OR v_enquiry.service_details IS NOT NULL
  );

  IF v_is_service THEN
    SELECT COUNT(*) INTO v_proof_count
    FROM   public.enquiry_service_proofs
    WHERE  enquiry_id    = p_enquiry_id
      AND  document_type = 'CUSTOMER_SIGNED_SERVICE_REPORT'
      AND  is_voided     = false;

    IF v_proof_count = 0 THEN
      RAISE EXCEPTION 'Upload the customer-signed service report before requesting completion.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.enquiries
  SET
    previous_status             = v_enquiry.status,
    status                      = 'completion_requested',
    completion_summary          = v_clean_summary,
    completion_requested_by     = v_actor_id,
    completion_requested_at     = v_now,
    completed_by_name           = COALESCE(v_actor_name, v_actor_email),
    completed_by_employee_code  = v_actor_code,
    completion_rework_reason    = NULL,
    updated_at                  = v_now
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
    'completion_requested',
    'Completion requested by ' || COALESCE(v_actor_name, v_actor_email) || ': ' || v_clean_summary,
    pg_catalog.jsonb_build_object(
      'completion_summary', v_clean_summary,
      'submitted_by_id', v_actor_id,
      'submitted_by_name', COALESCE(v_actor_name, v_actor_email),
      'submitted_by_code', v_actor_code,
      'is_service', v_is_service
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'status', 'completion_requested',
    'activity_id', v_activity_id,
    'completed_by_name', COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. SALES ORDER LIFECYCLE RPCS: START & SUBMIT COMPLETION
-- ----------------------------------------------------------------------------
-- 11.1 start_sales_order
CREATE OR REPLACE FUNCTION public.start_sales_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_order RECORD;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Administrator or store employee privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status != 'new' THEN
    RAISE EXCEPTION 'Invalid state: Order must be in "new" status to start processing.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.orders
  SET status = 'processing', updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_PROCESSING_STARTED',
    'Order processing started.', v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'processing',
    'message', 'Order is now processing.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_sales_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_sales_order(UUID) TO authenticated;

-- 11.2 submit_order_completion
CREATE OR REPLACE FUNCTION public.submit_order_completion(
  p_order_id UUID,
  p_employee_remarks TEXT
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
  v_order RECORD;
  v_clean_remarks TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Administrator or store employee privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_remarks := pg_catalog.btrim(p_employee_remarks);
  IF v_clean_remarks IS NULL OR pg_catalog.char_length(v_clean_remarks) < 5 THEN
    RAISE EXCEPTION 'Validation error: Meaningful completion remarks (at least 5 characters) are required.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status NOT IN ('new', 'processing') THEN
    RAISE EXCEPTION 'Invalid state: Cannot submit completion for an order with status "%".', v_order.status
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := pg_catalog.timezone('utc'::text, pg_catalog.now());

  UPDATE public.orders
  SET
    status = 'completion_requested',
    completion_requested_by = v_actor_id,
    completion_requested_at = v_now,
    completed_by_name = COALESCE(v_actor_name, v_actor_email),
    completed_by_employee_code = v_actor_code,
    employee_remarks = v_clean_remarks,
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO public.order_activities (
    order_id, actor_id, actor_email, actor_role, activity_type, content, created_at
  ) VALUES (
    p_order_id, v_actor_id, v_actor_email, v_actor_role, 'ORDER_COMPLETION_SUBMITTED',
    v_clean_remarks, v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completion_requested',
    'completed_by_name', COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code,
    'message', 'Order completion submitted for Head approval.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_completion(UUID, TEXT) TO authenticated;
