import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  downloadMonthlySalesExcel,
  sortOrdersAscending
} from '../src/utils/salesReportGenerator.js'
import { getExcelJS } from '../src/utils/excelReportGenerator.js'

describe('ARS Computers — Orders & Sales Excel Export & Attachment Preview Unit Tests', () => {
  const mockOrders = [
    {
      id: 'b1111111-1111-4111-8111-111111111111',
      order_number: 'ORD-0001',
      customer_name: 'Rohit Sharma',
      customer_phone: '9876543210',
      created_at: '2026-11-01T10:00:00Z',
      expected_delivery_date: '2026-11-05T18:00:00Z',
      total_amount: 45000,
      paid_amount: 25000,
      status: 'new',
      assigned_engineer_name: 'Anil Kumar',
      order_items: [
        { product_name_snapshot: 'Gaming PC Build', quantity: 1, unit_price: 45000 }
      ]
    },
    {
      id: 'b2222222-2222-4222-8222-222222222222',
      order_number: 'ORD-0002',
      customer_name: 'Pooja Verma',
      customer_phone: '9876543211',
      created_at: '2026-11-02T11:30:00Z',
      completion_approved_at: '2026-11-02T16:00:00Z',
      total_amount: 15000,
      paid_amount: 15000,
      status: 'completed',
      payment_method: 'upi',
      completed_by_name: 'Rahul Joshi',
      approved_by_name: 'Store Head',
      order_items: [
        { product_name_snapshot: '27-inch 144Hz Monitor', quantity: 1, unit_price: 15000 }
      ]
    }
  ]

  test('1. downloadMonthlySalesExcel produces valid workbook buffer and standard 3 sheets', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026) // Month 10 = November
    assert.ok(res.buffer, 'Generates valid buffer')
    assert.ok(res.filename.startsWith('ARS_Sales_'), 'Has expected file prefix')

    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const sheetNames = workbook.worksheets.map((ws) => ws.name)
    assert.deepEqual(sheetNames, ['Orders', 'Sales', 'Summary'], 'Must contain Orders, Sales, and Summary sheets')
  })

  test('2. Orders sheet has professional Navy headers, column widths, and INR currency formatting', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026)
    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const ordersWs = workbook.getWorksheet('Orders')
    const headerRow = ordersWs.getRow(1)
    assert.equal(headerRow.getCell(1).value, 'Order #')
    assert.equal(headerRow.getCell(7).value, 'Total Amount (₹)')
    assert.equal(headerRow.getCell(1).fill?.fgColor?.argb, 'FF1E3A8A', 'Header has Navy Blue brand color')

    // Find Totals row
    let foundTotal = false
    ordersWs.eachRow((row) => {
      if (row.getCell(1).value === 'TOTAL') {
        foundTotal = true
        assert.equal(row.getCell(7).value, 60000, 'Orders total sum matches sum of order amounts')
        assert.equal(row.getCell(8).value, 40000, 'Orders total paid sum matches')
        assert.equal(row.getCell(9).value, 20000, 'Orders balance matches')
      }
    })
    assert.ok(foundTotal, 'Totals row exists in Orders sheet')
  })

  test('3. Summary sheet contains Executive KPI metrics and Safe Record Management notice', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026)
    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const summaryWs = workbook.getWorksheet('Summary')
    assert.equal(summaryWs.getCell('B2').value, 'ARS COMPUTERS — EXECUTIVE SALES SUMMARY')
    assert.equal(summaryWs.getCell('B5').value, 'KEY PERFORMANCE INDICATORS')
    assert.equal(summaryWs.getCell('B14').value, 'PAYMENT METHOD BREAKDOWN')
    assert.equal(summaryWs.getCell('B22').value, 'RECORD MANAGEMENT & DATA INTEGRITY POLICY')

    // Verify compliance policy text is present
    const policyCell = summaryWs.getCell('B23')
    assert.ok(
      String(policyCell.value).includes('Point-in-Time Export'),
      'Policy section clarifies that exported workbook is a read-only point-in-time snapshot'
    )
  })

  test('4. Orders sequence sort helper enforces numerical ordering (ORD-0001 < ORD-0002)', () => {
    const sorted = sortOrdersAscending([
      { order_number: 'ORD-10' },
      { order_number: 'ORD-2' },
      { order_number: 'ORD-1' }
    ])
    assert.equal(sorted[0].order_number, 'ORD-1')
    assert.equal(sorted[1].order_number, 'ORD-2')
    assert.equal(sorted[2].order_number, 'ORD-10')
  })
})
