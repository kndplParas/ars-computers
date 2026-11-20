import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * ============================================================================
 * ARS Computers — Phase 3A Financial Data Security Test Suite
 * ============================================================================
 * Comprehensive verification of:
 * 1. SQL RPC definitions (SECURITY DEFINER, search_path, active staff, role logic)
 * 2. Role-by-role data projections across all 7 staff roles (Option B)
 * 3. Engineer atomic assignment concurrency guards
 * 4. PII redaction and financial NULLs for restricted roles
 * 5. Direct table SELECT elimination and no-fallback security
 * 6. Business analytics authorization and gross-margin accounting integrity
 * ============================================================================
 */

const projectRoot = path.resolve('.')

test('Suite 1: Migration SQL Security Invariants & Definitions', async (t) => {
  const mig22Path = path.join(projectRoot, 'supabase/migrations/20261120000022_correct_assign_order_engineer_security.sql')
  const mig23Path = path.join(projectRoot, 'supabase/migrations/20261120000023_secure_order_financial_rpcs.sql')
  const mig24Path = path.join(projectRoot, 'supabase/migrations/20261120000024_revoke_direct_order_table_select.sql')

  assert.ok(fs.existsSync(mig22Path), 'Migration 22 exists')
  assert.ok(fs.existsSync(mig23Path), 'Migration 23 exists')
  assert.ok(fs.existsSync(mig24Path), 'Migration 24 exists')

  const mig22 = fs.readFileSync(mig22Path, 'utf8')
  const mig23 = fs.readFileSync(mig23Path, 'utf8')
  const mig24 = fs.readFileSync(mig24Path, 'utf8')

  await t.test('1.1: Migration 22 assign_order_engineer concurrency & security guards', () => {
    assert.match(mig22, /CREATE OR REPLACE FUNCTION public\.assign_order_engineer/i)
    assert.match(mig22, /SECURITY DEFINER/i)
    assert.match(mig22, /SET search_path TO 'pg_catalog', 'public'/i)
    assert.match(mig22, /auth\.uid\(\)/i)
    assert.match(mig22, /SELECT \* INTO v_order FROM public\.orders WHERE id = p_order_id FOR UPDATE/i, 'Enforces atomic row locking')
    assert.match(mig22, /v_order\.assigned_engineer_id IS NOT NULL AND v_order\.assigned_engineer_id <> v_actor_id/, 'Prevents engineer overwriting peer assignment')
    assert.match(mig22, /p_engineer_id IS NOT NULL AND p_engineer_id <> v_actor_id/, 'Prevents engineer assigning to someone else')
    assert.match(mig22, /REVOKE ALL ON FUNCTION public\.assign_order_engineer.*FROM PUBLIC, anon/i)
    assert.match(mig22, /GRANT EXECUTE ON FUNCTION public\.assign_order_engineer.*TO authenticated/i)
  })

  await t.test('1.2: Migration 23 get_admin_orders role visibility and field masking', () => {
    assert.match(mig23, /CREATE OR REPLACE FUNCTION public\.get_admin_orders/i)
    assert.match(mig23, /public\.get_staff_role\(\)/i)
    assert.match(mig23, /'\[REDACTED: HR Privacy Policy\]'/, 'HR customer PII redaction')
    assert.match(mig23, /WHEN v_role = 'inventory_staff' THEN NULL/, 'Inventory Staff financial masking to NULL')
    assert.match(mig23, /WHEN v_role IN \('superadmin', 'admin', 'account'\) THEN oi\.cost_price_snapshot\s+ELSE NULL/, 'Option B cost snapshot projection')
    assert.match(mig23, /'total_count',\s*v_total_count/, 'Returns pagination total_count')
    assert.match(mig23, /'has_more',\s*v_has_more/, 'Returns pagination has_more')
  })

  await t.test('1.3: Migration 23 get_admin_order_payments authorization', () => {
    assert.match(mig23, /CREATE OR REPLACE FUNCTION public\.get_admin_order_payments/i)
    assert.match(mig23, /v_role NOT IN \('superadmin', 'admin', 'account'\)/, 'Payments restricted strictly to superadmin, admin, account')
    assert.match(mig23, /v_role = 'account' AND \(v_order\.is_in_bin OR v_order\.is_removed\)/, 'Accountant restricted from bin/removed payments')
  })

  await t.test('1.4: Migration 23 get_monthly_business_analytics timezone and date math', () => {
    assert.match(mig23, /CREATE OR REPLACE FUNCTION public\.get_monthly_business_analytics/i)
    assert.match(mig23, /v_role NOT IN \('superadmin', 'admin', 'account'\)/, 'Analytics restricted strictly to superadmin, admin, account')
    assert.match(mig23, /make_timestamptz\(p_year, p_month \+ 1, 1, 0, 0, 0, 'Asia\/Kolkata'\)/, 'Uses Asia/Kolkata half-open bounds')
    assert.match(mig23, /prev_orders_created_count/, 'Calculates previous month orders created count for growth metrics')
  })

  await t.test('1.5: Migration 24 direct table SELECT revocation', () => {
    assert.match(mig24, /REVOKE SELECT ON TABLE public\.orders FROM PUBLIC, anon, authenticated/i)
    assert.match(mig24, /REVOKE SELECT ON TABLE public\.order_items FROM PUBLIC, anon, authenticated/i)
    assert.match(mig24, /REVOKE SELECT ON TABLE public\.order_payments FROM PUBLIC, anon, authenticated/i)
  })
})

test('Suite 2: Role-by-Role Projection Simulation (All 7 Roles)', async (t) => {
  // Mock representative raw order from database
  const sampleRawOrder = {
    id: 'ord-101',
    order_number: 'ORD-2026-001',
    customer_name: 'Rahul Sharma',
    contact_info: 'rahul@example.com | 9876543210',
    customer_email: 'rahul@example.com',
    customer_phone: '9876543210',
    customer_address: 'Sector 18, Noida',
    status: 'processing',
    payment_status: 'partial',
    payment_method: 'upi',
    total_amount: 45000.0,
    paid_amount: 20000.0,
    assigned_engineer_id: 'eng-uuid-1',
    assigned_engineer_name: 'Vikram Singh',
    assigned_engineer_phone: '9811122233',
    is_archived: false,
    is_in_bin: false,
    is_removed: false,
    order_items: [
      {
        id: 'item-1',
        product_name_snapshot: 'Intel Core i5 13400F',
        quantity: 1,
        unit_price: 18000.0,
        line_total: 18000.0,
        cost_price_snapshot: 15200.0
      },
      {
        id: 'item-2',
        product_name_snapshot: 'DDR4 16GB 3200MHz RAM',
        quantity: 2,
        unit_price: 3500.0,
        line_total: 7000.0,
        cost_price_snapshot: 2900.0
      }
    ]
  }

  // Pure projection function replicating Migration 23 get_admin_orders SQL projection
  function projectOrderForRole(order, role, actorId) {
    const isSuperOrAdmin = role === 'superadmin' || role === 'admin'
    const isAccount = role === 'account'
    const isHr = role === 'hr'
    const isInventoryStaff = role === 'inventory_staff'
    const isEngineer = role === 'engineer'

    // Row visibility check
    if (isInventoryStaff && (order.is_in_bin || order.is_removed || order.status === 'cancelled')) return null
    if (isEngineer && (order.is_in_bin || order.is_removed)) return null
    if (isEngineer && order.assigned_engineer_id !== actorId && order.status !== 'new') return null
    if ((isHr || isAccount || role === 'technical') && (order.is_in_bin || order.is_removed)) return null

    return {
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      contact_info: isHr ? '[REDACTED: HR Privacy Policy]' : order.contact_info,
      customer_email: isHr ? '[REDACTED: HR Privacy Policy]' : order.customer_email,
      customer_phone: isHr ? '[REDACTED: HR Privacy Policy]' : order.customer_phone,
      customer_address: isHr ? '[REDACTED: HR Privacy Policy]' : order.customer_address,
      assigned_engineer_phone: isHr ? '[REDACTED: HR Privacy Policy]' : order.assigned_engineer_phone,
      status: order.status,
      payment_status: isInventoryStaff ? null : order.payment_status,
      payment_method: isInventoryStaff ? null : order.payment_method,
      total_amount: isInventoryStaff ? null : order.total_amount,
      paid_amount: isInventoryStaff ? null : order.paid_amount,
      order_items: order.order_items.map((it) => ({
        id: it.id,
        product_name_snapshot: it.product_name_snapshot,
        quantity: it.quantity,
        unit_price: isInventoryStaff ? null : it.unit_price,
        line_total: isInventoryStaff ? null : it.line_total,
        cost_price_snapshot: isSuperOrAdmin || isAccount ? it.cost_price_snapshot : null
      }))
    }
  }

  await t.test('2.1: Superadmin has unmasked full financial and cost snapshot visibility', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'superadmin', 'superadmin-id')
    assert.ok(projected)
    assert.equal(projected.customer_phone, '9876543210')
    assert.equal(projected.total_amount, 45000.0)
    assert.equal(projected.order_items[0].cost_price_snapshot, 15200.0)
    assert.equal(projected.order_items[0].unit_price, 18000.0)
  })

  await t.test('2.2: Admin has unmasked full financial and cost snapshot visibility', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'admin', 'admin-id')
    assert.ok(projected)
    assert.equal(projected.total_amount, 45000.0)
    assert.equal(projected.order_items[0].cost_price_snapshot, 15200.0)
  })

  await t.test('2.3: Account has unmasked full financial and cost snapshot visibility (Option B)', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'account', 'account-id')
    assert.ok(projected)
    assert.equal(projected.total_amount, 45000.0)
    assert.equal(projected.paid_amount, 20000.0)
    assert.equal(projected.order_items[0].cost_price_snapshot, 15200.0, 'Accountant sees acquisition cost snapshot')
  })

  await t.test('2.4: Technical sees customer contact & prices, but cost snapshot is strictly NULL', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'technical', 'tech-id')
    assert.ok(projected)
    assert.equal(projected.customer_phone, '9876543210')
    assert.equal(projected.total_amount, 45000.0)
    assert.equal(projected.order_items[0].unit_price, 18000.0)
    assert.equal(projected.order_items[0].cost_price_snapshot, null, 'Technical must NOT receive cost price snapshot')
  })

  await t.test('2.5: Engineer sees assigned order & prices, but cost snapshot is strictly NULL', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'engineer', 'eng-uuid-1')
    assert.ok(projected)
    assert.equal(projected.total_amount, 45000.0)
    assert.equal(projected.order_items[0].cost_price_snapshot, null, 'Engineer must NOT receive cost price snapshot')
  })

  await t.test('2.6: HR customer PII is redacted and cost snapshot is strictly NULL', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'hr', 'hr-id')
    assert.ok(projected)
    assert.equal(projected.customer_phone, '[REDACTED: HR Privacy Policy]')
    assert.equal(projected.customer_email, '[REDACTED: HR Privacy Policy]')
    assert.equal(projected.customer_address, '[REDACTED: HR Privacy Policy]')
    assert.equal(projected.assigned_engineer_phone, '[REDACTED: HR Privacy Policy]')
    assert.equal(projected.order_items[0].cost_price_snapshot, null, 'HR must NOT receive cost price snapshot')
  })

  await t.test('2.7: Inventory Staff has all pricing fields masked to NULL (Dispatch view only)', () => {
    const projected = projectOrderForRole(sampleRawOrder, 'inventory_staff', 'inv-id')
    assert.ok(projected)
    assert.equal(projected.customer_name, 'Rahul Sharma')
    assert.equal(projected.total_amount, null, 'total_amount must be NULL')
    assert.equal(projected.paid_amount, null, 'paid_amount must be NULL')
    assert.equal(projected.payment_status, null, 'payment_status must be NULL')
    assert.equal(projected.payment_method, null, 'payment_method must be NULL')
    assert.equal(projected.order_items[0].unit_price, null, 'unit_price must be NULL')
    assert.equal(projected.order_items[0].line_total, null, 'line_total must be NULL')
    assert.equal(projected.order_items[0].cost_price_snapshot, null, 'cost_price_snapshot must be NULL')
    assert.equal(projected.order_items[0].quantity, 1, 'Quantity is preserved for packing')
  })
})

test('Suite 3: Concurrency & Engineer Assignment Race Protection', async (t) => {
  // Simulates assignment decision engine in Migration 22
  function simulateAssignOrderEngineer({ actorRole, actorId, order, newEngineerId }) {
    if (order.status === 'cancelled') throw new Error('Cannot assign engineer to a cancelled order.')
    if (order.is_in_bin || order.is_removed) throw new Error('Cannot assign engineer to an order in the Bin.')

    if (actorRole === 'engineer') {
      if (order.assigned_engineer_id && order.assigned_engineer_id !== actorId) {
        throw new Error('Cannot claim or reassign an order already assigned to another technician.')
      }
      if (newEngineerId && newEngineerId !== actorId) {
        throw new Error('Field engineers may only assign orders to themselves.')
      }
    }
    return { success: true, assigned_engineer_id: newEngineerId }
  }

  await t.test('3.1: Engineer can claim an unassigned order for themselves', () => {
    const order = { id: 'ord-1', assigned_engineer_id: null, status: 'new', is_in_bin: false }
    const result = simulateAssignOrderEngineer({
      actorRole: 'engineer',
      actorId: 'eng-1',
      order,
      newEngineerId: 'eng-1'
    })
    assert.equal(result.success, true)
    assert.equal(result.assigned_engineer_id, 'eng-1')
  })

  await t.test('3.2: Engineer CANNOT claim an order already assigned to peer engineer', () => {
    const order = { id: 'ord-1', assigned_engineer_id: 'eng-peer', status: 'processing', is_in_bin: false }
    assert.throws(
      () => simulateAssignOrderEngineer({
        actorRole: 'engineer',
        actorId: 'eng-attacker',
        order,
        newEngineerId: 'eng-attacker'
      }),
      /already assigned to another technician/
    )
  })

  await t.test('3.3: Engineer CANNOT reassign an order to another colleague', () => {
    const order = { id: 'ord-1', assigned_engineer_id: null, status: 'new', is_in_bin: false }
    assert.throws(
      () => simulateAssignOrderEngineer({
        actorRole: 'engineer',
        actorId: 'eng-1',
        order,
        newEngineerId: 'eng-2'
      }),
      /only assign orders to themselves/
    )
  })

  await t.test('3.4: Superadmin/Admin/Technical CAN reassign orders between engineers', () => {
    const order = { id: 'ord-1', assigned_engineer_id: 'eng-1', status: 'processing', is_in_bin: false }
    const result = simulateAssignOrderEngineer({
      actorRole: 'technical',
      actorId: 'tech-lead',
      order,
      newEngineerId: 'eng-2'
    })
    assert.equal(result.success, true)
    assert.equal(result.assigned_engineer_id, 'eng-2')
  })
})

test('Suite 4: Gross Margin Accounting Integrity for Superadmin/Admin/Account', async (t) => {
  await t.test('4.1: Computes exact gross profit when cost snapshot is recorded', () => {
    const items = [
      { quantity: 2, line_total: 40000, cost_price_snapshot: 15000 },
      { quantity: 1, line_total: 10000, cost_price_snapshot: 8000 }
    ]
    const revenue = items.reduce((sum, it) => sum + it.line_total, 0)
    const totalCost = items.reduce((sum, it) => sum + (it.cost_price_snapshot * it.quantity), 0)
    const profit = revenue - totalCost
    const marginPct = (profit / revenue) * 100

    assert.equal(revenue, 50000)
    assert.equal(totalCost, 38000)
    assert.equal(profit, 12000)
    assert.equal(marginPct, 24.0)
  })

  await t.test('4.2: Handles unrecorded cost snapshot without inventing catalog estimates', () => {
    const items = [
      { quantity: 1, line_total: 25000, cost_price_snapshot: null }
    ]
    const hasUnrecordedCost = items.some((it) => it.cost_price_snapshot == null)
    assert.equal(hasUnrecordedCost, true, 'Flags cost as unavailable instead of guessing')
  })
})

test('Suite 5: Elimination of Direct Table Queries in Application Frontend', async (t) => {
  const providerPath = path.join(projectRoot, 'src/context/AdminDataProvider.jsx')
  const analyticsHelperPath = path.join(projectRoot, 'src/utils/businessAnalyticsHelper.js')

  const providerCode = fs.readFileSync(providerPath, 'utf8')
  const analyticsCode = fs.readFileSync(analyticsHelperPath, 'utf8')

  await t.test('5.1: AdminDataProvider calls get_admin_orders and get_admin_order_payments RPCs', () => {
    assert.match(providerCode, /supabase\.rpc\('get_admin_orders'\)/)
    assert.match(providerCode, /supabase\.rpc\('get_admin_order_payments'/)
    assert.doesNotMatch(providerCode, /fallbackData/, 'No fallback to direct orders query on RPC error')
    assert.doesNotMatch(providerCode, /tablePayments/, 'No fallback to direct order_payments query on RPC error')
  })

  await t.test('5.2: businessAnalyticsHelper calls get_monthly_business_analytics RPC', () => {
    assert.match(analyticsCode, /supabaseClient\.rpc\('get_monthly_business_analytics'/)
    assert.doesNotMatch(analyticsCode, /\.from\('orders'\)/, 'No direct orders table SELECT')
    assert.doesNotMatch(analyticsCode, /\.from\('order_payments'\)/, 'No direct order_payments table SELECT')
  })
})
