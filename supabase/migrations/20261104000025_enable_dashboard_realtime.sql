-- ============================================================================
-- ARS Computers — Enable Supabase Realtime for Dashboard Tables
-- Migration: 20261104000025_enable_dashboard_realtime.sql
-- ============================================================================
-- PURPOSE:
-- Add the dashboard's existing subscribed tables to the supabase_realtime
-- publication so the AdminDataProvider receives change events.
--
-- This is additive and idempotent. It does not alter table data, RLS policies,
-- triggers, permissions, or audit history. Realtime still enforces RLS, so
-- staff only receive events for rows they are allowed to read.
-- ============================================================================

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'products',
    'categories',
    'enquiries',
    'admin_users',
    'service_requests',
    'orders',
    'order_items',
    'order_payments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE pg_catalog.format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        target_table
      );
    END IF;
  END LOOP;
END
$$;
