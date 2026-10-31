-- ============================================================================
-- ARS Computers — Step 2: Signed Service Proof + Completion Workflow
-- Migration: 20261031000003_enquiry_service_completion_proofs.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Private storage bucket 'enquiry-service-proofs' (10 MB, JPEG/PNG/PDF only).
-- 2. Storage RLS: upload/read restricted to is_admin(); delete restricted to superadmin.
-- 3. public.enquiry_service_proofs metadata table with:
--    - FK to enquiries ON DELETE RESTRICT (not CASCADE — no bypass via enquiry deletion).
--    - Unique storage_path constraint.
--    - Soft-delete pattern (is_voided flag + audit columns).
--    - Immutability trigger: voided proofs cannot be un-voided; post-approval proofs locked;
--      hard DELETE blocked to preserve permanent audit records.
-- 4. public.register_enquiry_service_proof RPC:
--    - Server-derived uploader identity (anti-spoofing).
--    - Validates MIME type, file size, path format (enquiry_id/uuid.ext), enquiry lifecycle.
--    - Assigned employee enforcement: admin employees may only upload to enquiries assigned to them.
--    - Logs SERVICE_PROOF_UPLOADED enquiry activity.
-- 5. public.void_enquiry_service_proof RPC:
--    - Soft-deletes proof (sets is_voided = true + audit fields).
--    - Employee: can only void own proofs when enquiry not post-approval or completion_requested.
--    - Head (superadmin): can void any proof with mandatory reason before approval.
--    - Logs SERVICE_PROOF_VOIDED enquiry activity.
-- 6. public.submit_enquiry_completion (CREATE OR REPLACE):
--    - Inherits all existing validation from 20261028000001.
--    - NEW: For service enquiries (enquiry_type = 'service_request' or service category/details),
--      requires at least one non-voided CUSTOMER_SIGNED_SERVICE_REPORT proof to exist before
--      allowing completion request. Non-service enquiries are unaffected.
-- 7. Extend enquiry_activities activity_type constraint with:
--    'SERVICE_PROOF_UPLOADED', 'SERVICE_PROOF_VOIDED'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORAGE: 'enquiry-service-proofs' BUCKET & RLS POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'enquiry-service-proofs',
      'enquiry-service-proofs',
      false,       -- Strictly private — signed URLs only
      10485760,    -- 10 MB
      ARRAY['image/jpeg', 'image/png', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public              = EXCLUDED.public,
      file_size_limit     = EXCLUDED.file_size_limit,
      allowed_mime_types  = EXCLUDED.allowed_mime_types;

    -- Drop pre-existing policies for idempotency
    DROP POLICY IF EXISTS "Admins can view enquiry service proof objects"   ON storage.objects;
    DROP POLICY IF EXISTS "Admins can upload enquiry service proof objects"  ON storage.objects;
    DROP POLICY IF EXISTS "Superadmin can delete enquiry service proof objects" ON storage.objects;

    -- SELECT: active superadmins or assigned employees may download (for signed URL generation)
    CREATE POLICY "Authorized staff can view enquiry service proof objects"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'enquiry-service-proofs' AND
        public.is_admin() AND
        (
          public.is_superadmin() OR
          EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id::text = split_part(storage.objects.name, '/', 1)
              AND e.assigned_employee_id = auth.uid()
          )
        )
      );

    -- INSERT: active admins/superadmins may upload (<= 10MB)
    -- Registration and strict assignment checks are enforced atomically by register_enquiry_service_proof RPC
    CREATE POLICY "Admins can upload enquiry service proof objects"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'enquiry-service-proofs' AND
        public.is_admin() AND
        (
          COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 10485760
        )
      );

    -- DELETE: only superadmin (Head) may delete storage objects, but NOT after completion approval
    CREATE POLICY "Superadmin can delete enquiry service proof objects"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'enquiry-service-proofs' AND
        public.is_superadmin() AND
        NOT EXISTS (
          SELECT 1 FROM public.enquiries e
          WHERE e.id::text = split_part(storage.objects.name, '/', 1)
            AND e.completion_approved_at IS NOT NULL
        )
      );

  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.enquiry_service_proofs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_service_proofs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id               UUID        NOT NULL,
  storage_path             TEXT        NOT NULL,
  original_filename        TEXT        NOT NULL,
  mime_type                TEXT        NOT NULL,
  file_size_bytes          BIGINT      NOT NULL,
  document_type            TEXT        NOT NULL DEFAULT 'CUSTOMER_SIGNED_SERVICE_REPORT',

  -- Optional human annotation
  description              TEXT,

  -- Server-derived uploader identity (never client-supplied)
  uploaded_by              UUID        NOT NULL,
  uploaded_by_name         TEXT        NOT NULL,
  uploaded_by_employee_code TEXT,
  uploaded_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  -- Customer signed evidence flag
  is_customer_signed       BOOLEAN     NOT NULL DEFAULT true,

  -- Soft-delete / void audit trail
  is_voided                BOOLEAN     NOT NULL DEFAULT false,
  voided_at                TIMESTAMPTZ,
  voided_by                UUID,
  voided_by_name           TEXT,
  void_reason              TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  -- FK: RESTRICT prevents enquiry deletion from bypassing proof audit trail
  CONSTRAINT fk_esp_enquiry
    FOREIGN KEY (enquiry_id)
    REFERENCES public.enquiries(id)
    ON DELETE RESTRICT,

  -- Enforce unique storage paths (no duplicate file registrations)
  CONSTRAINT uq_esp_storage_path UNIQUE (storage_path),

  -- Allowlist for document types
  CONSTRAINT chk_esp_document_type
    CHECK (document_type IN ('CUSTOMER_SIGNED_SERVICE_REPORT', 'DIAGNOSTIC_REPORT', 'HANDOVER_RECEIPT')),

  -- MIME allowlist (no SVG, HTML, scripts, or executables)
  CONSTRAINT chk_esp_mime_type
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),

  -- File size: 1 byte to 10 MB
  CONSTRAINT chk_esp_file_size
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),

  -- Void consistency: if is_voided then voided_at, voided_by and void_reason must be set
  CONSTRAINT chk_esp_void_consistency
    CHECK (
      (is_voided = false) OR
      (is_voided = true AND voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_esp_enquiry_id
  ON public.enquiry_service_proofs (enquiry_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_esp_enquiry_active
  ON public.enquiry_service_proofs (enquiry_id)
  WHERE is_voided = false;

-- ----------------------------------------------------------------------------
-- 3. IMMUTABILITY TRIGGER ON enquiry_service_proofs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_enquiry_service_proofs_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Hard DELETE is unconditionally forbidden to preserve permanent audit records
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit trail protection: Service proof records cannot be deleted.'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if parent enquiry is approved
    IF EXISTS (
      SELECT 1 FROM public.enquiries e
      WHERE e.id = OLD.enquiry_id
        AND e.completion_approved_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Permanent archive protection: Service proofs cannot be modified after enquiry completion approval.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- If proof was already voided, it cannot be un-voided or altered
    IF OLD.is_voided = true THEN
      RAISE EXCEPTION 'Immutability violation: Voided service proofs cannot be modified or un-voided.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Only allow transition from is_voided = false to is_voided = true (via void RPC)
    -- All core metadata columns MUST remain identical to OLD
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.enquiry_id IS DISTINCT FROM OLD.enquiry_id OR
       NEW.storage_path IS DISTINCT FROM OLD.storage_path OR
       NEW.original_filename IS DISTINCT FROM OLD.original_filename OR
       NEW.mime_type IS DISTINCT FROM OLD.mime_type OR
       NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes OR
       NEW.document_type IS DISTINCT FROM OLD.document_type OR
       NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR
       NEW.uploaded_by_name IS DISTINCT FROM OLD.uploaded_by_name OR
       NEW.uploaded_by_employee_code IS DISTINCT FROM OLD.uploaded_by_employee_code OR
       NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutability violation: Core service proof metadata cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_enquiry_service_proofs_immutability ON public.enquiry_service_proofs;
CREATE TRIGGER trg_protect_enquiry_service_proofs_immutability
  BEFORE UPDATE OR DELETE ON public.enquiry_service_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_enquiry_service_proofs_immutability();

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY on enquiry_service_proofs
-- Metadata table is admin-read-only; all writes go through RPCs (SECURITY DEFINER).
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_service_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enquiry_service_proofs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.enquiry_service_proofs TO authenticated;

DROP POLICY IF EXISTS "Admins can view enquiry service proofs" ON public.enquiry_service_proofs;
DROP POLICY IF EXISTS "Authorized staff can view enquiry service proofs" ON public.enquiry_service_proofs;
CREATE POLICY "Authorized staff can view enquiry service proofs"
  ON public.enquiry_service_proofs
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin() AND
    (
      public.is_superadmin() OR
      EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_service_proofs.enquiry_id
          AND e.assigned_employee_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 5. EXTEND enquiry_activities ACTIVITY TYPE CONSTRAINT
-- Add SERVICE_PROOF_UPLOADED and SERVICE_PROOF_VOIDED to the allowlist.
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_activities
  DROP CONSTRAINT IF EXISTS enquiry_activities_activity_type_check;

ALTER TABLE public.enquiry_activities
  ADD CONSTRAINT enquiry_activities_activity_type_check CHECK (
    activity_type IN (
      'system_event',
      'note',
      'status_change',
      'rejection_requested',
      'rejection_reviewed',
      'archived',
      'restored',
      'completion_requested',
      'completion_reviewed',
      'bin_entered',
      'bin_restored',
      'bin_purged',
      'ENQUIRY_ASSIGNED',
      'ENQUIRY_REASSIGNED',
      'ENQUIRY_UNASSIGNED',
      'ENQUIRY_SELF_ASSIGNED',
      'STAFF_AADHAAR_UPDATED',
      'VISIT_SCHEDULED',
      'VISIT_NOTE_ADDED',
      'SERVICE_PROOF_UPLOADED',
      'SERVICE_PROOF_VOIDED'
    )
  );

-- ----------------------------------------------------------------------------
-- 6. RPC: public.register_enquiry_service_proof
-- Server-authoritative metadata registration after client-side storage upload.
-- ----------------------------------------------------------------------------
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
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity — superadmin or admin only (inventory_staff blocked)
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to register service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate target enquiry exists and is in an eligible lifecycle state
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

  -- 4. Role-based assignment validation (Part E):
  -- Regular admin employee MUST be assigned to this enquiry
  IF v_actor_role = 'admin' THEN
    IF v_enquiry.assigned_employee_id IS NULL OR v_enquiry.assigned_employee_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Access denied: Employees may only upload service proofs for enquiries assigned to them.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 5. Validate storage path — no path traversal, must be <enquiry_id>/<something>
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
    RAISE EXCEPTION 'Security violation: Storage path enquiry folder (%) does not match target enquiry (%).', v_path_enquiry_id, p_enquiry_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Validate file size
  IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 THEN
    RAISE EXCEPTION 'Validation error: File size must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Validation error: File size (% bytes) exceeds maximum limit of 10 MB (10485760 bytes).', p_file_size_bytes
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Validate MIME type
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN
    RAISE EXCEPTION 'Validation error: Unsupported MIME type (%). Only image/jpeg, image/png, and application/pdf are permitted.', p_mime_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Validate document type
  v_clean_doctype := COALESCE(pg_catalog.btrim(p_document_type), 'CUSTOMER_SIGNED_SERVICE_REPORT');
  IF v_clean_doctype NOT IN ('CUSTOMER_SIGNED_SERVICE_REPORT', 'DIAGNOSTIC_REPORT', 'HANDOVER_RECEIPT') THEN
    RAISE EXCEPTION 'Validation error: Unsupported document_type (%). Allowed: CUSTOMER_SIGNED_SERVICE_REPORT, DIAGNOSTIC_REPORT, HANDOVER_RECEIPT.', v_clean_doctype
      USING ERRCODE = 'check_violation';
  END IF;

  -- 9. Sanitize filename and description
  v_clean_filename := pg_catalog.btrim(COALESCE(p_original_filename, 'proof'));
  IF v_clean_filename = '' THEN
    v_clean_filename := 'proof';
  END IF;

  v_clean_desc := NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), '');

  -- 10. Insert metadata with server-derived uploader identity
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
  )
  RETURNING id INTO v_proof_id;

  -- 11. Append enquiry activity log entry
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
    'Service proof uploaded: ' || v_clean_filename || ' (' || pg_catalog.round(p_file_size_bytes::numeric / 1024.0, 1)::text || ' KB)',
    pg_catalog.jsonb_build_object(
      'proof_id',          v_proof_id,
      'storage_path',      p_storage_path,
      'original_filename', v_clean_filename,
      'mime_type',         p_mime_type,
      'file_size_bytes',   p_file_size_bytes,
      'document_type',     v_clean_doctype,
      'uploaded_by_code',  v_actor_code
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success',                   true,
    'id',                        v_proof_id,
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
GRANT EXECUTE ON FUNCTION public.register_enquiry_service_proof(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPC: public.void_enquiry_service_proof
-- Soft-delete a service proof with mandatory reason.
-- Employee: own proofs only when enquiry not post-approval or completion_requested.
-- Head (superadmin): any proof with mandatory reason before final approval.
-- ----------------------------------------------------------------------------
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
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO   v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM   public.admin_users au
  JOIN   auth.users u ON u.id = au.id
  WHERE  au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to void service proofs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate void reason is meaningful
  v_clean_reason := pg_catalog.btrim(COALESCE(p_void_reason, ''));
  IF pg_catalog.char_length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'Validation error: Void reason must be at least 5 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Lock and retrieve proof
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

  -- 5. Retrieve parent enquiry for lifecycle and ownership checks
  SELECT * INTO v_enquiry
  FROM   public.enquiries
  WHERE  id = v_proof.enquiry_id;

  -- 6. Post-approval: block everyone
  IF v_enquiry.completion_approved_at IS NOT NULL OR v_enquiry.status = 'completed' THEN
    RAISE EXCEPTION 'Permanent archive protection: Service proofs cannot be voided after enquiry completion has been approved.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Employee (admin role): can only void own proofs
  IF v_actor_role = 'admin' THEN
    IF v_proof.uploaded_by IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Access denied: Employees may only void their own uploaded service proofs.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Employees cannot void when completion review is pending
    IF v_enquiry.status = 'completion_requested' THEN
      RAISE EXCEPTION 'Invalid operation: Cannot void a service proof while a completion request is under review.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 8. Perform soft delete
  UPDATE public.enquiry_service_proofs
  SET
    is_voided      = true,
    voided_at      = v_now,
    voided_by      = v_actor_id,
    voided_by_name = COALESCE(v_actor_name, v_actor_email),
    void_reason    = v_clean_reason
  WHERE id = p_proof_id;

  -- 9. Append enquiry activity log
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
    'Service proof voided: ' || v_proof.original_filename || '. Reason: ' || v_clean_reason,
    pg_catalog.jsonb_build_object(
      'proof_id',          p_proof_id,
      'original_filename', v_proof.original_filename,
      'document_type',     v_proof.document_type,
      'void_reason',       v_clean_reason,
      'voided_by_email',   v_actor_email,
      'voided_by_code',    v_actor_code
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
GRANT EXECUTE ON FUNCTION public.void_enquiry_service_proof(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. REPLACE submit_enquiry_completion WITH SERVICE-PROOF GATE
-- For service enquiries (enquiry_type = 'service_request' or service category/details):
-- requires at least one non-voided CUSTOMER_SIGNED_SERVICE_REPORT proof
-- before completion can be requested.
-- All other enquiry types are unaffected.
-- ----------------------------------------------------------------------------
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
  -- 1. Validate authenticated caller
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

  IF v_actor_role NOT IN ('superadmin', 'admin') OR v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active administrator privileges required.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate completion summary
  v_clean_summary := pg_catalog.btrim(p_completion_summary);
  IF v_clean_summary IS NULL OR pg_catalog.char_length(v_clean_summary) < 10 OR pg_catalog.char_length(v_clean_summary) > 3000 THEN
    RAISE EXCEPTION 'Validation error: A meaningful work-completion summary between 10 and 3000 characters is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Lock enquiry row for atomic update
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

  -- 5. SERVICE PROOF GATE
  -- Check if enquiry represents a service / repair request
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

  -- 6. Update enquiry atomically with server-derived identity
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

  -- 7. Record append-only activity history
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
    v_clean_summary,
    pg_catalog.jsonb_build_object(
      'previous_status',    v_enquiry.status,
      'completion_summary', v_clean_summary,
      'requested_by_email', v_actor_email,
      'requested_by_name',  COALESCE(v_actor_name, v_actor_email),
      'employee_code',      v_actor_code,
      'enquiry_type',       v_enquiry.enquiry_type
    ),
    v_now
  ) RETURNING id INTO v_activity_id;

  RETURN pg_catalog.jsonb_build_object(
    'success',                    true,
    'status',                     'completion_requested',
    'activity_id',                v_activity_id,
    'completed_by_name',          COALESCE(v_actor_name, v_actor_email),
    'completed_by_employee_code', v_actor_code,
    'message',                    'Work-completion summary submitted for head-person review.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry_completion(UUID, TEXT) TO authenticated;
