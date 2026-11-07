-- ============================================================================
-- ARS Computers — Engineer-contact hide/show audit alignment
-- Migration: 20261108000002_engineer_contact_hide_audit_alignment.sql
-- ============================================================================
-- VERSIONING: the highest applied production version is 20261108000001
-- (engineer_contact_from_staff_record). This migration is numbered
-- 20261108000002 — unique and greater than every applied migration
-- (candidate version verified absent from remote history before drafting).
--
-- BACKGROUND
--   Production history already contains 20261108000001, applied from its
--   pre-audit-correction draft. Its reviewed correction introduced two
--   pieces that did NOT reach production:
--     1. the widened enquiry_tracking_history.change_kind constraint, and
--     2. update_customer_visit_details recreated with a DEDICATED
--        engineer_contact_hidden audit row — previous/new boolean values
--        and full actor identity — so a hide/show remains auditable even
--        when engineer_contact_display is NULL before and after.
--   This migration delivers ONLY those two pieces. Everything else from the
--   engineer-contact feature (the engineer_contact_hidden flag, the
--   customer RPC derivation with hide/deactivation branches, function
--   grants/revokes, audit-table RLS and policies) is already verified live
--   in production and is NOT repeated or altered here.
--
-- SAFETY
--   * No applied migration file is modified. This is a NEW additive delta.
--   * The recreated function body is identical to the approved
--     20261108000001 section-3 version: same signature, same staff guard,
--     same length caps, same per-field audit, same "no-op save" audit row,
--     same RETURN payload, same grants/revokes (re-asserted defensively).
--   * The widened constraint list is a strict superset of the list already
--     enforced in production — every previously allowed value remains
--     allowed, so re-validating existing rows cannot fail.
--   * No customer data, Auth users, passwords, assignments, approvals or
--     unrelated tables are touched. No RLS policies or triggers change.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Widen the tracking-history change_kind constraint additively.
--    Production currently enforces ('status', 'engineer_contact', 'visit',
--    'note'); the widened list preserves all four values and adds exactly
--    one: 'engineer_contact_hidden'.
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_tracking_history
  DROP CONSTRAINT IF EXISTS enquiry_tracking_history_change_kind_check;

ALTER TABLE public.enquiry_tracking_history
  ADD CONSTRAINT enquiry_tracking_history_change_kind_check
  CHECK (change_kind IS NULL OR change_kind IN (
    'status', 'engineer_contact', 'engineer_contact_hidden', 'visit', 'note'
  ));

COMMENT ON COLUMN public.enquiry_tracking_history.change_kind IS
  'status | engineer_contact | engineer_contact_hidden | visit | note — what kind of customer-facing change was recorded. engineer_contact_hidden rows record the previous and new value of enquiries.engineer_contact_hidden as text booleans (''true''/''false'').';

-- ----------------------------------------------------------------------------
-- 2. Recreate update_customer_visit_details with the dedicated
--    engineer_contact_hidden audit row. Signature, staff guard, validation,
--    per-field audit behavior and grants/revokes are identical to the
--    approved 20261108000001 section-3 version. The only behavioral change
--    vs. the currently-applied production function: hide/show transitions
--    of the engineer_contact_hidden flag get their own audit row with the
--    previous and new boolean values (as text), guarded only by the flag
--    itself, while the engineer_contact row now records the display value
--    only. Nothing else about the function changes.
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
  -- DERIVATION AUDIT: the engineer_contact row carries the customer-visible
  -- DISPLAY value only. Hide/show transitions of the engineer_contact_hidden
  -- flag get a DEDICATED audit row with the previous and new boolean values
  -- (as text), guarded only by the flag itself — so a hide/show remains fully
  -- auditable even when engineer_contact_display is NULL before and after.
  IF v_enquiry.engineer_contact_display IS DISTINCT FROM v_contact THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'engineer_contact', v_enquiry.engineer_contact_display, v_contact,
      v_actor_id, v_actor_name, v_actor_code
    );
  END IF;

  IF v_enquiry.engineer_contact_hidden IS DISTINCT FROM v_hidden THEN
    INSERT INTO public.enquiry_tracking_history (
      enquiry_id, change_kind, previous_value, new_value,
      updated_by, updated_by_name, updated_by_employee_code
    ) VALUES (
      p_enquiry_id, 'engineer_contact_hidden',
      v_enquiry.engineer_contact_hidden::TEXT, v_hidden::TEXT,
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

-- Same authorization surface as before, re-asserted.
REVOKE EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
