/**
 * ============================================================================
 * ARS Computers — Live Orders Register & Monthly Sales Reporting Test Suite
 * ============================================================================
 * Verifies:
 * 1. 19 standard columns for Live Orders Register.
 * 2. Field extraction & safe fallback for NULL employee codes, head remarks, etc.
 * 3. Search & filter logic.
 * 4. Monthly report generation strictly based on completion_approved_at.
 * 5. Exclusion of cancelled orders from completed-sales monthly reports.
 * 6. Export to Excel format and sheet generation.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {
  ORDER_REGISTER_COLUMNS,
  extractOrderRegisterRow
} from '../src/utils/liveOrdersRegisterHelper.js'
import {
  filterOrdersByReportingMonth,
  getMonthlySalesReportFilename,
  exportLiveOrdersRegisterViewToExcel
} from '../src/utils/salesReportGenerator.js'

test('Live Orders Register & Reporting Verification Suite', async (t) => {
  await t.test('1. Validates standard 19 columns structure', () => {
    assert.strictEqual(ORDER_REGISTER_COLUMNS.length, 19, 'Should have exactly 19 register columns')
    const ids = ORDER_REGISTER_COLUMNS.map((c) => c.id)
    assert.ok(ids.includes('order_ref'), 'Must contain order_ref')
    assert.ok(ids.includes('order_date'), 'Must contain order_date')
    assert.ok(ids.includes('order_time'), 'Must contain order_time')
    assert.ok(ids.includes('customer_name'), 'Must contain customer_name')
    assert.ok(ids.includes('contact_info'), 'Must contain contact_info')
    assert.ok(ids.includes('items_summary'), 'Must contain items_summary')
    assert.ok(ids.includes('total_quantity'), 'Must contain total_quantity')
    assert.ok(ids.includes('total_amount'), 'Must contain total_amount')
    assert.ok(ids.includes('paid_amount'), 'Must contain paid_amount')
    assert.ok(ids.includes('balance_amount'), 'Must contain balance_amount')
    assert.ok(ids.includes('payment_status'), 'Must contain payment_status')
    assert.ok(ids.includes('payment_method'), 'Must contain payment_method')
    assert.ok(ids.includes('order_status'), 'Must contain order_status')
    assert.ok(ids.includes('completed_by'), 'Must contain completed_by')
    assert.ok(ids.includes('completed_by_code'), 'Must contain completed_by_code')
    assert.ok(ids.includes('completion_date'), 'Must contain completion_date')
    assert.ok(ids.includes('approved_by'), 'Must contain approved_by')
    assert.ok(ids.includes('approval_date'), 'Must contain approval_date')
    assert.ok(ids.includes('archive_status'), 'Must contain archive_status')
  })

  await t.test('2. extractOrderRegisterRow extracts all required fields safely', () => {
    const rawOrder = {
      id: 'ord-uuid-1',
      order_number: 'ARS-ORD-01001',
      created_at: '2026-10-28T10:30:00.000Z',
      customer_name: 'Rajesh Sharma',
      contact_info: '+91 98765 43210',
      total_amount: 45000,
      paid_amount: 45000,
      payment_status: 'paid',
      payment_method: 'upi',
      status: 'completed',
      is_archived: true,
      completed_by_name: 'Amit Kumar',
      completed_by_employee_code: 'EMP-042',
      completion_requested_at: '2026-10-28T11:00:00.000Z',
      approved_by_name: 'Ankit Bathla',
      completion_approved_at: '2026-10-28T12:00:00.000Z',
      order_items: [
        { product_name_snapshot: 'Intel Core i5-13400', quantity: 1, unit_price: 20000, line_total: 20000 },
        { product_name_snapshot: 'Corsair 16GB DDR5', quantity: 2, unit_price: 12500, line_total: 25000 }
      ]
    }

    const row = extractOrderRegisterRow(rawOrder)
    assert.strictEqual(row.order_ref, 'ARS-ORD-01001')
    assert.strictEqual(row.customer_name, 'Rajesh Sharma')
    assert.strictEqual(row.contact_info, '+91 98765 43210')
    assert.strictEqual(row.total_quantity, 3)
    assert.strictEqual(row.total_amount, '45000.00')
    assert.strictEqual(row.paid_amount, '45000.00')
    assert.strictEqual(row.balance_amount, '0.00')
    assert.strictEqual(row.payment_status, 'PAID')
    assert.strictEqual(row.payment_method, 'UPI')
    assert.strictEqual(row.order_status, 'completed')
    assert.strictEqual(row.archive_status, 'Permanently Archived')
    assert.strictEqual(row.completed_by_code, 'EMP-042')
    assert.ok(row.items_summary.includes('Intel Core i5-13400 (x1)'))
    assert.ok(row.items_summary.includes('Corsair 16GB DDR5 (x2)'))
  })

  await t.test('3. Handles missing/NULL values and calculates derived balance accurately', () => {
    const rawPartial = {
      order_number: 'ARS-ORD-01002',
      customer_name: 'Sunil Verma',
      contact_info: 'sunil@example.com',
      total_amount: 30000,
      paid_amount: 10000,
      payment_status: 'partial',
      status: 'processing',
      order_items: []
    }

    const row = extractOrderRegisterRow(rawPartial)
    assert.strictEqual(row.balance_amount, '20000.00')
    assert.strictEqual(row.completed_by, '—')
    assert.strictEqual(row.completed_by_code, '—')
    assert.strictEqual(row.approved_by, '—')
    assert.strictEqual(row.archive_status, 'Active')
  })

  await t.test('4. Monthly Report filtering strictly uses completion_approved_at', () => {
    const sampleOrders = [
      {
        id: '1',
        order_number: 'ARS-ORD-01001',
        status: 'completed',
        created_at: '2026-09-28T10:00:00.000Z', // Created in Sept
        completion_requested_at: '2026-10-01T10:00:00.000Z',
        completion_approved_at: '2026-10-02T10:00:00.000Z' // Approved in Oct -> Belongs to Oct
      },
      {
        id: '2',
        order_number: 'ARS-ORD-01002',
        status: 'completed',
        created_at: '2026-10-25T10:00:00.000Z', // Created in Oct
        completion_requested_at: '2026-10-31T20:00:00.000Z',
        completion_approved_at: '2026-11-01T10:00:00.000Z' // Approved in Nov -> Belongs to Nov!
      },
      {
        id: '3',
        order_number: 'ARS-ORD-01003',
        status: 'cancelled',
        created_at: '2026-10-05T10:00:00.000Z',
        cancelled_at: '2026-10-06T10:00:00.000Z'
      },
      {
        id: '4',
        order_number: 'ARS-ORD-01004',
        status: 'processing',
        created_at: '2026-10-10T10:00:00.000Z'
      }
    ]

    // October 2026 (Month index 9)
    const octOrders = filterOrdersByReportingMonth(sampleOrders, 9, 2026)
    assert.strictEqual(octOrders.length, 1, 'Only Order 1 was approved in October')
    assert.strictEqual(octOrders[0].order_number, 'ARS-ORD-01001')

    // November 2026 (Month index 10)
    const novOrders = filterOrdersByReportingMonth(sampleOrders, 10, 2026)
    assert.strictEqual(novOrders.length, 1, 'Order 2 created in Oct but approved in Nov belongs to Nov')
    assert.strictEqual(novOrders[0].order_number, 'ARS-ORD-01002')

    // Cancelled and in-progress orders must NEVER appear in completed sales report
    assert.ok(!octOrders.some((o) => o.status === 'cancelled'))
    assert.ok(!octOrders.some((o) => o.status === 'processing'))
  })

  await t.test('5. Monthly Sales Excel filename format is ARS_Sales_<Month>_<Year>.xlsx', () => {
    const filename = getMonthlySalesReportFilename(9, 2026) // October
    assert.strictEqual(filename, 'ARS_Sales_October_2026.xlsx')
  })

  await t.test('6. exportLiveOrdersRegisterViewToExcel generates valid ExcelJS workbook buffer', async () => {
    const testOrders = [
      {
        id: 'ord-1',
        order_number: 'ARS-ORD-01001',
        created_at: '2026-10-28T10:30:00.000Z',
        customer_name: 'Rajesh Sharma',
        contact_info: '+91 98765 43210',
        total_amount: 45000,
        paid_amount: 45000,
        payment_status: 'paid',
        payment_method: 'upi',
        status: 'completed',
        is_archived: true,
        order_items: [{ product_name_snapshot: 'Test Item', quantity: 1, unit_price: 45000, line_total: 45000 }]
      }
    ]

    const result = await exportLiveOrdersRegisterViewToExcel(testOrders, 'Test Export')
    assert.ok(result && result.buffer, 'Should return an export result object with buffer')
    assert.strictEqual(result.count, 1)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(result.buffer))
    const sheet = workbook.getWorksheet('Live Orders Register')
    assert.ok(sheet, 'Live Orders Register worksheet should exist')
    assert.strictEqual(sheet.rowCount >= 2, true, 'Should contain header and table data row')
    assert.strictEqual(sheet.actualColumnCount, 19, 'Should contain 19 formatted columns')
  })
})
