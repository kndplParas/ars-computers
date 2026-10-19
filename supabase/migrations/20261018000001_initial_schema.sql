-- ============================================================================
-- ARS Computers — Initial PostgreSQL Schema Migration
-- Tables: categories, products, enquiries
-- Security: Strict Row Level Security (RLS) & Explicit Least-Privilege Grants
-- Status: PREPARED FOR REVIEW ONLY — NOT YET APPLIED TO LIVE DATABASE
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. AUTOMATED UPDATED_AT TRIGGER FUNCTION
-- Hardened with SECURITY INVOKER and empty search_path to prevent search_path hijacking.
-- Since this function only assigns NEW.updated_at, it does not require elevated (SECURITY DEFINER) privileges.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now());
  RETURN NEW;
END;
$$;

-- Restrict direct execution of internal trigger function.
-- In PostgreSQL, triggers execute without requiring runtime roles (such as anon or authenticated)
-- to hold direct EXECUTE privileges on the trigger function.
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. TABLE: categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT,
  tagline TEXT,
  description TEXT,
  icon TEXT,
  badge TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT categories_slug_format CHECK (slug ~* '^[a-z0-9-]+$'),
  CONSTRAINT categories_title_not_empty CHECK (char_length(trim(title)) > 0)
);

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. TABLE: products
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sku TEXT UNIQUE,
  brand TEXT,
  model TEXT,
  spec_summary TEXT,
  spec_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  price NUMERIC(12, 2) CHECK (price >= 0),
  cost_price NUMERIC(12, 2) CHECK (cost_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock_alert INTEGER NOT NULL DEFAULT 2 CHECK (min_stock_alert >= 0),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT products_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT products_slug_format CHECK (slug ~* '^[a-z0-9-]+$')
);

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. TABLE: enquiries (Customer Contact & Quote Submissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info TEXT NOT NULL,
  category_interest TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT enquiries_name_len CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  CONSTRAINT enquiries_contact_len CHECK (char_length(trim(contact_info)) BETWEEN 5 AND 200),
  CONSTRAINT enquiries_message_len CHECK (char_length(trim(message)) BETWEEN 5 AND 2000),
  CONSTRAINT enquiries_status_enum CHECK (status IN ('new', 'in_progress', 'quoted', 'converted', 'closed'))
);

DROP TRIGGER IF EXISTS set_enquiries_updated_at ON public.enquiries;
CREATE TRIGGER set_enquiries_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. INDEXES (Optimized Query Paths)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_categories_display ON public.categories (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products (is_active, is_featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_specs ON public.products USING gin (spec_attributes);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.enquiries (status, created_at DESC);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES — HARDENED ACCESS CONTROL
-- ============================================================================
-- Enable RLS across all tables. Default behavior in PostgreSQL is DENY all
-- operations unless an explicit policy permits it.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Categories RLS:
-- Public & Authenticated: Read active categories only.
-- Write operations (INSERT, UPDATE, DELETE): Strictly denied to general users.
-- Verified staff authorization will be implemented in a dedicated phase.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can view active categories" ON public.categories;
CREATE POLICY "Public and authenticated can view active categories"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- Products RLS:
-- Public & Authenticated: Read active products only.
-- Write operations (INSERT, UPDATE, DELETE): Strictly denied to general users.
-- Verified staff authorization will be implemented in a dedicated phase.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can view active products" ON public.products;
CREATE POLICY "Public and authenticated can view active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- Enquiries RLS:
-- Public (anon) & Authenticated: Can INSERT inquiries with input constraints.
-- Read/Update/Delete: NO policy granted to anon or general authenticated users.
-- This ensures regular visitors or registered customers CANNOT read, scrape,
-- or enumerate any customer enquiry records, names, or phone numbers.
-- Integrity constraint: Enforces status = 'new' and admin_notes IS NULL on creation.
-- Verified staff access will be added once staff roles/profiles are provisioned.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can submit enquiries" ON public.enquiries;
CREATE POLICY "Public and authenticated can submit enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(name)) >= 2 AND
    char_length(trim(contact_info)) >= 5 AND
    char_length(trim(message)) >= 5 AND
    status = 'new' AND
    admin_notes IS NULL
  );

-- ============================================================================
-- 8. EXPLICIT LEAST-PRIVILEGE GRANTS & REVOCATIONS
-- ============================================================================
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Baseline safety: Revoke ALL existing permissions from PUBLIC, anon, and authenticated
REVOKE ALL ON public.categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.enquiries FROM PUBLIC, anon, authenticated;

-- Grant strictly only what is necessary:
-- 1. Categories browsing: SELECT granted for active categories (filtered by RLS)
GRANT SELECT ON public.categories TO anon, authenticated;

-- 2. Products browsing: SELECT granted STRICTLY on approved public catalog columns.
-- CRITICAL SECURITY CONTROL: Table-level SELECT is withheld; 'cost_price' is intentionally
-- EXCLUDED from column grants to prevent commercial wholesale/margin data exposure.
-- Future staff/admin roles will access cost_price through dedicated authorized views/roles.
GRANT SELECT (
  id,
  category_id,
  name,
  slug,
  sku,
  brand,
  model,
  spec_summary,
  spec_attributes,
  price,
  stock_quantity,
  min_stock_alert,
  is_featured,
  is_active,
  images,
  created_at,
  updated_at
) ON public.products TO anon, authenticated;

-- 3. Contact form: INSERT only on enquiries (Zero SELECT, UPDATE, DELETE)
GRANT INSERT ON public.enquiries TO anon, authenticated;
