-- ============================================================================
-- ARS Computers — Per-Recipient Delivery Tracking for Email Notifications
-- Migration: 20261104000026_notification_outbox_delivered_recipients.sql
-- ============================================================================
-- PURPOSE:
-- 1. Track which normalized recipient addresses have already received a given
--    notification event.
-- 2. Prevent duplicate emails to the same person when the Cloudflare Worker
--    retries a partially delivered outbox row.
-- 3. Support the multi-recipient rules:
--    - new enquiry: all active staff with valid email addresses,
--    - assignment/reassignment: newly assigned employee + active Superadmins.
--
-- SAFETY:
-- - This migration only adds a nullable-free column with an empty default.
-- - It does not change existing rows, statuses, event keys, triggers, RLS
--   policies, permissions, approval workflows, or audit history.
-- - The existing table-level grants to service_role and the explicit denial of
--   anon/authenticated continue to apply to the new column.
-- - The Worker is the only writer; the outbox remains service-role only.
-- ============================================================================

BEGIN;

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS delivered_to TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.notification_outbox.delivered_to IS
  'Normalized recipient addresses already delivered for this event. Used to avoid duplicate sends across retries.';

COMMIT;
