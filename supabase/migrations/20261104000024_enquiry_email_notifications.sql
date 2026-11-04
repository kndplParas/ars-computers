-- ============================================================================
-- ARS Computers — Enquiry Email Notification Outbox
-- Migration: 20261104000024_enquiry_email_notifications.sql
-- ============================================================================
-- PURPOSE:
-- 1. Queue email notifications for every new public enquiry.
-- 2. Queue email notifications when the Head/Superadmin assigns or reassigns
--    an employee to an enquiry.
-- 3. Never queue duplicate notifications for an unchanged assignment.
-- 4. Keep notification delivery fully server-side and idempotent via a unique
--    event key. The Cloudflare Worker processes this outbox on a schedule.
-- 5. Never block enquiry submission or assignment if the notification queue
--    cannot be written. Failures are downgraded to a PostgreSQL warning.
--
-- SECURITY:
-- - The outbox is readable/writable only by the service_role used by the
--   Cloudflare Worker. anon and authenticated are explicitly denied.
-- - Payloads contain only the minimum data needed to render the notification.
-- - This migration is additive; it does not alter existing enquiry records,
--   workflows, permissions, RLS policies, or audit history.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABLE: notification_outbox
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('new_enquiry', 'enquiry_assigned', 'enquiry_reassigned')
  ),
  enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'skipped')
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.notification_outbox IS
  'Server-side email notification queue for new enquiries and employee assignments. Processed by the Cloudflare Worker cron.';

COMMENT ON COLUMN public.notification_outbox.event_key IS
  'Idempotency key. Unique per new enquiry / distinct assignment event.';

-- Efficient worker polling path. The UNIQUE constraint on event_key already
-- provides the idempotency index.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox (status, created_at ASC);

-- ----------------------------------------------------------------------------
-- 2. HARDENED ACCESS: service_role only
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_outbox TO service_role;

-- ----------------------------------------------------------------------------
-- 3. TRIGGER FUNCTION: queue_enquiry_email_notification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_enquiry_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_type TEXT;
  v_event_key TEXT;
  v_payload JSONB;
BEGIN
  -- Notification failures must never block the underlying business operation.
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'new_enquiry';
      v_event_key := 'new_enquiry:' || NEW.id::TEXT;
      v_payload := pg_catalog.jsonb_build_object(
        'enquiry_id', NEW.id,
        'enquiry_number', NEW.enquiry_number,
        'customer_name', NEW.name,
        'contact_info', NEW.contact_info,
        'category_interest', NEW.category_interest,
        'message', NEW.message,
        'created_at', NEW.created_at
      );

      INSERT INTO public.notification_outbox (event_key, event_type, enquiry_id, payload)
      VALUES (v_event_key, v_event_type, NEW.id, v_payload)
      ON CONFLICT (event_key) DO NOTHING;

      RETURN NEW;
    END IF;

    -- Only assignment changes are relevant for update notifications.
    IF NEW.assigned_employee_id IS NOT DISTINCT FROM OLD.assigned_employee_id
       OR NEW.assigned_employee_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_event_type := CASE
      WHEN OLD.assigned_employee_id IS NULL THEN 'enquiry_assigned'
      ELSE 'enquiry_reassigned'
    END;

    v_event_key := pg_catalog.format(
      'enquiry_assignment:%s:%s:%s:%s',
      NEW.id,
      COALESCE(OLD.assigned_employee_id::TEXT, 'none'),
      NEW.assigned_employee_id,
      COALESCE(NEW.assigned_at::TEXT, NEW.updated_at::TEXT)
    );

    v_payload := pg_catalog.jsonb_build_object(
      'enquiry_id', NEW.id,
      'enquiry_number', NEW.enquiry_number,
      'customer_name', NEW.name,
      'contact_info', NEW.contact_info,
      'previous_employee_id', OLD.assigned_employee_id,
      'previous_employee_name', OLD.assigned_employee_name,
      'previous_employee_code', OLD.assigned_employee_code,
      'new_employee_id', NEW.assigned_employee_id,
      'new_employee_name', NEW.assigned_employee_name,
      'new_employee_code', NEW.assigned_employee_code,
      'assigned_at', COALESCE(NEW.assigned_at, NEW.updated_at),
      'assigned_by_name', NEW.assigned_by_name
    );

    INSERT INTO public.notification_outbox (event_key, event_type, enquiry_id, payload)
    VALUES (v_event_key, v_event_type, NEW.id, v_payload)
    ON CONFLICT (event_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email notification queue skipped for enquiry %: %',
      COALESCE(NEW.id::TEXT, 'unknown'), SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_enquiry_email_notification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_enquiry_email_notification() TO service_role;

-- ----------------------------------------------------------------------------
-- 4. BIND TRIGGER TO public.enquiries
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_queue_enquiry_email_notification ON public.enquiries;
CREATE TRIGGER trg_queue_enquiry_email_notification
  AFTER INSERT OR UPDATE OF assigned_employee_id ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_enquiry_email_notification();

COMMIT;
