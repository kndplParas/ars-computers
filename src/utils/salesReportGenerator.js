/**
 * ============================================================================
 * ARS Computers — Dedicated Monthly Sales Excel Report & Orders Register Generator
 * ============================================================================
 * Generates standardized, professional multi-sheet audit and management Excel
 * (.xlsx) workbooks using ExcelJS.
 *
 * Core Sheets:
 * 1. Orders — Complete active, completed, and processed orders in the operating cycle.
 * 2. Sales — Itemized completed & Head-approved sales revenue ledger.
 * 3. Summary — Executive overview, KPI totals (INR ₹), monthly sales summary,
 *              and payment method distribution.
 *
 * Capabilities & Design:
 * - Fully editable: cells can be edited, rows added/deleted, columns resized,
 *   formulas recalculate, and no worksheet protection is applied.
 * - Excel tables with AutoFilters and frozen header rows on data sheets.
 * - Dynamic formulas for totals (e.g. SUM) with evaluated results.
 * - No merged cells across table columns, ensuring native Excel sorting & filtering work without errors.
 * - Professional ARS COMPUTERS styling (Navy Blue #1E3A8A, white bold text, zebra striping).
 * - Indian Rupee formatting (₹ #,##0.00) on all monetary columns.
 * - Grounded strictly in authentic database records without fabricated figures.
 * - Non-destructive: editing or deleting spreadsheet rows does not modify database records.
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
  row.height = 30
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
  row.height = 24
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
  if (value && typeof value === 'object' && value.formula) {
    cell.value = value
  } else {
    cell.value = Number(value) || 0
  }
  cell.numFmt = '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00'
  cell.alignment = { vertical: 'middle', horizontal: 'right' }
}

/**
 * Highlights status pills with clean, readable colors
 */
function formatStatusCell(cell, statusText, type = 'payment') {
  const norm = String(statusText || '').toUpperCase()
  cell.value = norm
  cell.alignment = { vertical: 'middle', horizontal: 'center' }

  if (type === 'payment') {
    if (norm === 'PAID' || norm === 'RECEIVED') {
      cell.value = 'RECEIVED'
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } } // Green
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }
    } else if (norm === 'PARTIAL') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } } // Amber
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } }
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } } // Red/Pending
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } }
    }
  } else if (type === 'order') {
    if (norm === 'COMPLETED') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }
    } else if (['PROCESSING', 'COMPLETION_REQUESTED'].includes(norm)) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } }
    } else if (norm === 'CANCELLED') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF64748B' } }
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } } // Purple/New
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF6B21A8' } }
    }
  }
}

/**
 * Generates the Comprehensive, Fully Editable 3-Sheet Monthly Sales & Orders Excel workbook.
 *
 * Sheet 1: Orders (Complete operational orders in cycle, AutoFilter, frozen header, formula totals)
 * Sheet 2: Sales (Itemized sold products and revenue ledger for completed sales)
 * Sheet 3: Summary (Executive KPIs, Monthly sales breakdown, payment methods, audit notes)
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

  // Explicitly ensure worksheet is NOT protected so all cells are freely editable
  if (typeof ordersSheet.unprotect === 'function') {
    ordersSheet.unprotect()
  }

  ordersSheet.columns = [
    { header: 'Order #', key: 'order_number', width: 18 },
    { header: 'Order Date', key: 'order_date', width: 15 },
    { header: 'Customer Name', key: 'customer_name', width: 26 },
    { header: 'Contact Number', key: 'customer_phone', width: 18 },
    { header: 'Products / Items', key: 'items_summary', width: 42 },
    { header: 'Quantity', key: 'total_qty', width: 12 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 20 },
    { header: 'Amount Received (₹)', key: 'paid_amount', width: 20 },
    { header: 'Balance (₹)', key: 'balance_amount', width: 18 },
    { header: 'Payment Status', key: 'payment_status', width: 16 },
    { header: 'Order Status', key: 'order_status', width: 16 },
    { header: 'Assigned Engineer', key: 'assigned_engineer', width: 24 },
    { header: 'Delivery / Service Details', key: 'delivery_details', width: 24 }
  ]

  styleHeaderRow(ordersSheet.getRow(1))
  ordersSheet.autoFilter = { from: 'A1', to: 'M1' }

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
        .map((it) => `${it.product_name_snapshot || it.product_name || 'Item'} (x${it.quantity})`)
        .join(', ')
      totalQty = order.order_items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    }

    const total = Number(order.total_amount) || 0
    const paid = Number(order.paid_amount) || 0
    const balance = Math.max(0, total - paid)

    totalOrdersSum += total
    totalPaidSum += paid
    totalQtySum += totalQty

    const paymentStatus = order.payment_status || (paid === 0 ? 'pending' : paid >= total ? 'paid' : 'partial')

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
      payment_status: paymentStatus.toUpperCase() === 'PAID' ? 'RECEIVED' : paymentStatus.toUpperCase(),
      order_status: (order.status || 'new').toUpperCase(),
      assigned_engineer: order.assigned_engineer_name || 'Unassigned',
      delivery_details: delivery.date !== '—' ? delivery.date : (order.employee_remarks || '—')
    })

    styleDataRow(row, index % 2 === 1, {
      1: 'center',
      2: 'center',
      4: 'center',
      6: 'center',
      7: 'right',
      8: 'right',
      9: 'right',
      10: 'center',
      11: 'center',
      12: 'left',
      13: 'left'
    })

    formatCurrencyCell(row.getCell(7), total)
    formatCurrencyCell(row.getCell(8), paid)
    formatCurrencyCell(row.getCell(9), balance)
    formatStatusCell(row.getCell(10), paymentStatus, 'payment')
    formatStatusCell(row.getCell(11), order.status, 'order')
  })

  // Dynamic Totals Row for Orders (using Excel formulas with evaluated results)
  if (sortedOrders.length > 0) {
    const firstDataRow = 2
    const lastDataRow = sortedOrders.length + 1

    const totalRow = ordersSheet.addRow({
      order_number: 'TOTAL',
      order_date: '',
      customer_name: `${sortedOrders.length} Orders`,
      customer_phone: '',
      items_summary: '',
      total_qty: { formula: `SUM(F${firstDataRow}:F${lastDataRow})`, result: totalQtySum },
      total_amount: { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: totalOrdersSum },
      paid_amount: { formula: `SUM(H${firstDataRow}:H${lastDataRow})`, result: totalPaidSum },
      balance_amount: { formula: `SUM(I${firstDataRow}:I${lastDataRow})`, result: Math.max(0, totalOrdersSum - totalPaidSum) },
      payment_status: '',
      order_status: '',
      assigned_engineer: '',
      delivery_details: ''
    })

    totalRow.height = 26
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      }
    })

    totalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' }
    formatCurrencyCell(totalRow.getCell(7), { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: totalOrdersSum })
    formatCurrencyCell(totalRow.getCell(8), { formula: `SUM(H${firstDataRow}:H${lastDataRow})`, result: totalPaidSum })
    formatCurrencyCell(totalRow.getCell(9), { formula: `SUM(I${firstDataRow}:I${lastDataRow})`, result: Math.max(0, totalOrdersSum - totalPaidSum) })
  }

  // ==========================================================================
  // SHEET 2: SALES (Itemized Completed Revenue Ledger)
  // ==========================================================================
  const salesSheet = workbook.addWorksheet('Sales', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  if (typeof salesSheet.unprotect === 'function') {
    salesSheet.unprotect()
  }

  salesSheet.columns = [
    { header: 'Sales Date', key: 'sales_date', width: 16 },
    { header: 'Order Reference', key: 'order_ref', width: 18 },
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Item / Description', key: 'item_desc', width: 44 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Unit Selling Price (₹)', key: 'unit_price', width: 22 },
    { header: 'Total Sales Amount (₹)', key: 'total_sales', width: 22 },
    { header: 'Payment Status', key: 'payment_status', width: 16 }
  ]

  styleHeaderRow(salesSheet.getRow(1))
  salesSheet.autoFilter = { from: 'A1', to: 'H1' }

  let totalSalesRevenue = 0
  let totalSalesQty = 0
  let salesItemRowsCount = 0

  completedSales.forEach((order) => {
    const approvalDate = order.completion_approved_at
      ? formatDateTimeParts(order.completion_approved_at).date
      : formatDateTimeParts(order.created_at).date

    const customer = order.customer_name || '—'
    const orderRef = order.order_number || order.id || '—'
    const rawPaymentStatus = (order.payment_status || (Number(order.paid_amount) >= Number(order.total_amount) ? 'paid' : 'partial')).toUpperCase()
    const paymentStatus = rawPaymentStatus === 'PAID' ? 'RECEIVED' : rawPaymentStatus

    if (Array.isArray(order.order_items) && order.order_items.length > 0) {
      order.order_items.forEach((item) => {
        salesItemRowsCount++
        const qty = Number(item.quantity) || 1
        const unitPrice = Number(item.unit_price) || 0
        const lineTotal = Number(item.line_total) || qty * unitPrice

        totalSalesRevenue += lineTotal
        totalSalesQty += qty

        const itemDesc = [
          item.product_name_snapshot || item.product_name || '',
          item.brand_snapshot || item.brand || '',
          item.model_snapshot || item.model || ''
        ]
          .filter(Boolean)
          .join(' ') || 'Hardware Product'

        const row = salesSheet.addRow({
          sales_date: approvalDate,
          order_ref: orderRef,
          customer: customer,
          item_desc: itemDesc,
          quantity: qty,
          unit_price: unitPrice,
          total_sales: lineTotal,
          payment_status: paymentStatus
        })

        styleDataRow(row, salesItemRowsCount % 2 === 1, {
          1: 'center',
          2: 'center',
          5: 'center',
          6: 'right',
          7: 'right',
          8: 'center'
        })

        formatCurrencyCell(row.getCell(6), unitPrice)
        formatCurrencyCell(row.getCell(7), lineTotal)
        formatStatusCell(row.getCell(8), paymentStatus, 'payment')
      })
    } else {
      // Order without itemized records
      salesItemRowsCount++
      const orderTotal = Number(order.total_amount) || 0
      totalSalesRevenue += orderTotal
      totalSalesQty += 1

      const row = salesSheet.addRow({
        sales_date: approvalDate,
        order_ref: orderRef,
        customer: customer,
        item_desc: 'Hardware Order (Consolidated)',
        quantity: 1,
        unit_price: orderTotal,
        total_sales: orderTotal,
        payment_status: paymentStatus
      })

      styleDataRow(row, salesItemRowsCount % 2 === 1, {
        1: 'center',
        2: 'center',
        5: 'center',
        6: 'right',
        7: 'right',
        8: 'center'
      })

      formatCurrencyCell(row.getCell(6), orderTotal)
      formatCurrencyCell(row.getCell(7), orderTotal)
      formatStatusCell(row.getCell(8), paymentStatus, 'payment')
    }
  })

  // Dynamic Totals Row for Sales
  if (salesItemRowsCount > 0) {
    const firstDataRow = 2
    const lastDataRow = salesItemRowsCount + 1

    const totalRow = salesSheet.addRow({
      sales_date: '',
      order_ref: 'TOTAL',
      customer: `${salesItemRowsCount} Sold Items`,
      item_desc: '',
      quantity: { formula: `SUM(E${firstDataRow}:E${lastDataRow})`, result: totalSalesQty },
      unit_price: '',
      total_sales: { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: totalSalesRevenue },
      payment_status: ''
    })

    totalRow.height = 26
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      }
    })

    totalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' }
    formatCurrencyCell(totalRow.getCell(7), { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: totalSalesRevenue })
  }

  // ==========================================================================
  // SHEET 3: SUMMARY (Executive Report & Monthly Analysis)
  // ==========================================================================
  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'portrait', fitToPage: true }
  })

  if (typeof summarySheet.unprotect === 'function') {
    summarySheet.unprotect()
  }

  summarySheet.columns = [
    { width: 4 },   // A: Left margin
    { width: 34 },  // B: Metric / Dimension
    { width: 22 },  // C: Value / Count
    { width: 24 }   // D: Amount / Share
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

  // 1. KPI Section
  summarySheet.getCell('B5').value = 'KEY PERFORMANCE INDICATORS'
  summarySheet.getCell('B5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }

  const pendingOrdersCount = sortedOrders.filter((o) => ['new', 'processing', 'completion_requested'].includes(o.status)).length
  const completedOrdersCount = completedSales.length
  const cancelledOrdersCount = sortedOrders.filter((o) => o.status === 'cancelled').length
  const pendingPaymentsBalance = Math.max(0, totalOrdersSum - totalPaidSum)

  const kpis = [
    { label: 'Total Orders in Cycle', value: sortedOrders.length, isCurrency: false },
    { label: 'Completed & Approved Sales', value: completedOrdersCount, isCurrency: false },
    { label: 'Pending & In-Progress Orders', value: pendingOrdersCount, isCurrency: false },
    { label: 'Cancelled Orders', value: cancelledOrdersCount, isCurrency: false },
    { label: 'Total Sales (Completed Sales Revenue)', value: totalSalesRevenue, isCurrency: true },
    { label: 'Total Amount Received (Collected)', value: totalPaidSum, isCurrency: true },
    { label: 'Total Outstanding Pending Payments', value: pendingPaymentsBalance, isCurrency: true },
    { label: 'Total Order Book Value (Pipeline)', value: totalOrdersSum, isCurrency: true }
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

  // 2. Monthly Sales Summary Section
  const monthlyStartRow = 16
  summarySheet.getCell(`B${monthlyStartRow}`).value = 'MONTHLY SALES SUMMARY'
  summarySheet.getCell(`B${monthlyStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`B${monthlyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`C${monthlyStartRow}`).value = 'COMPLETED'
  summarySheet.getCell(`C${monthlyStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`C${monthlyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`C${monthlyStartRow}`).alignment = { horizontal: 'center' }
  summarySheet.getCell(`D${monthlyStartRow}`).value = 'REVENUE (₹)'
  summarySheet.getCell(`D${monthlyStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`D${monthlyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  summarySheet.getCell(`D${monthlyStartRow}`).alignment = { horizontal: 'right' }

  // Group all available orders by month for trend analysis
  const monthlyMap = new Map()
  ;(allOrders || []).forEach((o) => {
    const rawDate = o.completion_approved_at || o.created_at
    if (!rawDate) return
    const d = new Date(rawDate)
    if (Number.isNaN(d.getTime())) return
    const mKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    const label = `${MONTH_NAMES[d.getMonth()] || 'Month'} ${d.getFullYear()}`

    if (!monthlyMap.has(mKey)) {
      monthlyMap.set(mKey, { label, totalOrders: 0, completedCount: 0, revenue: 0 })
    }
    const item = monthlyMap.get(mKey)
    item.totalOrders += 1
    if (o.status === 'completed') {
      item.completedCount += 1
      item.revenue += Number(o.total_amount) || 0
    }
  })

  // Sort chronologically
  const sortedMonths = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // Last 6 months with real data

  let currentMonthlyRow = monthlyStartRow
  if (sortedMonths.length === 0) {
    currentMonthlyRow++
    summarySheet.getCell(`B${currentMonthlyRow}`).value = `${monthName} ${targetYear}`
    summarySheet.getCell(`C${currentMonthlyRow}`).value = completedOrdersCount
    summarySheet.getCell(`C${currentMonthlyRow}`).alignment = { horizontal: 'center' }
    formatCurrencyCell(summarySheet.getCell(`D${currentMonthlyRow}`), totalSalesRevenue)
  } else {
    sortedMonths.forEach(([, mData]) => {
      currentMonthlyRow++
      const mLabelCell = summarySheet.getCell(`B${currentMonthlyRow}`)
      mLabelCell.value = mData.label
      mLabelCell.font = { name: 'Calibri', size: 10 }
      mLabelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

      const mCountCell = summarySheet.getCell(`C${currentMonthlyRow}`)
      mCountCell.value = mData.completedCount
      mCountCell.alignment = { horizontal: 'center' }
      mCountCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

      const mRevCell = summarySheet.getCell(`D${currentMonthlyRow}`)
      formatCurrencyCell(mRevCell, mData.revenue)
      mRevCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    })
  }

  // 3. Payment Methods Breakdown Section
  const methodStartRow = currentMonthlyRow + 2
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

  const methodsMap = {}
  completedSales.forEach((s) => {
    const m = (s.payment_method || 'cash').toUpperCase()
    if (!methodsMap[m]) methodsMap[m] = { count: 0, amount: 0 }
    methodsMap[m].count += 1
    methodsMap[m].amount += Number(s.paid_amount) || 0
  })

  const standardMethods = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']
  let lastMethodRow = methodStartRow
  standardMethods.forEach((methodKey) => {
    lastMethodRow++
    const data = methodsMap[methodKey] || { count: 0, amount: 0 }

    const labelCell = summarySheet.getCell(`B${lastMethodRow}`)
    labelCell.value = methodKey.replace('_', ' ')
    labelCell.font = { name: 'Calibri', size: 10 }
    labelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

    const countCell = summarySheet.getCell(`C${lastMethodRow}`)
    countCell.value = data.count
    countCell.alignment = { horizontal: 'center' }
    countCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

    const amtCell = summarySheet.getCell(`D${lastMethodRow}`)
    formatCurrencyCell(amtCell, data.amount)
    amtCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
  })

  // 4. Record Management & Non-Destructive Offline Editing Notice
  const policyStartRow = lastMethodRow + 2
  summarySheet.getCell(`B${policyStartRow}`).value = 'RECORD MANAGEMENT & DATA INTEGRITY POLICY'
  summarySheet.getCell(`B${policyStartRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  summarySheet.getCell(`B${policyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  summarySheet.getCell(`C${policyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  summarySheet.getCell(`D${policyStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  summarySheet.mergeCells(`B${policyStartRow}:D${policyStartRow}`)

  const policyNotes = [
    '• Point-in-Time Export: This workbook reflects static ledger records as of the generation timestamp.',
    '• Fully Editable Offline Copy: You may freely edit cells, insert rows, copy/paste, and format this report.',
    '• Database Safety Invariant: Altering or deleting rows in this spreadsheet does NOT modify live database orders.',
    '• Authenticated Updates: All real order updates, cancellations, or deletions require the authenticated Admin Portal.',
    '• Head Approval Workflow: Deletions require mandatory written reasons and Superadmin review before removal to Bin.'
  ]

  policyNotes.forEach((note, idx) => {
    const rNum = policyStartRow + 1 + idx
    summarySheet.mergeCells(`B${rNum}:D${rNum}`)
    const cell = summarySheet.getCell(`B${rNum}`)
    cell.value = note
    cell.font = { name: 'Calibri', size: 9.5, italic: idx > 0, color: { argb: idx === 2 ? 'FFB91C1C' : 'FF334155' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
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

  if (typeof worksheet.unprotect === 'function') {
    worksheet.unprotect()
  }

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
