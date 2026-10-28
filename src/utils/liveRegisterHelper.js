/**
 * ============================================================================
 * ARS Computers — Live Enquiry Register Helper Utilities
 * ============================================================================
 * Provides:
 * 1. 18 Standard spreadsheet columns definition with min/default widths and sortable flags.
 * 2. Row extraction and data normalization for live enquiry spreadsheet views.
 * 3. Status quick-filter definitions.
 * ============================================================================
 */

import { formatDateTimeParts } from './excelReportGenerator.js'

// 18 Standard Spreadsheet Columns strictly matching Requirement 4
export const REGISTER_COLUMNS = [
  { id: 'enquiry_ref', label: 'Enquiry Reference', defaultWidth: 160, minWidth: 120, fixed: true, sortable: true },
  { id: 'received_date', label: 'Received Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'received_time', label: 'Received Time', defaultWidth: 110, minWidth: 90, sortable: true },
  { id: 'customer_name', label: 'Customer Name', defaultWidth: 160, minWidth: 120, sortable: true },
  { id: 'contact_info', label: 'Contact Information', defaultWidth: 170, minWidth: 130, sortable: true },
  { id: 'product_service', label: 'Product / Service', defaultWidth: 160, minWidth: 120, sortable: true },
  { id: 'enquiry_problem', label: 'Enquiry / Problem', defaultWidth: 240, minWidth: 150, sortable: false },
  { id: 'current_status', label: 'Current Status', defaultWidth: 130, minWidth: 110, sortable: true },
  { id: 'completed_by', label: 'Completed By', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'completed_by_code', label: 'Employee ID / Code', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'completion_date', label: 'Completion Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'completion_time', label: 'Completion Time', defaultWidth: 110, minWidth: 90, sortable: true },
  { id: 'employee_remarks', label: 'Employee Remarks', defaultWidth: 200, minWidth: 140, sortable: false },
  { id: 'approved_by', label: 'Approved By', defaultWidth: 140, minWidth: 110, sortable: true },
  { id: 'approval_date', label: 'Approval Date', defaultWidth: 120, minWidth: 100, sortable: true },
  { id: 'approval_time', label: 'Approval Time', defaultWidth: 110, minWidth: 90, sortable: true },
  { id: 'head_remarks', label: 'Head Remarks', defaultWidth: 200, minWidth: 140, sortable: false },
  { id: 'archive_status', label: 'Archive Status', defaultWidth: 150, minWidth: 120, sortable: true }
]

// Status Quick Filter Options matching canonical lifecycle
export const STATUS_QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'pending_completion', label: 'Completion Pending' },
  { id: 'completed', label: 'Completed / Archived' }
]

/**
 * Extracts and formats cell data for a single enquiry record into spreadsheet row format.
 * Displays '—' where data genuinely does not exist.
 *
 * @param {Object} enq - Raw enquiry object
 * @returns {Object|null} Formatted spreadsheet row representation
 */
export function extractRegisterRow(enq) {
  if (!enq) return null

  const received = formatDateTimeParts(enq.created_at)
  const completed = formatDateTimeParts(enq.completion_requested_at)
  const approved = formatDateTimeParts(enq.completion_approved_at)

  const productService =
    enq.service_requested ||
    enq.category_label ||
    enq.category_interest ||
    'General Enquiry'

  const contactInfo = enq.contact_info || enq.phone || enq.email || '—'
  const customerName = enq.name || enq.customer_name || '—'

  let archiveStatus = 'Active'
  if (enq.is_archived || enq.status === 'completed') {
    archiveStatus = 'Permanently Archived'
  } else if (enq.is_in_bin) {
    archiveStatus = 'In Bin'
  }

  return {
    raw: enq,
    id: enq.id,
    enquiry_ref: enq.enquiry_number || enq.id || '—',
    received_date: received.date,
    received_time: received.time,
    customer_name: customerName,
    contact_info: contactInfo,
    product_service: productService,
    enquiry_problem: enq.message || '—',
    current_status: enq.status || '—',
    completed_by: enq.completed_by_name || '—',
    completed_by_code: enq.completed_by_employee_code || '—',
    completion_date: completed.date,
    completion_time: completed.time,
    employee_remarks: enq.completion_summary || '—',
    approved_by: enq.approved_by_name || '—',
    approval_date: approved.date,
    approval_time: approved.time,
    head_remarks: enq.approval_remarks || '—',
    archive_status: archiveStatus
  }
}
