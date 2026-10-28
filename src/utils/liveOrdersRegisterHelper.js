/**
 * ============================================================================
 * ARS Computers — Live Orders Register Helper Utilities
 * ============================================================================
 * Provides:
 * 1. 19 Standard spreadsheet columns definition for sales orders.
 * 2. Row extraction and data normalization for live order spreadsheet views.
 * 3. Status quick-filter definitions.
 * ============================================================================
 */

import { formatDateTimeParts } from './excelReportGenerator.js'

// 19 Standard Spreadsheet Columns strictly matching Requirement 16
export const ORDER_REGISTER_COLUMNS = [
  { id: 'order_ref', label: 'Order Reference', defaultWidth: 160, minWidth: 120, fixed: true, sortable: true },
  { id: 'order_date', label: 'Order Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'order_time', label: 'Order Time', defaultWidth: 110, minWidth: 90, sortable: true },
  { id: 'customer_name', label: 'Customer Name', defaultWidth: 160, minWidth: 120, sortable: true },
  { id: 'contact_info', label: 'Contact Information', defaultWidth: 170, minWidth: 130, sortable: true },
  { id: 'items_summary', label: 'Item Summary', defaultWidth: 220, minWidth: 150, sortable: false },
  { id: 'total_quantity', label: 'Total Quantity', defaultWidth: 110, minWidth: 90, sortable: true },
  { id: 'total_amount', label: 'Total Amount (₹)', defaultWidth: 130, minWidth: 100, sortable: true },
  { id: 'paid_amount', label: 'Amount Paid (₹)', defaultWidth: 130, minWidth: 100, sortable: true },
  { id: 'balance_amount', label: 'Balance (₹)', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'payment_status', label: 'Payment Status', defaultWidth: 130, minWidth: 110, sortable: true },
  { id: 'payment_method', label: 'Payment Method', defaultWidth: 130, minWidth: 110, sortable: true },
  { id: 'order_status', label: 'Order Status', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'completed_by', label: 'Completed By', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'completed_by_code', label: 'Employee Code', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'completion_date', label: 'Completion Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'approved_by', label: 'Approved By', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'approval_date', label: 'Approval Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'archive_status', label: 'Archive Status', defaultWidth: 150, minWidth: 120, sortable: true }
]

// Status Quick Filter Options matching canonical order lifecycle
export const ORDER_STATUS_QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'processing', label: 'Processing' },
  { id: 'completion_requested', label: 'Completion Pending' },
  { id: 'completed', label: 'Completed / Archived' },
  { id: 'cancelled', label: 'Cancelled' }
]

/**
 * Extracts and formats cell data for a single order record into spreadsheet row format.
 * Displays '—' where data genuinely does not exist.
 *
 * @param {Object} order - Raw order object with optional order_items
 * @returns {Object|null} Formatted spreadsheet row representation
 */
export function extractOrderRegisterRow(order) {
  if (!order) return null

  const received = formatDateTimeParts(order.created_at)
  const completed = formatDateTimeParts(order.completion_requested_at)
  const approved = formatDateTimeParts(order.completion_approved_at)

  // Build items summary and count total quantity
  let itemsSummary = '—'
  let totalQuantity = 0
  if (Array.isArray(order.order_items) && order.order_items.length > 0) {
    itemsSummary = order.order_items
      .map((it) => `${it.product_name_snapshot || 'Item'} (x${it.quantity})`)
      .join(', ')
    totalQuantity = order.order_items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
  }

  const totalAmount = Number(order.total_amount) || 0
  const paidAmount = Number(order.paid_amount) || 0
  const balance = Math.max(0, totalAmount - paidAmount)

  let archiveStatus = 'Active'
  if (order.status === 'completed' || order.is_archived) {
    archiveStatus = order.status === 'cancelled' ? 'Cancelled / Archived' : 'Permanently Archived'
  }

  return {
    raw: order,
    id: order.id,
    order_ref: order.order_number || order.id || '—',
    order_date: received.date,
    order_time: received.time,
    customer_name: order.customer_name || '—',
    contact_info: order.contact_info || '—',
    items_summary: itemsSummary,
    total_quantity: totalQuantity > 0 ? totalQuantity : (order.items_count || 1),
    total_amount: totalAmount.toFixed(2),
    paid_amount: paidAmount.toFixed(2),
    balance_amount: balance.toFixed(2),
    payment_status: (order.payment_status || 'pending').toUpperCase(),
    payment_method: (order.payment_method || 'cash').toUpperCase(),
    order_status: order.status || '—',
    completed_by: order.completed_by_name || '—',
    completed_by_code: order.completed_by_employee_code || '—',
    completion_date: completed.date,
    completion_time: completed.time,
    employee_remarks: order.employee_remarks || '—',
    approved_by: order.approved_by_name || '—',
    approved_by_code: order.approved_by_employee_code || '—',
    approval_date: approved.date,
    approval_time: approved.time,
    head_remarks: order.head_remarks || '—',
    archive_status: archiveStatus
  }
}
