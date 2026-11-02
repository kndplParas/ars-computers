-- ============================================================================
-- ARS Computers — Step 5: Customer-Shareable Order Attachments
-- Migration: 20261101000016_order_attachment_customer_sharing.sql
-- ============================================================================
-- PURPOSE:
-- 1. Explicit document classification & Head-only share approval on public.order_attachments.
-- 2. Dedicated public.order_attachment_shares table with SHA-256 token hashing at rest.
-- 3. Server-validated public.order_attachment_access_logs with 90-day retention.
-- 4. Head-only approval RPC (approve_order_attachment_shareability).
-- 5. Staff link creation & revocation RPCs (create_order_attachment_share, revoke_order_attachment_share).
-- 6. Server-side token resolution RPC (resolve_shared_attachment_token).
-- 7. Audit trail logging in public.order_activities.
-- 8. Strict immutability protection on core attachment metadata.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ----------------------------------------------------------------------------
-- 1. EXTEND public.order_attachments WITH CLASSIFICATION & HEAD APPROVAL
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'is_customer_shareable'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN is_customer_shareable BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'is_head_approved'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN is_head_approved BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN approved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'document_type'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN document_type TEXT NOT NULL DEFAULT 'OTHER_INTERNAL';
  END IF;
END $$;

ALTER TABLE public.order_attachments
  DROP CONSTRAINT IF EXISTS chk_order_attachments_document_type;

ALTER TABLE public.order_attachments
  ADD CONSTRAINT chk_order_attachments_document_type
  CHECK (document_type IN (
    'CUSTOMER_INVOICE',
    'CUSTOMER_RECEIPT',
    'QUOTATION',
    'DELIVERY_CHALLAN',
    'WARRANTY_CARD',
    'SUPPLIER_PURCHASE_BILL',
    'INTERNAL_COST_SHEET',
    'STAFF_NOTE',
    'ID_PROOF',
    'OTHER_INTERNAL',
    'OTHER'
  ));

ALTER TABLE public.order_attachments
  DROP CONSTRAINT IF EXISTS chk_order_attachments_approval_integrity;

ALTER TABLE public.order_attachments
  ADD CONSTRAINT chk_order_attachments_approval_integrity
  CHECK (
    (is_head_approved = false) OR
    (
      is_head_approved = true AND
      is_customer_shareable = true AND
      document_type IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD')
    )
  );

-- ----------------------------------------------------------------------------
-- 2. HARDEN IMMUTABILITY TRIGGER ON public.order_attachments
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_order_attachments_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit trail protection: Order attachment records cannot be deleted.'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Core immutable metadata check: core storage and audit attributes can NEVER change
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.order_id IS DISTINCT FROM OLD.order_id OR
       NEW.storage_path IS DISTINCT FROM OLD.storage_path OR
       NEW.original_filename IS DISTINCT FROM OLD.original_filename OR
       NEW.mime_type IS DISTINCT FROM OLD.mime_type OR
       NEW.file_size IS DISTINCT FROM OLD.file_size OR
       NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR
       NEW.uploaded_by_name IS DISTINCT FROM OLD.uploaded_by_name OR
       NEW.uploaded_by_employee_code IS DISTINCT FROM OLD.uploaded_by_employee_code OR
       NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutability violation: Core order attachment metadata cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Shareability & approval modifications: STRICTLY restricted to active superadmin (Head)
    IF (NEW.is_customer_shareable IS DISTINCT FROM OLD.is_customer_shareable OR
        NEW.is_head_approved IS DISTINCT FROM OLD.is_head_approved OR
        NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
        NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
        NEW.document_type IS DISTINCT FROM OLD.document_type) THEN
      IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Only Head / Superadmin can modify customer shareability and approval.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_attachments_immutability ON public.order_attachments;
CREATE TRIGGER trg_protect_order_attachments_immutability
  BEFORE UPDATE OR DELETE ON public.order_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_order_attachments_immutability();

-- ----------------------------------------------------------------------------
-- 3. CREATE public.order_attachment_shares (SHA-256 HASH AT REST)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_attachment_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES public.order_attachments(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_employee_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  revoked_by_name TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  access_count INT NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_accessed_at TIMESTAMPTZ,
  max_access_count INT CHECK (max_access_count IS NULL OR max_access_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_attachment_shares_token_hash ON public.order_attachment_shares (token_hash);
CREATE INDEX IF NOT EXISTS idx_order_attachment_shares_order_id ON public.order_attachment_shares (order_id);
CREATE INDEX IF NOT EXISTS idx_order_attachment_shares_attachment_id ON public.order_attachment_shares (attachment_id);
CREATE INDEX IF NOT EXISTS idx_order_attachment_shares_status ON public.order_attachment_shares (is_revoked, expires_at);

ALTER TABLE public.order_attachment_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_attachment_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_attachment_shares TO authenticated;

DROP POLICY IF EXISTS "Admins can view order attachment shares" ON public.order_attachment_shares;
CREATE POLICY "Admins can view order attachment shares"
  ON public.order_attachment_shares
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. CREATE public.order_attachment_access_logs (SERVER-DERIVED AUDIT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_attachment_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.order_attachment_shares(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  response_status INT NOT NULL DEFAULT 200,
  bytes_served BIGINT,
  retention_until TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_order_attachment_access_logs_share ON public.order_attachment_access_logs (share_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_attachment_access_logs_retention ON public.order_attachment_access_logs (retention_until);

ALTER TABLE public.order_attachment_access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_attachment_access_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_attachment_access_logs TO authenticated;

DROP POLICY IF EXISTS "Admins can view order attachment access logs" ON public.order_attachment_access_logs;
CREATE POLICY "Admins can view order attachment access logs"
  ON public.order_attachment_access_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. UPDATE order_activities ACTIVITY TYPE CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_activities DROP CONSTRAINT IF EXISTS order_activities_activity_type_check;
ALTER TABLE public.order_activities ADD CONSTRAINT order_activities_activity_type_check
  CHECK (
    activity_type IN (
      'ORDER_CREATED',
      'ORDER_PROCESSING_STARTED',
      'ORDER_COMPLETION_SUBMITTED',
      'ORDER_COMPLETION_APPROVED',
      'ORDER_CANCELLED',
      'ORDER_PAYMENT_RECORDED',
      'ORDER_ATTACHMENT_ADDED',
      'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE',
      'ATTACHMENT_MARKED_INTERNAL',
      'ATTACHMENT_SHARE_CREATED',
      'ATTACHMENT_SHARE_REVOKED'
    )
  );

-- ----------------------------------------------------------------------------
-- 6. HEAD RPC: approve_order_attachment_shareability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_order_attachment_shareability(
  p_attachment_id UUID,
  p_is_shareable BOOLEAN,
  p_document_type TEXT
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
  v_att RECORD;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_clean_doc_type TEXT;
  v_activity_type TEXT;
  v_activity_content TEXT;
BEGIN
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify Superadmin Role (Head ONLY)
  SELECT au.role, au.full_name, u.email, au.employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only Head / Superadmin can approve or change customer shareability.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock & Retrieve Attachment Record
  SELECT * INTO v_att
  FROM public.order_attachments
  WHERE id = p_attachment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order attachment % does not exist.', p_attachment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Document Type Validation
  v_clean_doc_type := pg_catalog.btrim(COALESCE(p_document_type, ''));

  IF p_is_shareable THEN
    -- Must be an explicit customer document type
    IF v_clean_doc_type NOT IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD') THEN
      RAISE EXCEPTION 'Validation error: "%" is not an approved customer document type.', v_clean_doc_type
        USING ERRCODE = 'check_violation';
    END IF;

    -- Automated defense-in-depth safety pre-filter
    IF v_att.original_filename ~* '(aadhaar|uidai|cost[_-]?sheet|supplier[_-]?bill|purchase[_-]?invoice|margin|profit|password|audit)' THEN
      RAISE EXCEPTION 'Security violation: Documents with internal cost, supplier, or identity references cannot be marked customer-shareable.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- If marking internal, default type to OTHER_INTERNAL if not supplied
    IF v_clean_doc_type = '' OR v_clean_doc_type IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD') THEN
      v_clean_doc_type := 'OTHER_INTERNAL';
    END IF;
  END IF;

  -- 5. Update Attachment Record
  UPDATE public.order_attachments
  SET
    is_customer_shareable = p_is_shareable,
    is_head_approved = p_is_shareable,
    approved_by = CASE WHEN p_is_shareable THEN v_actor_id ELSE NULL END,
    approved_at = CASE WHEN p_is_shareable THEN v_now ELSE NULL END,
    document_type = v_clean_doc_type
  WHERE id = p_attachment_id;

  -- 6. If unmarking, immediately revoke any active shares for this attachment
  IF NOT p_is_shareable THEN
    UPDATE public.order_attachment_shares
    SET
      is_revoked = true,
      revoked_by = v_actor_id,
      revoked_by_name = COALESCE(v_actor_name, v_actor_email),
      revoked_at = v_now,
      revocation_reason = 'Revoked automatically: Attachment unmarked by Head'
    WHERE attachment_id = p_attachment_id
      AND is_revoked = false;
  END IF;

  -- 7. Record Audit Activity
  IF p_is_shareable THEN
    v_activity_type := 'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE';
    v_activity_content := 'Order attachment "' || v_att.original_filename || '" approved as Customer-Shareable (' || v_clean_doc_type || ') by Head ' || COALESCE(v_actor_name, v_actor_email);
  ELSE
    v_activity_type := 'ATTACHMENT_MARKED_INTERNAL';
    v_activity_content := 'Order attachment "' || v_att.original_filename || '" marked as Internal Only (Confidential) by Head ' || COALESCE(v_actor_name, v_actor_email);
  END IF;

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
    v_att.order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    v_activity_type,
    v_activity_content,
    pg_catalog.jsonb_build_object(
      'attachment_id', v_att.id,
      'original_filename', v_att.original_filename,
      'document_type', v_clean_doc_type,
      'is_customer_shareable', p_is_shareable,
      'is_head_approved', p_is_shareable,
      'approved_by', v_actor_id,
      'actor_name', COALESCE(v_actor_name, v_actor_email),
      'actor_code', v_actor_code
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'attachment_id', v_att.id,
    'order_id', v_att.order_id,
    'is_customer_shareable', p_is_shareable,
    'is_head_approved', p_is_shareable,
    'document_type', v_clean_doc_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_order_attachment_shareability(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_order_attachment_shareability(UUID, BOOLEAN, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. STAFF RPC: create_order_attachment_share (SHA-256 HASH AT REST)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_attachment_share(
  p_attachment_id UUID,
  p_duration_hours INT DEFAULT 48,
  p_max_access_count INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;
  v_att RECORD;
  v_order RECORD;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_expires_at TIMESTAMPTZ;
  v_random_bytes BYTEA;
  v_raw_token TEXT;
  v_token_hash TEXT;
  v_share_id UUID := gen_random_uuid();
BEGIN
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify Role: ONLY superadmin and admin permitted (technical, engineer, hr, account, inventory blocked)
  SELECT au.role, au.full_name, u.email, au.employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active store administrator or head privileges required to create customer share links.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Retrieve & Validate Attachment
  SELECT * INTO v_att
  FROM public.order_attachments
  WHERE id = p_attachment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order attachment % does not exist.', p_attachment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (v_att.is_customer_shareable = true AND v_att.is_head_approved = true) THEN
    RAISE EXCEPTION 'Access denied: Attachment has not been approved for customer sharing by Head Admin.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Retrieve & Validate Order (Cannot share attachments of cancelled orders)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_att.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Target order % does not exist.', v_att.order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Validation error: Cannot create customer share links for cancelled orders.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Duration Validation (1 hour to 168 hours / 7 days)
  IF p_duration_hours IS NULL OR p_duration_hours < 1 OR p_duration_hours > 168 THEN
    RAISE EXCEPTION 'Validation error: Share duration must be between 1 and 168 hours.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_expires_at := v_now + (p_duration_hours || ' hours')::interval;

  -- 6. Cryptographically Secure Token Generation (256-bit entropy)
  v_random_bytes := extensions.gen_random_bytes(32);
  v_raw_token := pg_catalog.encode(v_random_bytes, 'hex');
  v_token_hash := pg_catalog.encode(extensions.digest(v_random_bytes, 'sha256'), 'hex');

  -- 7. Insert Share Record (ONLY hash stored at rest)
  INSERT INTO public.order_attachment_shares (
    id,
    attachment_id,
    order_id,
    token_hash,
    created_by,
    created_by_name,
    created_by_employee_code,
    created_at,
    expires_at,
    is_revoked,
    access_count,
    max_access_count
  ) VALUES (
    v_share_id,
    v_att.id,
    v_att.order_id,
    v_token_hash,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    v_now,
    v_expires_at,
    false,
    0,
    p_max_access_count
  );

  -- 8. Record Order Activity
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
    v_att.order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ATTACHMENT_SHARE_CREATED',
    'Customer share link generated for document "' || v_att.original_filename || '" by ' || COALESCE(v_actor_name, v_actor_email) || ' (Expires in ' || p_duration_hours || 'h)',
    pg_catalog.jsonb_build_object(
      'share_id', v_share_id,
      'attachment_id', v_att.id,
      'original_filename', v_att.original_filename,
      'document_type', v_att.document_type,
      'duration_hours', p_duration_hours,
      'expires_at', v_expires_at,
      'actor_name', COALESCE(v_actor_name, v_actor_email),
      'actor_code', v_actor_code
    ),
    v_now
  );

  -- Return raw token ONCE only to the authorized creator
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'share_id', v_share_id,
    'raw_token', v_raw_token,
    'order_id', v_att.order_id,
    'attachment_id', v_att.id,
    'document_type', v_att.document_type,
    'filename', v_att.original_filename,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_attachment_share(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_attachment_share(UUID, INT, INT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. STAFF RPC: revoke_order_attachment_share
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_order_attachment_share(
  p_share_id UUID,
  p_reason TEXT DEFAULT 'Revoked by staff'
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
  v_share RECORD;
  v_att RECORD;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_clean_reason TEXT;
BEGIN
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify Role: superadmin or admin
  SELECT au.role, au.full_name, u.email, au.employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active store administrator or head privileges required to revoke customer share links.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock & Retrieve Share Record
  SELECT * INTO v_share
  FROM public.order_attachment_shares
  WHERE id = p_share_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order attachment share % does not exist.', p_share_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_share.is_revoked THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'share_id', v_share.id,
      'already_revoked', true
    );
  END IF;

  v_clean_reason := pg_catalog.btrim(COALESCE(p_reason, 'Revoked by staff'));

  -- 4. Update Share Status
  UPDATE public.order_attachment_shares
  SET
    is_revoked = true,
    revoked_by = v_actor_id,
    revoked_by_name = COALESCE(v_actor_name, v_actor_email),
    revoked_at = v_now,
    revocation_reason = v_clean_reason
  WHERE id = p_share_id;

  -- 5. Retrieve Attachment Details for Logging
  SELECT original_filename INTO v_att
  FROM public.order_attachments
  WHERE id = v_share.attachment_id;

  -- 6. Record Activity
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
    v_share.order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ATTACHMENT_SHARE_REVOKED',
    'Customer share link for document "' || COALESCE(v_att.original_filename, 'attachment') || '" revoked by ' || COALESCE(v_actor_name, v_actor_email) || ' (' || v_clean_reason || ')',
    pg_catalog.jsonb_build_object(
      'share_id', v_share.id,
      'attachment_id', v_share.attachment_id,
      'reason', v_clean_reason,
      'actor_name', COALESCE(v_actor_name, v_actor_email),
      'actor_code', v_actor_code
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'share_id', v_share.id,
    'is_revoked', true,
    'revoked_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_order_attachment_share(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_order_attachment_share(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. SERVER-VALIDATED RESOLUTION RPC: resolve_shared_attachment_token
-- ----------------------------------------------------------------------------
-- Executed by trusted server endpoint using service_role or server credentials.
-- Strictly validates:
--   1. Token hash matches.
--   2. Not revoked.
--   3. Not expired.
--   4. Max access count not reached.
--   5. Attachment is still customer-shareable & Head-approved.
--   6. Order is active (not cancelled).
-- Atomically logs client IP, user-agent, increments access count, and returns
-- private storage path for proxy streaming.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shared_attachment_token(
  p_token_hash TEXT,
  p_client_ip TEXT,
  p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_share RECORD;
  v_att RECORD;
  v_order RECORD;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_clean_ip TEXT := pg_catalog.btrim(COALESCE(p_client_ip, '0.0.0.0'));
  v_clean_ua TEXT := pg_catalog.btrim(COALESCE(p_user_agent, 'Unknown'));
BEGIN
  -- 1. Validate hash parameter
  IF p_token_hash IS NULL OR pg_catalog.btrim(p_token_hash) = '' THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'INVALID_TOKEN');
  END IF;

  -- 2. Lookup Share Record by Hash
  SELECT * INTO v_share
  FROM public.order_attachment_shares
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'NOT_FOUND');
  END IF;

  -- 3. Check Revocation
  IF v_share.is_revoked THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'REVOKED');
  END IF;

  -- 4. Check Expiration
  IF v_now >= v_share.expires_at THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'EXPIRED');
  END IF;

  -- 5. Check Max Access Count
  IF v_share.max_access_count IS NOT NULL AND v_share.access_count >= v_share.max_access_count THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'MAX_ACCESS_REACHED');
  END IF;

  -- 6. Retrieve and Validate Underlying Attachment
  SELECT * INTO v_att
  FROM public.order_attachments
  WHERE id = v_share.attachment_id;

  IF NOT FOUND OR NOT (v_att.is_customer_shareable = true AND v_att.is_head_approved = true) THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'UNAPPROVED');
  END IF;

  -- 7. Retrieve and Validate Underlying Order (Cancelled orders strictly block sharing)
  SELECT status INTO v_order
  FROM public.orders
  WHERE id = v_share.order_id;

  IF NOT FOUND OR v_order.status = 'cancelled' THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'ORDER_CANCELLED');
  END IF;

  -- 8. Atomic Audit Log & Access Counter Increment
  UPDATE public.order_attachment_shares
  SET
    access_count = access_count + 1,
    last_accessed_at = v_now
  WHERE id = v_share.id;

  INSERT INTO public.order_attachment_access_logs (
    share_id,
    accessed_at,
    ip_address,
    user_agent,
    response_status,
    bytes_served
  ) VALUES (
    v_share.id,
    v_now,
    v_clean_ip,
    v_clean_ua,
    200,
    v_att.file_size
  );

  -- 9. Return storage metadata to trusted server endpoint
  RETURN pg_catalog.jsonb_build_object(
    'valid', true,
    'share_id', v_share.id,
    'storage_path', v_att.storage_path,
    'original_filename', v_att.original_filename,
    'mime_type', v_att.mime_type,
    'file_size', v_att.file_size,
    'document_type', v_att.document_type
  );
END;
$$;

-- Resolution RPC can be executed by service_role and authenticated roles
REVOKE ALL ON FUNCTION public.resolve_shared_attachment_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_shared_attachment_token(TEXT, TEXT, TEXT) TO authenticated, service_role;
