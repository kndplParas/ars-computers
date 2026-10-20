-- ============================================================================
-- ARS Computers — Step 5: Enforce Admin Employee Read-Only & Concurrency-Safe Superadmin Guard
-- Migration: 20261022000001_enforce_admin_employee_read_only_and_superadmin_guard.sql
-- Status: LOCAL DEVELOPMENT ONLY — Strictly targeting local Supabase instance
-- ============================================================================
-- PURPOSE:
-- 1. Protect the Last Active Superadministrator at the PostgreSQL level:
--    - Closes the gap where another administrator could deactivate, demote,
--      or delete the last remaining active superadministrator.
--    - Uses transaction-level advisory locks for concurrency safety.
-- 2. Enforce Strict Least-Privilege for "admin" Employee Role:
--    - Admin employees share the same Admin Portal (products, categories, enquiries, inventory).
--    - Admin employees have full SELECT access to view, search, and filter business records.
--    - Admin employees have ZERO write/mutation privileges (INSERT, UPDATE, DELETE).
--    - Database-enforced via PostgreSQL RLS policies and trigger functions.
-- 3. Superadmin Role:
--    - Retains full authorized control over all modules (add, edit, soft-delete, staff management).
-- 4. Inventory Staff Role:
--    - Retains stock count and availability status update permissions only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER FUNCTION: protect_admin_users_escalation()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_admin_users_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_count INTEGER;
  v_remaining_superadmins INTEGER;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1A. CONTROLLED FIRST-TIME BOOTSTRAP CHECK
  -- --------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
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
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Access denied: Initial administrator bootstrap can only be executed by the database administrator (postgres).'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 1B. STANDARD RBAC ENFORCEMENT (Once initialized)
  -- --------------------------------------------------------------------------
  -- Allow direct database administrator operations (migrations, maintenance, CLI) when not in an auth user session
  IF auth.uid() IS NULL AND (session_user IN ('postgres', 'supabase_admin') OR current_user IN ('postgres', 'supabase_admin')) THEN
    -- Even for direct DBA operations, protect the last active superadmin from accidental deletion or deactivation
    IF OLD.role = 'superadmin' AND OLD.is_active = true THEN
      IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (NEW.is_active = false OR NEW.role <> 'superadmin')) THEN
        PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.admin_users_superadmin_guard')::bigint);
        SELECT count(*) INTO v_remaining_superadmins
        FROM public.admin_users
        WHERE role = 'superadmin'
          AND is_active = true
          AND id <> OLD.id;

        IF v_remaining_superadmins < 1 THEN
          RAISE EXCEPTION 'Safety check failed: Cannot demote, deactivate, or delete the last remaining active superadministrator.'
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
  END IF;

  -- All modifications strictly require caller to be an active superadmin.
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Only active superadministrators can modify administrator accounts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Safety check: Superadmins cannot demote or deactivate themselves (prevents self-lockout)
  IF TG_OP = 'UPDATE' AND OLD.id = auth.uid() AND (NEW.is_active = false OR NEW.role <> 'superadmin') THEN
    RAISE EXCEPTION 'Safety check failed: You cannot demote or deactivate your own superadministrator account.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.id = auth.uid() THEN
    RAISE EXCEPTION 'Safety check failed: You cannot delete your own superadministrator account.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Concurrency-Safe Last Active Superadmin Protection:
  -- Prevent demotion, deactivation, or deletion of the last remaining active superadmin
  -- even when a different superadmin attempts the operation.
  IF OLD.role = 'superadmin' AND OLD.is_active = true THEN
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (NEW.is_active = false OR NEW.role <> 'superadmin')) THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.admin_users_superadmin_guard')::bigint);
      SELECT count(*) INTO v_remaining_superadmins
      FROM public.admin_users
      WHERE role = 'superadmin'
        AND is_active = true
        AND id <> OLD.id;

      IF v_remaining_superadmins < 1 THEN
        RAISE EXCEPTION 'Safety check failed: Cannot demote, deactivate, or delete the last remaining active superadministrator.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY & POLICIES: public.categories
-- ----------------------------------------------------------------------------
-- Public: view active categories
-- Staff (all roles): view all categories
-- Superadmin: full manage (create, edit, soft-delete)
-- Admin Employee: SELECT ONLY (mutation forbidden)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins full manage categories" ON public.categories;
DROP POLICY IF EXISTS "Superadmins full manage categories" ON public.categories;

CREATE POLICY "Superadmins full manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY & POLICIES: public.products
-- ----------------------------------------------------------------------------
-- Public: view active products
-- Staff: view all products
-- Superadmin: insert, update, delete
-- Inventory Staff: update stock/availability via existing trigger
-- Admin Employee: SELECT ONLY (mutation forbidden)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Superadmins can insert products" ON public.products;

CREATE POLICY "Superadmins can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Superadmins can update products" ON public.products;

CREATE POLICY "Superadmins can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Update anti-tamper trigger: strictly block 'admin' employee and other non-superadmins from product modifications
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
    RAISE EXCEPTION 'Access denied: Unauthorized product modification. Product catalog edits require superadministrator privileges.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- Restrict soft_delete_product RPC strictly to superadmin
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

  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadministrator privileges required to deactivate products.'
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

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & POLICIES: public.enquiries
-- ----------------------------------------------------------------------------
-- Public: INSERT only (submit enquiry)
-- Superadmin & Admin Employee: SELECT (view customer enquiries)
-- Superadmin ONLY: UPDATE & DELETE (modify status/notes or remove enquiry)
-- Admin Employee: SELECT ONLY (status/notes updates forbidden)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Superadmins can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Admins can delete enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Superadmins can delete enquiries" ON public.enquiries;

CREATE POLICY "Superadmins can update enquiries"
  ON public.enquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmins can delete enquiries"
  ON public.enquiries
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

-- ----------------------------------------------------------------------------
-- 5. STORAGE OBJECTS SECURITY POLICIES: product-images bucket
-- ----------------------------------------------------------------------------
-- Public: SELECT (view product images)
-- Superadmin: INSERT, UPDATE, DELETE
-- Admin Employee & Inventory Staff: SELECT ONLY
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
    DROP POLICY IF EXISTS "Superadmins can upload product images" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
    DROP POLICY IF EXISTS "Superadmins can update product images" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
    DROP POLICY IF EXISTS "Superadmins can delete product images" ON storage.objects;

    CREATE POLICY "Superadmins can upload product images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'product-images' AND
        public.is_superadmin() AND
        (
          COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
        ) AND
        (
          (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        ) AND
        (
          lower(name) ~* '\.(jpe?g|png|webp|avif)$'
        )
      );

    CREATE POLICY "Superadmins can update product images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'product-images' AND
        public.is_superadmin()
      )
      WITH CHECK (
        bucket_id = 'product-images' AND
        public.is_superadmin() AND
        (
          COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
        ) AND
        (
          (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        ) AND
        (
          lower(name) ~* '\.(jpe?g|png|webp|avif)$'
        )
      );

    CREATE POLICY "Superadmins can delete product images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'product-images' AND
        public.is_superadmin()
      );
  END IF;
END $$;
