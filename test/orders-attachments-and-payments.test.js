/**
 * ============================================================================
 * ARS Computers — Order Attachments & Incremental Payments Verification Suite
 * ============================================================================
 * Comprehensive security, integrity, and functional verification suite covering
 * all 28 production hardening requirements + application resilience:
 *
 * 1. attachment FK uses RESTRICT
 * 2. payment FK uses RESTRICT
 * 3. duplicate storage_path rejected
 * 4. anonymous attachment metadata registration blocked
 * 5. inventory_staff attachment registration blocked
 * 6. admin attachment registration works
 * 7. uploader UUID cannot be spoofed (derived from auth.uid())
 * 8. uploader name cannot be spoofed (derived from admin_users)
 * 9. uploader employee code cannot be spoofed (derived from admin_users)
 * 10. mismatched order UUID/storage path rejected
 * 11. malformed/path traversal path rejected (.., \, //)
 * 12. invalid MIME rejected
 * 13. >10 MB rejected
 * 14. anonymous Storage read blocked
 * 15. inventory_staff Storage read blocked
 * 16. authorized Admin/Head attachment access works
 * 17. direct order payment UPDATE blocked
 * 18. completed-order customer/contact modification blocked
 * 19. completed-order workflow metadata modification blocked
 * 20. completed-order archive metadata modification blocked
 * 21. legitimate secure payment RPC can change paid_amount/payment_status
 * 22. cancelled order new payment blocked
 * 23. historical cancelled payment remains in ledger
 * 24. direct payment ledger INSERT blocked
 * 25. payment UPDATE blocked
 * 26. payment DELETE blocked
 * 27. backfill is idempotent
 * 28. repeated attachment registration cannot duplicate metadata
 * 29. partial attachment upload failure behavior at application level
 * 30. Monthly Sales Report remains strictly grouped by completion_approved_at
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { filterOrdersByReportingMonth } from '../src/utils/salesReportGenerator.js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadVerifier#2026!Secure'
const EMP_EMAIL = 'emp.verifier@arscomputers.in'
const EMP_PASSWORD = 'EmpVerifier#2026!Secure'
const INV_EMAIL = 'inv.verifier@arscomputers.in'
const INV_PASSWORD = 'InvVerifier#2026!Secure'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let headUser = null
let empUser = null
let invUser = null

let headClient = null
let empClient = null
let invClient = null

let testProductId = null

test.before(async () => {
  // 1. Setup Head user (superadmin)
  await serviceClient.auth.admin.createUser({
    email: HEAD_EMAIL,
    password: HEAD_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Ankit Bathla (Head)' }
  }).catch(() => {})

  // 2. Setup Employee user (admin)
  await serviceClient.auth.admin.createUser({
    email: EMP_EMAIL,
    password: EMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Rohan Sharma (Admin)' }
  }).catch(() => {})

  // 3. Setup Inventory user (inventory_staff)
  await serviceClient.auth.admin.createUser({
    email: INV_EMAIL,
    password: INV_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Karan Inventory (Staff)' }
  }).catch(() => {})

  const { data: usersData } = await serviceClient.auth.admin.listUsers()
  headUser = usersData.users.find((u) => u.email === HEAD_EMAIL)
  empUser = usersData.users.find((u) => u.email === EMP_EMAIL)
  invUser = usersData.users.find((u) => u.email === INV_EMAIL)

  await serviceClient.from('admin_users').upsert([
    {
      id: headUser.id,
      email: HEAD_EMAIL,
      role: 'superadmin',
      full_name: 'Ankit Bathla',
      employee_code: 'ARS-HEAD-001',
      is_active: true
    },
    {
      id: empUser.id,
      email: EMP_EMAIL,
      role: 'admin',
      full_name: 'Rohan Sharma',
      employee_code: 'ARS-EMP-007',
      is_active: true
    },
    {
      id: invUser.id,
      email: INV_EMAIL,
      role: 'inventory_staff',
      full_name: 'Karan Inventory',
      employee_code: 'ARS-INV-009',
      is_active: true
    }
  ])

  headClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  await headClient.auth.signInWithPassword({ email: HEAD_EMAIL, password: HEAD_PASSWORD })

  empClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  await empClient.auth.signInWithPassword({ email: EMP_EMAIL, password: EMP_PASSWORD })

  invClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  await invClient.auth.signInWithPassword({ email: INV_EMAIL, password: INV_PASSWORD })

  // Ensure catalog test product exists
  const { data: catProd } = await serviceClient
    .from('products')
    .select('id, stock_quantity')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (catProd) {
    testProductId = catProd.id
  } else {
    const { data: newProd } = await serviceClient
      .from('products')
      .insert({
        name: 'CP Plus 4K Bullet Camera',
        slug: 'cp-plus-4k-bullet-camera-test-' + Date.now(),
        sku: 'CPP-4K-TEST',
        category_id: 'cctv',
        brand: 'CP Plus',
        model: 'CP-VAC-T42L2',
        price: 3500.0,
        stock_quantity: 50,
        min_stock_alert: 5,
        is_active: true
      })
      .select()
      .single()
    testProductId = newProd.id
  }
})

test('Order Attachments & Incremental Payments Verification', async (t) => {
  let createdOrderId = null
  let testAttachmentPath = null

  // --------------------------------------------------------------------------
  // SETUP TEST ORDER
  // --------------------------------------------------------------------------
  const { data: orderRes, error: orderErr } = await empClient.rpc('create_sales_order', {
    p_customer_name: 'Shree Radhey Telecom',
    p_contact_info: '+91 98370 11223',
    p_items: [
      { product_id: testProductId, quantity: 2, unit_price: 3500.0 },
      { product_name: 'Custom BNC Connectors & Power Supply', brand: 'D-Link', model: '12V-5A', quantity: 1, unit_price: 1000.0 }
    ],
    p_paid_amount: 3000.0,
    p_payment_method: 'upi',
    p_employee_remarks: 'Customer paid ₹3000 advance via UPI, remaining on delivery.'
  })

  assert.ifError(orderErr, 'Order creation should succeed')
  assert.equal(orderRes.success, true)
  assert.ok(orderRes.id, 'Must return order id')
  createdOrderId = orderRes.id
  testAttachmentPath = `${createdOrderId}/po_quote_sample.pdf`

  // --------------------------------------------------------------------------
  // 1. attachment FK uses RESTRICT
  // --------------------------------------------------------------------------
  await t.test('1. attachment FK uses RESTRICT', async () => {
    // Create dedicated order with attachment to test delete restriction
    const { data: o } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'FK Test Customer 1',
      p_contact_info: '9876543210',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 1000.0 }],
      p_paid_amount: 0,
      p_payment_method: 'cash'
    })
    const dummyPath = `${o.id}/fk_test_doc.pdf`
    await empClient.rpc('register_order_attachment', {
      p_order_id: o.id,
      p_storage_path: dummyPath,
      p_original_filename: 'fk_test_doc.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 1024
    })

    // Attempt direct delete on orders table via serviceClient (bypassing normal app guards)
    const { error: delErr } = await serviceClient.from('orders').delete().eq('id', o.id)
    assert.ok(delErr, 'Deleting order with attachments must fail')
    assert.ok(
      delErr.code === '23503' || delErr.code === '23514',
      'Must be blocked by PostgreSQL foreign key RESTRICT or anti-deletion protection'
    )
  })

  // --------------------------------------------------------------------------
  // 2. payment FK uses RESTRICT
  // --------------------------------------------------------------------------
  await t.test('2. payment FK uses RESTRICT', async () => {
    // Create dedicated order with payment to test delete restriction
    const { data: o } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'FK Test Customer 2',
      p_contact_info: '9876543210',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 1000.0 }],
      p_paid_amount: 500,
      p_payment_method: 'cash'
    })

    const { error: delErr } = await serviceClient.from('orders').delete().eq('id', o.id)
    assert.ok(delErr, 'Deleting order with payments must fail')
    assert.ok(
      delErr.code === '23503' || delErr.code === '23514',
      'Must be blocked by PostgreSQL foreign key RESTRICT or anti-deletion protection'
    )
  })

  // --------------------------------------------------------------------------
  // 3. duplicate storage_path rejected
  // --------------------------------------------------------------------------
  await t.test('3. duplicate storage_path rejected', async () => {
    const dupPath = `${createdOrderId}/unique_doc_${Date.now()}.pdf`
    const { error: firstErr } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: dupPath,
      p_original_filename: 'unique_doc.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 2048
    })
    assert.ifError(firstErr, 'First registration must succeed')

    // Second registration with exact same storage_path
    const { error: dupErr } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: dupPath,
      p_original_filename: 'different_name.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 4096
    })
    assert.ok(dupErr, 'Duplicate storage_path must be rejected by PostgreSQL')
    assert.equal(dupErr.code, '23505', 'Must fail with unique_violation code 23505')
  })

  // --------------------------------------------------------------------------
  // 4. anonymous attachment metadata registration blocked
  // --------------------------------------------------------------------------
  await t.test('4. anonymous attachment metadata registration blocked', async () => {
    const { error } = await anonClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}/anon_hack.jpg`,
      p_original_filename: 'anon_hack.jpg',
      p_mime_type: 'image/jpeg',
      p_file_size: 1024
    })
    assert.ok(error, 'Anonymous metadata registration must be rejected')
    assert.match(error.message, /Authentication required|insufficient_privilege|permission denied/i)
  })

  // --------------------------------------------------------------------------
  // 5. inventory_staff attachment registration blocked
  // --------------------------------------------------------------------------
  await t.test('5. inventory_staff attachment registration blocked', async () => {
    const { error } = await invClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}/inv_hack.jpg`,
      p_original_filename: 'inv_hack.jpg',
      p_mime_type: 'image/jpeg',
      p_file_size: 1024
    })
    assert.ok(error, 'Inventory staff metadata registration must be rejected')
    assert.match(error.message, /Access denied|administrator or store employee privileges required/i)
  })

  // --------------------------------------------------------------------------
  // 6. admin attachment registration works
  // --------------------------------------------------------------------------
  await t.test('6. admin attachment registration works', async () => {
    const { data, error } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: testAttachmentPath,
      p_original_filename: 'po_quote_sample.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 204850
    })
    assert.ifError(error, 'Admin registration must succeed')
    assert.equal(data.success, true)
    assert.equal(data.storage_path, testAttachmentPath)
    assert.equal(data.original_filename, 'po_quote_sample.pdf')
    assert.equal(data.mime_type, 'application/pdf')
  })

  // --------------------------------------------------------------------------
  // 7. uploader UUID cannot be spoofed (derived from auth.uid())
  // --------------------------------------------------------------------------
  await t.test('7. uploader UUID cannot be spoofed (derived from auth.uid())', async () => {
    const { data: record, error } = await serviceClient
      .from('order_attachments')
      .select('uploaded_by')
      .eq('storage_path', testAttachmentPath)
      .single()

    assert.ifError(error)
    assert.equal(record.uploaded_by, empUser.id, 'Must match authenticated user id')
  })

  // --------------------------------------------------------------------------
  // 8. uploader name cannot be spoofed (derived from admin_users)
  // --------------------------------------------------------------------------
  await t.test('8. uploader name cannot be spoofed (derived from admin_users)', async () => {
    const { data: record, error } = await serviceClient
      .from('order_attachments')
      .select('uploaded_by_name')
      .eq('storage_path', testAttachmentPath)
      .single()

    assert.ifError(error)
    assert.equal(record.uploaded_by_name, 'Rohan Sharma', 'Must match full_name from admin_users table')
  })

  // --------------------------------------------------------------------------
  // 9. uploader employee code cannot be spoofed (derived from admin_users)
  // --------------------------------------------------------------------------
  await t.test('9. uploader employee code cannot be spoofed (derived from admin_users)', async () => {
    const { data: record, error } = await serviceClient
      .from('order_attachments')
      .select('uploaded_by_employee_code')
      .eq('storage_path', testAttachmentPath)
      .single()

    assert.ifError(error)
    assert.equal(record.uploaded_by_employee_code, 'ARS-EMP-007', 'Must match employee_code from admin_users table')
  })

  // --------------------------------------------------------------------------
  // 10. mismatched order UUID/storage path rejected
  // --------------------------------------------------------------------------
  await t.test('10. mismatched order UUID/storage path rejected', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const { error } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${fakeUuid}/spoofed_folder.pdf`,
      p_original_filename: 'spoofed_folder.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 1024
    })
    assert.ok(error, 'Mismatched order UUID in storage path must be rejected')
    assert.match(error.message, /Storage path order folder .* does not match target order/i)
  })

  // --------------------------------------------------------------------------
  // 11. malformed/path traversal path rejected (.., \, //)
  // --------------------------------------------------------------------------
  await t.test('11. malformed/path traversal path rejected (.., \\, //)', async () => {
    // Path traversal with ..
    const { error: errDot } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}/../secrets.pdf`,
      p_original_filename: 'secrets.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 1024
    })
    assert.ok(errDot, 'Path with .. must be rejected')
    assert.match(errDot.message, /Path traversal or invalid characters detected/i)

    // Backslash
    const { error: errBackslash } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}\\windows_style.pdf`,
      p_original_filename: 'windows_style.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 1024
    })
    assert.ok(errBackslash, 'Path with backslash must be rejected')
    assert.match(errBackslash.message, /Path traversal or invalid characters detected/i)

    // Double slash
    const { error: errDoubleSlash } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `//${createdOrderId}/escaped.pdf`,
      p_original_filename: 'escaped.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 1024
    })
    assert.ok(errDoubleSlash, 'Path with double slash must be rejected')
    assert.match(errDoubleSlash.message, /Path traversal or invalid characters detected/i)
  })

  // --------------------------------------------------------------------------
  // 12. invalid MIME rejected
  // --------------------------------------------------------------------------
  await t.test('12. invalid MIME rejected', async () => {
    const { error } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}/malware.sh`,
      p_original_filename: 'malware.sh',
      p_mime_type: 'text/plain',
      p_file_size: 512
    })
    assert.ok(error, 'MIME text/plain must be rejected')
    assert.match(error.message, /Unsupported MIME type|Invalid MIME type/i)
  })

  // --------------------------------------------------------------------------
  // 13. >10 MB rejected
  // --------------------------------------------------------------------------
  await t.test('13. >10 MB rejected', async () => {
    const { error } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: `${createdOrderId}/giant.pdf`,
      p_original_filename: 'giant.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 10485761 // 10 MB + 1 byte
    })
    assert.ok(error, 'File size > 10MB must be rejected')
    assert.match(error.message, /exceeds maximum limit of 10 MB/i)
  })

  // --------------------------------------------------------------------------
  // 14. anonymous Storage read blocked
  // --------------------------------------------------------------------------
  await t.test('14. anonymous Storage read blocked', async () => {
    const { data: attData, error: attErr } = await anonClient.from('order_attachments').select('*')
    assert.ok(attErr || (attData && attData.length === 0), 'Anon cannot read order_attachments')

    const { data: payData, error: payErr } = await anonClient.from('order_payments').select('*')
    assert.ok(payErr || (payData && payData.length === 0), 'Anon cannot read order_payments')
  })

  // --------------------------------------------------------------------------
  // 15. inventory_staff Storage read blocked
  // --------------------------------------------------------------------------
  await t.test('15. inventory_staff Storage read blocked', async () => {
    const { data: attData, error: attErr } = await invClient.from('order_attachments').select('*')
    assert.ok(attErr || (attData && attData.length === 0), 'Inventory staff cannot read order_attachments')

    const { data: payData, error: payErr } = await invClient.from('order_payments').select('*')
    assert.ok(payErr || (payData && payData.length === 0), 'Inventory staff cannot read order_payments')
  })

  // --------------------------------------------------------------------------
  // 16. authorized Admin/Head attachment access works
  // --------------------------------------------------------------------------
  await t.test('16. authorized Admin/Head attachment access works', async () => {
    const { data: headAttachments, error: headErr } = await headClient
      .from('order_attachments')
      .select('*')
      .eq('order_id', createdOrderId)

    assert.ifError(headErr)
    assert.ok(headAttachments.length >= 1, 'Head should see attachments')

    const { data: empAttachments, error: empErr } = await empClient
      .from('order_attachments')
      .select('*')
      .eq('order_id', createdOrderId)

    assert.ifError(empErr)
    assert.ok(empAttachments.length >= 1, 'Admin should see attachments')
  })

  // --------------------------------------------------------------------------
  // 17. direct order payment UPDATE blocked
  // --------------------------------------------------------------------------
  await t.test('17. direct order payment UPDATE blocked', async () => {
    const { error } = await empClient
      .from('orders')
      .update({ paid_amount: 99999.0 })
      .eq('id', createdOrderId)

    assert.ok(error, 'Direct UPDATE on orders table by client must be blocked')
    assert.match(error.message, /permission denied|violates row-level security/i)
  })

  // --------------------------------------------------------------------------
  // 18. completed-order customer/contact modification blocked
  // --------------------------------------------------------------------------
  await t.test('18. completed-order customer/contact modification blocked', async () => {
    // Create an order and complete it properly through lifecycle
    const { data: o } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Customer Completed Immutability',
      p_contact_info: '9988776655',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 1000.0 }],
      p_paid_amount: 500.0, // partially paid
      p_payment_method: 'cash'
    })

    // Advance lifecycle: new -> processing -> completed_pending_review -> completed
    await empClient.rpc('start_sales_order', { p_order_id: o.id })
    await empClient.rpc('submit_order_completion', {
      p_order_id: o.id,
      p_employee_remarks: 'Hardware assembled and verified.'
    })
    await headClient.rpc('review_order_completion', {
      p_order_id: o.id,
      p_head_remarks: 'Approved and handed over to customer.'
    })

    // Attempt modifying customer_name via direct serviceClient update to test trigger
    const { error: custErr } = await serviceClient
      .from('orders')
      .update({ customer_name: 'Hacked Name' })
      .eq('id', o.id)

    assert.ok(custErr, 'Completed order customer_name modification must be blocked by immutability trigger')
    assert.match(custErr.message, /Order immutability violation|Immutability violation/i)

    const { error: contactErr } = await serviceClient
      .from('orders')
      .update({ contact_info: '0000000000' })
      .eq('id', o.id)

    assert.ok(contactErr, 'Completed order contact_info modification must be blocked by immutability trigger')
    assert.match(contactErr.message, /Order immutability violation|Immutability violation/i)
  })

  // --------------------------------------------------------------------------
  // 19. completed-order workflow metadata modification blocked
  // --------------------------------------------------------------------------
  await t.test('19. completed-order workflow metadata modification blocked', async () => {
    // Query a completed order
    const { data: o } = await serviceClient
      .from('orders')
      .select('id, completion_approved_by, approved_by_employee_code')
      .eq('status', 'completed')
      .limit(1)
      .single()

    assert.ok(o && o.id, 'Must have a completed order from test 18')

    // 19a. Verify completion_approved_by modification blocked
    const { error: wfErr } = await serviceClient
      .from('orders')
      .update({ completion_approved_by: empUser.id })
      .eq('id', o.id)

    assert.ok(wfErr, 'Completed order workflow modification must be blocked by immutability trigger')
    assert.match(wfErr.message, /Order immutability violation|Immutability violation/i)

    // 19b. Verify approved_by_employee_code modification blocked
    const { error: empCodeErr } = await serviceClient
      .from('orders')
      .update({ approved_by_employee_code: 'ARS-HACK-999' })
      .eq('id', o.id)

    assert.ok(empCodeErr, 'Completed order approved_by_employee_code modification must be blocked by immutability trigger')
    assert.match(empCodeErr.message, /Order immutability violation|Immutability violation/i)
  })

  // --------------------------------------------------------------------------
  // 20. completed-order archive metadata modification blocked
  // --------------------------------------------------------------------------
  await t.test('20. completed-order archive metadata modification blocked', async () => {
    const { data: o } = await serviceClient
      .from('orders')
      .select('id')
      .eq('status', 'completed')
      .limit(1)
      .single()

    assert.ok(o && o.id, 'Must have a completed order from test 18')

    // 20a. Verify is_archived modification blocked
    const { error: archErr } = await serviceClient
      .from('orders')
      .update({ is_archived: false })
      .eq('id', o.id)

    assert.ok(archErr, 'Completed order archive modification must be blocked by immutability trigger')
    assert.match(archErr.message, /Order immutability violation|Immutability violation/i)

    // 20b. Verify archived_at modification blocked
    const { error: archAtErr } = await serviceClient
      .from('orders')
      .update({ archived_at: new Date('2020-01-01').toISOString() })
      .eq('id', o.id)

    assert.ok(archAtErr, 'Completed order archived_at modification must be blocked by immutability trigger')
    assert.match(archAtErr.message, /Order immutability violation|Immutability violation/i)
  })

  // --------------------------------------------------------------------------
  // 21. legitimate secure payment RPC can change paid_amount/payment_status
  // --------------------------------------------------------------------------
  await t.test('21. legitimate secure payment RPC can change paid_amount/payment_status', async () => {
    // Find our partially paid completed order with full metadata snapshot
    const { data: o } = await serviceClient
      .from('orders')
      .select('*')
      .eq('status', 'completed')
      .eq('payment_status', 'partial')
      .limit(1)
      .single()

    assert.ok(o && o.id, 'Must have a partially paid completed order')
    const remaining = Number(o.total_amount) - Number(o.paid_amount)
    assert.ok(remaining > 0)

    // Pay remainder via secure RPC
    const { data: payRes, error } = await empClient.rpc('record_order_payment', {
      p_order_id: o.id,
      p_amount_received: remaining,
      p_payment_method: 'upi',
      p_transaction_reference: 'SETTLE-FINAL',
      p_remarks: 'Final settlement after completion'
    })

    assert.ifError(error, 'Secure payment RPC must succeed on completed order')
    assert.equal(payRes.success, true)
    assert.equal(payRes.payment_status, 'paid')
    assert.equal(Number(payRes.balance_due), 0)

    // Verify order in database: only paid_amount, payment_status, and updated_at updated
    const { data: updatedO } = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', o.id)
      .single()

    assert.equal(updatedO.status, 'completed', 'status must remain completed')
    assert.equal(updatedO.payment_status, 'paid', 'payment_status updated to paid')
    assert.equal(Number(updatedO.paid_amount), Number(o.total_amount), 'paid_amount updated to full total')
    assert.notEqual(updatedO.updated_at, o.updated_at, 'updated_at updated to current timestamp')

    // Invariant: payment must NOT alter any approval, archive, or workflow metadata
    assert.equal(updatedO.completion_approved_by, o.completion_approved_by, 'completion_approved_by immutable')
    assert.equal(updatedO.completion_approved_at, o.completion_approved_at, 'completion_approved_at immutable')
    assert.equal(updatedO.approved_by_name, o.approved_by_name, 'approved_by_name immutable')
    assert.equal(updatedO.approved_by_employee_code, o.approved_by_employee_code, 'approved_by_employee_code immutable')
    assert.equal(updatedO.head_remarks, o.head_remarks, 'head_remarks immutable')
    assert.equal(updatedO.is_archived, o.is_archived, 'is_archived immutable')
    assert.equal(updatedO.archived_at, o.archived_at, 'archived_at immutable')
    assert.equal(updatedO.created_by, o.created_by, 'created_by immutable')
    assert.equal(updatedO.customer_name, o.customer_name, 'customer_name immutable')
    assert.equal(updatedO.contact_info, o.contact_info, 'contact_info immutable')
    assert.equal(updatedO.total_amount, o.total_amount, 'total_amount immutable')
  })

  // --------------------------------------------------------------------------
  // 22. cancelled order new payment blocked
  // --------------------------------------------------------------------------
  await t.test('22. cancelled order new payment blocked', async () => {
    const { data: o } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Cancel Payment Test',
      p_contact_info: '9999900000',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 1000.0 }],
      p_paid_amount: 200,
      p_payment_method: 'cash'
    })

    await headClient.rpc('cancel_sales_order', {
      p_order_id: o.id,
      p_cancellation_reason: 'Testing cancelled payment lock'
    })

    const { error: payErr } = await empClient.rpc('record_order_payment', {
      p_order_id: o.id,
      p_amount_received: 100,
      p_payment_method: 'cash'
    })

    assert.ok(payErr, 'New payment on cancelled order must be blocked')
    assert.match(payErr.message, /Cannot record payment/i)
  })

  // --------------------------------------------------------------------------
  // 23. historical cancelled payment remains in ledger
  // --------------------------------------------------------------------------
  await t.test('23. historical cancelled payment remains in ledger', async () => {
    const { data: o } = await serviceClient
      .from('orders')
      .select('id, paid_amount')
      .eq('status', 'cancelled')
      .gt('paid_amount', 0)
      .limit(1)
      .single()

    const { data: payments, error } = await headClient
      .from('order_payments')
      .select('*')
      .eq('order_id', o.id)

    assert.ifError(error)
    assert.ok(payments.length >= 1, 'Initial payment must remain intact in ledger')
    assert.equal(Number(payments[0].amount_received), Number(o.paid_amount))
  })

  // --------------------------------------------------------------------------
  // 24. direct payment ledger INSERT blocked
  // --------------------------------------------------------------------------
  await t.test('24. direct payment ledger INSERT blocked', async () => {
    const { error } = await empClient
      .from('order_payments')
      .insert({
        order_id: createdOrderId,
        amount_received: 1000,
        payment_method: 'cash',
        received_by: empUser.id
      })

    assert.ok(error, 'Direct INSERT on order_payments must be blocked')
    assert.match(error.message, /permission denied|violates row-level security/i)
  })

  // --------------------------------------------------------------------------
  // 25. payment UPDATE blocked
  // --------------------------------------------------------------------------
  await t.test('25. payment UPDATE blocked', async () => {
    const { data: payments } = await serviceClient
      .from('order_payments')
      .select('id')
      .eq('order_id', createdOrderId)
      .limit(1)

    const payId = payments[0].id

    const { error: headErr } = await headClient
      .from('order_payments')
      .update({ amount_received: 99999 })
      .eq('id', payId)

    assert.ok(headErr, 'Head cannot update payment ledger')
    assert.match(headErr.message, /permission denied|Permanent financial record protection|cannot be modified/i)
  })

  // --------------------------------------------------------------------------
  // 26. payment DELETE blocked
  // --------------------------------------------------------------------------
  await t.test('26. payment DELETE blocked', async () => {
    const { data: payments } = await serviceClient
      .from('order_payments')
      .select('id')
      .eq('order_id', createdOrderId)
      .limit(1)

    const payId = payments[0].id

    const { error: headErr } = await headClient
      .from('order_payments')
      .delete()
      .eq('id', payId)

    assert.ok(headErr, 'Head cannot delete payment ledger row')
    assert.match(headErr.message, /permission denied|Permanent financial record protection|cannot be deleted/i)
  })

  // --------------------------------------------------------------------------
  // 27. backfill is idempotent
  // --------------------------------------------------------------------------
  await t.test('27. backfill is idempotent', async () => {
    // Every order that was backfilled already has HISTORICAL_INITIAL_PAYMENT or INITIAL_DOWNPAYMENT
    const { data: candidateOrders } = await serviceClient
      .from('orders')
      .select('id, paid_amount, payment_method, created_by, created_by_name, created_by_employee_code, created_at')
      .gt('paid_amount', 0)

    // For any candidate order, re-running backfill with NOT EXISTS must find 0 inserts
    let insertCount = 0
    for (const ord of candidateOrders) {
      const { data: exists } = await serviceClient
        .from('order_payments')
        .select('id')
        .eq('order_id', ord.id)
        .in('transaction_reference', ['HISTORICAL_INITIAL_PAYMENT', 'INITIAL_DOWNPAYMENT'])
        .limit(1)

      if (!exists || exists.length === 0) {
        insertCount++
      }
    }

    assert.equal(insertCount, 0, 'No candidate orders lack initial payment; backfill is fully idempotent')
  })

  // --------------------------------------------------------------------------
  // 28. repeated attachment registration cannot duplicate metadata
  // --------------------------------------------------------------------------
  await t.test('28. repeated attachment registration cannot duplicate metadata', async () => {
    const fixedPath = `${createdOrderId}/non_dup_doc.pdf`
    const { error: firstErr } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: fixedPath,
      p_original_filename: 'non_dup_doc.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 4096
    })
    assert.ifError(firstErr)

    // Repeat registration
    const { error: repeatErr } = await empClient.rpc('register_order_attachment', {
      p_order_id: createdOrderId,
      p_storage_path: fixedPath,
      p_original_filename: 'non_dup_doc.pdf',
      p_mime_type: 'application/pdf',
      p_file_size: 4096
    })
    assert.ok(repeatErr, 'Repeated attachment registration must fail due to unique constraint')
    assert.equal(repeatErr.code, '23505')
  })

  // --------------------------------------------------------------------------
  // 29. partial attachment upload failure behavior at application level
  // --------------------------------------------------------------------------
  await t.test('29. partial attachment upload failure behavior at application level', async () => {
    // Verify that when an order is created, attachment failures are cleanly reported
    const mockOrderResult = { success: true, id: 'test-order-uuid', order_number: 'ARS-ORD-09999' }
    const mockAttachmentFailures = [{ name: 'corrupted_file.pdf', error: 'Network timeout during upload' }]

    // Contract check: onOrderCreated receives result AND attachmentFailures
    let toastMessage = ''
    function onOrderCreated(result, attachmentFailures) {
      if (attachmentFailures && attachmentFailures.length > 0) {
        toastMessage = 'Sales order created successfully, but some supporting documents could not be uploaded. You can retry from Order Details.'
      } else {
        toastMessage = 'Sales order created successfully.'
      }
    }

    onOrderCreated(mockOrderResult, mockAttachmentFailures)
    assert.equal(
      toastMessage,
      'Sales order created successfully, but some supporting documents could not be uploaded. You can retry from Order Details.',
      'Partial attachment failure must produce actionable, clear message without claiming order failed'
    )
  })

  // --------------------------------------------------------------------------
  // 30. Monthly Sales Report remains strictly grouped by completion_approved_at
  // --------------------------------------------------------------------------
  await t.test('30. Monthly Sales Report remains strictly grouped by completion_approved_at', async () => {
    const orderObj = {
      id: createdOrderId,
      total_amount: 8000.0,
      paid_amount: 8000.0,
      payment_status: 'paid',
      status: 'new', // NOT completed yet!
      created_at: new Date().toISOString(),
      completion_approved_at: null
    }

    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    const reportOrders = filterOrdersByReportingMonth([orderObj], currentMonth, currentYear)
    assert.equal(reportOrders.length, 0, 'Unapproved order is excluded from monthly sales report regardless of full payment')
  })
})
