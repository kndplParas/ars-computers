-- ============================================================================
-- ARS Computers — Step 5 Security Remediation
-- Migration: 20261101000017_remediate_order_attachment_sharing_security.sql
-- ============================================================================
-- REMEDIATIONS APPLIED:
-- 1. Priority 1 — Revoke resolve_shared_attachment_token from PUBLIC, anon, authenticated.
--    Grant EXECUTE strictly to service_role only.
-- 2. Priority 2 — Restrict order_attachment_shares and order_attachment_access_logs
--    RLS strictly to Head Superadmin ('superadmin') and Store Admin ('admin') using
--    public.get_staff_role() IN ('superadmin', 'admin'). Revoke from all other roles.
-- 3. Priority 4 — Persisted Store Admin shareability request & Head approval workflow:
--    - Columns added on public.order_attachments: share_request_status, share_requested_by,
--      share_requested_at, share_requested_document_type, share_request_notes,
--      share_reviewed_by, share_reviewed_at, share_review_rejection_reason.
--    - New RPC: request_order_attachment_shareability.
--    - New RPC: review_order_attachment_share_request (Head only, self-approval blocked).
--    - Activity types ATTACHMENT_SHARE_REQUESTED and ATTACHMENT_SHARE_REJECTED added.
--    - Immutability trigger updated to guard request fields vs approval fields.
-- 4. Priority 5 — IP masking helper, masked_ip column on access logs, and 90-day
--    retention cleanup RPC (cleanup_expired_order_attachment_access_logs).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRIORITY 1: CRITICAL RPC PERMISSION DEFECT FIX
-- ----------------------------------------------------------------------------
-- Revoke execution from ordinary authenticated clients, public, and anon
REVOKE ALL ON FUNCTION public.resolve_shared_attachment_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
-- Grant exclusively to service_role for trusted server endpoint proxy execution
GRANT EXECUTE ON FUNCTION public.resolve_shared_attachment_token(TEXT, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. PRIORITY 2: RESTRICT SHARES & ACCESS LOGS RLS TO HEAD & STORE ADMIN ONLY
-- ----------------------------------------------------------------------------
-- Replace overly broad public.is_admin() policy with explicit ('superadmin', 'admin') check
DROP POLICY IF EXISTS "Admins can view order attachment shares" ON public.order_attachment_shares;
DROP POLICY IF EXISTS "Head and store admins can view order attachment shares" ON public.order_attachment_shares;

CREATE POLICY "Head and store admins can view order attachment shares"
  ON public.order_attachment_shares
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() IN ('superadmin', 'admin'));

-- Access logs policy: Head and Store Admin ONLY
DROP POLICY IF EXISTS "Admins can view order attachment access logs" ON public.order_attachment_access_logs;
DROP POLICY IF EXISTS "Head and store admins can view order attachment access logs" ON public.order_attachment_access_logs;

CREATE POLICY "Head and store admins can view order attachment access logs"
  ON public.order_attachment_access_logs
  FOR SELECT
  TO authenticated
  USING (public.get_staff_role() IN ('superadmin', 'admin'));

-- Ensure client roles have ZERO write capabilities on shares or access logs
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_attachment_shares FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_attachment_access_logs FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. PRIORITY 4: PERSISTED ADMIN REQUEST & HEAD APPROVAL WORKFLOW
-- ----------------------------------------------------------------------------
-- Extend public.order_attachments with share request metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_request_status'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_request_status TEXT NOT NULL DEFAULT 'NONE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_requested_by'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_requested_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_requested_by_name'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_requested_by_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_requested_by_employee_code'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_requested_by_employee_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_requested_at'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_requested_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_requested_document_type'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_requested_document_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_request_notes'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_request_notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_reviewed_by'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_reviewed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_reviewed_at'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_reviewed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachments'
      AND column_name = 'share_review_rejection_reason'
  ) THEN
    ALTER TABLE public.order_attachments
      ADD COLUMN share_review_rejection_reason TEXT;
  END IF;
END $$;

ALTER TABLE public.order_attachments
  DROP CONSTRAINT IF EXISTS chk_order_attachments_share_request_status;

ALTER TABLE public.order_attachments
  ADD CONSTRAINT chk_order_attachments_share_request_status
  CHECK (share_request_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED'));

-- Backfill status for existing approved attachments
UPDATE public.order_attachments
SET
  share_request_status = 'APPROVED',
  share_reviewed_by = approved_by,
  share_reviewed_at = approved_at
WHERE is_head_approved = true AND share_request_status = 'NONE';

-- Extend order_activities activity_type constraint
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
      'ATTACHMENT_SHARE_REQUESTED',
      'ATTACHMENT_SHARE_REJECTED',
      'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE',
      'ATTACHMENT_MARKED_INTERNAL',
      'ATTACHMENT_SHARE_CREATED',
      'ATTACHMENT_SHARE_REVOKED'
    )
  );

-- Update Immutability Trigger on order_attachments
CREATE OR REPLACE FUNCTION public.trg_protect_order_attachments_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
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

    v_caller_role := public.get_staff_role();

    -- Share request modifications: Store Admin ('admin') or Superadmin ('superadmin') only
    IF (NEW.share_request_status IS DISTINCT FROM OLD.share_request_status OR
        NEW.share_requested_by IS DISTINCT FROM OLD.share_requested_by OR
        NEW.share_requested_at IS DISTINCT FROM OLD.share_requested_at OR
        NEW.share_requested_document_type IS DISTINCT FROM OLD.share_requested_document_type OR
        NEW.share_request_notes IS DISTINCT FROM OLD.share_request_notes OR
        NEW.share_reviewed_by IS DISTINCT FROM OLD.share_reviewed_by OR
        NEW.share_reviewed_at IS DISTINCT FROM OLD.share_reviewed_at OR
        NEW.share_review_rejection_reason IS DISTINCT FROM OLD.share_review_rejection_reason) THEN
      IF v_caller_role NOT IN ('superadmin', 'admin') THEN
        RAISE EXCEPTION 'Access denied: Only Store Administrator or Head can submit or review share requests.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
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

-- RPC: request_order_attachment_shareability (Store Admin & Head)
CREATE OR REPLACE FUNCTION public.request_order_attachment_shareability(
  p_attachment_id UUID,
  p_document_type TEXT,
  p_notes TEXT DEFAULT NULL
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
  v_clean_notes TEXT;
BEGIN
  -- 1. Validate caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify Role: Admin and Superadmin can submit share requests
  SELECT au.role, au.full_name, u.email, au.employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only Store Administrator or Head can request customer shareability.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock & Retrieve Attachment
  SELECT * INTO v_att
  FROM public.order_attachments
  WHERE id = p_attachment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order attachment % does not exist.', p_attachment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_att.is_head_approved = true AND v_att.is_customer_shareable = true THEN
    RAISE EXCEPTION 'Validation error: Attachment is already approved for customer sharing.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Validate Document Type
  v_clean_doc_type := pg_catalog.btrim(COALESCE(p_document_type, ''));
  IF v_clean_doc_type NOT IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD') THEN
    RAISE EXCEPTION 'Validation error: "%" is not an approved customer document type.', v_clean_doc_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Defense-in-depth safety pre-filter
  IF v_att.original_filename ~* '(aadhaar|uidai|cost[_-]?sheet|supplier[_-]?bill|purchase[_-]?invoice|margin|profit|password|audit)' THEN
    RAISE EXCEPTION 'Security violation: Documents with internal cost, supplier, or identity references cannot be requested for customer sharing.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_notes := pg_catalog.btrim(COALESCE(p_notes, ''));

  -- 6. Persist Request on Attachment
  UPDATE public.order_attachments
  SET
    share_request_status = 'PENDING',
    share_requested_by = v_actor_id,
    share_requested_by_name = COALESCE(v_actor_name, v_actor_email),
    share_requested_by_employee_code = v_actor_code,
    share_requested_at = v_now,
    share_requested_document_type = v_clean_doc_type,
    share_request_notes = v_clean_notes,
    share_review_rejection_reason = NULL
  WHERE id = p_attachment_id;

  -- 7. Audit Logging in order_activities
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
    'ATTACHMENT_SHARE_REQUESTED',
    'Customer shareability requested for document "' || v_att.original_filename || '" (' || v_clean_doc_type || ') by ' || COALESCE(v_actor_name, v_actor_email),
    pg_catalog.jsonb_build_object(
      'attachment_id', v_att.id,
      'original_filename', v_att.original_filename,
      'requested_document_type', v_clean_doc_type,
      'notes', v_clean_notes,
      'requested_by', v_actor_id,
      'requester_name', COALESCE(v_actor_name, v_actor_email),
      'requester_code', v_actor_code
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'attachment_id', v_att.id,
    'order_id', v_att.order_id,
    'share_request_status', 'PENDING',
    'requested_document_type', v_clean_doc_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_order_attachment_shareability(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_attachment_shareability(UUID, TEXT, TEXT) TO authenticated;

-- RPC: review_order_attachment_share_request (Head ONLY, Admin self-approval strictly blocked)
CREATE OR REPLACE FUNCTION public.review_order_attachment_share_request(
  p_attachment_id UUID,
  p_decision TEXT,
  p_document_type TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
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
  v_clean_decision TEXT;
  v_clean_doc_type TEXT;
  v_clean_reason TEXT;
  v_activity_type TEXT;
  v_activity_content TEXT;
BEGIN
  -- 1. Validate caller session
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
    RAISE EXCEPTION 'Access denied: Only Head / Superadmin can review or approve customer share requests.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Lock & Retrieve Attachment
  SELECT * INTO v_att
  FROM public.order_attachments
  WHERE id = p_attachment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order attachment % does not exist.', p_attachment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  v_clean_decision := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_decision, '')));
  IF v_clean_decision NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Validation error: Decision must be either APPROVED or REJECTED.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_clean_decision = 'APPROVED' THEN
    v_clean_doc_type := pg_catalog.btrim(COALESCE(p_document_type, v_att.share_requested_document_type, v_att.document_type, ''));
    IF v_clean_doc_type NOT IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD') THEN
      RAISE EXCEPTION 'Validation error: "%" is not an approved customer document type.', v_clean_doc_type
        USING ERRCODE = 'check_violation';
    END IF;

    -- Safety pre-filter
    IF v_att.original_filename ~* '(aadhaar|uidai|cost[_-]?sheet|supplier[_-]?bill|purchase[_-]?invoice|margin|profit|password|audit)' THEN
      RAISE EXCEPTION 'Security violation: Documents with internal cost, supplier, or identity references cannot be marked customer-shareable.'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.order_attachments
    SET
      is_customer_shareable = true,
      is_head_approved = true,
      approved_by = v_actor_id,
      approved_at = v_now,
      document_type = v_clean_doc_type,
      share_request_status = 'APPROVED',
      share_reviewed_by = v_actor_id,
      share_reviewed_at = v_now,
      share_review_rejection_reason = NULL
    WHERE id = p_attachment_id;

    v_activity_type := 'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE';
    v_activity_content := 'Customer shareability approved for document "' || v_att.original_filename || '" (' || v_clean_doc_type || ') by Head ' || COALESCE(v_actor_name, v_actor_email);

  ELSE -- REJECTED
    v_clean_reason := pg_catalog.btrim(COALESCE(p_rejection_reason, 'Rejected by Head Administrator'));
    IF pg_catalog.length(v_clean_reason) < 3 THEN
      RAISE EXCEPTION 'Validation error: Rejection reason must be at least 3 characters.'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.order_attachments
    SET
      is_customer_shareable = false,
      is_head_approved = false,
      approved_by = NULL,
      approved_at = NULL,
      share_request_status = 'REJECTED',
      share_reviewed_by = v_actor_id,
      share_reviewed_at = v_now,
      share_review_rejection_reason = v_clean_reason
    WHERE id = p_attachment_id;

    -- Invalidate any active shares for this attachment
    UPDATE public.order_attachment_shares
    SET
      is_revoked = true,
      revoked_by = v_actor_id,
      revoked_by_name = COALESCE(v_actor_name, v_actor_email),
      revoked_at = v_now,
      revocation_reason = 'Revoked: Share request rejected by Head (' || v_clean_reason || ')'
    WHERE attachment_id = p_attachment_id
      AND is_revoked = false;

    v_activity_type := 'ATTACHMENT_SHARE_REJECTED';
    v_activity_content := 'Customer shareability request rejected for document "' || v_att.original_filename || '" by Head ' || COALESCE(v_actor_name, v_actor_email) || ' (Reason: ' || v_clean_reason || ')';
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
      'decision', v_clean_decision,
      'document_type', v_clean_doc_type,
      'rejection_reason', v_clean_reason,
      'reviewed_by', v_actor_id,
      'reviewer_name', COALESCE(v_actor_name, v_actor_email)
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'attachment_id', v_att.id,
    'order_id', v_att.order_id,
    'share_request_status', v_clean_decision,
    'is_customer_shareable', (v_clean_decision = 'APPROVED'),
    'is_head_approved', (v_clean_decision = 'APPROVED')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_order_attachment_share_request(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_order_attachment_share_request(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Update approve_order_attachment_shareability to sync share_request_status
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
    IF v_clean_doc_type NOT IN ('CUSTOMER_INVOICE', 'CUSTOMER_RECEIPT', 'QUOTATION', 'DELIVERY_CHALLAN', 'WARRANTY_CARD') THEN
      RAISE EXCEPTION 'Validation error: "%" is not an approved customer document type.', v_clean_doc_type
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_att.original_filename ~* '(aadhaar|uidai|cost[_-]?sheet|supplier[_-]?bill|purchase[_-]?invoice|margin|profit|password|audit)' THEN
      RAISE EXCEPTION 'Security violation: Documents with internal cost, supplier, or identity references cannot be marked customer-shareable.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
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
    document_type = v_clean_doc_type,
    share_request_status = CASE WHEN p_is_shareable THEN 'APPROVED' ELSE 'NONE' END,
    share_reviewed_by = v_actor_id,
    share_reviewed_at = v_now,
    share_review_rejection_reason = NULL
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

-- ----------------------------------------------------------------------------
-- 4. PRIORITY 5: IP MASKING & 90-DAY ACCESS LOG RETENTION CLEANUP
-- ----------------------------------------------------------------------------
-- IP masking helper
CREATE OR REPLACE FUNCTION public.mask_ip_address(p_ip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_ip IS NULL OR pg_catalog.btrim(p_ip) = '' THEN
    RETURN '0.0.0.xxx';
  END IF;
  IF p_ip ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' THEN
    RETURN regexp_replace(p_ip, '\.[0-9]{1,3}$', '.xxx');
  ELSIF p_ip ~ ':' THEN
    RETURN regexp_replace(p_ip, ':[^:]+$', ':xxxx');
  ELSE
    RETURN 'xxx.xxx.xxx.xxx';
  END IF;
END;
$$;

-- Add masked_ip column to order_attachment_access_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_attachment_access_logs'
      AND column_name = 'masked_ip'
  ) THEN
    ALTER TABLE public.order_attachment_access_logs
      ADD COLUMN masked_ip TEXT;
  END IF;
END $$;

-- Backfill masked_ip for existing logs
UPDATE public.order_attachment_access_logs
SET masked_ip = public.mask_ip_address(ip_address)
WHERE masked_ip IS NULL;

-- Update resolve_shared_attachment_token with IP masking and service_role security
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
  v_clean_ua TEXT := pg_catalog.substr(pg_catalog.btrim(COALESCE(p_user_agent, 'Unknown')), 1, 150);
  v_masked_ip TEXT;
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

  -- 8. Compute masked IP for privacy
  v_masked_ip := public.mask_ip_address(v_clean_ip);

  -- 9. Atomic Audit Log & Access Counter Increment
  UPDATE public.order_attachment_shares
  SET
    access_count = access_count + 1,
    last_accessed_at = v_now
  WHERE id = v_share.id;

  INSERT INTO public.order_attachment_access_logs (
    share_id,
    accessed_at,
    ip_address,
    masked_ip,
    user_agent,
    response_status,
    bytes_served
  ) VALUES (
    v_share.id,
    v_now,
    v_clean_ip,
    v_masked_ip,
    v_clean_ua,
    200,
    v_att.file_size
  );

  -- 10. Return storage metadata to trusted server endpoint
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

-- Retention Cleanup RPC: 90-day retention enforcement
CREATE OR REPLACE FUNCTION public.cleanup_expired_order_attachment_access_logs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller_role TEXT;
  v_deleted_count INT;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  -- Verify caller: service_role or Superadmin only
  IF auth.role() != 'service_role' THEN
    v_caller_role := public.get_staff_role();
    IF v_caller_role != 'superadmin' THEN
      RAISE EXCEPTION 'Access denied: Only service_role or Head / Superadmin can execute log retention cleanup.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  DELETE FROM public.order_attachment_access_logs
  WHERE retention_until < v_now;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'deleted_logs_count', v_deleted_count,
    'cleaned_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_order_attachment_access_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_order_attachment_access_logs() TO service_role, authenticated;


