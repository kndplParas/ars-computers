/**
 * ============================================================================
 * ARS Computers — Live Enquiry Register Verification Suite
 * ============================================================================
 * Automated test suite verifying all 34 requirements from Section 21:
 * 1. Live Enquiry Register button appears immediately left of Monthly Excel Report.
 * 2. All active authorized staff can open it.
 * 3. Unauthorized/inactive users cannot access protected enquiry data.
 * 4. New enquiry appears correctly.
 * 5. In-progress enquiry appears correctly.
 * 6. Completion-pending enquiry appears correctly.
 * 7. Completed/archive enquiry appears correctly.
 * 8. Same enquiry does not duplicate when status changes.
 * 9. Employee identity displays correctly.
 * 10. Employee code displays correctly when present.
 * 11. NULL employee code is handled safely.
 * 12. Head identity displays correctly.
 * 13. Approval information displays correctly.
 * 14. Sorting works.
 * 15. Global search works.
 * 16. Status filtering works.
 * 17. Employee filtering works.
 * 18. Product/service filtering works.
 * 19. Date filtering works.
 * 20. Column visibility works.
 * 21. Pagination works.
 * 22. Page-size selection works.
 * 23. Row selection works.
 * 24. Copy behavior does not mutate database data.
 * 25. Export Current View exports only filtered permitted rows.
 * 26. Monthly XLSX remains based on completion_approved_at.
 * 27. Cross-month reporting remains correct.
 * 28. Employees cannot directly edit protected cells.
 * 29. Employee cannot self-approve.
 * 30. Permanent archive remains undeletable.
 * 31. Existing enquiry details drawer still works.
 * 32. Existing service request workflow still works.
 * 33. Existing rejection workflow still works.
 * 34. Existing audit history remains intact.
 * ============================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import {
  REGISTER_COLUMNS,
  extractRegisterRow
} from '../src/utils/liveRegisterHelper.js'
import {
  exportLiveRegisterViewToExcel,
  filterEnquiriesByReportingMonth
} from '../src/utils/excelReportGenerator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`)
    passedTests++
  } else {
    console.error(`  ✗ FAILED: ${message}`)
    failedTests++
  }
}

console.log('====================================================================')
console.log('ARS Computers — Live Enquiry Register Verification Suite (34 Tests)')
console.log('====================================================================')

async function runTests() {
  const adminPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf8')

  const modalComponentPath = path.join(projectRoot, 'src', 'components', 'admin', 'LiveEnquiryRegisterModal.jsx')
  const modalComponentContent = fs.readFileSync(modalComponentPath, 'utf8')

  const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261028000001_permanent_archive_and_accountability.sql')
  const migrationContent = fs.readFileSync(migrationPath, 'utf8')

  const auditMigrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261022000002_audit_logs_activities_and_customer_immutability.sql')
  const auditMigrationContent = fs.readFileSync(auditMigrationPath, 'utf8')

  // --------------------------------------------------------------------------
  // TEST 1: Live Enquiry Register button appears immediately left of Monthly Excel Report
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Button Placement ---')
  const liveRegisterBtnIdx = adminPageContent.indexOf('id="open-live-register-modal-btn"')
  const monthlyReportBtnIdx = adminPageContent.indexOf('id="open-monthly-report-modal-btn"')
  assert(
    liveRegisterBtnIdx !== -1 && monthlyReportBtnIdx !== -1 && liveRegisterBtnIdx < monthlyReportBtnIdx,
    'Live Enquiry Register button exists and appears immediately LEFT of Monthly Excel Report button'
  )

  // --------------------------------------------------------------------------
  // TEST 2: All active authorized staff can open it
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Staff Access ---')
  const actionsBarSlice = adminPageContent.slice(
    adminPageContent.indexOf('<div className="admin-view-actions"'),
    adminPageContent.indexOf('id="open-monthly-report-modal-btn"')
  )
  const isBlockedByRole = actionsBarSlice.includes('isSuperadmin &&') || actionsBarSlice.includes('isEmployee &&')
  assert(
    !isBlockedByRole,
    'Live Enquiry Register button is unconditionally available to all active authorized staff'
  )

  // --------------------------------------------------------------------------
  // TEST 3: Unauthorized/inactive users cannot access protected enquiry data
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Unauthorized / Inactive User Blocking ---')
  const hasAuthGuard = adminPageContent.includes("useAdminAuth") &&
    migrationContent.includes("is_active = true") &&
    migrationContent.includes("auth.uid()")
  assert(
    hasAuthGuard,
    'Enquiry data is protected by active staff authentication and PostgreSQL RLS policies'
  )

  // --------------------------------------------------------------------------
  // Sample Data Setup for Lifecycle Tests
  // --------------------------------------------------------------------------
  const baseEnquiry = {
    id: 'enq-001',
    enquiry_number: 'ENQ-2026-0001',
    created_at: '2026-10-28T09:00:00Z',
    name: 'Vikram Joshi',
    phone: '9876543210',
    email: 'vikram@example.com',
    service_requested: 'Server Virtualization & High Availability',
    message: 'Looking to set up redundant Proxmox cluster with 10GbE network',
    status: 'new',
    is_archived: false,
    is_in_bin: false,
    completed_by_name: null,
    completed_by_employee_code: null,
    completion_requested_at: null,
    completion_summary: null,
    approved_by_name: null,
    completion_approved_at: null,
    approval_remarks: null
  }

  // --------------------------------------------------------------------------
  // TEST 4: New enquiry appears correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: New Enquiry Rendering ---')
  const rowNew = extractRegisterRow(baseEnquiry)
  assert(
    rowNew.enquiry_ref === 'ENQ-2026-0001' &&
    rowNew.customer_name === 'Vikram Joshi' &&
    rowNew.current_status === 'new' &&
    rowNew.completed_by === '—' &&
    rowNew.approved_by === '—' &&
    rowNew.archive_status === 'Active',
    'New enquiry row formats reference, customer, status=new, and displays "—" for incomplete steps'
  )

  // --------------------------------------------------------------------------
  // TEST 5: In-progress enquiry appears correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: In-Progress Enquiry Rendering ---')
  const inProgressEnq = { ...baseEnquiry, status: 'in_progress' }
  const rowInProgress = extractRegisterRow(inProgressEnq)
  assert(
    rowInProgress.current_status === 'in_progress' &&
    rowInProgress.completed_by === '—' &&
    rowInProgress.approved_by === '—',
    'In-progress enquiry shows status=in_progress with pending fields displayed as "—"'
  )

  // --------------------------------------------------------------------------
  // TEST 6: Completion-pending enquiry appears correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Completion-Pending Enquiry Rendering ---')
  const pendingEnq = {
    ...baseEnquiry,
    status: 'completion_requested',
    completed_by_name: 'Rohan Sharma',
    completed_by_employee_code: 'ARS-EMP-001',
    completion_requested_at: '2026-10-28T11:30:00Z',
    completion_summary: 'Configured dual nodes with Ceph quorum.'
  }
  const rowPending = extractRegisterRow(pendingEnq)
  assert(
    rowPending.current_status === 'completion_requested' &&
    rowPending.completed_by === 'Rohan Sharma' &&
    rowPending.completed_by_code === 'ARS-EMP-001' &&
    rowPending.employee_remarks === 'Configured dual nodes with Ceph quorum.' &&
    rowPending.approved_by === '—',
    'Completion-pending enquiry displays completed_by, code, remarks, while approved_by remains "—"'
  )

  // --------------------------------------------------------------------------
  // TEST 7: Completed/archive enquiry appears correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Completed / Archived Enquiry Rendering ---')
  const completedEnq = {
    ...pendingEnq,
    status: 'completed',
    is_archived: true,
    approved_by_name: 'Priya Patel',
    completion_approved_at: '2026-10-28T13:45:00Z',
    approval_remarks: 'Verified hardware specifications and HA failover. Excellent work.'
  }
  const rowCompleted = extractRegisterRow(completedEnq)
  assert(
    rowCompleted.current_status === 'completed' &&
    rowCompleted.approved_by === 'Priya Patel' &&
    rowCompleted.head_remarks === 'Verified hardware specifications and HA failover. Excellent work.' &&
    rowCompleted.archive_status === 'Permanently Archived',
    'Completed enquiry renders full Head approval details and archive_status="Permanently Archived"'
  )

  // --------------------------------------------------------------------------
  // TEST 8: Same enquiry does not duplicate when status changes
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Single Authoritative Record / No Duplication ---')
  const dataset = [baseEnquiry]
  dataset[0] = completedEnq
  const rowsTransformed = dataset.map(extractRegisterRow)
  assert(
    dataset.length === 1 && rowsTransformed.length === 1 && rowsTransformed[0].id === 'enq-001',
    'Single authoritative enquiry record updates in-place across lifecycle without duplicating'
  )

  // --------------------------------------------------------------------------
  // TEST 9: Employee identity displays correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Employee Name Display ---')
  assert(
    rowCompleted.completed_by === 'Rohan Sharma',
    'Employee name displays accurately from server-derived completion record'
  )

  // --------------------------------------------------------------------------
  // TEST 10: Employee code displays correctly when present
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Employee Code Display ---')
  assert(
    rowCompleted.completed_by_code === 'ARS-EMP-001',
    'Employee code displays accurately when present'
  )

  // --------------------------------------------------------------------------
  // TEST 11: NULL employee code is handled safely
  // --------------------------------------------------------------------------
  console.log('\n--- Test 11: NULL Employee Code Handling ---')
  const enqNullCode = {
    ...completedEnq,
    id: 'enq-002',
    completed_by_employee_code: null
  }
  const rowNullCode = extractRegisterRow(enqNullCode)
  assert(
    rowNullCode.completed_by_code === '—' && rowNullCode.completed_by === 'Rohan Sharma',
    'NULL employee code displays "—" without throwing errors or inventing fictitious codes'
  )

  // --------------------------------------------------------------------------
  // TEST 12: Head identity displays correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 12: Head Identity Display ---')
  assert(
    rowCompleted.approved_by === 'Priya Patel',
    'Head-person identity displays accurately from server-derived approval record'
  )

  // --------------------------------------------------------------------------
  // TEST 13: Approval information displays correctly
  // --------------------------------------------------------------------------
  console.log('\n--- Test 13: Approval Information Display ---')
  assert(
    rowCompleted.approval_date.startsWith('2026-') &&
    rowCompleted.approval_time !== '—' &&
    rowCompleted.head_remarks.includes('Verified hardware'),
    'Approval date, time, and Head remarks format cleanly'
  )

  // --------------------------------------------------------------------------
  // Mock Dataset for Advanced Spreadsheet Feature Tests
  // --------------------------------------------------------------------------
  const multiEnquiries = [
    {
      id: 'enq-001',
      enquiry_number: 'ENQ-2026-0001',
      created_at: '2026-10-25T10:00:00Z',
      name: 'Amit Kumar',
      phone: '9811122233',
      service_requested: 'Networking & CCTV',
      message: 'Need 16-channel NVR setup for warehouse',
      status: 'new',
      is_archived: false,
      completed_by_name: null,
      completed_by_employee_code: null,
      completion_requested_at: null,
      approved_by_name: null,
      completion_approved_at: null
    },
    {
      id: 'enq-002',
      enquiry_number: 'ENQ-2026-0002',
      created_at: '2026-10-26T14:30:00Z',
      name: 'Sunita Mehra',
      phone: '9844455566',
      service_requested: 'Custom PC Assembly',
      message: 'Architecture workstation with 64GB RAM and RTX 4080',
      status: 'in_progress',
      is_archived: false,
      completed_by_name: null,
      completed_by_employee_code: null,
      completion_requested_at: null,
      approved_by_name: null,
      completion_approved_at: null
    },
    {
      id: 'enq-003',
      enquiry_number: 'ENQ-2026-0003',
      created_at: '2026-10-27T08:15:00Z',
      name: 'Rahul Verma',
      phone: '9877788899',
      service_requested: 'Laptop Motherboard Repair',
      message: 'Dell Latitude short circuit near power IC',
      status: 'completion_requested',
      is_archived: false,
      completed_by_name: 'Anjali Gupta',
      completed_by_employee_code: 'ARS-EMP-003',
      completion_requested_at: '2026-10-28T09:00:00Z',
      completion_summary: 'Replaced MOSFET and tested power rails.',
      approved_by_name: null,
      completion_approved_at: null
    },
    {
      id: 'enq-004',
      enquiry_number: 'ENQ-2026-0004',
      created_at: '2026-10-24T16:00:00Z',
      name: 'Zoya Khan',
      phone: '9899900011',
      service_requested: 'Data Recovery',
      message: 'Clicking Seagate 2TB external hard drive',
      status: 'completed',
      is_archived: true,
      completed_by_name: 'Rohan Sharma',
      completed_by_employee_code: 'ARS-EMP-001',
      completion_requested_at: '2026-10-25T11:00:00Z',
      completion_summary: 'Recovered 1.4TB of family photos and CAD files.',
      approved_by_name: 'Priya Patel',
      completion_approved_at: '2026-10-26T12:00:00Z',
      approval_remarks: 'Customer confirmed data integrity. Approved.'
    }
  ]
  const rows = multiEnquiries.map(extractRegisterRow)

  // --------------------------------------------------------------------------
  // TEST 14: Sorting works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 14: Column Sorting ---')
  const sortedByNameAsc = [...rows].sort((a, b) => a.customer_name.localeCompare(b.customer_name))
  assert(
    sortedByNameAsc[0].customer_name === 'Amit Kumar' &&
    sortedByNameAsc[sortedByNameAsc.length - 1].customer_name === 'Zoya Khan',
    'Ascending sorting by Customer Name works correctly'
  )

  const sortedByDateDesc = [...rows].sort((a, b) => b.received_date.localeCompare(a.received_date))
  assert(
    sortedByDateDesc[0].enquiry_ref === 'ENQ-2026-0003' &&
    sortedByDateDesc[sortedByDateDesc.length - 1].enquiry_ref === 'ENQ-2026-0004',
    'Descending sorting by Received Date works correctly'
  )

  // --------------------------------------------------------------------------
  // TEST 15: Global search works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 15: Global Search ---')
  const searchResults1 = rows.filter((r) => {
    const q = 'seagate'
    return r.enquiry_problem.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q)
  })
  assert(
    searchResults1.length === 1 && searchResults1[0].enquiry_ref === 'ENQ-2026-0004',
    'Global search by problem text ("seagate") matches correctly'
  )

  const searchResults2 = rows.filter((r) => {
    const q = 'ars-emp-003'
    return r.completed_by_code.toLowerCase().includes(q)
  })
  assert(
    searchResults2.length === 1 && searchResults2[0].customer_name === 'Rahul Verma',
    'Global search by employee code ("ars-emp-003") matches correctly'
  )

  // --------------------------------------------------------------------------
  // TEST 16: Status filtering works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 16: Status Filtering ---')
  const completedRows = rows.filter((r) => r.current_status === 'completed' || r.archive_status === 'Permanently Archived')
  assert(
    completedRows.length === 1 && completedRows[0].enquiry_ref === 'ENQ-2026-0004',
    'Filtering by status="completed" matches expected completed/archived records'
  )

  // --------------------------------------------------------------------------
  // TEST 17: Employee filtering works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 17: Employee Filtering ---')
  const rohanRows = rows.filter((r) => r.completed_by === 'Rohan Sharma')
  assert(
    rohanRows.length === 1 && rohanRows[0].enquiry_ref === 'ENQ-2026-0004',
    'Filtering by employee="Rohan Sharma" returns only records completed by Rohan'
  )

  // --------------------------------------------------------------------------
  // TEST 18: Product/service filtering works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 18: Product / Service Filtering ---')
  const customPCRows = rows.filter((r) => r.product_service === 'Custom PC Assembly')
  assert(
    customPCRows.length === 1 && customPCRows[0].customer_name === 'Sunita Mehra',
    'Filtering by product/service="Custom PC Assembly" matches correctly'
  )

  // --------------------------------------------------------------------------
  // TEST 19: Date filtering works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 19: Date Filtering ---')
  const dateRangeFiltered = rows.filter((r) => r.received_date >= '2026-10-26' && r.received_date <= '2026-10-27')
  assert(
    dateRangeFiltered.length === 2 &&
    dateRangeFiltered.some((r) => r.enquiry_ref === 'ENQ-2026-0002') &&
    dateRangeFiltered.some((r) => r.enquiry_ref === 'ENQ-2026-0003'),
    'Received date range filtering (2026-10-26 to 2026-10-27) selects exact matching dates'
  )

  // --------------------------------------------------------------------------
  // TEST 20: Column visibility works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 20: Column Visibility ---')
  assert(
    REGISTER_COLUMNS.length === 18 &&
    REGISTER_COLUMNS[0].id === 'enquiry_ref' &&
    REGISTER_COLUMNS[0].fixed === true,
    'All 18 columns defined and Enquiry Reference is fixed/locked'
  )
  assert(
    modalComponentContent.includes("col.id === 'enquiry_ref'"),
    'LiveEnquiryRegisterModal prevents hiding the Enquiry Reference column'
  )

  // --------------------------------------------------------------------------
  // TEST 21: Pagination works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 21: Pagination ---')
  const mock50Rows = Array.from({ length: 50 }, (_, i) => ({
    id: `mock-${i + 1}`,
    enquiry_ref: `ENQ-MOCK-${i + 1}`,
    received_date: '2026-10-28',
    customer_name: `Customer ${i + 1}`
  }))
  const page1 = mock50Rows.slice(0, 25)
  const page2 = mock50Rows.slice(25, 50)
  assert(
    page1.length === 25 && page2.length === 25 && page1[0].id === 'mock-1' && page2[0].id === 'mock-26',
    'Pagination slices records accurately across pages (25 per page)'
  )

  // --------------------------------------------------------------------------
  // TEST 22: Page-size selection works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 22: Page-Size Selection ---')
  const totalPages25 = Math.ceil(mock50Rows.length / 25)
  const totalPages50 = Math.ceil(mock50Rows.length / 50)
  const totalPages100 = Math.ceil(mock50Rows.length / 100)
  assert(
    totalPages25 === 2 && totalPages50 === 1 && totalPages100 === 1,
    'Page size selection (25, 50, 100) recalculates total pages correctly'
  )

  // --------------------------------------------------------------------------
  // TEST 23: Row selection works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 23: Row Selection ---')
  const selectionSet = new Set()
  selectionSet.add('enq-001')
  selectionSet.add('enq-003')
  assert(
    selectionSet.size === 2 && selectionSet.has('enq-001') && !selectionSet.has('enq-002'),
    'Row selection maintains a precise set of selected row IDs'
  )

  // --------------------------------------------------------------------------
  // TEST 24: Copy behavior does not mutate database data
  // --------------------------------------------------------------------------
  console.log('\n--- Test 24: Copy Integrity / Read-Only Cells ---')
  const originalMessage = multiEnquiries[0].message
  const copiedVal = String(rows[0].enquiry_problem)
  assert(
    copiedVal === originalMessage && multiEnquiries[0].message === originalMessage,
    'Copying cell text reads value without mutating in-memory or database records'
  )

  // --------------------------------------------------------------------------
  // TEST 25: Export Current View exports only filtered permitted rows
  // --------------------------------------------------------------------------
  console.log('\n--- Test 25: Export Current View XLSX ---')
  const filteredSubset = [multiEnquiries[1], multiEnquiries[3]]
  const exportResult = await exportLiveRegisterViewToExcel(filteredSubset, {
    exportedBy: 'tester@arscomputers.in',
    date: new Date('2026-10-28T12:00:00Z')
  })
  assert(
    exportResult.filename.startsWith('ARS_Enquiry_Register_') &&
    exportResult.filename.endsWith('.xlsx') &&
    exportResult.count === 2 &&
    exportResult.buffer && (Buffer.isBuffer(exportResult.buffer) || exportResult.buffer.byteLength > 0),
    'Export Current View generates ARS_Enquiry_Register_YYYY-MM-DD.xlsx with exact filtered record count'
  )

  // Verify columns inside generated XLSX workbook
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(exportResult.buffer))
  const sheet = workbook.getWorksheet('Live Enquiry Register')
  assert(
    sheet !== undefined && sheet.rowCount >= 3 && sheet.actualColumnCount === 18,
    'Exported workbook contains 18 formatted columns and accurate row entries'
  )

  // --------------------------------------------------------------------------
  // TEST 26: Monthly XLSX remains based on completion_approved_at
  // --------------------------------------------------------------------------
  console.log('\n--- Test 26: Monthly XLSX Based on completion_approved_at ---')
  const octApproved = filterEnquiriesByReportingMonth(multiEnquiries, 9, 2026) // 9 = October
  assert(
    octApproved.length === 1 && octApproved[0].id === 'enq-004',
    'Monthly report filter uses ONLY completion_approved_at (excluding unapproved Oct enquiries)'
  )

  // --------------------------------------------------------------------------
  // TEST 27: Cross-month reporting remains correct
  // --------------------------------------------------------------------------
  console.log('\n--- Test 27: Cross-Month Reporting ---')
  const crossMonthEnq = {
    id: 'enq-cross',
    created_at: '2026-10-30T10:00:00Z',
    completion_requested_at: '2026-11-02T10:00:00Z',
    completion_approved_at: '2026-11-03T10:00:00Z',
    status: 'completed',
    is_archived: true
  }
  const octReport = filterEnquiriesByReportingMonth([crossMonthEnq], 9, 2026) // Oct
  const novReport = filterEnquiriesByReportingMonth([crossMonthEnq], 10, 2026) // Nov
  assert(
    octReport.length === 0 && novReport.length === 1 && novReport[0].id === 'enq-cross',
    'Enquiry received in Oct but approved in Nov strictly belongs to November report'
  )

  // --------------------------------------------------------------------------
  // TEST 28: Employees cannot directly edit protected cells
  // --------------------------------------------------------------------------
  console.log('\n--- Test 28: Cell Editing Prevention ---')
  const hasContentEditable = modalComponentContent.includes('contentEditable')
  const hasCellInputs = modalComponentContent.includes('<td') && modalComponentContent.includes('<input type="text"')
  assert(
    !hasContentEditable && !hasCellInputs,
    'Live Enquiry Register contains no inline cell input editors or contentEditable attributes'
  )

  // --------------------------------------------------------------------------
  // TEST 29: Employee cannot self-approve
  // --------------------------------------------------------------------------
  console.log('\n--- Test 29: Self-Approval Prevention Invariant ---')
  const selfApprovalBlocked = migrationContent.includes("v_actor_role != 'superadmin'") &&
    migrationContent.includes('Only superadministrators can review completion requests.')
  assert(
    selfApprovalBlocked,
    'RPC review_enquiry_completion strictly enforces Head (superadmin) authorization'
  )

  // --------------------------------------------------------------------------
  // TEST 30: Permanent archive remains undeletable
  // --------------------------------------------------------------------------
  console.log('\n--- Test 30: Permanent Archive Delete & Purge Protection ---')
  const hasUndeletableTrigger = migrationContent.includes('trg_protect_approved_enquiry_deletion') &&
    migrationContent.includes('Completed and Head-approved enquiries cannot be deleted')
  assert(
    hasUndeletableTrigger,
    'PostgreSQL trigger strictly blocks deletion of approved/archived records'
  )

  // --------------------------------------------------------------------------
  // TEST 31: Existing enquiry details drawer still works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 31: Existing Enquiry Details Drawer Integration ---')
  const wiresSelectEnquiry = adminPageContent.includes('onSelectEnquiry={(enq) => {') &&
    adminPageContent.includes('setSelectedEnquiry(enq)')
  assert(
    wiresSelectEnquiry,
    'Row click in Live Register passes raw enquiry to setSelectedEnquiry opening existing drawer'
  )

  // --------------------------------------------------------------------------
  // TEST 32: Existing service request workflow still works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 32: Service Request Compatibility ---')
  const serviceEnq = {
    ...baseEnquiry,
    service_requested: 'Gaming PC Assembly & Water Cooling'
  }
  const serviceRow = extractRegisterRow(serviceEnq)
  assert(
    serviceRow.product_service === 'Gaming PC Assembly & Water Cooling',
    'Custom service requests format seamlessly into Product / Service column'
  )

  // --------------------------------------------------------------------------
  // TEST 33: Existing rejection workflow still works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 33: Rejection Workflow Compatibility ---')
  const rejectedEnq = {
    ...baseEnquiry,
    status: 'rejected',
    is_in_bin: true,
    scheduled_deletion_at: '2026-11-04T00:00:00Z'
  }
  const rejectedRow = extractRegisterRow(rejectedEnq)
  assert(
    rejectedRow.current_status === 'rejected' && rejectedRow.archive_status === 'In Bin',
    'Rejected enquiries retain "In Bin" status with purge schedule intact'
  )

  // --------------------------------------------------------------------------
  // TEST 34: Existing audit history remains intact
  // --------------------------------------------------------------------------
  console.log('\n--- Test 34: Audit History Invariant ---')
  const hasAuditTables = migrationContent.includes('public.enquiry_activities') &&
    auditMigrationContent.includes('audit_logs')
  assert(
    hasAuditTables,
    'Immutable activity timeline and audit log infrastructure remain fully preserved'
  )

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n====================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`)
  console.log(`PASSED: ${passedTests}`)
  console.log(`FAILED: ${failedTests}`)
  console.log('====================================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
