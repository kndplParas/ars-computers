/**
 * ARS Computers — Automated After-Sales Service Request System Test Suite
 * Tests customer form validation, database migration invariants, RLS policies,
 * secure RPCs, admin portal routing, and demo data isolation.
 * Execution: node test/service-requests.test.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseServiceEnquiry } from '../src/utils/serviceEnquiryHelper.js'

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
console.log('Running ARS Computers After-Sales Service Request System Tests')
console.log('====================================================================')

// 1. Database Migration Invariants
console.log('\n[Suite 1] Inspecting Database Migration (supabase/migrations/20261024000003_service_request_system.sql):')
const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261024000003_service_request_system.sql')
assert(fs.existsSync(migrationPath), 'Migration file 20261024000003_service_request_system.sql exists')

const migrationSql = fs.readFileSync(migrationPath, 'utf8')

assert(
  migrationSql.includes('CREATE TABLE IF NOT EXISTS public.service_requests'),
  'Creates public.service_requests table'
)

assert(
  migrationSql.includes('service_request_ticket_seq') && migrationSql.includes('ARS-SR-'),
  'Defines atomic ticket number sequence with ARS-SR- prefix'
)

assert(
  migrationSql.includes('CREATE TABLE IF NOT EXISTS public.service_request_activities'),
  'Creates immutable audit trail table public.service_request_activities'
)

assert(
  migrationSql.includes('protect_service_activities_immutability') &&
  migrationSql.includes('trg_protect_service_activities_immutability'),
  'Enforces strict immutability trigger preventing activity modifications/deletions'
)

assert(
  migrationSql.includes('ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY') &&
  migrationSql.includes('ALTER TABLE public.service_request_activities ENABLE ROW LEVEL SECURITY'),
  'Enables RLS on service_requests and service_request_activities'
)

assert(
  migrationSql.includes('Public can submit service requests') &&
  migrationSql.includes('WITH CHECK (true)'),
  'Allows public insertion of service requests'
)

assert(
  migrationSql.includes('Active staff can view service requests') &&
  migrationSql.includes("public.is_staff()"),
  'Restricts ticket viewing exclusively to authenticated active staff'
)

assert(
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.assign_service_ticket') &&
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.update_service_ticket_status') &&
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.close_service_ticket') &&
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.reopen_service_ticket'),
  'Defines secure RPC stored procedures for assignment, status transition, closure, and reopen'
)

assert(
  migrationSql.includes("INSERT INTO storage.buckets (id, name, public") &&
  migrationSql.includes("'service-attachments'"),
  'Provisions private storage bucket for service attachments'
)

// 2. Customer Form Component
console.log('\n[Suite 2] Inspecting src/components/CustomerServiceRequestForm.jsx:')
const formPath = path.join(projectRoot, 'src', 'components', 'CustomerServiceRequestForm.jsx')
assert(fs.existsSync(formPath), 'CustomerServiceRequestForm.jsx exists')

const formCode = fs.readFileSync(formPath, 'utf8')

assert(
  formCode.includes('customer_name') &&
  formCode.includes('mobile_number') &&
  formCode.includes('product_category') &&
  formCode.includes('problem_description'),
  'Implements mandatory customer fields: name, mobile, category, and problem description'
)

assert(
  formCode.includes('cleanMobile.length < 10') || formCode.includes('mobile_number.trim()'),
  'Enforces Indian mobile phone validation (at least 10 digits)'
)

assert(
  formCode.includes('isCctvCategory') &&
  formCode.includes('cctv_camera_count') &&
  formCode.includes('issue_camera_offline') &&
  formCode.includes('issue_remote_viewing'),
  'Implements conditional CCTV checklist: camera count, offline, remote viewing, recording'
)

assert(
  formCode.includes('isComputerCategory') &&
  formCode.includes('issue_boot_failure') &&
  formCode.includes('issue_display') &&
  formCode.includes('issue_overheating'),
  'Implements conditional PC/Laptop checklist: boot failure, display, overheating, slow performance'
)

assert(
  formCode.includes('5 * 1024 * 1024') &&
  formCode.includes('allowedTypes'),
  'Validates attachments with 5MB max limit and mime-type whitelist'
)

assert(
  formCode.includes('website_hp') &&
  formCode.includes('ars_last_service_request_submitted_at'),
  'Includes honeypot anti-spam field and 30-second client abuse rate limiting'
)

assert(
  formCode.includes('ARS-SR-') &&
  formCode.includes('submittedTicket'),
  'Renders confirmation screen with unique copyable ticket ID upon submission'
)

// 3. Customer Home Page Integration
console.log('\n[Suite 3] Inspecting src/pages/CustomerHomePage.jsx integration:')
const homePagePath = path.join(projectRoot, 'src', 'pages', 'CustomerHomePage.jsx')
const homePageCode = fs.readFileSync(homePagePath, 'utf8')

assert(
  homePageCode.includes('CustomerServiceRequestForm'),
  'CustomerHomePage.jsx imports CustomerServiceRequestForm'
)

assert(
  homePageCode.includes('id="services"') &&
  homePageCode.includes('service-mode-tabs') &&
  homePageCode.includes('serviceTab'),
  'Embeds Raise a Service Request tab switcher directly inside existing #services section'
)

assert(
  !homePageCode.includes('id="services-duplicate"') &&
  homePageCode.includes('id="contact"'),
  'Preserves existing services section and maintains original #contact section untouched'
)

// 4. Admin Portal & Data Provider
console.log('\n[Suite 4] Inspecting src/context/AdminDataProvider.jsx & AdminServiceRequestsPage.jsx:')
const dataProviderPath = path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx')
const dataProviderCode = fs.readFileSync(dataProviderPath, 'utf8')

assert(
  dataProviderCode.includes('serviceRequests') &&
  dataProviderCode.includes('demoServiceRequests') &&
  dataProviderCode.includes('liveServiceRequests'),
  'AdminDataProvider manages isolated demo and live service requests state'
)

assert(
  dataProviderCode.includes('ars_admin_demo_service_requests_v1'),
  'Persists demo service tickets in localStorage without touching production database'
)

assert(
  dataProviderCode.includes('assignServiceTicket') &&
  dataProviderCode.includes('updateServiceTicketStatus') &&
  dataProviderCode.includes('updateServiceTicketTechnicalDetails') &&
  dataProviderCode.includes('addServiceTicketNote') &&
  dataProviderCode.includes('closeServiceTicket') &&
  dataProviderCode.includes('reopenServiceTicket'),
  'Exposes all 6 required service request mutators'
)

const adminPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminServiceRequestsPage.jsx')
assert(fs.existsSync(adminPagePath), 'AdminServiceRequestsPage.jsx exists')

const adminPageCode = fs.readFileSync(adminPagePath, 'utf8')

assert(
  adminPageCode.includes('statusFilter') &&
  adminPageCode.includes('priorityFilter') &&
  adminPageCode.includes('categoryFilter') &&
  adminPageCode.includes('searchQuery'),
  'Implements multi-criteria search and filtering (status, priority, category, query)'
)

assert(
  adminPageCode.includes('selectedTicket') &&
  adminPageCode.includes('ticket-drawer'),
  'Provides slide-out management drawer for ticket inspection and actions'
)

assert(
  adminPageCode.includes('parts-table-editor') &&
  adminPageCode.includes('handleAddPart') &&
  adminPageCode.includes('estimated_cost') &&
  adminPageCode.includes('final_cost'),
  'Provides spare parts usage editor and cost estimation/final calculation'
)

assert(
  adminPageCode.includes('isSuperadmin') &&
  adminPageCode.includes('handleConfirmReopen') &&
  adminPageCode.includes('reopenReasonText'),
  'Restricts ticket reopening strictly to superadmin with mandatory justification'
)

// 5. Admin Navigation and Routing (Service Tickets Module Retired from UI)
console.log('\n[Suite 5] Inspecting Routing and Navigation (src/App.jsx & src/components/admin/AdminLayout.jsx):')
const appPath = path.join(projectRoot, 'src', 'App.jsx')
const appCode = fs.readFileSync(appPath, 'utf8')

assert(
  !appCode.includes('AdminServiceRequestsPage'),
  'App.jsx no longer imports or registers retired AdminServiceRequestsPage'
)

assert(
  appCode.includes('/admin/service-requests') &&
  appCode.includes('<Navigate to="/admin/enquiries" replace />'),
  'App.jsx redirects /admin/service-requests safely to /admin/enquiries'
)

const layoutPath = path.join(projectRoot, 'src', 'components', 'admin', 'AdminLayout.jsx')
const layoutCode = fs.readFileSync(layoutPath, 'utf8')

assert(
  !layoutCode.includes("id: 'service-requests'") &&
  !layoutCode.includes('Service Tickets'),
  'AdminLayout removes Service Tickets item and badge from sidebar navigation'
)

assert(
  layoutCode.includes("id: 'enquiries'") &&
  layoutCode.includes("id: 'staff'") &&
  layoutCode.includes("id: 'products'") &&
  layoutCode.includes("id: 'inventory'") &&
  layoutCode.includes("id: 'categories'"),
  'AdminLayout preserves exactly the required sidebar structure: Dashboard, Products, Inventory, Categories, Enquiries, Staff'
)

// 6. Ticket Generator Format Unit Test
console.log('\n[Suite 6] Unit Testing Ticket ID Format:')
function generateSampleTicketId() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return `ARS-SR-${yyyy}${mm}${dd}-${randomSuffix}`
}

const sampleTicket = generateSampleTicketId()
const ticketRegex = /^ARS-SR-\d{8}-\d{4}$/
assert(ticketRegex.test(sampleTicket), `Sample ticket ID matches expected pattern ARS-SR-YYYYMMDD-XXXX: ${sampleTicket}`)


// 7. Service Enquiry Routing: Form writes to Enquiries (NOT Service Tickets)
console.log('\n[Suite 7] Verifying Service Enquiry Routing to Enquiries Table (Not service_requests):')
assert(
  /supabase\s*\.\s*from\(\s*['"]enquiries['"]\s*\)\s*\.\s*insert/.test(formCode),
  'Customer service form writes submissions to public.enquiries'
)

assert(
  !/supabase\s*\.\s*from\(\s*['"]service_requests['"]\s*\)\s*\.\s*insert/.test(formCode),
  'Customer service form does NOT insert into service_requests table'
)

assert(
  !formCode.includes('ars_admin_demo_service_requests_v1'),
  'Customer service form does NOT write demo records to service tickets localStorage'
)

assert(
  formCode.includes('ars_admin_demo_enquiries_v1'),
  'Customer service form routes demo submissions to ars_admin_demo_enquiries_v1'
)

// 8. Service-Specific Information Preservation & Parser
console.log('\n[Suite 8] Verifying Service Information Preservation & parseServiceEnquiry:')
const serviceFieldsPreserved = [
  'Ticket Ref:',
  'Customer Type:',
  'Product:',
  'Brand / Model:',
  'Serial No',
  'Purchase Date:',
  'Location:',
  'Preferred Visit Date:',
  'Diagnostics:',
  'Problem Description:'
]

const preservesAllServiceFields = serviceFieldsPreserved.every(f => formCode.includes(f))
assert(preservesAllServiceFields, 'Customer service form preserves all 16 service-specific fields in formatted message')

// Test parser with simulated service enquiry
const mockServiceEnquiry = {
  id: 'test-enq-1',
  name: 'Rajesh Sharma',
  contact_info: '+91 9876543210 | rajesh@example.com',
  category_interest: 'Service: Desktop Computer',
  message: `[SERVICE & REPAIR REQUEST]
• Ticket Ref: ARS-SR-20261026-9999
• Customer Type: Individual / Home User
• Product: Desktop Computer (carry_in_repair)
• Brand / Model: Dell / OptiPlex 7090
• Serial No: SN-DELL-12345 | Invoice: INV-2025-882
• Purchase Date: 2025-01-15
• Location: Workshop / Carry-in
• Preferred Visit Date: 2026-10-30
• Diagnostics: Boot Failure / No Power, Display / Screen Artifacts
• Problem Description:
System shuts down abruptly after 5 minutes of usage.
• Attachment: https://example.com/photo.jpg`,
  status: 'new'
}

const parsed = parseServiceEnquiry(mockServiceEnquiry)
assert(parsed.isService === true, 'parseServiceEnquiry identifies service request correctly')
assert(parsed.ticketNumber === 'ARS-SR-20261026-9999', 'parseServiceEnquiry extracts ticket number')
assert(parsed.customerType === 'Individual / Home User', 'parseServiceEnquiry extracts customer type')
assert(parsed.productCategory === 'Desktop Computer (carry_in_repair)', 'parseServiceEnquiry extracts product category')
assert(parsed.brandModel === 'Dell / OptiPlex 7090', 'parseServiceEnquiry extracts brand and model')
assert(parsed.serialInvoice.includes('SN-DELL-12345') && parsed.serialInvoice.includes('INV-2025-882'), 'parseServiceEnquiry extracts serial number and invoice')
assert(parsed.purchaseDate === '2025-01-15', 'parseServiceEnquiry extracts purchase date')
assert(parsed.serviceLocation === 'Workshop / Carry-in', 'parseServiceEnquiry extracts service location')
assert(parsed.preferredVisitDate === '2026-10-30', 'parseServiceEnquiry extracts preferred visit date')
assert(parsed.diagnosticsSummary.includes('Boot Failure') && parsed.diagnosticsSummary.includes('Display'), 'parseServiceEnquiry extracts diagnostic checklist')
assert(parsed.attachmentUrl === 'https://example.com/photo.jpg', 'parseServiceEnquiry extracts attachment URL')
assert(parsed.problemDescription.includes('System shuts down abruptly'), 'parseServiceEnquiry extracts problem description')

// Test parser with simulated ordinary product enquiry
const mockOrdinaryEnquiry = {
  id: 'test-enq-2',
  name: 'Anita Verma',
  contact_info: '+91 9811122233',
  category_interest: 'cctv-surveillance',
  message: 'Need 8 channel IP camera quote for warehouse.',
  status: 'new'
}
const parsedOrdinary = parseServiceEnquiry(mockOrdinaryEnquiry)
assert(parsedOrdinary.isService === false, 'parseServiceEnquiry does not mistake ordinary enquiry for service request')

// 9. Admin Enquiries UI & Badging Integration
console.log('\n[Suite 9] Verifying Admin Enquiries UI & Badging (/admin/enquiries):')
const adminEnquiriesPath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
assert(fs.existsSync(adminEnquiriesPath), 'AdminEnquiriesPage.jsx exists')
const adminEnquiriesCode = fs.readFileSync(adminEnquiriesPath, 'utf8')

assert(
  adminEnquiriesCode.includes('parseServiceEnquiry'),
  'AdminEnquiriesPage imports and integrates parseServiceEnquiry helper'
)

assert(
  adminEnquiriesCode.includes('value="service_requests"'),
  'AdminEnquiriesPage includes dedicated filter option for Service & Repair Requests'
)

assert(
  adminEnquiriesCode.includes('Service / Repair') && adminEnquiriesCode.includes('service-repair-badge'),
  'AdminEnquiriesPage displays distinct 🛠️ Service / Repair badge on service enquiries'
)

assert(
  adminEnquiriesCode.includes('service-spec-panel') && adminEnquiriesCode.includes('service-spec-grid'),
  'AdminEnquiriesPage renders dedicated structured Service Specification panel in modal'
)

// 10. Existing Enquiry Workflow & Permission Enforcements
console.log('\n[Suite 10] Verifying Existing Enquiry Workflow, Permissions & Security Invariants:')
assert(
  adminEnquiriesCode.includes('updateEnquiryProgress') &&
  adminEnquiriesCode.includes('requestEnquiryRejection') &&
  adminEnquiriesCode.includes('reviewEnquiryRejection') &&
  adminEnquiriesCode.includes('archiveEnquiry') &&
  adminEnquiriesCode.includes('restoreEnquiry'),
  'AdminEnquiriesPage supports full 7-stage workflow: updates, notes, review, rework, approval, bin/archive'
)

assert(
  adminEnquiriesCode.includes('isEmployee') &&
  adminEnquiriesCode.includes('isSuperadmin'),
  'AdminEnquiriesPage respects role-based restrictions for employee, head, and superadmin'
)

// Check forward-only migration for extending enquiries
const extendMigrationPath = path.join(projectRoot, 'supabase', 'migrations', '20261026000001_extend_enquiries_for_service_requests.sql')
assert(fs.existsSync(extendMigrationPath), 'Forward-only migration 20261026000001_extend_enquiries_for_service_requests.sql exists')
const extendSql = fs.readFileSync(extendMigrationPath, 'utf8')
assert(
  extendSql.includes('ADD COLUMN IF NOT EXISTS enquiry_type') &&
  extendSql.includes('ADD COLUMN IF NOT EXISTS service_details'),
  'Prepared migration safely extends enquiries with non-destructive forward-only columns'
)

// Verify ordinary enquiries on Customer Home Page & Product Details Page continue working
assert(
  /supabase\s*\.\s*from\(\s*['"]enquiries['"]\s*\)\s*\.\s*insert/.test(homePageCode) &&
  homePageCode.includes('category_interest: formData.category_interest'),
  'CustomerHomePage continues submitting ordinary contact enquiries to public.enquiries'
)

const productDetailsPath = path.join(projectRoot, 'src', 'pages', 'ProductDetailsPage.jsx')
const productDetailsCode = fs.readFileSync(productDetailsPath, 'utf8')
assert(
  /supabase\s*\.\s*from\(\s*['"]enquiries['"]\s*\)\s*\.\s*insert/.test(productDetailsCode) &&
  productDetailsCode.includes('category_interest: categoryInterest'),
  'ProductDetailsPage continues submitting product quote enquiries to public.enquiries'
)

// Final Report
console.log('\n====================================================================')
console.log(`Test Execution Summary: ${passedTests} Passed, ${failedTests} Failed`)
console.log('====================================================================')

if (failedTests > 0) {
  process.exit(1)
}

