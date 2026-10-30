/**
 * ============================================================================
 * ARS Computers — Dedicated Monthly Sales Excel Report & Orders Register Generator
 * ============================================================================
 * Generates standardized monthly audit and compliance Excel (.xlsx) workbooks
 * using ExcelJS.
 *
 * Strict Requirements:
 * 1. Reporting month is based SOLELY on `completion_approved_at`.
 * 2. Filename format: ARS_Sales_<Month>_<Year>.xlsx
 * 3. Cancelled orders are excluded from the monthly completed-sales report.
 * 4. Grounded in actual order data without data fabrication.
 * ============================================================================
 */

import { MONTH_NAMES, formatDateTimeParts, getExcelJS } from './excelReportGenerator.js'

/**
 * Filters orders strictly by `completion_approved_at` matching the target month & year.
 * Only orders with status = 'completed' are included.
 *
 * @param {Array} orders - Complete orders array
 * @param {number} targetMonthIndex - 0-indexed (0 = Jan, 11 = Dec)
 * @param {number} targetYear - Full year (e.g. 2026)
 * @returns {Array} Filtered orders
 */
export function filterOrdersByReportingMonth(orders, targetMonthIndex, targetYear) {
  if (!Array.isArray(orders)) return []

  return orders.filter((order) => {
    // Only completed, Head-approved orders belong in the monthly completed sales report
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
 *
 * Rules:
 * 1. ACTIVE orders ('new', 'processing', 'completion_requested'):
 *    ALWAYS remain visible in current month operational view regardless of creation date,
 *    so unfinished cross-month work is never lost.
 * 2. COMPLETED orders:
 *    Membership is strictly based on completion_approved_at falling within target month & year.
 * 3. CANCELLED orders:
 *    Membership is based on cancelled_at (or created_at fallback) falling within target month & year.
 *
 * @param {Object} order
 * @param {number} currentMonthIndex - 0-indexed (0 = Jan, 11 = Dec)
 * @param {number} currentYear - Full year (e.g. 2026)
 * @returns {boolean}
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
 *
 * Rules:
 * 1. For 'completed' orders: matches if completion_approved_at is in the target month & year.
 * 2. For 'cancelled' orders: matches if cancelled_at (or created_at fallback) is in target month & year.
 * 3. For other records: matches if created_at is in target month & year.
 *
 * @param {Array} orders
 * @param {number} targetMonthIndex - 0-indexed
 * @param {number} targetYear - Full year
 * @returns {Array}
 */
export function filterOrdersForHistoricalMonth(orders, targetMonthIndex, targetYear) {
  if (!Array.isArray(orders)) return []

  return orders.filter((order) => {
    if (!order || typeof order !== 'object') return false

    // If completed: strictly check completion_approved_at
    if (order.status === 'completed') {
      if (!order.completion_approved_at) return false
      const d = new Date(order.completion_approved_at)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }

    // If cancelled: check cancelled_at or created_at
    if (order.status === 'cancelled') {
      const rawDate = order.cancelled_at || order.created_at
      if (!rawDate) return false
      const d = new Date(rawDate)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
    }

    // For active/unresolved records created in that historical month
    if (order.created_at) {
      const d = new Date(order.created_at)
      if (!Number.isNaN(d.getTime())) {
        return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex
      }
    }

    return false
  })
}

/**
 * Calculates operational metrics for a specific month view (current or historical).
 *
 * @param {Array} orders - Complete orders list
 * @param {number} targetMonthIndex
 * @param {number} targetYear
 * @param {boolean} isCurrentMonth
 * @returns {Object} { active, pending, completed, revenue, cancelled }
 */
export function calculateMonthlyCycleMetrics(orders, targetMonthIndex, targetYear, isCurrentMonth = true) {
  if (!Array.isArray(orders)) {
    return { active: 0, pending: 0, completed: 0, revenue: 0, cancelled: 0 }
  }

  if (isCurrentMonth) {
    // Current operational cycle:
    // Active orders include all open work across any creation month
    const active = orders.filter((o) => ['new', 'processing'].includes(o.status)).length
    const pending = orders.filter((o) => o.status === 'completion_requested').length

    // Completed sales strictly within current calendar month
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
    // Historical month metrics
    const completedOrders = filterOrdersByReportingMonth(orders, targetMonthIndex, targetYear)
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
 * Builds the standard filename for the monthly sales report.
 * Format: ARS_Sales_<Month>_<Year>.xlsx
 */
export function getMonthlySalesReportFilename(targetMonthIndex, targetYear) {
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  return `ARS_Sales_${monthName}_${targetYear}.xlsx`
}

export const buildMonthlySalesExcelFilename = getMonthlySalesReportFilename

/**
 * Generates workbook buffer for monthly sales report (testable in Node & browser).
 */
export async function generateMonthlySalesExcelBuffer(allOrders, targetMonthIndex, targetYear) {
  const res = await downloadMonthlySalesExcel(allOrders, targetMonthIndex, targetYear)
  return res.buffer
}

/**
 * Generates the Monthly Sales Excel workbook.
 *
 * @param {Array} allOrders - All orders
 * @param {number} targetMonthIndex - 0 for January, 11 for December
 * @param {number} targetYear - e.g. 2026
 * @returns {Promise<{ filename: string, count: number, buffer: ArrayBuffer }>}
 */
export async function downloadMonthlySalesExcel(allOrders, targetMonthIndex, targetYear) {
  const filtered = filterOrdersByReportingMonth(allOrders, targetMonthIndex, targetYear)
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  const filename = getMonthlySalesReportFilename(targetMonthIndex, targetYear)

  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARS Computers Admin Portal'
  workbook.lastModifiedBy = 'ARS Computers Sales & Accounting'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet(`${monthName} ${targetYear} Sales`, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  // Fixed 19 Columns
  worksheet.columns = [
    { header: 'Order Reference', key: 'order_ref', width: 18 },
    { header: 'Order Date', key: 'order_date', width: 14 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Contact Information', key: 'contact_info', width: 26 },
    { header: 'Item Summary', key: 'items_summary', width: 36 },
    { header: 'Total Quantity', key: 'total_quantity', width: 14 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
    { header: 'Amount Paid (₹)', key: 'paid_amount', width: 18 },
    { header: 'Balance (₹)', key: 'balance_amount', width: 16 },
    { header: 'Payment Status', key: 'payment_status', width: 16 },
    { header: 'Payment Method', key: 'payment_method', width: 16 },
    { header: 'Completed By', key: 'completed_by', width: 22 },
    { header: 'Employee Code', key: 'completed_by_code', width: 18 },
    { header: 'Completion Date/Time', key: 'completion_datetime', width: 22 },
    { header: 'Employee Remarks', key: 'employee_remarks', width: 36 },
    { header: 'Approved By', key: 'approved_by', width: 22 },
    { header: 'Approval Date/Time', key: 'approval_datetime', width: 22 },
    { header: 'Head Remarks', key: 'head_remarks', width: 36 },
    { header: 'Final Status', key: 'final_status', width: 16 }
  ]

  // Style Header Row
  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Slate 900
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
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF020617' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    }
  })

  filtered.forEach((order, index) => {
    const received = formatDateTimeParts(order.created_at)
    const completed = formatDateTimeParts(order.completion_requested_at)
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

    const row = worksheet.addRow({
      order_ref: order.order_number || order.id,
      order_date: received.date,
      customer_name: order.customer_name || '—',
      contact_info: order.contact_info || '—',
      items_summary: itemsSummary,
      total_quantity: totalQty,
      total_amount: total.toFixed(2),
      paid_amount: paid.toFixed(2),
      balance_amount: balance.toFixed(2),
      payment_status: (order.payment_status || 'pending').toUpperCase(),
      payment_method: (order.payment_method || 'cash').toUpperCase(),
      completed_by: order.completed_by_name || '—',
      completed_by_code: order.completed_by_employee_code || '—',
      completion_datetime: completed.date !== '—' ? `${completed.date} ${completed.time}` : '—',
      employee_remarks: order.employee_remarks || '—',
      approved_by: order.approved_by_name || '—',
      approval_datetime: approved.date !== '—' ? `${approved.date} ${approved.time}` : '—',
      head_remarks: order.head_remarks || '—',
      final_status: order.status || 'completed'
    })

    row.height = 22
    const isEven = index % 2 === 1
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 }
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        }
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 2 || colNumber === 6 ||
                    colNumber === 10 || colNumber === 11 || colNumber === 13 ||
                    colNumber === 14 || colNumber === 17 || colNumber === 19
                      ? 'center'
                      : colNumber === 7 || colNumber === 8 || colNumber === 9
                        ? 'right'
                        : 'left'
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
    })
  })

  if (filtered.length === 0) {
    const emptyRow = worksheet.addRow({
      order_ref: '—',
      order_date: '—',
      customer_name: 'No sales completed in this calendar month.',
      contact_info: '',
      items_summary: '',
      total_quantity: '',
      total_amount: '',
      paid_amount: '',
      balance_amount: '',
      payment_status: '',
      payment_method: '',
      completed_by: '',
      completed_by_code: '',
      completion_datetime: '',
      employee_remarks: '',
      approved_by: '',
      approval_datetime: '',
      head_remarks: '',
      final_status: ''
    })
    emptyRow.height = 24
  }

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
    count: filtered.length,
    buffer
  }
}

/**
 * Exports current live orders register view to Excel (.xlsx).
 *
 * @param {Array} filteredOrders - Filtered orders currently displayed
 * @param {string} customFilename - Optional custom filename
 * @returns {Promise<{ filename: string, count: number, buffer: ArrayBuffer }>}
 */
export async function exportLiveOrdersRegisterViewToExcel(filteredOrders, customFilename = null) {
  const today = new Date().toISOString().split('T')[0]
  const filename = customFilename || `ARS_Orders_Register_${today}.xlsx`

  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARS Computers Admin Portal'
  workbook.lastModifiedBy = 'ARS Computers Live Operations'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Live Orders Register', {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 1, ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  worksheet.columns = [
    { header: 'Order Reference', key: 'order_ref', width: 18 },
    { header: 'Order Date', key: 'order_date', width: 14 },
    { header: 'Order Time', key: 'order_time', width: 14 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Contact Information', key: 'contact_info', width: 26 },
    { header: 'Item Summary', key: 'items_summary', width: 36 },
    { header: 'Total Quantity', key: 'total_quantity', width: 14 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
    { header: 'Amount Paid (₹)', key: 'paid_amount', width: 18 },
    { header: 'Balance (₹)', key: 'balance_amount', width: 16 },
    { header: 'Payment Status', key: 'payment_status', width: 16 },
    { header: 'Payment Method', key: 'payment_method', width: 16 },
    { header: 'Order Status', key: 'order_status', width: 18 },
    { header: 'Completed By', key: 'completed_by', width: 22 },
    { header: 'Employee Code', key: 'completed_by_code', width: 18 },
    { header: 'Completion Date', key: 'completion_date', width: 16 },
    { header: 'Approved By', key: 'approved_by', width: 22 },
    { header: 'Approval Date', key: 'approval_date', width: 16 },
    { header: 'Archive Status', key: 'archive_status', width: 22 }
  ]

  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
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
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF020617' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    }
  })

  filteredOrders.forEach((order, index) => {
    const received = formatDateTimeParts(order.created_at)
    const completed = formatDateTimeParts(order.completion_requested_at)
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

    let archiveStatus = 'Active'
    if (order.status === 'completed' || order.is_archived) {
      archiveStatus = order.status === 'cancelled' ? 'Cancelled / Archived' : 'Permanently Archived'
    }

    const row = worksheet.addRow({
      order_ref: order.order_number || order.id,
      order_date: received.date,
      order_time: received.time,
      customer_name: order.customer_name || '—',
      contact_info: order.contact_info || '—',
      items_summary: itemsSummary,
      total_quantity: totalQty,
      total_amount: total.toFixed(2),
      paid_amount: paid.toFixed(2),
      balance_amount: balance.toFixed(2),
      payment_status: (order.payment_status || 'pending').toUpperCase(),
      payment_method: (order.payment_method || 'cash').toUpperCase(),
      order_status: order.status || '—',
      completed_by: order.completed_by_name || '—',
      completed_by_code: order.completed_by_employee_code || '—',
      completion_date: completed.date,
      approved_by: order.approved_by_name || '—',
      approval_date: approved.date,
      archive_status: archiveStatus
    })

    row.height = 22
    const isEven = index % 2 === 1
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 }
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        }
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 2 || colNumber === 3 ||
                    colNumber === 7 || colNumber === 11 || colNumber === 12 ||
                    colNumber === 13 || colNumber === 15 || colNumber === 16 ||
                    colNumber === 18 || colNumber === 19
                      ? 'center'
                      : colNumber === 8 || colNumber === 9 || colNumber === 10
                        ? 'right'
                        : 'left'
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
    })
  })

  if (filteredOrders.length === 0) {
    const emptyRow = worksheet.addRow({
      order_ref: '—',
      order_date: '—',
      order_time: '—',
      customer_name: 'No orders match the current filter selection.',
      contact_info: '',
      items_summary: '',
      total_quantity: '',
      total_amount: '',
      paid_amount: '',
      balance_amount: '',
      payment_status: '',
      payment_method: '',
      order_status: '',
      completed_by: '',
      completed_by_code: '',
      completion_date: '',
      approved_by: '',
      approval_date: '',
      archive_status: ''
    })
    emptyRow.height = 24
  }

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
    count: filteredOrders.length,
    buffer
  }
}
