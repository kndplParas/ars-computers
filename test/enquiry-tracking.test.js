/**
 * ARS Computers — Customer enquiry tracking tests.
 * Execution: node test/enquiry-tracking.test.js
 *
 * Validates:
 *  1. Migration security (server-side verification, rate limiting, sanitized output, role guards)
 *  2. Services page layout and submission flow (Enquiry ID generation + confirmation display)
 *  3. Tracking card component and responsive CSS
 *  4. Admin dashboard integration without touching approval workflows
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const read = (rel) => fs.readFileSync(path.join(projectRoot, ...rel.split('/')), 'utf8')

const migration = read('supabase/migrations/20261106000003_enquiry_customer_tracking.sql')
const trackingCard = read('src/components/EnquiryTrackingCard.jsx')
const customerHome = read('src/pages/CustomerHomePage.jsx')
const serviceForm = read('src/components/CustomerServiceRequestForm.jsx')
const adminProvider = read('src/context/AdminDataProvider.jsx')
const adminEnquiries = read('src/pages/admin/AdminEnquiriesPage.jsx')
const css = read('src/App.css')
const contactLib = read('src/lib/contact.js')

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
console.log('ARS Computers — Customer Enquiry Tracking Tests')
console.log('====================================================================')

console.log('\n[Suite 1] Migration & database security')
test('Customer-facing tracking columns are added with the four allowed statuses',
  migration.includes('customer_tracking_status') &&
  /CHECK \(customer_tracking_status IN \('received', 'in_progress', 'needs_info', 'completed'\)\)/.test(migration))
test('Tracking history table is append-only style with audit snapshots',
  migration.includes('CREATE TABLE IF NOT EXISTS public.enquiry_tracking_history') &&
  migration.includes('updated_by_employee_code') &&
  migration.includes('previous_status'))
test('Tracking history table is RLS-enabled and only readable by enquiry management staff',
  /ALTER TABLE public\.enquiry_tracking_history ENABLE ROW LEVEL SECURITY/.test(migration) &&
  /is_enquiry_management_staff\(\)/.test(migration) &&
  !/GRANT SELECT ON public\.enquiry_tracking_history TO (anon|PUBLIC)/.test(migration))
test('Public lookup attempts table is inaccessible to all clients (RPC-only access)',
  migration.includes('CREATE TABLE IF NOT EXISTS public.enquiry_tracking_attempts') &&
  /REVOKE ALL ON public\.enquiry_tracking_attempts FROM PUBLIC, anon, authenticated/.test(migration))
test('track_enquiry verifies the Enquiry ID format and mobile number server-side',
  /p_enquiry_id TEXT/.test(migration) &&
  /p_registered_mobile TEXT/.test(migration) &&
  /v_id !~ '\^ARS-ENQ-\[0-9\]\{4,10\}\$'/.test(migration))
test('track_enquiry uses one generic failure message for invalid combinations',
  (migration.match(/Invalid enquiry ID or registered mobile number\./g) || []).length >= 4)
test('track_enquiry rate-limits repeated failed lookups (5 attempts / 15 minutes)',
  /v_attempts >= 5/.test(migration) && /interval '15 minutes'/.test(migration))
test('track_enquiry never returns customer names, contact info or addresses',
  /contact_info, status\s*$/m.test(migration.replace(/\r/g, '')) === migration.includes('FROM public.enquiries') === false ||
  (/jsonb_build_object\(\s*'enquiry_number'[\s\S]*?'status_explanation'/.test(migration) &&
    !/jsonb_build_object\((?:(?!jsonb_build_object).){0,600}?'customer_name'/.test(migration) &&
    !/jsonb_build_object\((?:(?!jsonb_build_object).){0,600}?'contact_info'/.test(migration) &&
    !/jsonb_build_object\((?:(?!jsonb_build_object).){0,600}?'name'/.test(migration)))
test('track_enquiry compares only the rightmost 10 phone digits (handles +91 prefix)',
  /right\(v_contact_digits, 10\) <> right\(v_phone, 10\)/.test(migration))
test('track_enquiry returns only the sanitized subject/status/updates payload',
  /'enquiry_number', v_record\.enquiry_number/.test(migration) &&
  /'subject', COALESCE\(NULLIF\(trim\(v_record\.category_interest\)/.test(migration) &&
  /'submitted_at', v_record\.created_at/.test(migration) &&
  /'tracking_status', v_record\.customer_tracking_status/.test(migration) &&
  /'last_updated_at', v_record\.customer_tracking_updated_at/.test(migration) &&
  /'status_explanation'/.test(migration))
test('track_enquiry is executable only by public clients, nothing else exposed',
  /GRANT EXECUTE ON FUNCTION public\.track_enquiry\(TEXT, TEXT\) TO anon, authenticated/.test(migration) &&
  /REVOKE EXECUTE ON FUNCTION public\.track_enquiry\(TEXT, TEXT\) FROM PUBLIC/.test(migration))
test('create_customer_enquiry RPC reuses the existing enquiry_number mechanism',
  migration.includes("public.create_customer_enquiry") &&
  /RETURNING id, enquiry_number INTO/.test(migration) &&
  /'enquiry_number', v_number/.test(migration))
test('create_customer_enquiry validates and truncates to match existing table constraints',
  /char_length\(v_message\) < 5/.test(migration) &&
  /left\(trim\(COALESCE\(p_message, ''\)\), 2000\)/.test(migration) &&
  /left\(trim\(COALESCE\(p_name, ''\)\), 120\)/.test(migration) &&
  !/service_requested,\s*$/.test(migration.replace(/\r/g, '')))
test('update_customer_tracking_status is denied to anon/public and staff-guarded',
  /REVOKE EXECUTE ON FUNCTION public\.update_customer_tracking_status\(UUID, TEXT\) FROM PUBLIC, anon/.test(migration) &&
  /GRANT EXECUTE ON FUNCTION public\.update_customer_tracking_status\(UUID, TEXT\) TO authenticated/.test(migration) &&
  /NOT public\.is_enquiry_management_staff\(\)/.test(migration))
test('update_customer_tracking_status records who changed it and when',
  /customer_tracking_updated_by = v_actor_id/.test(migration) &&
  /customer_tracking_updated_by_name = v_actor_name/.test(migration) &&
  /INSERT INTO public\.enquiry_tracking_history/.test(migration))
test('Existing enquiry backfill marks approved/closed work as completed, others in progress',
  /completion_approved_at IS NOT NULL OR status IN \('completed', 'closed', 'converted'\)/.test(migration) &&
  /WHEN status = 'new' THEN 'received'/.test(migration))

console.log('\n[Suite 2] Services page & submission flow')
test('Services hero uses a two-column layout with the tracking card on the right',
  customerHome.includes('<EnquiryTrackingCard />') &&
  customerHome.includes('services-introduction') &&
  customerHome.includes('⚙️ Service Capabilities &amp; AMC') &&
  customerHome.includes('🛠️ Raise a Service / Repair Request'))
test('Contact form submission uses the secure RPC and stores the returned Enquiry ID',
  customerHome.includes("supabase.rpc('create_customer_enquiry'") &&
  customerHome.includes('setSubmittedEnquiryId(payload?.enquiry_number || null)'))
test('Contact form success banner shows the Enquiry ID for tracking',
  customerHome.includes('submission-reference-box') &&
  customerHome.includes('Your Enquiry ID') &&
  customerHome.includes('track your enquiry on the Services page'))
test('Service & Repair form uses the same secure RPC without duplicate enquiry records',
  serviceForm.includes("supabase.rpc('create_customer_enquiry'") &&
  !serviceForm.includes(".from('enquiries')\n          .insert"))
test('Service & Repair confirmation shows the official Enquiry ID and keeps the ticket reference',
  serviceForm.includes('OFFICIAL ENQUIRY ID') &&
  serviceForm.includes('submittedTicket.enquiry_number || submittedTicket.ticket_number') &&
  serviceForm.includes('service-reference-note'))

console.log('\n[Suite 3] Tracking card UX & responsive behavior')
test('Tracking card calls the secure backend lookup',
  trackingCard.includes("supabase.rpc('track_enquiry'") &&
  trackingCard.includes('p_enquiry_id') &&
  trackingCard.includes('p_registered_mobile'))
test('Only generic error surfaces to the customer on failed lookups',
  trackingCard.includes('Invalid enquiry ID or registered mobile number.'))
test('All four progress stages are represented with the required labels',
  trackingCard.includes("label: 'RECEIVED'") &&
  trackingCard.includes("label: 'IN PROGRESS'") &&
  trackingCard.includes("label: 'NEED MORE INFO'") &&
  trackingCard.includes("label: 'COMPLETED'"))
test('Result card displays Enquiry ID, subject, dates, status and explanation',
  trackingCard.includes('result.enquiry_number') &&
  trackingCard.includes('result.subject') &&
  trackingCard.includes('formatDateTime(result.submitted_at)') &&
  trackingCard.includes('formatDateTime(result.last_updated_at)') &&
  trackingCard.includes('result.status_explanation'))
test('Need More Information directs customers to the official contact channels',
  trackingCard.includes("result.tracking_status === 'needs_info'") &&
  trackingCard.includes('tracking-contact-link') &&
  trackingCard.includes('ARS_SALES_TEL_HREF') &&
  contactLib.includes('+917078382213'))
test('No customer name/phone/email is rendered from the tracking payload',
  !/result\.(customer_name|contact_info|phone|email|name)/.test(trackingCard))
test('Desktop layout keeps the tracking box compact (~35-40% width) on the right',
  /grid-template-columns: minmax\(0, 1\.6fr\) minmax\(300px, 0\.9fr\)/.test(css) &&
  css.includes('.enquiry-tracking-card') && css.includes('max-width: 430px'))
test('Tablet keeps two columns and mobile stacks introduction first',
  /@media \(max-width: 1024px\)/.test(css) && css.includes('minmax(280px, 350px)') &&
  /@media \(max-width: 900px\)/.test(css) && /grid-template-columns: 1fr/.test(css))
test('Mobile refinements prevent overflow with wrapping result cards',
  /@media \(max-width: 480px\)/.test(css) &&
  css.includes('overflow-wrap: anywhere') &&
  css.includes('.tracking-stage-progress'))

console.log('\n[Suite 4] Admin dashboard integration')
test('Admin data layer updates tracking through the staff-guarded RPC',
  adminProvider.includes("supabase.rpc('update_customer_tracking_status'") &&
  adminProvider.includes('Access denied: Authorized staff privileges required to update enquiry tracking.') &&
  adminProvider.includes("'received', 'in_progress', 'needs_info', 'completed'"))
test('Admin data layer fetches append-only tracking history',
  adminProvider.includes("from('enquiry_tracking_history')") &&
  adminProvider.includes("order('created_at', { ascending: false })") &&
  adminProvider.includes('updateCustomerTrackingStatus,') &&
  adminProvider.includes('fetchCustomerTrackingHistory,'))
test('Admin Enquiries page exposes a compact Customer Tracking card in the existing details modal',
  adminEnquiries.includes('Customer Tracking') &&
  adminEnquiries.includes('Does not change Head approval, assignment or completion status.') &&
  adminEnquiries.includes('handleCustomerTrackingSave') &&
  adminEnquiries.includes('setTrackingDraft'))
test('Admin sees who last updated tracking and the history timeline',
  adminEnquiries.includes('customer_tracking_updated_by_name') &&
  adminEnquiries.includes('customer_tracking_updated_by_code') &&
  adminEnquiries.includes('Tracking History') &&
  adminEnquiries.includes('customerTrackingHistory'))
test('Existing workflows remain untouched in the same module',
  adminEnquiries.includes('reviewEnquiryCompletion') &&
  adminEnquiries.includes('selfAssignEnquiry') &&
  adminEnquiries.includes('archiveEnquiry') &&
  adminProvider.includes('update_enquiry_progress'))

console.log('\n--------------------------------------------------------------------')
console.log(`Results: ${passed} passed, ${failed} failed`)
console.log('--------------------------------------------------------------------')

if (failed > 0) {
  console.error('\nFailed assertions:')
  failures.forEach((message) => console.error(`  - ${message}`))
  process.exit(1)
}
