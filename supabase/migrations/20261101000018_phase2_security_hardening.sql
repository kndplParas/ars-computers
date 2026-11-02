-- ============================================================================
-- ARS Computers — Phase 2 Security Hardening & Defect Remediation
-- Migration: 20261101000018_phase2_security_hardening.sql
-- ============================================================================
-- 1. DROP deprecated 7-parameter legacy overload of public.create_sales_order
--    (which had unintended PUBLIC and anon execute grants).
-- 2. DROP deprecated 5-parameter legacy overload of public.register_order_attachment
--    (which caused PostgREST PGRST203 ambiguity against the 6-parameter version).
-- 3. Ensure the active 6-parameter register_order_attachment handles 5 & 6 args,
--    has execution revoked from PUBLIC and anon, and granted to authenticated & service_role.
-- 4. Correct public.record_order_payment implementation:
--    - Fixes regression where column was mistakenly referenced as amount_paid instead of paid_amount.
--    - Fixes column name recorded_by -> received_by in order_payments insertion.
--    - Preserves multi-role access (superadmin, admin, technical, engineer, hr, account).
-- 5. Correct public.update_enquiry_progress:
--    - Restores old_status and new_status attributes in return jsonb for workflow contracts.
--    - Preserves multi-role access (superadmin, admin, technical, engineer, hr, account).
-- 6. Correct public.request_enquiry_rejection:
--    - Restores persistence of previous_status, rejection_requested_by, and rejection_requested_at.
--    - Preserves multi-role access (superadmin, admin, technical, engineer, hr, account).
-- 7. Correct public.register_enquiry_service_proof:
--    - Restores complete return jsonb containing both id and proof_id, uploaded_by, and metadata.
--    - Restores standard error messages for MIME, assignment, and file size validation.
-- 8. Correct public.void_enquiry_service_proof:
--    - Restores voided_by, voided_by_name, void_reason, and message in return jsonb.
-- 9. Correct public.assign_enquiry_employee:
--    - Selects phone_number from admin_users (not phone).
--    - Returns standard action identifier (ENQUIRY_ASSIGNED / ENQUIRY_REASSIGNED).
-- 10. Correct public.submit_enquiry_completion:
--    - Updates completion_requested_by and completion_requested_at accurately.
--    - Permits unassigned general enquiries to be completed while keeping assigned
--      enquiries strictly locked to the assigned employee.
-- 11. Self-assign enquiry with full JSON representation and exact security invariants
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

  -- 2. Verify active employee identity
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
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

  -- 4. Unassigned check
  IF v_enquiry.assigned_employee_id IS NOT NULL AND v_enquiry.assigned_employee_id <> v_actor_id THEN
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
    assigned_to = v_actor_id,
    assigned_employee_name = COALESCE(v_actor_name, v_actor_email),
    assigned_employee_email = v_actor_email,
    assigned_employee_code = v_actor_code,
    assigned_employee_phone = v_actor_phone,
    assigned_employee_aadhaar = v_actor_aadhaar,
    assigned_engineer_aadhaar = v_actor_aadhaar,
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

  v_event_content := COALESCE(v_actor_name, v_actor_email) || ' self-assigned enquiry ' || COALESCE(v_enquiry.enquiry_number, v_enquiry.id::text);

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
    'expected_visit_at', p_expected_visit_at,
    'expected_arrival', v_clean_arrival,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;

-- 13. Restore assignment immutability on approved completed enquiries in protect_enquiry_customer_and_archive_immutability
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
      RAISE EXCEPTION 'Permanent archive protection: completion_approved_by identity UUID cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver name snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver employee code snapshot cannot be modified.' USING ERRCODE = 'check_violation';
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
    -- Rule: Approved completed enquiries cannot be soft-removed
    IF NEW.is_removed = true AND (OLD.is_removed IS FALSE OR OLD.is_removed IS NULL) THEN
      RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.' USING ERRCODE = 'check_violation';
    END IF;

    -- Strict Assignment Immutability on Completed Records
    IF NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id OR
       NEW.assigned_employee_name IS DISTINCT FROM OLD.assigned_employee_name OR
       NEW.assigned_employee_code IS DISTINCT FROM OLD.assigned_employee_code OR
       NEW.assigned_employee_phone IS DISTINCT FROM OLD.assigned_employee_phone OR
       NEW.assigned_engineer_aadhaar IS DISTINCT FROM OLD.assigned_engineer_aadhaar OR
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

-- 12. Harden mask_ip_address permissions (revoke from PUBLIC and anon).
-- 12. Backfill initial downpayment records for any historical/test orders lacking
--     them to enforce strict ledger consistency.
-- ============================================================================

-- 1. DROP deprecated legacy create_sales_order overload (7 params)
DROP FUNCTION IF EXISTS public.create_sales_order(
  p_customer_name TEXT,
  p_contact_info TEXT,
  p_delivery_address TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_initial_amount_paid NUMERIC,
  p_notes TEXT
);

-- Ensure active 9-parameter version has correct permissions
REVOKE ALL ON FUNCTION public.create_sales_order(
  TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_sales_order(
  TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;

-- 2. DROP deprecated legacy register_order_attachment overload (5 params)
DROP FUNCTION IF EXISTS public.register_order_attachment(
  p_order_id UUID,
  p_storage_path TEXT,
  p_original_filename TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT
);

-- Re-assert permissions on active 6-parameter register_order_attachment
REVOKE ALL ON FUNCTION public.register_order_attachment(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.register_order_attachment(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT
) TO authenticated, service_role;

-- 3. Re-implement record_order_payment with correct schema bindings & role permissions
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
  v_actor_code TEXT;
  v_order RECORD;
  v_clean_method TEXT;
  v_new_paid NUMERIC(12, 2);
  v_remaining NUMERIC(12, 2);
  v_new_status TEXT;
  v_payment_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity and role
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active staff privileges required to record payments.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock and retrieve order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order % does not exist.', p_order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Validation error: Cannot record payments for a cancelled order.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Validate amount received
  IF p_amount_received IS NULL OR p_amount_received <= 0 THEN
    RAISE EXCEPTION 'Validation error: Payment amount must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Calculate remaining balance and prevent overpayment
  v_remaining := v_order.total_amount - COALESCE(v_order.paid_amount, 0);
  IF p_amount_received > v_remaining THEN
    RAISE EXCEPTION 'Validation error: Payment amount exceeds remaining balance due.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Clean payment method
  v_clean_method := pg_catalog.btrim(pg_catalog.lower(COALESCE(p_payment_method, 'cash')));
  IF v_clean_method NOT IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Validation error: Invalid payment method "%".', p_payment_method
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Compute new paid amount and status
  v_new_paid := COALESCE(v_order.paid_amount, 0) + p_amount_received;
  IF v_new_paid >= v_order.total_amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- 8. Insert immutable payment transaction
  INSERT INTO public.order_payments (
    order_id,
    amount_received,
    payment_method,
    transaction_reference,
    remarks,
    received_by,
    received_by_name,
    received_by_employee_code,
    received_at,
    created_at
  ) VALUES (
    p_order_id,
    p_amount_received,
    v_clean_method,
    pg_catalog.btrim(p_transaction_reference),
    pg_catalog.btrim(p_remarks),
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    v_now,
    v_now
  )
  RETURNING id INTO v_payment_id;

  -- 9. Update order paid_amount and payment_status
  UPDATE public.orders
  SET
    paid_amount = v_new_paid,
    payment_status = v_new_status,
    updated_at = v_now
  WHERE id = p_order_id;

  -- 10. Record order activity entry
  INSERT INTO public.order_activities (
    order_id,
    actor_id,
    actor_email,
    actor_role,
    activity_type,
    content,
    metadata,
    created_at
  ) VALUES (
    p_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_PAYMENT_RECORDED',
    'Payment of ₹' || p_amount_received::text || ' received via ' || pg_catalog.upper(v_clean_method),
    pg_catalog.jsonb_build_object(
      'payment_id', v_payment_id,
      'amount_received', p_amount_received,
      'payment_method', v_clean_method,
      'transaction_reference', p_transaction_reference,
      'new_paid_amount', v_new_paid,
      'new_balance', (v_order.total_amount - v_new_paid),
      'payment_status', v_new_status
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_id', v_payment_id,
    'amount_received', p_amount_received,
    'total_amount', v_order.total_amount,
    'paid_amount', v_new_paid,
    'balance_due', (v_order.total_amount - v_new_paid),
    'payment_status', v_new_status,
    'payment_method', v_clean_method
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 4. Correct update_enquiry_progress return jsonb attributes
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
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
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

  IF v_current_status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry has a pending rejection review. Complete or cancel the review before changing progress.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_current_status = 'completion_requested' THEN
    RAISE EXCEPTION 'Invalid operation: Enquiry has a pending completion review.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_actor_role != 'superadmin' THEN
    IF p_next_status NOT IN ('new', 'in_progress', 'quoted') THEN
      RAISE EXCEPTION 'Unauthorized transition: Employees can only progress enquiries to "new", "in_progress", or "quoted".'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_current_status IN ('closed', 'converted', 'rejected') THEN
      RAISE EXCEPTION 'Unauthorized transition: Employees cannot reopen completed or terminal enquiries.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF p_next_status NOT IN ('new', 'in_progress', 'quoted', 'converted', 'closed', 'returned_for_rework') THEN
      RAISE EXCEPTION 'Invalid target progress status: %', p_next_status USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_current_status = p_next_status THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'status', p_next_status,
      'new_status', p_next_status,
      'old_status', v_current_status,
      'message', 'Status is already set to ' || p_next_status
    );
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

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', p_next_status,
    'new_status', p_next_status,
    'old_status', v_current_status,
    'activity_id', v_activity_id,
    'message', 'Progress updated to ' || p_next_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_enquiry_progress(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_enquiry_progress(UUID, TEXT) TO authenticated, service_role;

-- 5. Correct request_enquiry_rejection implementation to preserve previous_status & metadata
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
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_activity_id UUID;
BEGIN
  -- 1. Authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Role Verification
  SELECT email, role INTO v_actor_email, v_actor_role
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authorized staff privileges required to request rejection.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate reason
  v_clean_reason := pg_catalog.btrim(p_reason);
  IF v_clean_reason IS NULL OR pg_catalog.char_length(v_clean_reason) < 5 OR pg_catalog.char_length(v_clean_reason) > 1000 THEN
    RAISE EXCEPTION 'Validation error: A mandatory rejection reason between 5 and 1000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Lock enquiry row
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found: Enquiry does not exist.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_enquiry.is_archived THEN
    RAISE EXCEPTION 'Invalid operation: Cannot request rejection for an archived enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status = 'rejection_requested' THEN
    RAISE EXCEPTION 'Conflict: A rejection request is already pending review for this enquiry.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_enquiry.status IN ('rejected', 'closed', 'completed') THEN
    RAISE EXCEPTION 'Invalid state: Enquiry is already closed, rejected, or completed.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Atomically update status, preserve previous_status and record requester
  UPDATE public.enquiries
  SET
    previous_status = v_enquiry.status,
    status = 'rejection_requested',
    rejection_reason = v_clean_reason,
    rejection_requested_by = v_actor_id,
    rejection_requested_at = v_now,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- 6. Insert immutable activity record
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
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'rejection_requested',
    'activity_id', v_activity_id,
    'message', 'Rejection request submitted for head-person review.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_enquiry_rejection(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_enquiry_rejection(UUID, TEXT) TO authenticated, service_role;

-- 6. Correct register_enquiry_service_proof implementation to restore full return JSON & error strings
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
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity and role
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to register service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock and retrieve enquiry
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

  -- 4. Assignment Check: non-superadmin can only upload to assigned enquiry
  IF v_actor_role <> 'superadmin' THEN
    IF v_enquiry.assigned_employee_id IS NULL OR (v_enquiry.assigned_employee_id IS DISTINCT FROM v_actor_id AND v_enquiry.assigned_to IS DISTINCT FROM v_actor_id) THEN
      RAISE EXCEPTION 'Access denied: Employees may only upload service proofs for enquiries assigned to them.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 5. Storage Path Integrity
  IF p_storage_path IS NULL OR pg_catalog.btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'Validation error: storage_path cannot be empty.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_storage_path LIKE '%..%' OR p_storage_path LIKE '%\%' OR p_storage_path LIKE '%//%' THEN
    RAISE EXCEPTION 'Validation error: Malformed or malicious storage path detected.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_path_enquiry_id := pg_catalog.split_part(p_storage_path, '/', 1);
  IF v_path_enquiry_id <> p_enquiry_id::TEXT THEN
    RAISE EXCEPTION 'Validation error: Storage path folder (%) does not match enquiry ID (%).',
      v_path_enquiry_id, p_enquiry_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Document Type Check
  v_clean_doctype := pg_catalog.btrim(pg_catalog.upper(COALESCE(p_document_type, 'CUSTOMER_SIGNED_SERVICE_REPORT')));
  IF v_clean_doctype NOT IN (
    'CUSTOMER_SIGNED_SERVICE_REPORT',
    'EQUIPMENT_SERIAL_PHOTO',
    'FAULT_DIAGNOSTIC_REPORT',
    'PARTS_REPLACEMENT_RECEIPT',
    'CUSTOMER_SITE_DISPATCH_PROOF',
    'DELIVERY_CHALLAN',
    'OTHER'
  ) THEN
    RAISE EXCEPTION 'Validation error: Invalid document type "%".', p_document_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. MIME type check
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN
    RAISE EXCEPTION 'Validation error: Unsupported MIME type (%). Only image/jpeg, image/png, and application/pdf are permitted.', p_mime_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 8. File size check
  IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 OR p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Validation error: File size (% bytes) exceeds maximum limit of 10 MB (10485760 bytes).', p_file_size_bytes
      USING ERRCODE = 'check_violation';
  END IF;

  -- 9. Clean filename and description
  v_clean_filename := pg_catalog.btrim(COALESCE(p_original_filename, 'attachment'));
  v_clean_desc     := pg_catalog.btrim(p_description);

  -- 10. Insert proof record
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
    v_now
  ) RETURNING id INTO v_proof_id;

  -- 11. Log activity
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

  -- 12. Return full JSON representation
  RETURN pg_catalog.jsonb_build_object(
    'success',                   true,
    'id',                        v_proof_id,
    'proof_id',                  v_proof_id,
    'enquiry_id',                p_enquiry_id,
    'storage_path',              p_storage_path,
    'original_filename',         v_clean_filename,
    'mime_type',                 p_mime_type,
    'file_size_bytes',           p_file_size_bytes,
    'document_type',             v_clean_doctype,
    'uploaded_by',               v_actor_id,
    'uploaded_by_name',          COALESCE(v_actor_name, v_actor_email),
    'uploaded_by_employee_code', v_actor_code,
    'uploaded_at',               v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_enquiry_service_proof(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_enquiry_service_proof(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO authenticated, service_role;

-- 8. Correct void_enquiry_service_proof return jsonb attributes
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
    RAISE EXCEPTION 'Access denied: Active staff privileges required to void service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(p_void_reason);
  IF v_clean_reason IS NULL OR pg_catalog.char_length(v_clean_reason) < 5 THEN
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
    'success',        true,
    'proof_id',       p_proof_id,
    'is_voided',      true,
    'voided_at',      v_now,
    'voided_by',      v_actor_id,
    'voided_by_name', COALESCE(v_actor_name, v_actor_email),
    'void_reason',    v_clean_reason,
    'message',        'Service proof successfully voided.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_enquiry_service_proof(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_enquiry_service_proof(UUID, TEXT) TO authenticated, service_role;

-- 9. Correct assign_enquiry_employee to use phone_number and standard action strings
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
SET search_path = ''
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

  -- 2. Lock enquiry row for atomic update
  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Enquiry % does not exist.', p_enquiry_id
      USING ERRCODE = 'no_data_found';
  END IF;

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

  -- 3. UNASSIGNMENT BRANCH
  IF p_employee_id IS NULL THEN
    IF v_enquiry.assigned_employee_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'action', 'unassigned',
        'message', 'Enquiry is already unassigned.',
        'enquiry_id', p_enquiry_id
      );
    END IF;

    UPDATE public.enquiries
    SET
      assigned_employee_id = NULL,
      assigned_to = NULL,
      assigned_employee_name = NULL,
      assigned_employee_code = NULL,
      assigned_employee_phone = NULL,
      assigned_employee_aadhaar = NULL,
      assigned_engineer_aadhaar = NULL,
      assigned_at = NULL,
      assigned_by = NULL,
      assigned_by_name = NULL,
      expected_visit_at = NULL,
      expected_arrival = NULL,
      assignment_visit_note = NULL,
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
      'ENQUIRY_UNASSIGNED',
      'Unassigned by ' || COALESCE(v_actor_name, v_actor_email) ||
        CASE WHEN v_clean_reason IS NOT NULL AND v_clean_reason <> '' THEN ' (Reason: ' || v_clean_reason || ')' ELSE '' END,
      pg_catalog.jsonb_build_object(
        'enquiry_number', v_enquiry.enquiry_number,
        'unassigned_by_id', v_actor_id,
        'unassigned_by_name', COALESCE(v_actor_name, v_actor_email),
        'previous_assigned_id', v_enquiry.assigned_employee_id,
        'previous_assigned_name', v_enquiry.assigned_employee_name,
        'reason', v_clean_reason,
        'unassigned_at', v_now
      ),
      v_now
    ) RETURNING id INTO v_activity_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'action', 'unassigned',
      'enquiry_id', p_enquiry_id,
      'assigned_employee_id', NULL,
      'activity_id', v_activity_id
    );
  END IF;

  -- 4. Target Staff Verification
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_target_email, v_target_role, v_target_name, v_target_code, v_target_phone, v_target_aadhaar
  FROM public.admin_users
  WHERE id = p_employee_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Target employee % is not an active staff member.', p_employee_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_target_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Invalid role: Target employee must hold an operational staff role.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Determine assignment event type
  IF v_enquiry.assigned_employee_id IS NULL THEN
    v_event_type := 'ENQUIRY_ASSIGNED';
    v_event_content := 'Enquiry assigned to ' || COALESCE(v_target_name, v_target_email) ||
      ' by ' || COALESCE(v_actor_name, v_actor_email);
  ELSE
    v_event_type := 'ENQUIRY_REASSIGNED';
    v_event_content := 'Enquiry reassigned from ' || COALESCE(v_enquiry.assigned_employee_name, 'previous staff') ||
      ' to ' || COALESCE(v_target_name, v_target_email) || ' by ' || COALESCE(v_actor_name, v_actor_email);
  END IF;

  IF v_clean_reason IS NOT NULL AND v_clean_reason <> '' THEN
    v_event_content := v_event_content || ' (Reason: ' || v_clean_reason || ')';
  END IF;

  -- 5. Atomic Update
  UPDATE public.enquiries
  SET
    assigned_employee_id = p_employee_id,
    assigned_to = p_employee_id,
    assigned_employee_name = COALESCE(v_target_name, v_target_email),
    assigned_employee_code = v_target_code,
    assigned_employee_phone = v_target_phone,
    assigned_employee_aadhaar = v_target_aadhaar,
    assigned_engineer_aadhaar = v_target_aadhaar,
    assigned_at = v_now,
    assigned_by = v_actor_id,
    assigned_by_name = COALESCE(v_actor_name, v_actor_email),
    expected_visit_at = p_expected_visit_at,
    expected_arrival = v_clean_arrival,
    assignment_visit_note = v_clean_visit_note,
    updated_at = v_now
  WHERE id = p_enquiry_id;

  -- 6. Insert Activity Record
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
    'action', v_event_type,
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
GRANT EXECUTE ON FUNCTION public.assign_enquiry_employee(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;

-- 10. Refine submit_enquiry_completion assignment check and column bindings
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
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_is_service      BOOLEAN;
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User must be signed in.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity
  SELECT email, role, full_name, employee_code
  INTO   v_actor_email, v_actor_role, v_actor_name, v_actor_code
  FROM   public.admin_users au
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator or technician privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate completion summary
  v_clean_summary := pg_catalog.btrim(p_completion_summary);
  IF v_clean_summary IS NULL OR pg_catalog.char_length(v_clean_summary) < 10 OR pg_catalog.char_length(v_clean_summary) > 3000 THEN
    RAISE EXCEPTION 'Validation error: A meaningful work-completion summary between 10 and 3000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Lock enquiry row
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

  -- Assignment Check: Non-superadmins can only complete enquiries assigned to them if assigned
  IF v_actor_role <> 'superadmin' THEN
    IF v_enquiry.assigned_employee_id IS NOT NULL AND v_enquiry.assigned_employee_id <> v_actor_id AND v_enquiry.assigned_to <> v_actor_id THEN
      RAISE EXCEPTION 'Access denied: You can only complete services for enquiries assigned to you.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
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

  -- 5. Service Proof Gate
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

  -- 6. Atomically update status and snapshot submitter
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

  -- 7. Insert Activity Record
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
      'previous_status',    v_enquiry.status,
      'completion_summary', v_clean_summary,
      'submitted_by_id',    v_actor_id,
      'requested_by_email', v_actor_email,
      'requested_by_name',  COALESCE(v_actor_name, v_actor_email),
      'employee_code',      v_actor_code,
      'enquiry_type',       v_enquiry.enquiry_type,
      'is_service',         v_is_service
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success',                    true,
    'enquiry_id',                 p_enquiry_id,
    'status',                     'completion_requested',
    'activity_id',                v_activity_id,
    'completed_by_name',          COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code,
    'message',                    'Work-completion summary submitted for head-person review.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) TO authenticated, service_role;

-- 11. Self-assign enquiry with full JSON representation and exact security invariants
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

  -- 2. Verify active employee identity
  SELECT email, role, full_name, employee_code, phone_number, aadhaar_number
  INTO v_actor_email, v_actor_role, v_actor_name, v_actor_code, v_actor_phone, v_actor_aadhaar
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account') THEN
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

  -- 4. Unassigned check
  IF v_enquiry.assigned_employee_id IS NOT NULL AND v_enquiry.assigned_employee_id <> v_actor_id THEN
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
    assigned_to = v_actor_id,
    assigned_employee_name = COALESCE(v_actor_name, v_actor_email),
    assigned_employee_email = v_actor_email,
    assigned_employee_code = v_actor_code,
    assigned_employee_phone = v_actor_phone,
    assigned_employee_aadhaar = v_actor_aadhaar,
    assigned_engineer_aadhaar = v_actor_aadhaar,
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

  v_event_content := COALESCE(v_actor_name, v_actor_email) || ' self-assigned enquiry ' || COALESCE(v_enquiry.enquiry_number, v_enquiry.id::text);

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
    'expected_visit_at', p_expected_visit_at,
    'expected_arrival', v_clean_arrival,
    'activity_id', v_activity_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_enquiry(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;

-- 13. Restore assignment immutability on approved completed enquiries in protect_enquiry_customer_and_archive_immutability
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
      RAISE EXCEPTION 'Permanent archive protection: completion_approved_by identity UUID cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver name snapshot cannot be modified.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code THEN
      RAISE EXCEPTION 'Permanent archive protection: Approver employee code snapshot cannot be modified.' USING ERRCODE = 'check_violation';
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
    -- Rule: Approved completed enquiries cannot be soft-removed
    IF NEW.is_removed = true AND (OLD.is_removed IS FALSE OR OLD.is_removed IS NULL) THEN
      RAISE EXCEPTION 'Permanent record protection: Completed and approved enquiries cannot be removed.' USING ERRCODE = 'check_violation';
    END IF;

    -- Strict Assignment Immutability on Completed Records
    IF NEW.assigned_employee_id IS DISTINCT FROM OLD.assigned_employee_id OR
       NEW.assigned_employee_name IS DISTINCT FROM OLD.assigned_employee_name OR
       NEW.assigned_employee_code IS DISTINCT FROM OLD.assigned_employee_code OR
       NEW.assigned_employee_phone IS DISTINCT FROM OLD.assigned_employee_phone OR
       NEW.assigned_engineer_aadhaar IS DISTINCT FROM OLD.assigned_engineer_aadhaar OR
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

-- 12. Harden mask_ip_address permissions
REVOKE ALL ON FUNCTION public.mask_ip_address(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mask_ip_address(TEXT) TO authenticated, service_role;

-- 12. Ensure initial downpayment ledger records exist for all orders with paid_amount > 0
INSERT INTO public.order_payments (
  order_id,
  amount_received,
  payment_method,
  transaction_reference,
  remarks,
  received_by,
  received_by_name,
  received_by_employee_code,
  received_at,
  created_at
)
SELECT
  o.id,
  o.paid_amount,
  CASE
    WHEN o.payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN o.payment_method
    ELSE 'cash'
  END,
  'INITIAL_DOWNPAYMENT',
  'Initial downpayment recorded during order creation',
  COALESCE(o.created_by, (SELECT id FROM public.admin_users WHERE role = 'superadmin' LIMIT 1)),
  COALESCE(o.created_by_name, 'Store Administrator'),
  COALESCE(o.created_by_employee_code, 'ARS-HEAD-001'),
  o.created_at,
  o.created_at
FROM public.orders o
WHERE o.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_payments op
    WHERE op.order_id = o.id
      AND op.transaction_reference IN ('HISTORICAL_INITIAL_PAYMENT', 'INITIAL_DOWNPAYMENT')
  );
