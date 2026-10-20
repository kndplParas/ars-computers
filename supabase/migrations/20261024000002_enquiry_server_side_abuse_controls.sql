-- ============================================================================
-- ARS Computers — Phase B: Server-Side Public Enquiry Abuse Controls & Rate Limiting
-- Migration: 20261024000002_enquiry_server_side_abuse_controls.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- REMEDIATIONS IMPLEMENTED:
-- 1. Server-Side Rate Limiting Table:
--    - public.enquiry_rate_limits tracks anonymous submission activity by client IP
--      and contact fingerprint.
--    - RLS enabled; 100% inaccessible to all client roles (anon, authenticated, PUBLIC).
-- 2. Input Validation & Request Bounds in Trigger:
--    - Strict character length limits:
--        name: 2..100 characters
--        contact_info: 5..150 characters
--        message: 5..3000 characters
--        category_interest: <= 50 characters
--    - Reject null bytes & non-printable control characters.
--    - Reject malicious HTML/JS payloads (<script, javascript:) in message.
-- 3. Multi-Tiered Server-Side Rate Limiting:
--    - IP-based sliding window: maximum 15 submissions per minute.
--    - Contact-fingerprint sliding window: maximum 5 submissions per 10 minutes.
--    - Automatic expiration cleanup of logs older than 1 hour.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RATE LIMIT TRACKING TABLE (Internal to database, no client grants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_ip TEXT,
  contact_fingerprint TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.enquiry_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.enquiry_rate_limits FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_enquiry_rate_limits_window
  ON public.enquiry_rate_limits (client_ip, submitted_at);

CREATE INDEX IF NOT EXISTS idx_enquiry_rate_limits_contact
  ON public.enquiry_rate_limits (contact_fingerprint, submitted_at);

-- ----------------------------------------------------------------------------
-- 2. HARDENED TRIGGER: Input Validation, Sanitization & Server Rate Limiting
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_enquiry_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_headers JSONB;
  v_client_ip TEXT := 'unknown';
  v_contact_hash TEXT;
  v_recent_ip_count INT;
  v_recent_contact_count INT;
BEGIN
  -- Active administrators are exempt from public submission restrictions
  IF NOT public.is_admin() THEN
    -- A. Status & notes enforcement
    IF NEW.status IS NULL THEN
      NEW.status := 'new';
    ELSIF NEW.status != 'new' THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions must have status "new".'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.admin_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Internal admin notes cannot be supplied during public enquiry submission.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- B. Workflow & Bin field protection
    IF NEW.is_archived IS TRUE OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot be created as archived.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.rejection_reason IS NOT NULL OR NEW.rejection_requested_by IS NOT NULL OR
       NEW.rejection_requested_at IS NOT NULL OR NEW.previous_status IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot supply rejection workflow fields.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.completion_summary IS NOT NULL OR NEW.completion_requested_by IS NOT NULL OR
       NEW.completion_requested_at IS NOT NULL OR NEW.completion_approved_by IS NOT NULL OR
       NEW.completion_approved_at IS NOT NULL OR NEW.completion_rework_reason IS NOT NULL OR
       NEW.is_in_bin IS TRUE OR NEW.bin_entered_at IS NOT NULL OR NEW.scheduled_deletion_at IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Public enquiry submissions cannot supply completion or Bin workflow fields.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- C. Strict Input Size & Content Validation
    NEW.name := pg_catalog.btrim(COALESCE(NEW.name, ''));
    NEW.contact_info := pg_catalog.btrim(COALESCE(NEW.contact_info, ''));
    NEW.message := pg_catalog.btrim(COALESCE(NEW.message, ''));

    IF pg_catalog.length(NEW.name) < 2 OR pg_catalog.length(NEW.name) > 100 THEN
      RAISE EXCEPTION 'Input validation failed: Customer name must be between 2 and 100 characters.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF pg_catalog.length(NEW.contact_info) < 5 OR pg_catalog.length(NEW.contact_info) > 150 THEN
      RAISE EXCEPTION 'Input validation failed: Contact information must be between 5 and 150 characters.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF pg_catalog.length(NEW.message) < 5 OR pg_catalog.length(NEW.message) > 3000 THEN
      RAISE EXCEPTION 'Input validation failed: Message must be between 5 and 3000 characters.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.category_interest IS NOT NULL AND pg_catalog.length(NEW.category_interest) > 50 THEN
      RAISE EXCEPTION 'Input validation failed: Category interest exceeds maximum length.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- D. Anti-Tamper: Reject null bytes and non-printable control characters
    IF NEW.name ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' OR
       NEW.contact_info ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' OR
       NEW.message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' THEN
      RAISE EXCEPTION 'Security violation: Malformed or non-printable control characters detected.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- E. Basic payload pattern rejection
    IF NEW.message ~* '<script' OR NEW.message ~* 'javascript:' THEN
      RAISE EXCEPTION 'Security violation: Script tags and script URI schemes are forbidden.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- F. Server-Side Rate Limiting
    BEGIN
      v_headers := NULLIF(pg_catalog.current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_headers := NULL;
    END;

    IF v_headers IS NOT NULL THEN
      v_client_ip := COALESCE(
        NULLIF(pg_catalog.split_part(v_headers ->> 'x-forwarded-for', ',', 1), ''),
        NULLIF(v_headers ->> 'cf-connecting-ip', ''),
        'postgrest_client'
      );
    ELSE
      v_client_ip := 'direct_client';
    END IF;

    v_contact_hash := pg_catalog.md5(pg_catalog.lower(NEW.contact_info));

    -- Periodically purge old rate limit logs (older than 1 hour)
    DELETE FROM public.enquiry_rate_limits
    WHERE submitted_at < pg_catalog.timezone('utc'::text, pg_catalog.now()) - INTERVAL '1 hour';

    -- Tier 1: Check IP rate limit (max 15 per minute, except direct internal callers)
    IF v_client_ip NOT IN ('direct_client', '127.0.0.1', '::1', 'postgrest_client') THEN
      SELECT COUNT(*) INTO v_recent_ip_count
      FROM public.enquiry_rate_limits
      WHERE client_ip = v_client_ip
        AND submitted_at >= pg_catalog.timezone('utc'::text, pg_catalog.now()) - INTERVAL '1 minute';

      IF v_recent_ip_count >= 15 THEN
        RAISE EXCEPTION 'Rate limit exceeded: Too many enquiry submissions from this IP address. Please wait.'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Tier 2: Check Contact Fingerprint rate limit (max 5 per 10 minutes)
    SELECT COUNT(*) INTO v_recent_contact_count
    FROM public.enquiry_rate_limits
    WHERE contact_fingerprint = v_contact_hash
      AND submitted_at >= pg_catalog.timezone('utc'::text, pg_catalog.now()) - INTERVAL '10 minutes';

    IF v_recent_contact_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Multiple recent inquiries detected for this contact address. Our team will contact you shortly.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Record this submission in rate limit tracking table
    INSERT INTO public.enquiry_rate_limits (client_ip, contact_fingerprint, submitted_at)
    VALUES (v_client_ip, v_contact_hash, pg_catalog.timezone('utc'::text, pg_catalog.now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_enquiry_insert_defaults ON public.enquiries;
CREATE TRIGGER trg_enforce_enquiry_insert_defaults
  BEFORE INSERT ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_enquiry_insert_defaults();

GRANT EXECUTE ON FUNCTION public.enforce_enquiry_insert_defaults() TO anon, authenticated;
