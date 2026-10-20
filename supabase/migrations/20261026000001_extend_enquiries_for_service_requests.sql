-- ============================================================================
-- ARS Computers — Migration 20261026000001: Extend Enquiries for Service Requests
-- ============================================================================
-- PURPOSE:
-- 1. Extend public.enquiries to natively support after-sales service and repair enquiries.
-- 2. Add enquiry_type column with default 'general' to distinguish between:
--    - general (Standard customer inquiry)
--    - product (Product inquiry / Quotation)
--    - service_request (Hardware repair / On-site service request)
-- 3. Add service_details JSONB column for complete structured service metadata
--    (brand, model, serial, purchase date, invoice, location, diagnostics, etc.).
-- 4. Update the server-side validation trigger & RLS policies to accept these fields.
-- 5. Safe, idempotent, forward-only; zero disruption to existing enquiries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD COLUMNS SAFELY
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS enquiry_type TEXT NOT NULL DEFAULT 'general'
    CHECK (enquiry_type IN ('general', 'product', 'quotation', 'service_request')),
  ADD COLUMN IF NOT EXISTS service_details JSONB DEFAULT NULL;

-- Index for rapid query filtering by enquiry type
CREATE INDEX IF NOT EXISTS idx_enquiries_type
  ON public.enquiries (enquiry_type, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. UPDATE INSERT POLICY FOR ANONYMOUS SUBMISSIONS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anonymous can submit new enquiries" ON public.enquiries;
CREATE POLICY "Anonymous can submit new enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'new' AND
    admin_notes IS NULL AND
    is_archived = false AND
    archived_at IS NULL AND
    archived_by IS NULL AND
    rejection_reason IS NULL AND
    rejection_requested_by IS NULL AND
    rejection_requested_at IS NULL AND
    previous_status IS NULL AND
    completion_summary IS NULL AND
    completion_requested_by IS NULL AND
    completion_requested_at IS NULL AND
    completion_approved_by IS NULL AND
    completion_approved_at IS NULL AND
    completion_rework_reason IS NULL AND
    is_in_bin = false AND
    bin_entered_at IS NULL AND
    scheduled_deletion_at IS NULL AND
    enquiry_type IN ('general', 'product', 'quotation', 'service_request')
  );

-- ----------------------------------------------------------------------------
-- 3. UPDATE ANONYMOUS INSERT VALIDATION TRIGGER
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

    -- C. Validate enquiry_type
    IF NEW.enquiry_type IS NULL THEN
      NEW.enquiry_type := 'general';
    ELSIF NEW.enquiry_type NOT IN ('general', 'product', 'quotation', 'service_request') THEN
      RAISE EXCEPTION 'Input validation failed: Invalid enquiry_type.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- D. Strict Input Size & Content Validation
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

    -- E. Anti-Tamper: Reject null bytes and non-printable control characters
    IF NEW.name ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' OR
       NEW.contact_info ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' OR
       NEW.message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' THEN
      RAISE EXCEPTION 'Security violation: Malformed or non-printable control characters detected.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- F. Basic payload pattern rejection
    IF NEW.message ~* '<script' OR NEW.message ~* 'javascript:' THEN
      RAISE EXCEPTION 'Security violation: Script tags and script URI schemes are forbidden.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- G. Server-Side Rate Limiting
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

    DELETE FROM public.enquiry_rate_limits
    WHERE submitted_at < pg_catalog.timezone('utc'::text, pg_catalog.now()) - INTERVAL '1 hour';

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

    SELECT COUNT(*) INTO v_recent_contact_count
    FROM public.enquiry_rate_limits
    WHERE contact_fingerprint = v_contact_hash
      AND submitted_at >= pg_catalog.timezone('utc'::text, pg_catalog.now()) - INTERVAL '10 minutes';

    IF v_recent_contact_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Multiple recent inquiries detected for this contact address. Our team will contact you shortly.'
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.enquiry_rate_limits (client_ip, contact_fingerprint, submitted_at)
    VALUES (v_client_ip, v_contact_hash, pg_catalog.timezone('utc'::text, pg_catalog.now()));
  END IF;

  RETURN NEW;
END;
$$;
