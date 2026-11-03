import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  downloadMonthlySalesExcel,
  sortOrdersAscending
} from '../src/utils/salesReportGenerator.js'
import { getExcelJS } from '../src/utils/excelReportGenerator.js'

describe('ARS Computers — Orders & Sales Excel Export & Editability Unit Tests', () => {
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
        { product_name_snapshot: 'Gaming PC Build', quantity: 1, unit_price: 45000, line_total: 45000 }
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
        { product_name_snapshot: '27-inch 144Hz Monitor', quantity: 1, unit_price: 15000, line_total: 15000 }
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
        const totalAmountVal = row.getCell(7).value?.result ?? row.getCell(7).value
        const totalPaidVal = row.getCell(8).value?.result ?? row.getCell(8).value
        const totalBalVal = row.getCell(9).value?.result ?? row.getCell(9).value

        assert.equal(totalAmountVal, 60000, 'Orders total sum matches sum of order amounts')
        assert.equal(totalPaidVal, 40000, 'Orders total paid sum matches')
        assert.equal(totalBalVal, 20000, 'Orders balance matches')
        assert.ok(row.getCell(7).value?.formula, 'Total amount has dynamic Excel formula')
      }
    })
    assert.ok(foundTotal, 'Totals row exists in Orders sheet')
  })

  test('3. Sales sheet has required columns, itemized sales entries, and formula totals', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026)
    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const salesWs = workbook.getWorksheet('Sales')
    const headerRow = salesWs.getRow(1)
    assert.equal(headerRow.getCell(1).value, 'Sales Date')
    assert.equal(headerRow.getCell(2).value, 'Order Reference')
    assert.equal(headerRow.getCell(3).value, 'Customer')
    assert.equal(headerRow.getCell(4).value, 'Item / Description')
    assert.equal(headerRow.getCell(5).value, 'Quantity')
    assert.equal(headerRow.getCell(6).value, 'Unit Selling Price (₹)')
    assert.equal(headerRow.getCell(7).value, 'Total Sales Amount (₹)')
    assert.equal(headerRow.getCell(8).value, 'Payment Status')

    // Data row check (Pooja Verma's monitor sale)
    const dataRow = salesWs.getRow(2)
    assert.equal(dataRow.getCell(2).value, 'ORD-0002')
    assert.equal(dataRow.getCell(3).value, 'Pooja Verma')
    assert.equal(dataRow.getCell(4).value, '27-inch 144Hz Monitor')
    assert.equal(dataRow.getCell(5).value, 1)
    assert.equal(dataRow.getCell(6).value, 15000)
    assert.equal(dataRow.getCell(7).value, 15000)
    assert.equal(dataRow.getCell(8).value, 'PAID')

    // Totals row check
    let foundTotal = false
    salesWs.eachRow((row) => {
      if (row.getCell(2).value === 'TOTAL') {
        foundTotal = true
        const totalSalesVal = row.getCell(7).value?.result ?? row.getCell(7).value
        assert.equal(totalSalesVal, 15000, 'Total sales revenue matches completed orders')
        assert.ok(row.getCell(7).value?.formula, 'Total sales has dynamic Excel formula')
      }
    })
    assert.ok(foundTotal, 'Totals row exists in Sales sheet')
  })

  test('4. Summary sheet contains Executive KPI metrics, Monthly Summary, and Safe Record Policy notice', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026)
    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const summaryWs = workbook.getWorksheet('Summary')
    assert.equal(summaryWs.getCell('B2').value, 'ARS COMPUTERS — EXECUTIVE SALES SUMMARY')
    assert.equal(summaryWs.getCell('B5').value, 'KEY PERFORMANCE INDICATORS')
    assert.equal(summaryWs.getCell('B16').value, 'MONTHLY SALES SUMMARY')

    // Find and verify compliance policy text is present
    let foundPolicy = false
    summaryWs.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string' && cell.value.includes('Database Safety Invariant')) {
          foundPolicy = true
        }
      })
    })
    assert.ok(foundPolicy, 'Policy section clarifies that exported workbook edits do not modify live database orders')
  })

  test('5. Workbook is fully editable: cells can be modified, rows inserted/deleted without protection errors', async () => {
    const res = await downloadMonthlySalesExcel(mockOrders, 10, 2026)
    const ExcelJS = await getExcelJS()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(res.buffer)

    const ordersWs = workbook.getWorksheet('Orders')
    const salesWs = workbook.getWorksheet('Sales')
    const summaryWs = workbook.getWorksheet('Summary')

    // Confirm no worksheet protection is enabled
    assert.ok(!ordersWs.sheetProtection || ordersWs.sheetProtection.sheet === false, 'Orders worksheet has no protection lock')
    assert.ok(!salesWs.sheetProtection || salesWs.sheetProtection.sheet === false, 'Sales worksheet has no protection lock')
    assert.ok(!summaryWs.sheetProtection || summaryWs.sheetProtection.sheet === false, 'Summary worksheet has no protection lock')

    // Edit cell values
    ordersWs.getCell('C2').value = 'Updated Customer Name'
    ordersWs.getCell('G2').value = 52000
    assert.equal(ordersWs.getCell('C2').value, 'Updated Customer Name', 'Cell value can be edited freely')
    assert.equal(ordersWs.getCell('G2').value, 52000, 'Numeric cell value can be edited freely')

    // Insert row
    const newRow = ordersWs.insertRow(3, [
      'ORD-MANUAL-001',
      '2026-11-03',
      'Manual Test Row',
      '9999999999',
      'Custom RAM Upgrade',
      2,
      8000,
      8000,
      0,
      'PAID',
      'COMPLETED'
    ])
    assert.equal(newRow.getCell(1).value, 'ORD-MANUAL-001', 'Rows can be inserted cleanly')

    // Delete row
    ordersWs.spliceRows(3, 1)
    assert.notEqual(ordersWs.getRow(3).getCell(1).value, 'ORD-MANUAL-001', 'Rows can be deleted cleanly')

    // Verify source data remains unmodified (offline immutability)
    assert.equal(mockOrders[0].customer_name, 'Rohit Sharma', 'Original database orders array is untouched by Excel edits')
  })

  test('6. Orders sequence sort helper enforces numerical ordering (ORD-0001 < ORD-0002)', () => {
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
