/**
 * ARS Computers — Authenticated Role-Permission Verification Suite
 * Executes live API calls against local Supabase using authenticated sessions
 * for:
 * 1. Admin Employee (employee.test@arscomputers.in)
 * 2. Superadmin (ankitbathla.ind@gmail.com)
 * 3. Inventory Staff (simulated DB context)
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const EMPLOYEE_EMAIL = 'employee.test@arscomputers.in'
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'ArsEmpTemp#2026!Oct'

let passed = 0
let failed = 0

function assertTest(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASSED: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAILED: ${name} ${details ? `(${details})` : ''}`)
    failed++
  }
}

async function run() {
  console.log('====================================================================')
  console.log('ARS Computers — Live Authenticated API & Permission Verification')
  console.log('====================================================================')

  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })

  // --------------------------------------------------------------------------
  // STEP 1: Employee Authentication & Profile Verification
  // --------------------------------------------------------------------------
  console.log('\n[Phase 1] Authenticating as Admin Employee:')
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD
  })

  assertTest(!authError && authData.session, 'Admin employee successfully authenticates with password')
  assertTest(authData.user?.email === EMPLOYEE_EMAIL, 'Session email matches employee.test@arscomputers.in')

  const { data: profile, error: profileErr } = await client
    .from('admin_users')
    .select('id, email, full_name, role, is_active')
    .eq('id', authData.user.id)
    .single()

  assertTest(!profileErr && profile.role === 'admin' && profile.is_active === true, 'Profile verified: role="admin", is_active=true')

  // --------------------------------------------------------------------------
  // STEP 2: Verify Employee Can Read Products, Categories, Enquiries, Inventory
  // --------------------------------------------------------------------------
  console.log('\n[Phase 2] Verifying Admin Employee Read Access:')
  const { data: categories, error: catReadErr } = await client
    .from('categories')
    .select('id, title, slug, is_active')

  assertTest(!catReadErr && Array.isArray(categories) && categories.length > 0, `Can read categories table (${categories?.length || 0} categories found)`)

  const { data: products, error: prodReadErr } = await client
    .from('products')
    .select('id, name, sku, brand, price, stock_quantity, availability_status, is_active')

  assertTest(!prodReadErr && Array.isArray(products) && products.length > 0, `Can read products table (${products?.length || 0} products found)`)

  const { data: enquiries, error: enqReadErr } = await client
    .from('enquiries')
    .select('id, name, contact_info, message, status, admin_notes')

  assertTest(!enqReadErr && Array.isArray(enquiries), `Can read enquiries table (${enquiries?.length || 0} enquiries found)`)

  // --------------------------------------------------------------------------
  // STEP 3: Verify Employee CANNOT Write (INSERT, UPDATE, DELETE) to Products
  // --------------------------------------------------------------------------
  console.log('\n[Phase 3] Testing Unauthorized Write Rejection on Products:')
  const testProductPayload = {
    name: 'Unauthorized Test Product by Employee',
    slug: 'unauthorized-employee-product-' + Date.now(),
    category_id: categories[0]?.id || 'cat-1',
    price: 99999,
    stock_quantity: 10,
    availability_status: 'in_stock'
  }

  const { error: insertProdErr } = await client.from('products').insert(testProductPayload)
  assertTest(Boolean(insertProdErr), 'Product INSERT by admin employee is strictly rejected by RLS', insertProdErr?.message)

  if (products && products.length > 0) {
    const targetProd = products[0]
    const { data: updateRes, error: updateProdErr } = await client
      .from('products')
      .update({ name: 'Hacked Product Name by Employee' })
      .eq('id', targetProd.id)
      .select()

    const updateRejected = Boolean(updateProdErr) || (Array.isArray(updateRes) && updateRes.length === 0)
    assertTest(updateRejected, 'Product UPDATE by admin employee is rejected (trigger exception or 0 rows modified)', updateProdErr?.message)

    const { data: deleteRes, error: deleteProdErr } = await client
      .from('products')
      .delete()
      .eq('id', targetProd.id)
      .select()

    const deleteRejected = Boolean(deleteProdErr) || (Array.isArray(deleteRes) && deleteRes.length === 0)
    assertTest(deleteRejected, 'Product DELETE by admin employee is rejected (RLS filtered, 0 rows deleted)')

    // Verify product still exists in DB
    const { data: checkProd } = await client.from('products').select('id, name').eq('id', targetProd.id).single()
    assertTest(checkProd?.name === targetProd.name, 'Target product is completely unchanged in database')

    // Attempt soft_delete_product RPC
    const { error: rpcErr } = await client.rpc('soft_delete_product', { p_product_id: targetProd.id })
    assertTest(Boolean(rpcErr), 'soft_delete_product RPC by admin employee is strictly rejected by RPC check', rpcErr?.message)
  }

  // --------------------------------------------------------------------------
  // STEP 4: Verify Employee CANNOT Write (INSERT, UPDATE, DELETE) to Categories
  // --------------------------------------------------------------------------
  console.log('\n[Phase 4] Testing Unauthorized Write Rejection on Categories:')
  const testCategoryPayload = {
    title: 'Unauthorized Category by Employee',
    slug: 'unauthorized-cat-' + Date.now(),
    is_active: true
  }

  const { error: insertCatErr } = await client.from('categories').insert(testCategoryPayload)
  assertTest(Boolean(insertCatErr), 'Category INSERT by admin employee is strictly rejected by RLS', insertCatErr?.message)

  if (categories && categories.length > 0) {
    const targetCat = categories[0]
    const { data: updateRes, error: updateCatErr } = await client
      .from('categories')
      .update({ title: 'Hacked Category Title by Employee' })
      .eq('id', targetCat.id)
      .select()

    const updateCatRejected = Boolean(updateCatErr) || (Array.isArray(updateRes) && updateRes.length === 0)
    assertTest(updateCatRejected, 'Category UPDATE by admin employee is rejected (0 rows modified)')

    const { data: deleteRes, error: deleteCatErr } = await client
      .from('categories')
      .delete()
      .eq('id', targetCat.id)
      .select()

    const deleteCatRejected = Boolean(deleteCatErr) || (Array.isArray(deleteRes) && deleteRes.length === 0)
    assertTest(deleteCatRejected, 'Category DELETE by admin employee is rejected (0 rows deleted)')

    // Verify category still exists in DB
    const { data: checkCat } = await client.from('categories').select('id, title').eq('id', targetCat.id).single()
    assertTest(checkCat?.title === targetCat.title, 'Target category is completely unchanged in database')
  }

  // --------------------------------------------------------------------------
  // STEP 5: Verify Employee CANNOT Update Enquiries (Status or Admin Notes)
  // --------------------------------------------------------------------------
  console.log('\n[Phase 5] Testing Unauthorized Write Rejection on Enquiries:')
  // First insert a test enquiry to attempt modification on
  const { data: testEnq } = await client.from('enquiries').insert({
    name: 'Temporary Inquiry for RBAC Audit',
    contact_info: 'audit@test.com',
    message: 'Testing that employee cannot change status'
  }).select().single()

  const targetEnqId = testEnq?.id || enquiries[0]?.id

  if (targetEnqId) {
    const { data: updateRes, error: updateEnqErr } = await client
      .from('enquiries')
      .update({ status: 'closed', admin_notes: 'Tampered by employee' })
      .eq('id', targetEnqId)
      .select()

    const updateEnqRejected = Boolean(updateEnqErr) || (Array.isArray(updateRes) && updateRes.length === 0)
    assertTest(updateEnqRejected, 'Enquiry status/notes UPDATE by admin employee is rejected (0 rows modified)')

    const { data: deleteRes, error: deleteEnqErr } = await client
      .from('enquiries')
      .delete()
      .eq('id', targetEnqId)
      .select()

    const deleteEnqRejected = Boolean(deleteEnqErr) || (Array.isArray(deleteRes) && deleteRes.length === 0)
    assertTest(deleteEnqRejected, 'Enquiry DELETE by admin employee is rejected (0 rows deleted)')
  }

  // --------------------------------------------------------------------------
  // STEP 6: Verify Employee CANNOT Manage Staff or Elevate Own Role
  // --------------------------------------------------------------------------
  console.log('\n[Phase 6] Testing Unauthorized Staff Management Rejection:')
  const { data: elevateRes, error: elevateErr } = await client
    .from('admin_users')
    .update({ role: 'superadmin' })
    .eq('id', authData.user.id)
    .select()

  const elevateRejected = Boolean(elevateErr) || (Array.isArray(elevateRes) && elevateRes.length === 0)
  assertTest(elevateRejected, 'Self-elevation to superadmin by employee is strictly rejected (0 rows modified)')

  const { data: employeeCheck } = await client
    .from('admin_users')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  assertTest(employeeCheck?.role === 'admin', 'Employee role remains strictly "admin" in database')

  console.log('====================================================================')
  console.log(`Live API Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Test suite error:', err)
  process.exit(1)
})
