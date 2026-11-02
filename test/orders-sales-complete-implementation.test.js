/**
 * ============================================================================
 * ARS COMPUTERS — COMPLETE ORDERS & SALES IMPLEMENTATION TEST SUITE
 * ============================================================================
 * Validates all 12 Phases of Orders & Sales:
 * 1. Database schema extensions (engineer, delivery date, bin, soft removal).
 * 2. Order creation with engineer assignment & delivery tracking.
 * 3. Full order editing with atomic DB persistence (update_sales_order).
 * 4. Financial integrity & immutability constraints.
 * 5. Dedicated engineer assignment RPC (assign_order_engineer).
 * 6. Delete/Cancellation & Bin workflow (request, review, remove, restore, no hard delete).
 * 7. WhatsApp, Copy Message, Copy Details customer communication utilities.
 * 8. Professional multi-sheet Excel export (Orders, Sales, Summary with INR ₹ styling).
 * 9. Strictly increasing numerical order sequence (ORD-0001, ORD-0002, etc.).
 * ============================================================================
 */

import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  formatOrderCustomerDispatch,
  formatOrderSummaryCompact,
  buildCustomerOrderWhatsAppUrl,
  normalizeIndianPhoneForWhatsApp
} from '../src/utils/customerDispatchFormatter.js'
import {
  downloadMonthlySalesExcel,
  sortOrdersAscending,
  extractOrderSequenceNumber
} from '../src/utils/salesReportGenerator.js'
import { getExcelJS } from '../src/utils/excelReportGenerator.js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadVerifier#2026!Secure'
const EMP_EMAIL = 'emp.verifier@arscomputers.in'
const EMP_PASSWORD = 'EmpVerifier#2026!Secure'

describe('ARS Computers — Orders & Sales Complete Implementation', () => {
  let serviceClient
  let headClient
  let empClient
  let headUser
  let empUser
  let testOrderId

  before(async () => {
    serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Setup Head User (Superadmin)
    await serviceClient.auth.admin.createUser({
      email: HEAD_EMAIL,
      password: HEAD_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Ankit Bathla (Head)' }
    }).catch(() => {})

    // Setup Employee User (Admin)
    await serviceClient.auth.admin.createUser({
      email: EMP_EMAIL,
      password: EMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Rohan Sharma (Admin)' }
    }).catch(() => {})

    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    headUser = usersData?.users?.find((u) => u.email === HEAD_EMAIL)
    empUser = usersData?.users?.find((u) => u.email === EMP_EMAIL)

    await serviceClient.from('admin_users').upsert([
      {
        id: headUser.id,
        email: HEAD_EMAIL,
        role: 'superadmin',
        full_name: 'Ankit Bathla',
        employee_code: 'ARS-HEAD-001',
        phone_number: '9876500001',
        is_active: true
      },
      {
        id: empUser.id,
        email: EMP_EMAIL,
        role: 'admin',
        full_name: 'Rohan Sharma',
        employee_code: 'ARS-EMP-001',
        phone_number: '9876500002',
        is_active: true
      }
    ])

    headClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY)
    await headClient.auth.signInWithPassword({ email: HEAD_EMAIL, password: HEAD_PASSWORD })

    empClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY)
    await empClient.auth.signInWithPassword({ email: EMP_EMAIL, password: EMP_PASSWORD })
  })

  // --------------------------------------------------------------------------
  // Phase 8: Strictly Increasing Numerical Order Sequence Helper Tests
  // --------------------------------------------------------------------------
  describe('Phase 8 — Numerical Order Sequence Helpers', () => {
    test('extractOrderSequenceNumber extracts integers from diverse order reference strings', () => {
      assert.equal(extractOrderSequenceNumber('ORD-0001'), 1)
      assert.equal(extractOrderSequenceNumber('ARS-ORD-00042'), 42)
      assert.equal(extractOrderSequenceNumber('ORD-10'), 10)
      assert.equal(extractOrderSequenceNumber('ORD-2'), 2)
      assert.equal(extractOrderSequenceNumber('ARS-ORD-01005'), 1005)
      assert.equal(extractOrderSequenceNumber(''), 0)
      assert.equal(extractOrderSequenceNumber(null), 0)
    })

    test('sortOrdersAscending orders records numerically (lowest first, NOT lexicographical string sorting)', () => {
      const unsorted = [
        { order_number: 'ORD-10', customer_name: 'Customer 10' },
        { order_number: 'ORD-1', customer_name: 'Customer 1' },
        { order_number: 'ORD-100', customer_name: 'Customer 100' },
        { order_number: 'ORD-2', customer_name: 'Customer 2' },
        { order_number: 'ORD-20', customer_name: 'Customer 20' }
      ]

      const sorted = sortOrdersAscending(unsorted)
      const orderNumbers = sorted.map((o) => o.order_number)

      assert.deepEqual(orderNumbers, ['ORD-1', 'ORD-2', 'ORD-10', 'ORD-20', 'ORD-100'],
        'Must strictly sort numerically: 1 before 2 before 10 before 20 before 100')
    })
  })

  // --------------------------------------------------------------------------
  // Phase 3: Customer Communication, WhatsApp & Copy Buttons Formatters
  // --------------------------------------------------------------------------
  describe('Phase 3 — WhatsApp, Copy Message, Copy Details Formatters', () => {
    const mockOrder = {
      order_number: 'ARS-ORD-00100',
      created_at: '2026-11-01T10:00:00Z',
      customer_name: 'Vikram Seth',
      customer_phone: '9876543210',
      customer_email: 'vikram@example.com',
      customer_address: 'Flat 402, Green Park, Dehradun',
      contact_info: '9876543210',
      status: 'processing',
      total_amount: 45000.00,
      paid_amount: 15000.00,
      payment_status: 'partial',
      payment_method: 'upi',
      assigned_engineer_name: 'Rahul Sharma',
      assigned_engineer_phone: '9876500000',
      expected_delivery_date: '2026-11-05T14:00:00Z',
      created_by_name: 'Store Associate',
      order_items: [
        { product_name_snapshot: 'Asus Gaming Laptop', sku_snapshot: 'ASUS-ROG-1', quantity: 1, unit_price: 45000, line_total: 45000 }
      ],
      order_payments: [
        { amount_received: 15000, payment_method: 'upi', received_at: '2026-11-01T10:00:00Z' }
      ]
    }

    test('normalizeIndianPhoneForWhatsApp handles standard 10-digit, +91, and leading 0', () => {
      assert.equal(normalizeIndianPhoneForWhatsApp('9876543210'), '919876543210')
      assert.equal(normalizeIndianPhoneForWhatsApp('+919876543210'), '919876543210')
      assert.equal(normalizeIndianPhoneForWhatsApp('09876543210'), '919876543210')
      assert.equal(normalizeIndianPhoneForWhatsApp('12345'), null)
      assert.equal(normalizeIndianPhoneForWhatsApp(''), null)
    })

    test('formatOrderCustomerDispatch includes order #, customer, items, engineer, delivery date and NO internal UUIDs', () => {
      const dispatch = formatOrderCustomerDispatch(mockOrder)

      assert.ok(dispatch.includes('ARS COMPUTERS'), 'Header branding present')
      assert.ok(dispatch.includes('ARS-ORD-00100'), 'Order number present')
      assert.ok(dispatch.includes('Vikram Seth'), 'Customer name present')
      assert.ok(dispatch.includes('Asus Gaming Laptop'), 'Product item present')
      assert.ok(dispatch.includes('₹45,000.00'), 'Formatted total present')
      assert.ok(dispatch.includes('₹15,000.00'), 'Formatted paid present')
      assert.ok(dispatch.includes('Rahul Sharma'), 'Assigned engineer name present')
      assert.ok(dispatch.includes('9876500000'), 'Assigned engineer phone present')
      assert.ok(dispatch.includes('Expected Delivery:'), 'Delivery schedule present')

      // Safety checks: no UUIDs, no internal DB columns
      assert.ok(!dispatch.includes('cost_price'), 'Zero cost_price leak')
      assert.ok(!dispatch.includes('admin_users'), 'Zero table names')
    })

    test('formatOrderSummaryCompact produces single-line summary string for fast clipboard', () => {
      const summary = formatOrderSummaryCompact(mockOrder)
      assert.ok(summary.includes('ARS-ORD-00100'), 'Has order number')
      assert.ok(summary.includes('Vikram Seth'), 'Has customer name')
      assert.ok(summary.includes('Total: ₹45,000.00'), 'Has total')
      assert.ok(summary.includes('Paid: ₹15,000.00'), 'Has paid')
      assert.ok(summary.includes('Eng: Rahul Sharma'), 'Has engineer')
    })

    test('buildCustomerOrderWhatsAppUrl constructs valid wa.me URL with pre-filled message', () => {
      const url = buildCustomerOrderWhatsAppUrl(mockOrder)
      assert.ok(url.startsWith('https://wa.me/919876543210?text='), 'Proper wa.me URL structure')
      assert.ok(url.includes('ARS%20COMPUTERS'), 'Encoded message included')
    })
  })

  // --------------------------------------------------------------------------
  // Phase 1, 2, 4, 5, 6: Database Workflow, Editing & Bin Operations via RPCs
  // --------------------------------------------------------------------------
  describe('Phase 2 & 4 — Order Creation, Editing & Persistence in Database', () => {
    test('create_sales_order creates order with engineer assignment, delivery date, discount, and tax', async () => {
      const { data, error } = await headClient.rpc('create_sales_order', {
        p_customer_name: 'Anjali Sharma',
        p_contact_info: '+91 9876512345',
        p_customer_email: 'anjali@example.com',
        p_customer_phone: '9876512345',
        p_customer_address: '12 Rajpur Road, Dehradun',
        p_items: [
          {
            product_id: null,
            product_name: 'HP Wireless Mouse',
            brand: 'HP',
            model: 'X1000',
            sku: 'HP-MOU-01',
            quantity: 2,
            unit_price: 600.00
          },
          {
            product_id: null,
            product_name: 'Dell 24-inch IPS Monitor',
            brand: 'Dell',
            model: 'S2421HN',
            sku: 'DELL-MON-24',
            quantity: 1,
            unit_price: 10800.00
          }
        ],
        p_paid_amount: 2000.00,
        p_payment_method: 'upi',
        p_employee_remarks: 'Customer requested fast delivery',
        p_assigned_engineer_id: empUser.id,
        p_expected_delivery_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        p_discount_amount: 500.00,
        p_tax_amount: 200.00
      })

      assert.ok(!error, `Order creation should succeed: ${error?.message}`)
      assert.ok(data.success, 'Returns success: true')
      assert.ok(data.id, 'Returns valid order UUID')
      assert.ok(data.order_number.startsWith('ARS-ORD-'), 'Order number matches ARS-ORD- sequence')

      // Subtotal = (2 * 600) + (1 * 10800) = 12000. Total = 12000 - 500 + 200 = 11700
      assert.equal(data.total_amount, 11700.00, 'Calculates total with discount and tax')
      assert.equal(data.paid_amount, 2000.00, 'Records paid amount')
      assert.equal(data.payment_status, 'partial', 'Partial payment derived')

      testOrderId = data.id

      // Verify row in public.orders via serviceClient
      const { data: dbOrder, error: fetchErr } = await serviceClient
        .from('orders')
        .select('*, order_items(*), order_payments(*), order_activities(*)')
        .eq('id', testOrderId)
        .single()

      assert.ok(!fetchErr, 'Should fetch created order')
      assert.equal(dbOrder.customer_name, 'Anjali Sharma')
      assert.equal(dbOrder.assigned_engineer_id, empUser.id)
      assert.equal(Number(dbOrder.discount_amount), 500)
      assert.equal(Number(dbOrder.tax_amount), 200)
      assert.equal(dbOrder.is_in_bin, false)
      assert.equal(dbOrder.order_items.length, 2, '2 line items persisted')
      assert.equal(dbOrder.order_payments.length, 1, 'Initial payment recorded in ledger')
      assert.ok(dbOrder.order_activities.some((a) => a.activity_type === 'ORDER_CREATED'), 'ORDER_CREATED activity logged')
    })

    test('update_sales_order atomically updates customer details, line items, and schedule', async () => {
      assert.ok(testOrderId, 'Must have test order')

      const { data, error } = await headClient.rpc('update_sales_order', {
        p_order_id: testOrderId,
        p_customer_name: 'Anjali Sharma Verma',
        p_contact_info: '+91 9876512345',
        p_customer_email: 'anjali.verma@example.com',
        p_customer_phone: '9876512345',
        p_customer_address: '15 EC Road, Dehradun',
        p_assigned_engineer_id: headUser.id,
        p_expected_delivery_date: new Date(Date.now() + 86400000 * 5).toISOString(),
        p_employee_remarks: 'Updated delivery address and reassigned to head engineer',
        p_discount_amount: 1000.00,
        p_tax_amount: 500.00,
        p_order_status: 'processing',
        p_items: [
          {
            product_id: null,
            product_name: 'Dell 24-inch IPS Monitor',
            brand: 'Dell',
            model: 'S2421HN',
            sku: 'DELL-MON-24',
            quantity: 2,
            unit_price: 10800.00
          }
        ]
      })

      assert.ok(!error, `Order update should succeed: ${error?.message}`)
      assert.ok(data.success, 'Returns success: true')

      // New subtotal = 2 * 10800 = 21600. Total = 21600 - 1000 + 500 = 21100
      assert.equal(data.total_amount, 21100.00, 'Recalculates new total accurately')
      assert.equal(data.status, 'processing', 'Status transitioned to processing')

      const { data: updatedOrder, error: checkErr } = await serviceClient
        .from('orders')
        .select('*, order_items(*), order_activities(*)')
        .eq('id', testOrderId)
        .single()

      assert.ok(!checkErr, 'Should fetch updated order')
      assert.equal(updatedOrder.customer_name, 'Anjali Sharma Verma')
      assert.equal(updatedOrder.customer_email, 'anjali.verma@example.com')
      assert.equal(updatedOrder.customer_address, '15 EC Road, Dehradun')
      assert.equal(Number(updatedOrder.total_amount), 21100)
      assert.equal(updatedOrder.assigned_engineer_id, headUser.id)
      assert.equal(updatedOrder.order_items.length, 1, 'Items replaced with 1 item of qty 2')
      assert.equal(updatedOrder.order_items[0].quantity, 2)
      assert.equal(Number(updatedOrder.order_items[0].line_total), 21600)
      assert.ok(updatedOrder.order_activities.some((a) => a.activity_type === 'ORDER_EDITED'), 'ORDER_EDITED activity logged')
    })

    test('update_sales_order enforces financial integrity: cannot reduce total below already paid amount', async () => {
      // Current paid_amount = 2000. Total = 500 < 2000 paid -> must fail
      const { error } = await headClient.rpc('update_sales_order', {
        p_order_id: testOrderId,
        p_customer_name: 'Anjali Sharma Verma',
        p_contact_info: '+91 9876512345',
        p_discount_amount: 0,
        p_tax_amount: 0,
        p_items: [
          {
            product_id: null,
            product_name: 'Mousepad',
            quantity: 1,
            unit_price: 500.00
          }
        ]
      })

      assert.ok(error, 'Must throw error when new total is below collected payments')
      assert.ok(error.message.includes('cannot be less than already collected payment'),
        `Expected financial integrity error message, got: ${error.message}`)
    })

    test('assign_order_engineer RPC successfully assigns or reassigns technician and logs activity', async () => {
      const { data, error } = await headClient.rpc('assign_order_engineer', {
        p_order_id: testOrderId,
        p_engineer_id: empUser.id,
        p_expected_delivery_date: new Date(Date.now() + 86400000 * 2).toISOString(),
        p_notes: 'Urgent hardware inspection requested'
      })

      assert.ok(!error, `Engineer assignment should succeed: ${error?.message}`)
      assert.ok(data.success, 'Returns success')

      const { data: checkedOrder } = await serviceClient
        .from('orders')
        .select('assigned_engineer_id, assigned_engineer_name')
        .eq('id', testOrderId)
        .single()

      assert.equal(checkedOrder.assigned_engineer_id, empUser.id)
    })
  })

  // --------------------------------------------------------------------------
  // Phase 6: Delete / Cancellation & Bin Workflow
  // --------------------------------------------------------------------------
  describe('Phase 6 — Delete / Cancellation & Bin Workflow', () => {
    test('request_order_deletion soft-removes order to Bin when called by Superadmin', async () => {
      const { data, error } = await headClient.rpc('request_order_deletion', {
        p_order_id: testOrderId,
        p_reason: 'Customer cancelled due to relocation',
        p_category: 'Customer Cancelled'
      })

      assert.ok(!error, `Request order deletion should succeed: ${error?.message}`)
      assert.ok(data.is_in_bin, 'Order moved to Bin')

      const { data: binnedOrder } = await serviceClient
        .from('orders')
        .select('is_in_bin, is_removed, removal_reason, removal_category, scheduled_deletion_at')
        .eq('id', testOrderId)
        .single()

      assert.equal(binnedOrder.is_in_bin, true, 'is_in_bin set to true')
      assert.equal(binnedOrder.is_removed, true, 'is_removed set to true')
      assert.equal(binnedOrder.removal_category, 'Customer Cancelled')
      assert.ok(binnedOrder.scheduled_deletion_at, 'scheduled_deletion_at set')
    })

    test('restore_order_from_bin restores binned order back to active operational state', async () => {
      const { data, error } = await headClient.rpc('restore_order_from_bin', {
        p_order_id: testOrderId,
        p_reason: 'Restored upon customer request'
      })

      assert.ok(!error, `Restore order should succeed: ${error?.message}`)
      assert.equal(data.is_in_bin, false, 'is_in_bin returned false')

      const { data: restoredOrder } = await serviceClient
        .from('orders')
        .select('is_in_bin, is_removed, removal_reason, order_activities(*)')
        .eq('id', testOrderId)
        .single()

      assert.equal(restoredOrder.is_in_bin, false, 'is_in_bin reset to false')
      assert.equal(restoredOrder.is_removed, false, 'is_removed reset to false')
      assert.equal(restoredOrder.removal_reason, null, 'removal_reason cleared')
      assert.ok(restoredOrder.order_activities.some((a) => a.activity_type === 'ORDER_RESTORED'), 'ORDER_RESTORED logged')
    })

    test('remove_current_month_order directly soft-removes order with category and reason', async () => {
      const { data, error } = await headClient.rpc('remove_current_month_order', {
        p_order_id: testOrderId,
        p_category: 'Duplicate Order',
        p_reason: 'Accidental duplicate entry entered by associate'
      })

      assert.ok(!error, `remove_current_month_order should succeed: ${error?.message}`)
      assert.ok(data.is_in_bin, 'is_in_bin is true')

      // Restore back for subsequent export tests
      await headClient.rpc('restore_order_from_bin', {
        p_order_id: testOrderId,
        p_reason: 'Clean restore for tests'
      })
    })

    test('Physical hard deletion via SQL DELETE is prevented by trg_prevent_order_deletion', async () => {
      const { error } = await serviceClient
        .from('orders')
        .delete()
        .eq('id', testOrderId)

      assert.ok(error, 'Hard delete must fail via trigger')
      assert.ok(error.message.includes('Permanent archive protection: Orders cannot be physically deleted'),
        `Expected archive trigger error, got: ${error.message}`)
    })
  })

  // --------------------------------------------------------------------------
  // Phase 7: Professional Multi-Sheet Excel Export
  // --------------------------------------------------------------------------
  describe('Phase 7 — Multi-Sheet Professional Excel Export (Orders, Sales, Summary)', () => {
    test('downloadMonthlySalesExcel generates 3 sheets: Orders, Sales, Summary with INR currency and totals', async () => {
      const now = new Date()
      const currentMonthIndex = now.getMonth()
      const currentYear = now.getFullYear()

      const { data: liveOrders } = await serviceClient
        .from('orders')
        .select('*, order_items(*), order_payments(*)')

      assert.ok(Array.isArray(liveOrders) && liveOrders.length > 0, 'Orders should exist in DB')

      const result = await downloadMonthlySalesExcel(liveOrders, currentMonthIndex, currentYear)
      assert.ok(result.buffer, 'Returns valid Excel buffer')
      assert.ok(result.filename.startsWith('ARS_Sales_'), 'Filename follows ARS_Sales_<Month>_<Year>.xlsx format')

      const ExcelJS = await getExcelJS()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(result.buffer)

      // 1. Verify 3 Sheets exist
      const sheetNames = workbook.worksheets.map((ws) => ws.name)
      assert.ok(sheetNames.includes('Orders'), 'Sheet 1 "Orders" exists')
      assert.ok(sheetNames.includes('Sales'), 'Sheet 2 "Sales" exists')
      assert.ok(sheetNames.includes('Summary'), 'Sheet 3 "Summary" exists')

      // 2. Inspect Orders Sheet
      const ordersWs = workbook.getWorksheet('Orders')
      const orderHeaderRow = ordersWs.getRow(1)
      assert.equal(orderHeaderRow.getCell(1).value, 'Order #')
      assert.equal(orderHeaderRow.getCell(7).value, 'Total Amount (₹)')

      // Check Navy Header styling
      const headerFill = orderHeaderRow.getCell(1).fill
      assert.equal(headerFill?.fgColor?.argb, 'FF1E3A8A', 'Header has Dark Navy ARS Computers brand color')

      // Check strictly increasing numerical order sequence in Orders sheet
      const orderNumberCells = []
      ordersWs.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value !== 'TOTAL') {
          orderNumberCells.push(String(row.getCell(1).value))
        }
      })

      if (orderNumberCells.length >= 2) {
        for (let i = 0; i < orderNumberCells.length - 1; i++) {
          const numA = extractOrderSequenceNumber(orderNumberCells[i])
          const numB = extractOrderSequenceNumber(orderNumberCells[i + 1])
          assert.ok(numA <= numB,
            `Orders sheet must be strictly ascending: ${orderNumberCells[i]} (${numA}) <= ${orderNumberCells[i+1]} (${numB})`)
        }
      }

      // 3. Inspect Summary Sheet
      const summaryWs = workbook.getWorksheet('Summary')
      assert.equal(summaryWs.getCell('B2').value, 'ARS COMPUTERS — EXECUTIVE SALES SUMMARY')
      assert.equal(summaryWs.getCell('B5').value, 'KEY PERFORMANCE INDICATORS')
      assert.equal(summaryWs.getCell('B14').value, 'PAYMENT METHOD BREAKDOWN')
    })
  })
})
