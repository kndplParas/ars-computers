-- ============================================================================
-- ARS Computers — Customer enquiry tracking
-- Migration: 20261106000003_enquiry_customer_tracking.sql
-- ============================================================================
-- Adds a customer-facing, read-safe tracking status without changing the
-- internal enquiry workflow, Head approval, assignment, archive or audit logic.
--
-- Security:
--   * Public users cannot select enquiries directly.
--   * Public tracking is only through track_enquiry(ID, mobile), which fails
--     generically for invalid combinations and rate-limits guesses.
--   * Admin updates are only through update_customer_tracking_status(), limited
--     to the operations roles that can already manage enquiries.
--   * Internal notes, staff details, contact data and history are not exposed
--     through public tracking output.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Role guard for customer-facing tracking updates
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_enquiry_management_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.get_staff_role() IN ('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_enquiry_management_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_enquiry_management_staff() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Add customer-facing tracking columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_tracking_status TEXT NOT NULL DEFAULT 'received';

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_tracking_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_tracking_updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_tracking_updated_by_name TEXT;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_tracking_updated_by_code TEXT;

ALTER TABLE public.enquiries
  DROP CONSTRAINT IF EXISTS enquiries_customer_tracking_status_check;

ALTER TABLE public.enquiries
  ADD CONSTRAINT enquiries_customer_tracking_status_check
  CHECK (customer_tracking_status IN ('received', 'in_progress', 'needs_info', 'completed'));

-- Existing internal states are mapped once to the closest customer-facing state.
-- Approved/closed completion is the only automatic completion signal; other
-- terminal requests are exposed as in-progress until staff explicitly update them.
UPDATE public.enquiries
SET customer_tracking_status = CASE
  WHEN completion_approved_at IS NOT NULL OR status IN ('completed', 'closed', 'converted') THEN 'completed'
  WHEN status = 'new' THEN 'received'
  ELSE 'in_progress'
END
WHERE customer_tracking_status = 'received';

COMMENT ON COLUMN public.enquiries.customer_tracking_status IS
  'Customer-facing tracking status only: received | in_progress | needs_info | completed. Does not replace or bypass internal approval workflows.';
COMMENT ON COLUMN public.enquiries.customer_tracking_updated_at IS
  'Timestamp of the latest customer-facing tracking update.';
COMMENT ON COLUMN public.enquiries.customer_tracking_updated_by IS
  'Staff auth user who last changed customer_tracking_status.';
COMMENT ON COLUMN public.enquiries.customer_tracking_updated_by_name IS
  'Snapshot of staff name at tracking update time.';
COMMENT ON COLUMN public.enquiries.customer_tracking_updated_by_code IS
  'Snapshot of staff employee code at tracking update time.';

-- ----------------------------------------------------------------------------
-- 3. Tracking history (append-only audit records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_tracking_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  previous_status TEXT,
  tracking_status TEXT NOT NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  updated_by_employee_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enquiry_tracking_history_status_check
    CHECK (tracking_status IN ('received', 'in_progress', 'needs_info', 'completed')),
  CONSTRAINT enquiry_tracking_history_previous_status_check
    CHECK (previous_status IS NULL OR previous_status IN ('received', 'in_progress', 'needs_info', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_enquiry_tracking_history_enquiry_created
  ON public.enquiry_tracking_history (enquiry_id, created_at DESC);

ALTER TABLE public.enquiry_tracking_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.enquiry_tracking_history FROM PUBLIC, anon;
GRANT SELECT ON public.enquiry_tracking_history TO authenticated;

DROP POLICY IF EXISTS "Enquiry management staff can view tracking history" ON public.enquiry_tracking_history;
CREATE POLICY "Enquiry management staff can view tracking history"
  ON public.enquiry_tracking_history
  FOR SELECT
  TO authenticated
  USING (public.is_enquiry_management_staff());

-- ----------------------------------------------------------------------------
-- 4. Public lookup attempt throttle (no customer data stored)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_tracking_attempts (
  identifier TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No direct public access. Only track_enquiry() may read or write it.
REVOKE ALL ON public.enquiry_tracking_attempts FROM PUBLIC, anon, authenticated;

-- Remove expired throttle rows opportunistically inside the RPC; no cron required.

-- ----------------------------------------------------------------------------
-- 5. Sanitized public enquiry creation RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_customer_enquiry(
  p_name TEXT,
  p_contact_info TEXT,
  p_category_interest TEXT,
  p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_number TEXT;
  v_name TEXT;
  v_contact TEXT;
  v_category TEXT;
  v_message TEXT;
BEGIN
  v_name := left(trim(COALESCE(p_name, '')), 120);
  v_contact := left(trim(COALESCE(p_contact_info, '')), 200);
  v_category := left(trim(COALESCE(p_category_interest, '')), 80);
  v_message := left(trim(COALESCE(p_message, '')), 2000);

  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Please enter a valid name.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_contact) < 5 THEN
    RAISE EXCEPTION 'Please enter a valid phone number or email.' USING ERRCODE = '22023';
  END IF;
  IF v_contact !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     AND regexp_replace(v_contact, '[^0-9]', '', 'g') !~ '^[0-9]{10,15}$' THEN
    RAISE EXCEPTION 'Please provide a valid email address or phone number.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_message) < 5 THEN
    RAISE EXCEPTION 'Please provide brief details of your requirement.' USING ERRCODE = '22023';
  END IF;

  -- Insert with normal status/defaults. enquiry_number is generated by the
  -- existing database default/sequence.
  INSERT INTO public.enquiries (
    name,
    contact_info,
    category_interest,
    message,
    status
  ) VALUES (
    v_name,
    v_contact,
    NULLIF(v_category, ''),
    v_message,
    'new'
  )
  RETURNING id, enquiry_number INTO v_id, v_number;

  RETURN jsonb_build_object(
    'id', v_id,
    'enquiry_number', v_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_customer_enquiry(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_customer_enquiry(TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_enquiry(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Secure public tracking lookup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_enquiry(
  p_enquiry_id TEXT,
  p_registered_mobile TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id TEXT;
  v_phone TEXT;
  v_key TEXT;
  v_attempts INTEGER;
  v_window_start TIMESTAMPTZ;
  v_last BOOLEAN := false;
  v_record RECORD;
  v_contact_digits TEXT;
BEGIN
  v_id := upper(trim(COALESCE(p_enquiry_id, '')));
  v_phone := trim(COALESCE(p_registered_mobile, ''));

  -- Input validation only; error text stays generic and does not reveal validity.
  IF v_id !~ '^ARS-ENQ-[0-9]{4,10}$' THEN
    RAISE EXCEPTION 'Invalid enquiry ID or registered mobile number.' USING ERRCODE = '22023';
  END IF;

  v_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF char_length(v_phone) < 10 OR char_length(v_phone) > 15 THEN
    RAISE EXCEPTION 'Invalid enquiry ID or registered mobile number.' USING ERRCODE = '22023';
  END IF;

  -- Throttle invalid lookups for this enquiry reference.
  v_key := md5(v_id);
  DELETE FROM public.enquiry_tracking_attempts
  WHERE window_started_at < now() - interval '30 minutes';

  SELECT failed_count, window_started_at
    INTO v_attempts, v_window_start
  FROM public.enquiry_tracking_attempts
  WHERE identifier = v_key
  FOR UPDATE;

  IF v_attempts IS NOT NULL
     AND v_window_start >= now() - interval '15 minutes'
     AND v_attempts >= 5 THEN
    RAISE EXCEPTION 'Invalid enquiry ID or registered mobile number.' USING ERRCODE = '22023';
  END IF;

  SELECT id, enquiry_number, category_interest, created_at,
         customer_tracking_status, customer_tracking_updated_at, contact_info, status
    INTO v_record
  FROM public.enquiries
  WHERE enquiry_number = v_id;

  IF NOT FOUND THEN
    v_last := true;
  ELSE
    v_contact_digits := regexp_replace(COALESCE(v_record.contact_info, ''), '[^0-9]', '', 'g');
    -- Indian mobiles may be stored with +91 or without; compare rightmost 10 digits.
    IF v_contact_digits < 10
       OR right(v_contact_digits, 10) <> right(v_phone, 10) THEN
      v_last := true;
    END IF;
  END IF;

  IF v_last THEN
    IF v_attempts IS NULL THEN
      INSERT INTO public.enquiry_tracking_attempts (identifier, failed_count, window_started_at, last_attempt_at)
      VALUES (v_key, 1, now(), now());
    ELSIF v_window_start < now() - interval '15 minutes' THEN
      UPDATE public.enquiry_tracking_attempts
      SET failed_count = 1, window_started_at = now(), last_attempt_at = now()
      WHERE identifier = v_key;
    ELSE
      UPDATE public.enquiry_tracking_attempts
      SET failed_count = failed_count + 1, last_attempt_at = now()
      WHERE identifier = v_key;
    END IF;

    RAISE EXCEPTION 'Invalid enquiry ID or registered mobile number.' USING ERRCODE = '22023';
  END IF;

  -- Successful lookup clears throttling for this reference.
  DELETE FROM public.enquiry_tracking_attempts WHERE identifier = v_key;

  RETURN jsonb_build_object(
    'enquiry_number', v_record.enquiry_number,
    'subject', COALESCE(NULLIF(trim(v_record.category_interest), ''), 'Sales Enquiry'),
    'submitted_at', v_record.created_at,
    'tracking_status', v_record.customer_tracking_status,
    'last_updated_at', v_record.customer_tracking_updated_at,
    'status_explanation', CASE v_record.customer_tracking_status
      WHEN 'received' THEN 'We have received your enquiry.'
      WHEN 'in_progress' THEN 'Our team is working on your request.'
      WHEN 'needs_info' THEN 'We need some additional information from you.'
      WHEN 'completed' THEN 'Your enquiry or service request has been completed.'
      ELSE 'We have received your enquiry.'
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.track_enquiry(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_enquiry(TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Staff-only customer tracking update RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_customer_tracking_status(
  p_enquiry_id UUID,
  p_tracking_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_actor_id UUID;
  v_actor_name TEXT;
  v_actor_code TEXT;
  v_enquiry RECORD;
  v_previous TEXT;
  v_updated TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL OR NOT public.is_enquiry_management_staff() THEN
    RAISE EXCEPTION 'Access denied: authorized enquiry staff privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_tracking_status IS NULL
     OR p_tracking_status NOT IN ('received', 'in_progress', 'needs_info', 'completed') THEN
    RAISE EXCEPTION 'Invalid customer tracking status.' USING ERRCODE = '22023';
  END IF;

  SELECT id, enquiry_number, customer_tracking_status
    INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found.' USING ERRCODE = 'no_data_found';
  END IF;

  v_previous := v_enquiry.customer_tracking_status;
  v_updated := now();

  SELECT COALESCE(NULLIF(trim(full_name), ''), email), NULLIF(trim(employee_code), '')
    INTO v_actor_name, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  UPDATE public.enquiries
  SET
    customer_tracking_status = p_tracking_status,
    customer_tracking_updated_at = v_updated,
    customer_tracking_updated_by = v_actor_id,
    customer_tracking_updated_by_name = v_actor_name,
    customer_tracking_updated_by_code = v_actor_code
  WHERE id = p_enquiry_id;

  INSERT INTO public.enquiry_tracking_history (
    enquiry_id,
    previous_status,
    tracking_status,
    updated_by,
    updated_by_name,
    updated_by_employee_code,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_previous,
    p_tracking_status,
    v_actor_id,
    v_actor_name,
    v_actor_code,
    v_updated
  );

  RETURN jsonb_build_object(
    'id', p_enquiry_id,
    'enquiry_number', v_enquiry.enquiry_number,
    'customer_tracking_status', p_tracking_status,
    'customer_tracking_updated_at', v_updated,
    'customer_tracking_updated_by_name', v_actor_name,
    'customer_tracking_updated_by_code', v_actor_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_customer_tracking_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_tracking_status(UUID, TEXT) TO authenticated;
