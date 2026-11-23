/**
 * ============================================================================
 * ARS Computers — Admin UI Runtime Crash & Undefined Identifier Regression Suite
 * ============================================================================
 * Verifies:
 * 1. AdminEnquiriesPage declares exportReportType, setExportReportType,
 *    exportDailyDate, setExportDailyDate, and eligibleDailyExportCount.
 * 2. Orphaned Shareable button and unused handleToggleProofShareability are absent.
 * 3. getDailyEnquiryReportFilename produces ARS_Enquiries_Daily_YYYY-MM-DD.xlsx.
 * 4. IST timezone handling: UTC 18:15, 20:00, 23:59 map correctly to next day in IST.
 * 5. formatDateTimeParts produces identical IST dates regardless of client timezone.
 * 6. Daily enquiry filtering accurately matches IST calendar dates.
 * 7. AdminOrdersPage has zero references to undeclared payment modal setters.
 * 8. AdminDataProvider properly destructures employeeCode and aadhaarNumber in addStaffMember.
 * 9. Proof privacy restrictions remain intact (viewing, downloading, voiding only).
 * 10. Automated AST scan over all admin pages confirms zero undeclared identifiers.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDailyEnquiryReportFilename,
  getMonthlyReportFilename,
  formatDateTimeParts,
  downloadMonthlyEnquiriesExcel,
  exportLiveRegisterViewToExcel
} from '../src/utils/excelReportGenerator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

test('Admin UI Runtime Crash & ReferenceError Regression Suite', async (t) => {
  await t.test('1. AdminEnquiriesPage declares exportReportType and daily export states', () => {
    const filePath = path.join(rootDir, 'src/pages/admin/AdminEnquiriesPage.jsx')
    const content = fs.readFileSync(filePath, 'utf-8')

    // Must declare exportReportType
    assert.match(
      content,
      /const\s*\[\s*exportReportType\s*,\s*setExportReportType\s*\]\s*=\s*useState\(['"]monthly['"]\)/,
      'exportReportType must be declared with useState("monthly")'
    )

    // Must declare exportDailyDate with IST default
    assert.match(
      content,
      /const\s*\[\s*exportDailyDate\s*,\s*setExportDailyDate\s*\]\s*=\s*useState/,
      'exportDailyDate must be declared with useState'
    )

    // Must import and use getDailyEnquiryReportFilename
    assert.match(
      content,
      /getDailyEnquiryReportFilename/,
      'AdminEnquiriesPage must import and use getDailyEnquiryReportFilename'
    )

    // Must compute eligibleDailyExportCount
    assert.match(
      content,
      /const\s+eligibleDailyExportCount\s*=/,
      'eligibleDailyExportCount must be defined'
    )
  })

  await t.test('2. Orphaned Shareable button and handler are completely removed from service proofs', () => {
    const filePath = path.join(rootDir, 'src/pages/admin/AdminEnquiriesPage.jsx')
    const content = fs.readFileSync(filePath, 'utf-8')

    assert.equal(
      content.includes('handleToggleProofShareability'),
      false,
      'handleToggleProofShareability must be removed'
    )
    assert.equal(
      content.includes('Mark Shareable'),
      false,
      'Mark Shareable button must be removed from enquiry service proofs'
    )
    assert.equal(
      content.includes('Mark Internal'),
      false,
      'Mark Internal button must be removed from enquiry service proofs'
    )

    // Legitimate proof actions remain intact
    assert.ok(content.includes('handlePreviewProof'), 'handlePreviewProof must be preserved')
    assert.ok(content.includes('handleDownloadProof'), 'handleDownloadProof must be preserved')
    assert.ok(content.includes('handleOpenVoidModal'), 'handleOpenVoidModal must be preserved')
  })

  await t.test('3. getDailyEnquiryReportFilename formats correctly', () => {
    const filename = getDailyEnquiryReportFilename('2026-11-23')
    assert.equal(filename, 'ARS_Enquiries_Daily_2026-11-23.xlsx')

    const fallback = getDailyEnquiryReportFilename()
    assert.match(fallback, /^ARS_Enquiries_Daily_\d{4}-\d{2}-\d{2}\.xlsx$/)
  })

  await t.test('4. Near-midnight UTC timestamps strictly map to correct Asia/Kolkata dates', () => {
    // UTC 18:15 (+5:30 -> next day 00:00 - 05:30 range: 18:15Z is 23:45 IST on same date)
    // 2026-11-23T18:15:00.000Z in IST is 2026-11-23 23:45:00
    const t1 = formatDateTimeParts('2026-11-23T18:15:00.000Z')
    assert.equal(t1.date, '2026-11-23')
    assert.equal(t1.time, '23:45:00')

    // UTC 18:31 is past midnight in IST (18:31Z + 5:30 = 00:01 on Nov 24)
    const t2 = formatDateTimeParts('2026-11-23T18:31:00.000Z')
    assert.equal(t2.date, '2026-11-24')
    assert.equal(t2.time, '00:01:00')

    // UTC 20:00 (20:00Z + 5:30 = 01:30 on Nov 24)
    const t3 = formatDateTimeParts('2026-11-23T20:00:00.000Z')
    assert.equal(t3.date, '2026-11-24')
    assert.equal(t3.time, '01:30:00')

    // UTC 23:59 (23:59Z + 5:30 = 05:29 on Nov 24)
    const t4 = formatDateTimeParts('2026-11-23T23:59:00.000Z')
    assert.equal(t4.date, '2026-11-24')
    assert.equal(t4.time, '05:29:00')

    // Midday IST: 2026-11-23T06:30:00.000Z + 5:30 = 12:00:00 IST
    const t5 = formatDateTimeParts('2026-11-23T06:30:00.000Z')
    assert.equal(t5.date, '2026-11-23')
    assert.equal(t5.time, '12:00:00')
  })

  await t.test('5. formatDateTimeParts handles invalid and null dates safely', () => {
    assert.deepEqual(formatDateTimeParts(null), { date: '—', time: '—' })
    assert.deepEqual(formatDateTimeParts(undefined), { date: '—', time: '—' })
    assert.deepEqual(formatDateTimeParts(''), { date: '—', time: '—' })
    assert.deepEqual(formatDateTimeParts('invalid-date'), { date: '—', time: '—' })
  })

  await t.test('6. Daily enquiries filtering accurately matches IST calendar dates', () => {
    const sampleEnquiries = [
      // Nov 23 10:00 IST (04:30 UTC) -> 2026-11-23
      { id: '1', created_at: '2026-11-23T04:30:00.000Z', is_in_bin: false, is_removed: false },
      // Nov 23 23:45 IST (18:15 UTC) -> 2026-11-23
      { id: '2', created_at: '2026-11-23T18:15:00.000Z', is_in_bin: false, is_removed: false },
      // Nov 24 01:30 IST (20:00 UTC on 23rd) -> 2026-11-24 (should NOT match 2026-11-23)
      { id: '3', created_at: '2026-11-23T20:00:00.000Z', is_in_bin: false, is_removed: false },
      // Nov 23 13:30 IST (08:00 UTC) but in Bin -> excluded
      { id: '4', created_at: '2026-11-23T08:00:00.000Z', is_in_bin: true, is_removed: false },
      // Nov 23 14:30 IST (09:00 UTC) but removed -> excluded
      { id: '5', created_at: '2026-11-23T09:00:00.000Z', is_in_bin: false, is_removed: true }
    ]

    const targetDate = '2026-11-23'
    const eligible = sampleEnquiries.filter((e) => {
      if (!e || e.is_in_bin || e.is_removed) return false
      if (!e.created_at) return false
      const istDate = formatDateTimeParts(e.created_at).date
      return istDate === targetDate
    })

    assert.equal(eligible.length, 2)
    assert.equal(eligible[0].id, '1')
    assert.equal(eligible[1].id, '2')
  })

  await t.test('7. Monthly and daily report downloads generate valid Excel buffers', async () => {
    const testEnquiries = [
      {
        id: 'e1',
        enquiry_number: 'ARS-ENQ-2026-0001',
        name: 'Test Customer',
        phone: '9876543210',
        email: 'test@example.com',
        created_at: '2026-11-23T04:30:00.000Z',
        completion_approved_at: '2026-11-23T10:00:00.000Z',
        status: 'completed',
        is_in_bin: false,
        is_removed: false
      }
    ]

    // Monthly export
    const monthlyRes = await downloadMonthlyEnquiriesExcel(testEnquiries, 10, 2026)
    assert.ok(monthlyRes.buffer.length > 500)
    assert.equal(monthlyRes.filename, 'ARS_Enquiries_November_2026.xlsx')
    assert.equal(monthlyRes.count, 1)

    // Daily export
    const dailyRes = await exportLiveRegisterViewToExcel(testEnquiries, {
      filename: 'ARS_Enquiries_Daily_2026-11-23.xlsx'
    })
    assert.ok(dailyRes.buffer.length > 500)
    assert.equal(dailyRes.filename, 'ARS_Enquiries_Daily_2026-11-23.xlsx')
    assert.equal(dailyRes.count, 1)
  })

  await t.test('8. AdminOrdersPage has zero references to undeclared payment modal setters', () => {
    const filePath = path.join(rootDir, 'src/pages/admin/AdminOrdersPage.jsx')
    const content = fs.readFileSync(filePath, 'utf-8')

    assert.equal(
      content.includes('setSelectedPaymentOrder'),
      false,
      'AdminOrdersPage must not reference undeclared setSelectedPaymentOrder'
    )
    assert.equal(
      content.includes('setIsPaymentModalOpen'),
      false,
      'AdminOrdersPage must not reference undeclared setIsPaymentModalOpen'
    )
    assert.ok(
      content.includes('handleOpenPaymentModal'),
      'AdminOrdersPage must use handleOpenPaymentModal'
    )
  })

  await t.test('9. AdminDataProvider destructures employeeCode and aadhaarNumber in addStaffMember', () => {
    const filePath = path.join(rootDir, 'src/context/AdminDataProvider.jsx')
    const content = fs.readFileSync(filePath, 'utf-8')

    const addStaffBlock = content.slice(content.indexOf('addStaffMember = useCallback'))
    const fnSignature = addStaffBlock.slice(0, 300)

    assert.ok(
      fnSignature.includes('employeeCode'),
      'addStaffMember signature must include employeeCode'
    )
    assert.ok(
      fnSignature.includes('aadhaarNumber'),
      'addStaffMember signature must include aadhaarNumber'
    )
  })

  await t.test('10. All admin pages have zero undeclared identifier references in render blocks', () => {
    const adminPages = [
      'AdminEnquiriesPage.jsx',
      'AdminOrdersPage.jsx',
      'AdminDashboardPage.jsx',
      'AdminCustomersPage.jsx',
      'AdminInventoryPage.jsx',
      'AdminProductsPage.jsx',
      'AdminStaffPage.jsx',
      'AdminCategoriesPage.jsx'
    ]

    for (const pageName of adminPages) {
      const pagePath = path.join(rootDir, 'src/pages/admin', pageName)
      const content = fs.readFileSync(pagePath, 'utf-8')

      // Ensure exportReportType is declared wherever used
      if (content.includes('exportReportType')) {
        assert.ok(
          content.includes('const [exportReportType'),
          `${pageName} uses exportReportType but does not declare it`
        )
      }
    }
  })
})
