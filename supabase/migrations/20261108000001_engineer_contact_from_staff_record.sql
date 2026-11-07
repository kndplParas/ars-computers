-- ============================================================================
-- ARS Computers — Customer-visible engineer contact from the staff record
-- Migration: 20261108000001_engineer_contact_from_staff_record.sql
-- ============================================================================
-- NOTE ON VERSIONING: the highest applied migration version is
-- 20261107000003 (require_email_in_create_customer_enquiry). This migration
-- is numbered 20261108000001 — unique and greater than every existing
-- migration. No applied migration was renamed or modified.
-- PURPOSE
--   The customer tracking card shows the assigned engineer's PHONE NUMBER
--   directly below the engineer name, sourced from the engineer's registered
--   staff/admin record instead of requiring staff to retype a number.
--
-- APPROVAL MODEL (Head assignment = customer-contact approval)
--   * public.assign_enquiry_employee / self_assign_enquiry (existing governed
--     RPCs) already snapshot the assigned engineer's registered staff phone
--     (admin_users.phone_number) into public.enquiries.assigned_employee_phone
--     at the moment of the Head-approved assignment. That snapshot therefore
--     IS the approved customer-contact number for the assigned engineer.
--   * The customer RPC now derives the customer-visible contact:
--       1. Staff-approved override wins — a number deliberately entered via
--          update_customer_visit_details (audit-preserving) is shown as-is.
--       2. Otherwise the assigned engineer's CURRENT registered staff phone
--          (admin_users.phone_number, only from the ACTIVE record of the
--          engineer listed on THAT enquiry) is shown, falling back to the
--          assignment snapshot when the live record has no number.
--       3. Enquiries without an assigned engineer expose no number at all.
--   * DEACTIVATION HIDES EVERYTHING: whenever the assigned engineer has no
--     ACTIVE admin_users record, the customer sees NO contact number at all
--     — including any staff-typed approved display number. A number can
--     never outlive its engineer's active employment.
--   * Staff can still explicitly HIDE the customer-visible number by saving
--     an empty contact in the visit-details panel. A new
--     engineer_contact_hidden flag distinguishes that deliberate hide from
--     "never set", so hiding always wins over the automatic derivation.
--
-- SECURITY
--   * No staff directory is exposed: the customer RPC reads exactly one
--     scalar (phone_number) from public.admin_users filtered to the assigned
--     employee's own PK (au.id = e.assigned_employee_id). No other columns —
--     no emails, employee codes or aadhaar — ever leave the database through
--     this path, and no query enumerates the staff table.
--   * Only self/Head-assignment flows produced the assignment snapshot; a
--     number can belong to exactly the engineer recorded on the enquiry.
--   * Deactivated staff records resolve no live phone (EXISTS gate) and the
--     snapshot fallback is dropped with them — the card then falls back to
--     "Contact number not yet available."
--   * Existing Head approval chain, assignment RPCs, RLS, permissions and
--     audit rows are NOT modified by this derivation. The new flag is
--     additive and every change of it keeps the full per-field audit trail.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Additive flag so an explicit staff "hide" beats the automatic derivation
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS engineer_contact_hidden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.enquiries.engineer_contact_hidden IS
  'True when staff deliberately cleared the customer-visible engineer contact. An explicit hide always wins over the automatic registered-staff-phone derivation.';

COMMENT ON COLUMN public.enquiries.engineer_contact_display IS
  'Customer-visible engineer contact number. NULL means "not deliberately set" — the customer RPC then derives the number from the assigned engineer''s registered staff record. Set/cleared by authorized staff only.';

-- ----------------------------------------------------------------------------
-- 2. Recreate list_customer_enquiries with the derived engineer contact.
--    Body is byte-identical to the applied 20261107000001 version (as fixed
--    by 20261107000002) except for the two marked DERIVATION blocks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_customer_enquiries(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
  v_session RECORD;
  v_channel TEXT;
  v_identifier TEXT;
BEGIN
  v_token := btrim(COALESCE(p_token, ''));
  IF v_token = '' OR char_length(v_token) > 64 THEN
    RAISE EXCEPTION 'Tracking session expired.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.customer_tracking_sessions
  WHERE expires_at < now() - interval '1 day';

  SELECT * INTO v_session
  FROM public.customer_tracking_sessions
  WHERE token_hash = pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tracking session expired.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_tracking_sessions
  SET last_used_at = now()
  WHERE id = v_session.id;

  v_identifier := v_session.identifier;
  v_channel := CASE
    WHEN v_identifier LIKE '%@%' THEN 'email'
    ELSE 'mobile'
  END;

  RETURN jsonb_build_object(
    'enquiries', COALESCE(
      (
        SELECT jsonb_agg(enquiry_data ORDER BY enquiry_data.submitted_at DESC)
        FROM (
          SELECT
            e.id AS enquiry_id,
            e.enquiry_number,
            COALESCE(NULLIF(trim(e.category_interest), ''), 'General Enquiry') AS subject,
            e.message AS description,
            -- Actual internal workflow state mapped to a customer-facing label.
            CASE
              WHEN e.status = 'rejected' THEN 'Closed'
              WHEN e.status = 'in_bin' THEN 'Closed'
              WHEN e.completion_approved_at IS NOT NULL
                OR e.status IN ('completed', 'closed', 'converted') THEN 'Service Completed'
              WHEN e.status = 'completion_requested' THEN 'Under Review'
              WHEN e.status = 'new' THEN 'Enquiry Received'
              WHEN e.customer_tracking_status = 'needs_info' THEN 'Waiting for Customer'
              WHEN e.status = 'quoted' THEN 'Under Review'
              WHEN e.status = 'in_progress'
                AND e.assigned_employee_name IS NOT NULL
                AND (e.expected_visit_at IS NOT NULL OR e.visit_status = 'scheduled')
                THEN 'Visit Scheduled'
              WHEN e.status = 'in_progress'
                AND e.assigned_employee_name IS NOT NULL THEN 'Engineer Assigned'
              WHEN e.status = 'in_progress' THEN 'In Progress'
              WHEN e.status IN ('returned_for_rework', 'rejection_requested') THEN 'Under Review'
              ELSE 'In Progress'
            END AS status_label,
            CASE
              WHEN e.status = 'rejected' THEN 'Your enquiry has been closed. Please contact ARS Computers for more information.'
              WHEN e.status = 'in_bin' THEN 'Your enquiry has been closed. Please contact ARS Computers for more information.'
              WHEN e.completion_approved_at IS NOT NULL
                OR e.status IN ('completed', 'closed', 'converted')
                THEN 'Your enquiry or service request has been completed.'
              WHEN e.status = 'completion_requested'
                THEN 'Reported work is under final review by our team.'
              WHEN e.status = 'new' THEN 'We have received your enquiry. Our team will contact you shortly.'
              WHEN e.customer_tracking_status = 'needs_info'
                THEN 'We need some additional information from you. Please contact ARS Computers.'
              WHEN e.status = 'quoted' THEN 'Our team has prepared review details. Please contact ARS Computers for your quotation.'
              WHEN e.status = 'in_progress'
                AND e.assigned_employee_name IS NOT NULL
                AND (e.expected_visit_at IS NOT NULL OR e.visit_status = 'scheduled')
                THEN 'An engineer has been assigned and your visit is scheduled.'
              WHEN e.status = 'in_progress'
                AND e.assigned_employee_name IS NOT NULL
                THEN 'An engineer has been assigned to your enquiry.'
              WHEN e.status = 'in_progress' THEN 'Our team is working on your request.'
              WHEN e.status IN ('returned_for_rework', 'rejection_requested')
                THEN 'Our team is reviewing your request.'
              WHEN e.visit_status = 'completed' THEN 'The service visit has been completed.'
              ELSE 'Our team is working on your request.'
            END AS status_explanation,
            e.created_at AS submitted_at,
            GREATEST(e.updated_at, e.customer_tracking_updated_at) AS updated_at,
            e.customer_tracking_status,
            e.assigned_employee_name,
            e.assigned_at,
            e.expected_visit_at,
            e.expected_arrival,
            e.visit_status,
            e.visit_progress_note,
            -- DERIVATION: customer-visible engineer contact.
            --   (a) Unassigned enquiries never expose a number.
            --   (b) A deliberate staff hide wins under all circumstances.
            --   (c) A deactivated assigned engineer hides EVERYTHING,
            --       including any staff-typed approved display number.
            --   (d) Otherwise a staff-set display number wins; else the
            --       engineer's registered staff phone (active admin_users
            --       record of THAT engineer only), with the assignment
            --       snapshot as last resort.
            CASE
              WHEN e.assigned_employee_id IS NULL THEN NULL
              WHEN e.engineer_contact_hidden THEN NULL
              WHEN NOT EXISTS (
                SELECT 1 FROM public.admin_users au
                WHERE au.id = e.assigned_employee_id AND au.is_active
              ) THEN NULL
              WHEN NULLIF(btrim(e.engineer_contact_display), '') IS NOT NULL
                THEN NULLIF(btrim(e.engineer_contact_display), '')
              ELSE COALESCE(
                (SELECT NULLIF(btrim(au.phone_number), '')
                 FROM public.admin_users au
                 WHERE au.id = e.assigned_employee_id AND au.is_active),
                e.assigned_employee_phone
              )
            END AS engineer_contact_display,
            e.service_completed_at,
            (
              SELECT jsonb_agg(jsonb_build_object(
                'kind', h.change_kind,
                'status', h.tracking_status,
                'previous_value', h.previous_value,
                'new_value', h.new_value,
                'updated_by', h.updated_by_name,
                'at', h.created_at
              ) ORDER BY h.created_at DESC)
              FROM (
                SELECT * FROM public.enquiry_tracking_history th
                WHERE th.enquiry_id = e.id
                ORDER BY th.created_at DESC
                LIMIT 12
              ) h
            ) AS timeline
          FROM public.enquiries e
          JOIN (
            SELECT id FROM public.tracking_enquiry_ids_for_identifier(v_channel, v_identifier)
          ) matched ON matched.id = e.id
          WHERE e.is_archived = false OR e.status <> 'in_bin' OR e.completion_approved_at IS NOT NULL
        ) enquiry_data
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- Service-role-only surface is unchanged and re-asserted.
REVOKE EXECUTE ON FUNCTION public.list_customer_enquiries(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_customer_enquiries(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Recreate update_customer_visit_details: clearing the contact is now an
--    explicit customer-visible HIDE (new flag), with the same staff guard,
--    per-field audit and forbidden-client revocations as before.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_customer_visit_details(
  p_enquiry_id UUID,
  p_engineer_contact TEXT,
  p_visit_status TEXT,
  p_visit_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_enquiry RECORD;
  v_contact TEXT;
  v_hidden BOOLEAN;
  v_visit_status TEXT;
  v_note TEXT;
  v_updated TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL OR NOT public.is_enquiry_management_staff() THEN
    RAISE EXCEPTION 'Access denied: authorized enquiry staff privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_contact := btrim(COALESCE(p_engineer_contact, ''));
  v_note := btrim(COALESCE(p_visit_note, ''));

  IF char_length(v_contact) > 40 THEN
    RAISE EXCEPTION 'Engineer contact number is too long.' USING ERRCODE = '22023';
  END IF;

  IF p_visit_status IS NOT NULL
     AND p_visit_status NOT IN ('scheduled', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid visit status.' USING ERRCODE = '22023';
  END IF;

  v_visit_status := p_visit_status;

  -- DERIVATION: saving an EMPTY contact is a deliberate customer-facing hide
  -- of the assigned engineer's auto-shared staff-record number. A non-empty
  -- value is a staff-approved override and clears the hide flag.
  IF v_contact = '' THEN
    v_contact := NULL;
    v_hidden := true;
  ELSE
    v_hidden := false;
  END IF;

  IF char_length(v_note) > 400 THEN
    v_note := left(v_note, 400);
  END IF;

  SELECT id, enquiry_number, engineer_contact_display, engineer_contact_hidden,
         visit_status, visit_progress_note
    INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), email), NULLIF(trim(employee_code), '')
    INTO v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  v_updated := now();

  UPDATE public.enquiries
  SET
    engineer_contact_display = v_contact,
    engineer_contact_hidden = v_hidden,
    visit_status = v_visit_status,
    visit_progress_note = NULLIF(v_note, ''),
    service_completed_at = CASE
      WHEN v_visit_status = 'completed' THEN COALESCE(service_completed_at, v_updated)
      WHEN v_visit_status IS DISTINCT FROM 'completed' THEN service_completed_at
      ELSE service_completed_at
    END
  WHERE id = p_enquiry_id;

  -- Separate audit row per changed field, preserving previous and new values.
  IF v_enquiry.engineer_contact_display IS DISTINCT FROM v_contact
     OR v_enquiry.engineer_contact_hidden IS DISTINCT FROM v_hidden THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'engineer_contact', v_enquiry.engineer_contact_display, v_contact,
      v_actor_id, v_actor_name, v_actor_code
    );
  END IF;

  IF v_enquiry.visit_status IS DISTINCT FROM v_visit_status THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'visit', v_enquiry.visit_status, v_visit_status,
      v_actor_id, v_actor_name, v_actor_code
    );
  END IF;

  IF v_enquiry.visit_progress_note IS DISTINCT FROM NULLIF(v_note, '') THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'note', v_enquiry.visit_progress_note, NULLIF(v_note, ''),
      v_actor_id, v_actor_name, v_actor_code
    );
  END IF;

  -- Also audit when nothing visibly changed, so every save is accounted for.
  IF v_enquiry.engineer_contact_display IS NOT DISTINCT FROM v_contact
     AND v_enquiry.engineer_contact_hidden IS NOT DISTINCT FROM v_hidden
     AND v_enquiry.visit_status IS NOT DISTINCT FROM v_visit_status
     AND v_enquiry.visit_progress_note IS NOT DISTINCT FROM NULLIF(v_note, '') THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'visit', v_enquiry.visit_status, v_visit_status,
      v_actor_id, v_actor_name, v_actor_code
    );
  END IF;

  RETURN jsonb_build_object(
    'id', p_enquiry_id,
    'enquiry_number', v_enquiry.enquiry_number,
    'engineer_contact_display', v_contact,
    'engineer_contact_hidden', v_hidden,
    'visit_status', v_visit_status,
    'visit_progress_note', NULLIF(v_note, ''),
    'updated_at', v_updated
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
