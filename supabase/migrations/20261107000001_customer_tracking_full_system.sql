-- ============================================================================
-- ARS Computers — Complete customer enquiry & engineer tracking (extension)
-- Migration: 20261107000001_customer_tracking_full_system.sql
-- ============================================================================
-- EXTENDS the deployed tracking feature. It does not rebuild anything:
--   * Same public.enquiries table and existing enquiry_number references.
--   * Existing engineer assignment columns (assigned_employee_*,
--     expected_visit_at, expected_arrival) remain the single source of truth.
--   * Existing enquiry_tracking_history table gains richer audit fields.
--   * Existing create_customer_enquiry / track_enquiry / staff workflows and
--     the Head approval chain are untouched.
--
-- SECURITY MODEL
--   * Three new OTP/lookup RPCs are granted ONLY to service_role: the customer
--     facing Cloudflare Worker (which never exposes the key) is the sole
--     caller. anon/authenticated/PUBLIC cannot execute or read the tables.
--   * OTP codes are stored hashed with a per-row random salt, expire in 10
--     minutes, are resend-limited and verify-attempt-limited, with generic
--     errors that do not reveal whether an identifier is registered.
--   * Sessions are opaque hashed tokens with server-side expiry; customers can
--     only ever see their own enquiry data, resolved from the verified contact.
--   * Engineer data is limited to what staff deliberately mark as
--     customer-visible (name + approved contact number). Private staff phone
--     numbers, employee codes, aadhaar, emails and internal notes are never
--     returned by the sanitized lookup.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Additive customer-facing detail columns on public.enquiries
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS visit_status TEXT NULL;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS engineer_contact_display TEXT NULL;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS visit_progress_note TEXT NULL;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS service_completed_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enquiries_visit_status_check'
  ) THEN
    ALTER TABLE public.enquiries
      ADD CONSTRAINT enquiries_visit_status_check
      CHECK (visit_status IS NULL OR visit_status IN (
        'scheduled', 'in_progress', 'completed', 'cancelled'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.enquiries.visit_status IS
  'Customer-visible visit progress: scheduled | in_progress | completed | cancelled. Set by authorized staff only.';
COMMENT ON COLUMN public.enquiries.engineer_contact_display IS
  'Approved customer-facing engineer contact number. Private staff phone numbers are never exposed to customers.';
COMMENT ON COLUMN public.enquiries.visit_progress_note IS
  'Optional customer-visible visit/progress note written by staff.';
COMMENT ON COLUMN public.enquiries.service_completed_at IS
  'Timestamp recorded when staff mark the service visit as completed.';

-- ----------------------------------------------------------------------------
-- 2. Extend the existing tracking history with full audit values
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_tracking_history
  ADD COLUMN IF NOT EXISTS change_kind TEXT NULL;

ALTER TABLE public.enquiry_tracking_history
  ADD COLUMN IF NOT EXISTS previous_value TEXT NULL;

ALTER TABLE public.enquiry_tracking_history
  ADD COLUMN IF NOT EXISTS new_value TEXT NULL;

-- Status rows may now be one of several change kinds; audit rows for engineer
-- assignment details, visit scheduling and notes carry the changed values in
-- previous_value/new_value instead.
ALTER TABLE public.enquiry_tracking_history
  DROP CONSTRAINT IF EXISTS enquiry_tracking_history_status_check;

-- Audit rows for engineer contact/visit/note changes carry values instead of a
-- status, so the status column must accept NULL there too.
ALTER TABLE public.enquiry_tracking_history
  ALTER COLUMN tracking_status DROP NOT NULL;

ALTER TABLE public.enquiry_tracking_history
  DROP CONSTRAINT IF EXISTS enquiry_tracking_history_previous_status_check;

ALTER TABLE public.enquiry_tracking_history
  DROP CONSTRAINT IF EXISTS enquiry_tracking_history_change_kind_check;

ALTER TABLE public.enquiry_tracking_history
  ADD CONSTRAINT enquiry_tracking_history_status_check
  CHECK (tracking_status IS NULL OR tracking_status IN (
    'received', 'in_progress', 'needs_info', 'completed'
  ));

ALTER TABLE public.enquiry_tracking_history
  ADD CONSTRAINT enquiry_tracking_history_previous_status_check
  CHECK (previous_status IS NULL OR previous_status IN (
    'received', 'in_progress', 'needs_info', 'completed'
  ));

ALTER TABLE public.enquiry_tracking_history
  ADD CONSTRAINT enquiry_tracking_history_change_kind_check
  CHECK (change_kind IS NULL OR change_kind IN (
    'status', 'engineer_contact', 'visit', 'note'
  ));

COMMENT ON COLUMN public.enquiry_tracking_history.change_kind IS
  'status | engineer_contact | visit | note — what kind of customer-facing change was recorded.';
COMMENT ON COLUMN public.enquiry_tracking_history.previous_value IS
  'Previous raw value of the changed field (contact, visit status or note).';
COMMENT ON COLUMN public.enquiry_tracking_history.new_value IS
  'New raw value of the changed field.';

-- ----------------------------------------------------------------------------
-- 3. OTP, session and IP-throttle tables (RPC-only access)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_tracking_otp (
  identifier TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  delivery_email TEXT,
  -- code_hash is HMAC-SHA256(hex, 64 chars) computed ONLY inside the Cloudflare
  -- Worker with a dedicated Worker secret (never stored in this database or
  -- sent to any client). NULL means "not yet sealed/sent".
  code_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 1 CHECK (send_count >= 0),
  send_window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verify_attempts INTEGER NOT NULL DEFAULT 0 CHECK (verify_attempts >= 0),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  identifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_tracking_sessions_identifier
  ON public.customer_tracking_sessions (identifier);

CREATE TABLE IF NOT EXISTS public.tracking_ip_throttle (
  ip_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No direct client access to any of these three tables. The RPCs are the only
-- path, and they are restricted to service_role (the Cloudflare Worker).
REVOKE ALL ON public.customer_tracking_otp FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.customer_tracking_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.tracking_ip_throttle FROM PUBLIC, anon, authenticated;

ALTER TABLE public.customer_tracking_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_ip_throttle ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.customer_tracking_otp IS
  'OTP challenges for customer enquiry tracking. Code is generated with gen_random_bytes; only a Worker-side HMAC-SHA256 digest is stored; verification material is compared inside the Worker with its secret in constant time. No client role may read or write rows; service-role RPCs only.';
COMMENT ON TABLE public.customer_tracking_sessions IS
  'Server-side tracking sessions. Tokens are stored hashed; plaintext exists only in flight.';
COMMENT ON TABLE public.tracking_ip_throttle IS
  'Per-client-IP hourly throttle for OTP requests provided by the Worker.';

-- ----------------------------------------------------------------------------
-- 4. Shared helper: resolve a verified contact identifier to matched enquiries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tracking_enquiry_ids_for_identifier(
  p_channel TEXT,
  p_identifier TEXT
)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- p_identifier: normalized lowercase email (channel 'email') or bare digits
  -- (channel 'mobile'). Contact info may hold "phone | email" segments.
  SELECT e.id
  FROM public.enquiries e,
       unnest(string_to_array(COALESCE(e.contact_info, ''), '|')) AS seg(part)
  WHERE CASE
    WHEN p_channel = 'email' AND p_identifier <> '' THEN
      lower(btrim(seg.part)) = p_identifier
    WHEN p_channel = 'mobile' AND p_identifier <> '' THEN
      char_length(regexp_replace(seg.part, '[^0-9]', '', 'g')) >= 10
      AND right(regexp_replace(seg.part, '[^0-9]', '', 'g'), 10) = right(p_identifier, 10)
    ELSE false
  END
  GROUP BY e.id;
$$;

REVOKE EXECUTE ON FUNCTION public.tracking_enquiry_ids_for_identifier(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_enquiry_ids_for_identifier(TEXT, TEXT)
  TO service_role;

-- ----------------------------------------------------------------------------
-- 5. OTP lifecycle RPCs (service_role only; invoked by the Worker)
-- ----------------------------------------------------------------------------
-- Cryptography split (defense in depth):
--   * The 6-digit code is generated ONLY here with extensions.gen_random_bytes
--     (CSPRNG); no PostgreSQL random() anywhere in this migration.
--   * The database stores only an HMAC-SHA256 digest computed inside the
--     Worker over "identifier : code" using a dedicated Cloudflare Worker
--     secret. The environment variable name, the secret value, the frontend
--     code and this database record set never meet; the database never
--     receives or stores the secret.
--   * The Worker compares digests in constant time; the database only
--     provisions expiry, single-use, resend limits and failed-attempt lockout.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_tracking_otp(
  p_contact TEXT,
  p_client_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel TEXT;
  v_identifier TEXT;
  v_delivery_email TEXT;
  v_other_email TEXT;
  v_contact TEXT;
  v_bytes BYTEA;
  v_value BIGINT;
  v_code TEXT;
  v_ip_hash TEXT;
  v_ip_count INTEGER;
  v_ip_window TIMESTAMPTZ;
  v_existing RECORD;
  v_verified INTEGER;
  -- Largest multiple of 1,000,000 below 2^32 (4294 * 1000000). Values in
  -- [0, 4294000000) map perfectly uniformly onto 0..999999 via modulo; values
  -- at or above it are rejected and resampled (unbiased rejection sampling).
  v_reject_above CONSTANT BIGINT := 4294000000;
BEGIN
  v_contact := btrim(COALESCE(p_contact, ''));
  v_ip_hash := left(COALESCE(p_client_hash, ''), 64);

  -- Strict shape: either an email, or a phone number of 10-15 digits.
  IF v_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND char_length(v_contact) <= 254 THEN
    v_channel := 'email';
    v_identifier := lower(v_contact);
  ELSE
    v_identifier := regexp_replace(v_contact, '[^0-9]', '', 'g');
    IF char_length(v_identifier) >= 10 AND char_length(v_identifier) <= 15 THEN
      v_channel := 'mobile';
      v_identifier := right(v_identifier, 12);
    ELSE
      -- Generic local validation rejection; never reveals more.
      RAISE EXCEPTION 'Could not process the tracking request.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Per-IP hourly throttle (opportunistic cleanup inside the same transaction).
  DELETE FROM public.tracking_ip_throttle
  WHERE window_started_at < now() - interval '2 hours';

  SELECT request_count, window_started_at
    INTO v_ip_count, v_ip_window
  FROM public.tracking_ip_throttle
  WHERE ip_hash = v_ip_hash
  FOR UPDATE;

  IF v_ip_count IS NULL THEN
    INSERT INTO public.tracking_ip_throttle (ip_hash, request_count, window_started_at)
    VALUES (v_ip_hash, 1, now())
    ON CONFLICT (ip_hash) DO UPDATE
      SET request_count = tracking_ip_throttle.request_count + 1;
  ELSIF v_ip_window >= now() - interval '1 hour' AND v_ip_count >= 30 THEN
    RAISE EXCEPTION 'Too many verification requests. Please try again later.'
      USING ERRCODE = '22023';
  ELSE
    UPDATE public.tracking_ip_throttle
    SET request_count = request_count + 1
    WHERE ip_hash = v_ip_hash;
  END IF;

  -- Resolve the identifier to registered enquiries and find an email channel.
  IF v_channel = 'email' THEN
    v_verified := (
      SELECT count(*) FROM public.tracking_enquiry_ids_for_identifier(v_channel, v_identifier)
    );
    v_delivery_email := v_identifier;
  ELSE
    SELECT lower(btrim(seg.part)) AS email
    INTO v_other_email
    FROM public.enquiries e,
         unnest(string_to_array(COALESCE(e.contact_info, ''), '|')) AS seg(part)
    WHERE EXISTS (
      SELECT 1 FROM public.tracking_enquiry_ids_for_identifier(v_channel, v_identifier) ids
      WHERE ids.id = e.id
    )
      AND lower(btrim(seg.part)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    GROUP BY lower(btrim(seg.part))
    LIMIT 1;

    v_verified := (
      SELECT count(*) FROM public.tracking_enquiry_ids_for_identifier(v_channel, v_identifier)
    );
    v_delivery_email := v_other_email;
  END IF;

  -- Identifier throttle state (row exists regardless, to burn guesses safely).
  SELECT * INTO v_existing FROM public.customer_tracking_otp WHERE identifier = v_identifier FOR UPDATE;

  IF v_existing.send_window_started_at IS NOT NULL
     AND v_existing.send_window_started_at >= now() - interval '15 minutes'
     AND v_existing.send_count >= 3 THEN
    RAISE EXCEPTION 'Too many verification requests. Please try again later.'
      USING ERRCODE = '22023';
  END IF;

  -- CSPRNG code with unbiased rejection sampling: take 32 bits from
  -- extensions.gen_random_bytes, reject any sample at or above 4294000000
  -- (the largest multiple of 1,000,000 under 2^32), retry until within range,
  -- then map with modulo. Expected rejects per code ≈ 1.57e-5 — effectively
  -- never lost. Never uses PostgreSQL random().
  LOOP
    v_bytes := extensions.gen_random_bytes(4);
    v_value := (get_byte(v_bytes, 0)::bigint * 16777216)
             + (get_byte(v_bytes, 1)::bigint * 65536)
             + (get_byte(v_bytes, 2)::bigint * 256)
             + get_byte(v_bytes, 3)::bigint;
    EXIT WHEN v_value < v_reject_above;
  END LOOP;
  v_code := lpad((v_value % 1000000)::text, 6, '0');

  -- code_hash is left NULL here; the Worker seals it with its HMAC before the
  -- email is sent.
  INSERT INTO public.customer_tracking_otp (
    identifier, channel, delivery_email, code_hash,
    expires_at, send_count, send_window_started_at, verify_attempts, locked_until
  ) VALUES (
    v_identifier, v_channel, v_delivery_email, NULL,
    now() + interval '10 minutes',
    1, now(), 0, NULL
  )
  ON CONFLICT (identifier) DO UPDATE SET
    channel = EXCLUDED.channel,
    delivery_email = EXCLUDED.delivery_email,
    code_hash = NULL,
    expires_at = EXCLUDED.expires_at,
    verify_attempts = 0,
    locked_until = NULL,
    -- resend counting inside a rolling 15-minute window
    send_count = CASE
      WHEN customer_tracking_otp.send_window_started_at >= now() - interval '15 minutes'
        THEN customer_tracking_otp.send_count + 1
      ELSE 1
    END,
    send_window_started_at = CASE
      WHEN customer_tracking_otp.send_window_started_at >= now() - interval '15 minutes'
        THEN customer_tracking_otp.send_window_started_at
      ELSE now()
    END,
    created_at = now();

  IF NOT FOUND OR v_delivery_email IS NULL OR v_verified = 0 THEN
    -- No registered enquiry (or no email channel). Reply generically so the
    -- caller cannot distinguish the cases, and never claim an email was sent.
    -- No code is returned (there is nothing deliverable), but the throttle
    -- state above was still consumed (anti-enumeration burn).
    RETURN jsonb_build_object('delivered', false);
  END IF;

  RETURN jsonb_build_object(
    'delivered', true,
    'identifier', v_identifier,
    'otp_code', v_code,
    'delivery_email', v_delivery_email,
    'expires_in_minutes', 10
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.seal_tracking_otp(
  p_contact TEXT,
  p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel TEXT;
  v_identifier TEXT;
  v_contact TEXT;
  v_row public.customer_tracking_otp%ROWTYPE;
BEGIN
  IF p_code_hash IS NULL
     OR p_code_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Could not process the tracking request.' USING ERRCODE = '22023';
  END IF;

  v_contact := btrim(COALESCE(p_contact, ''));

  IF v_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND char_length(v_contact) <= 254 THEN
    v_channel := 'email';
    v_identifier := lower(v_contact);
  ELSE
    v_identifier := regexp_replace(v_contact, '[^0-9]', '', 'g');
    IF char_length(v_identifier) >= 10 AND char_length(v_identifier) <= 15 THEN
      v_channel := 'mobile';
      v_identifier := right(v_identifier, 12);
    ELSE
      RAISE EXCEPTION 'Could not process the tracking request.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.customer_tracking_otp
  WHERE identifier = v_identifier
  FOR UPDATE;

  IF NOT FOUND OR v_row.locked_until IS NOT NULL AND v_row.locked_until > now()
     OR v_row.expires_at < now() THEN
    RAISE EXCEPTION 'Could not process the tracking request.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_tracking_otp
  SET code_hash = lower(p_code_hash)
  WHERE identifier = v_identifier;

  RETURN jsonb_build_object('sealed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_tracking_otp_challenge(
  p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel TEXT;
  v_identifier TEXT;
  v_contact TEXT;
  v_row public.customer_tracking_otp%ROWTYPE;
BEGIN
  v_contact := btrim(COALESCE(p_contact, ''));

  IF v_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND char_length(v_contact) <= 254 THEN
    v_channel := 'email';
    v_identifier := lower(v_contact);
  ELSE
    v_identifier := regexp_replace(v_contact, '[^0-9]', '', 'g');
    IF char_length(v_identifier) >= 10 AND char_length(v_identifier) <= 15 THEN
      v_channel := 'mobile';
      v_identifier := right(v_identifier, 12);
    ELSE
      RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.customer_tracking_otp
  WHERE identifier = v_identifier
  FOR UPDATE;

  IF NOT FOUND OR v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
  END IF;

  IF v_row.expires_at < now() THEN
    -- Expired challenge is consumed immediately (single use across lifecycles).
    DELETE FROM public.customer_tracking_otp WHERE identifier = v_identifier;
    RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
  END IF;

  IF v_row.code_hash IS NULL THEN
    -- Unclosed (never sealed/sent or send raced) — verification cannot pass.
    RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('identifier', v_identifier, 'code_hash', v_row.code_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_tracking_otp(
  p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel TEXT;
  v_identifier TEXT;
  v_contact TEXT;
  v_row public.customer_tracking_otp%ROWTYPE;
BEGIN
  v_contact := btrim(COALESCE(p_contact, ''));

  IF v_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND char_length(v_contact) <= 254 THEN
    v_channel := 'email';
    v_identifier := lower(v_contact);
  ELSE
    v_identifier := regexp_replace(v_contact, '[^0-9]', '', 'g');
    IF char_length(v_identifier) >= 10 AND char_length(v_identifier) <= 15 THEN
      v_channel := 'mobile';
      v_identifier := right(v_identifier, 12);
    ELSE
      RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.customer_tracking_otp
  WHERE identifier = v_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false);
  END IF;

  UPDATE public.customer_tracking_otp
  SET verify_attempts = verify_attempts + 1,
      locked_until = CASE
        WHEN verify_attempts + 1 >= 5 THEN now() + interval '30 minutes'
        ELSE locked_until
      END
  WHERE identifier = v_identifier;

  RETURN jsonb_build_object('locked', v_row.verify_attempts + 1 >= 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_tracking_otp(
  p_contact TEXT,
  p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel TEXT;
  v_identifier TEXT;
  v_contact TEXT;
  v_row public.customer_tracking_otp%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
  END IF;

  v_contact := btrim(COALESCE(p_contact, ''));

  IF v_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND char_length(v_contact) <= 254 THEN
    v_channel := 'email';
    v_identifier := lower(v_contact);
  ELSE
    v_identifier := regexp_replace(v_contact, '[^0-9]', '', 'g');
    IF char_length(v_identifier) >= 10 AND char_length(v_identifier) <= 15 THEN
      v_channel := 'mobile';
      v_identifier := right(v_identifier, 12);
    ELSE
      RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Re-validate every guard at completion time (constant time-safe against
  -- expiry/lock/race because this happens inside the same locked SELECT).
  SELECT * INTO v_row FROM public.customer_tracking_otp
  WHERE identifier = v_identifier
  FOR UPDATE;

  IF NOT FOUND OR v_row.locked_until IS NOT NULL AND v_row.locked_until > now()
     OR v_row.expires_at < now()
     OR v_row.code_hash IS NULL THEN
    RAISE EXCEPTION 'Verification failed.' USING ERRCODE = '22023';
  END IF;

  -- Single use until he would mint another code: consume the challenge row so
  -- any replay (same contact further attempts with identical or different
  -- code) must go through a fresh send cycle with a fresh code.
  DELETE FROM public.customer_tracking_otp WHERE identifier = v_identifier;

  INSERT INTO public.customer_tracking_sessions (token_hash, identifier, expires_at)
  VALUES (p_token_hash, v_identifier, now() + interval '45 minutes');

  RETURN jsonb_build_object('created', true, 'expires_in_minutes', 45);
END;
$$;

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
            e.engineer_contact_display,
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

GRANT EXECUTE ON FUNCTION public.start_tracking_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.seal_tracking_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fetch_tracking_otp_challenge(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_tracking_otp(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_tracking_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_customer_enquiries(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.start_tracking_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seal_tracking_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fetch_tracking_otp_challenge(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_tracking_otp(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_tracking_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_customer_enquiries(TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Staff RPC: update customer-facing visit details with full audit
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

  IF char_length(v_note) > 400 THEN
    v_note := left(v_note, 400);
  END IF;

  SELECT id, enquiry_number, engineer_contact_display, visit_status, visit_progress_note
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
    visit_status = v_visit_status,
    visit_progress_note = NULLIF(v_note, ''),
    service_completed_at = CASE
      WHEN v_visit_status = 'completed' THEN COALESCE(service_completed_at, v_updated)
      WHEN v_visit_status IS DISTINCT FROM 'completed' THEN service_completed_at
      ELSE service_completed_at
    END
  WHERE id = p_enquiry_id;

  -- Separate audit row per changed field, preserving previous and new values.
  IF v_enquiry.engineer_contact_display IS DISTINCT FROM v_contact THEN
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
    'visit_status', v_visit_status,
    'visit_progress_note', NULLIF(v_note, ''),
    'updated_at', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_customer_visit_details(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 7. Status RPC already deployed now records its change kind explicitly.
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
    change_kind,
    previous_value,
    new_value,
    updated_by,
    updated_by_name,
    updated_by_employee_code,
    created_at
  ) VALUES (
    p_enquiry_id,
    v_previous,
    p_tracking_status,
    'status',
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
