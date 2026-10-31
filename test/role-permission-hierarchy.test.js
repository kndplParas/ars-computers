import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * ============================================================================
 * ARS Computers — Final Role Permission Hierarchy & Engineer Parity Test Suite
 * ============================================================================
 * Verifies exact 7-role permission levels across frontend guards,
 * AdminLayout navigation, AdminDataProvider methods, Supabase RPCs, and RLS:
 *
 * 1. Head Admin / Superadmin — Full control.
 * 2. Admin — Existing Admin permissions unchanged.
 * 3. Technical — EXACTLY Engineer permissions.
 * 4. Engineer — Existing Engineer permissions.
 * 5. HR — EXACTLY Engineer permissions.
 * 6. Accounts — EXACTLY Engineer permissions.
 * 7. Inventory Staff — Existing restricted permissions unchanged.
 * ============================================================================
 */

const appJsxPath = path.resolve('src/App.jsx')
const layoutPath = path.resolve('src/components/admin/AdminLayout.jsx')
const providerPath = path.resolve('src/context/AdminDataProvider.jsx')
const enquiriesPagePath = path.resolve('src/pages/admin/AdminEnquiriesPage.jsx')
const migration12Path = path.resolve('supabase/migrations/20261031000012_final_role_permission_hierarchy.sql')

const appJsx = fs.readFileSync(appJsxPath, 'utf8')
const layout = fs.readFileSync(layoutPath, 'utf8')
const provider = fs.readFileSync(providerPath, 'utf8')
const enquiriesPage = fs.readFileSync(enquiriesPagePath, 'utf8')
const migration12 = fs.readFileSync(migration12Path, 'utf8')

function parseRolesArray(str) {
  return str
    .replace(/[[\]']/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

test('Role Permission Hierarchy & Exact Parity Suite', async (t) => {
  // --------------------------------------------------------------------------
  // 1. ROUTE GUARD AUDIT: Exact Role Parity across App.jsx
  // --------------------------------------------------------------------------
  await t.test('1. Frontend Route Guards implement exact role permissions', () => {
    const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{\s*<AdminRouteGuard allowedRoles=\{([^}]+)\}>/g
    const routes = {}
    let match
    while ((match = routeRegex.exec(appJsx)) !== null) {
      const routePath = match[1]
      routes[routePath] = parseRolesArray(match[2])
    }

    // Verify /admin/staff is strictly Superadmin only
    assert.deepEqual(routes['/admin/staff'], ['superadmin'], 'Staff Management route must be Superadmin ONLY')

    // Verify /admin/inventory is Superadmin and inventory_staff only
    assert.deepEqual(routes['/admin/inventory'], ['superadmin', 'inventory_staff'], 'Inventory route must be superadmin and inventory_staff only')

    // Verify /admin/enquiries
    assert.ok(routes['/admin/enquiries'].includes('superadmin'), 'Enquiries allows superadmin')
    assert.ok(routes['/admin/enquiries'].includes('admin'), 'Enquiries allows admin')
    assert.ok(routes['/admin/enquiries'].includes('technical'), 'Enquiries allows technical (Engineer parity)')
    assert.ok(routes['/admin/enquiries'].includes('engineer'), 'Enquiries allows engineer')
    assert.ok(routes['/admin/enquiries'].includes('hr'), 'Enquiries allows hr (Engineer parity)')
    assert.ok(routes['/admin/enquiries'].includes('account'), 'Enquiries allows account (Engineer parity)')
    assert.ok(!routes['/admin/enquiries'].includes('inventory_staff'), 'Enquiries strictly blocks inventory_staff')

    // Verify /admin/orders
    assert.ok(routes['/admin/orders'].includes('superadmin'), 'Orders allows superadmin')
    assert.ok(routes['/admin/orders'].includes('admin'), 'Orders allows admin')
    assert.ok(routes['/admin/orders'].includes('technical'), 'Orders allows technical (Engineer parity)')
    assert.ok(routes['/admin/orders'].includes('engineer'), 'Orders allows engineer')
    assert.ok(routes['/admin/orders'].includes('hr'), 'Orders allows hr (Engineer parity)')
    assert.ok(routes['/admin/orders'].includes('account'), 'Orders allows account (Engineer parity)')
    assert.ok(routes['/admin/orders'].includes('inventory_staff'), 'Orders allows inventory_staff')

    // Verify /admin/categories
    assert.ok(routes['/admin/categories'].includes('superadmin'), 'Categories allows superadmin')
    assert.ok(routes['/admin/categories'].includes('admin'), 'Categories allows admin')
    assert.ok(routes['/admin/categories'].includes('technical'), 'Categories allows technical (Engineer parity)')
    assert.ok(routes['/admin/categories'].includes('engineer'), 'Categories allows engineer')
    assert.ok(routes['/admin/categories'].includes('hr'), 'Categories allows hr (Engineer parity)')
    assert.ok(routes['/admin/categories'].includes('account'), 'Categories allows account (Engineer parity)')
    assert.ok(!routes['/admin/categories'].includes('inventory_staff'), 'Categories strictly blocks inventory_staff')

    // Verify /admin/products
    assert.ok(routes['/admin/products'].includes('superadmin'), 'Products allows superadmin')
    assert.ok(routes['/admin/products'].includes('admin'), 'Products allows admin')
    assert.ok(routes['/admin/products'].includes('technical'), 'Products allows technical (Engineer parity)')
    assert.ok(routes['/admin/products'].includes('engineer'), 'Products allows engineer')
    assert.ok(routes['/admin/products'].includes('hr'), 'Products allows hr (Engineer parity)')
    assert.ok(routes['/admin/products'].includes('account'), 'Products allows account (Engineer parity)')
    assert.ok(routes['/admin/products'].includes('inventory_staff'), 'Products allows inventory_staff')
  })

  // --------------------------------------------------------------------------
  // 2. PARITY COMPARISON: HR vs Engineer
  // --------------------------------------------------------------------------
  await t.test('2. HR vs Engineer: EXACT route & navigation parity', () => {
    const navRegex = /{\s*id:\s*'([^']+)'[\s\S]*?roles:\s*(\[[^\]]+\])\s*}/g
    const navItems = {}
    let match
    while ((match = navRegex.exec(layout)) !== null) {
      navItems[match[1]] = parseRolesArray(match[2])
    }

    for (const [moduleName, allowedRoles] of Object.entries(navItems)) {
      const engineerAllowed = allowedRoles.includes('engineer')
      const hrAllowed = allowedRoles.includes('hr')
      assert.equal(
        hrAllowed,
        engineerAllowed,
        `HR must have identical navigation visibility to Engineer for "${moduleName}". Engineer: ${engineerAllowed}, HR: ${hrAllowed}`
      )
    }

    assert.ok(!navItems.staff.includes('hr'), 'HR must NOT have access to Staff Management in navigation')
    assert.ok(!navItems.inventory.includes('hr'), 'HR must NOT have access to Inventory in navigation')
  })

  // --------------------------------------------------------------------------
  // 3. PARITY COMPARISON: Accounts vs Engineer
  // --------------------------------------------------------------------------
  await t.test('3. Accounts vs Engineer: EXACT route & navigation parity', () => {
    const navRegex = /{\s*id:\s*'([^']+)'[\s\S]*?roles:\s*(\[[^\]]+\])\s*}/g
    const navItems = {}
    let match
    while ((match = navRegex.exec(layout)) !== null) {
      navItems[match[1]] = parseRolesArray(match[2])
    }

    for (const [moduleName, allowedRoles] of Object.entries(navItems)) {
      const engineerAllowed = allowedRoles.includes('engineer')
      const accountAllowed = allowedRoles.includes('account')
      assert.equal(
        accountAllowed,
        engineerAllowed,
        `Accounts must have identical navigation visibility to Engineer for "${moduleName}". Engineer: ${engineerAllowed}, Account: ${accountAllowed}`
      )
    }

    assert.ok(!navItems.staff.includes('account'), 'Accounts must NOT have access to Staff Management')
    assert.ok(!navItems.inventory.includes('account'), 'Accounts must NOT have access to Inventory')
  })

  // --------------------------------------------------------------------------
  // 4. PARITY COMPARISON: Technical vs Engineer (EXACT ENGINEER PARITY)
  // --------------------------------------------------------------------------
  await t.test('4. Technical vs Engineer: EXACT route, navigation & action parity', () => {
    const navRegex = /{\s*id:\s*'([^']+)'[\s\S]*?roles:\s*(\[[^\]]+\])\s*}/g
    const navItems = {}
    let match
    while ((match = navRegex.exec(layout)) !== null) {
      navItems[match[1]] = parseRolesArray(match[2])
    }

    for (const [moduleName, allowedRoles] of Object.entries(navItems)) {
      const engineerAllowed = allowedRoles.includes('engineer')
      const technicalAllowed = allowedRoles.includes('technical')
      assert.equal(
        technicalAllowed,
        engineerAllowed,
        `Technical must have identical navigation visibility to Engineer for "${moduleName}". Engineer: ${engineerAllowed}, Technical: ${technicalAllowed}`
      )
    }

    // Both Engineer and Technical are denied Head-only staff management & inventory
    assert.ok(!navItems.staff.includes('technical'), 'Technical must not have access to staff management')
    assert.ok(!navItems.inventory.includes('technical'), 'Technical must not have access to inventory')

    // In AdminDataProvider, Technical is in isEngineer and NOT in isAdminEmployee
    assert.match(provider, /isAdminEmployee:\s*adminUser\?\.role === 'admin'/, 'isAdminEmployee must be Admin ONLY')
    assert.match(provider, /isEngineer:\s*\['engineer', 'technical', 'hr', 'account'\]\.includes\(adminUser\?\.role\)/, 'isEngineer must include technical, hr, account')
  })

  // --------------------------------------------------------------------------
  // 5. TECHNICAL/HR/ACCOUNTS VS HEAD: Blocked from all Head-only controls
  // --------------------------------------------------------------------------
  await t.test('5. Non-superadmin roles are denied all Head-only controls', () => {
    // In AdminDataProvider, Head-only methods require superadmin
    assert.match(provider, /canManageStaff:\s*adminUser\?\.role === 'superadmin'/, 'canManageStaff must be superadmin ONLY')
    assert.match(provider, /canWriteCatalog:\s*adminUser\?\.role === 'superadmin'/, 'canWriteCatalog must be superadmin ONLY')
    assert.match(provider, /canWriteCategories:\s*adminUser\?\.role === 'superadmin'/, 'canWriteCategories must be superadmin ONLY')

    // Check assignEnquiryEmployee: superadmin only
    assert.match(provider, /assignEnquiryEmployee[\s\S]*?adminUser\?\.role !== 'superadmin'/, 'assignEnquiryEmployee requires superadmin')

    // Check reviewEnquiryCompletion: superadmin only
    assert.match(provider, /reviewEnquiryCompletion[\s\S]*?adminUser\?\.role !== 'superadmin'/, 'reviewEnquiryCompletion requires superadmin')

    // Check cancelSalesOrder: superadmin only
    assert.match(provider, /cancelSalesOrder[\s\S]*?adminUser\?\.role !== 'superadmin'/, 'cancelSalesOrder requires superadmin')

    // Check updateStaffProfile: superadmin only
    assert.match(provider, /updateStaffProfile[\s\S]*?adminUser\?\.role !== 'superadmin'/, 'updateStaffProfile requires superadmin')
  })

  // --------------------------------------------------------------------------
  // 6. INVENTORY STAFF: Restrictions preserved
  // --------------------------------------------------------------------------
  await t.test('6. Inventory Staff: Restrictions strictly preserved', () => {
    const navRegex = /{\s*id:\s*'([^']+)'[\s\S]*?roles:\s*(\[[^\]]+\])\s*}/g
    const navItems = {}
    let match
    while ((match = navRegex.exec(layout)) !== null) {
      navItems[match[1]] = parseRolesArray(match[2])
    }

    assert.ok(navItems.inventory.includes('inventory_staff'), 'Inventory staff has inventory')
    assert.ok(navItems.products.includes('inventory_staff'), 'Inventory staff has products read-only')
    assert.ok(navItems.orders.includes('inventory_staff'), 'Inventory staff has orders fulfillment')
    assert.ok(!navItems.enquiries.includes('inventory_staff'), 'Inventory staff DENIED enquiries')
    assert.ok(!navItems.categories.includes('inventory_staff'), 'Inventory staff DENIED categories')
    assert.ok(!navItems.staff.includes('inventory_staff'), 'Inventory staff DENIED staff management')
  })

  // --------------------------------------------------------------------------
  // 7. ENQUIRIES PAGE: isEmployee includes technical, engineer, hr, account
  // --------------------------------------------------------------------------
  await t.test('7. AdminEnquiriesPage isEmployee includes technical, engineer, hr, account', () => {
    assert.match(
      enquiriesPage,
      /const isEmployee = \['admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(adminUser\?\.role\)/,
      'isEmployee must include admin, technical, engineer, hr, and account'
    )
  })

  // --------------------------------------------------------------------------
  // 8. DATABASE MIGRATION AUDIT: RPCs & RLS Policies
  // --------------------------------------------------------------------------
  await t.test('8. Database migration enforces exact permission hierarchy in Postgres', () => {
    // 1. is_admin() includes operational roles
    assert.match(
      migration12,
      /public\.get_staff_role\(\) IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'is_admin() must return true for operational roles'
    )

    // 2. is_engineer() includes technical, engineer, hr, account
    assert.match(
      migration12,
      /public\.get_staff_role\(\) IN \('superadmin', 'engineer', 'technical', 'hr', 'account'\)/,
      'is_engineer() must return true for engineer, technical, hr, and account'
    )

    // 3. is_technical() includes superadmin, technical (no admin)
    assert.match(
      migration12,
      /public\.get_staff_role\(\) IN \('superadmin', 'technical'\)/,
      'is_technical() must return true for technical and superadmin'
    )

    // 4. public.admin_users RLS policy revokes HR and restricts viewing all profiles to superadmin
    assert.match(
      migration12,
      /DROP POLICY IF EXISTS "Superadmins and HR can view all admin profiles" ON public\.admin_users;/,
      'Must drop Superadmins and HR policy'
    )
    assert.match(
      migration12,
      /CREATE POLICY "Superadmins can view all admin profiles"[\s\S]*?ON public\.admin_users[\s\S]*?USING \(public\.is_superadmin\(\)\);/,
      'RLS policy must restrict viewing all admin profiles strictly to Superadmin'
    )

    // 5. update_staff_profile RPC restricts profile management strictly to superadmin
    assert.match(
      migration12,
      /IF NOT FOUND OR v_actor_role <> 'superadmin' THEN\s*RAISE EXCEPTION 'Access denied: Superadministrator privileges required to manage staff profiles\.'/,
      'update_staff_profile must reject non-superadmins including HR'
    )

    // 6. self_assign_enquiry allows operational roles
    assert.match(
      migration12,
      /v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'self_assign_enquiry permits operational staff roles'
    )

    // 7. assign_enquiry_employee head caller check
    assert.match(
      migration12,
      /IF NOT FOUND OR v_actor_role != 'superadmin' THEN\s*RAISE EXCEPTION 'Access denied: Superadministrator privileges required to assign, reassign, or unassign staff\.'/,
      'assign_enquiry_employee caller must be superadmin'
    )

    // 8. assign_enquiry_employee target staff check
    assert.match(
      migration12,
      /v_target_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'assign_enquiry_employee target staff permits all operational staff'
    )

    // 9. request_enquiry_service_completion permits operational roles
    assert.match(
      migration12,
      /v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'request_enquiry_service_completion permits operational staff'
    )

    // 10. Orders RPCs permit operational roles
    assert.match(
      migration12,
      /v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'Orders RPCs permit operational staff'
    )

    // 11. get_eligible_enquiry_assignees returns all 6 operational roles
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.get_eligible_enquiry_assignees[\s\S]*?au\.role IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'get_eligible_enquiry_assignees directory must return all 6 operational staff roles'
    )

    // 12. register_enquiry_service_proof permits operational roles
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.register_enquiry_service_proof[\s\S]*?v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'register_enquiry_service_proof must permit operational roles'
    )

    // 13. void_enquiry_service_proof permits operational roles and restricts employees to own proofs
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.void_enquiry_service_proof[\s\S]*?v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)[\s\S]*?v_proof\.uploaded_by IS DISTINCT FROM v_actor_id/,
      'void_enquiry_service_proof must permit operational roles and restrict non-superadmin to own proofs'
    )

    // 14. submit_enquiry_completion permits operational roles and checks assignment for non-superadmin
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.submit_enquiry_completion[\s\S]*?v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)[\s\S]*?v_enquiry\.assigned_employee_id IS DISTINCT FROM v_actor_id/,
      'submit_enquiry_completion must permit operational roles and check assignment for non-superadmin'
    )

    // 15. start_sales_order & submit_order_completion permit operational staff (inventory staff excluded)
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.start_sales_order[\s\S]*?v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'start_sales_order permits operational staff only (inventory staff excluded)'
    )
    assert.match(
      migration12,
      /CREATE OR REPLACE FUNCTION public\.submit_order_completion[\s\S]*?v_actor_role NOT IN \('superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\)/,
      'submit_order_completion permits operational staff only (inventory staff excluded)'
    )
  })

  // --------------------------------------------------------------------------
  // 9. ADMIN DATA PROVIDER & PAGE-LEVEL DEFENSE-IN-DEPTH CHECKS
  // --------------------------------------------------------------------------
  await t.test('9. AdminDataProvider and AdminStaffPage enforce strict defense-in-depth', () => {
    const staffPagePath = path.resolve('src/pages/admin/AdminStaffPage.jsx')
    const staffPage = fs.readFileSync(staffPagePath, 'utf8')

    // AdminStaffPage must redirect non-superadmins
    assert.match(
      staffPage,
      /if \(adminUser && adminUser\.role !== 'superadmin'\) \{\s*return <Navigate to="\/admin" replace \/>\s*\}/,
      'AdminStaffPage must redirect non-superadmin to /admin'
    )

    // AdminDataProvider updateStaffProfile is strictly Superadmin only
    assert.match(
      provider,
      /if \(adminUser\?\.role !== 'superadmin'\) \{\s*throw new Error\('Unauthorized: Only superadministrators can update staff profiles\.'\)\s*\}/,
      'updateStaffProfile in AdminDataProvider must be strictly superadmin only'
    )

    // AdminDataProvider operational order methods allow all 6 roles
    assert.match(
      provider,
      /if \(!\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(role\)\) \{\s*throw new Error\('Access denied: Active staff privileges required to create orders\.'\)/,
      'createSalesOrder must allow operational roles'
    )
    assert.match(
      provider,
      /if \(!\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(role\)\) \{\s*throw new Error\('Access denied: Active staff privileges required to record payments\.'\)/,
      'recordOrderPayment must allow operational roles'
    )
    assert.match(
      provider,
      /if \(!\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(role\)\) \{\s*throw new Error\('Access denied: Staff privileges required to upload order attachments\.'\)/,
      'uploadOrderAttachments must allow operational roles'
    )
    assert.match(
      provider,
      /if \(!\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(role\)\) \{\s*throw new Error\('Access denied: Staff privileges required to upload service proofs\.'\)/,
      'uploadEnquiryServiceProof must allow operational roles'
    )
    assert.match(
      provider,
      /if \(!\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(role\)\) \{\s*throw new Error\('Access denied: Staff privileges required to void service proofs\.'\)/,
      'voidEnquiryServiceProof must allow operational roles'
    )

    // startSalesOrder and submitOrderCompletion exclude inventory_staff
    assert.match(
      provider,
      /startSalesOrder[\s\S]*?!OPERATIONAL_ROLES\.includes\(role\)/,
      'startSalesOrder excludes inventory_staff'
    )
    assert.match(
      provider,
      /submitOrderCompletion[\s\S]*?!OPERATIONAL_ROLES\.includes\(role\)/,
      'submitOrderCompletion excludes inventory_staff'
    )
  })
})
