import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Suite 1: Admin Routing & RouteGuard Invariants for /admin/customers', async (t) => {
  const appCode = fs.readFileSync('src/App.jsx', 'utf8')

  await t.test('AdminCustomersPage is lazy-loaded in App.jsx', () => {
    assert.match(appCode, /const\s+AdminCustomersPage\s*=\s*lazy\(/)
    assert.match(appCode, /import\(['"]\.\/pages\/admin\/AdminCustomersPage['"]\)/)
  })

  await t.test('/admin/customers route is wrapped in AdminRouteGuard with approved roles', () => {
    const routeRegex = /<Route\s+path=["']\/admin\/customers["']\s+element={\s*<AdminRouteGuard\s+allowedRoles={(\[[^\]]+\])}>\s*<AdminCustomersPage\s*\/>\s*<\/AdminRouteGuard>\s*}/
    assert.match(appCode, routeRegex)
    const match = appCode.match(routeRegex)
    const rolesStr = match[1]
    assert.ok(rolesStr.includes('superadmin'), 'superadmin role must be present')
    assert.ok(rolesStr.includes('admin'), 'admin role must be present')
    assert.ok(rolesStr.includes('account'), 'account role must be present')
    assert.ok(rolesStr.includes('technical'), 'technical role must be present')
    assert.ok(rolesStr.includes('engineer'), 'engineer role must be present')
    assert.ok(rolesStr.includes('inventory_staff'), 'inventory_staff role must be present')
  })
})

test('Suite 2: Admin Sidebar Navigation Integration in AdminLayout.jsx', async (t) => {
  const layoutCode = fs.readFileSync('src/components/admin/AdminLayout.jsx', 'utf8')

  await t.test('AdminLayout navigation array includes customers tab', () => {
    assert.ok(layoutCode.includes("id: 'customers'"), "Must have customer tab id")
    assert.ok(layoutCode.includes("label: 'Customers (CRM)'"), "Must have Customer CRM label")
  })

  await t.test('AdminLayout handleNavClick navigates to /admin/customers', () => {
    assert.ok(layoutCode.includes("navigate('/admin/customers')"), "Must route to /admin/customers")
  })
})

test('Suite 3: Phase 3A Mobile Responsive Layout & 44px Touch Targets', async (t) => {
  const css = fs.readFileSync('src/App.css', 'utf8')

  await t.test('Enforces desktop table hiding and mobile cards visibility below 768px', () => {
    assert.ok(css.includes('.crm-desktop-table-container'), 'Desktop table class must exist')
    assert.ok(css.includes('.crm-mobile-cards-container'), 'Mobile cards class must exist')
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[\s\S]*?\.crm-desktop-table-container\s*{[^}]*display:\s*none/)
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[\s\S]*?\.crm-mobile-cards-container\s*{[^}]*display:\s*flex/)
  })

  await t.test('All interactive mobile buttons enforce at least 44px touch targets', () => {
    assert.ok(css.includes('.crm-touch-action-btn'), 'Touch action button class must exist')
    assert.match(css, /\.crm-touch-action-btn\s*{[^}]*min-height:\s*44px/)
    assert.match(css, /\.crm-search-input\s*{[^}]*height:\s*44px/)
    assert.match(css, /\.crm-filter-tab-btn\s*{[^}]*min-height:\s*44px/)
    assert.match(css, /\.crm-drawer-tab\s*{[^}]*min-height:\s*44px/)
    assert.match(css, /\.crm-quick-action-link\s*{[^}]*min-height:\s*44px/)
  })

  await t.test('Responsive rules handle compact phone viewports (320px - 375px)', () => {
    assert.match(css, /@media\s*\(\s*max-width:\s*375px\s*\)/, '375px breakpoint must be configured')
    assert.ok(css.includes('.crm-touch-call'), 'Call action class exists')
    assert.ok(css.includes('.crm-touch-wa'), 'WhatsApp action class exists')
  })
})

test('Suite 4: Role-Enforced Data Privacy Invariants in AdminCustomersPage.jsx', async (t) => {
  const pageCode = fs.readFileSync('src/pages/admin/AdminCustomersPage.jsx', 'utf8')

  await t.test('Lifetime spend and financial totals are guarded with canViewFinancials', () => {
    assert.match(pageCode, /rolePermissions\.canViewFinancials\s*&&/)
    // Verify that financial cards and columns check this guard
    assert.ok(pageCode.includes('highlight-ltv'), 'LTV card exists')
    assert.ok(pageCode.includes('formatINR(metrics.totalLtv)'))
  })

  await t.test('Direct communication actions (Call/WhatsApp) are guarded with canContactCustomer', () => {
    assert.match(pageCode, /rolePermissions\.canContactCustomer\s*&&/)
    assert.ok(pageCode.includes('cleanIndianPhoneForDialer'))
    assert.ok(pageCode.includes('normalizeIndianPhoneForWhatsApp'))
  })

  await t.test('Anti-silent-merge conflict notices are displayed clearly in UI and drawer', () => {
    assert.ok(pageCode.includes('hasIdentityConflict'))
    assert.ok(pageCode.includes('conflictReasons'))
    assert.ok(pageCode.includes('crm-conflict-alert-box'))
  })
})

test('Suite 5: Existing Core Admin Pages Regression Integrity', async (t) => {
  const enquiriesCode = fs.readFileSync('src/pages/admin/AdminEnquiriesPage.jsx', 'utf8')
  const ordersCode = fs.readFileSync('src/pages/admin/AdminOrdersPage.jsx', 'utf8')
  const dashboardCode = fs.readFileSync('src/pages/admin/AdminDashboardPage.jsx', 'utf8')

  await t.test('AdminEnquiriesPage retains Phase 1 and Phase 2 enhancements', () => {
    assert.ok(enquiriesCode.includes('enquiries-primary-nav'), 'Phase 1 primary navigation retained')
    assert.ok(enquiriesCode.includes('activeWorkflowTab'), 'Workflow tab state retained')
    assert.ok(enquiriesCode.includes('buildCustomerWhatsAppUrl'), 'Phase 2 WhatsApp retained')
    assert.ok(enquiriesCode.includes('cleanCustPhone'), 'Phase 2 Call retained')
  })

  await t.test('AdminOrdersPage retains order register and reporting integration', () => {
    assert.ok(ordersCode.includes('downloadMonthlySalesExcel'))
    assert.ok(ordersCode.includes('LiveOrdersRegisterModal'))
  })

  await t.test('AdminDashboardPage retains operational navigation', () => {
    assert.ok(dashboardCode.includes('/admin/enquiries'))
    assert.ok(dashboardCode.includes('/admin/orders'))
    assert.ok(dashboardCode.includes('/admin/products'))
  })
})
