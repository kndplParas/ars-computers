-- ============================================================================
-- ARS Computers — Migration 20261024000003: After-Sales Service Request System
-- ============================================================================
-- PURPOSE:
-- 1. Dedicated public.service_requests table for after-sales repair & support tickets
--    (completely isolated from pre-sales commercial enquiries).
-- 2. Human-readable unique ticket numbering sequence (ARS-SR-YYYYMMDD-XXXX).
-- 3. Comprehensive hardware diagnostics & conditional fields (CCTV, Computing, Printers, etc.).
-- 4. Status & role-based workflow (New -> Assigned -> In Progress -> Waiting -> Resolved -> Closed).
-- 5. Technician assignment, technical diagnosis, work performed, parts tracking & costing.
-- 6. Warranty verification tracking (pending_verification, under_warranty, expired, etc.).
-- 7. Immutable audit history table (public.service_request_activities).
-- 8. Row Level Security (RLS) policies & defense-in-depth public submission trigger.
-- 9. Private storage bucket for attachments (service-attachments) with strict policies.
-- 10. Server-side SECURITY DEFINER RPC functions for ticket updates, notes, and closure.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TICKET NUMBER SEQUENCE & GENERATOR
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.service_request_ticket_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_service_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today TEXT;
  v_seq BIGINT;
BEGIN
  v_today := to_char(timezone('utc'::text, now()), 'YYYYMMDD');
  v_seq := nextval('public.service_request_ticket_seq');
  RETURN 'ARS-SR-' || v_today || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_service_ticket_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_service_ticket_number() TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. DEDICATED SERVICE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT public.generate_service_ticket_number(),

  -- Customer Information
  customer_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT,
  customer_type TEXT NOT NULL DEFAULT 'Individual'
    CHECK (customer_type IN ('Individual', 'Business/Office', 'School/Institution', 'Government/Enterprise')),

  -- Product & Hardware Reference
  product_category TEXT NOT NULL
    CHECK (product_category IN (
      'Desktop Computer',
      'Laptop',
      'CCTV Camera',
      'DVR/NVR',
      'CCTV Complete System',
      'Printer/Scanner',
      'Biometric Device',
      'Router/Networking',
      'UPS/Power Backup',
      'Other IT Hardware'
    )),
  brand TEXT,
  model_number TEXT,
  serial_number TEXT,
  purchase_date DATE,
  invoice_number TEXT,

  -- Request Specifications
  request_type TEXT NOT NULL DEFAULT 'Repair/Fault Diagnosis'
    CHECK (request_type IN (
      'Repair/Fault Diagnosis',
      'Warranty Support',
      'Installation/Configuration',
      'AMC/Preventive Maintenance',
      'Technical Support',
      'Upgrade/Replacement'
    )),
  problem_description TEXT NOT NULL,
  service_location TEXT NOT NULL DEFAULT 'On-site'
    CHECK (service_location IN ('On-site', 'Workshop', 'Remote Support')),
  site_address TEXT,
  preferred_visit_date DATE,
  attachment_url TEXT,

  -- Structured Conditional Fields (CCTV & Computer specific issue parameters)
  device_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Workflow & Operational Lifecycle
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting_customer_parts', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Technician Assignment & Diagnosis
  assigned_technician_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  assigned_technician_name TEXT,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,

  diagnosis TEXT,
  work_performed TEXT,
  parts_used JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Financials & Warranty
  estimated_cost NUMERIC(10,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  final_cost NUMERIC(10,2) CHECK (final_cost IS NULL OR final_cost >= 0),
  warranty_status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (warranty_status IN ('pending_verification', 'under_warranty', 'warranty_expired', 'not_applicable')),
  warranty_notes TEXT,

  -- Confidential Internal Administrative Notes (Strictly hidden from customers)
  internal_notes TEXT,

  -- Resolution & Reopening Metadata
  resolution_summary TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reopen_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Basic Format Constraints
  CONSTRAINT service_requests_name_len CHECK (char_length(trim(customer_name)) BETWEEN 2 AND 100),
  CONSTRAINT service_requests_mobile_len CHECK (char_length(trim(mobile_number)) BETWEEN 8 AND 20),
  CONSTRAINT service_requests_problem_len CHECK (char_length(trim(problem_description)) BETWEEN 10 AND 5000),
  CONSTRAINT service_requests_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indices for rapid lookup and administrative filtering
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_ticket_number ON public.service_requests(ticket_number);
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_tech ON public.service_requests(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON public.service_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_mobile ON public.service_requests(mobile_number);

-- Automated updated_at trigger
CREATE OR REPLACE FUNCTION public.set_service_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON public.service_requests;
CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_requests_updated_at();

-- ----------------------------------------------------------------------------
-- 3. AUDIT TRAIL / ACTIVITY TIMELINE TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_request_activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  actor_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  actor_role TEXT NOT NULL DEFAULT 'system',
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'ticket_created',
    'status_changed',
    'technician_assigned',
    'priority_changed',
    'diagnosis_updated',
    'work_performed_updated',
    'parts_updated',
    'costs_updated',
    'warranty_status_updated',
    'note_added',
    'ticket_resolved',
    'ticket_closed',
    'ticket_reopened'
  )),
  old_status TEXT,
  new_status TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_service_activities_ticket ON public.service_request_activities(service_request_id, created_at ASC);

-- Immutability on Activity Trail: Never allow UPDATE or DELETE on activities
CREATE OR REPLACE FUNCTION public.protect_service_activities_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit integrity violation: Service request activities are strictly immutable and cannot be updated or deleted.'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_service_activities_immutability ON public.service_request_activities;
CREATE TRIGGER trg_protect_service_activities_immutability
  BEFORE UPDATE OR DELETE ON public.service_request_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_service_activities_immutability();

-- ----------------------------------------------------------------------------
-- 4. SERVER-SIDE ABUSE CONTROLS & INSERT DEFAULTS TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_service_request_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If not an authenticated admin, enforce public submission boundaries
  IF NOT public.is_admin() THEN
    -- Status must be 'new'
    IF NEW.status IS NULL OR NEW.status != 'new' THEN
      NEW.status := 'new';
    END IF;

    -- Priority must default to 'medium' on public creation
    IF NEW.priority IS NULL OR NEW.priority != 'medium' THEN
      NEW.priority := 'medium';
    END IF;

    -- Warranty status defaults to 'pending_verification'
    NEW.warranty_status := 'pending_verification';

    -- Privileged fields must be NULL upon customer submission
    IF NEW.internal_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Internal notes cannot be set during customer request creation.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.assigned_technician_id IS NOT NULL OR NEW.assigned_technician_name IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Technician assignment is restricted to authorized personnel.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.diagnosis IS NOT NULL OR NEW.work_performed IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Technical diagnosis fields cannot be submitted by customers.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.estimated_cost IS NOT NULL OR NEW.final_cost IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Cost fields are restricted to staff.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.resolved_at IS NOT NULL OR NEW.closed_at IS NOT NULL OR NEW.reopened_at IS NOT NULL THEN
      RAISE EXCEPTION 'Security violation: Ticket terminal states cannot be set on submission.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Sanitize text inputs
    NEW.customer_name := pg_catalog.btrim(COALESCE(NEW.customer_name, ''));
    NEW.mobile_number := pg_catalog.btrim(COALESCE(NEW.mobile_number, ''));
    NEW.problem_description := pg_catalog.btrim(COALESCE(NEW.problem_description, ''));

    IF NEW.email IS NOT NULL THEN
      NEW.email := pg_catalog.btrim(pg_catalog.lower(NEW.email));
      IF NEW.email = '' THEN
        NEW.email := NULL;
      END IF;
    END IF;

    -- Reject script injection in text
    IF NEW.problem_description ~* '<\s*script' OR NEW.problem_description ~* 'javascript:' THEN
      RAISE EXCEPTION 'Security violation: Malicious payload detected in problem description.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_request_insert_defaults ON public.service_requests;
CREATE TRIGGER trg_enforce_service_request_insert_defaults
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_request_insert_defaults();

-- ----------------------------------------------------------------------------
-- 5. AUTOMATED INITIAL AUDIT LOG FOR NEW SERVICE REQUESTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_service_request_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note,
    metadata
  ) VALUES (
    NEW.id,
    NEW.ticket_number,
    auth.uid(),
    COALESCE(NEW.customer_name, 'Customer'),
    CASE WHEN public.is_staff() THEN public.get_staff_role() ELSE 'customer' END,
    'ticket_created',
    NULL,
    NEW.status,
    'Service request registered by customer: ' || NEW.product_category || ' (' || NEW.request_type || ')',
    jsonb_build_object(
      'product_category', NEW.product_category,
      'request_type', NEW.request_type,
      'service_location', NEW.service_location,
      'customer_type', NEW.customer_type
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_request_creation ON public.service_requests;
CREATE TRIGGER trg_log_service_request_creation
  AFTER INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_service_request_creation();

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_activities ENABLE ROW LEVEL SECURITY;

-- Customers can submit service requests anonymously or authenticated
DROP POLICY IF EXISTS "Public can submit service requests" ON public.service_requests;
CREATE POLICY "Public can submit service requests"
  ON public.service_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Active staff (superadmin, admin, inventory_staff) can read all service requests
DROP POLICY IF EXISTS "Active staff can view service requests" ON public.service_requests;
CREATE POLICY "Active staff can view service requests"
  ON public.service_requests
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Active staff can update service requests
DROP POLICY IF EXISTS "Active staff can update service requests" ON public.service_requests;
CREATE POLICY "Active staff can update service requests"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Permanent deletion is strictly REVOKED from all clients (Superadmin or DB admin only via RPC/SQL)
REVOKE DELETE ON public.service_requests FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.service_request_activities FROM PUBLIC, anon, authenticated;

-- Service activities readability
DROP POLICY IF EXISTS "Active staff can view service request activities" ON public.service_request_activities;
CREATE POLICY "Active staff can view service request activities"
  ON public.service_request_activities
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ----------------------------------------------------------------------------
-- 7. SECURE RPC FUNCTIONS FOR OPERATIONAL ACTIONS
-- ----------------------------------------------------------------------------

-- A. Assign Technician & Set Priority
CREATE OR REPLACE FUNCTION public.assign_service_ticket(
  p_ticket_id UUID,
  p_technician_id UUID,
  p_priority TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket RECORD;
  v_tech RECORD;
  v_old_status TEXT;
  v_new_status TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator authorization required to assign service tickets.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_ticket
  FROM public.service_requests
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT full_name, role INTO v_tech
  FROM public.admin_users
  WHERE id = p_technician_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Technician not found or inactive.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT full_name, role INTO v_actor_name, v_actor_role
  FROM public.admin_users
  WHERE id = auth.uid();

  v_old_status := v_ticket.status;
  v_new_status := CASE WHEN v_ticket.status = 'new' THEN 'assigned' ELSE v_ticket.status END;

  UPDATE public.service_requests
  SET
    assigned_technician_id = p_technician_id,
    assigned_technician_name = v_tech.full_name,
    assigned_at = timezone('utc'::text, now()),
    assigned_by = auth.uid(),
    priority = COALESCE(p_priority, v_ticket.priority),
    status = v_new_status,
    internal_notes = CASE
      WHEN p_notes IS NOT NULL AND trim(p_notes) != ''
      THEN COALESCE(internal_notes || E'\n---\n', '') || '[' || timezone('utc'::text, now())::date || ' - ' || COALESCE(v_actor_name, 'Staff') || ']: ' || trim(p_notes)
      ELSE internal_notes
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_ticket_id;

  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note,
    metadata
  ) VALUES (
    p_ticket_id,
    v_ticket.ticket_number,
    auth.uid(),
    COALESCE(v_actor_name, 'Admin'),
    COALESCE(v_actor_role, 'admin'),
    'technician_assigned',
    v_old_status,
    v_new_status,
    'Assigned technician: ' || v_tech.full_name || CASE WHEN p_notes IS NOT NULL THEN ' | Note: ' || trim(p_notes) ELSE '' END,
    jsonb_build_object('technician_id', p_technician_id, 'technician_name', v_tech.full_name, 'priority', COALESCE(p_priority, v_ticket.priority))
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_number', v_ticket.ticket_number,
    'assigned_technician_name', v_tech.full_name,
    'status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_service_ticket(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_service_ticket(UUID, UUID, TEXT, TEXT) TO authenticated;

-- B. Update Ticket Status (with transition rules)
CREATE OR REPLACE FUNCTION public.update_service_ticket_status(
  p_ticket_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_diagnosis TEXT DEFAULT NULL,
  p_work_performed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket RECORD;
  v_old_status TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Access denied: Staff authorization required to update ticket status.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_ticket
  FROM public.service_requests
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.' USING ERRCODE = 'no_data_found';
  END IF;

  v_old_status := v_ticket.status;

  -- Disallow closing or reopening via generic status update (must use dedicated RPCs)
  IF p_new_status = 'closed' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only superadministrators can close service tickets.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_old_status = 'closed' AND p_new_status != 'closed' THEN
    RAISE EXCEPTION 'Closed tickets cannot have status updated directly. Please request a ticket reopen.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT full_name, role INTO v_actor_name, v_actor_role
  FROM public.admin_users
  WHERE id = auth.uid();

  UPDATE public.service_requests
  SET
    status = p_new_status,
    diagnosis = COALESCE(p_diagnosis, diagnosis),
    work_performed = COALESCE(p_work_performed, work_performed),
    resolved_at = CASE WHEN p_new_status = 'resolved' AND resolved_at IS NULL THEN timezone('utc'::text, now()) ELSE resolved_at END,
    resolved_by = CASE WHEN p_new_status = 'resolved' AND resolved_by IS NULL THEN auth.uid() ELSE resolved_by END,
    internal_notes = CASE
      WHEN p_notes IS NOT NULL AND trim(p_notes) != ''
      THEN COALESCE(internal_notes || E'\n---\n', '') || '[' || timezone('utc'::text, now())::date || ' - ' || COALESCE(v_actor_name, 'Staff') || ']: ' || trim(p_notes)
      ELSE internal_notes
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_ticket_id;

  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note,
    metadata
  ) VALUES (
    p_ticket_id,
    v_ticket.ticket_number,
    auth.uid(),
    COALESCE(v_actor_name, 'Staff'),
    COALESCE(v_actor_role, 'staff'),
    'status_changed',
    v_old_status,
    p_new_status,
    p_notes,
    jsonb_build_object('diagnosis_updated', (p_diagnosis IS NOT NULL), 'work_updated', (p_work_performed IS NOT NULL))
  );

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_service_ticket_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_service_ticket_status(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- C. Add Private Internal Note
CREATE OR REPLACE FUNCTION public.add_service_ticket_note(
  p_ticket_id UUID,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket RECORD;
  v_actor_name TEXT;
  v_actor_role TEXT;
  v_clean_note TEXT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Access denied: Staff authorization required to add notes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_note := pg_catalog.btrim(COALESCE(p_note, ''));
  IF pg_catalog.length(v_clean_note) < 2 OR pg_catalog.length(v_clean_note) > 3000 THEN
    RAISE EXCEPTION 'Note length must be between 2 and 3000 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_ticket
  FROM public.service_requests
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT full_name, role INTO v_actor_name, v_actor_role
  FROM public.admin_users
  WHERE id = auth.uid();

  UPDATE public.service_requests
  SET
    internal_notes = COALESCE(internal_notes || E'\n---\n', '') || '[' || timezone('utc'::text, now())::date || ' - ' || COALESCE(v_actor_name, 'Staff') || ']: ' || v_clean_note,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_ticket_id;

  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note
  ) VALUES (
    p_ticket_id,
    v_ticket.ticket_number,
    auth.uid(),
    COALESCE(v_actor_name, 'Staff'),
    COALESCE(v_actor_role, 'staff'),
    'note_added',
    v_ticket.status,
    v_ticket.status,
    v_clean_note
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.add_service_ticket_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_service_ticket_note(UUID, TEXT) TO authenticated;

-- D. Close Service Ticket (Superadmin Only)
CREATE OR REPLACE FUNCTION public.close_service_ticket(
  p_ticket_id UUID,
  p_resolution_summary TEXT,
  p_final_cost NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket RECORD;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can close service tickets.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_ticket
  FROM public.service_requests
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT full_name, role INTO v_actor_name, v_actor_role
  FROM public.admin_users
  WHERE id = auth.uid();

  UPDATE public.service_requests
  SET
    status = 'closed',
    resolution_summary = COALESCE(p_resolution_summary, resolution_summary),
    final_cost = COALESCE(p_final_cost, final_cost),
    closed_at = timezone('utc'::text, now()),
    closed_by = auth.uid(),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_ticket_id;

  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note,
    metadata
  ) VALUES (
    p_ticket_id,
    v_ticket.ticket_number,
    auth.uid(),
    COALESCE(v_actor_name, 'Superadmin'),
    COALESCE(v_actor_role, 'superadmin'),
    'ticket_closed',
    v_ticket.status,
    'closed',
    p_resolution_summary,
    jsonb_build_object('final_cost', p_final_cost)
  );

  RETURN jsonb_build_object('success', true, 'status', 'closed');
END;
$$;

REVOKE ALL ON FUNCTION public.close_service_ticket(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_service_ticket(UUID, TEXT, NUMERIC) TO authenticated;

-- E. Reopen Closed Service Ticket (Superadmin Only)
CREATE OR REPLACE FUNCTION public.reopen_service_ticket(
  p_ticket_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket RECORD;
  v_clean_reason TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Only Superadministrator can reopen service tickets.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_clean_reason := pg_catalog.btrim(COALESCE(p_reason, ''));
  IF pg_catalog.length(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'Mandatory reopen reason must be at least 5 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_ticket
  FROM public.service_requests
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket not found.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_ticket.status != 'closed' THEN
    RAISE EXCEPTION 'Only closed tickets can be reopened.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT full_name, role INTO v_actor_name, v_actor_role
  FROM public.admin_users
  WHERE id = auth.uid();

  UPDATE public.service_requests
  SET
    status = 'in_progress',
    reopened_at = timezone('utc'::text, now()),
    reopened_by = auth.uid(),
    reopen_reason = v_clean_reason,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_ticket_id;

  INSERT INTO public.service_request_activities (
    service_request_id,
    ticket_number,
    actor_id,
    actor_name,
    actor_role,
    activity_type,
    old_status,
    new_status,
    note
  ) VALUES (
    p_ticket_id,
    v_ticket.ticket_number,
    auth.uid(),
    COALESCE(v_actor_name, 'Superadmin'),
    COALESCE(v_actor_role, 'superadmin'),
    'ticket_reopened',
    'closed',
    'in_progress',
    'Ticket reopened by Superadmin: ' || v_clean_reason
  );

  RETURN jsonb_build_object('success', true, 'status', 'in_progress');
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_service_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_service_ticket(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET: service-attachments
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'service-attachments',
      'service-attachments',
      false, -- Private bucket for customer confidentiality
      5242880, -- 5 MB max limit
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Upload policy: Anon & Authenticated can upload
    DROP POLICY IF EXISTS "Public can upload service attachments" ON storage.objects;
    CREATE POLICY "Public can upload service attachments"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        bucket_id = 'service-attachments' AND
        (storage.foldername(name))[1] = 'requests'
      );

    -- View policy: Only authenticated staff can view service attachments
    DROP POLICY IF EXISTS "Staff can view service attachments" ON storage.objects;
    CREATE POLICY "Staff can view service attachments"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'service-attachments' AND
        public.is_staff()
      );
  END IF;
END $$;
