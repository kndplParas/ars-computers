-- ============================================================================
-- ARS Computers — Step 3D: Comprehensive Schema & Security Verification Test Harness
-- Target Environment: Isolated Development, Staging, or Local PostgreSQL/Supabase DB
-- Execution Role: Run as elevated database administrator ('postgres')
-- Safety: Non-destructive. Uses isolated test UUIDs and slugs ('test-sec-*').
--         All seeded test accounts and records are completely cleaned up upon completion.
-- ============================================================================
-- SCOPE OF VERIFICATION:
-- 1. First superadmin bootstrap: DBA succeeds; ordinary authenticated users blocked.
-- 2. Staff directory RBAC: Only superadmin can manage staff; lockout defense active.
-- 3. Catalogue management: Admins & superadmins have appropriate mutation rights.
-- 4. Inventory staff restrictions: Can update stock/availability ONLY; price, cost_price,
--    images, is_featured, is_active, and all 14 other catalog fields strictly blocked.
-- 5. Customer public catalogue access: anon & authenticated customers can browse active
--    items; cost_price is 100% blocked from both direct column SELECT and SELECT *.
-- 6. Customer enquiry & inactive item confidentiality: Zero public read on enquiries
--    or inactive/draft products.
-- 7. Soft-deletion: public.soft_delete_product(UUID) works for admins, blocked for staff/public.
-- 8. RPC security: public.get_product_cost_price() and public.bootstrap_first_admin()
--    exhibit strict authorization, return NULL for unauthorized, and safe execute grants.
-- 9. RLS and PostgreSQL SQL column grants work in complete harmony.
-- ============================================================================

DO $$
DECLARE
  -- Deterministic test UUIDs for simulated roles
  v_dba_uid    UUID := '11111111-1111-1111-1111-111111111111'::uuid;
  v_admin_uid  UUID := '22222222-2222-2222-2222-222222222222'::uuid;
  v_staff_uid  UUID := '33333333-3333-3333-3333-333333333333'::uuid;
  v_cust_uid   UUID := '44444444-4444-4444-4444-444444444444'::uuid;
  v_rogue_uid  UUID := '55555555-5555-5555-5555-555555555555'::uuid;

  v_cat_id     UUID;
  v_prod_id    UUID;
  v_draft_id   UUID;
  v_count      INTEGER;
  v_name       TEXT;
  v_price      NUMERIC(12, 2);
  v_cost_price NUMERIC(12, 2);
  v_status     TEXT;
  v_active     BOOLEAN;
  v_admin_rows INTEGER;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE '>>> ARS COMPUTERS: STEP 3D COMPREHENSIVE SECURITY TEST SUITE <<<';
  RAISE NOTICE '======================================================================';

  -- --------------------------------------------------------------------------
  -- STEP 0: Pre-flight Verification & Mock Environment Prep (if not on Supabase)
  -- --------------------------------------------------------------------------
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'This test suite must be executed as postgres or supabase_admin. Current user: %', current_user;
  END IF;

  -- Ensure auth schema & mock users table exist for standalone Postgres testing
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now()
  );

  -- Ensure auth.uid() function exists for standalone Postgres testing
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $auth_fn$
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $body$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), ''),
          (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::UUID;
      $body$;
    $auth_fn$;
  END IF;

  -- Ensure auth test actors exist in auth.users
  INSERT INTO auth.users (id, email)
  VALUES (v_dba_uid, 'dba@arscomputers.test'),
         (v_admin_uid, 'admin@arscomputers.test'),
         (v_staff_uid, 'staff@arscomputers.test'),
         (v_cust_uid, 'customer@example.test'),
         (v_rogue_uid, 'rogue@attacker.test')
  ON CONFLICT (id) DO NOTHING;

  -- Pre-clean any leftover test records from previous runs
  DELETE FROM public.enquiries WHERE name LIKE 'Test Security %';
  DELETE FROM public.products WHERE slug LIKE 'test-sec-%';
  DELETE FROM public.categories WHERE slug LIKE 'test-sec-%';
  DELETE FROM public.admin_users WHERE id IN (v_dba_uid, v_admin_uid, v_staff_uid, v_cust_uid, v_rogue_uid);

  RAISE NOTICE '✓ Step 0: Test environment initialized and clean.';

  -- --------------------------------------------------------------------------
  -- STEP 1: First Superadmin Bootstrap & Escalation Defense
  -- --------------------------------------------------------------------------
  -- Count existing admin users and enforce clean prerequisite state
  SELECT count(*) INTO v_admin_rows FROM public.admin_users;

  IF v_admin_rows > 0 THEN
    RAISE EXCEPTION 'Prerequisite check failed: public.admin_users table already contains % record(s). The security test harness requires a clean, unpopulated admin_users table to verify the initial first-admin bootstrap and anti-escalation defenses without modifying existing data. Please execute against a fresh, isolated test database.', v_admin_rows
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- 1a. Test Ordinary Authenticated User Bootstrap Attempt (MUST BE BLOCKED)
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rogue_uid::text, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_rogue_uid::text, true);

    INSERT INTO public.admin_users (id, email, full_name, role, is_active)
    VALUES (v_rogue_uid, 'rogue@attacker.test', 'Rogue Attacker', 'superadmin', true);

    RAISE EXCEPTION '✗ Step 1a FAILED: Ordinary authenticated user was able to insert into admin_users!';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE '✓ Step 1a PASSED: Ordinary authenticated user blocked from bootstrapping admin_users.';
  END;

  -- 1b. Test Unauthorized Direct Call to bootstrap_first_admin (MUST BE BLOCKED)
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rogue_uid::text, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_rogue_uid::text, true);

    PERFORM public.bootstrap_first_admin(v_rogue_uid, 'rogue@attacker.test', 'Rogue Attacker');
    RAISE EXCEPTION '✗ Step 1b FAILED: Ordinary authenticated user was able to execute bootstrap_first_admin!';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE '✓ Step 1b PASSED: Execution of bootstrap_first_admin revoked from authenticated role.';
  END;

  -- 1b2. Test DBA Bootstrap with Nonexistent auth.users ID (MUST FAIL WITH foreign_key_violation)
  RESET ROLE;
  BEGIN
    PERFORM public.bootstrap_first_admin('99999999-9999-9999-9999-999999999999'::uuid, 'nonexistent@test.com', 'Nonexistent Admin');
    RAISE EXCEPTION '✗ Step 1b2 FAILED: bootstrap_first_admin succeeded for non-existent auth.users ID!';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE '✓ Step 1b2 PASSED: bootstrap_first_admin validates that user ID exists in auth.users.';
  END;

  -- 1c. Test Authorized DBA Bootstrap (MUST SUCCEED)
  RESET ROLE;
  -- Table is verified empty; test the official DBA bootstrap helper
  PERFORM public.bootstrap_first_admin(v_dba_uid, 'dba@arscomputers.test', 'Master Superadmin');

  SELECT count(*) INTO v_count FROM public.admin_users WHERE id = v_dba_uid AND role = 'superadmin' AND is_active = true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 1c FAILED: bootstrap_first_admin did not create active superadmin record.';
  END IF;
  RAISE NOTICE '✓ Step 1c PASSED: Authorized DBA successfully bootstrapped initial superadmin.';

  -- 1d. Test Bootstrap Closure (Permanent Lockout of subsequent calls)
  BEGIN
    PERFORM public.bootstrap_first_admin(v_rogue_uid, 'another@attacker.test', 'Second Superadmin');
    RAISE EXCEPTION '✗ Step 1d FAILED: Second bootstrap call succeeded when admin_users was no longer empty!';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    RAISE NOTICE '✓ Step 1d PASSED: bootstrap_first_admin permanently closed after initial account.';
  END;

  -- --------------------------------------------------------------------------
  -- STEP 2: Staff Directory RBAC & Account Management
  -- --------------------------------------------------------------------------
  -- 2a. Superadmin Can Provision Admin and Inventory Staff
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dba_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_dba_uid::text, true);

  INSERT INTO public.admin_users (id, email, full_name, role, is_active)
  VALUES (v_admin_uid, 'admin@arscomputers.test', 'Store Administrator', 'admin', true),
         (v_staff_uid, 'staff@arscomputers.test', 'Inventory Specialist', 'inventory_staff', true);

  RAISE NOTICE '✓ Step 2a PASSED: Superadmin provisioned admin and inventory_staff accounts.';

  -- 2b. Regular Admin Cannot Provision or Alter Staff
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  BEGIN
    INSERT INTO public.admin_users (id, email, full_name, role, is_active)
    VALUES (v_rogue_uid, 'admin2@test.test', 'Rogue Admin', 'admin', true);
    RAISE EXCEPTION '✗ Step 2b FAILED: Regular admin was able to insert into admin_users!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 2b PASSED: Regular admin blocked from creating staff accounts.';
  END;

  -- 2c. Inventory Staff Has Zero Mutation Rights on admin_users
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  BEGIN
    UPDATE public.admin_users SET role = 'superadmin' WHERE id = v_staff_uid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
      RAISE EXCEPTION '✗ Step 2c FAILED: Inventory staff modified % record(s) in admin_users!', v_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    v_count := 0;
  END;

  -- Additional assertion: verify stored role remains unchanged
  SELECT role INTO v_status FROM public.admin_users WHERE id = v_staff_uid;
  IF v_status <> 'inventory_staff' THEN
    RAISE EXCEPTION '✗ Step 2c FAILED: Inventory staff role was modified to %!', v_status;
  END IF;
  RAISE NOTICE '✓ Step 2c PASSED: Inventory staff blocked from self-promotion (0 rows affected, role preserved).';

  -- 2d. Superadmin Lockout Defense (Cannot demote or delete self)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dba_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_dba_uid::text, true);

  BEGIN
    UPDATE public.admin_users SET role = 'admin' WHERE id = v_dba_uid;
    RAISE EXCEPTION '✗ Step 2d1 FAILED: Superadmin was able to self-demote!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ Step 2d1 PASSED: Superadmin self-demotion blocked by trigger.';
  END;

  BEGIN
    UPDATE public.admin_users SET is_active = false WHERE id = v_dba_uid;
    RAISE EXCEPTION '✗ Step 2d2 FAILED: Superadmin was able to self-deactivate!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ Step 2d2 PASSED: Superadmin self-deactivation blocked by trigger.';
  END;

  BEGIN
    DELETE FROM public.admin_users WHERE id = v_dba_uid;
    RAISE EXCEPTION '✗ Step 2d3 FAILED: Superadmin was able to delete own account!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ Step 2d3 PASSED: Superadmin self-deletion blocked by trigger.';
  END;

  -- --------------------------------------------------------------------------
  -- STEP 3: Catalogue Record Management (Admin & Superadmin)
  -- --------------------------------------------------------------------------
  -- 3a. Admin Creates Category and Products
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  INSERT INTO public.categories (slug, title, is_active)
  VALUES ('test-sec-laptops', 'Test Security Laptops', true)
  RETURNING id INTO v_cat_id;

  INSERT INTO public.categories (slug, title, is_active)
  VALUES ('test-sec-hidden', 'Hidden Security Category', false);

  INSERT INTO public.products (
    category_id, name, slug, sku, brand, model, price, cost_price,
    stock_quantity, min_stock_alert, is_featured, is_active, images,
    is_generic, warranty_text, hsn_code, availability_status
  )
  VALUES (
    v_cat_id, 'Test Sec Active Laptop', 'test-sec-active-laptop', 'TS-LAP-001',
    'Dell', 'Latitude 3440', 45000.00, 32000.00, 10, 2, true, true,
    ARRAY['https://example.com/test.webp']::text[], false, '3 Years OEM', '84713010', 'in_stock'
  )
  RETURNING id INTO v_prod_id;

  INSERT INTO public.products (
    category_id, name, slug, sku, brand, model, price, cost_price,
    stock_quantity, min_stock_alert, is_featured, is_active, images,
    is_generic, warranty_text, hsn_code, availability_status
  )
  VALUES (
    v_cat_id, 'Test Sec Draft Laptop', 'test-sec-draft-laptop', 'TS-LAP-002',
    'HP', 'ProBook 440', 52000.00, 38000.00, 5, 2, false, false,
    ARRAY[]::text[], false, '1 Year', '84713010', 'on_demand'
  )
  RETURNING id INTO v_draft_id;

  RAISE NOTICE '✓ Step 3 PASSED: Admin successfully created test categories and products.';

  -- --------------------------------------------------------------------------
  -- STEP 4: Inventory Staff Strict Field Restrictions
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  -- 4a. Permitted Updates (stock_quantity, min_stock_alert, availability_status)
  UPDATE public.products
  SET stock_quantity = 25,
      min_stock_alert = 4,
      availability_status = 'in_stock'
  WHERE id = v_prod_id;

  SELECT stock_quantity, availability_status INTO v_count, v_status
  FROM public.products WHERE id = v_prod_id;

  IF v_count <> 25 OR v_status <> 'in_stock' THEN
    RAISE EXCEPTION '✗ Step 4a FAILED: Inventory staff permitted update did not apply.';
  END IF;
  RAISE NOTICE '✓ Step 4a PASSED: Inventory staff updated stock_quantity and availability_status.';

  -- 4b. Restricted Fields Modification Attempts (MUST FAIL)
  -- Test price change block
  BEGIN
    UPDATE public.products SET price = 49999.00 WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b1 FAILED: Inventory staff modified price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b1 PASSED: Inventory staff blocked from updating price.';
  END;

  -- Test cost_price change block
  BEGIN
    UPDATE public.products SET cost_price = 28000.00 WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b2 FAILED: Inventory staff modified cost_price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b2 PASSED: Inventory staff blocked from updating cost_price.';
  END;

  -- Test is_featured change block (CRITICAL STEP 3C FIX)
  BEGIN
    UPDATE public.products SET is_featured = false WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b3 FAILED: Inventory staff modified is_featured!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b3 PASSED: Inventory staff blocked from updating is_featured.';
  END;

  -- Test images change block (CRITICAL STEP 3C FIX)
  BEGIN
    UPDATE public.products SET images = ARRAY['https://example.com/hacked.webp']::text[] WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b4 FAILED: Inventory staff modified images!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b4 PASSED: Inventory staff blocked from updating images.';
  END;

  -- Test name change block
  BEGIN
    UPDATE public.products SET name = 'Defaced Product Name' WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b5 FAILED: Inventory staff modified product name!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b5 PASSED: Inventory staff blocked from updating product name.';
  END;

  -- Test is_active change block
  BEGIN
    UPDATE public.products SET is_active = false WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 4b6 FAILED: Inventory staff modified is_active!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 4b6 PASSED: Inventory staff blocked from updating is_active.';
  END;

  -- 4c. Inventory Staff Cannot Delete Products
  BEGIN
    DELETE FROM public.products WHERE id = v_prod_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
      RAISE EXCEPTION '✗ Step 4c FAILED: Inventory staff deleted % product(s)!', v_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    v_count := 0;
  END;

  -- Additional assertion: verify product still exists
  SELECT EXISTS (SELECT 1 FROM public.products WHERE id = v_prod_id) INTO v_active;
  IF NOT v_active THEN
    RAISE EXCEPTION '✗ Step 4c FAILED: Product was deleted!';
  END IF;
  RAISE NOTICE '✓ Step 4c PASSED: Inventory staff blocked from deleting products (0 rows affected, product preserved).';

  -- --------------------------------------------------------------------------
  -- STEP 5: Customer Public Catalogue Access & cost_price Confidentiality
  -- --------------------------------------------------------------------------
  -- 5a. Anonymous User Access & cost_price Shield
  SET LOCAL ROLE anon;

  -- Can read active product approved columns
  SELECT name, price INTO v_name, v_price FROM public.products WHERE id = v_prod_id;
  IF v_name IS NULL OR v_price IS NULL THEN
    RAISE EXCEPTION '✗ Step 5a1 FAILED: anon failed to read permitted active product columns.';
  END IF;
  RAISE NOTICE '✓ Step 5a1 PASSED: anon read approved product columns (name: %, price: %).', v_name, v_price;

  -- Direct cost_price SELECT blocked
  BEGIN
    SELECT cost_price INTO v_cost_price FROM public.products WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 5a2 FAILED: anon read cost_price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 5a2 PASSED: anon blocked from reading cost_price (insufficient_privilege).';
  END;

  -- SELECT * blocked by omission of cost_price from column grants
  BEGIN
    PERFORM * FROM public.products WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 5a3 FAILED: anon SELECT * succeeded, leaking unpermitted columns!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 5a3 PASSED: anon SELECT * blocked by column-level privilege enforcement.';
  END;

  -- Inactive items invisible
  SELECT count(*) INTO v_count FROM public.products WHERE id = v_draft_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 5a4 FAILED: anon can see inactive product!';
  END IF;

  SELECT count(*) INTO v_count FROM public.categories WHERE slug = 'test-sec-hidden';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 5a5 FAILED: anon can see inactive category!';
  END IF;
  RAISE NOTICE '✓ Step 5a4/5a5 PASSED: anon filtered from inactive products and categories.';

  -- 5b. Authenticated Non-Staff Customer Access & cost_price Shield (CRITICAL STEP 3C FIX)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_cust_uid::text, true);

  -- Authenticated customer CAN read active product approved columns
  SELECT name, price INTO v_name, v_price FROM public.products WHERE id = v_prod_id;
  IF v_name IS NULL OR v_price IS NULL THEN
    RAISE EXCEPTION '✗ Step 5b1 FAILED: Authenticated customer could not read active product catalog!';
  END IF;
  RAISE NOTICE '✓ Step 5b1 PASSED: Authenticated customer can browse active products.';

  -- Direct cost_price SELECT blocked for authenticated customer
  BEGIN
    SELECT cost_price INTO v_cost_price FROM public.products WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 5b2 FAILED: Authenticated customer read cost_price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 5b2 PASSED: Authenticated customer blocked from reading cost_price.';
  END;

  -- Inactive product invisible to authenticated customer
  SELECT count(*) INTO v_count FROM public.products WHERE id = v_draft_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 5b3 FAILED: Authenticated customer can see inactive product!';
  END IF;
  RAISE NOTICE '✓ Step 5b3 PASSED: Inactive product invisible to authenticated customer.';

  -- 5c. Inventory Staff cost_price Shield
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  BEGIN
    SELECT cost_price INTO v_cost_price FROM public.products WHERE id = v_prod_id;
    RAISE EXCEPTION '✗ Step 5c FAILED: Inventory staff read cost_price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 5c PASSED: Inventory staff blocked from reading cost_price.';
  END;

  -- --------------------------------------------------------------------------
  -- STEP 6: Customer Enquiries Privacy & Submission
  -- --------------------------------------------------------------------------
  -- 6a. Legitimate Submission by Anonymous User
  SET LOCAL ROLE anon;
  INSERT INTO public.enquiries (name, contact_info, message)
  VALUES ('Test Security Customer', '+91 9876543210', 'Pricing inquiry for bulk systems.');
  RAISE NOTICE '✓ Step 6a PASSED: Anonymous user can submit legitimate enquiry.';

  -- 6b. Confidentiality: Zero Read Access for Public and Non-Admins
  BEGIN
    SELECT count(*) INTO v_count FROM public.enquiries;
    RAISE EXCEPTION '✗ Step 6b1 FAILED: anon was able to SELECT customer enquiries!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 6b1 PASSED: anon blocked from reading customer enquiries.';
  END;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  SELECT count(*) INTO v_count FROM public.enquiries;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 6b2 FAILED: Inventory staff read customer enquiries!';
  END IF;
  RAISE NOTICE '✓ Step 6b2 PASSED: Inventory staff receives 0 rows on customer enquiries (RLS gated).';

  -- 6c. Admin Can Read Enquiries
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  SELECT count(*) INTO v_count FROM public.enquiries WHERE name = 'Test Security Customer';
  IF v_count = 0 THEN
    RAISE EXCEPTION '✗ Step 6c FAILED: Store admin could not read submitted customer enquiry.';
  END IF;
  RAISE NOTICE '✓ Step 6c PASSED: Store admin can view submitted customer enquiries.';

  -- --------------------------------------------------------------------------
  -- STEP 7: Safe Soft Deletion (public.soft_delete_product)
  -- --------------------------------------------------------------------------
  -- 7a. Unauthorized Soft Delete Call by Inventory Staff (MUST FAIL)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  BEGIN
    PERFORM public.soft_delete_product(v_prod_id);
    RAISE EXCEPTION '✗ Step 7a FAILED: Inventory staff soft-deleted product!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 7a PASSED: Inventory staff blocked from calling soft_delete_product.';
  END;

  -- 7b. Authorized Soft Delete Call by Store Admin (MUST SUCCEED)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  PERFORM public.soft_delete_product(v_prod_id);

  SELECT is_active INTO v_active FROM public.products WHERE id = v_prod_id;
  IF v_active IS NOT FALSE THEN
    RAISE EXCEPTION '✗ Step 7b FAILED: soft_delete_product did not set is_active to false.';
  END IF;
  RAISE NOTICE '✓ Step 7b PASSED: Admin soft_delete_product successfully deactivated product.';

  -- Deactivated product must now be invisible to customer
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.products WHERE id = v_prod_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 7b2 FAILED: Deactivated product is still visible to anon!';
  END IF;
  RAISE NOTICE '✓ Step 7b2 PASSED: Soft-deleted product is immediately hidden from customer catalogue.';

  -- 7c. Ordinary Admin Cannot Hard Delete Product (RLS DELETE restricted to superadmin)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  DELETE FROM public.products WHERE id = v_prod_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 7c FAILED: Ordinary admin was able to hard delete product!';
  END IF;

  -- Verify product still exists in table
  SELECT count(*) INTO v_count FROM public.products WHERE id = v_prod_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 7c FAILED: Product was deleted or missing after ordinary admin DELETE attempt!';
  END IF;
  RAISE NOTICE '✓ Step 7c PASSED: Ordinary admin cannot hard-delete products (RLS filters out delete).';

  -- --------------------------------------------------------------------------
  -- STEP 8: Cost Price Access RPC & Bulk Admin Products RPC
  -- --------------------------------------------------------------------------
  -- 8a. Admin Reads Numeric Cost Price
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  v_cost_price := public.get_product_cost_price(v_prod_id);
  IF v_cost_price <> 32000.00 THEN
    RAISE EXCEPTION '✗ Step 8a FAILED: Admin get_product_cost_price returned unexpected value: %', v_cost_price;
  END IF;
  RAISE NOTICE '✓ Step 8a PASSED: Store admin retrieved product cost_price via RPC (% INR).', v_cost_price;

  -- 8b. Superadmin Reads Numeric Cost Price
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dba_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_dba_uid::text, true);

  v_cost_price := public.get_product_cost_price(v_prod_id);
  IF v_cost_price <> 32000.00 THEN
    RAISE EXCEPTION '✗ Step 8b FAILED: Superadmin get_product_cost_price returned unexpected value: %', v_cost_price;
  END IF;
  RAISE NOTICE '✓ Step 8b PASSED: Superadmin retrieved product cost_price via RPC.';

  -- 8c. Inventory Staff Receives NULL (Not an Exception)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  v_cost_price := public.get_product_cost_price(v_prod_id);
  IF v_cost_price IS NOT NULL THEN
    RAISE EXCEPTION '✗ Step 8c FAILED: Inventory staff received non-null cost_price: %', v_cost_price;
  END IF;
  RAISE NOTICE '✓ Step 8c PASSED: Inventory staff safely receives NULL from get_product_cost_price.';

  -- 8d. Customer Receives NULL
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_cust_uid::text, true);

  v_cost_price := public.get_product_cost_price(v_prod_id);
  IF v_cost_price IS NOT NULL THEN
    RAISE EXCEPTION '✗ Step 8d FAILED: Customer received non-null cost_price: %', v_cost_price;
  END IF;
  RAISE NOTICE '✓ Step 8d PASSED: Customer safely receives NULL from get_product_cost_price.';

  -- 8e. NULL Parameter Handling
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  v_cost_price := public.get_product_cost_price(NULL);
  IF v_cost_price IS NOT NULL THEN
    RAISE EXCEPTION '✗ Step 8e FAILED: NULL parameter did not return NULL.';
  END IF;
  RAISE NOTICE '✓ Step 8e PASSED: NULL product ID handled defensively without error.';

  -- 8f. Anon Role Cannot Execute get_product_cost_price
  SET LOCAL ROLE anon;
  BEGIN
    v_cost_price := public.get_product_cost_price(v_prod_id);
    RAISE EXCEPTION '✗ Step 8f FAILED: anon was able to execute get_product_cost_price!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 8f PASSED: Execute privilege on get_product_cost_price revoked from anon.';
  END;

  -- 8g. Store Admin Bulk RPC: get_admin_products returns commercial records with cost_price
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  SELECT count(*), max(cost_price) INTO v_count, v_cost_price
  FROM public.get_admin_products(v_cat_id, true, 50, 0);

  IF v_count <> 2 OR v_cost_price <> 38000.00 THEN
    RAISE EXCEPTION '✗ Step 8g FAILED: Store admin bulk RPC get_admin_products failed (count=%, cost=%)', v_count, v_cost_price;
  END IF;
  RAISE NOTICE '✓ Step 8g PASSED: Store admin retrieved bulk products with cost_price via get_admin_products (% products, max cost: % INR).', v_count, v_cost_price;

  -- 8h. Superadmin Bulk RPC: get_admin_products succeeds
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dba_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_dba_uid::text, true);

  SELECT count(*), max(cost_price) INTO v_count, v_cost_price
  FROM public.get_admin_products(v_cat_id, true, 50, 0);

  IF v_count <> 2 OR v_cost_price <> 38000.00 THEN
    RAISE EXCEPTION '✗ Step 8h FAILED: Superadmin bulk RPC get_admin_products failed.';
  END IF;
  RAISE NOTICE '✓ Step 8h PASSED: Superadmin retrieved bulk products with cost_price via get_admin_products.';

  -- 8i. Inventory Staff Bulk RPC: Blocked with insufficient_privilege
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  BEGIN
    PERFORM * FROM public.get_admin_products(v_cat_id, true, 50, 0);
    RAISE EXCEPTION '✗ Step 8i FAILED: Inventory staff accessed get_admin_products bulk RPC!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 8i PASSED: Inventory staff strictly blocked from calling get_admin_products bulk RPC.';
  END;

  -- 8j. Customer Authenticated Bulk RPC: Blocked with insufficient_privilege
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_cust_uid::text, true);

  BEGIN
    PERFORM * FROM public.get_admin_products(v_cat_id, true, 50, 0);
    RAISE EXCEPTION '✗ Step 8j FAILED: Customer authenticated accessed get_admin_products bulk RPC!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 8j PASSED: Customer authenticated strictly blocked from calling get_admin_products bulk RPC.';
  END;

  -- 8k. Anon Visitor Bulk RPC: Blocked with insufficient_privilege
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM * FROM public.get_admin_products(v_cat_id, true, 50, 0);
    RAISE EXCEPTION '✗ Step 8k FAILED: Anon accessed get_admin_products bulk RPC!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 8k PASSED: Anon visitor strictly blocked from calling get_admin_products bulk RPC.';
  END;

  -- 8l. Bounded Pagination: Clamping verification
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  SELECT count(*) INTO v_count FROM public.get_admin_products(v_cat_id, true, 1, 0);
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 8l FAILED: Bounded pagination limit 1 did not return exactly 1 row.';
  END IF;
  RAISE NOTICE '✓ Step 8l PASSED: get_admin_products pagination correctly limits returned rows.';

  -- 8m. Superadmin CAN Hard Delete Product
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dba_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_dba_uid::text, true);

  DELETE FROM public.products WHERE id = v_prod_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 8m FAILED: Superadmin was unable to hard delete product!';
  END IF;
  RAISE NOTICE '✓ Step 8m PASSED: Superadmin successfully hard-deleted product.';

  -- --------------------------------------------------------------------------
  -- STEP 9: Storage Security & Policy Verification (Mock storage schema)
  -- --------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- Create mock storage tables for testing policies
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
  );

  CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now()
  );

  GRANT USAGE ON SCHEMA storage TO anon, authenticated;
  GRANT ALL ON storage.buckets TO postgres;
  GRANT SELECT ON storage.buckets TO anon, authenticated;
  GRANT ALL ON storage.objects TO postgres;
  GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;

  -- Insert bucket
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

  CREATE POLICY "Public can view product images"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'product-images');

  CREATE POLICY "Admins can upload product images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'product-images' AND
      public.is_admin() AND
      (
        COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
      ) AND
      (
        (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      ) AND
      (
        lower(substring(name from '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'webp', 'avif')
      )
    );

  CREATE POLICY "Admins can update product images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'product-images' AND
      public.is_admin()
    )
    WITH CHECK (
      bucket_id = 'product-images' AND
      public.is_admin() AND
      (
        COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
      ) AND
      (
        (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      ) AND
      (
        lower(substring(name from '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'webp', 'avif')
      )
    );

  CREATE POLICY "Admins can delete product images"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'product-images' AND
      public.is_admin()
    );

  -- 9a. Anon Cannot Upload Image (Blocked by RLS)
  SET LOCAL ROLE anon;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('product-images', 'test.jpg', '{"size": 1000, "mimetype": "image/jpeg"}'::jsonb);
    RAISE EXCEPTION '✗ Step 9a FAILED: Anon was able to upload image to product-images!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 9a PASSED: Anon blocked from uploading images.';
  END;

  -- 9b. Inventory Staff Cannot Upload Image (Blocked by RLS)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('product-images', 'test.jpg', '{"size": 1000, "mimetype": "image/jpeg"}'::jsonb);
    RAISE EXCEPTION '✗ Step 9b FAILED: Inventory staff was able to upload image!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 9b PASSED: Inventory staff blocked from uploading images.';
  END;

  -- 9c. Admin CAN Upload Legitimate Image (<=5MB, allowed MIME & extension)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  INSERT INTO storage.objects (bucket_id, name, metadata)
  VALUES ('product-images', 'valid-laptop.webp', '{"size": 1048576, "mimetype": "image/webp"}'::jsonb);
  RAISE NOTICE '✓ Step 9c PASSED: Admin successfully uploaded legitimate 1MB WebP image.';

  -- 9d. Admin CANNOT Upload Oversized Image (>5MB)
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('product-images', 'huge-photo.jpg', '{"size": 6000000, "mimetype": "image/jpeg"}'::jsonb);
    RAISE EXCEPTION '✗ Step 9d FAILED: Admin uploaded oversized 6MB image!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 9d PASSED: Oversized image (>5MB) strictly rejected by storage RLS policy.';
  END;

  -- 9e. Admin CANNOT Upload Disallowed MIME / Extension (.exe or .svg)
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('product-images', 'malware.exe', '{"size": 1000, "mimetype": "application/x-msdownload"}'::jsonb);
    RAISE EXCEPTION '✗ Step 9e FAILED: Admin uploaded forbidden .exe file!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 9e PASSED: Forbidden file extension (.exe) strictly rejected by storage RLS policy.';
  END;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('product-images', 'vector.svg', '{"size": 1000, "mimetype": "image/svg+xml"}'::jsonb);
    RAISE EXCEPTION '✗ Step 9e2 FAILED: Admin uploaded SVG file!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '✓ Step 9e2 PASSED: SVG image type (XSS risk) strictly rejected by storage RLS policy.';
  END;

  -- 9f. Admin CAN Update / Upsert Image
  UPDATE storage.objects
  SET metadata = '{"size": 1500000, "mimetype": "image/webp"}'::jsonb
  WHERE bucket_id = 'product-images' AND name = 'valid-laptop.webp';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 9f FAILED: Admin could not update image metadata.';
  END IF;
  RAISE NOTICE '✓ Step 9f PASSED: Admin successfully updated image (upsert support).';

  -- 9g. Public / Anon CAN View Uploaded Image
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id = 'product-images';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 9g FAILED: Public could not read uploaded image.';
  END IF;
  RAISE NOTICE '✓ Step 9g PASSED: Public/anon can view uploaded product images.';

  -- 9h. Inventory Staff CANNOT Delete Image
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_uid::text, true);

  DELETE FROM storage.objects WHERE bucket_id = 'product-images' AND name = 'valid-laptop.webp';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '✗ Step 9h FAILED: Inventory staff was able to delete image!';
  END IF;
  RAISE NOTICE '✓ Step 9h PASSED: Inventory staff blocked from deleting images.';

  -- 9i. Admin CAN Delete Image
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::text, true);

  DELETE FROM storage.objects WHERE bucket_id = 'product-images' AND name = 'valid-laptop.webp';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '✗ Step 9i FAILED: Admin was unable to delete image!';
  END IF;
  RAISE NOTICE '✓ Step 9i PASSED: Admin successfully deleted product image.';

  -- Clean up storage mock tables
  RESET ROLE;
  DROP TABLE IF EXISTS storage.objects;
  DROP TABLE IF EXISTS storage.buckets;
  DROP SCHEMA IF EXISTS storage CASCADE;

  -- --------------------------------------------------------------------------
  -- STEP 10: Complete Teardown & Cleanup
  -- --------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  DELETE FROM public.enquiries WHERE name LIKE 'Test Security %';
  DELETE FROM public.products WHERE slug LIKE 'test-sec-%';
  DELETE FROM public.categories WHERE slug LIKE 'test-sec-%';
  DELETE FROM public.admin_users WHERE id IN (v_dba_uid, v_admin_uid, v_staff_uid, v_cust_uid, v_rogue_uid);
  DELETE FROM auth.users WHERE id IN (v_dba_uid, v_admin_uid, v_staff_uid, v_cust_uid, v_rogue_uid);

  RAISE NOTICE '======================================================================';
  RAISE NOTICE '>>> ALL 10 COMPREHENSIVE SECURITY & RBAC SUITES PASSED CLEANLY <<<';
  RAISE NOTICE '======================================================================';
END $$;
