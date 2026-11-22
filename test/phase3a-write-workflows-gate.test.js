/**
 * ============================================================================
 * ARS Computers — Phase 3A Write-Workflow Test Gate Suite
 * ============================================================================
 * Strictly connects to local isolated Supabase instance (http://127.0.0.1:54321).
 * NEVER connects to or modifies production Supabase database.
 * 
 * Verifies all 4 Phase 3A Write Workflows with disposable test fixtures:
 * 1. Order creation, order items, catalog snapshotting, validation & rollbacks.
 * 2. Account payment recording, payment totals, status transitions & ledger consistency.
 * 3. Technical Lead engineer assignment, role permissions & concurrency guards.
 * 4. Authorized completion, cancellation, role restrictions, immutability & audit logs.
 * 5. Comprehensive verification that unauthorized roles are strictly denied.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Test Staff Credentials (Disposable, local isolated only)
const STAFF_FIXTURES = {
  superadmin: {
    email: 'gate.superadmin@arscomputers.in',
    password: 'GateSuperAdmin#2026!Secure',
    full_name: 'Ankit Bathla (Superadmin)',
    employee_code: 'ARS-GATE-001',
    role: 'superadmin',
    phone: '+919810000001',
    is_active: true
  },
  admin: {
    email: 'gate.admin@arscomputers.in',
    password: 'GateAdmin#2026!Secure',
    full_name: 'Rohan Sharma (Admin)',
    employee_code: 'ARS-GATE-002',
    role: 'admin',
    phone: '+919810000002',
    is_active: true
  },
  account: {
    email: 'gate.account@arscomputers.in',
    password: 'GateAccount#2026!Secure',
    full_name: 'Neha Accountant',
    employee_code: 'ARS-GATE-003',
    role: 'account',
    phone: '+919810000003',
    is_active: true
  },
  technical: {
    email: 'gate.tech@arscomputers.in',
    password: 'GateTech#2026!Secure',
    full_name: 'Vikram Tech Lead',
    employee_code: 'ARS-GATE-004',
    role: 'technical',
    phone: '+919810000004',
    is_active: true
  },
  engineer1: {
    email: 'gate.eng1@arscomputers.in',
    password: 'GateEng1#2026!Secure',
    full_name: 'Amit Engineer',
    employee_code: 'ARS-GATE-005',
    role: 'engineer',
    phone: '+919810000005',
    is_active: true
  },
  engineer2: {
    email: 'gate.eng2@arscomputers.in',
    password: 'GateEng2#2026!Secure',
    full_name: 'Suresh Field Eng',
    employee_code: 'ARS-GATE-006',
    role: 'engineer',
    phone: '+919810000006',
    is_active: true
  },
  inventory_staff: {
    email: 'gate.inv@arscomputers.in',
    password: 'GateInv#2026!Secure',
    full_name: 'Karan Inventory',
    employee_code: 'ARS-GATE-007',
    role: 'inventory_staff',
    phone: '+919810000007',
    is_active: true
  },
  inactive_staff: {
    email: 'gate.inactive@arscomputers.in',
    password: 'GateInactive#2026!Secure',
    full_name: 'Former Staff Inactive',
    employee_code: 'ARS-GATE-008',
    role: 'admin',
    phone: '+919810000008',
    is_active: false
  }
}

const clients = {}
const userRecords = {}
let testProductId = null
let testProductInitialPrice = 75000
let testProductCostPrice = 62000

test.before(async () => {
  // 1. Verify Local Isolation: Local URL check
  assert.ok(LOCAL_SUPABASE_URL.includes('127.0.0.1') || LOCAL_SUPABASE_URL.includes('localhost'), 'Must connect strictly to local URL')

  // 2. Provision or update Auth users & admin_users in local database
  for (const [key, fixture] of Object.entries(STAFF_FIXTURES)) {
    let authUser = null
    const { data: listRes } = await serviceClient.auth.admin.listUsers()
    authUser = listRes.users.find((u) => u.email === fixture.email)

    if (!authUser) {
      const { data: createRes, error: createErr } = await serviceClient.auth.admin.createUser({
        email: fixture.email,
        password: fixture.password,
        email_confirm: true,
        user_metadata: { full_name: fixture.full_name }
      })
      if (createErr) throw createErr
      authUser = createRes.user
    } else {
      await serviceClient.auth.admin.updateUserById(authUser.id, {
        password: fixture.password,
        email_confirm: true
      })
    }

    userRecords[key] = { id: authUser.id, ...fixture }

    // Upsert into public.admin_users
    const { error: upsertErr } = await serviceClient.from('admin_users').upsert({
      id: authUser.id,
      email: fixture.email,
      role: fixture.role,
      full_name: fixture.full_name,
      employee_code: fixture.employee_code,
      phone_number: fixture.phone,
      is_active: fixture.is_active
    })
    if (upsertErr) throw upsertErr

    // Create authenticated Supabase client for each role
    const roleClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { error: loginErr } = await roleClient.auth.signInWithPassword({
      email: fixture.email,
      password: fixture.password
    })
    if (loginErr) throw loginErr
    clients[key] = roleClient
  }

  // 3. Ensure test product exists in public.products
  const { data: existingProd } = await serviceClient
    .from('products')
    .select('id, name, price, cost_price')
    .limit(1)
    .maybeSingle()

  if (existingProd) {
    testProductId = existingProd.id
    await serviceClient.from('products').update({
      price: 75000,
      cost_price: 62000
    }).eq('id', testProductId)
    testProductInitialPrice = 75000
    testProductCostPrice = 62000
  } else {
    // Get or create category
    let categoryId = null
    const { data: cat } = await serviceClient.from('categories').select('id').limit(1).maybeSingle()
    if (cat) {
      categoryId = cat.id
    } else {
      const { data: newCat } = await serviceClient.from('categories').insert({
        slug: 'test-gate-hardware',
        title: 'Test Hardware'
      }).select().single()
      categoryId = newCat.id
    }

    const { data: newProd, error: prodErr } = await serviceClient.from('products').insert({
      category_id: categoryId,
      name: 'ARS Enterprise Workstation i9',
      slug: 'ars-enterprise-workstation-i9',
      sku: 'SKU-GATE-WRK-001',
      price: testProductInitialPrice,
      cost_price: testProductCostPrice,
      stock_quantity: 15,
      availability_status: 'in_stock'
    }).select().single()

    if (prodErr) throw prodErr
    testProductId = newProd.id
  }
})

// Helper: Call create_sales_order with full 13 parameters (same format as AdminDataProvider.jsx)
async function callCreateSalesOrder(client, {
  customer_name = 'Test Gate Customer',
  contact_info = '+91 98111 99999',
  customer_email = 'customer.gate@example.com',
  customer_phone = '+91 98111 99999',
  customer_address = 'Connaught Place, New Delhi',
  items = [],
  paid_amount = 0,
  payment_method = 'cash',
  employee_remarks = 'Order created via test gate',
  assigned_engineer_id = null,
  expected_delivery_date = null,
  discount_amount = 0,
  tax_amount = 0
} = {}) {
  return await client.rpc('create_sales_order', {
    p_customer_name: customer_name,
    p_contact_info: contact_info,
    p_items: items,
    p_paid_amount: paid_amount,
    p_payment_method: payment_method,
    p_employee_remarks: employee_remarks,
    p_customer_email: customer_email,
    p_customer_phone: customer_phone,
    p_customer_address: customer_address,
    p_assigned_engineer_id: assigned_engineer_id,
    p_expected_delivery_date: expected_delivery_date,
    p_discount_amount: discount_amount,
    p_tax_amount: tax_amount
  })
}

test('ARS Computers — Phase 3A Write-Workflow Test Gate', async (t) => {
  let createdOrderId = null
  let createdOrderNumber = null

  // ==========================================================================
  // WORKFLOW 1: Order Creation, Items, Snapshots, Validation & Rollback
  // ==========================================================================
  await t.test('Workflow 1: Order Creation and Validation', async (t1) => {
    await t1.test('1.1: Anonymous / Unauthenticated cannot create order', async () => {
      const { data, error } = await callCreateSalesOrder(anonClient, {
        customer_name: 'Unauthorized Anon',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 5000 }]
      })
      assert.ok(error, 'Anonymous creation must be rejected')
      assert.strictEqual(data, null)
      assert.match(error.message, /authentication required|insufficient_privilege|denied/i)
    })

    await t1.test('1.2: Inactive staff cannot create order', async () => {
      const { data, error } = await callCreateSalesOrder(clients.inactive_staff, {
        customer_name: 'Inactive Staff Attempt',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 5000 }]
      })
      assert.ok(error, 'Inactive staff must be rejected')
      assert.strictEqual(data, null)
      assert.match(error.message, /Access denied|privilege|inactive/i)
    })

    await t1.test('1.3: Inventory staff cannot create order (role restriction)', async () => {
      const { data, error } = await callCreateSalesOrder(clients.inventory_staff, {
        customer_name: 'Inventory Staff Walk-in',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 5000 }]
      })
      assert.ok(error, 'Inventory staff must be rejected from creating sales orders')
      assert.strictEqual(data, null)
      assert.match(error.message, /Access denied|privilege|unauthorized/i)
    })

    await t1.test('1.4: Validation rejection — negative item price', async () => {
      const { data, error } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Negative Price Customer',
        items: [{ product_id: testProductId, quantity: 1, unit_price: -1500 }]
      })
      assert.ok(error, 'Negative price must fail validation')
      assert.strictEqual(data, null)
      assert.match(error.message, /unit price|greater than zero|positive|invalid/i)
    })

    await t1.test('1.5: Validation rejection — zero / negative quantity', async () => {
      const { data, error } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Zero Quantity Customer',
        items: [{ product_id: testProductId, quantity: 0, unit_price: 5000 }]
      })
      assert.ok(error, 'Zero quantity must fail validation')
      assert.strictEqual(data, null)
      assert.match(error.message, /quantity|greater than zero|positive|invalid/i)
    })

    await t1.test('1.6: Validation rejection — initial paid amount > total amount', async () => {
      const { data, error } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Overpaid Customer',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 5000 }],
        paid_amount: 10000 // 10000 > 5000
      })
      assert.ok(error, 'Paid amount > total amount must fail validation')
      assert.strictEqual(data, null)
      assert.match(error.message, /cannot exceed|total amount|paid/i)
    })

    await t1.test('1.7: Atomic rollback — invalid item in multi-item order rolls back completely', async () => {
      const uniqueCustomer = `Rollback Test ${Date.now()}`
      const { data, error } = await callCreateSalesOrder(clients.admin, {
        customer_name: uniqueCustomer,
        items: [
          { product_id: testProductId, quantity: 1, unit_price: 5000 },
          { product_name: 'Broken Item', quantity: -3, unit_price: 1000 } // Invalid quantity
        ]
      })
      assert.ok(error, 'Multi-item order with one invalid item must fail')
      assert.strictEqual(data, null)

      // Verify no order was committed to database
      const { data: orphanOrder } = await serviceClient
        .from('orders')
        .select('id')
        .eq('customer_name', uniqueCustomer)
        .maybeSingle()
      assert.strictEqual(orphanOrder, null, 'No orphan order should exist after rollback')
    })

    await t1.test('1.8: Valid order creation by Admin with snapshots and sequence', async () => {
      const { data: res, error } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Vikram Mehta',
        contact_info: '+91 98111 55667',
        customer_email: 'vikram.mehta@example.com',
        customer_phone: '+91 98111 55667',
        customer_address: 'Plot 42, Okhla Phase 3, New Delhi',
        items: [
          { product_id: testProductId, quantity: 2, unit_price: testProductInitialPrice },
          { product_name: 'Certified USB-C Docking Station', quantity: 1, unit_price: 4500 }
        ],
        paid_amount: 50000,
        payment_method: 'upi',
        employee_remarks: 'Advance ₹50,000 paid via UPI. Balance on delivery.',
        discount_amount: 2000,
        tax_amount: 0
      })

      assert.ifError(error, `Order creation should succeed: ${error?.message}`)
      assert.ok(res?.id, 'Order creation should return generated order UUID')
      assert.ok(res?.order_number?.startsWith('ARS-ORD-'), `Order number must follow sequence: ${res?.order_number}`)

      createdOrderId = res.id
      createdOrderNumber = res.order_number

      // Inspect created order via service client
      const { data: order, error: fetchErr } = await serviceClient
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', createdOrderId)
        .single()

      assert.ifError(fetchErr)
      assert.strictEqual(order.status, 'new')
      // Expected total: 2 * 75000 + 4500 - 2000 discount = 152500
      const expectedTotal = 2 * testProductInitialPrice + 4500 - 2000
      assert.strictEqual(Number(order.total_amount), expectedTotal)
      assert.strictEqual(Number(order.paid_amount), 50000)
      assert.strictEqual(order.payment_status, 'partial')
      assert.strictEqual(order.payment_method, 'upi')
      assert.strictEqual(order.created_by, userRecords.admin.id)
      assert.strictEqual(order.created_by_name, userRecords.admin.full_name)
      assert.strictEqual(order.order_items.length, 2)

      // Verify line items and catalog snapshots
      const catalogItem = order.order_items.find((it) => it.product_id === testProductId)
      assert.ok(catalogItem, 'Catalog product line item must exist')
      assert.ok(catalogItem.product_name_snapshot, 'Catalog product name must be snapshotted')
      assert.strictEqual(Number(catalogItem.unit_price), testProductInitialPrice)
      assert.strictEqual(Number(catalogItem.cost_price_snapshot), testProductCostPrice)
      assert.strictEqual(Number(catalogItem.line_total), 2 * testProductInitialPrice)

      const customItem = order.order_items.find((it) => it.product_id === null)
      assert.ok(customItem, 'Custom non-catalog line item must exist')
      assert.strictEqual(customItem.product_name_snapshot, 'Certified USB-C Docking Station')
      assert.strictEqual(Number(customItem.unit_price), 4500)
      assert.strictEqual(Number(customItem.line_total), 4500)

      // Initial payment verification in order_payments ledger
      const { data: initialPayments } = await serviceClient
        .from('order_payments')
        .select('*')
        .eq('order_id', createdOrderId)

      assert.strictEqual(initialPayments.length, 1, 'Initial payment must be recorded in order_payments ledger')
      assert.strictEqual(Number(initialPayments[0].amount_received), 50000)
      assert.strictEqual(initialPayments[0].payment_method, 'upi')
    })
  })

  // ==========================================================================
  // WORKFLOW 2: Account Payment Recording, Totals & Ledger Consistency
  // ==========================================================================
  await t.test('Workflow 2: Account Payment Recording and Ledger Consistency', async (t2) => {
    assert.ok(createdOrderId, 'Requires order created in Workflow 1')

    await t2.test('2.1: Anonymous / Unauthenticated cannot record payment', async () => {
      const { data, error } = await anonClient.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: 10000,
        p_payment_method: 'cash'
      })
      assert.ok(error, 'Anonymous payment recording must be rejected')
      assert.strictEqual(data, null)
      assert.match(error.message, /permission denied|authentication required|insufficient_privilege|denied/i)
    })

    await t2.test('2.2: Inventory Staff cannot record payment', async () => {
      const { data, error } = await clients.inventory_staff.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: 10000,
        p_payment_method: 'cash'
      })
      assert.ok(error, 'Inventory staff must be rejected from recording payments')
      assert.strictEqual(data, null)
      assert.match(error.message, /Access denied|privilege|unauthorized/i)
    })

    await t2.test('2.3: Validation rejection — zero or negative payment amount', async () => {
      const { data, error } = await clients.account.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: -500,
        p_payment_method: 'cash'
      })
      assert.ok(error, 'Negative payment amount must fail validation')
      assert.strictEqual(data, null)
      assert.match(error.message, /greater than zero|positive|invalid/i)
    })

    await t2.test('2.4: Validation rejection — payment exceeds remaining balance due', async () => {
      // Order total is ~152500, already paid 50000, remaining balance is 102500. Attempt 200000.
      const { data, error } = await clients.account.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: 200000,
        p_payment_method: 'bank_transfer'
      })
      assert.ok(error, 'Overpayment must fail validation')
      assert.strictEqual(data, null)
      assert.match(error.message, /exceeds remaining balance|check_violation/i)
    })

    await t2.test('2.5: Account role records incremental payment (partial -> still partial)', async () => {
      // Pay 50000 more (total paid will be 100000 of 152500)
      const { data: payRes, error: payErr } = await clients.account.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: 50000,
        p_payment_method: 'bank_transfer',
        p_transaction_reference: 'NEFT-GATE-778899',
        p_remarks: 'Second installment via NEFT received by Account team.'
      })

      assert.ifError(payErr, `Account payment should succeed: ${payErr?.message}`)
      assert.strictEqual(payRes.success, true)
      assert.strictEqual(Number(payRes.paid_amount), 100000)
      assert.strictEqual(payRes.payment_status, 'partial')

      // Verify order table updated
      const { data: order } = await serviceClient
        .from('orders')
        .select('paid_amount, payment_status')
        .eq('id', createdOrderId)
        .single()

      assert.strictEqual(Number(order.paid_amount), 100000)
      assert.strictEqual(order.payment_status, 'partial')
    })

    await t2.test('2.6: Account role records final balance payment (partial -> paid)', async () => {
      // Remaining balance: 152500 - 100000 = 52500
      const { data: finalPayRes, error: finalPayErr } = await clients.account.rpc('record_order_payment', {
        p_order_id: createdOrderId,
        p_amount_received: 52500,
        p_payment_method: 'cash',
        p_transaction_reference: 'CASH-REC-0012',
        p_remarks: 'Full settlement received in cash.'
      })

      assert.ifError(finalPayErr, `Final settlement should succeed: ${finalPayErr?.message}`)
      assert.strictEqual(finalPayRes.success, true)
      assert.strictEqual(Number(finalPayRes.paid_amount), 152500)
      assert.strictEqual(finalPayRes.payment_status, 'paid')

      // Verify order table updated to paid
      const { data: order } = await serviceClient
        .from('orders')
        .select('paid_amount, payment_status')
        .eq('id', createdOrderId)
        .single()

      assert.strictEqual(Number(order.paid_amount), 152500)
      assert.strictEqual(order.payment_status, 'paid')

      // Verify order_payments ledger has exactly 3 entries summing to 152500
      const { data: allPayments } = await serviceClient
        .from('order_payments')
        .select('*')
        .eq('order_id', createdOrderId)
        .order('received_at', { ascending: true })

      assert.strictEqual(allPayments.length, 3, 'Should have 3 payment ledger records')
      const totalLedger = allPayments.reduce((sum, p) => sum + Number(p.amount_received), 0)
      assert.strictEqual(totalLedger, 152500, 'Sum of ledger entries must match paid_amount')
    })

    await t2.test('2.7: Immutability protection — order_payments rows cannot be updated or deleted', async () => {
      const { data: firstPayment } = await serviceClient
        .from('order_payments')
        .select('id')
        .eq('order_id', createdOrderId)
        .limit(1)
        .single()

      // Direct UPDATE attempt
      const { error: updateErr } = await serviceClient
        .from('order_payments')
        .update({ amount_received: 999999 })
        .eq('id', firstPayment.id)

      assert.ok(updateErr, 'Direct update to order_payments must be blocked by trigger')
      assert.match(updateErr.message, /immutable|cannot be modified/i)

      // Direct DELETE attempt
      const { error: deleteErr } = await serviceClient
        .from('order_payments')
        .delete()
        .eq('id', firstPayment.id)

      assert.ok(deleteErr, 'Direct delete of order_payments must be blocked by trigger')
      assert.match(deleteErr.message, /immutable|cannot be physically deleted|payment transactions cannot be deleted/i)
    })
  })

  // ==========================================================================
  // WORKFLOW 3: Technical Lead Engineer Assignment & Concurrency Protection
  // ==========================================================================
  await t.test('Workflow 3: Technical Lead Engineer Assignment & Concurrency Protection', async (t3) => {
    assert.ok(createdOrderId, 'Requires order created in Workflow 1')

    await t3.test('3.1: Anonymous cannot assign engineer', async () => {
      const { data, error } = await anonClient.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: userRecords.engineer1.id
      })
      assert.ok(error, 'Anonymous engineer assignment must be rejected')
      assert.strictEqual(data, null)
      assert.match(error.message, /permission denied|authentication required|insufficient_privilege|denied/i)
    })

    await t3.test('3.2: Inventory staff cannot assign engineer', async () => {
      const { data, error } = await clients.inventory_staff.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: userRecords.engineer1.id
      })
      assert.ok(error, 'Inventory staff must be rejected from engineer assignment')
      assert.strictEqual(data, null)
      assert.match(error.message, /Access denied|privilege|unauthorized/i)
    })

    await t3.test('3.3: Technical Lead assigns Field Engineer 1 with delivery date and notes', async () => {
      const deliveryDate = new Date(Date.now() + 86400000 * 3).toISOString()
      const { data: assignRes, error: assignErr } = await clients.technical.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: userRecords.engineer1.id,
        p_expected_delivery_date: deliveryDate,
        p_notes: 'Priority corporate delivery; ensure workstation benchmark test is signed.'
      })

      assert.ifError(assignErr, `Tech lead assignment should succeed: ${assignErr?.message}`)
      assert.strictEqual(assignRes.success, true)
      assert.strictEqual(assignRes.assigned_engineer_id, userRecords.engineer1.id)
      assert.strictEqual(assignRes.assigned_engineer_name, userRecords.engineer1.full_name)

      // Verify order in database
      const { data: order } = await serviceClient
        .from('orders')
        .select('assigned_engineer_id, assigned_engineer_name, assigned_engineer_phone, expected_delivery_date')
        .eq('id', createdOrderId)
        .single()

      assert.strictEqual(order.assigned_engineer_id, userRecords.engineer1.id)
      assert.strictEqual(order.assigned_engineer_name, userRecords.engineer1.full_name)
      assert.strictEqual(order.assigned_engineer_phone, userRecords.engineer1.phone)
      assert.ok(order.expected_delivery_date)
    })

    await t3.test('3.4: Concurrency Guard — Field Engineer 2 CANNOT overwrite Field Engineer 1 assignment', async () => {
      // Order is already assigned to Engineer 1. Engineer 2 attempts to claim it.
      const { data, error } = await clients.engineer2.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: userRecords.engineer2.id
      })
      assert.ok(error, 'Field Engineer 2 must be blocked from overwriting Engineer 1 assignment')
      assert.strictEqual(data, null)
      assert.match(error.message, /already assigned to another technician|check_violation/i)
    })

    await t3.test('3.5: Role Guard — Field Engineer 2 CANNOT assign order to another person', async () => {
      // Create a fresh unassigned order to test engineer third-party assignment attempt
      const { data: newOrder } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Unassigned Order Test',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 5000 }]
      })

      const { data, error } = await clients.engineer2.rpc('assign_order_engineer', {
        p_order_id: newOrder.id,
        p_engineer_id: userRecords.engineer1.id // Engineer 2 trying to assign to Engineer 1
      })
      assert.ok(error, 'Field engineer must not be allowed to assign colleagues')
      assert.strictEqual(data, null)
      assert.match(error.message, /only assign orders to themselves|insufficient_privilege/i)
    })

    await t3.test('3.6: Technical Lead CAN reassign from Field Engineer 1 to Field Engineer 2 (management privilege)', async () => {
      const { data: reassignRes, error: reassignErr } = await clients.technical.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: userRecords.engineer2.id,
        p_notes: 'Reassigned to Engineer 2 due to scheduling conflict.'
      })

      assert.ifError(reassignErr, `Tech lead reassignment should succeed: ${reassignErr?.message}`)
      assert.strictEqual(reassignRes.success, true)
      assert.strictEqual(reassignRes.assigned_engineer_id, userRecords.engineer2.id)
      assert.strictEqual(reassignRes.assigned_engineer_name, userRecords.engineer2.full_name)

      // Verify in database
      const { data: order } = await serviceClient
        .from('orders')
        .select('assigned_engineer_id, assigned_engineer_name')
        .eq('id', createdOrderId)
        .single()

      assert.strictEqual(order.assigned_engineer_id, userRecords.engineer2.id)
      assert.strictEqual(order.assigned_engineer_name, userRecords.engineer2.full_name)
    })

    await t3.test('3.7: Assignment to non-existent or inactive engineer is rejected', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000099'
      const { data, error } = await clients.technical.rpc('assign_order_engineer', {
        p_order_id: createdOrderId,
        p_engineer_id: fakeUuid
      })
      assert.ok(error, 'Assigning non-existent staff must fail')
      assert.strictEqual(data, null)
      assert.match(error.message, /does not exist or is inactive|check_violation/i)
    })
  })

  // ==========================================================================
  // WORKFLOW 4: Authorized Completion, Cancellation, Immutability & Audit
  // ==========================================================================
  await t.test('Workflow 4: Authorized Completion, Cancellation and Immutability', async (t4) => {
    assert.ok(createdOrderId, 'Requires order created in Workflow 1')

    await t4.test('4.1: Lifecycle progression — start_sales_order moves status to processing', async () => {
      const { data: startRes, error: startErr } = await clients.admin.rpc('start_sales_order', {
        p_order_id: createdOrderId
      })
      assert.ifError(startErr, `start_sales_order should succeed: ${startErr?.message}`)
      assert.strictEqual(startRes.success, true)
      assert.strictEqual(startRes.status, 'processing')

      const { data: order } = await serviceClient
        .from('orders')
        .select('status')
        .eq('id', createdOrderId)
        .single()
      assert.strictEqual(order.status, 'processing')
    })

    await t4.test('4.2: Lifecycle progression — submit_order_completion moves to completion_requested', async () => {
      const { data: submitRes, error: submitErr } = await clients.admin.rpc('submit_order_completion', {
        p_order_id: createdOrderId,
        p_employee_remarks: 'Hardware assembled, tested, OS configured and verified by QC.'
      })
      assert.ifError(submitErr, `submit_order_completion should succeed: ${submitErr?.message}`)
      assert.strictEqual(submitRes.success, true)
      assert.strictEqual(submitRes.status, 'completion_requested')

      const { data: order } = await serviceClient
        .from('orders')
        .select('status, completion_requested_by, completed_by_name')
        .eq('id', createdOrderId)
        .single()
      assert.strictEqual(order.status, 'completion_requested')
      assert.strictEqual(order.completion_requested_by, userRecords.admin.id)
    })

    await t4.test('4.3: Role restriction — Non-Superadmin CANNOT approve completion', async () => {
      // Admin attempt
      const { data: adminData, error: adminErr } = await clients.admin.rpc('review_order_completion', {
        p_order_id: createdOrderId,
        p_head_remarks: 'Admin trying to approve'
      })
      assert.ok(adminErr, 'Admin must not be allowed to approve order completion')
      assert.strictEqual(adminData, null)
      assert.match(adminErr.message, /Only Superadministrators|insufficient_privilege/i)

      // Account attempt
      const { data: accData, error: accErr } = await clients.account.rpc('review_order_completion', {
        p_order_id: createdOrderId,
        p_head_remarks: 'Account trying to approve'
      })
      assert.ok(accErr, 'Account role must not be allowed to approve order completion')
      assert.strictEqual(accData, null)
      assert.match(accErr.message, /Only Superadministrators|insufficient_privilege/i)
    })

    await t4.test('4.4: Superadmin approves completion — marks completed, is_archived = true', async () => {
      const { data: reviewRes, error: reviewErr } = await clients.superadmin.rpc('review_order_completion', {
        p_order_id: createdOrderId,
        p_head_remarks: 'Final QC and customer delivery approved by Head.'
      })
      assert.ifError(reviewErr, `Superadmin review should succeed: ${reviewErr?.message}`)
      assert.strictEqual(reviewRes.success, true)
      assert.strictEqual(reviewRes.status, 'completed')

      // Inspect finalized order in database
      const { data: order } = await serviceClient
        .from('orders')
        .select('status, is_archived, archived_at, completion_approved_at, completion_approved_by')
        .eq('id', createdOrderId)
        .single()

      assert.strictEqual(order.status, 'completed')
      assert.strictEqual(order.is_archived, true)
      assert.ok(order.archived_at, 'archived_at must be populated')
      assert.ok(order.completion_approved_at, 'completion_approved_at must be populated')
      assert.strictEqual(order.completion_approved_by, userRecords.superadmin.id)
    })

    await t4.test('4.5: Immutability Trigger — Direct modification on completed order is strictly blocked', async () => {
      const { error: directOrderUpdateErr } = await serviceClient
        .from('orders')
        .update({ customer_name: 'Altered Post-Completion' })
        .eq('id', createdOrderId)

      assert.ok(directOrderUpdateErr, 'Direct update to completed order must fail')
      assert.match(directOrderUpdateErr.message, /Order immutability violation: Completed orders are permanently locked/i)

      // Direct modification on order_items of completed order
      const { data: item } = await serviceClient
        .from('order_items')
        .select('id')
        .eq('order_id', createdOrderId)
        .limit(1)
        .single()

      const { error: directItemUpdateErr } = await serviceClient
        .from('order_items')
        .update({ unit_price: 99999 })
        .eq('id', item.id)

      assert.ok(directItemUpdateErr, 'Direct update to completed order_items must fail')
      assert.match(directItemUpdateErr.message, /immutab|cannot modify|finalized/i)

      // Direct physical DELETE of completed order
      const { error: directDeleteErr } = await serviceClient
        .from('orders')
        .delete()
        .eq('id', createdOrderId)

      assert.ok(directDeleteErr, 'Physical delete of order must fail')
      assert.match(directDeleteErr.message, /cannot be physically deleted/i)
    })

    await t4.test('4.6: Cancellation Lifecycle — Non-superadmin cannot cancel sales order', async () => {
      // Create a new order to test cancellation
      const { data: cancelTestOrder } = await callCreateSalesOrder(clients.admin, {
        customer_name: 'Customer To Be Cancelled',
        items: [{ product_id: testProductId, quantity: 1, unit_price: 10000 }]
      })

      // Admin attempt to cancel
      const { data: adminCancelData, error: adminCancelErr } = await clients.admin.rpc('cancel_sales_order', {
        p_order_id: cancelTestOrder.id,
        p_cancellation_reason: 'Admin cancelled order'
      })
      assert.ok(adminCancelErr, 'Admin must not be allowed to cancel sales order')
      assert.strictEqual(adminCancelData, null)
      assert.match(adminCancelErr.message, /Only Superadministrators|insufficient_privilege/i)

      // Account attempt to cancel
      const { data: accCancelData, error: accCancelErr } = await clients.account.rpc('cancel_sales_order', {
        p_order_id: cancelTestOrder.id,
        p_cancellation_reason: 'Account cancelled order'
      })
      assert.ok(accCancelErr, 'Account role must not be allowed to cancel sales order')
      assert.strictEqual(accCancelData, null)
      assert.match(accCancelErr.message, /Only Superadministrators|insufficient_privilege/i)

      // Validation rejection: cancellation reason < 5 characters
      const { data: shortReasonData, error: shortReasonErr } = await clients.superadmin.rpc('cancel_sales_order', {
        p_order_id: cancelTestOrder.id,
        p_cancellation_reason: 'No'
      })
      assert.ok(shortReasonErr, 'Short cancellation reason must be rejected')
      assert.strictEqual(shortReasonData, null)
      assert.match(shortReasonErr.message, /at least 5 characters|check_violation/i)

      // Superadmin cancels with valid reason
      const { data: cancelRes, error: cancelErr } = await clients.superadmin.rpc('cancel_sales_order', {
        p_order_id: cancelTestOrder.id,
        p_cancellation_reason: 'Customer requested cancellation prior to dispatch.'
      })
      assert.ifError(cancelErr, `Superadmin cancel should succeed: ${cancelErr?.message}`)
      assert.strictEqual(cancelRes.success, true)
      assert.strictEqual(cancelRes.status, 'cancelled')

      // Verify database record
      const { data: cancelledOrder } = await serviceClient
        .from('orders')
        .select('status, is_archived, archived_at, cancellation_reason')
        .eq('id', cancelTestOrder.id)
        .single()

      assert.strictEqual(cancelledOrder.status, 'cancelled')
      assert.strictEqual(cancelledOrder.is_archived, true)
      assert.ok(cancelledOrder.archived_at)
      assert.strictEqual(cancelledOrder.cancellation_reason, 'Customer requested cancellation prior to dispatch.')

      // Verification: cannot record payment on cancelled order
      const { error: postCancelPayErr } = await clients.account.rpc('record_order_payment', {
        p_order_id: cancelTestOrder.id,
        p_amount_received: 5000,
        p_payment_method: 'cash'
      })
      assert.ok(postCancelPayErr, 'Cannot record payment for cancelled order')
      assert.match(postCancelPayErr.message, /cancelled order|check_violation/i)

      // Verification: cannot assign engineer to cancelled order
      const { error: postCancelAssignErr } = await clients.technical.rpc('assign_order_engineer', {
        p_order_id: cancelTestOrder.id,
        p_engineer_id: userRecords.engineer1.id
      })
      assert.ok(postCancelAssignErr, 'Cannot assign engineer to cancelled order')
      assert.match(postCancelAssignErr.message, /cancelled order|check_violation/i)
    })
  })
})

test.after(async () => {
  try {
    const cleanupSql = `
      SET session_replication_role = 'replica';
      DELETE FROM public.order_payments WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE '%Gate%' OR customer_name LIKE '%Mehta%' OR customer_name LIKE '%Rollback%' OR customer_name LIKE '%Cancelled%');
      DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE '%Gate%' OR customer_name LIKE '%Mehta%' OR customer_name LIKE '%Rollback%' OR customer_name LIKE '%Cancelled%');
      DELETE FROM public.order_activities WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE '%Gate%' OR customer_name LIKE '%Mehta%' OR customer_name LIKE '%Rollback%' OR customer_name LIKE '%Cancelled%');
      DELETE FROM public.orders WHERE customer_name LIKE '%Gate%' OR customer_name LIKE '%Mehta%' OR customer_name LIKE '%Rollback%' OR customer_name LIKE '%Cancelled%';
      DELETE FROM public.admin_users WHERE email LIKE 'gate.%@arscomputers.in';
      DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'gate.%@arscomputers.in');
      DELETE FROM auth.users WHERE email LIKE 'gate.%@arscomputers.in';
      SET session_replication_role = 'origin';
    `
    execSync('docker exec -i supabase_db_ARS_Computers psql -U postgres -d postgres', {
      input: cleanupSql,
      stdio: ['pipe', 'ignore', 'ignore']
    })
  } catch {
    // Non-fatal cleanup catch
  }
})
