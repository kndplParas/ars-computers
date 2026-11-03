-- ============================================================================
-- ARS Computers — Orders Table Customer Contact Schema Migration
-- Migration: 20261103000022_orders_customer_contact_columns.sql
-- Description: Add customer_email, customer_phone, and customer_address columns
--              to public.orders to support order editing, customer communications,
--              and dispatch.
-- ============================================================================

-- 1. Schema Additions on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT NULL;

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- 3. Column Documentation
COMMENT ON COLUMN public.orders.customer_email IS 'Customer contact email address for dispatch notifications and order correspondence.';
COMMENT ON COLUMN public.orders.customer_phone IS 'Customer secondary contact telephone/mobile number.';
COMMENT ON COLUMN public.orders.customer_address IS 'Site/delivery street address for equipment installations and deliveries.';
