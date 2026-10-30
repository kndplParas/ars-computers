-- ============================================================================
-- ARS Computers — Migration: 20261029000002_order_attachments_and_incremental_payments.sql
-- ============================================================================
-- PURPOSE:
-- 1. Storage bucket 'order-attachments' for private, confidential order documents
--    (JPG, JPEG, PNG, PDF up to 10 MB).
-- 2. public.order_attachments metadata table with ON DELETE RESTRICT and UNIQUE storage_path.
-- 3. public.order_payments immutable financial transaction table with ON DELETE RESTRICT.
-- 4. public.register_order_attachment RPC: server-derived uploader identity (anti-spoofing).
-- 5. public.record_order_payment RPC: atomic incremental payment updates.
-- 6. Updated public.create_sales_order RPC recording initial payments in order_payments.
-- 7. Whitelist immutability trigger protection on completed & cancelled orders.
-- 8. Hardened storage RLS policies blocking inventory_staff and enforcing order folder binding.
-- 9. Idempotent historical transition script for existing orders.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORAGE: 'order-attachments' BUCKET & RLS POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'order-attachments',
      'order-attachments',
      false, -- Strictly private
      10485760, -- 10 MB (10 * 1024 * 1024 bytes)
      ARRAY['image/jpeg', 'image/png', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Drop pre-existing policies on 'order-attachments'
    DROP POLICY IF EXISTS "Staff can view order attachments objects" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can view order attachments objects" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can upload order attachments objects" ON storage.objects;
    DROP POLICY IF EXISTS "Superadmin can delete order attachments objects" ON storage.objects;

    -- Policy: Read/download access strictly for active store admins and superadmins
    -- (inventory_staff and anonymous are completely blocked)
    CREATE POLICY "Admins can view order attachments objects"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'order-attachments' AND
        public.is_admin()
      );

    -- Policy: Upload access strictly for active store admins and superadmins
    -- Path must be <order_id>/<filename> where order_id exists in public.orders and is not cancelled
    CREATE POLICY "Admins can upload order attachments objects"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'order-attachments' AND
        public.is_admin() AND
        (
          COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 10485760
        ) AND
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id::text = (storage.foldername(name))[1]
            AND o.status != 'cancelled'
        )
      );

    -- Policy: Delete access strictly restricted to superadmin
    CREATE POLICY "Superadmin can delete order attachments objects"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'order-attachments' AND
        public.is_superadmin()
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.order_attachments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  uploaded_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  uploaded_by_employee_code TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT chk_order_attachments_mime CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'application/pdf')
  ),
  CONSTRAINT chk_order_attachments_size CHECK (
    file_size <= 10485760
  )
);

CREATE INDEX IF NOT EXISTS idx_order_attachments_order_id ON public.order_attachments (order_id);

ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_attachments TO authenticated;

DROP POLICY IF EXISTS "Staff can view order attachments" ON public.order_attachments;
DROP POLICY IF EXISTS "Admins can view order attachments" ON public.order_attachments;
CREATE POLICY "Admins can view order attachments"
  ON public.order_attachments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.order_payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount_received NUMERIC(12, 2) NOT NULL CHECK (amount_received > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other')),
  transaction_reference TEXT,
  remarks TEXT,
  received_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  received_by_name TEXT,
  received_by_employee_code TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id_received ON public.order_payments (order_id, received_at DESC);

-- Immutability & Anti-Deletion Trigger for order_payments
CREATE OR REPLACE FUNCTION public.trg_protect_order_payments_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Permanent financial record protection: Payment transactions cannot be deleted.'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Permanent financial record protection: Payment transactions are immutable.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_payments_immutability ON public.order_payments;
CREATE TRIGGER trg_protect_order_payments_immutability
  BEFORE UPDATE OR DELETE ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_order_payments_immutability();

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_payments TO authenticated;

DROP POLICY IF EXISTS "Staff can view order payments" ON public.order_payments;
DROP POLICY IF EXISTS "Admins can view order payments" ON public.order_payments;
CREATE POLICY "Admins can view order payments"
  ON public.order_payments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. UPDATE ACTIVITY TYPE CONSTRAINT ON order_activities
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
      'ORDER_ATTACHMENT_ADDED'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. REVISE trg_protect_order_immutability (STRICT WHITELIST MODEL)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_order_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Cancelled orders can NEVER be modified in any way
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order immutability violation: Cancelled orders are permanently finalized and cannot be modified.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Completed orders: strict whitelist model
  -- ONLY paid_amount, payment_status, and updated_at may change (via record_order_payment)
  -- Every other column must remain identical to OLD
  IF OLD.status = 'completed' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.order_number IS DISTINCT FROM OLD.order_number OR
       NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.contact_info IS DISTINCT FROM OLD.contact_info OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.created_by_name IS DISTINCT FROM OLD.created_by_name OR
       NEW.created_by_employee_code IS DISTINCT FROM OLD.created_by_employee_code OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at OR
       NEW.completion_requested_by IS DISTINCT FROM OLD.completion_requested_by OR
       NEW.completed_by_name IS DISTINCT FROM OLD.completed_by_name OR
       NEW.completed_by_employee_code IS DISTINCT FROM OLD.completed_by_employee_code OR
       NEW.employee_remarks IS DISTINCT FROM OLD.employee_remarks OR
       NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at OR
       NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by OR
       NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name OR
       NEW.approved_by_employee_code IS DISTINCT FROM OLD.approved_by_employee_code OR
       NEW.head_remarks IS DISTINCT FROM OLD.head_remarks OR
       NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason OR
       NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
       NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
       NEW.cancelled_by_name IS DISTINCT FROM OLD.cancelled_by_name OR
       NEW.is_archived IS DISTINCT FROM OLD.is_archived OR
       NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      RAISE EXCEPTION 'Order immutability violation: Completed orders are permanently locked. Core workflow, customer, and audit attributes cannot be modified.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: register_order_attachment (SERVER-DERIVED IDENTITY & ANTI-SPOOFING)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_order_attachment(
  p_order_id UUID,
  p_storage_path TEXT,
  p_original_filename TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT
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
  v_order_status TEXT;
  v_order_number TEXT;
  v_path_order_id TEXT;
  v_clean_filename TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_attachment_id UUID;
BEGIN
  -- 1. Validate authenticated caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff identity and role (superadmin & admin only, inventory_staff blocked)
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to register attachments.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Verify target order exists and is not cancelled
  SELECT status, order_number INTO v_order_status, v_order_number
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Order % does not exist.', p_order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Validation error: Cannot attach documents to a cancelled order.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Validate storage path matches target order and blocks path traversal
  IF p_storage_path IS NULL OR pg_catalog.btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'Validation error: Storage path cannot be empty.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_storage_path LIKE '%..%' OR p_storage_path LIKE '%\\%' OR p_storage_path LIKE '//%' THEN
    RAISE EXCEPTION 'Security violation: Path traversal or invalid characters detected in storage path.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_path_order_id := pg_catalog.split_part(p_storage_path, '/', 1);
  IF v_path_order_id IS DISTINCT FROM p_order_id::text THEN
    RAISE EXCEPTION 'Security violation: Storage path order folder (%) does not match target order (%).', v_path_order_id, p_order_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Validate file size (10 MB = 10485760 bytes)
  IF p_file_size IS NULL OR p_file_size <= 0 THEN
    RAISE EXCEPTION 'Validation error: File size must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_file_size > 10485760 THEN
    RAISE EXCEPTION 'Validation error: File size (% bytes) exceeds maximum limit of 10 MB (10485760 bytes).', p_file_size
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Validate MIME type
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN
    RAISE EXCEPTION 'Validation error: Unsupported MIME type (%). Only image/jpeg, image/png, and application/pdf are permitted.', p_mime_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Sanitize filename for display metadata
  v_clean_filename := pg_catalog.btrim(COALESCE(p_original_filename, 'attachment'));
  IF v_clean_filename = '' THEN
    v_clean_filename := 'attachment';
  END IF;

  -- 8. Insert metadata with server-derived uploader identity
  INSERT INTO public.order_attachments (
    order_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    uploaded_by,
    uploaded_by_name,
    uploaded_by_employee_code,
    uploaded_at,
    created_at
  ) VALUES (
    p_order_id,
    p_storage_path,
    v_clean_filename,
    p_mime_type,
    p_file_size,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    v_now,
    v_now
  )
  RETURNING id INTO v_attachment_id;

  -- 9. Append order activity entry atomically
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
    'ORDER_ATTACHMENT_ADDED',
    'Document attached: ' || v_clean_filename || ' (' || pg_catalog.round(p_file_size::numeric / 1024.0, 1)::text || ' KB)',
    pg_catalog.jsonb_build_object(
      'attachment_id', v_attachment_id,
      'storage_path', p_storage_path,
      'original_filename', v_clean_filename,
      'mime_type', p_mime_type,
      'file_size', p_file_size
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', v_attachment_id,
    'order_id', p_order_id,
    'storage_path', p_storage_path,
    'original_filename', v_clean_filename,
    'mime_type', p_mime_type,
    'file_size', p_file_size,
    'uploaded_by', v_actor_id,
    'uploaded_by_name', COALESCE(v_actor_name, v_actor_email),
    'uploaded_by_employee_code', v_actor_code,
    'uploaded_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_attachment(UUID, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_order_attachment(UUID, TEXT, TEXT, TEXT, BIGINT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPC: record_order_payment
-- ----------------------------------------------------------------------------
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

  -- 2. Verify active staff identity and role (inventory_staff blocked)
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to record payments.'
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
  v_remaining := v_order.total_amount - v_order.paid_amount;
  IF p_amount_received > v_remaining THEN
    RAISE EXCEPTION 'Validation error: Payment amount (₹%) exceeds remaining balance due (₹%).',
      p_amount_received, v_remaining
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Clean payment method
  v_clean_method := pg_catalog.btrim(pg_catalog.lower(COALESCE(p_payment_method, 'cash')));
  IF v_clean_method NOT IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Validation error: Invalid payment method "%".', p_payment_method
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Compute new paid amount and status
  v_new_paid := v_order.paid_amount + p_amount_received;
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
GRANT EXECUTE ON FUNCTION public.record_order_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: create_sales_order (POPULATE INITIAL PAYMENT IN order_payments)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_customer_name TEXT,
  p_contact_info TEXT,
  p_items JSONB,
  p_paid_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_employee_remarks TEXT DEFAULT NULL
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
  v_seq_num BIGINT;
  v_order_number TEXT;
  v_order_id UUID;
  v_calc_total NUMERIC(12, 2) := 0;
  v_item JSONB;
  v_qty INT;
  v_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_product_id UUID;
  v_product RECORD;
  v_payment_status TEXT;
  v_clean_method TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Validate caller authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role (inventory_staff cannot create orders)
  SELECT au.role, au.full_name, au.employee_code, u.email
  INTO v_actor_role, v_actor_name, v_actor_code, v_actor_email
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.id
  WHERE au.id = v_actor_id AND au.is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Active administrator or store employee privileges required to create orders.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3. Validate customer inputs
  IF p_customer_name IS NULL OR pg_catalog.btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Validation error: Customer name is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_contact_info IS NULL OR pg_catalog.btrim(p_contact_info) = '' THEN
    RAISE EXCEPTION 'Validation error: Customer contact info is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Validation error: An order must contain at least one line item.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_clean_method := pg_catalog.btrim(pg_catalog.lower(COALESCE(p_payment_method, 'cash')));
  IF v_clean_method NOT IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other') THEN
    v_clean_method := 'cash';
  END IF;

  -- 4. Calculate total amount across all items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::INT;
    v_price := (v_item ->> 'unit_price')::NUMERIC(12, 2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Validation error: Line item quantity must be greater than zero.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Validation error: Line item unit price cannot be negative.'
        USING ERRCODE = 'check_violation';
    END IF;

    v_line_total := v_qty * v_price;
    v_calc_total := v_calc_total + v_line_total;
  END LOOP;

  IF p_paid_amount > v_calc_total THEN
    RAISE EXCEPTION 'Validation error: Paid amount (%) cannot exceed total amount (%).', p_paid_amount, v_calc_total
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_paid_amount = 0 THEN
    v_payment_status := 'pending';
  ELSIF p_paid_amount = v_calc_total THEN
    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'partial';
  END IF;

  -- 5. Generate human-readable order reference
  v_seq_num := nextval('public.order_reference_seq');
  v_order_number := 'ARS-ORD-' || pg_catalog.lpad(v_seq_num::text, 5, '0');

  -- 6. Insert Order Record
  INSERT INTO public.orders (
    order_number,
    customer_name,
    contact_info,
    status,
    total_amount,
    paid_amount,
    payment_status,
    payment_method,
    created_by,
    created_by_name,
    created_by_employee_code,
    employee_remarks,
    created_at,
    updated_at
  ) VALUES (
    v_order_number,
    pg_catalog.btrim(p_customer_name),
    pg_catalog.btrim(p_contact_info),
    'new',
    v_calc_total,
    p_paid_amount,
    v_payment_status,
    v_clean_method,
    v_actor_id,
    COALESCE(v_actor_name, v_actor_email),
    v_actor_code,
    pg_catalog.btrim(p_employee_remarks),
    v_now,
    v_now
  )
  RETURNING id INTO v_order_id;

  -- 7. Insert Line Items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::INT;
    v_price := (v_item ->> 'unit_price')::NUMERIC(12, 2);
    v_line_total := v_qty * v_price;

    IF (v_item ->> 'product_id') IS NOT NULL AND (v_item ->> 'product_id') != '' THEN
      v_product_id := (v_item ->> 'product_id')::UUID;
      SELECT name, brand, model, sku INTO v_product
      FROM public.products
      WHERE id = v_product_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Validation error: Product ID % does not exist in catalogue.', v_product_id
          USING ERRCODE = 'no_data_found';
      END IF;

      INSERT INTO public.order_items (
        order_id,
        product_id,
        product_name_snapshot,
        brand_snapshot,
        model_snapshot,
        sku_snapshot,
        quantity,
        unit_price,
        line_total,
        created_at
      ) VALUES (
        v_order_id,
        v_product_id,
        v_product.name,
        v_product.brand,
        v_product.model,
        v_product.sku,
        v_qty,
        v_price,
        v_line_total,
        v_now
      );
    ELSE
      -- Custom/Ad-hoc order item
      INSERT INTO public.order_items (
        order_id,
        product_id,
        product_name_snapshot,
        brand_snapshot,
        model_snapshot,
        sku_snapshot,
        quantity,
        unit_price,
        line_total,
        created_at
      ) VALUES (
        v_order_id,
        NULL,
        pg_catalog.btrim(COALESCE(v_item ->> 'product_name', 'Custom Hardware Item')),
        v_item ->> 'brand',
        v_item ->> 'model',
        v_item ->> 'sku',
        v_qty,
        v_price,
        v_line_total,
        v_now
      );
    END IF;
  END LOOP;

  -- 8. Record initial payment in public.order_payments if paid_amount > 0
  IF p_paid_amount > 0 THEN
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
      v_order_id,
      p_paid_amount,
      v_clean_method,
      'INITIAL_DOWNPAYMENT',
      'Initial payment recorded during order creation',
      v_actor_id,
      COALESCE(v_actor_name, v_actor_email),
      v_actor_code,
      v_now,
      v_now
    );
  END IF;

  -- 9. Record audit activity
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
    v_order_id,
    v_actor_id,
    v_actor_email,
    v_actor_role,
    'ORDER_CREATED',
    'Order created with total amount ₹' || v_calc_total::text,
    pg_catalog.jsonb_build_object(
      'order_number', v_order_number,
      'total_amount', v_calc_total,
      'paid_amount', p_paid_amount,
      'payment_status', v_payment_status,
      'payment_method', v_clean_method
    ),
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_calc_total,
    'paid_amount', p_paid_amount,
    'payment_status', v_payment_status
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. HISTORICAL TRANSITION: POPULATE INITIAL PAYMENTS FOR EXISTING ORDERS
-- ----------------------------------------------------------------------------
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
  COALESCE(o.payment_method, 'cash'),
  'HISTORICAL_INITIAL_PAYMENT',
  'Initial payment recorded during order creation',
  o.created_by,
  o.created_by_name,
  o.created_by_employee_code,
  o.created_at,
  o.created_at
FROM public.orders o
WHERE o.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_payments op
    WHERE op.order_id = o.id
      AND op.transaction_reference = 'HISTORICAL_INITIAL_PAYMENT'
  );
