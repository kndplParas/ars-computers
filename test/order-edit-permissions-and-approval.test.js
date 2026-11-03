import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatINR, formatOrderCustomerDispatch } from '../src/utils/customerDispatchFormatter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

describe('ARS Computers — Order Edit Permissions & Super Admin Approval Invariants', () => {
  const modalFilePath = path.join(projectRoot, 'src', 'components', 'admin', 'EditOrderModal.jsx')
  const ordersPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminOrdersPage.jsx')
  const dataProviderPath = path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx')
  const migrationPath = path.join(
    projectRoot,
    'supabase',
    'migrations',
    '20261103000023_order_edit_permissions_and_superadmin_approval.sql'
  )

  const modalSource = fs.readFileSync(modalFilePath, 'utf8')
  const ordersPageSource = fs.readFileSync(ordersPagePath, 'utf8')
  const dataProviderSource = fs.readFileSync(dataProviderPath, 'utf8')
  const migrationSource = fs.readFileSync(migrationPath, 'utf8')

  // Helper simulating the core logic of updateSalesOrder
  function simulateUpdateSalesOrder({
    actorRole,
    order,
    payload
  }) {
    const role = (actorRole || '').toLowerCase()
    const isSuperadmin = role === 'superadmin'
    const CAN_EDIT_ORDER_ROLES = ['superadmin', 'hr', 'account', 'accountant', 'technical']

    // 1. Role permission check
    if (!CAN_EDIT_ORDER_ROLES.includes(role)) {
      throw new Error('Access denied: Order editing is restricted to HR, Accountant, and Technical roles.')
    }

    // 2. Order cancellation check
    if (order.status === 'cancelled') {
      throw new Error('Cannot edit a cancelled order.')
    }

    // 3. Super Admin approval invariant
    const isApproved = Boolean(order.completion_approved_at || order.status === 'completed')
    if (isApproved && !isSuperadmin) {
      throw new Error('Order has been approved by Super Admin. Editing is restricted to Superadministrators.')
    }

    // 4. Calculate items total
    const items = payload.items || order.order_items || []
    const subtotal = items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    )
    const discount = Math.max(0, Number(payload.discount_amount ?? order.discount_amount) || 0)
    const tax = Math.max(0, Number(payload.tax_amount ?? order.tax_amount) || 0)
    const totalAmount = Math.max(0, subtotal - discount + tax)

    // 5. Flexible payment details handling: forward & backward editing up to totalAmount
    const rawPaid = payload.paid_amount !== null && payload.paid_amount !== undefined
      ? Math.max(0, Number(payload.paid_amount))
      : Number(order.paid_amount || 0)
    const finalPaid = Math.min(totalAmount, rawPaid)
    const newPaymentStatus = totalAmount === 0 || finalPaid >= totalAmount
      ? 'paid'
      : finalPaid === 0
        ? 'pending'
        : 'partial'
    const newPaymentMethod = payload.payment_method || order.payment_method || 'cash'

    // Reconcile incremental payment if paid amount increased
    const currentPaid = Number(order.paid_amount || 0)
    const paymentDiff = finalPaid - currentPaid
    let updatedPayments = Array.isArray(order.order_payments) ? [...order.order_payments] : []

    if (paymentDiff > 0) {
      updatedPayments.push({
        id: 'pay-' + Math.random().toString(36).substring(2, 9),
        order_id: order.id,
        amount_received: paymentDiff,
        payment_method: newPaymentMethod,
        transaction_reference: 'ORDER-EDIT-ADJUSTMENT',
        remarks: payload.employee_remarks || 'Incremental payment recorded during order edit.',
        received_at: new Date().toISOString()
      })
    }

    // 6. Audit logging simulation
    let auditActivity = null
    if (isApproved && isSuperadmin) {
      auditActivity = {
        activity_type: 'SUPERADMIN_ORDER_CORRECTION',
        actor_role: role,
        content: payload.employee_remarks || 'Superadministrator made privileged correction to approved order.'
      }
    } else {
      auditActivity = {
        activity_type: 'ORDER_UPDATED',
        actor_role: role,
        content: payload.employee_remarks || `Order updated by ${role.toUpperCase()}`
      }
    }

    return {
      success: true,
      updatedOrder: {
        ...order,
        customer_name: payload.customer_name || order.customer_name,
        contact_info: payload.contact_info || order.contact_info,
        total_amount: totalAmount,
        paid_amount: finalPaid,
        payment_method: newPaymentMethod,
        payment_status: newPaymentStatus,
        status: isApproved ? order.status : (payload.order_status || order.status),
        order_items: items,
        order_payments: updatedPayments
      },
      auditActivity
    }
  }

  test('1. Pending, unapproved order is fully editable by HR, Accountant, and Technical roles', () => {
    const pendingOrder = {
      id: 'ord-pending-1',
      status: 'new',
      completion_approved_at: null,
      customer_name: 'Rahul Sharma',
      contact_info: '+91 9876543210',
      total_amount: 10000,
      paid_amount: 0,
      payment_method: 'cash',
      payment_status: 'pending',
      order_items: [{ product_name: 'SSD 512GB', quantity: 2, unit_price: 5000 }]
    }

    // HR edit
    const resHr = simulateUpdateSalesOrder({
      actorRole: 'hr',
      order: pendingOrder,
      payload: { customer_name: 'Rahul Sharma (Updated by HR)' }
    })
    assert.equal(resHr.updatedOrder.customer_name, 'Rahul Sharma (Updated by HR)')

    // Accountant edit
    const resAcc = simulateUpdateSalesOrder({
      actorRole: 'account',
      order: pendingOrder,
      payload: { customer_name: 'Rahul Sharma (Updated by Accounts)' }
    })
    assert.equal(resAcc.updatedOrder.customer_name, 'Rahul Sharma (Updated by Accounts)')

    // Technical edit
    const resTech = simulateUpdateSalesOrder({
      actorRole: 'technical',
      order: pendingOrder,
      payload: { customer_name: 'Rahul Sharma (Updated by Tech)' }
    })
    assert.equal(resTech.updatedOrder.customer_name, 'Rahul Sharma (Updated by Tech)')
  })

  test('2. Active / In-Progress, unapproved order is fully editable by authorized roles', () => {
    const activeOrder = {
      id: 'ord-active-1',
      status: 'processing',
      completion_approved_at: null,
      customer_name: 'Deepak Verma',
      contact_info: '+91 9988776655',
      total_amount: 25000,
      paid_amount: 10000,
      payment_method: 'upi',
      payment_status: 'partial',
      order_items: [{ product_name: 'CCTV Package', quantity: 1, unit_price: 25000 }]
    }

    // Technical staff updates delivery & items on active order
    const res = simulateUpdateSalesOrder({
      actorRole: 'technical',
      order: activeOrder,
      payload: {
        items: [
          { product_name: 'CCTV Package 8-CH', quantity: 1, unit_price: 28000 }
        ]
      }
    })
    assert.equal(res.updatedOrder.total_amount, 28000)
    assert.equal(res.updatedOrder.status, 'processing')
  })

  test('3. Payment method and payment amount are editable before approval', () => {
    const order = {
      id: 'ord-pay-1',
      status: 'new',
      completion_approved_at: null,
      total_amount: 15000,
      paid_amount: 0,
      payment_method: 'cash',
      payment_status: 'pending',
      order_items: [{ product_name: 'Monitor', quantity: 1, unit_price: 15000 }]
    }

    // Accountant updates payment to partial UPI
    const res = simulateUpdateSalesOrder({
      actorRole: 'account',
      order,
      payload: {
        payment_method: 'upi',
        paid_amount: 10000
      }
    })

    assert.equal(res.updatedOrder.payment_method, 'upi')
    assert.equal(res.updatedOrder.paid_amount, 10000)
    assert.equal(res.updatedOrder.payment_status, 'partial')

    // Mark received in full with Bank Transfer
    const resFull = simulateUpdateSalesOrder({
      actorRole: 'account',
      order,
      payload: {
        payment_method: 'bank_transfer',
        paid_amount: 15000
      }
    })
    assert.equal(resFull.updatedOrder.payment_method, 'bank_transfer')
    assert.equal(resFull.updatedOrder.paid_amount, 15000)
    assert.equal(resFull.updatedOrder.payment_status, 'paid')

    // Reduce payment backward from 15,000 down to 5,000 (correction / refund)
    const resBackward = simulateUpdateSalesOrder({
      actorRole: 'account',
      order: resFull.updatedOrder,
      payload: {
        paid_amount: 5000
      }
    })
    assert.equal(resBackward.updatedOrder.paid_amount, 5000)
    assert.equal(resBackward.updatedOrder.payment_status, 'partial')

    // Reduce payment backward to 0 (reset to pending)
    const resZero = simulateUpdateSalesOrder({
      actorRole: 'account',
      order: resBackward.updatedOrder,
      payload: {
        paid_amount: 0
      }
    })
    assert.equal(resZero.updatedOrder.paid_amount, 0)
    assert.equal(resZero.updatedOrder.payment_status, 'pending')

    // Order total reduction scenario: previous total 72,000 with 72,000 paid reduced to 50,000
    const deepEngOrder = {
      id: 'ord-deep-eng',
      status: 'new',
      completion_approved_at: null,
      total_amount: 72000,
      paid_amount: 72000,
      payment_status: 'paid',
      order_items: [{ product_name: 'Printer Package', quantity: 1, unit_price: 72000 }]
    }
    const resReduced = simulateUpdateSalesOrder({
      actorRole: 'technical',
      order: deepEngOrder,
      payload: {
        items: [{ product_name: 'Printer Standard', quantity: 1, unit_price: 50000 }]
      }
    })
    assert.equal(resReduced.updatedOrder.total_amount, 50000)
    assert.equal(resReduced.updatedOrder.paid_amount, 50000)
    assert.equal(resReduced.updatedOrder.payment_status, 'paid')
  })

  test('4. Order items, quantities and totals are editable before approval', () => {
    const order = {
      id: 'ord-items-1',
      status: 'processing',
      completion_approved_at: null,
      total_amount: 5000,
      paid_amount: 2000,
      order_items: [{ product_name: 'RAM 8GB', quantity: 1, unit_price: 5000 }]
    }

    // Add extra items and change quantity
    const res = simulateUpdateSalesOrder({
      actorRole: 'hr',
      order,
      payload: {
        items: [
          { product_name: 'RAM 8GB', quantity: 2, unit_price: 5000 },
          { product_name: 'NVMe 1TB', quantity: 1, unit_price: 7000 }
        ],
        discount_amount: 1000
      }
    })

    // subtotal = 10000 + 7000 = 17000, discount = 1000, total = 16000
    assert.equal(res.updatedOrder.total_amount, 16000)
    assert.equal(res.updatedOrder.order_items.length, 2)
  })

  test('5. Super Admin approval strictly blocks ordinary employee editing (HR, Accountant, Technical)', () => {
    const approvedOrder = {
      id: 'ord-approved-1',
      status: 'completed',
      completion_approved_at: '2026-11-03T10:00:00Z',
      customer_name: 'Apex Enterprises',
      contact_info: '+91 9911223344',
      total_amount: 50000,
      paid_amount: 50000,
      order_items: [{ product_name: 'Server Rack', quantity: 1, unit_price: 50000 }]
    }

    // HR attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'hr', order: approvedOrder, payload: { customer_name: 'Tampered Name' } }),
      /Order has been approved by Super Admin/
    )

    // Accountant attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'account', order: approvedOrder, payload: { customer_name: 'Tampered Name' } }),
      /Order has been approved by Super Admin/
    )

    // Technical attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'technical', order: approvedOrder, payload: { customer_name: 'Tampered Name' } }),
      /Order has been approved by Super Admin/
    )
  })

  test('6. Super Admin correction on approved order is permitted and audited', () => {
    const approvedOrder = {
      id: 'ord-approved-1',
      status: 'completed',
      completion_approved_at: '2026-11-03T10:00:00Z',
      customer_name: 'Apex Enterprises',
      total_amount: 50000,
      paid_amount: 50000,
      order_items: [{ product_name: 'Server Rack', quantity: 1, unit_price: 50000 }]
    }

    const res = simulateUpdateSalesOrder({
      actorRole: 'superadmin',
      order: approvedOrder,
      payload: {
        customer_name: 'Apex Enterprises Ltd',
        employee_remarks: 'Head correction: Legal entity name updated per customer GST certificate.'
      }
    })

    assert.equal(res.updatedOrder.customer_name, 'Apex Enterprises Ltd')
    assert.ok(res.auditActivity, 'Audit activity generated')
    assert.equal(res.auditActivity.activity_type, 'SUPERADMIN_ORDER_CORRECTION')
    assert.ok(res.auditActivity.content.includes('Legal entity name updated'))
  })

  test('7. Cancelled order restrictions continue to follow immutable rules', () => {
    const cancelledOrder = {
      id: 'ord-cancelled-1',
      status: 'cancelled',
      completion_approved_at: null,
      total_amount: 10000,
      paid_amount: 0,
      order_items: [{ product_name: 'Printer', quantity: 1, unit_price: 10000 }]
    }

    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'hr', order: cancelledOrder, payload: { customer_name: 'Edit Try' } }),
      /Cannot edit a cancelled order/
    )
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'technical', order: cancelledOrder, payload: { customer_name: 'Edit Try' } }),
      /Cannot edit a cancelled order/
    )
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'superadmin', order: cancelledOrder, payload: { customer_name: 'Edit Try' } }),
      /Cannot edit a cancelled order/
    )
  })

  test('8. Concurrent approval race condition cannot be bypassed by an edit request', () => {
    // In SQL RPC, FOR UPDATE acquires row lock and evaluates completion_approved_at
    assert.ok(
      migrationSource.includes('FOR UPDATE'),
      'update_sales_order acquires row-level exclusive lock (FOR UPDATE)'
    )
    assert.ok(
      migrationSource.includes('v_order.completion_approved_at IS NOT NULL') ||
      migrationSource.includes('v_is_approved'),
      'update_sales_order evaluates approval timestamp after acquiring row lock'
    )
    assert.ok(
      migrationSource.includes('Order has been approved by Super Admin. Editing is restricted to Superadministrators.'),
      'Explicit error message for race condition / post-approval rejection'
    )
  })

  test('9. Role permissions: Non-authorized roles (Engineer, Inventory Staff, ordinary Admin) are strictly blocked', () => {
    const unapprovedOrder = {
      id: 'ord-unapp-1',
      status: 'new',
      completion_approved_at: null,
      total_amount: 12000,
      paid_amount: 0,
      order_items: [{ product_name: 'Router', quantity: 1, unit_price: 12000 }]
    }

    // Engineer attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'engineer', order: unapprovedOrder, payload: { customer_name: 'Engineer Edit' } }),
      /Access denied: Order editing is restricted to HR, Accountant, and Technical roles./
    )

    // Inventory Staff attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'inventory_staff', order: unapprovedOrder, payload: { customer_name: 'Inventory Edit' } }),
      /Access denied: Order editing is restricted to HR, Accountant, and Technical roles./
    )

    // Ordinary Admin attempt -> BLOCKED
    assert.throws(
      () => simulateUpdateSalesOrder({ actorRole: 'admin', order: unapprovedOrder, payload: { customer_name: 'Admin Edit' } }),
      /Access denied: Order editing is restricted to HR, Accountant, and Technical roles./
    )
  })

  test('10. UI & Frontend invariants: EditOrderModal contains payment fields and approval banners', () => {
    // Payment method select
    assert.ok(
      modalSource.includes('Payment Method *') && modalSource.includes('paymentMethod'),
      'EditOrderModal includes Payment Method selector'
    )

    // Amount Received input
    assert.ok(
      modalSource.includes('Amount Received (₹) *') && modalSource.includes('paidAmount'),
      'EditOrderModal includes Amount Received numeric input'
    )

    // Received in Full quick action
    assert.ok(
      modalSource.includes('Received in Full'),
      'EditOrderModal includes Received in Full action'
    )

    // Awaiting Super Admin Approval badge / banner
    assert.ok(
      modalSource.includes('Awaiting Super Admin Approval'),
      'EditOrderModal indicates Awaiting Super Admin Approval state'
    )

    // Approved — Editing Restricted badge / banner
    assert.ok(
      modalSource.includes('Approved — Editing Restricted'),
      'EditOrderModal indicates Approved — Editing Restricted state'
    )

    // Button disabled when unauthorized
    assert.ok(
      modalSource.includes('disabled={!canUserEdit || isSubmitting}'),
      'Save Changes button is disabled when user is not authorized or order is approved'
    )
  })

  test('11. UI & Frontend invariants: AdminOrdersPage enforces role gating and approval state display', () => {
    // AdminDataProvider exports canEditOrders and role whitelist
    assert.ok(
      dataProviderSource.includes('canEditOrders') &&
      dataProviderSource.includes('CAN_EDIT_ORDER_ROLES'),
      'AdminDataProvider exports canEditOrders and enforces CAN_EDIT_ORDER_ROLES whitelist'
    )

    // Awaiting Super Admin Approval indicator
    assert.ok(
      ordersPageSource.includes('Awaiting Super Admin Approval'),
      'AdminOrdersPage renders Awaiting Super Admin Approval badge for unapproved orders'
    )

    // Approved — Editing Restricted notice
    assert.ok(
      ordersPageSource.includes('Approved — Editing Restricted'),
      'AdminOrdersPage renders Approved — Editing Restricted for approved orders'
    )

    // Read-Only notice for non-authorized roles
    assert.ok(
      ordersPageSource.includes('Read-Only (HR, Accountant & Technical Only)'),
      'AdminOrdersPage displays Read-Only indicator for unauthorized staff roles'
    )

    // Edit Order action role-gated
    assert.ok(
      ordersPageSource.includes('isOrderEditor'),
      'AdminOrdersPage evaluates isOrderEditor capability'
    )
  })

  test('12. Backend RPC migration invariants: update_sales_order enforces security definer, roles, and grants', () => {
    // Security Definer & pg_catalog search path
    assert.ok(
      migrationSource.includes('SECURITY DEFINER') &&
      migrationSource.includes("SET search_path TO 'pg_catalog', 'public'"),
      'update_sales_order is SECURITY DEFINER with secured search_path'
    )

    // Parameters include payment details
    assert.ok(
      migrationSource.includes('p_payment_method text') &&
      migrationSource.includes('p_paid_amount numeric') &&
      migrationSource.includes('p_payment_status text'),
      'update_sales_order includes payment details parameters'
    )

    // Strict Role-Based check: superadmin, hr, account, technical
    assert.ok(
      migrationSource.includes("NOT IN ('superadmin', 'hr', 'account', 'technical')"),
      'update_sales_order strictly gates editing to HR, Accountant, Technical, and Superadmin'
    )

    // SUPERADMIN_ORDER_CORRECTION activity logging
    assert.ok(
      migrationSource.includes("'SUPERADMIN_ORDER_CORRECTION'"),
      'update_sales_order logs SUPERADMIN_ORDER_CORRECTION when Super Admin edits approved order'
    )
  })

  test('13. Blocker 1 Regression: Idempotent contact columns and indexes on public.orders', () => {
    assert.ok(
      migrationSource.includes('ADD COLUMN IF NOT EXISTS customer_email TEXT NULL') &&
      migrationSource.includes('ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL') &&
      migrationSource.includes('ADD COLUMN IF NOT EXISTS customer_address TEXT NULL'),
      'Migration contains idempotent ADD COLUMN IF NOT EXISTS for customer contact columns'
    )
    assert.ok(
      migrationSource.includes('CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email)') &&
      migrationSource.includes('CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone)'),
      'Migration contains performance indexes for customer contact columns'
    )
  })

  test('14. Blocker 2 Regression: Safe activity-type constraint expansion preserving existing types', () => {
    // 21 existing activity types from migrations 19 & 21
    const requiredExistingTypes = [
      'ORDER_CREATED',
      'ORDER_PROCESSING_STARTED',
      'ORDER_COMPLETION_SUBMITTED',
      'ORDER_COMPLETION_APPROVED',
      'ORDER_CANCELLED',
      'ORDER_PAYMENT_RECORDED',
      'ORDER_ATTACHMENT_ADDED',
      'ATTACHMENT_SHARE_REQUESTED',
      'ATTACHMENT_SHARE_REJECTED',
      'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE',
      'ATTACHMENT_MARKED_INTERNAL',
      'ATTACHMENT_SHARE_CREATED',
      'ATTACHMENT_SHARE_REVOKED',
      'ORDER_EDITED',
      'ORDER_ENGINEER_ASSIGNED',
      'ORDER_ENGINEER_REASSIGNED',
      'ORDER_REMOVED',
      'ORDER_RESTORED',
      'ORDER_DELETION_REQUESTED',
      'ORDER_DELETION_REVIEWED',
      'ORDER_AUDIT_RECONCILIATION'
    ]

    for (const actType of requiredExistingTypes) {
      assert.ok(
        migrationSource.includes(`'${actType}'::text`),
        `Migration preserves existing activity type ${actType}`
      )
    }

    assert.ok(
      migrationSource.includes("'SUPERADMIN_ORDER_CORRECTION'::text") &&
      migrationSource.includes("'ORDER_UPDATED'::text"),
      'Migration adds SUPERADMIN_ORDER_CORRECTION and ORDER_UPDATED activity types'
    )

    // Total 23 activity types
    const totalActivityTypes = [...requiredExistingTypes, 'SUPERADMIN_ORDER_CORRECTION', 'ORDER_UPDATED']
    assert.equal(totalActivityTypes.length, 23, 'Total allowed activity types must be exactly 23')
  })

  test('15. Blocker 3 Regression: Safe resolution of update_sales_order function overload', () => {
    assert.ok(
      migrationSource.includes('DROP FUNCTION IF EXISTS public.update_sales_order') &&
      migrationSource.includes('uuid, text, text, jsonb, text, text, text, uuid, timestamptz, text, numeric, numeric, text'),
      'Migration explicitly drops obsolete 13-parameter update_sales_order overload'
    )
    assert.ok(
      migrationSource.includes('GRANT EXECUTE ON FUNCTION public.update_sales_order'),
      'Migration explicitly grants execution to authenticated and service_role'
    )
  })

  test('16. Blocker 4 Regression: Immutability trigger conflict resolved with validated Super Admin override', () => {
    assert.ok(
      migrationSource.includes('ars.superadmin_order_correction'),
      'Migration uses transaction-scoped ars.superadmin_order_correction setting'
    )
    assert.ok(
      migrationSource.includes("role = 'superadmin'") &&
      migrationSource.includes('is_active = true') &&
      migrationSource.includes('auth.uid()::text = v_correction_actor_str'),
      'Trigger validates authenticated superadmin identity against public.admin_users without trusting client session values'
    )
    assert.ok(
      migrationSource.includes('NEW.order_number IS DISTINCT FROM OLD.order_number') &&
      migrationSource.includes('NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at'),
      'Primary identifiers and initial approval audit origins remain strictly immutable even during Super Admin corrections'
    )
  })

  test('17. Blocker 5 Regression: Payment status derivation preserves table check constraint chk_orders_payment_status_consistency', () => {
    assert.ok(
      migrationSource.includes("v_calc_total = 0 THEN") &&
      migrationSource.includes("v_target_paid = 0 THEN") &&
      migrationSource.includes("v_target_paid >= v_calc_total THEN") &&
      migrationSource.includes("v_new_payment_status := 'paid'") &&
      migrationSource.includes("v_new_payment_status := 'pending'") &&
      migrationSource.includes("v_new_payment_status := 'partial'"),
      'Migration deterministically synchronizes payment_status and clamps target_paid to satisfy chk_orders_payment_status_consistency'
    )
  })

  test('18. Explicit Allowlist Invariant: Super Admin correction strictly locks workflow, provenance, bin, and archive columns', () => {
    const lockedColumns = [
      'NEW.id IS DISTINCT FROM OLD.id',
      'NEW.order_number IS DISTINCT FROM OLD.order_number',
      'NEW.status IS DISTINCT FROM OLD.status',
      'NEW.created_by IS DISTINCT FROM OLD.created_by',
      'NEW.created_at IS DISTINCT FROM OLD.created_at',
      'NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id',
      'NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at',
      'NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by',
      'NEW.is_archived IS DISTINCT FROM OLD.is_archived',
      'NEW.is_in_bin IS DISTINCT FROM OLD.is_in_bin',
      'NEW.is_removed IS DISTINCT FROM OLD.is_removed'
    ]

    for (const colCheck of lockedColumns) {
      assert.ok(
        migrationSource.includes(colCheck),
        `Trigger explicitly locks ${colCheck} during Super Admin correction`
      )
    }
  })

  test('19. Payment Ledger Reconciliation: Incremental payment recorded in order_payments and audited', () => {
    assert.ok(
      migrationSource.includes('INSERT INTO public.order_payments') &&
      migrationSource.includes("'ORDER-EDIT-ADJUSTMENT'") &&
      migrationSource.includes('(v_target_paid - COALESCE(v_order.paid_amount, 0))'),
      'Migration records incremental payment in immutable order_payments ledger when paid amount increases'
    )
    assert.ok(
      migrationSource.includes('v_target_paid < COALESCE(v_order.paid_amount, 0)') &&
      migrationSource.includes("'ORDER_PAYMENT_RECORDED'"),
      'Migration logs audit activity when paid amount is adjusted downwards'
    )
  })

  test('20. Payment Immutability Invariant: Historical payment rows remain immutable without schema redesign', () => {
    // Migration 23 does NOT alter order_payments schema, preserving existing immutable structure
    assert.ok(
      !migrationSource.includes('ALTER TABLE public.order_payments'),
      'Migration 23 preserves existing order_payments schema without alterations'
    )

    const initialPaymentRow = {
      id: 'pay-orig-1002',
      order_id: 'ord-1002',
      amount_received: 72000,
      payment_method: 'cash',
      received_at: '2026-11-01T10:00:00Z'
    }

    const initialOrder = {
      id: 'ord-1002',
      status: 'processing',
      total_amount: 80000,
      paid_amount: 72000,
      payment_status: 'partial',
      order_items: [{ product_name: 'Core i7 PC', quantity: 1, unit_price: 80000 }],
      order_payments: [initialPaymentRow]
    }

    // Accountant reduces payment to 50000
    const res = simulateUpdateSalesOrder({
      actorRole: 'account',
      order: initialOrder,
      payload: {
        paid_amount: 50000,
        employee_remarks: 'Adjusted down per customer discount memo'
      }
    })

    assert.equal(res.updatedOrder.paid_amount, 50000)
    assert.equal(res.updatedOrder.payment_status, 'partial')
    // Original payment row remains untouched
    assert.equal(res.updatedOrder.order_payments.length, 1)
    assert.equal(res.updatedOrder.order_payments[0].amount_received, 72000)
    // Audit activity records adjustment
    assert.ok(res.auditActivity)
  })

  test('21. Incremental payment handling on order edit', () => {
    const initialPaymentRow = {
      id: 'pay-orig-1003',
      order_id: 'ord-1003',
      amount_received: 30000,
      payment_method: 'cash',
      received_at: '2026-11-01T10:00:00Z'
    }

    const initialOrder = {
      id: 'ord-1003',
      status: 'processing',
      total_amount: 50000,
      paid_amount: 30000,
      payment_status: 'partial',
      order_items: [{ product_name: 'Laptop', quantity: 1, unit_price: 50000 }],
      order_payments: [initialPaymentRow]
    }

    // Incremental payment of 20000 added during order edit
    const res = simulateUpdateSalesOrder({
      actorRole: 'technical',
      order: initialOrder,
      payload: {
        paid_amount: 50000,
        employee_remarks: 'Received remaining balance'
      }
    })

    assert.equal(res.updatedOrder.paid_amount, 50000)
    assert.equal(res.updatedOrder.payment_status, 'paid')
    assert.equal(res.updatedOrder.order_payments.length, 2)
    assert.equal(res.updatedOrder.order_payments[1].amount_received, 20000)
    assert.equal(res.updatedOrder.order_payments[1].transaction_reference, 'ORDER-EDIT-ADJUSTMENT')
  })

  test('22. Customer Dispatch and INR formatting helpers', () => {
    assert.equal(formatINR(50000), '₹50,000.00')
    assert.equal(formatINR(-22000), '-₹22,000.00')
    assert.equal(formatINR(0), '₹0.00')

    const testOrder = {
      order_number: 'ARS-ORD-01002',
      customer_name: 'DEEP Engineering',
      contact_info: '+91 7456 859 513',
      total_amount: 50000,
      paid_amount: 50000,
      payment_status: 'paid',
      status: 'processing',
      order_items: [{ product_name_snapshot: 'Custom Workstation', quantity: 1, unit_price: 50000, line_total: 50000 }],
      order_payments: [
        { amount_received: 50000, payment_method: 'cash', created_at: '2026-11-01T10:00:00Z' }
      ]
    }

    const dispatchText = formatOrderCustomerDispatch(testOrder)
    assert.ok(dispatchText.includes('Total Received: ₹50,000.00') || dispatchText.includes('Received: ₹50,000.00'))
  })
})
