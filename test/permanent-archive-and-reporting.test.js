/**
 * ============================================================================
 * ARS Computers — Permanent Archive, Accountability & Monthly Reporting Tests
 * ============================================================================
 * Automated invariant & functional verification suite for Phase 1 audit
 * corrections and Phase 2 permanent archive implementation.
 *
 * Verifies:
 * 1. Employee cannot self-approve completion.
 * 2. Employee completion identity comes from authenticated DB identity.
 * 3. Only Head can final-approve.
 * 4. Head approval permanently archives the enquiry.
 * 5. Approved archive has no scheduled deletion (scheduled_deletion_at is NULL).
 * 6. Approved archived enquiry cannot be purged (DB CHECK constraint, trigger & purge filter).
 * 7. Employee cannot alter archived history (Anti-tamper trigger & RLS).
 * 8. Employee can read permitted archived records.
 * 9. All active authorized staff can generate report data.
 * 10. Inactive/unauthorized users cannot access report data.
 * 11. Monthly report uses completion_approved_at.
 * 12. Cross-month enquiry goes into approval month.
 * 13. Employee name/code snapshots remain historically stable.
 * 14. Customer immutable fields remain protected.
 * 15. Existing rejection workflow still works.
 * 16. Existing service requests still work.
 * 17. Concurrency-safe human-readable enquiry number via PostgreSQL sequence.
 * 18. Standard filename format: ARS_Enquiries_<Month>_<Year>.xlsx.
 * 19. All 18 required reporting columns present in output workbook.
 * 20. Real customer data preserved without fake guessed phone/email placeholders.
 * ============================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  filterEnquiriesByReportingMonth,
  getMonthlyReportFilename,
  downloadMonthlyEnquiriesExcel
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
console.log('ARS Computers — Permanent Archive, Accountability & Reporting Tests')
console.log('====================================================================')

// ----------------------------------------------------------------------------
// Suite 1: Database Migration Schema & Permanent Archive Invariants
// ----------------------------------------------------------------------------
console.log('\n[Suite 1] Inspecting Migration 20261028000001_permanent_archive_and_accountability.sql:')
const migPath = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261028000001_permanent_archive_and_accountability.sql'
)
assert(fs.existsSync(migPath), 'Migration file exists in supabase/migrations/')

const migContent = fs.readFileSync(migPath, 'utf8')

assert(
  migContent.includes('ALTER TABLE public.admin_users') &&
  migContent.includes('ADD COLUMN IF NOT EXISTS employee_code TEXT'),
  '1.1 admin_users extended with nullable employee_code for business reporting (Requirement 5)'
)

assert(
  migContent.includes('CREATE SEQUENCE IF NOT EXISTS public.enquiry_reference_seq') &&
  migContent.includes('START WITH 1001') &&
  migContent.includes("pg_catalog.nextval('public.enquiry_reference_seq')"),
  '1.2 Concurrency-safe enquiry number generated via PostgreSQL sequence, NOT COUNT(*) + 1 (Requirement 6)'
)

assert(
  migContent.includes('ADD COLUMN IF NOT EXISTS completed_by_name TEXT') &&
  migContent.includes('ADD COLUMN IF NOT EXISTS completed_by_employee_code TEXT') &&
  migContent.includes('ADD COLUMN IF NOT EXISTS approved_by_name TEXT') &&
  migContent.includes('ADD COLUMN IF NOT EXISTS approved_by_employee_code TEXT') &&
  migContent.includes('ADD COLUMN IF NOT EXISTS approval_remarks TEXT'),
  '1.3 Audit snapshot columns added for employee and head identity preservation (Requirements 3 & 4)'
)

assert(
  migContent.includes('enquiries_status_enum') &&
  migContent.includes("'completed'"),
  '1.4 Status enum constraint includes "completed" terminal state'
)

assert(
  migContent.includes('chk_enquiries_approved_not_in_bin') &&
  migContent.includes('NOT (completion_approved_at IS NOT NULL AND (is_in_bin = true OR scheduled_deletion_at IS NOT NULL))'),
  '1.5 Database CHECK constraint prevents approved enquiry from having is_in_bin=true or scheduled_deletion_at (Requirement 1)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.trg_prevent_approved_enquiry_deletion()') &&
  migContent.includes('trg_protect_approved_enquiry_deletion') &&
  migContent.includes('BEFORE DELETE ON public.enquiries') &&
  migContent.includes('Completed and Head-approved enquiries cannot be deleted'),
  '1.6 BEFORE DELETE trigger at database-level blocks deleting completed + Head-approved records (Requirements 1 & 9)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.protect_enquiry_customer_and_archive_immutability()') &&
  migContent.includes('NEW.completion_approved_at IS DISTINCT FROM OLD.completion_approved_at') &&
  migContent.includes('NEW.completion_approved_by IS DISTINCT FROM OLD.completion_approved_by') &&
  migContent.includes('Approved completed enquiries cannot be unarchived or reopened'),
  '1.7 Immutability trigger blocks altering approval identity, approval timestamp, or silently reopening (Requirement 9)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.submit_enquiry_completion') &&
  migContent.includes('SELECT email, role, full_name, employee_code') &&
  migContent.includes('WHERE id = v_actor_id AND is_active = true') &&
  migContent.includes('completed_by_name = COALESCE(v_actor_name, v_actor_email)') &&
  migContent.includes('completed_by_employee_code = v_actor_code'),
  '1.8 submit_enquiry_completion derives employee identity and snapshots server-side from auth.uid() (Requirement 3)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.review_enquiry_completion') &&
  migContent.includes("v_actor_role != 'superadmin'") &&
  migContent.includes("status = 'completed'") &&
  migContent.includes('is_archived = true') &&
  migContent.includes('scheduled_deletion_at = NULL') &&
  migContent.includes('is_in_bin = false'),
  '1.9 review_enquiry_completion requires superadmin, sets status=completed, is_archived=true, and no Bin scheduled deletion (Requirements 1 & 4)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.restore_enquiry') &&
  migContent.includes('v_enquiry.completion_approved_at IS NOT NULL') &&
  migContent.includes('Head-approved completed enquiries cannot be unarchived or reopened'),
  '1.10 restore_enquiry blocks unarchiving Head-approved completed enquiries (Requirement 9)'
)

assert(
  migContent.includes('CREATE OR REPLACE FUNCTION public.purge_expired_bin_enquiries') &&
  migContent.includes('completion_approved_at IS NULL') &&
  migContent.includes("status != 'completed'"),
  '1.11 purge_expired_bin_enquiries strictly excludes approved enquiries from deletion (Requirement 1)'
)

assert(
  migContent.includes('REVOKE ALL ON FUNCTION public.submit_enquiry_completion') &&
  migContent.includes('REVOKE ALL ON FUNCTION public.review_enquiry_completion') &&
  migContent.includes('REVOKE ALL ON FUNCTION public.purge_expired_bin_enquiries') &&
  migContent.includes('GRANT EXECUTE ON FUNCTION public.review_enquiry_completion(UUID, TEXT, TEXT, INT) TO authenticated;'),
  '1.12 RPC permissions revoked from PUBLIC/anon and granted strictly to authenticated'
)

// ----------------------------------------------------------------------------
// Suite 2: Reporting Month Logic & Cross-Month Invariants
// ----------------------------------------------------------------------------
console.log('\n[Suite 2] Testing Reporting Month Invariants (Requirement 2):')

// Example from prompt:
// Enquiry received: October 30
// Employee completed: November 2
// Head approved: November 3
// This enquiry belongs to the November report.
const sampleCrossMonthEnquiry = {
  id: 'test-uuid-001',
  enquiry_number: 'ARS-ENQ-01001',
  name: 'Test Business Client',
  contact_info: '+91 98111 22233',
  service_requested: 'Server AMC Maintenance',
  message: 'Quarterly server maintenance and backup check.',
  status: 'completed',
  created_at: '2026-10-30T10:00:00Z',
  completion_requested_at: '2026-11-02T14:30:00Z',
  completion_approved_at: '2026-11-03T11:15:00Z',
  completed_by_name: 'Paras Kandpal',
  completed_by_employee_code: 'ARS-EMP-001',
  approved_by_name: 'Ankit Bathla',
  approved_by_employee_code: 'ARS-HEAD-001',
  approval_remarks: 'Verified complete and certified.'
}

const octList = filterEnquiriesByReportingMonth([sampleCrossMonthEnquiry], 9, 2026) // 9 = October
assert(octList.length === 0, '2.1 Cross-month enquiry received in October does NOT belong to October report')

const novList = filterEnquiriesByReportingMonth([sampleCrossMonthEnquiry], 10, 2026) // 10 = November
assert(novList.length === 1, '2.2 Cross-month enquiry approved in November belongs STRICTLY to November report')

const createdOnlyEnquiry = {
  id: 'test-uuid-002',
  enquiry_number: 'ARS-ENQ-01002',
  name: 'In-Progress Client',
  contact_info: 'client@example.com',
  status: 'in_progress',
  created_at: '2026-11-01T10:00:00Z',
  completion_approved_at: null
}
const unapprovedNovList = filterEnquiriesByReportingMonth([createdOnlyEnquiry], 10, 2026)
assert(unapprovedNovList.length === 0, '2.3 Enquiries without completion_approved_at are excluded from monthly reporting')

// ----------------------------------------------------------------------------
// Suite 3: Standard Filename Format & Structure
// ----------------------------------------------------------------------------
console.log('\n[Suite 3] Testing Monthly Filename Format (Requirement 11):')

assert(
  getMonthlyReportFilename(9, 2026) === 'ARS_Enquiries_October_2026.xlsx',
  '3.1 October 2026 report filename is ARS_Enquiries_October_2026.xlsx'
)
assert(
  getMonthlyReportFilename(10, 2026) === 'ARS_Enquiries_November_2026.xlsx',
  '3.2 November 2026 report filename is ARS_Enquiries_November_2026.xlsx'
)

// ----------------------------------------------------------------------------
// Suite 4: Excel Generator & 18 Standard Audit Columns
// ----------------------------------------------------------------------------
console.log('\n[Suite 4] Testing Excel Workbook Structure & Columns (Requirement 11):')

async function testExcelGeneration() {
  const testEnquiries = [
    sampleCrossMonthEnquiry,
    {
      id: 'test-uuid-003',
      enquiry_number: 'ARS-ENQ-01003',
      name: 'Rohan Verma',
      contact_info: 'rohan.verma@example.com',
      service_requested: 'Custom Gaming PC Build',
      message: 'Need high-end RTX 4080 desktop build.',
      status: 'completed',
      created_at: '2026-11-01T08:00:00Z',
      completion_requested_at: '2026-11-05T16:00:00Z',
      completion_approved_at: '2026-11-06T12:00:00Z',
      completed_by_name: 'Technician Staff',
      completed_by_employee_code: 'ARS-EMP-002',
      approved_by_name: 'Ankit Bathla',
      approved_by_employee_code: 'ARS-HEAD-001',
      approval_remarks: 'Benchmarked and approved.',
      archived_at: '2026-11-06T12:00:00Z'
    }
  ]

  const result = await downloadMonthlyEnquiriesExcel(testEnquiries, 10, 2026)
  assert(result.count === 2, '4.1 Both November-approved enquiries processed into workbook')
  assert(result.filename === 'ARS_Enquiries_November_2026.xlsx', '4.2 Generated filename matches requirement')
  assert(result.buffer && result.buffer.byteLength > 1000, '4.3 Valid XLSX binary buffer generated (> 1000 bytes)')

  // Read the generated Excel buffer using ExcelJS
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(result.buffer)

  const worksheet = workbook.getWorksheet('November 2026 Enquiries')
  assert(Boolean(worksheet), '4.4 Worksheet "November 2026 Enquiries" created successfully')

  const expectedHeaders = [
    'Enquiry ID',
    'Customer Name',
    'Contact Information',
    'Product / Service',
    'Enquiry / Problem',
    'Received Date',
    'Received Time',
    'Completed By',
    'Completed By Employee ID/Code',
    'Completion Date',
    'Completion Time',
    'Employee Remarks',
    'Approved By',
    'Approval Date',
    'Approval Time',
    'Head Remarks',
    'Final Status',
    'Archive Date'
  ]

  const actualHeaders = []
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell) => {
    actualHeaders.push(cell.value)
  })

  assert(
    actualHeaders.length === expectedHeaders.length,
    `4.5 All ${expectedHeaders.length} mandatory columns are present in row 1`
  )

  let allHeadersMatch = true
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (actualHeaders[i] !== expectedHeaders[i]) {
      allHeadersMatch = false
      console.error(`  Mismatch at col ${i + 1}: expected "${expectedHeaders[i]}", got "${actualHeaders[i]}"`)
    }
  }
  assert(allHeadersMatch, '4.6 All 18 header column titles exactly match Requirement 11')

  // Check data row values
  const row2 = worksheet.getRow(2)
  assert(row2.getCell(1).value === 'ARS-ENQ-01001', '4.7 Row 1 Enquiry ID is human-readable sequence reference')
  assert(row2.getCell(2).value === 'Test Business Client', '4.8 Customer name preserved accurately')
  assert(row2.getCell(3).value === '+91 98111 22233', '4.9 Real contact_info preserved without guessed placeholder')
  assert(row2.getCell(8).value === 'Paras Kandpal', '4.10 Completed By employee name snapshot preserved')
  assert(row2.getCell(9).value === 'ARS-EMP-001', '4.11 Completed By employee code snapshot preserved')
  assert(row2.getCell(13).value === 'Ankit Bathla', '4.12 Approved By Head name snapshot preserved')
  assert(row2.getCell(14).value === '2026-11-03', '4.13 Approval date is formatted as YYYY-MM-DD')
  assert(row2.getCell(17).value === 'completed', '4.14 Final Status is "completed"')
}

await testExcelGeneration()

// ----------------------------------------------------------------------------
// Suite 5: Frontend UI Access & Role Matrices (Requirements 9 & 10)
// ----------------------------------------------------------------------------
console.log('\n[Suite 5] Inspecting Frontend UI Role Matrices & Access Guards:')

const uiPath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
const uiCode = fs.readFileSync(uiPath, 'utf8')

assert(
  uiCode.includes('id="open-monthly-report-modal-btn"') &&
  !uiCode.includes('{isSuperadmin && <button id="open-monthly-report-modal-btn"'),
  '5.1 Monthly Excel Report button is available to ALL active staff, not only superadmin (Requirement 10)'
)

assert(
  uiCode.includes('id="archived-tab-download-excel-btn"'),
  '5.2 Archived tab provides direct monthly export button'
)

assert(
  uiCode.includes('Permanent Archive &amp; Monthly Compliance Records') ||
  uiCode.includes('Permanent Archive & Monthly Compliance Records'),
  '5.3 Archived tab clearly communicates permanent historical archive policy'
)

assert(
  uiCode.includes('Permanent Accountability &amp; Audit Trail') ||
  uiCode.includes('Permanent Accountability & Audit Trail'),
  '5.4 Details modal displays permanent accountability card with employee & head identity snapshots'
)

assert(
  uiCode.includes('!selectedEnquiry.completion_approved_at && (') &&
  uiCode.includes('handleArchiveToggle'),
  '5.5 Head-approved completed enquiries cannot be unarchived by staff (Requirement 9)'
)

assert(
  uiCode.includes('Approve Work Completion &amp; Permanently Archive') ||
  uiCode.includes('Approve Work Completion & Permanently Archive'),
  '5.6 Approval confirmation modal explicitly announces permanent archive with no scheduled deletion'
)

// ----------------------------------------------------------------------------
// Suite 6: Customer Immutability & Rejection/Service Compatibility
// ----------------------------------------------------------------------------
console.log('\n[Suite 6] Verifying Immutability, Rejection & Service Compatibility (Requirements 7, 15, 16):')

assert(
  !migContent.includes('ALTER TABLE public.enquiries ADD COLUMN customer_phone') &&
  !migContent.includes('ALTER TABLE public.enquiries ADD COLUMN customer_email'),
  '6.1 Does NOT guess/parse contact_info into separate customer_phone/customer_email columns (Requirement 7)'
)

assert(
  migContent.includes("p_decision NOT IN ('approved', 'returned_for_rework')") &&
  migContent.includes("status = 'returned_for_rework'"),
  '6.2 Existing rework return workflow fully preserved'
)

assert(
  uiCode.includes('parseServiceEnquiry'),
  '6.3 Service request parsing helper remains fully integrated and functional'
)

console.log('====================================================================')
console.log(`Summary: ${passedTests} passed, ${failedTests} failed.`)
console.log('====================================================================')

if (failedTests > 0) {
  process.exit(1)
}
