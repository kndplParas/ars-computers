/**
 * ============================================================================
 * ARS Computers — Dedicated Monthly Enquiries Excel Report Generator
 * ============================================================================
 * Generates standardized monthly audit and compliance Excel (.xlsx) workbooks
 * using ExcelJS.
 *
 * Strict Requirements:
 * 1. Reporting month is based SOLELY on `completion_approved_at`.
 *    (e.g. received Oct 30, completed Nov 2, approved Nov 3 -> November report)
 * 2. Filename format: ARS_Enquiries_<Month>_<Year>.xlsx
 * 3. 18 Standard Reporting Columns.
 * 4. Grounded in actual customer data (no guessing, placeholders, or fake phones/emails).
 * ============================================================================
 */

import ExcelJS from 'exceljs'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/**
 * Format ISO datetime into separate human-readable Date (YYYY-MM-DD) and Time (HH:mm:ss)
 */
export function formatDateTimeParts(isoString) {
  if (!isoString) return { date: '—', time: '—' }
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' }

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`
  }
}

/**
 * Filters enquiries strictly by `completion_approved_at` matching the target month & year.
 * An enquiry received in Oct but approved in Nov strictly belongs to Nov.
 *
 * @param {Array} enquiries
 * @param {number} targetMonthIndex - 0-indexed (0 = Jan, 11 = Dec)
 * @param {number} targetYear - Full year (e.g., 2026)
 * @returns {Array} Filtered enquiries
 */
export function filterEnquiriesByReportingMonth(enquiries, targetMonthIndex, targetYear) {
  if (!Array.isArray(enquiries)) return []

  return enquiries.filter((item) => {
    // Strictly requires completion_approved_at
    if (!item.completion_approved_at) return false

    const approvalDate = new Date(item.completion_approved_at)
    if (Number.isNaN(approvalDate.getTime())) return false

    return (
      approvalDate.getFullYear() === targetYear &&
      approvalDate.getMonth() === targetMonthIndex
    )
  })
}

/**
 * Builds the standard filename for the monthly report.
 * Format: ARS_Enquiries_<Month>_<Year>.xlsx
 */
export function getMonthlyReportFilename(targetMonthIndex, targetYear) {
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  return `ARS_Enquiries_${monthName}_${targetYear}.xlsx`
}

/**
 * Generates an Excel workbook buffer and initiates browser download.
 *
 * @param {Array} allEnquiries - Complete or archived enquiries array
 * @param {number} targetMonthIndex - 0 for January, 11 for December
 * @param {number} targetYear - e.g. 2026
 * @returns {Promise<{ filename: string, count: number }>}
 */
export async function downloadMonthlyEnquiriesExcel(allEnquiries, targetMonthIndex, targetYear) {
  const filtered = filterEnquiriesByReportingMonth(allEnquiries, targetMonthIndex, targetYear)
  const monthName = MONTH_NAMES[targetMonthIndex] || `Month_${targetMonthIndex + 1}`
  const filename = getMonthlyReportFilename(targetMonthIndex, targetYear)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARS Computers Admin Portal'
  workbook.lastModifiedBy = 'ARS Computers Compliance & Reporting'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet(`${monthName} ${targetYear} Enquiries`, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true }
  })

  // Define Columns strictly matching Requirement 11
  worksheet.columns = [
    { header: 'Enquiry ID', key: 'enquiry_id', width: 18 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Contact Information', key: 'contact_info', width: 26 },
    { header: 'Product / Service', key: 'product_service', width: 26 },
    { header: 'Enquiry / Problem', key: 'enquiry_problem', width: 40 },
    { header: 'Received Date', key: 'received_date', width: 14 },
    { header: 'Received Time', key: 'received_time', width: 14 },
    { header: 'Completed By', key: 'completed_by', width: 22 },
    { header: 'Completed By Employee ID/Code', key: 'completed_by_code', width: 24 },
    { header: 'Completion Date', key: 'completion_date', width: 16 },
    { header: 'Completion Time', key: 'completion_time', width: 16 },
    { header: 'Employee Remarks', key: 'employee_remarks', width: 36 },
    { header: 'Approved By', key: 'approved_by', width: 22 },
    { header: 'Approval Date', key: 'approval_date', width: 14 },
    { header: 'Approval Time', key: 'approval_time', width: 14 },
    { header: 'Head Remarks', key: 'head_remarks', width: 36 },
    { header: 'Final Status', key: 'final_status', width: 16 },
    { header: 'Archive Date', key: 'archive_date', width: 14 }
  ]

  // Style Header Row
  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
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
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    }
  })

  // Populate Data Rows
  filtered.forEach((enq) => {
    const received = formatDateTimeParts(enq.created_at)
    const completed = formatDateTimeParts(enq.completion_requested_at)
    const approved = formatDateTimeParts(enq.completion_approved_at)
    const archived = formatDateTimeParts(enq.archived_at || enq.completion_approved_at)

    // Product/service label
    const productService =
      enq.service_requested ||
      enq.category_label ||
      enq.category_interest ||
      'General Enquiry'

    // Real customer contact info without fake guessing
    const contactInfo = enq.contact_info || enq.phone || enq.email || '—'
    const customerName = enq.name || enq.customer_name || '—'

    const row = worksheet.addRow({
      enquiry_id: enq.enquiry_number || enq.id,
      customer_name: customerName,
      contact_info: contactInfo,
      product_service: productService,
      enquiry_problem: enq.message || '—',
      received_date: received.date,
      received_time: received.time,
      completed_by: enq.completed_by_name || '—',
      completed_by_code: enq.completed_by_employee_code || '—',
      completion_date: completed.date,
      completion_time: completed.time,
      employee_remarks: enq.completion_summary || '—',
      approved_by: enq.approved_by_name || '—',
      approval_date: approved.date,
      approval_time: approved.time,
      head_remarks: enq.approval_remarks || '—',
      final_status: enq.status || 'completed',
      archive_date: archived.date
    })

    row.height = 22
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 6 || colNumber === 7 ||
                    colNumber === 10 || colNumber === 11 || colNumber === 14 ||
                    colNumber === 15 || colNumber === 17 || colNumber === 18
                      ? 'center'
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

  // If no records exist, add an informational empty row
  if (filtered.length === 0) {
    const emptyRow = worksheet.addRow({
      enquiry_id: '—',
      customer_name: `No approved enquiries found for ${monthName} ${targetYear}.`,
      contact_info: '',
      product_service: '',
      enquiry_problem: '',
      received_date: '',
      received_time: '',
      completed_by: '',
      completed_by_code: '',
      completion_date: '',
      completion_time: '',
      employee_remarks: '',
      approved_by: '',
      approval_date: '',
      approval_time: '',
      head_remarks: '',
      final_status: '',
      archive_date: ''
    })
    emptyRow.height = 24
  }

  // Trigger browser download via Blob
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
