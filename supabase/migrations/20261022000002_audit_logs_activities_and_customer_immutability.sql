-- ============================================================================
-- ARS Computers — Step 6 (Phase 1): Audit Logs, Enquiry Activities & Immutability
-- Migration: 20261022000002_audit_logs_activities_and_customer_immutability.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Create an append-only, tamper-proof `public.audit_logs` table.
--    - Records actor_id (from auth.uid()), actor_email, actor_role, action,
--      entity_type, entity_id, old_values, new_values, and timestamp.
--    - Visible strictly to authorized head person (superadmin).
--    - Completely immutable: zero UPDATE or DELETE allowed.
-- 2. Create an append-only `public.enquiry_activities` table.
--    - Captures the complete chronological lifecycle, notes, and events.
--    - Readable by all active administrators (superadmin and admin).
--    - Completely immutable: zero UPDATE or DELETE allowed.
-- 3. Protect Customer Inbound Inquiries from Tampering:
--    - Ensures customer-submitted fields (name, contact_info, category_interest,
--      message, created_at) can NEVER be edited after initial submission.
-- 4. Preserve existing data, anonymous enquiry submissions, and role boundaries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: public.audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'ROLE_CHANGE', 'STATUS_CHANGE')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('enquiries', 'products', 'categories', 'admin_users', 'storage')),
  entity_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions from public, anon, and authenticated
REVOKE ALL ON public.audit_logs FROM public, anon, authenticated;

-- Grant SELECT strictly to authenticated users (evaluated via RLS policy)
GRANT SELECT ON public.audit_logs TO authenticated;

-- Head person (superadmin) ONLY can view audit logs
DROP POLICY IF EXISTS "Superadmins can view audit logs" ON public.audit_logs;
CREATE POLICY "Superadmins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.enquiry_activities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'system_event',
      'note',
      'status_change',
      'rejection_requested',
      'rejection_reviewed',
      'archived',
      'restored'
    )
  ),
  content TEXT NOT NULL CHECK (char_length(trim(both from content)) >= 1 AND char_length(content) <= 3000),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_enquiry_activities_enquiry
  ON public.enquiry_activities (enquiry_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE public.enquiry_activities ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions from public, anon, and authenticated
REVOKE ALL ON public.enquiry_activities FROM public, anon, authenticated;

-- Grant SELECT strictly to authenticated staff
GRANT SELECT ON public.enquiry_activities TO authenticated;

-- Grant INSERT to authenticated (superadmins can insert notes; triggers handle system events)
GRANT INSERT ON public.enquiry_activities TO authenticated;

-- Read policy: Both superadmins and admin employees can view timeline history
DROP POLICY IF EXISTS "Admins can view enquiry activities" ON public.enquiry_activities;
CREATE POLICY "Admins can view enquiry activities"
  ON public.enquiry_activities
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Insert policy: Superadmins can add notes directly (Phase 1); trigger handles system events
DROP POLICY IF EXISTS "Superadmins can insert enquiry activities" ON public.enquiry_activities;
CREATE POLICY "Superadmins can insert enquiry activities"
  ON public.enquiry_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin() AND
    actor_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 3. DEFENSE-IN-DEPTH: Trigger to enforce strict immutability of audit records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: Audit logs and activity histories are strictly append-only and cannot be updated or deleted.'
    USING ERRCODE = 'feature_not_supported';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_tampering ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_tampering
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS trg_prevent_enquiry_activities_tampering ON public.enquiry_activities;
CREATE TRIGGER trg_prevent_enquiry_activities_tampering
  BEFORE UPDATE OR DELETE ON public.enquiry_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- ----------------------------------------------------------------------------
-- 4. CUSTOMER IMMUTABILITY TRIGGER: public.enquiries
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Prevent altering customer submission data once created
  IF (NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer name is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.contact_info IS DISTINCT FROM OLD.contact_info) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer contact details are immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.category_interest IS DISTINCT FROM OLD.category_interest) THEN
    RAISE EXCEPTION 'Customer submission protection: Customer requested category is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.message IS DISTINCT FROM OLD.message) THEN
    RAISE EXCEPTION 'Customer submission protection: Original customer message is immutable and cannot be altered.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Customer submission protection: Submission timestamp is immutable.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_enquiry_customer_immutability ON public.enquiries;
CREATE TRIGGER trg_protect_enquiry_customer_immutability
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_enquiry_customer_immutability();

-- ----------------------------------------------------------------------------
-- 5. AUTOMATED AUDIT LOGGING FUNCTION & TRIGGERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email TEXT;
  v_actor_role TEXT;
  v_entity_id TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
  v_action TEXT;
BEGIN
  v_actor_id := auth.uid();
  v_action := TG_OP;

  -- Determine reliable actor identity and role
  IF v_actor_id IS NOT NULL THEN
    SELECT email, role INTO v_actor_email, v_actor_role
    FROM public.admin_users
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
      v_actor_role := 'authenticated';
    END IF;
  ELSE
    IF session_user IN ('postgres', 'supabase_admin') THEN
      v_actor_role := 'database_system';
      v_actor_email := session_user;
    ELSE
      v_actor_role := 'anonymous';
      v_actor_email := 'anonymous@arscomputers.in';
    END IF;
  END IF;

  -- Build entity ID and JSON snapshots
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (OLD.id)::text;
    v_old_json := pg_catalog.to_jsonb(OLD);
    v_new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_entity_id := (NEW.id)::text;
    v_old_json := NULL;
    v_new_json := pg_catalog.to_jsonb(NEW);
  ELSE -- UPDATE
    v_entity_id := (NEW.id)::text;
    v_old_json := pg_catalog.to_jsonb(OLD);
    v_new_json := pg_catalog.to_jsonb(NEW);
  END IF;

  -- Mask any potential sensitive internal hash fields if ever present
  IF v_old_json ? 'password_hash' THEN
    v_old_json := v_old_json - 'password_hash';
  END IF;
  IF v_new_json ? 'password_hash' THEN
    v_new_json := v_new_json - 'password_hash';
  END IF;

  -- Insert into append-only audit_logs
  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_email,
    v_actor_role,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old_json,
    v_new_json,
    pg_catalog.timezone('utc'::text, pg_catalog.now())
  );

  -- For enquiries, also record corresponding activity event
  IF TG_TABLE_NAME = 'enquiries' THEN
    IF TG_OP = 'INSERT' THEN
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
        NEW.id,
        v_actor_id,
        v_actor_email,
        v_actor_role,
        'system_event',
        'Customer enquiry received via public portal.',
        pg_catalog.jsonb_build_object('source', 'public_submission', 'initial_status', NEW.status),
        pg_catalog.timezone('utc'::text, pg_catalog.now())
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF (NEW.status IS DISTINCT FROM OLD.status) THEN
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
          NEW.id,
          v_actor_id,
          v_actor_email,
          v_actor_role,
          'status_change',
          'Enquiry status updated from ' || OLD.status || ' to ' || NEW.status || '.',
          pg_catalog.jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
          pg_catalog.timezone('utc'::text, pg_catalog.now())
        );
      END IF;

      IF (NEW.admin_notes IS DISTINCT FROM OLD.admin_notes) AND NEW.admin_notes IS NOT NULL THEN
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
          NEW.id,
          v_actor_id,
          v_actor_email,
          v_actor_role,
          'note',
          'Internal note updated: ' || NEW.admin_notes,
          pg_catalog.jsonb_build_object('has_notes', true),
          pg_catalog.timezone('utc'::text, pg_catalog.now())
        );
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit logging triggers
DROP TRIGGER IF EXISTS trg_audit_enquiries ON public.enquiries;
CREATE TRIGGER trg_audit_enquiries
  AFTER INSERT OR UPDATE OR DELETE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS trg_audit_admin_users ON public.admin_users;
CREATE TRIGGER trg_audit_admin_users
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.record_audit_event();
