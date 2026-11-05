-- ============================================================================
-- ARS Computers — Product description & specification schema
-- Migration: 20261105000001_product_description_schema.sql
-- ============================================================================
-- Purpose:
--   Adds structured, admin-editable content columns to public.products so the
--   catalogue can hold a product-specific overview, verified key features,
--   compatibility notes, box contents and a manufacturer-versus-configuration
--   reliability indicator, alongside the existing spec_attributes JSONB.
--
-- Safety:
--   * Non-destructive (ADD COLUMN IF NOT EXISTS).
--   * No existing columns are dropped, renamed or type-changed.
--   * cost_price remains excluded from all public column grants.
--   * No RLS policy, staff account, Auth or customer data is touched.
--   * Admin/employee anti-tamper trigger is extended to the new fields.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS key_features TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compatibility TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS box_contents TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specs_verified TEXT NOT NULL DEFAULT 'configuration_dependent';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS spec_source TEXT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_specs_verified_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_specs_verified_check
  CHECK (specs_verified IN ('verified', 'partially_verified', 'configuration_dependent'));

COMMENT ON COLUMN public.products.description IS
  'Product-specific overview shown on the product details page. Must not be a generic placeholder.';
COMMENT ON COLUMN public.products.key_features IS
  'Product-specific highlighted features shown above the specification table.';
COMMENT ON COLUMN public.products.compatibility IS
  'Compatibility and usage guidance for the product.';
COMMENT ON COLUMN public.products.box_contents IS
  'Box contents where verified; otherwise states what is confirmed at order.';
COMMENT ON COLUMN public.products.specs_verified IS
  'verified | partially_verified | configuration_dependent — distinguishes manufacturer-verified specs from values confirmed at sale.';
COMMENT ON COLUMN public.products.spec_source IS
  'Source note for the shown specifications, e.g. manufacturer documentation or ARS Computers confirmation.';

-- ----------------------------------------------------------------------------
-- 1. PUBLIC COLUMN GRANTS
-- ----------------------------------------------------------------------------
-- Existing table-level privileges remain revoked. Grant SELECT on the new
-- non-sensitive content columns. cost_price is never granted.
REVOKE ALL ON public.products FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, category_id, name, slug, sku, brand, model, spec_summary, spec_attributes,
  price, stock_quantity, min_stock_alert, is_featured, is_active, images,
  is_generic, warranty_text, hsn_code, availability_status, created_at, updated_at,
  description, key_features, compatibility, box_contents, specs_verified, spec_source
) ON public.products TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. ADMIN PRODUCTS RPC — RECREATE WITH NEW RETURN COLUMNS
-- ----------------------------------------------------------------------------
-- Changing a RETURNS TABLE signature requires DROP + CREATE.
DROP FUNCTION IF EXISTS public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER);

CREATE FUNCTION public.get_admin_products(
  p_category_id UUID DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT true,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  category_id UUID,
  name TEXT,
  slug TEXT,
  sku TEXT,
  brand TEXT,
  model TEXT,
  spec_summary TEXT,
  spec_attributes JSONB,
  price NUMERIC,
  cost_price NUMERIC,
  stock_quantity INTEGER,
  min_stock_alert INTEGER,
  is_featured BOOLEAN,
  is_active BOOLEAN,
  images TEXT[],
  is_generic BOOLEAN,
  warranty_text TEXT,
  hsn_code TEXT,
  availability_status TEXT,
  description TEXT,
  key_features TEXT[],
  compatibility TEXT,
  box_contents TEXT,
  specs_verified TEXT,
  spec_source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
BEGIN
  -- Strict administrative authorization check: superadmin and admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required to access product commercial data.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Bounded pagination (clamps between 1 and 200, prevents unbounded memory exhaustion)
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    p.id,
    p.category_id,
    p.name,
    p.slug,
    p.sku,
    p.brand,
    p.model,
    p.spec_summary,
    p.spec_attributes,
    p.price,
    p.cost_price,
    p.stock_quantity,
    p.min_stock_alert,
    p.is_featured,
    p.is_active,
    p.images,
    p.is_generic,
    p.warranty_text,
    p.hsn_code,
    p.availability_status,
    p.description,
    p.key_features,
    p.compatibility,
    p.box_contents,
    p.specs_verified,
    p.spec_source,
    p.created_at,
    p.updated_at
  FROM public.products p
  WHERE (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_include_inactive IS TRUE OR p.is_active IS TRUE)
  ORDER BY p.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. ANTI-TAMPER TRIGGER — PROTECT NEW CATALOG CONTENT INVENTORY STAFF
-- ----------------------------------------------------------------------------
-- Mirror the previous trigger exactly, adding the new content columns to the
-- protected list. Non-superadmins still may only touch stock fields.
CREATE OR REPLACE FUNCTION public.check_product_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL AND (session_user IN ('postgres', 'supabase_admin') OR current_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  v_role := public.get_staff_role();

  IF v_role = 'superadmin' THEN
    RETURN NEW;
  ELSIF v_role = 'inventory_staff' THEN
    -- Inventory staff may only change stock_quantity, min_stock_alert and availability_status.
    IF (NEW.id IS DISTINCT FROM OLD.id) OR
       (NEW.name IS DISTINCT FROM OLD.name) OR
       (NEW.slug IS DISTINCT FROM OLD.slug) OR
       (NEW.sku IS DISTINCT FROM OLD.sku) OR
       (NEW.category_id IS DISTINCT FROM OLD.category_id) OR
       (NEW.price IS DISTINCT FROM OLD.price) OR
       (NEW.cost_price IS DISTINCT FROM OLD.cost_price) OR
       (NEW.brand IS DISTINCT FROM OLD.brand) OR
       (NEW.model IS DISTINCT FROM OLD.model) OR
       (NEW.spec_summary IS DISTINCT FROM OLD.spec_summary) OR
       (NEW.spec_attributes IS DISTINCT FROM OLD.spec_attributes) OR
       (NEW.is_featured IS DISTINCT FROM OLD.is_featured) OR
       (NEW.images IS DISTINCT FROM OLD.images) OR
       (NEW.is_generic IS DISTINCT FROM OLD.is_generic) OR
       (NEW.warranty_text IS DISTINCT FROM OLD.warranty_text) OR
       (NEW.hsn_code IS DISTINCT FROM OLD.hsn_code) OR
       (NEW.is_active IS DISTINCT FROM OLD.is_active) OR
       (NEW.description IS DISTINCT FROM OLD.description) OR
       (NEW.key_features IS DISTINCT FROM OLD.key_features) OR
       (NEW.compatibility IS DISTINCT FROM OLD.compatibility) OR
       (NEW.box_contents IS DISTINCT FROM OLD.box_contents) OR
       (NEW.specs_verified IS DISTINCT FROM OLD.specs_verified) OR
       (NEW.spec_source IS DISTINCT FROM OLD.spec_source) OR
       (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
      RAISE EXCEPTION 'Access denied: Inventory staff may only update stock levels and availability status.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Access denied: Unauthorized product modification. Product catalog edits require superadministrator privileges.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;
