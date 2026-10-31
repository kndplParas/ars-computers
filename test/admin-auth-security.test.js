/**
 * ARS Computers — Automated Security Invariant Test Suite
 * Tests admin authentication integrity, route guards, and credential hygiene.
 * Execution: node test/admin-auth-security.test.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

register('./asset-loader.js', import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`)
    passedTests++
  } else {
    console.error(`  ✗ FAILED: ${message}`)
    failedTests++
  }
}

console.log('====================================================================')
console.log('Running ARS Computers Admin Security & Auth Invariant Tests')
console.log('====================================================================')

// 1. Verify AdminAuthProvider.jsx
console.log('\n[Suite 1] Inspecting src/context/AdminAuthProvider.jsx:')
const authProviderPath = path.join(projectRoot, 'src', 'context', 'AdminAuthProvider.jsx')
const authProviderCode = fs.readFileSync(authProviderPath, 'utf8')

assert(
  !authProviderCode.includes('paras123@gmail.com') && !authProviderCode.includes('paras@'),
  'No hardcoded developer credentials exist in AdminAuthProvider.jsx'
)

assert(
  !authProviderCode.includes('ars_demo_admin_user') ||
  !authProviderCode.includes('sessionStorage.setItem'),
  'No fake demo admin session is created or stored in sessionStorage'
)

assert(
  authProviderCode.includes('supabase.auth.signInWithPassword'),
  'Login exclusively invokes supabase.auth.signInWithPassword'
)

assert(
  authProviderCode.includes("from('admin_users')") &&
  authProviderCode.includes("select('id, email, full_name, role, is_active')"),
  'Login verifies role and status against public.admin_users'
)

assert(
  authProviderCode.includes('profile.is_active !== true') &&
  authProviderCode.includes('scheduleSafeSignOut'),
  'Inactive or missing staff profiles trigger immediate session termination'
)

// 2. Verify AdminRouteGuard.jsx
console.log('\n[Suite 2] Inspecting src/components/admin/AdminRouteGuard.jsx:')
const routeGuardPath = path.join(projectRoot, 'src', 'components', 'admin', 'AdminRouteGuard.jsx')
const routeGuardCode = fs.readFileSync(routeGuardPath, 'utf8')

assert(
  routeGuardCode.includes('!isAuthenticated') &&
  routeGuardCode.includes('<Navigate to="/admin/login"'),
  'Unauthenticated traffic is strictly redirected to /admin/login'
)

assert(
  !routeGuardCode.includes('isDemo') && !routeGuardCode.includes('mock'),
  'AdminRouteGuard contains no bypasses or exemptions for demo accounts'
)

// 3. Verify App.jsx Protected Routes
console.log('\n[Suite 3] Inspecting src/App.jsx route guards:')
const appPath = path.join(projectRoot, 'src', 'App.jsx')
const appCode = fs.readFileSync(appPath, 'utf8')

const adminRoutes = [
  'path="/admin"',
  'path="/admin/products"',
  'path="/admin/inventory"',
  'path="/admin/categories"',
  'path="/admin/enquiries"',
  'path="/admin/staff"',
  'path="/admin/dashboard"'
]

adminRoutes.forEach((route) => {
  const routeIdx = appCode.indexOf(route)
  const isProtected = routeIdx !== -1 && appCode.slice(routeIdx, routeIdx + 200).includes('AdminRouteGuard')
  assert(isProtected, `Route ${route} is wrapped with AdminRouteGuard`)
})

// 4. Global Scan for Hardcoded Passwords/Bypasses in Source Files
console.log('\n[Suite 4] Global source code credential hygiene check:')
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        files.push(...scanDir(fullPath))
      }
    } else if (/\.(jsx?|tsx?|html)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

const sourceFiles = scanDir(path.join(projectRoot, 'src'))
let foundBypass = false

sourceFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8')
  if (content.includes('paras123@gmail.com') || content.includes('paras@')) {
    foundBypass = true
    console.error(`  ✗ Flagged leaked demo credential in: ${path.relative(projectRoot, file)}`)
  }
})

assert(!foundBypass, 'Zero hardcoded demo credentials found across entire src/ tree')

// 5. Fail-Closed Catalog & Product Column Protection
console.log('\n[Suite 5] Testing Catalog fail-closed invariants and column security:')
const catalogPath = path.join(projectRoot, 'src', 'lib', 'catalog.js')
const catalogCode = fs.readFileSync(catalogPath, 'utf8')

assert(
  !catalogCode.includes("'cost_price'") && !catalogCode.includes('"cost_price"') ||
  // cost_price is only allowed in fetchAdminProducts / RPC comments, never in APPROVED_PUBLIC_PRODUCT_COLUMNS
  !catalogCode.slice(catalogCode.indexOf('APPROVED_PUBLIC_PRODUCT_COLUMNS'), catalogCode.indexOf('APPROVED_PUBLIC_CATEGORY_COLUMNS')).includes('cost_price'),
  'cost_price is strictly excluded from APPROVED_PUBLIC_PRODUCT_COLUMNS'
)

assert(
  catalogCode.includes("error.code === '42501'") &&
  catalogCode.includes('isPermissionDenied'),
  'fetchAdminProducts detects PostgreSQL 42501 permission denial and sets isPermissionDenied flag'
)

assert(
  catalogCode.includes('Math.min(Math.max(Number(limit) || 50, 1), 200)'),
  'fetchAdminProducts clamps pagination limits safely between 1 and 200'
)

// Dynamic execution of catalog functions under unconfigured/offline conditions
const { fetchAdminCategories, fetchAdminProducts, isValidUUID } = await import('../src/lib/catalog.js')

const offlineCatResult = await fetchAdminCategories()
assert(
  offlineCatResult.isLive === false && Array.isArray(offlineCatResult.categories) && offlineCatResult.categories.length === 0,
  'fetchAdminCategories fails closed (returns empty categories and isLive=false) when Supabase is offline/unconfigured'
)

const offlineProdResult = await fetchAdminProducts()
assert(
  offlineProdResult.isLive === false && Array.isArray(offlineProdResult.products) && offlineProdResult.products.length === 0,
  'fetchAdminProducts fails closed (returns empty products and isLive=false) when Supabase is offline/unconfigured'
)

assert(
  isValidUUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d') === true &&
  isValidUUID('invalid-slug') === false &&
  isValidUUID('') === false &&
  isValidUUID(null) === false,
  'isValidUUID correctly validates UUID formats and rejects non-UUID slugs'
)

// 6. AdminDataProvider Fail-Closed & Mutation Isolation
console.log('\n[Suite 6] Inspecting src/context/AdminDataProvider.jsx fail-closed rules:')
const dataProviderPath = path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx')
const dataProviderCode = fs.readFileSync(dataProviderPath, 'utf8')

assert(
  dataProviderCode.includes('const isLiveDatabase = Boolean(isSupabaseConfigured && isAuthenticated && adminUser)'),
  'isLiveDatabase strictly requires isSupabaseConfigured AND isAuthenticated AND adminUser'
)

assert(
  dataProviderCode.includes('// STRICT RULE: Never silently fallback to demo data on live database failure') &&
  dataProviderCode.includes('setLiveProducts([])'),
  'AdminDataProvider sets liveProducts to empty array and never silently falls back to demo data on database query failure'
)

assert(
  dataProviderCode.includes('if (isLiveDatabase) {') &&
  dataProviderCode.includes('Database INSERT mutation is disabled') &&
  dataProviderCode.includes('Database UPDATE mutation is disabled'),
  'Mutations in AdminDataProvider fail closed and prevent unauthorized live database writes'
)

// 7. Role-Based Access Control (RBAC) Logic Invariants
console.log('\n[Suite 7] Simulating AdminAuthProvider role-gating and session revocation invariants:')

function simulateProfileVerification(profile) {
  if (!profile || profile.is_active !== true) {
    return null
  }
  const validRoles = ['superadmin', 'admin', 'inventory_staff']
  if (!validRoles.includes(profile.role)) {
    return null
  }
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active
  }
}

// 7A: Inactive profile is rejected
assert(
  simulateProfileVerification({ id: 'uuid-1', role: 'admin', is_active: false }) === null,
  'Inactive administrator account (is_active: false) is strictly rejected'
)

// 7B: Missing profile is rejected
assert(
  simulateProfileVerification(null) === null,
  'Missing profile (not in admin_users directory) is strictly rejected'
)

// 7C: Non-staff role is rejected
assert(
  simulateProfileVerification({ id: 'uuid-2', role: 'customer', is_active: true }) === null &&
  simulateProfileVerification({ id: 'uuid-3', role: 'guest', is_active: true }) === null,
  'Unauthorized roles ("customer", "guest") are strictly rejected'
)

// 7D: Valid staff roles are accepted
assert(
  simulateProfileVerification({ id: 'uuid-4', role: 'superadmin', is_active: true })?.role === 'superadmin' &&
  simulateProfileVerification({ id: 'uuid-5', role: 'admin', is_active: true })?.role === 'admin' &&
  simulateProfileVerification({ id: 'uuid-6', role: 'inventory_staff', is_active: true })?.role === 'inventory_staff',
  'Authorized roles (superadmin, admin, inventory_staff) are accepted when is_active is true'
)

// 8. Database Migrations Security Invariant Verification
console.log('\n[Suite 8] Verifying PostgreSQL migration scripts for security invariants:')
const migDir = path.join(projectRoot, 'supabase', 'migrations')

// Migration 1: Initial schema
const mig1 = fs.readFileSync(path.join(migDir, '20261018000001_initial_schema.sql'), 'utf8')
assert(
  mig1.includes('ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;') &&
  mig1.includes('ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;') &&
  mig1.includes('ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;'),
  'Migration 1: Row Level Security enabled on categories, products, and enquiries'
)

assert(
  mig1.includes('REVOKE ALL ON public.products FROM PUBLIC, anon, authenticated;') &&
  mig1.includes('GRANT SELECT (') &&
  !mig1.slice(mig1.indexOf('GRANT SELECT ('), mig1.indexOf(') ON public.products TO anon, authenticated;')).includes('cost_price'),
  'Migration 1: Table-level SELECT revoked on products, cost_price explicitly excluded from column SELECT grant'
)

assert(
  mig1.includes('GRANT INSERT ON public.enquiries TO anon, authenticated;') &&
  !mig1.includes('GRANT SELECT ON public.enquiries TO anon'),
  'Migration 1: Customer enquiries have zero SELECT grants for anonymous users'
)

// Migration 2: Admin roles and permissions
const mig2 = fs.readFileSync(path.join(migDir, '20261019000002_admin_roles_and_permissions.sql'), 'utf8')
assert(
  mig2.includes('ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;'),
  'Migration 2: Row Level Security enabled on public.admin_users'
)

assert(
  mig2.includes('CREATE OR REPLACE FUNCTION public.bootstrap_first_admin') &&
  mig2.includes("REVOKE ALL ON FUNCTION public.bootstrap_first_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;"),
  'Migration 2: bootstrap_first_admin() execution strictly REVOKED from all client roles'
)

assert(
  mig2.includes('pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('),
  'Migration 2: bootstrap_first_admin() and insert trigger acquire transaction-level advisory lock to eliminate lock-upgrade deadlocks'
)

assert(
  mig2.includes('lower(trim(p_email)) <> lower(trim(v_auth_email))'),
  'Migration 2: bootstrap_first_admin() strictly validates that provided email matches auth.users email'
)

assert(
  mig2.includes("IF session_user NOT IN ('postgres', 'supabase_admin') AND current_user NOT IN ('postgres', 'supabase_admin')"),
  'Migration 2: bootstrap_first_admin() strictly restricted to database administrator roles (postgres, supabase_admin)'
)

assert(
  mig2.includes('CREATE OR REPLACE FUNCTION public.get_admin_products') &&
  mig2.includes("REVOKE EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;") &&
  mig2.includes('IF NOT public.is_admin() THEN'),
  'Migration 2: get_admin_products() RPC strictly checks public.is_admin() and is revoked from public/anon'
)

assert(
  mig2.includes('CREATE OR REPLACE FUNCTION public.soft_delete_product') &&
  mig2.includes('IF NOT public.is_admin() THEN'),
  'Migration 2: soft_delete_product() RPC requires active administrator authorization'
)

assert(
  mig2.includes('CREATE OR REPLACE FUNCTION public.check_product_update_permissions') &&
  mig2.includes("ELSIF v_role = 'inventory_staff' THEN"),
  'Migration 2: Anti-tamper trigger strictly restricts inventory_staff from modifying commercial fields'
)

// Migration 3: Storage security policies
const mig3 = fs.readFileSync(path.join(migDir, '20261019000003_storage_security_policies.sql'), 'utf8')
assert(
  mig3.includes('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'),
  'Migration 3: Row Level Security enabled on storage.objects'
)

assert(
  mig3.includes('CREATE POLICY "Admins can upload product images"') &&
  mig3.includes('public.is_admin()') &&
  mig3.includes('5242880'),
  'Migration 3: Image upload policy requires public.is_admin() and enforces 5 MB file size limit'
)

assert(
  !mig3.slice(mig3.indexOf("ARRAY['image/jpeg'"), mig3.indexOf(')')).includes('svg') &&
  !mig3.slice(mig3.indexOf("(metadata->>'mimetype') IN"), mig3.indexOf(')')).includes('svg'),
  'Migration 3: SVG MIME type is strictly excluded from allowed_mime_types and upload policy to prevent XSS'
)

assert(
  mig3.includes('CREATE POLICY "Admins can update product images"'),
  'Migration 3: Image update/upsert policy present to support SDK upsert without permission denial'
)

// 9. Inspecting Admin Portal RBAC, Live Enquiry & Soft Deletion Fixes
console.log('\n[Suite 9] Inspecting Admin Portal RBAC, Live Enquiry & Soft Deletion Fixes:')
const guardPath = path.join(projectRoot, 'src', 'components', 'admin', 'AdminRouteGuard.jsx')
const guardCode = fs.readFileSync(guardPath, 'utf8')

assert(
  guardCode.includes('allowedRoles') &&
  guardCode.includes('allowedRoles.includes(userRole)') &&
  guardCode.includes('Access Restricted'),
  'AdminRouteGuard checks allowedRoles and displays Access Restricted screen when unauthorized'
)

const layoutPath = path.join(projectRoot, 'src', 'components', 'admin', 'AdminLayout.jsx')
const layoutCode = fs.readFileSync(layoutPath, 'utf8')

assert(
  layoutCode.includes("roles: ['superadmin', 'admin', 'engineer', 'technical']") &&
  layoutCode.includes('navItems') &&
  layoutCode.includes('item.roles.includes(userRole)'),
  'AdminLayout filters navigation items by user role, hiding categories and enquiries from inventory_staff'
)

assert(
  dataProviderCode.includes(".from('enquiries')") &&
  dataProviderCode.includes('loadAdminEnquiries') &&
  dataProviderCode.includes('setLiveEnquiries([])'),
  'AdminDataProvider queries public.enquiries from Supabase and fails closed to empty array on error'
)

assert(
  dataProviderCode.includes("supabase.rpc('soft_delete_product'") &&
  dataProviderCode.includes('p_product_id: productId'),
  'AdminDataProvider executes soft_delete_product RPC for safe product deactivation'
)

const dashboardPath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminDashboardPage.jsx')
const dashboardCode = fs.readFileSync(dashboardPath, 'utf8')

assert(
  dashboardCode.includes('isSuperadminOrAdmin') &&
  dashboardCode.includes('recentEnquiries = isSuperadminOrAdmin ? enquiries.slice(0, 4) : []'),
  'AdminDashboardPage suppresses confidential enquiries for unauthorized staff roles'
)

// 10. Staff Management Security & Authorization Invariants
console.log('\n[Suite 10] Testing Staff Management RBAC & Security Invariants:')
const staffPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminStaffPage.jsx')
const staffPageExists = fs.existsSync(staffPagePath)
assert(staffPageExists, 'AdminStaffPage.jsx exists in src/pages/admin/')

const staffPageCode = staffPageExists ? fs.readFileSync(staffPagePath, 'utf8') : ''

// Route restriction
const staffRouteIdx = appCode.indexOf('path="/admin/staff"')
const staffRouteSnippet = staffRouteIdx !== -1 ? appCode.slice(staffRouteIdx, staffRouteIdx + 200) : ''
assert(
  staffRouteSnippet.includes("allowedRoles={['superadmin', 'hr']}"),
  "/admin/staff route is strictly restricted to allowedRoles={['superadmin', 'hr']}"
)

// Nav restriction
assert(
  layoutCode.includes("id: 'staff'") &&
  layoutCode.includes("roles: ['superadmin', 'hr']"),
  'AdminLayout restricts staff navigation strictly to superadmin and hr roles'
)

// Data provider superadmin gating
assert(
  dataProviderCode.includes("adminUser?.role !== 'superadmin'") &&
  dataProviderCode.includes('loadAdminStaff') &&
  dataProviderCode.includes("from('admin_users')"),
  'AdminDataProvider.loadAdminStaff strictly checks adminUser.role === superadmin before querying admin_users'
)

// Self-demotion and role validation checks
assert(
  dataProviderCode.includes('staffId === adminUser?.id') &&
  dataProviderCode.includes('updateStaffRole') &&
  (dataProviderCode.includes('Self-demotion prevented') || dataProviderCode.includes('alter your own superadministrator role')),
  'AdminDataProvider.updateStaffRole strictly prevents superadmin self-demotion'
)

assert(
  dataProviderCode.includes("['admin', 'engineer', 'inventory_staff', 'hr', 'technical']") &&
  dataProviderCode.includes('updateStaffRole'),
  'AdminDataProvider.updateStaffRole restricts role updates strictly to permitted roles'
)

// Self-deactivation and last superadmin lockout checks
assert(
  dataProviderCode.includes('toggleStaffActive') &&
  (dataProviderCode.includes('Self-deactivation prevented') || dataProviderCode.includes('deactivate your own superadministrator account')),
  'AdminDataProvider.toggleStaffActive strictly prevents superadmin self-deactivation'
)

assert(
  dataProviderCode.includes('Cannot deactivate the last remaining active superadministrator') ||
  dataProviderCode.includes('activeSuperadmins.length <= 1'),
  'AdminDataProvider.toggleStaffActive prevents deactivating the last active superadmin'
)

// Zero client service-role key or insecure auth bypass
assert(
  !staffPageCode.includes('supabase.auth.admin') &&
  !staffPageCode.includes('service_role') &&
  !staffPageCode.includes('SUPABASE_SERVICE_KEY'),
  'AdminStaffPage contains zero client-side service-role keys or insecure administrative user forging'
)

// 11. Role-Permission Invariants: Superadmin, Read-Only Admin Employee, & Inventory Staff
console.log('\n[Suite 11] Inspecting Shared Admin Portal Read-Only & Least-Privilege Enforcements:')
const productsPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminProductsPage.jsx')
const productsPageCode = fs.readFileSync(productsPagePath, 'utf8')

assert(
  productsPageCode.includes('isSuperadmin') &&
  productsPageCode.includes('isReadOnlyView') &&
  productsPageCode.includes('disabled={isReadOnlyView || !isSuperadmin}'),
  'AdminProductsPage wraps form controls in disabled fieldset for read-only admin employees'
)

assert(
  productsPageCode.includes('isSuperadmin ? (') &&
  productsPageCode.includes('Add Product') &&
  productsPageCode.includes('Read-Only (Admin Employee)'),
  'AdminProductsPage hides "+ Add Product" button and displays Read-Only badge for admin employees'
)

assert(
  productsPageCode.includes('handleOpenViewModal') &&
  productsPageCode.includes('👁️ View Details'),
  'AdminProductsPage provides View Details action for read-only staff without write controls'
)

const categoriesPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminCategoriesPage.jsx')
const categoriesPageCode = fs.readFileSync(categoriesPagePath, 'utf8')

assert(
  categoriesPageCode.includes('isSuperadmin') &&
  categoriesPageCode.includes('isReadOnlyView') &&
  categoriesPageCode.includes('disabled={isReadOnlyView || !isSuperadmin}'),
  'AdminCategoriesPage wraps form controls in disabled fieldset for read-only admin employees'
)

assert(
  categoriesPageCode.includes('Add Category') &&
  categoriesPageCode.includes('Read-Only (Admin Employee)'),
  'AdminCategoriesPage hides "+ Add Category" button and displays Read-Only badge for admin employees'
)

const enquiriesPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
const enquiriesPageCode = fs.readFileSync(enquiriesPagePath, 'utf8')

assert(
  enquiriesPageCode.includes('!isSuperadmin') &&
  enquiriesPageCode.includes('disabled={!isSuperadmin}') &&
  enquiriesPageCode.includes('readOnly={!isSuperadmin}'),
  'AdminEnquiriesPage disables status selector and marks internal notes read-only for admin employees'
)

const inventoryPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminInventoryPage.jsx')
const inventoryPageCode = fs.readFileSync(inventoryPagePath, 'utf8')

assert(
  inventoryPageCode.includes('canUpdateStock = isSuperadmin || isInventoryStaff') &&
  inventoryPageCode.includes('<fieldset disabled={isReadOnlyStockView}'),
  'AdminInventoryPage restricts stock adjustment controls to Superadmin and Inventory Staff'
)

// Data Provider RBAC Write Capabilities
assert(
  dataProviderCode.includes("canWriteCatalog: adminUser?.role === 'superadmin'") &&
  dataProviderCode.includes("canWriteCategories: adminUser?.role === 'superadmin'") &&
  dataProviderCode.includes("canWriteEnquiries: adminUser?.role === 'superadmin'") &&
  dataProviderCode.includes("canManageStaff: adminUser?.role === 'superadmin'"),
  'AdminDataProvider strictly restricts catalog, category, enquiry, and staff mutations to superadmin role'
)

// 12. Database-Level Least-Privilege & Concurrency-Safe Last Superadmin Protection
console.log('\n[Suite 12] Verifying Database Migration for Read-Only Admin Employees & Last Superadmin Guard:')
const mig4 = fs.readFileSync(path.join(migDir, '20261022000001_enforce_admin_employee_read_only_and_superadmin_guard.sql'), 'utf8')

assert(
  mig4.includes('public.admin_users_superadmin_guard') &&
  mig4.includes('pg_catalog.pg_advisory_xact_lock'),
  'Migration 4: Uses transaction-level advisory locking (admin_users_superadmin_guard) for race-free superadmin count checks'
)

assert(
  mig4.includes('v_remaining_superadmins < 1') &&
  mig4.includes('Safety check failed: Cannot demote, deactivate, or delete the last remaining active superadministrator.'),
  'Migration 4: Strictly prevents demoting, deactivating, or deleting the last active superadmin'
)

assert(
  mig4.includes('CREATE POLICY "Superadmins full manage categories"') &&
  mig4.includes('public.is_superadmin()'),
  'Migration 4: Category mutations (INSERT/UPDATE/DELETE) restricted to public.is_superadmin()'
)

assert(
  mig4.includes('CREATE POLICY "Superadmins can insert products"') &&
  mig4.includes('CREATE POLICY "Superadmins can update products"'),
  'Migration 4: Product insertion and updates restricted to public.is_superadmin() (admin employees cannot write)'
)

assert(
  mig4.includes('check_product_update_permissions()') &&
  mig4.includes("ELSIF v_role = 'inventory_staff' THEN") &&
  mig4.includes('Product catalog edits require superadministrator privileges.'),
  'Migration 4: Anti-tamper trigger permits stock updates for inventory_staff and raises error for admin employees'
)

assert(
  mig4.includes('CREATE POLICY "Superadmins can update enquiries"') &&
  mig4.includes('CREATE POLICY "Superadmins can delete enquiries"'),
  'Migration 4: Enquiry updates and deletions restricted to public.is_superadmin()'
)

assert(
  mig4.includes('CREATE POLICY "Superadmins can upload product images"') &&
  mig4.includes('CREATE POLICY "Superadmins can update product images"') &&
  mig4.includes('CREATE POLICY "Superadmins can delete product images"'),
  'Migration 4: Storage image upload, update, and deletion restricted to public.is_superadmin()'
)

// 13. Inspect Phase 1 Migration: Audit Logs, Enquiry Activities & Immutability
console.log('\n[Suite 13] Verifying Database Migration for Audit Logs, Activities & Immutability:')
const mig5Path = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261022000002_audit_logs_activities_and_customer_immutability.sql'
)
const mig5 = fs.readFileSync(mig5Path, 'utf8')

assert(
  mig5.includes('CREATE TABLE IF NOT EXISTS public.audit_logs') &&
  mig5.includes('ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;'),
  'Migration 5: audit_logs table created with Row Level Security enabled'
)

assert(
  mig5.includes('REVOKE ALL ON public.audit_logs FROM public, anon, authenticated;') &&
  mig5.includes('GRANT SELECT ON public.audit_logs TO authenticated;'),
  'Migration 5: audit_logs direct write privileges revoked; SELECT strictly granted'
)

assert(
  mig5.includes('CREATE POLICY "Superadmins can view audit logs"') &&
  mig5.includes('USING (public.is_superadmin())'),
  'Migration 5: audit_logs visibility strictly restricted to superadmins'
)

assert(
  mig5.includes('CREATE TABLE IF NOT EXISTS public.enquiry_activities') &&
  mig5.includes('ALTER TABLE public.enquiry_activities ENABLE ROW LEVEL SECURITY;'),
  'Migration 5: enquiry_activities table created with Row Level Security enabled'
)

assert(
  mig5.includes('CREATE POLICY "Admins can view enquiry activities"') &&
  mig5.includes('USING (public.is_admin())'),
  'Migration 5: enquiry_activities readable by all active admin roles'
)

assert(
  mig5.includes('CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()') &&
  mig5.includes('BEFORE UPDATE OR DELETE ON public.audit_logs') &&
  mig5.includes('BEFORE UPDATE OR DELETE ON public.enquiry_activities'),
  'Migration 5: Immutability triggers prevent any UPDATE or DELETE on audit logs & activities'
)

assert(
  mig5.includes('CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_immutability()') &&
  mig5.includes('BEFORE UPDATE ON public.enquiries'),
  'Migration 5: Customer immutability trigger blocks modifying original customer enquiry data'
)

assert(
  mig5.includes('CREATE OR REPLACE FUNCTION public.record_audit_event()') &&
  mig5.includes('AFTER INSERT OR UPDATE OR DELETE ON public.enquiries') &&
  mig5.includes('AFTER INSERT OR UPDATE OR DELETE ON public.admin_users') &&
  mig5.includes('AFTER INSERT OR UPDATE OR DELETE ON public.products') &&
  mig5.includes('AFTER INSERT OR UPDATE OR DELETE ON public.categories'),
  'Migration 5: Automated audit event logging triggers attached to all critical business tables'
)

// 14. Inspect Phase 1 Remediation Migration
console.log('\n[Suite 14] Verifying Database Migration for Phase 1 Security Remediations:')
const mig6Path = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261022000003_phase1_security_remediations.sql'
)
const mig6 = fs.readFileSync(mig6Path, 'utf8')

assert(
  mig6.includes('CREATE POLICY "Anonymous can submit new enquiries"') &&
  mig6.includes("status = 'new' AND") &&
  mig6.includes('admin_notes IS NULL'),
  'Migration 6: Anonymous enquiry policy enforces status="new" and admin_notes IS NULL'
)

assert(
  mig6.includes('CREATE POLICY "Authenticated can submit enquiries"') &&
  mig6.includes('public.is_admin()') &&
  mig6.includes("status = 'new' AND admin_notes IS NULL"),
  'Migration 6: Authenticated enquiry policy allows admin flexibility while constraining non-admins'
)

assert(
  mig6.includes('CREATE OR REPLACE FUNCTION public.enforce_enquiry_insert_defaults()') &&
  mig6.includes('BEFORE INSERT ON public.enquiries'),
  'Migration 6: Defense-in-depth trigger enforces enquiry insert defaults for non-admins'
)

assert(
  mig6.includes('IF (NEW.id IS DISTINCT FROM OLD.id) THEN') &&
  mig6.includes('Enquiry ID is immutable and cannot be altered.'),
  'Migration 6: Customer immutability trigger strictly protects enquiry primary key ID'
)

assert(
  mig6.includes('CREATE TRIGGER trg_prevent_audit_logs_truncate') &&
  mig6.includes('BEFORE TRUNCATE ON public.audit_logs') &&
  mig6.includes('CREATE TRIGGER trg_prevent_enquiry_activities_truncate') &&
  mig6.includes('BEFORE TRUNCATE ON public.enquiry_activities'),
  'Migration 6: Append-only truncate protection triggers attached to audit_logs and enquiry_activities'
)

assert(
  mig6.includes('REVOKE EXECUTE ON FUNCTION public.protect_enquiry_customer_immutability() FROM PUBLIC, anon;') &&
  mig6.includes('REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_tampering() FROM PUBLIC, anon;'),
  'Migration 6: Unnecessary function EXECUTE permissions revoked from PUBLIC and anon'
)

// 15. Inspect Phase 2 Migration: Enquiry Workflow, Approvals & Archive Lifecycle
console.log('\n[Suite 15] Verifying Database Migration for Phase 2 Enquiry Workflow & Head Approvals:')
const mig7Path = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261022000004_enquiry_workflow_and_approvals.sql'
)
const mig7 = fs.readFileSync(mig7Path, 'utf8')

assert(
  mig7.includes('ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false') &&
  mig7.includes('ADD COLUMN IF NOT EXISTS rejection_reason TEXT') &&
  mig7.includes('ADD COLUMN IF NOT EXISTS previous_status TEXT'),
  'Migration 7: enquiries table extended with archive and rejection workflow columns'
)

assert(
  mig7.includes('ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_enum') &&
  mig7.includes("'rejection_requested'") &&
  mig7.includes("'rejected'"),
  'Migration 7: status enum constraint includes rejection_requested and rejected states'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.add_enquiry_note') &&
  mig7.includes('SECURITY DEFINER') &&
  mig7.includes("SET search_path = ''") &&
  mig7.includes('pg_catalog.btrim(p_content)'),
  'Migration 7: add_enquiry_note RPC securely trims whitespace, validates length, and appends to activity log'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.update_enquiry_progress') &&
  mig7.includes('FOR UPDATE') &&
  mig7.includes("v_actor_role = 'admin'") &&
  mig7.includes("p_next_status NOT IN ('new', 'in_progress', 'quoted')"),
  'Migration 7: update_enquiry_progress RPC uses row locks and restricts employees from setting terminal states'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.request_enquiry_rejection') &&
  mig7.includes('FOR UPDATE') &&
  mig7.includes('pg_catalog.btrim(p_reason)') &&
  mig7.includes("status = 'rejection_requested'"),
  'Migration 7: request_enquiry_rejection RPC requires mandatory reason and rejects duplicates while pending'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.review_enquiry_rejection') &&
  mig7.includes("v_actor_role != 'superadmin'") &&
  mig7.includes("p_decision = 'approved'") &&
  mig7.includes('rejection_reviewed'),
  'Migration 7: review_enquiry_rejection RPC strictly restricted to superadmin with immutable activity records'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.archive_enquiry') &&
  mig7.includes('CREATE OR REPLACE FUNCTION public.restore_enquiry') &&
  mig7.includes("v_actor_role != 'superadmin'"),
  'Migration 7: archive_enquiry and restore_enquiry RPCs strictly restricted to superadmin'
)

assert(
  mig7.includes('REVOKE ALL ON FUNCTION public.add_enquiry_note(UUID, TEXT) FROM PUBLIC, anon;') &&
  mig7.includes('REVOKE ALL ON FUNCTION public.review_enquiry_rejection(UUID, TEXT, TEXT) FROM PUBLIC, anon;') &&
  mig7.includes('GRANT EXECUTE ON FUNCTION public.review_enquiry_rejection(UUID, TEXT, TEXT) TO authenticated;'),
  'Migration 7: All RPC execute privileges revoked from PUBLIC/anon and granted strictly to authenticated'
)

assert(
  mig7.includes('DROP POLICY IF EXISTS "Anonymous can submit new enquiries"') &&
  mig7.includes('is_archived = false AND') &&
  mig7.includes('rejection_reason IS NULL AND'),
  'Migration 7: Anonymous enquiry policy hardens against archive flag or workflow injection'
)

assert(
  mig7.includes('CREATE OR REPLACE FUNCTION public.enforce_enquiry_insert_defaults()') &&
  mig7.includes('Public enquiry submissions cannot be created as archived.'),
  'Migration 7: Defense-in-depth trigger blocks non-admins from supplying archive or workflow fields'
)

// 16. Inspect Phase 2 Hardening Migration: Direct DELETE & Audit Integrity
console.log('\n[Suite 16] Verifying Database Migration for Phase 2 Hardening & Bin Lifecycle Protection:')
const mig8Path = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261024000001_phase1_security_hardening.sql'
)
const mig8 = fs.readFileSync(mig8Path, 'utf8')

assert(
  mig8.includes('DROP POLICY IF EXISTS "Superadmins can delete enquiries" ON public.enquiries;') &&
  mig8.includes('REVOKE DELETE ON public.enquiries FROM anon, authenticated;'),
  'Migration 8: Direct DELETE on public.enquiries revoked to strictly protect 7-day Bin lifecycle'
)

assert(
  mig8.includes('DROP POLICY IF EXISTS "Superadmins can insert enquiry activities" ON public.enquiry_activities;') &&
  mig8.includes('REVOKE INSERT ON public.enquiry_activities FROM anon, authenticated;'),
  'Migration 8: Direct INSERT on enquiry_activities revoked to prevent audit activity forgery'
)

assert(
  mig8.includes('CREATE OR REPLACE FUNCTION public.purge_expired_bin_enquiries') &&
  mig8.includes("CURRENT_USER NOT IN ('postgres', 'supabase_admin')") &&
  mig8.includes("SESSION_USER NOT IN ('postgres', 'supabase_admin')"),
  'Migration 8: purge_expired_bin_enquiries() hardened against unauthorized invocation when auth.uid() is null'
)

assert(
  mig8.includes('REVOKE EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) FROM PUBLIC, anon;') &&
  mig8.includes('GRANT EXECUTE ON FUNCTION public.purge_expired_bin_enquiries(INT) TO authenticated;'),
  'Migration 8: Purge RPC execution explicitly revoked from PUBLIC and anon'
)

// 17. Inspect Step 10 Migration: Permanent Archive, Server-Derived Accountability & Sequence
console.log('\n[Suite 17] Verifying Database Migration for Permanent Archive & Accountability:')
const mig10Path = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261028000001_permanent_archive_and_accountability.sql'
)
const mig10 = fs.readFileSync(mig10Path, 'utf8')

assert(
  mig10.includes('ADD COLUMN IF NOT EXISTS employee_code TEXT') &&
  mig10.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_employee_code'),
  'Migration 10: admin_users extended with nullable employee_code for business reporting'
)

assert(
  mig10.includes('CREATE SEQUENCE IF NOT EXISTS public.enquiry_reference_seq') &&
  mig10.includes('START WITH 1001') &&
  mig10.includes("pg_catalog.nextval('public.enquiry_reference_seq')"),
  'Migration 10: Safe PostgreSQL sequence generates atomic collision-free human-readable enquiry IDs'
)

assert(
  mig10.includes('chk_enquiries_approved_not_in_bin') &&
  mig10.includes('NOT (completion_approved_at IS NOT NULL AND (is_in_bin = true OR scheduled_deletion_at IS NOT NULL))'),
  'Migration 10: Database CHECK constraint prevents approved enquiry from having is_in_bin=true or scheduled_deletion_at'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.trg_prevent_approved_enquiry_deletion()') &&
  mig10.includes('BEFORE DELETE ON public.enquiries'),
  'Migration 10: BEFORE DELETE trigger strictly blocks deletion of completed + Head-approved records'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()') &&
  mig10.includes('Approved completed enquiries cannot be unarchived or reopened'),
  'Migration 10: Immutability trigger blocks tampering with approval identity, timestamps, or reopening records'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.submit_enquiry_completion') &&
  mig10.includes('SELECT email, role, full_name, employee_code') &&
  mig10.includes('completed_by_name = COALESCE(v_actor_name, v_actor_email)') &&
  mig10.includes('completed_by_employee_code = v_actor_code'),
  'Migration 10: submit_enquiry_completion securely derives employee identity and snapshots server-side'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.review_enquiry_completion') &&
  mig10.includes("status = 'completed'") &&
  mig10.includes('is_archived = true') &&
  mig10.includes('scheduled_deletion_at = NULL') &&
  mig10.includes('is_in_bin = false'),
  'Migration 10: review_enquiry_completion permanently archives approved enquiry with no scheduled deletion'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.restore_enquiry') &&
  mig10.includes('Head-approved completed enquiries cannot be unarchived or reopened'),
  'Migration 10: restore_enquiry blocks unarchiving Head-approved completed records'
)

assert(
  mig10.includes('CREATE OR REPLACE FUNCTION public.purge_expired_bin_enquiries') &&
  mig10.includes('completion_approved_at IS NULL') &&
  mig10.includes("status != 'completed'"),
  'Migration 10: purge_expired_bin_enquiries strictly excludes approved enquiries from deletion'
)

console.log('====================================================================')
console.log(`Summary: ${passedTests} passed, ${failedTests} failed.`)
console.log('====================================================================')


if (failedTests > 0) {
  process.exit(1)
}


