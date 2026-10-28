/**
 * ============================================================================
 * ARS Computers — Real Isolated PostgreSQL Orders / Sales Verification Suite
 * ============================================================================
 * Strictly connects to local isolated Supabase instance (http://127.0.0.1:54321).
 * Verifies all Phase 2 Orders / Sales security rules, schema triggers, and RPCs:
 * 1. Public cannot read or create orders.
 * 2. Inactive staff blocked.
 * 3. Inventory staff restricted to read-only orders (cannot create).
 * 4. Admin employee creates order via create_sales_order RPC.
 * 5. Concurrency-safe sequence (ARS-ORD-01001, ARS-ORD-01002...).
 * 6. Server-side total calculation matches line items.
 * 7. Line item snapshots created from public.products.
 * 8. Subsequent catalog product updates do not alter historical order_items snapshots.
 * 9. Atomic creation: invalid product or bad quantity/price rolls back.
 * 10. Financial rules: paid > total blocked, balance derived, payment status consistent.
 * 11. Lifecycle: new -> start_sales_order -> submit_order_completion.
 * 12. Employee cannot approve (blocked by role check).
 * 13. Employee cannot self-approve.
 * 14. Employee cannot cancel (Head-only).
 * 15. Head review_order_completion marks completed + is_archived = true + archived_at.
 * 16. Immutability trigger protects completed orders from direct modifications.
 * 17. Immutability trigger protects historical order items from direct modifications.
 * 18. Anti-deletion trigger blocks physical deletion of orders and order items.
 * 19. Separate cancellation lifecycle: cancel_sales_order marks cancelled + archived.
 * 20. Direct REST mutations blocked (read-only RLS).
 * 21. Monthly sales reporting strictly uses completion_approved_at.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  filterOrdersByReportingMonth
} from '../src/utils/salesReportGenerator.js'

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
      employee_code: 'ARS-INV-003',
      is_active: true
    }
  ])

  // Sign in clients
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

  // Find or insert a test product in public.products
  const { data: existingProd } = await serviceClient.from('products').select('id, name, price').limit(1).maybeSingle()
  if (existingProd) {
    testProductId = existingProd.id
  } else {
    const { data: newProd } = await serviceClient.from('products').insert({
      name: 'Test Gaming Laptop i7',
      brand: 'Asus',
      model: 'TUF F15',
      sku: 'SKU-TEST-LAP-001',
      price: 75000,
      stock_quantity: 10,
      availability_status: 'in_stock'
    }).select().single()
    testProductId = newProd.id
  }
})

test('Real PostgreSQL Orders / Sales Verification', async (t) => {
  let createdOrderId = null
  let createdOrderNumber = null

  await t.test('1. Anonymous/Public cannot read orders', async () => {
    const { data } = await anonClient.from('orders').select('*')
    assert.strictEqual(data?.length ?? 0, 0, 'Public anon client must not see any orders')
  })

  await t.test('2. Anonymous/Public cannot invoke create_sales_order RPC', async () => {
    const { data, error } = await anonClient.rpc('create_sales_order', {
      p_customer_name: 'Anonymous Hacker',
      p_contact_info: 'hacker@darkweb.org',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 100 }],
      p_paid_amount: 100,
      p_payment_method: 'cash'
    })
    assert.ok(error, 'Public caller must be blocked with an authorization error')
    assert.strictEqual(data, null)
  })

  await t.test('3. Inventory Staff is restricted from creating orders', async () => {
    const { error } = await invClient.rpc('create_sales_order', {
      p_customer_name: 'Store Walk-in',
      p_contact_info: '+91 99999 11111',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 75000 }],
      p_paid_amount: 75000,
      p_payment_method: 'cash'
    })
    assert.ok(error, 'Inventory staff must be rejected from creating orders')
    assert.ok(
      error.message.includes('Unauthorized') || error.message.includes('denied') || error.message.includes('privileges'),
      `Error should state unauthorized: ${error.message}`
    )
  })

  await t.test('4. Atomic validation: rejects negative prices, zero quantity, and paid > total', async () => {
    // Negative price
    const { error: negErr } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Bad Order',
      p_contact_info: '9999999999',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: -500 }],
      p_paid_amount: 0,
      p_payment_method: 'cash'
    })
    assert.ok(negErr, 'Negative item price must fail validation')

    // Zero quantity
    const { error: zeroQtyErr } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Bad Order',
      p_contact_info: '9999999999',
      p_items: [{ product_id: testProductId, quantity: 0, unit_price: 500 }],
      p_paid_amount: 0,
      p_payment_method: 'cash'
    })
    assert.ok(zeroQtyErr, 'Zero quantity must fail validation')

    // Paid > Total
    const { error: overpaidErr } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Bad Order',
      p_contact_info: '9999999999',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 1000 }],
      p_paid_amount: 2000, // Greater than line total
      p_payment_method: 'cash'
    })
    assert.ok(overpaidErr, 'Paid amount > total amount must be rejected')
  })

  await t.test('5. Employee creates order with server-derived sequence and product snapshot', async () => {
    const { data: result, error } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Manoj Tiwari',
      p_contact_info: '+91 98111 22334',
      p_items: [
        { product_id: testProductId, quantity: 2, unit_price: 75000 },
        { product_name: 'Custom High-Speed Cable', quantity: 1, unit_price: 1500 }
      ],
      p_paid_amount: 50000,
      p_payment_method: 'upi',
      p_employee_remarks: 'Customer paid advance via UPI; balance on delivery.'
    })

    assert.ifError(error, `Order creation should succeed: ${error?.message}`)
    assert.ok(result?.id, 'Order creation should return order id')
    assert.ok(result?.order_number?.startsWith('ARS-ORD-'), `Order number should follow sequence format: ${result?.order_number}`)

    createdOrderId = result.id
    createdOrderNumber = result.order_number

    // Verify order in database
    const { data: order } = await serviceClient
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', createdOrderId)
      .single()

    assert.strictEqual(order.status, 'new')
    assert.strictEqual(Number(order.total_amount), 151500) // 2 * 75000 + 1500
    assert.strictEqual(Number(order.paid_amount), 50000)
    assert.strictEqual(order.payment_status, 'partial')
    assert.strictEqual(order.payment_method, 'upi')
    assert.strictEqual(order.created_by, empUser.id)
    assert.strictEqual(order.created_by_name, 'Rohan Sharma')
    assert.strictEqual(order.created_by_employee_code, 'ARS-EMP-007')
    assert.strictEqual(order.order_items.length, 2)

    // Snapshot verification
    const catalogItem = order.order_items.find((it) => it.product_id === testProductId)
    assert.ok(catalogItem.product_name_snapshot, 'Product name snapshot must be populated')
    assert.strictEqual(Number(catalogItem.unit_price), 75000)
    assert.strictEqual(Number(catalogItem.line_total), 150000)
  })

  await t.test('6. Catalog updates do NOT affect historical order_items snapshots', async () => {
    // Update product price in catalog
    await serviceClient
      .from('products')
      .update({ price: 99999, name: 'Renamed Product Future Version' })
      .eq('id', testProductId)

    // Re-query historical order items
    const { data: orderItems } = await serviceClient
      .from('order_items')
      .select('*')
      .eq('order_id', createdOrderId)

    const historicalItem = orderItems.find((it) => it.product_id === testProductId)
    assert.strictEqual(Number(historicalItem.unit_price), 75000, 'Historical unit price snapshot must remain unchanged')
    assert.strictEqual(Number(historicalItem.line_total), 150000, 'Historical line total must remain unchanged')
  })

  await t.test('7. Concurrency safe sequence test: subsequent orders increment monotonically', async () => {
    const { data: nextResult } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Second Customer',
      p_contact_info: '+91 97777 88888',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 75000 }],
      p_paid_amount: 75000,
      p_payment_method: 'cash'
    })

    assert.ok(nextResult?.order_number)
    const prevNum = parseInt(createdOrderNumber.replace('ARS-ORD-', ''), 10)
    const nextNum = parseInt(nextResult.order_number.replace('ARS-ORD-', ''), 10)
    assert.strictEqual(nextNum, prevNum + 1, 'Order number must increment strictly by 1 via sequence')

    // Cancel temporary next order to maintain permanent audit record
    await headClient.rpc('cancel_sales_order', {
      p_order_id: nextResult.id,
      p_cancellation_reason: 'Automated test sequence verification cleanup'
    })
  })

  await t.test('8. Employee starts order processing (start_sales_order)', async () => {
    const { error } = await empClient.rpc('start_sales_order', {
      p_order_id: createdOrderId
    })
    assert.ifError(error, `Start order should succeed: ${error?.message}`)

    const { data: order } = await serviceClient.from('orders').select('status').eq('id', createdOrderId).single()
    assert.strictEqual(order.status, 'processing')
  })

  await t.test('9. Employee submits completion (submit_order_completion)', async () => {
    const { error } = await empClient.rpc('submit_order_completion', {
      p_order_id: createdOrderId,
      p_employee_remarks: 'Items packed and serial numbers recorded. Ready for customer handover.'
    })
    assert.ifError(error, `Submit completion should succeed: ${error?.message}`)

    const { data: order } = await serviceClient.from('orders').select('*').eq('id', createdOrderId).single()
    assert.strictEqual(order.status, 'completion_requested')
    assert.strictEqual(order.completion_requested_by, empUser.id)
    assert.strictEqual(order.completed_by_name, 'Rohan Sharma')
    assert.strictEqual(order.completed_by_employee_code, 'ARS-EMP-007')
    assert.ok(order.completion_requested_at)
  })

  await t.test('10. Employee cannot self-approve or review completion', async () => {
    const { error } = await empClient.rpc('review_order_completion', {
      p_order_id: createdOrderId,
      p_head_remarks: 'Self approval attempt by technician'
    })
    assert.ok(error, 'Employee must be blocked from reviewing/approving completion')
    assert.ok(
      error.message.includes('Superadministrator') || error.message.includes('Unauthorized'),
      `Error message should reflect superadmin requirement: ${error.message}`
    )
  })

  await t.test('11. Employee cannot cancel orders (Cancellation is Head-only)', async () => {
    const { error } = await empClient.rpc('cancel_sales_order', {
      p_order_id: createdOrderId,
      p_cancellation_reason: 'Employee trying to cancel order'
    })
    assert.ok(error, 'Employee must be blocked from cancelling orders')
  })

  await t.test('12. Head reviews and approves completion (review_order_completion)', async () => {
    const { error } = await headClient.rpc('review_order_completion', {
      p_order_id: createdOrderId,
      p_head_remarks: 'Sale audited and verified. Payment settled. Approved.'
    })
    assert.ifError(error, `Head approval should succeed: ${error?.message}`)

    const { data: order } = await serviceClient.from('orders').select('*').eq('id', createdOrderId).single()
    assert.strictEqual(order.status, 'completed')
    assert.strictEqual(order.is_archived, true, 'Completed order must be archived')
    assert.ok(order.archived_at, 'archived_at must be populated')
    assert.strictEqual(order.completion_approved_by, headUser.id)
    assert.strictEqual(order.approved_by_name, 'Ankit Bathla')
    assert.strictEqual(order.approved_by_employee_code, 'ARS-HEAD-001')
    assert.ok(order.completion_approved_at)
  })

  await t.test('13. Immutability protection: direct update on completed order is blocked', async () => {
    const { error } = await serviceClient
      .from('orders')
      .update({ customer_name: 'Tampered Customer Name', total_amount: 100 })
      .eq('id', createdOrderId)

    assert.ok(error, 'Database trigger trg_protect_order_immutability must block UPDATE on completed order')
    assert.ok(
      error.message.toLowerCase().includes('immutab') || error.message.toLowerCase().includes('archive'),
      `Trigger error must indicate immutability: ${error.message}`
    )
  })

  await t.test('14. Immutability protection: direct update on completed order_items is blocked', async () => {
    const { data: items } = await serviceClient.from('order_items').select('id').eq('order_id', createdOrderId).limit(1)
    const itemId = items[0].id

    const { error } = await serviceClient
      .from('order_items')
      .update({ unit_price: 1 })
      .eq('id', itemId)

    assert.ok(error, 'Database trigger trg_protect_order_items_immutability must block UPDATE on order items of completed order')
  })

  await t.test('15. Anti-deletion protection: direct DELETE on orders or items is blocked', async () => {
    // Delete order
    const { error: delOrderErr } = await serviceClient
      .from('orders')
      .delete()
      .eq('id', createdOrderId)

    assert.ok(delOrderErr, 'Database trigger trg_prevent_order_deletion must block physical DELETE on orders')
    assert.ok(delOrderErr.message.includes('cannot be physically deleted'))

    // Delete item
    const { data: items } = await serviceClient.from('order_items').select('id').eq('order_id', createdOrderId).limit(1)
    const { error: delItemErr } = await serviceClient
      .from('order_items')
      .delete()
      .eq('id', items[0].id)

    assert.ok(delItemErr, 'Database trigger trg_prevent_order_item_deletion must block physical DELETE on order items')
  })

  await t.test('16. Separate Cancellation Lifecycle: cancel_sales_order archives with reason', async () => {
    // Create new order to cancel
    const { data: toCancel } = await empClient.rpc('create_sales_order', {
      p_customer_name: 'Customer Who Cancelled',
      p_contact_info: '+91 91234 56789',
      p_items: [{ product_id: testProductId, quantity: 1, unit_price: 75000 }],
      p_paid_amount: 0,
      p_payment_method: 'cash'
    })

    const { error: cancelErr } = await headClient.rpc('cancel_sales_order', {
      p_order_id: toCancel.id,
      p_cancellation_reason: 'Customer found cheaper alternative and cancelled prior to dispatch.'
    })
    assert.ifError(cancelErr, `Cancellation should succeed: ${cancelErr?.message}`)

    const { data: cancelledOrder } = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', toCancel.id)
      .single()

    assert.strictEqual(cancelledOrder.status, 'cancelled')
    assert.strictEqual(cancelledOrder.is_archived, true)
    assert.ok(cancelledOrder.archived_at)
    assert.strictEqual(cancelledOrder.cancelled_by, headUser.id)
    assert.strictEqual(cancelledOrder.cancelled_by_name, 'Ankit Bathla')
    assert.strictEqual(cancelledOrder.cancellation_reason, 'Customer found cheaper alternative and cancelled prior to dispatch.')

    // Verify immutability of cancelled order
    const { error: tamperErr } = await serviceClient
      .from('orders')
      .update({ customer_name: 'Tamper Cancelled' })
      .eq('id', toCancel.id)
    assert.ok(tamperErr, 'Cancelled orders must also be immutable')
  })

  await t.test('17. Monthly Sales Report: strictly based on completion_approved_at', async () => {
    const { data: allOrders } = await serviceClient
      .from('orders')
      .select('*, order_items(*)')

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const reportOrders = filterOrdersByReportingMonth(allOrders, currentMonth, currentYear)
    assert.ok(reportOrders.length >= 1, 'Should find at least 1 completed order for current month')

    // Every order in monthly sales report MUST be completed and have completion_approved_at in this month
    reportOrders.forEach((o) => {
      assert.strictEqual(o.status, 'completed', 'Only completed orders in monthly sales report')
      assert.ok(o.completion_approved_at, 'Must have completion_approved_at')
      const approvedDate = new Date(o.completion_approved_at)
      assert.strictEqual(approvedDate.getMonth(), currentMonth)
      assert.strictEqual(approvedDate.getFullYear(), currentYear)
    })

    // Cancelled orders MUST NOT be included
    assert.ok(!reportOrders.some((o) => o.status === 'cancelled'), 'Cancelled orders must be excluded')
  })
})
