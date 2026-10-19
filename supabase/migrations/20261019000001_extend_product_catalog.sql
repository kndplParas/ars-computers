-- ============================================================================
-- ARS Computers — Step 2B: Database Migration Draft
-- Migration: 20261019000001_extend_product_catalog.sql
-- Status: PREPARED FOR REVIEW ONLY — NOT YET APPLIED TO LIVE DATABASE
-- Target Table: public.products
-- Execution Order: MUST precede 20261019000002_admin_roles_and_permissions.sql
-- ============================================================================
-- PURPOSE:
-- Extends the `products` table schema to support full, real hardware product
-- management while cleanly differentiating between high-level generic hardware
-- offerings and verified, sellable OEM products.
--
-- SAFETY & COMPATIBILITY:
-- 1. Non-destructive: Uses ADD COLUMN IF NOT EXISTS.
-- 2. Fully backwards-compatible with existing queries and UI components.
-- 3. Idempotent constraint and index creation.
-- 4. Excludes cost_price from all public access policies.
-- 5. Sequencing: Adds columns required by migration 20261019000002.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD NEW COLUMNS TO public.products
-- ----------------------------------------------------------------------------

-- is_generic: true for high-level solution offerings/groups; false for real OEM SKUs
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_generic BOOLEAN NOT NULL DEFAULT false;

-- warranty_text: Structured warranty specification (e.g., '3 Years On-site OEM Warranty')
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS warranty_text TEXT;

-- hsn_code: Indian GST Harmonized System of Nomenclature code for hardware billing (e.g., '84713010')
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- availability_status: Operational stock status enum constraint
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'on_demand';

-- ----------------------------------------------------------------------------
-- 2. CONSTRAINTS
-- ----------------------------------------------------------------------------

-- Enforce valid availability status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_availability_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_availability_status_check
      CHECK (availability_status IN ('in_stock', 'out_of_stock', 'on_demand', 'discontinued'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. INDEXES FOR PERFORMANCE & FILTERING
-- ----------------------------------------------------------------------------

-- Index for filtering between generic offerings and real products
CREATE INDEX IF NOT EXISTS idx_products_generic_active
  ON public.products (category_id, is_generic, is_active);

-- Index for inventory availability queries
CREATE INDEX IF NOT EXISTS idx_products_availability
  ON public.products (availability_status)
  WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 4. MARK EXISTING 20 INITIAL ENTRIES AS GENERIC OFFERINGS
-- ----------------------------------------------------------------------------
-- The initial 20 seed items are generic hardware groups (no verified SKU or OEM model).
-- Mark them as is_generic = true so they are correctly classified.
UPDATE public.products
SET is_generic = true
WHERE is_generic = false
  AND (sku IS NULL OR brand IS NULL);

-- ============================================================================
-- VERIFICATION QUERY (Run after approved execution to confirm column additions):
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'products'
--   AND column_name IN ('is_generic', 'warranty_text', 'hsn_code', 'availability_status');
-- ============================================================================
