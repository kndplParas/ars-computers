-- Migration: 20261102000021_order_audit_reconciliation.sql
-- Description: Expand activity_type constraint, enforce non-null/object metadata with valid UUID payment_id,
--              add concurrency-safe unique index, and create Superadmin attestation RPC.
-- Safeguards: 100% portable, zero hardcoded test IDs, zero financial mutation, explicit search_path,
--              FOUND check for entity validation, scoped unique constraint handling.

-- 1. Preserve all 20 existing activity types and add 'ORDER_AUDIT_RECONCILIATION'
DO $$
BEGIN
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
      'ORDER_DELETION_REVIEWED'::text,
      'ORDER_AUDIT_RECONCILIATION'::text
    ]));
END $$;

-- 2. Strengthen metadata constraint: rejects NULL metadata, non-object metadata, missing payment_id, empty payment_id, or invalid UUID
DO $$
BEGIN
  ALTER TABLE public.order_activities DROP CONSTRAINT IF EXISTS chk_order_activities_reconciliation_payment_id;
  ALTER TABLE public.order_activities ADD CONSTRAINT chk_order_activities_reconciliation_payment_id
    CHECK (
      activity_type <> 'ORDER_AUDIT_RECONCILIATION'
      OR (
        metadata IS NOT NULL
        AND jsonb_typeof(metadata) = 'object'
        AND metadata ? 'payment_id'
        AND metadata->>'payment_id' IS NOT NULL
        AND trim(metadata->>'payment_id') <> ''
        AND metadata->>'payment_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    );
END $$;

-- 3. Concurrency-safe unique index to guarantee exactly one reconciliation per order and payment
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_activities_audit_reconciliation
ON public.order_activities (order_id, (metadata->>'payment_id'))
WHERE (activity_type = 'ORDER_AUDIT_RECONCILIATION');

-- 4. Superadmin-Only Audit Reconciliation Attestation RPC
CREATE OR REPLACE FUNCTION public.record_order_audit_reconciliation(
  p_order_id UUID,
  p_payment_id UUID,
  p_reconciliation_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_actor_code TEXT;

  v_dummy_order_id UUID;
  v_payment_order_id UUID;
  v_payment_amount NUMERIC(12,2);
  v_payment_method TEXT;
  v_payment_ref TEXT;
  v_payment_received_by UUID;
  v_payment_received_at TIMESTAMPTZ;

  v_sanitized_user_meta JSONB;
  v_activity_id UUID;
  v_diag_constraint TEXT;
BEGIN
  -- A. Authenticate caller & verify active Superadmin role from server context
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role, full_name, email, employee_code
  INTO v_actor_role, v_actor_name, v_actor_email, v_actor_code
  FROM public.admin_users
  WHERE id = v_actor_id AND is_active = true;

  IF v_actor_role IS NULL OR v_actor_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: Only active Superadmin can record audit reconciliations.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- B. Input Validation
  IF p_order_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Order ID and Payment ID are required.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_reconciliation_reason IS NULL OR length(trim(p_reconciliation_reason)) < 10 THEN
    RAISE EXCEPTION 'A substantive reconciliation reason (minimum 10 characters) is mandatory.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reject arrays, strings, numbers, or boolean metadata
  IF p_metadata IS NOT NULL AND jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'p_metadata must be a JSON object if provided.' USING ERRCODE = 'check_violation';
  END IF;

  -- C. Lock & Verify Target Order (Uses reliable FOUND check immediately after query)
  SELECT id INTO v_dummy_order_id
  FROM public.orders
  WHERE id = p_order_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target order does not exist.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- D. Lock & Verify Target Payment Record (Uses reliable FOUND check immediately after query)
  SELECT order_id, amount_received, payment_method, transaction_reference, received_by, received_at
  INTO v_payment_order_id, v_payment_amount, v_payment_method, v_payment_ref, v_payment_received_by, v_payment_received_at
  FROM public.order_payments
  WHERE id = p_payment_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target payment record does not exist.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_payment_order_id <> p_order_id THEN
    RAISE EXCEPTION 'Integrity violation: Target payment does not belong to the specified order.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- E. Sanitize metadata: strip trusted audit keys so caller cannot forge audit facts
  v_sanitized_user_meta := COALESCE(p_metadata, '{}'::jsonb)
    - 'payment_id'
    - 'reconciled_amount'
    - 'payment_method'
    - 'transaction_reference'
    - 'synthetic_fixture'
    - 'physical_cash_movement'
    - 'original_execution_context'
    - 'attesting_actor'
    - 'attestation_timestamp';

  -- F. Scoped Audit Activity Insertion: handles unique violation specifically on uq_order_activities_audit_reconciliation
  BEGIN
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
      'ORDER_AUDIT_RECONCILIATION',
      'Audit reconciliation attestation by Superadmin ' || COALESCE(v_actor_name, v_actor_email) || ': ' || trim(p_reconciliation_reason),
      jsonb_build_object(
        'payment_id', p_payment_id::text,
        'reconciled_amount', v_payment_amount,
        'payment_method', v_payment_method,
        'transaction_reference', v_payment_ref,
        'payment_received_by', v_payment_received_by,
        'payment_received_at', v_payment_received_at,
        'original_execution_context', 'application_superadmin_attestation',
        'attesting_actor', v_actor_email,
        'attesting_actor_role', v_actor_role,
        'attesting_actor_code', v_actor_code,
        'attestation_timestamp', clock_timestamp(),
        'custom_notes', v_sanitized_user_meta
      ),
      clock_timestamp()
    )
    RETURNING id INTO v_activity_id;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME;
      IF v_diag_constraint = 'uq_order_activities_audit_reconciliation' THEN
        RAISE EXCEPTION 'Audit reconciliation has already been recorded for this payment.'
          USING ERRCODE = 'unique_violation';
      ELSE
        RAISE; -- Re-raise unrelated unique violations with their original context
      END IF;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'order_id', p_order_id,
    'payment_id', p_payment_id,
    'reconciled_amount', v_payment_amount
  );
END;
$$;

-- 5. Explicit Function Permissions (Revokes from PUBLIC, anon, and service_role; grants to authenticated)
REVOKE EXECUTE ON FUNCTION public.record_order_audit_reconciliation(uuid, uuid, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_order_audit_reconciliation(uuid, uuid, text, jsonb) TO authenticated;

