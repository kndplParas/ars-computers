-- ============================================================================
-- ARS Computers — Step 24: Revoke Direct Table SELECT on Order Financial Tables
-- Migration: 20261120000024_revoke_direct_order_table_select.sql
-- Status: PREPARED LOCAL MIGRATION (LATER-STAGE SECURITY LOCKDOWN)
-- ============================================================================
-- IMPORTANT NOTICE:
-- Apply this migration ONLY after the client application code has been deployed
-- with the get_admin_orders, get_admin_order_payments, and
-- get_monthly_business_analytics RPC implementations.
--
-- Objective:
-- Permanently revoke table-level SELECT on public.orders, public.order_items,
-- and public.order_payments from public, anon, and authenticated roles.
-- Direct PostgREST table queries (e.g. /rest/v1/order_items?select=*) are blocked
-- with 42501 permission denied, enforcing that all order data flows exclusively
-- through audited SECURITY DEFINER RPCs with role-tailored projections.
-- ============================================================================

-- 1. Revoke table-level SELECT from client roles
REVOKE SELECT ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.order_payments FROM PUBLIC, anon, authenticated;

-- 2. DML operations on orders and order_payments remain revoked (as set in 20261029000001)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_payments FROM PUBLIC, anon, authenticated;

-- 3. Confirm EXECUTE on secure RPCs is granted to authenticated
GRANT EXECUTE ON FUNCTION public.get_admin_orders(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_order_payments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_business_analytics(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_order_engineer(uuid, uuid, timestamptz, text) TO authenticated;
