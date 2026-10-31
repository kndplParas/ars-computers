-- Migration: 20261031000010_add_hr_technical_engineer_roles.sql
-- Description: Adds 'engineer', 'hr', and 'technical' roles to the system.
-- Replaces/maps the generic 'admin' role to 'engineer' for enquiry and visit operations.
-- Adds 'hr' for personnel and staff profile management.
-- Adds 'technical' for hardware/software repairs, diagnostics, and technical enquiries.
-- Preserves backwards compatibility for existing 'admin' accounts.

-- 1. Update CHECK constraint on public.admin_users
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical'));

-- 2. Update and create role verification helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'engineer'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_engineer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'engineer'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_engineer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_engineer() TO authenticated;

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

-- 3. Update public.update_staff_profile RPC to permit new roles and allow HR profile updates
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
    RAISE EXCEPTION 'Access denied: Superadministrator or HR privileges required to manage staff profiles.'
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
    IF v_clean_role NOT IN ('superadmin', 'admin', 'engineer', 'inventory_staff', 'hr', 'technical') THEN
      RAISE EXCEPTION 'Validation error: Invalid role "%". Permitted roles are superadmin, admin, engineer, inventory_staff, hr, or technical.', v_clean_role
        USING ERRCODE = 'check_violation';
    END IF;

    -- Safety check: Only Superadmin can change role
    IF v_actor_role <> 'superadmin' AND v_clean_role <> v_target.role THEN
      RAISE EXCEPTION 'Access denied: Only Superadministrator can alter staff roles.'
        USING ERRCODE = 'insufficient_privilege';
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
    -- Safety check: Only Superadmin can activate/deactivate
    IF v_actor_role <> 'superadmin' AND p_is_active <> v_target.is_active THEN
      RAISE EXCEPTION 'Access denied: Only Superadministrator can activate or deactivate accounts.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

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

  -- 10. Update admin_users directory
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

-- 4. Update head_assign_employee_to_enquiry to permit 'engineer' and 'technical'
CREATE OR REPLACE FUNCTION public.head_assign_employee_to_enquiry(
  p_enquiry_id UUID,
  p_target_user_id UUID,
  p_expected_visit_at TIMESTAMPTZ DEFAULT NULL,
  p_visit_note TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Head assigned staff member to enquiry'
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
    RAISE EXCEPTION 'Enquiry not found: %', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_clean_visit_note = '' THEN
    v_clean_visit_note := NULL;
  END IF;

  -- Case A: Unassigning
  IF p_target_user_id IS NULL THEN
    IF v_enquiry.assigned_to IS NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'action', 'noop',
        'enquiry_id', p_enquiry_id,
        'message', 'Enquiry is already unassigned'
      );
    END IF;

    UPDATE public.enquiries
    SET
      assigned_to = NULL,
      assigned_at = NULL,
      assigned_employee_name = NULL,
      assigned_employee_email = NULL,
      assigned_employee_code = NULL,
      assigned_employee_phone = NULL,
      assigned_engineer_aadhaar = NULL,
      expected_engineer_visit_at = NULL,
      assignment_visit_note = NULL,
      updated_at = v_now
    WHERE id = p_enquiry_id;

    v_event_type := 'staff_unassigned';
    v_event_content := coalesce(v_clean_reason, 'Head removed staff assignment');

    INSERT INTO public.enquiry_activities (
      enquiry_id,
      actor_id,
      actor_email,
      actor_name,
      actor_role,
      activity_type,
      notes,
      created_at
    ) VALUES (
      p_enquiry_id,
      v_actor_id,
      v_actor_email,
      v_actor_name,
      v_actor_role,
      v_event_type,
      v_event_content,
      v_now
    ) RETURNING id INTO v_activity_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'unassigned',
      'enquiry_id', p_enquiry_id,
      'activity_id', v_activity_id,
      'assigned_to', NULL
    );
  END IF;

  -- Case B: Assign or Reassign to Target Staff
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_target_email, v_target_role, v_target_name, v_target_code, v_target_phone, v_target_aadhaar
  FROM public.admin_users
  WHERE id = p_target_user_id AND is_active = true;

  IF NOT FOUND OR v_target_role NOT IN ('superadmin', 'admin', 'engineer', 'technical') THEN
    RAISE EXCEPTION 'Invalid target staff: User does not exist, is inactive, or lacks service assignment privileges.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.assigned_to IS NOT NULL AND v_enquiry.assigned_to <> p_target_user_id THEN
    v_event_type := 'staff_reassigned';
    v_event_content := coalesce(
      v_clean_reason,
      format('Head reassigned service visit from %s to %s', coalesce(v_enquiry.assigned_employee_name, 'previous staff'), v_target_name)
    );
  ELSE
    v_event_type := 'staff_assigned';
    v_event_content := coalesce(
      v_clean_reason,
      format('Head assigned service visit to %s', v_target_name)
    );
  END IF;

  UPDATE public.enquiries
  SET
    assigned_to = p_target_user_id,
    assigned_at = v_now,
    assigned_employee_name = v_target_name,
    assigned_employee_email = v_target_email,
    assigned_employee_code = v_target_code,
    assigned_employee_phone = v_target_phone,
    assigned_engineer_aadhaar = v_target_aadhaar,
    expected_engineer_visit_at = p_expected_visit_at,
    assignment_visit_note = v_clean_visit_note,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    activity_type,
    notes,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_name,
    v_actor_role,
    v_event_type,
    v_event_content,
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', v_event_type,
    'enquiry_id', p_enquiry_id,
    'activity_id', v_activity_id,
    'assigned_to', p_target_user_id,
    'assigned_employee_name', v_target_name,
    'assigned_employee_code', v_target_code,
    'assigned_engineer_aadhaar', v_target_aadhaar,
    'expected_engineer_visit_at', p_expected_visit_at,
    'assignment_visit_note', v_clean_visit_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.head_assign_employee_to_enquiry(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.head_assign_employee_to_enquiry(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- 5. Update employee_self_assign_enquiry to permit 'engineer' and 'technical'
CREATE OR REPLACE FUNCTION public.employee_self_assign_enquiry(
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
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'engineer', 'technical') THEN
    RAISE EXCEPTION 'Access denied: Active engineer or technical privileges required for self-assignment.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found: %', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.assigned_to IS NOT NULL AND v_enquiry.assigned_to <> v_actor_id THEN
    RAISE EXCEPTION 'Conflict: Enquiry is already assigned to another staff member. Contact Head of Store.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_clean_visit_note = '' THEN
    v_clean_visit_note := NULL;
  END IF;

  UPDATE public.enquiries
  SET
    assigned_to = v_actor_id,
    assigned_at = v_now,
    assigned_employee_name = v_actor_name,
    assigned_employee_email = v_actor_email,
    assigned_employee_code = v_actor_code,
    assigned_employee_phone = v_actor_phone,
    assigned_engineer_aadhaar = v_actor_aadhaar,
    expected_engineer_visit_at = p_expected_visit_at,
    assignment_visit_note = v_clean_visit_note,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    activity_type,
    notes,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_name,
    v_actor_role,
    'staff_self_assigned',
    'Engineer claimed enquiry and committed to visit schedule',
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'activity_id', v_activity_id,
    'assigned_to', v_actor_id,
    'assigned_employee_name', v_actor_name,
    'assigned_employee_code', v_actor_code,
    'assigned_engineer_aadhaar', v_actor_aadhaar,
    'expected_engineer_visit_at', p_expected_visit_at,
    'assignment_visit_note', v_clean_visit_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.employee_self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- 6. Update enquiry service completion proof RPCs to accept 'engineer'
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
  v_actor_id        UUID;
  v_actor_name      TEXT;
  v_actor_role      TEXT;
  v_actor_code      TEXT;
  v_actor_email     TEXT;
  v_enquiry         RECORD;
  v_proof           RECORD;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_activity_id     UUID;
  v_clean_notes     TEXT := pg_catalog.btrim(p_notes);
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'engineer', 'technical') THEN
    RAISE EXCEPTION 'Access denied: Authorized staff role required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_enquiry
  FROM   public.enquiries
  WHERE  id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_actor_role IN ('admin', 'engineer', 'technical') AND v_enquiry.assigned_to IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Access denied: You can only complete services for enquiries assigned to you.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_proof
  FROM   public.enquiry_service_proofs
  WHERE  id = p_proof_id AND enquiry_id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proof record not found for this enquiry.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_proof.proof_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Invalid proof state: Only pending_review proofs can be attached.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.enquiries
  SET
    status = 'resolved',
    active_proof_id = p_proof_id,
    proof_submitted_at = v_now,
    completion_requested_at = v_now,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_activities (
    enquiry_id,
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    activity_type,
    notes,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_actor_id,
    v_actor_email,
    v_actor_name,
    v_actor_role,
    'service_completion_requested',
    coalesce(v_clean_notes, 'Engineer submitted signed proof for Head review'),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', p_enquiry_id,
    'status', 'resolved',
    'active_proof_id', p_proof_id,
    'proof_submitted_at', v_now,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_enquiry_service_completion(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_enquiry_service_completion(UUID, UUID, TEXT) TO authenticated;

-- 7. Update RLS policies on public.admin_users so HR can view all staff profiles
DROP POLICY IF EXISTS "Superadmins can view all admin profiles" ON public.admin_users;
DROP POLICY IF EXISTS "Superadmins and HR can view all admin profiles" ON public.admin_users;
CREATE POLICY "Superadmins and HR can view all admin profiles"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR public.get_staff_role() = 'hr');
