/**
 * ============================================================================
 * ARS Computers — Dedicated Monthly Sales Excel Report & Orders Register Generator
 * ============================================================================
 * Generates standardized, professional multi-sheet audit and compliance Excel
 * (.xlsx) workbooks using ExcelJS.
 *
 * Core Sheets:
 * 1. Orders — Complete active, completed, and processed orders in the operating cycle.
 * 2. Sales — Settled & Head-approved sales revenue ledger.
 * 3. Summary — Executive overview, KPI totals (INR ₹), and payment method distribution.
 *
 * Invariants:
 * - Strictly increasing numerical sequence across all order rows (ORD-0001, ORD-0002...).
 * - Professional ARS COMPUTERS styling (Navy Blue #1E3A8A, white bold text, zebra striping).
 * - Indian Rupee formatting (₹ #,##0.00) on all monetary columns.
 * - Frozen header rows and column auto-widths with safety padding (no ### truncation).
 * - Grounded strictly in authentic database records without fabricated figures.
 * ============================================================================
 */

import { MONTH_NAMES, formatDateTimeParts, getExcelJS } from './excelReportGenerator.js'
import { ORDER_REGISTER_COLUMNS, extractOrderRegisterRow } from './liveOrdersRegisterHelper.js'

/**
 * Extracts numeric sequence number from order number string.
 * Handles formats like: 'ARS-ORD-00042' -> 42, 'ORD-0001' -> 1, 'ORD-10' -> 10.
 */
export function extractOrderSequenceNumber(orderNumber) {
  if (!orderNumber || typeof orderNumber !== 'string') return 0
  const match = orderNumber.match(/(\d+)/g)
  if (!match || match.length === 0) return 0
  return parseInt(match[match.length - 1], 10) || 0
}

/**
 * Sorts orders in strictly increasing numerical sequence (lowest order number first).
 */
export function sortOrdersAscending(ordersList) {
  if (!Array.isArray(ordersList)) return []
  return [...ordersList].sort((a, b) => {
    const seqA = extractOrderSequenceNumber(a.order_number)
    const seqB = extractOrderSequenceNumber(b.order_number)
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.created_at || 0) - new Date(b.created_at || 0)
  })
}

/**
 * Filters orders strictly by `completion_approved_at` matching the target month & year.
 * Only orders with status = 'completed' are included.
 */
export function filterOrdersByReportingMonth(orders, targetMonthIndex, targetYear) {
  if (!Array.isArray(orders)) return []

  return orders.filter((order) => {
    if (order.status !== 'completed' || !order.completion_approved_at) {
      return false
    }

    const approvalDate = new Date(order.completion_approved_at)
    if (Number.isNaN(approvalDate.getTime())) return false

    return (
      approvalDate.getFullYear() === targetYear &&
      approvalDate.getMonth() === targetMonthIndex
    )
  })
}

/**
 * Determines whether an order belongs to the Current Month operational cycle.
 */
export function isOrderInCurrentMonthCycle(order, currentMonthIndex, currentYear) {
  if (!order || typeof order !== 'object') return false

  // 1. Active / in-progress orders: always keep visible in current month operational view
  if (['new', 'processing', 'completion_requested'].includes(order.status)) {
    return true
  }

  // 2. Completed orders: strictly belong to the month of Head approval
  if (order.status === 'completed') {
    if (!order.completion_approved_at) return false
    const d = new Date(order.completion_approved_at)
    if (Number.isNaN(d.getTime())) return false
    return d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex
  }

  // 3. Cancelled orders: belong to cancellation month
  if (order.status === 'cancelled') {
    const rawDate = order.cancelled_at || order.created_at
    if (!rawDate) return false
    const d = new Date(rawDate)
    if (Number.isNaN(d.getTime())) return false
    return d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex
  }

  return false
}

/**
 * Filters orders for a historical month view.
 */
export function filterOrdersForHistoricalMonth(orders, targetMonthIndex, targetYear) {
  if (!Array.isArray(orders)) return []

  return orders.filter((order) => {
    if (!order || typeof order !== 'object') return false

    if (order.status === 'completed') {
      if (!order.completion_approved_at) return false
      const d = new Date(order.completion_approved_at)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }

    if (order.status === 'cancelled') {
      const rawDate = order.cancelled_at || order.created_at
      if (!rawDate) return false
      const d = new Date(rawDate)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }

    if (order.created_at) {
      const d = new Date(order.created_at)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }

    return false
  })
}

/**
 * Computes monthly summary metrics based strictly on real database order records.
 */
export function calculateMonthlyCycleMetrics(orders, targetMonthIndex, targetYear, isCurrentMonth = true) {
  if (!Array.isArray(orders)) {
    return { active: 0, pending: 0, completed: 0, revenue: 0, cancelled: 0 }
  }

  if (isCurrentMonth) {
    const active = orders.filter((o) => ['new', 'processing'].includes(o.status)).length
    const pending = orders.filter((o) => o.status === 'completion_requested').length

    const completedOrders = orders.filter((o) => {
      if (o.status !== 'completed' || !o.completion_approved_at) return false
      const d = new Date(o.completion_approved_at)
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    })

    const completed = completedOrders.length
    const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

    const cancelled = orders.filter((o) => {
      if (o.status !== 'cancelled') return false
      const d = new Date(o.cancelled_at || o.created_at)
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }).length

    return { active, pending, completed, revenue, cancelled }
  } else {
    const completedOrders = orders.filter((o) => {
      if (o.status !== 'completed' || !o.completion_approved_at) return false
      const d = new Date(o.completion_approved_at)
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    })

    const completed = completedOrders.length
    const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

    const cancelled = orders.filter((o) => {
      if (o.status !== 'cancelled') return false
      const d = new Date(o.cancelled_at || o.created_at)
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }).length

    const historicalActive = orders.filter((o) => {
      if (!['new', 'processing', 'completion_requested'].includes(o.status)) return false
      const d = new Date(o.created_at)
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }).length

    return { active: historicalActive, pending: 0, completed, revenue, cancelled }
  }
}

/**
 * Standard filename builder.
 */
export function getMonthlySalesReportFilename(targetMonthIndex, targetYear) {
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  return `ARS_Sales_${monthName}_${targetYear}.xlsx`
}

export const buildMonthlySalesExcelFilename = getMonthlySalesReportFilename

/**
 * Generates workbook buffer for monthly sales report (Node & browser compatible).
 */
export async function generateMonthlySalesExcelBuffer(allOrders, targetMonthIndex, targetYear) {
  const res = await downloadMonthlySalesExcel(allOrders, targetMonthIndex, targetYear)
  return res.buffer
}

/**
 * Styling helper: applies ARS Computers Navy Header formatting
 */
function styleHeaderRow(row) {
  row.height = 28
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // Navy Blue #1E3A8A
    }
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E293B' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    }
  })
}

/**
 * Styling helper: applies zebra striping and borders to data row
 */
function styleDataRow(row, isEven, alignConfig = {}) {
  row.height = 22
  row.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10 }
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' } // Slate 50
      }
    }
    const alignment = alignConfig[colNumber] || 'left'
    cell.alignment = {
      vertical: 'middle',
      horizontal: alignment,
      wrapText: false
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    }
  })
}

/**
 * Formats monetary cell with Indian Rupee currency format (₹#,##0.00)
 */
function formatCurrencyCell(cell, value) {
  cell.value = Number(value) || 0
  cell.numFmt = '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00'
  cell.alignment = { vertical: 'middle', horizontal: 'right' }
}

/**
 * Generates the Comprehensive 3-Sheet Monthly Sales & Orders Excel workbook.
 *
 * Sheet 1: Orders (All orders in target cycle sorted strictly increasing numerically)
 * Sheet 2: Sales (Completed sales approved in reporting month)
 * Sheet 3: Summary (Executive KPI totals & payment methods breakdown)
 */
export async function downloadMonthlySalesExcel(allOrders, targetMonthIndex, targetYear) {
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  const filename = getMonthlySalesReportFilename(targetMonthIndex, targetYear)

  // 1. Prepare data sets
  const isCurrent = targetMonthIndex === new Date().getMonth() && targetYear === new Date().getFullYear()
  const ordersInCycle = (allOrders || []).filter((o) =>
    isCurrent
      ? isOrderInCurrentMonthCycle(o, targetMonthIndex, targetYear)
      : filterOrdersForHistoricalMonth([o], targetMonthIndex, targetYear).length > 0
  )

  const sortedOrders = sortOrdersAscending(ordersInCycle)
  const completedSales = sortOrdersAscending(filterOrdersByReportingMonth(allOrders, targetMonthIndex, targetYear))

  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARS Computers Admin Portal'
  workbook.lastModifiedBy = 'ARS Computers Accounting'
  workbook.created = new Date()
  workbook.modified = new Date()

  // ==========================================================================
  // SHEET 1: ORDERS
  // ==========================================================================
  const ordersSheet = workbook.addWorksheet('Orders', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  ordersSheet.columns = [
    { header: 'Order #', key: 'order_number', width: 16 },
    { header: 'Order Date', key: 'order_date', width: 14 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Customer Phone', key: 'customer_phone', width: 18 },
    { header: 'Items Summary', key: 'items_summary', width: 34 },
    { header: 'Total Qty', key: 'total_qty', width: 12 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
    { header: 'Amount Paid (₹)', key: 'paid_amount', width: 18 },
    { header: 'Balance (₹)', key: 'balance_amount', width: 16 },
    { header: 'Assigned Engineer', key: 'assigned_engineer', width: 22 },
    { header: 'Expected Delivery', key: 'expected_delivery', width: 18 },
    { header: 'Status', key: 'status', width: 16 }
  ]

  styleHeaderRow(ordersSheet.getRow(1))
  ordersSheet.autoFilter = { from: 'A1', to: 'L1' }

  let totalOrdersSum = 0
  let totalPaidSum = 0
  let totalQtySum = 0

  sortedOrders.forEach((order, index) => {
    const received = formatDateTimeParts(order.created_at)
    const delivery = formatDateTimeParts(order.expected_delivery_date)

    let itemsSummary = '—'
    let totalQty = 0
    if (Array.isArray(order.order_items) && order.order_items.length > 0) {
      itemsSummary = order.order_items
        .map((it) => `${it.product_name_snapshot} (x${it.quantity})`)
        .join(', ')
      totalQty = order.order_items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    }

    const total = Number(order.total_amount) || 0
    const paid = Number(order.paid_amount) || 0
    const balance = Math.max(0, total - paid)

    totalOrdersSum += total
    totalPaidSum += paid
    totalQtySum += totalQty

    const row = ordersSheet.addRow({
      order_number: order.order_number || '—',
      order_date: received.date,
      customer_name: order.customer_name || '—',
      customer_phone: order.customer_phone || order.contact_info || '—',
      items_summary: itemsSummary,
      total_qty: totalQty,
      total_amount: total,
      paid_amount: paid,
      balance_amount: balance,
      assigned_engineer: order.assigned_engineer_name || 'Unassigned',
      expected_delivery: delivery.date !== '—' ? delivery.date : '—',
      status: (order.status || 'new').toUpperCase()
    })

    styleDataRow(row, index % 2 === 1, {
      1: 'center',
      2: 'center',
      6: 'center',
      7: 'right',
      8: 'right',
      9: 'right',
      11: 'center',
      12: 'center'
    })

    formatCurrencyCell(row.getCell(7), total)
    formatCurrencyCell(row.getCell(8), paid)
    formatCurrencyCell(row.getCell(9), balance)
  })

  // Totals Row for Orders
  if (sortedOrders.length > 0) {
    const totalRow = ordersSheet.addRow({
      order_number: 'TOTAL',
      order_date: '',
      customer_name: `${sortedOrders.length} Orders`,
      customer_phone: '',
      items_summary: '',
      total_qty: totalQtySum,
      total_amount: totalOrdersSum,
      paid_amount: totalPaidSum,
      balance_amount: Math.max(0, totalOrdersSum - totalPaidSum),
      assigned_engineer: '',
      expected_delivery: '',
      status: ''
    })
    totalRow.height = 24
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      }
    })
    formatCurrencyCell(totalRow.getCell(7), totalOrdersSum)
    formatCurrencyCell(totalRow.getCell(8), totalPaidSum)
    formatCurrencyCell(totalRow.getCell(9), Math.max(0, totalOrdersSum - totalPaidSum))
  }

  // ==========================================================================
  // SHEET 2: SALES (Completed & Approved)
  // ==========================================================================
  const salesSheet = workbook.addWorksheet('Sales', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  salesSheet.columns = [
    { header: 'Sales Ref', key: 'order_ref', width: 18 },
    { header: 'Order Date', key: 'order_date', width: 14 },
    { header: 'Approval Date', key: 'approval_date', width: 16 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Contact Info', key: 'contact_info', width: 24 },
    { header: 'Products Sold', key: 'products_sold', width: 34 },
    { header: 'Qty', key: 'qty', width: 10 },
    { header: 'Total Value (₹)', key: 'total_amount', width: 18 },
    { header: 'Amount Paid (₹)', key: 'paid_amount', width: 18 },
    { header: 'Balance (₹)', key: 'balance_amount', width: 16 },
    { header: 'Payment Method', key: 'payment_method', width: 16 },
    { header: 'Completed By', key: 'completed_by', width: 20 },
    { header: 'Approved By', key: 'approved_by', width: 20 }
  ]

  styleHeaderRow(salesSheet.getRow(1))
  salesSheet.autoFilter = { from: 'A1', to: 'M1' }

  let totalSalesRevenue = 0
  let totalSalesPaid = 0

  completedSales.forEach((order, index) => {
    const received = formatDateTimeParts(order.created_at)
    const approved = formatDateTimeParts(order.completion_approved_at)

    let itemsSummary = '—'
    let totalQty = 0
    if (Array.isArray(order.order_items) && order.order_items.length > 0) {
      itemsSummary = order.order_items
        .map((it) => `${it.product_name_snapshot} (x${it.quantity})`)
        .join(', ')
      totalQty = order.order_items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    }

    const total = Number(order.total_amount) || 0
    const paid = Number(order.paid_amount) || 0
    const balance = Math.max(0, total - paid)

    totalSalesRevenue += total
    totalSalesPaid += paid

    const row = salesSheet.addRow({
      order_ref: order.order_number || order.id,
      order_date: received.date,
      approval_date: approved.date !== '—' ? approved.date : '—',
      customer_name: order.customer_name || '—',
      contact_info: order.contact_info || '—',
      products_sold: itemsSummary,
      qty: totalQty,
      total_amount: total,
      paid_amount: paid,
      balance_amount: balance,
      payment_method: (order.payment_method || 'cash').toUpperCase(),
      completed_by: order.completed_by_name || '—',
      approved_by: order.approved_by_name || 'Store Head'
    })

    styleDataRow(row, index % 2 === 1, {
      1: 'center',
      2: 'center',
      3: 'center',
      7: 'center',
      8: 'right',
      9: 'right',
      10: 'right',
      11: 'center'
    })

    formatCurrencyCell(row.getCell(8), total)
    formatCurrencyCell(row.getCell(9), paid)
    formatCurrencyCell(row.getCell(10), balance)
  })

  // Totals Row for Sales
  if (completedSales.length > 0) {
    const totalRow = salesSheet.addRow({
      order_ref: 'TOTAL',
      order_date: '',
      approval_date: '',
      customer_name: `${completedSales.length} Completed Sales`,
      contact_info: '',
      products_sold: '',
      qty: '',
      total_amount: totalSalesRevenue,
      paid_amount: totalSalesPaid,
      balance_amount: Math.max(0, totalSalesRevenue - totalSalesPaid),
      payment_method: '',
      completed_by: '',
      approved_by: ''
    })
    totalRow.height = 24
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      }
    })
    formatCurrencyCell(totalRow.getCell(8), totalSalesRevenue)
    formatCurrencyCell(totalRow.getCell(9), totalSalesPaid)
    formatCurrencyCell(totalRow.getCell(10), Math.max(0, totalSalesRevenue - totalSalesPaid))
  }

  // ==========================================================================
  // SHEET 3: SUMMARY (Executive Report)
  // ==========================================================================
  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'portrait' }
  })

  summarySheet.columns = [
    { width: 4 },
    { width: 34 },
    { width: 26 },
    { width: 20 }
  ]

  // Title Block
  summarySheet.mergeCells('B2:D2')
  const titleCell = summarySheet.getCell('B2')
  titleCell.value = 'ARS COMPUTERS — EXECUTIVE SALES SUMMARY'
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  summarySheet.mergeCells('B3:D3')
  const periodCell = summarySheet.getCell('B3')
  periodCell.value = `Reporting Period: ${monthName} ${targetYear} | Generated: ${new Date().toLocaleString('en-IN')}`
  periodCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } }

  // KPI Section Header
  summarySheet.getCell('B5').value = 'KEY PERFORMANCE INDICATORS'
  summarySheet.getCell('B5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }

  const kpis = [
    { label: 'Total Orders in Cycle', value: sortedOrders.length, isCurrency: false },
    { label: 'Completed & Approved Sales', value: completedSales.length, isCurrency: false },
    { label: 'Total Revenue (Completed Sales)', value: totalSalesRevenue, isCurrency: true },
    { label: 'Total Payment Collected', value: totalSalesPaid, isCurrency: true },
    { label: 'Total Outstanding Balance', value: Math.max(0, totalSalesRevenue - totalSalesPaid), isCurrency: true },
    { label: 'Total Pipeline Orders Value', value: totalOrdersSum, isCurrency: true }
  ]

  kpis.forEach((kpi, idx) => {
    const rowNum = 6 + idx
    const labelCell = summarySheet.getCell(`B${rowNum}`)
    const valCell = summarySheet.getCell(`C${rowNum}`)

    labelCell.value = kpi.label
    labelCell.font = { name: 'Calibri', size: 10, bold: true }
    labelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

    if (kpi.isCurrency) {
      formatCurrencyCell(valCell, kpi.value)
    } else {
      valCell.value = kpi.value
      valCell.font = { name: 'Calibri', size: 11, bold: true }
      valCell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
    valCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
  })

  // Payment Methods Breakdown Section
  const methodStartRow = 14
  summarySheet.getCell(`B${methodStartRow}`).value = 'PAYMENT METHOD BREAKDOWN'
  summarySheet.getCell(`B${methodStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`B${methodStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`C${methodStartRow}`).value = 'COUNT'
  summarySheet.getCell(`C${methodStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`C${methodStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`C${methodStartRow}`).alignment = { horizontal: 'center' }
  summarySheet.getCell(`D${methodStartRow}`).value = 'AMOUNT (₹)'
  summarySheet.getCell(`D${methodStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`D${methodStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`D${methodStartRow}`).alignment = { horizontal: 'right' }

  // Compute breakdown from completed sales
  const methodsMap = {}
  completedSales.forEach((s) => {
    const m = (s.payment_method || 'cash').toUpperCase()
    if (!methodsMap[m]) methodsMap[m] = { count: 0, amount: 0 }
    methodsMap[m].count += 1
    methodsMap[m].amount += Number(s.paid_amount) || 0
  })

  const standardMethods = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']
  standardMethods.forEach((methodKey, idx) => {
    const data = methodsMap[methodKey] || { count: 0, amount: 0 }
    const rowNum = methodStartRow + 1 + idx

    const labelCell = summarySheet.getCell(`B${rowNum}`)
    labelCell.value = methodKey.replace('_', ' ')
    labelCell.font = { name: 'Calibri', size: 10 }

    const countCell = summarySheet.getCell(`C${rowNum}`)
    countCell.value = data.count
    countCell.alignment = { horizontal: 'center' }

    const amtCell = summarySheet.getCell(`D${rowNum}`)
    formatCurrencyCell(amtCell, data.amount)
  })

  // Export buffer & download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return {
    filename,
    count: completedSales.length,
    ordersCount: sortedOrders.length,
    buffer
  }
}

/**
 * Exports current live orders register view to Excel (.xlsx) with strictly increasing numerical sequence.
 */
export async function exportLiveOrdersRegisterViewToExcel(filteredOrders, customFilename = null) {
  const today = new Date().toISOString().split('T')[0]
  const filename = customFilename || `ARS_Orders_Register_${today}.xlsx`

  const sorted = sortOrdersAscending(filteredOrders || [])

  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARS Computers Admin Portal'
  workbook.lastModifiedBy = 'ARS Computers Live Operations'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Live Orders Register', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  worksheet.columns = ORDER_REGISTER_COLUMNS.map((col) => ({
    header: col.label,
    key: col.id,
    width: Math.max(14, Math.round(col.defaultWidth / 7))
  }))

  styleHeaderRow(worksheet.getRow(1))
  worksheet.autoFilter = { from: 'A1', to: 'S1' }

  sorted.forEach((order, index) => {
    const rowData = extractOrderRegisterRow(order)
    const total = Number(order.total_amount) || 0
    const paid = Number(order.paid_amount) || 0
    const balance = Math.max(0, total - paid)

    const row = worksheet.addRow({
      order_ref: rowData.order_ref,
      order_date: rowData.order_date,
      order_time: rowData.order_time,
      customer_name: rowData.customer_name,
      contact_info: rowData.contact_info,
      items_summary: rowData.items_summary,
      total_quantity: Number(rowData.total_quantity) || 0,
      total_amount: total,
      paid_amount: paid,
      balance_amount: balance,
      payment_status: rowData.payment_status,
      payment_method: rowData.payment_method,
      order_status: (order.status || 'new').toUpperCase(),
      completed_by: rowData.completed_by,
      completed_by_code: rowData.completed_by_code,
      completion_date: rowData.completion_date,
      approved_by: rowData.approved_by,
      approval_date: rowData.approval_date,
      archive_status: rowData.archive_status
    })

    styleDataRow(row, index % 2 === 1, {
      1: 'center',
      2: 'center',
      3: 'center',
      7: 'center',
      8: 'right',
      9: 'right',
      10: 'right',
      11: 'center',
      12: 'center',
      13: 'center',
      15: 'center',
      16: 'center',
      18: 'center',
      19: 'center'
    })

    formatCurrencyCell(row.getCell(8), total)
    formatCurrencyCell(row.getCell(9), paid)
    formatCurrencyCell(row.getCell(10), balance)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return { filename, count: sorted.length, buffer }
}
