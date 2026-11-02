-- Rollback Migration for: 20261102000021_order_audit_reconciliation.sql
-- Description: Safely reverts RPC, unique index, and constraints.
-- Safeguard: Aborts without deleting if any ORDER_AUDIT_RECONCILIATION rows exist.

BEGIN;

DO $$
DECLARE
  v_rec_count INT;
BEGIN
  -- 1. Safety check: Abort if any reconciliation rows exist to prevent silent data loss
  SELECT count(*) INTO v_rec_count
  FROM public.order_activities
  WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';

  IF v_rec_count > 0 THEN
    RAISE EXCEPTION 'Cannot roll back Migration 21: % ORDER_AUDIT_RECONCILIATION activity row(s) exist in order_activities. Preserving records.', v_rec_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Drop the Superadmin RPC
  DROP FUNCTION IF EXISTS public.record_order_audit_reconciliation(uuid, uuid, text, jsonb);

  -- 3. Drop unique index and metadata check constraint
  DROP INDEX IF EXISTS public.uq_order_activities_audit_reconciliation;
  ALTER TABLE public.order_activities DROP CONSTRAINT IF EXISTS chk_order_activities_reconciliation_payment_id;

  -- 4. Restore exact 20 original activity types from Migration 19
  ALTER TABLE public.order_activities DROP CONSTRAINT IF EXISTS order_activities_activity_type_check;
  ALTER TABLE public.order_activities ADD CONSTRAINT order_activities_activity_type_check
    CHECK (activity_type = ANY (ARRAY[
      'ORDER_CREATED'::text,
      'ORDER_PROCESSING_STARTED'::text,
      'ORDER_COMPLETION_SUBMITTED'::text,
      'ORDER_COMPLETION_APPROVED'::text,
      'ORDER_CANCELLED'::text,
      'ORDER_PAYMENT_RECORDED'::text,
      'ORDER_ATTACHMENT_ADDED'::text,
      'ATTACHMENT_SHARE_REQUESTED'::text,
      'ATTACHMENT_SHARE_REJECTED'::text,
      'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE'::text,
      'ATTACHMENT_MARKED_INTERNAL'::text,
      'ATTACHMENT_SHARE_CREATED'::text,
      'ATTACHMENT_SHARE_REVOKED'::text,
      'ORDER_EDITED'::text,
      'ORDER_ENGINEER_ASSIGNED'::text,
      'ORDER_ENGINEER_REASSIGNED'::text,
      'ORDER_REMOVED'::text,
      'ORDER_RESTORED'::text,
      'ORDER_DELETION_REQUESTED'::text,
      'ORDER_DELETION_REVIEWED'::text
    ]));
END $$;

COMMIT;

