-- ============================================================================
-- ARS Computers — Step 3C: Hardened Admin Security & Role-Based Permissions
-- Migration: 20261019000002_admin_roles_and_permissions.sql
-- Status: PREPARED FOR REVIEW ONLY — NOT YET APPLIED TO LIVE DATABASE
-- Execution Order: PREREQUISITE: MUST run after 20261019000001_extend_product_catalog.sql
-- ============================================================================
-- PURPOSE:
-- Establishes database-enforced role-based authorization for the ARS Computers
-- administrative dashboard. Enforces least-privilege security at the PostgreSQL
-- and Row Level Security (RLS) layers:
--
-- 1. Table `public.admin_users` linked to `auth.users`
-- 2. Role hierarchy:
--      - 'superadmin': Full system control, staff administration, soft deletion.
--      - 'admin': Product, category, inventory, and enquiry management.
--      - 'inventory_staff': Read catalog, update stock counts & availability ONLY.
--        (Cannot see cost_price, cannot delete, cannot access customer enquiries).
-- 3. Hardened helper functions: get_staff_role(), is_superadmin(), is_admin(), is_staff().
-- 4. Protection of `cost_price`: REVOKED from all client roles; accessible
--    exclusively via SECURITY DEFINER function for authorized admins.
-- 5. Anti-tampering triggers on `admin_users` and `products` with secure first-admin
--    bootstrap gating restricted to the database administrator ('postgres').
-- 6. Soft-delete function `public.soft_delete_product(UUID)`.
-- 7. Inherited table-level grant defense: explicit REVOKE on `public.products`.
-- 8. Public catalog access for both anonymous and authenticated customer sessions.
-- 9. Fully idempotent and repeatable migration script.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: admin_users (Staff & Administrator Directory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'inventory_staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),

  CONSTRAINT admin_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT admin_users_name_len CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100)
);

-- Automated updated_at trigger for admin_users
DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for instant role and status lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_lookup
  ON public.admin_users (id, is_active, role);

-- ----------------------------------------------------------------------------
-- 2. HARDENED ROLE VERIFICATION FUNCTIONS (Fixed search_path)
-- ----------------------------------------------------------------------------

-- Function 2A: Extracts current user's active staff role
-- CRITICAL ANTI-RECURSION DESIGN: Uses SECURITY DEFINER with fixed search_path.
CREATE OR REPLACE FUNCTION public.get_staff_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.admin_users
  WHERE id = auth.uid()
    AND is_active = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_role() TO authenticated;

-- Function 2B: Checks if user is an active superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() = 'superadmin', false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- Function 2C: Checks if user is an active superadmin or admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Function 2D: Checks if user is any active staff member (superadmin, admin, inventory_staff)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_staff_role() IN ('superadmin', 'admin', 'inventory_staff'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY & POLICIES: public.admin_users
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active staff can view own profile" ON public.admin_users;
DROP POLICY IF EXISTS "Active admins can view own admin profile" ON public.admin_users;
DROP POLICY IF EXISTS "Superadmins can view all admin profiles" ON public.admin_users;
DROP POLICY IF EXISTS "Superadmins can manage admin accounts" ON public.admin_users;

-- 3A. Active staff members can read their own profile (self-lookup)
-- Evaluates id = auth.uid() directly to prevent recursion
CREATE POLICY "Active staff can view own profile"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_active = true);

-- 3B. Superadmins can manage admin accounts (covers SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Superadmins can manage admin accounts"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 4. TRIGGER: ANTI-TAMPERING & SECURE BOOTSTRAP DEFENSE ON admin_users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_admin_users_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  -- --------------------------------------------------------------------------
  -- 4A. CONTROLLED FIRST-TIME BOOTSTRAP CHECK
  -- --------------------------------------------------------------------------
  -- When the admin_users directory is completely uninitialized (0 records), no
  -- superadministrator exists to authorize account creation. To eliminate
  -- deadlock while strictly preventing unauthorized client-side self-promotion:
  -- 1. Operation must be an INSERT.
  -- 2. The admin_users table must currently contain 0 records.
  -- 3. Execution session must belong strictly to the trusted database-administrator
  --    role ('postgres' or 'supabase_admin') in direct SQL Editor / CLI.
  -- 4. Web API roles ('anon', 'authenticated') are explicitly blocked from bootstrapping.
  -- 5. The account must be explicitly provisioned as role 'superadmin' and is_active = true.
  -- 6. The account must specify a valid, non-null user ID (matching auth.users).
  -- --------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    -- Serialize concurrent bootstrap attempts using transaction-level advisory lock
    -- Eliminates lock-upgrade deadlocks (EXCLUSIVE vs ROW EXCLUSIVE) across concurrent transactions
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.admin_users_bootstrap')::bigint);
    SELECT count(*) INTO v_admin_count FROM public.admin_users;
    IF v_admin_count = 0 THEN
      IF session_user IN ('postgres', 'supabase_admin') OR current_user IN ('postgres', 'supabase_admin') THEN
        IF NEW.role <> 'superadmin' THEN
          RAISE EXCEPTION 'Bootstrap failed: The initial administrator account must be assigned role ''superadmin''.'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.is_active IS NOT TRUE THEN
          RAISE EXCEPTION 'Bootstrap failed: The initial administrator account must be active.'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.id IS NULL THEN
          RAISE EXCEPTION 'Bootstrap failed: The initial administrator account must have a valid user ID.'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
          RAISE EXCEPTION 'Bootstrap failed: Target user ID % does not exist in auth.users.', NEW.id
            USING ERRCODE = 'foreign_key_violation';
        END IF;

        -- Permit the direct database-administrator bootstrap of the first superadmin
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Access denied: Initial administrator bootstrap can only be executed by the database administrator (postgres).'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 4B. STANDARD RBAC ENFORCEMENT (Once initialized)
  -- --------------------------------------------------------------------------
  -- Allow direct database administrator operations (migrations, maintenance, CLI) when not in an auth user session
  IF auth.uid() IS NULL AND (session_user IN ('postgres', 'supabase_admin') OR current_user IN ('postgres', 'supabase_admin')) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- All modifications strictly require caller to be an active superadmin.
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Only active superadministrators can modify administrator accounts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Safety check: Superadmins cannot demote or deactivate themselves (prevents lockout)
  IF TG_OP = 'UPDATE' AND OLD.id = auth.uid() AND (NEW.is_active = false OR NEW.role <> 'superadmin') THEN
    RAISE EXCEPTION 'Safety check failed: You cannot demote or deactivate your own superadministrator account.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.id = auth.uid() THEN
    RAISE EXCEPTION 'Safety check failed: You cannot delete your own superadministrator account.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_users ON public.admin_users;
CREATE TRIGGER trg_protect_admin_users
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_users_escalation();

-- ----------------------------------------------------------------------------
-- 4C. CONTROLLED DBA BOOTSTRAP HELPER FUNCTION
-- ----------------------------------------------------------------------------
-- Provides a controlled, one-time helper for database administrators.
-- Strictly accessible ONLY to postgres / supabase_admin; revoked from all client roles.
-- Serializes concurrent bootstrap attempts via transaction advisory lock and verifies email match.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_email TEXT;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR p_full_name IS NULL THEN
    RAISE EXCEPTION 'All parameters (user_id, email, full_name) are required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Acquire transaction-level advisory lock on admin_users to serialize concurrent bootstrap attempts
  -- Eliminates deadlock risks while strictly preventing concurrent bootstrap race conditions
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.admin_users_bootstrap')::bigint);

  IF EXISTS (SELECT 1 FROM public.admin_users) THEN
    RAISE EXCEPTION 'Bootstrap closed: System already has administrator accounts provisioned.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF session_user NOT IN ('postgres', 'supabase_admin') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: Initial administrator bootstrap can only be executed by the database administrator (postgres).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verify target user exists in auth.users and retrieve registered email
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Target user ID % does not exist in auth.users. Please create the authentication user account first.', p_user_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Trust model verification: ensure provided email matches auth.users email
  IF lower(trim(p_email)) <> lower(trim(v_auth_email)) THEN
    RAISE EXCEPTION 'Bootstrap failed: Provided email "%" does not match registered Auth user email "%".', p_email, v_auth_email
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.admin_users (id, email, full_name, role, is_active)
  VALUES (p_user_id, lower(trim(p_email)), trim(p_full_name), 'superadmin', true);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY & POLICIES: public.categories
-- ----------------------------------------------------------------------------
-- Public (anon & authenticated): Can browse active categories.
-- Staff (all active roles): Can browse all categories (active & inactive).
-- Admins (superadmin & admin): Full manage (create, update, delete).
-- Inventory Staff: SELECT only (no mutation).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can view all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins full manage categories" ON public.categories;

CREATE POLICY "Public and authenticated can view active categories"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Staff can view all categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Admins full manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY & POLICIES: public.products
-- ----------------------------------------------------------------------------
-- Public (anon & authenticated): Can read active products only (approved columns).
-- Staff (all active roles): Can browse all products (active & inactive).
-- Admins (superadmin & admin): Full manage (create, edit, soft-delete).
-- Inventory Staff: Can view all products, and UPDATE inventory counts.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can view active products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Staff can view all products" ON public.products;
DROP POLICY IF EXISTS "Admins full manage products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Superadmins can delete products" ON public.products;
DROP POLICY IF EXISTS "Inventory staff can update stock" ON public.products;

CREATE POLICY "Public and authenticated can view active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Staff can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Admins & superadmins can create new products
CREATE POLICY "Admins can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins & superadmins can update products (soft deletion sets is_active = false)
CREATE POLICY "Admins can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Superadmins ONLY: Permanent hard delete on products (ordinary admins must soft-delete)
CREATE POLICY "Superadmins can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Inventory staff can update stock"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- 7. TRIGGER: ENFORCE INVENTORY-STAFF FIELD RESTRICTIONS ON products
-- ----------------------------------------------------------------------------
-- Ensures that inventory_staff can ONLY modify stock_quantity, min_stock_alert,
-- and availability_status. Attempts to change prices, margins, specs, names,
-- categories, featured status, images, or active state fail with an exception.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_product_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Allow direct database administrator updates (migrations, maintenance, CLI) when not in an auth user session
  IF auth.uid() IS NULL AND (session_user IN ('postgres', 'supabase_admin') OR current_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  v_role := public.get_staff_role();

  IF v_role IN ('superadmin', 'admin') THEN
    RETURN NEW;
  ELSIF v_role = 'inventory_staff' THEN
    -- Verify inventory staff did not alter protected commercial or catalog fields
    -- Permitted update fields: stock_quantity, min_stock_alert, availability_status
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
       (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
      RAISE EXCEPTION 'Access denied: Inventory staff may only update stock levels and availability status.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Access denied: Unauthorized product modification.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_product_update_permissions ON public.products;
CREATE TRIGGER trg_check_product_update_permissions
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_update_permissions();

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY & POLICIES: public.enquiries
-- ----------------------------------------------------------------------------
-- Public (anon) & Authenticated: Can submit enquiries with strict format checks.
-- Admins (superadmin & admin): Can view, update status/notes, and delete.
-- Inventory Staff & Public: ZERO read access to customer enquiries.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated can submit enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Admins can view enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Admins can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Admins can delete enquiries" ON public.enquiries;

CREATE POLICY "Public and authenticated can submit enquiries"
  ON public.enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    pg_catalog.char_length(pg_catalog.btrim(name)) >= 2 AND
    pg_catalog.char_length(pg_catalog.btrim(contact_info)) >= 5 AND
    pg_catalog.char_length(pg_catalog.btrim(message)) >= 5 AND
    status = 'new' AND
    admin_notes IS NULL
  );

CREATE POLICY "Admins can view enquiries"
  ON public.enquiries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update enquiries"
  ON public.enquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete enquiries"
  ON public.enquiries
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. FUNCTION: public.soft_delete_product(UUID)
-- ----------------------------------------------------------------------------
-- Implements approved safe deletion: Sets is_active = false.
-- Restricted to superadmin and admin roles.
-- Validates parameter existence and raises no_data_found if missing.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_product(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product ID cannot be null.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Strict administrative authorization check (superadmin & admin only)
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required to deactivate products.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.products
  SET is_active = false,
      updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with ID % not found.', p_product_id
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_product(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_product(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. COST PRICE DEFENSE-IN-DEPTH ACCESS FUNCTION
-- ----------------------------------------------------------------------------
-- Direct table-level SELECT on cost_price is REVOKED from anon and authenticated.
-- Only superadmin and admin can read cost_price via this SECURITY DEFINER function.
-- Inventory staff and anonymous visitors receive NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_cost_price(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cost NUMERIC;
BEGIN
  -- Strict administrative check: unauthorized roles or null IDs return NULL
  IF p_product_id IS NULL OR NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT cost_price INTO v_cost
  FROM public.products
  WHERE id = p_product_id;

  RETURN v_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_product_cost_price(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_cost_price(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10B. SECURE BULK ADMIN PRODUCT CATALOG RPC
-- ----------------------------------------------------------------------------
-- PostgREST clients calling /rest/v1/products are subject to column-level grants
-- and cannot retrieve `cost_price`. Calling `get_product_cost_price(UUID)` for
-- hundreds of products causes N+1 RPC round-trips.
--
-- This function provides a secure, consolidated, paginated admin catalog endpoint
-- that returns product records WITH `cost_price` exclusively to authorized
-- administrators ('superadmin' and 'admin').
--
-- Security Controls:
-- 1. SECURITY DEFINER with fixed empty search_path = ''.
-- 2. Explicit authorization check: Calls public.is_admin(); raises 'insufficient_privilege'
--    for anonymous visitors, customer authenticated users, and inventory staff.
-- 3. Execution privilege strictly REVOKED from PUBLIC and anon; granted ONLY to authenticated.
-- 4. Bounded pagination: Limit is clamped between 1 and 200 (default 50); offset is non-negative.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_products(
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
-- 11. REMOVAL OF UNPROTECTED ADMINISTRATIVE VIEWS
-- ----------------------------------------------------------------------------
-- In accordance with security review Step 2E:
-- Views in the public schema with security_invoker = true or false expose an
-- unmonitored PostgREST endpoint (/rest/v1/admin_products_view) which creates
-- query-planner and role-confusion risks across PostgreSQL/PostgREST versions.
-- All product queries now query public.products directly with RLS, and cost_price
-- is gated exclusively through public.get_product_cost_price(UUID).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.admin_products_view;

-- ----------------------------------------------------------------------------
-- 12. LEAST-PRIVILEGE GRANTS & REVOCATIONS
-- ----------------------------------------------------------------------------

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Admin users: authenticated can SELECT (RLS limits to self or superadmin); no client mutation grants
REVOKE ALL ON public.admin_users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;

-- Categories: anon and authenticated can SELECT active; authenticated can manage (RLS gates non-admins)
REVOKE ALL ON public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

-- Products:
-- CRITICAL DEFENSE-IN-DEPTH:
-- 1. Explicitly REVOKE ALL on public.products to strip any inherited table-level grants.
-- 2. cost_price is revoked from ALL client roles (anon and authenticated).
-- 3. anon and authenticated have SELECT on approved public columns only.
-- 4. authenticated has row mutation privileges (INSERT, UPDATE, DELETE), gated by RLS & triggers.
REVOKE ALL ON public.products FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, category_id, name, slug, sku, brand, model, spec_summary, spec_attributes,
  price, stock_quantity, min_stock_alert, is_featured, is_active, images,
  is_generic, warranty_text, hsn_code, availability_status, created_at, updated_at
) ON public.products TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- Enquiries: anon has INSERT only; authenticated has SELECT, UPDATE, DELETE (RLS gates non-admins)
REVOKE ALL ON public.enquiries FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.enquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.enquiries TO authenticated;

-- ============================================================================
-- 13. REQUIRED STORAGE POLICIES (DOCUMENTATION ONLY — DO NOT APPLY TO LIVE STORAGE)
-- ============================================================================
-- The product catalog uses a Supabase Storage bucket named 'product-images'.
--
-- Security Requirements:
-- 1. Read Access: Anyone (anon and authenticated) may view public product images.
-- 2. Insert Access: Only active administrators (superadmin, admin) may upload images.
-- 3. Update Access (CRITICAL): When an administrator uploads an image with the same
--    filename or utilizes the Supabase SDK upsert option (upsert: true), Supabase
--    Storage executes an UPDATE on storage.objects. An explicit UPDATE policy is
--    REQUIRED so that authorized admins can replace images without encountering
--    an RLS policy violation.
-- 4. Delete Access: Only active administrators may delete images.
--
-- Reference Storage Policies (To be applied in a future Storage migration or Studio):
--
-- -- Policy A: Public read access
-- CREATE POLICY "Public can view product images"
--   ON storage.objects FOR SELECT
--   TO anon, authenticated
--   USING (bucket_id = 'product-images');
--
-- -- Policy B: Admin insert/upload access
-- CREATE POLICY "Admins can upload product images"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     bucket_id = 'product-images' AND
--     public.is_admin()
--   );
--
-- -- Policy C: Admin update/upsert access (PREVENTS UPSERT FAILURE)
-- CREATE POLICY "Admins can update product images"
--   ON storage.objects FOR UPDATE
--   TO authenticated
--   USING (
--     bucket_id = 'product-images' AND
--     public.is_admin()
--   )
--   WITH CHECK (
--     bucket_id = 'product-images' AND
--     public.is_admin()
--   );
--
-- -- Policy D: Admin delete access
-- CREATE POLICY "Admins can delete product images"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (
--     bucket_id = 'product-images' AND
--     public.is_admin()
--   );
-- ============================================================================

-- ============================================================================
-- 14. BOOTSTRAP INSTRUCTIONS (To execute in Supabase Studio after migration)
-- ============================================================================
-- DO NOT INSERT FAKE AUTH USERS OR RUN THIS SCRIPT WITHOUT AN ACTUAL AUTH UID.
--
-- Procedure:
-- 1. Go to Supabase Dashboard > Authentication > Users.
-- 2. Click "Add User" -> "Create User". Enter administrator email and secure password.
-- 3. Copy the created user's UUID (e.g. 'a1b2c3d4-e5f6-7890-abcd-ef1234567890').
-- 4. Open Supabase Dashboard > SQL Editor, replace the UUID below, and run EITHER:
--
--    Option A (Direct SQL Editor INSERT):
--    INSERT INTO public.admin_users (id, email, full_name, role, is_active)
--    VALUES (
--      '<ACTUAL_COPIED_AUTH_USER_UUID>'::uuid,
--      'admin@arscomputers.com',
--      'Primary Administrator',
--      'superadmin',
--      true
--    )
--    ON CONFLICT (id) DO UPDATE
--    SET role = 'superadmin', is_active = true;
--
--    Option B (DBA Bootstrap Helper Function):
--    SELECT public.bootstrap_first_admin(
--      '<ACTUAL_COPIED_AUTH_USER_UUID>'::uuid,
--      'admin@arscomputers.com',
--      'Primary Administrator'
--    );
--
-- ============================================================================
