-- Migration: 20261120000021_expand_service_request_categories.sql
-- Description: Expands allowed product categories on public.service_requests to support
--              all computer hardware and components (CPU, Motherboard, RAM, GPU, Storage, SMPS, etc.)

DO $$
BEGIN
  -- Drop the legacy restrictive CHECK constraint that only permitted 10 initial device types
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'service_requests_product_category_check'
  ) THEN
    ALTER TABLE public.service_requests 
      DROP CONSTRAINT service_requests_product_category_check;
  END IF;

  -- Add forward-compatible constraint requiring a valid category string (at least 2 characters)
  ALTER TABLE public.service_requests 
    ADD CONSTRAINT service_requests_product_category_check 
    CHECK (char_length(trim(product_category)) >= 2);
END $$;
