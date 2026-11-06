/**
 * ARS Computers — Admin Enquiries responsive layout tests.
 * Execution: node test/admin-enquiries-responsive.test.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const pagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
const cssPath = path.join(projectRoot, 'src', 'App.css')
const page = fs.readFileSync(pagePath, 'utf8')
const css = fs.readFileSync(cssPath, 'utf8')

let passed = 0
let failed = 0
const failures = []

function test(message, condition) {
  if (condition) {
    passed += 1
    console.log(`  PASS: ${message}`)
  } else {
    failed += 1
    failures.push(message)
    console.error(`  FAIL: ${message}`)
  }
}

console.log('====================================================================')
console.log('ARS Computers — Admin Enquiries Responsive Layout Tests')
console.log('====================================================================')

console.log('\n[Suite 1] Desktop table structure')
test('Enquiries table uses a named responsive wrapper and table class',
  page.includes('className="admin-table-container products-table-wrap enquiries-table-wrap"') &&
  page.includes('className="admin-data-table enquiries-data-table"'))
test('Enquiry ID, Customer/Company, Requirement, Message, Status and Submitted headings remain visible',
  page.includes('Enquiry ID') &&
  page.includes('Customer / Company') &&
  page.includes('Requirement') &&
  page.includes('Inbound Message Snippet') &&
  page.includes('Status') &&
  page.includes('Submitted'))
test('Enquiry IDs remain visible with a title fallback for truncation',
  page.includes('className="enquiry-id-badge" title={enq.id}') &&
  css.includes('.enquiries-table-wrap .enquiry-id-badge'))
test('Desktop Actions column is sticky to the right',
  css.includes('.enquiries-table-wrap .enquiry-actions-heading') &&
  css.includes('.enquiries-table-wrap .enquiry-actions-cell') &&
  /position:\s*sticky/.test(css) &&
  /right:\s*0/.test(css))
test('Sticky Actions cells are opaque and layered above horizontally scrolled content',
  css.includes('z-index: 3') &&
  css.includes('background: #ffffff') &&
  css.includes('box-shadow: -10px 0 16px rgba(15, 23, 42, 0.08)'))
test('Sticky Actions work for pending-rejection rows without hiding their amber context',
  css.includes('.row-pending-rejection .enquiry-actions-cell') &&
  css.includes('background: #fffbeb'))
test('Actions action groups wrap safely for approve/remove workflows',
  css.includes('.enquiries-table-wrap .enquiry-actions-cell > div') &&
  css.includes('flex-wrap: wrap'))
test('Desktop table uses fixed columns instead of stretching every column equally',
  css.includes('table-layout: fixed') &&
  css.includes('.enquiry-customer-heading') &&
  css.includes('.enquiry-requirement-heading') &&
  css.includes('.enquiry-status-heading'))
test('Message snippets remain inspectable instead of being removed',
  page.includes('className="enquiry-message-snippet"') &&
  page.includes('title={enq.message}') &&
  css.includes('.enquiry-message-snippet'))

console.log('\n[Suite 2] Shared desktop and mobile View action')
const desktopViewClicks = page.match(/onClick={\(\) => handleOpenDetails\(enq\)}/g) || []
const mobileViewCalls = page.match(/handleOpenDetails\(enq\)/g) || []
test('View opens the existing enquiry details modal from table rows and cards',
  desktopViewClicks.length >= 5 && mobileViewCalls.length >= 6)
test('Desktop View button stays a direct visible action without horizontal dependency',
  css.includes('.enquiries-table-wrap .btn-action-icon.view-details-btn') &&
  css.includes('min-width: 78px') &&
  css.includes('min-height: 38px'))
test('Mobile cards show a full-width View action below enquiry details',
  page.includes('View Full Details &amp; History') &&
  page.includes('className="btn-outline btn-block view-details-btn"') &&
  css.includes('.mobile-enquiries-cards .view-details-btn'))
test('Mobile cards keep ID/customer/requirement/message/status instead of hiding them',
  page.includes('className="enquiry-id-badge"') &&
  page.includes('{enq.customer_name || enq.name}') &&
  page.includes('enq.service_requested') &&
  page.includes('enq.message') &&
  page.includes('getStatusMeta(enq.status)'))

console.log('\n[Suite 3] All statuses and workflow paths')
test('Responsive layout is shared by table and mobile card markup across tabs',
  page.includes('activeWorkflowTab') &&
  page.includes('activeWorkflowTab !== \'removed\'') &&
  page.includes('mobile-enquiries-cards'))
test('Service & Repair enquiries continue rendering their dedicated badge',
  page.includes('parseServiceEnquiry(enq)') &&
  page.includes('Service / Repair'))
test('Bulk selection and clear-selection controls remain in the enquiry view',
  page.includes('id="select-all-eligible-enquiries-checkbox"') &&
  page.includes('id="bulk-remove-selected-btn"') &&
  page.includes('clear-selection-btn'))
test('Enquiry details modal behavior and handlers remain wired',
  page.includes('selectedEnquiry') &&
  page.includes('handleOpenDetails') &&
  page.includes('handleCloseDetails') &&
  page.includes('enquiry-modal-title'))
test('Approval, rejection, rework, Bin/restore and removal workflow actions remain present',
  ['approve-rejection-action-btn', 'deny-rejection-action-btn', 'approve-completion-action-btn', 'return-rework-action-btn', 'restore-bin-action-btn', 'restore-removed-action-btn']
    .every((className) => page.includes(className)))
test('Mobile card actions enforce touch-sized controls on narrow screens',
  css.includes('@media (max-width: 600px)') &&
  css.includes('min-height: 44px'))
test('Database, permissions and workflow logic are not changed by this responsive change',
  !page.includes('ALTER TABLE public.enquiries') &&
  !page.includes('CREATE OR REPLACE FUNCTION') &&
  !page.includes('GRANT ') &&
  !page.includes('REVOKE '))

console.log('\n====================================================================')
console.log(`Admin enquiries responsive tests passed: ${passed}`)
console.log(`Admin enquiries responsive tests failed: ${failed}`)
if (failures.length > 0) {
  console.log('Failures:')
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
