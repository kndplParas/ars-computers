# ARS Computers — Step 3D: Isolated PostgreSQL Security Testing Guide

This document describes how to execute the comprehensive security verification test harness [`schema_security_test.sql`](./schema_security_test.sql) in a safe, isolated PostgreSQL or Supabase environment prior to any production deployment.

---

## 1. Safety Guarantees & Non-Destructive Design

The test harness is strictly non-destructive:
- **Deterministic Test Identifiers**: All test accounts use distinct UUIDs (`11111111-...` through `55555555-...`).
- **Isolated Slugs**: All test categories and products use the prefix `test-sec-*`.
- **Automatic Cleanup**: Step 9 sweeps and deletes all seeded test rows from `public.enquiries`, `public.products`, `public.categories`, `public.admin_users`, and `auth.users`.
- **Clean State Prerequisite**: The `public.admin_users` table must be completely unpopulated before running the test harness. If existing administrator records are detected, the harness halts safely with an `object_not_in_prerequisite_state` exception without modifying any data.
- **Transaction Rollback Protection**: Error assertions run inside PL/pgSQL exception blocks (`BEGIN ... EXCEPTION ... END`), isolating test checks without aborting the harness.

---

## 2. Test Coverage Matrix

| Test Suite | Focus Area | Checks Performed |
|---|---|---|
| **Step 0** | Environment Prep | Validates execution as `postgres`, ensures mock `auth` schema/users table exists if testing on vanilla PostgreSQL. |
| **Step 1** | First-Admin Bootstrap | Verifies ordinary `authenticated` user cannot self-promote, verifies execution revoked on `bootstrap_first_admin()`, tests DBA bootstrap, verifies bootstrap window permanently closes once initialized. |
| **Step 2** | Staff Directory RBAC | Tests Superadmin creating Admin and Staff accounts, tests Admin blocked from creating staff, tests Staff self-promotion block, tests Superadmin lockout defense (cannot demote or delete self). |
| **Step 3** | Catalogue Management | Verifies Admin and Superadmin can create and manage categories and products. |
| **Step 4** | Inventory Staff Restrictions | Verifies Staff CAN update `stock_quantity`, `min_stock_alert`, `availability_status`; verifies Staff CANNOT modify `price`, `cost_price`, `is_featured`, `images`, `name`, `is_active`, or delete records. |
| **Step 5** | Public Catalogue Access & Cost-Price Shield | Verifies `anon` and `authenticated` customers can read approved active columns, verifies `cost_price` is blocked on direct SELECT and `SELECT *`, verifies inactive items are hidden. |
| **Step 6** | Customer Enquiries | Verifies `anon` can submit enquiries, verifies `anon` and `inventory_staff` have zero SELECT access, verifies Admin can read enquiries. |
| **Step 7** | Soft & Hard Deletion | Verifies `public.soft_delete_product(UUID)` succeeds for Admin and instantly hides product; verifies Staff cannot soft-delete; verifies ordinary Admin CANNOT hard-delete (0 rows modified); verifies Superadmin CAN hard-delete. |
| **Step 8** | Cost Price Access & Bulk Admin Catalog RPC | Verifies `public.get_product_cost_price(UUID)` and `public.get_admin_products()` return numeric cost_price for Admin/Superadmin, return NULL/deny for Staff/Customer/Anon, verifies safe bounded pagination. |
| **Step 9** | Storage Security Policies | Verifies `product-images` bucket policies: public can read, Staff cannot upload/delete, Admin can upload valid images (<=5MB, allowed MIME & ext), rejects oversized files (>5MB) and disallowed extensions (.exe, .svg), verifies update/upsert and delete permissions. |
| **Step 10** | Cleanup | Purges all test records and restores clean database state. |

---

## 3. How to Execute in an Isolated Environment

### Option A: In a Supabase Staging Project (Supabase Studio)
1. Open the Supabase Studio dashboard of your **isolated staging/development project**. (Never run against production).
2. Ensure the `public.admin_users` table is empty.
3. Apply the draft migrations in sequence:
   - `20261019000001_extend_product_catalog.sql`
   - `20261019000002_admin_roles_and_permissions.sql`
   - `20261019000003_storage_security_policies.sql`
4. Navigate to **SQL Editor**.
5. Open or paste [`supabase/tests/schema_security_test.sql`](./schema_security_test.sql).
6. Click **Run**.
7. Verify output logs show:
   `>>> ALL 10 COMPREHENSIVE SECURITY & RBAC SUITES PASSED CLEANLY <<<`

### Option B: In a Local Docker Container
```bash
# 1. Start a temporary PostgreSQL 16 container
docker run --name ars-sec-test -e POSTGRES_PASSWORD=postgres -p 54322:5432 -d postgres:16-alpine

# 2. Provision standard Supabase client roles required by the schema grants
psql -h localhost -p 54322 -U postgres -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; GRANT USAGE ON SCHEMA public TO anon, authenticated;"

# 3. Apply initial schema and draft migrations
psql -h localhost -p 54322 -U postgres -f supabase/migrations/20261018000001_initial_schema.sql
psql -h localhost -p 54322 -U postgres -f supabase/migrations/20261019000001_extend_product_catalog.sql
psql -h localhost -p 54322 -U postgres -f supabase/migrations/20261019000002_admin_roles_and_permissions.sql

# 4. Execute the security test suite
psql -h localhost -p 54322 -U postgres -f supabase/tests/schema_security_test.sql

# 5. Tear down container
docker stop ars-sec-test && docker rm ars-sec-test
```
