/**
 * ARS Computers — Customer enquiry tracking tests.
 * Execution: node test/enquiry-tracking.test.js
 *
 * Validates:
 *  1. v1 migration security (deployed lookup baseline: server-side checks, rate limits, sanitized output, guards)
 *  2. v2 migration security (OTP/sessions/IP throttle tables, service-role-only RPCs, audit columns)
 *  3. Services page layout and submission flow (Enquiry ID generation + confirmation display)
 *  4. Customer tracking card OTP flow (no Enquiry ID needed, no unverified access, no storage)
 *  5. Worker OTP service (generic errors, hashed codes, server-only delivery)
 *  6. Admin dashboard integration (tracking status + visit details with audit) without touching approval workflows
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const read = (rel) => fs.readFileSync(path.join(projectRoot, ...rel.split('/')), 'utf8')

const migration = read('supabase/migrations/20261106000003_enquiry_customer_tracking.sql')
const migration2 = read('supabase/migrations/20261107000001_customer_tracking_full_system.sql')
const migration3 = read('supabase/migrations/20261108000001_engineer_contact_from_staff_record.sql')
const trackingCard = read('src/components/EnquiryTrackingCard.jsx')
const trackingService = read('src/server/trackingOtpService.js')
const worker = read('src/server/worker.js')
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

console.log('\n[Suite 1] v1 migration & database security (deployed baseline)')
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
  (!/jsonb_build_object\((?:(?!jsonb_build_object).){0,600}?'customer_name'/.test(migration) &&
    !/jsonb_build_object\((?:(?!jsonb_build_object).){0,600}?'contact_info'/.test(migration)))
test('track_enquiry compares only the rightmost 10 phone digits (handles +91 prefix)',
  /right\(v_contact_digits, 10\) <> right\(v_phone, 10\)/.test(migration))
test('track_enquiry returns only the sanitized subject/status/updates payload',
  /'enquiry_number', v_record\.enquiry_number/.test(migration) &&
  /'subject', COALESCE\(NULLIF\(trim\(v_record\.category_interest\)/.test(migration) &&
  /'submitted_at', v_record\.created_at/.test(migration))
test('create_customer_enquiry RPC reuses the existing enquiry_number mechanism',
  migration.includes('public.create_customer_enquiry') &&
  /RETURNING id, enquiry_number INTO/.test(migration))
test('create_customer_enquiry validates and truncates to match existing table constraints',
  /char_length\(v_message\) < 5/.test(migration) &&
  /left\(trim\(COALESCE\(p_message, ''\)\), 2000\)/.test(migration))
test('update_customer_tracking_status is denied to anon/public and staff-guarded',
  /NOT public\.is_enquiry_management_staff\(\)/.test(migration))
test('update_customer_tracking_status records who changed it and when',
  /customer_tracking_updated_by = v_actor_id/.test(migration) &&
  /INSERT INTO public\.enquiry_tracking_history/.test(migration))

console.log('\n[Suite 2] v2 migration — OTP system, sessions & audit columns')
test('OTP challenges are sealed with a challenge table that never stores plaintext codes',
  migration2.includes('CREATE TABLE IF NOT EXISTS public.customer_tracking_otp') &&
  migration2.includes('code_hash TEXT,') &&
  !/code_salt/.test(migration2) &&
  !/otp_code TEXT|plain_code|code_plaintext/.test(migration2))
test('OTP generation uses the CSPRNG gen_random_bytes — never PostgreSQL random()',
  /extensions\.gen_random_bytes\(4\)/.test(migration2) &&
  !/floor\(random\(\)/.test(migration2) &&
  !/random\(\) \* 1000000/.test(migration2))
test('OTP expires after 10 minutes',
  /now\(\) \+ interval '10 minutes'/.test(migration2))
test('Resend limit: max 3 sends per rolling 15-minute window per identifier',
  /send_count >= 3/.test(migration2) && /interval '15 minutes'/.test(migration2) &&
  /send_window_started_at/.test(migration2))
test('Verify attempts limited, with a 30-minute lockout after 5 failures',
  /verify_attempts \+ 1 >= 5/.test(migration2) && /interval '30 minutes'/.test(migration2) &&
  migration2.includes('locked_until'))
test('Per-IP hourly throttle table exists (30 requests / hour per hashed IP)',
  migration2.includes('CREATE TABLE IF NOT EXISTS public.tracking_ip_throttle') &&
  /v_ip_count >= 30/.test(migration2) && /ip_hash/.test(migration2))
test('OTP, session and throttle tables are RLS-enabled and fully revoked from all clients',
  /REVOKE ALL ON public\.customer_tracking_otp FROM PUBLIC, anon, authenticated/.test(migration2) &&
  /REVOKE ALL ON public\.customer_tracking_sessions FROM PUBLIC, anon, authenticated/.test(migration2) &&
  /REVOKE ALL ON public\.tracking_ip_throttle FROM PUBLIC, anon, authenticated/.test(migration2) &&
  /ALTER TABLE public\.customer_tracking_otp ENABLE ROW LEVEL SECURITY/.test(migration2) &&
  /ALTER TABLE public\.customer_tracking_sessions ENABLE ROW LEVEL SECURITY/.test(migration2) &&
  /ALTER TABLE public\.tracking_ip_throttle ENABLE ROW LEVEL SECURITY/.test(migration2))
test('Session tokens are 256-bit random values stored only as SHA-256 hashes, expiring after 45 minutes',
  /VALUES \(p_token_hash, v_identifier, now\(\) \+ interval '45 minutes'\)/.test(migration2) &&
  /token_hash = pg_catalog\.encode\(extensions\.digest\(v_token, 'sha256'\), 'hex'\)/.test(migration2) &&
  !/md5\(/.test(migration2))
test('Tracking RPCs are granted ONLY to service_role and revoked from anon/authenticated/PUBLIC',
  ['start_tracking_otp(TEXT, TEXT)',
   'seal_tracking_otp(TEXT, TEXT)',
   'fetch_tracking_otp_challenge(TEXT)',
   'fail_tracking_otp(TEXT)',
   'complete_tracking_otp(TEXT, TEXT)',
   'list_customer_enquiries(TEXT)'].every((signature) =>
    new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${signature.replace('(', '\\(').replace(')', '\\)')}\\s+FROM PUBLIC, anon, authenticated`)
      .test(migration2)
  ) &&
  /GRANT EXECUTE ON FUNCTION public\.start_tracking_otp\(TEXT, TEXT\) TO service_role/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.seal_tracking_otp\(TEXT, TEXT\) TO service_role/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.fetch_tracking_otp_challenge\(TEXT\) TO service_role/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.fail_tracking_otp\(TEXT\) TO service_role/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.complete_tracking_otp\(TEXT, TEXT\) TO service_role/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.list_customer_enquiries\(TEXT\) TO service_role/.test(migration2))
test('Failed OTP challenge rows still burn throttle state (anti-enumeration)',
  migration2.includes("IF NOT FOUND OR v_delivery_email IS NULL OR v_verified = 0 THEN") &&
  /RETURN jsonb_build_object\('delivered', false\)/.test(migration2))
test('list_customer_enquiries requires a valid, unexpired, unrevoked session',
  /token_hash = pg_catalog\.encode\(extensions\.digest\(v_token, 'sha256'\), 'hex'\)/.test(migration2) &&
  /revoked_at IS NULL/.test(migration2) &&
  /expires_at > now\(\)/.test(migration2))
test('list_customer_enquiries returns enquiries for the verified identifier only',
  /tracking_enquiry_ids_for_identifier\(v_channel, v_identifier\)/.test(migration2))
test('Tracking payloads never include customer name, contact info or addresses',
  !/'customer_name'/.test(migration2) &&
  !/"contact_info"/.test(migration2) &&
  !/jsonb_build_object\((?:(?!jsonb_build_object).){0,800}?'contact_info'/.test(migration2))
test('Status mapping covers all customer-facing labels from actual DB states',
  /'Enquiry Received'/.test(migration2) &&
  /'Under Review'/.test(migration2) &&
  /'In Progress'/.test(migration2) &&
  /'Engineer Assigned'/.test(migration2) &&
  /'Visit Scheduled'/.test(migration2) &&
  /'Waiting for Customer'/.test(migration2) &&
  /'Service Completed'/.test(migration2) &&
  /'Closed'/.test(migration2))
test('Engineer output is limited to name + approved display contact (no private staff data)',
  /e\.assigned_employee_name/.test(migration2) &&
  /e\.engineer_contact_display/.test(migration2) &&
  !/jsonb_build_object\((?:(?!jsonb_build_object).){0,800}?'employee_code'/.test(migration2))
test('History gains change_kind with previous/new values and a constraint on kinds',
  migration2.includes("ADD COLUMN IF NOT EXISTS change_kind TEXT NULL") &&
  migration2.includes('previous_value') &&
  migration2.includes('new_value') &&
  /'status', 'engineer_contact', 'visit', 'note'/.test(migration2))
test('Additive customer-facing columns on enquiries (visit/contact/progress/completion)',
  migration2.includes('ADD COLUMN IF NOT EXISTS visit_status TEXT NULL') &&
  migration2.includes('ADD COLUMN IF NOT EXISTS engineer_contact_display TEXT NULL') &&
  migration2.includes('ADD COLUMN IF NOT EXISTS visit_progress_note TEXT NULL') &&
  migration2.includes('ADD COLUMN IF NOT EXISTS service_completed_at TIMESTAMPTZ NULL') &&
  /visit_status IN \(\s*'scheduled', 'in_progress', 'completed', 'cancelled'/.test(migration2))
test('update_customer_visit_details is staff-guarded with full per-field audit',
  migration2.includes('CREATE OR REPLACE FUNCTION public.update_customer_visit_details') &&
  /NOT public\.is_enquiry_management_staff\(\)/.test(migration2) &&
  /'engineer_contact'/.test(migration2) &&
  /'visit'/.test(migration2) &&
  /'note'/.test(migration2))
test('Recreated update_customer_tracking_status records change_kind status with values',
  /change_kind,\s*\n\s*previous_value,\s*\n\s*new_value,/.test(migration2.replace(/\r/g, '')) &&
  /'status',\s*$/m.test(migration2.replace(/\r/g, '')))
test('update_customer_tracking_status remains denied to anon/public',
  /REVOKE EXECUTE ON FUNCTION public\.update_customer_tracking_status\(UUID, TEXT\) FROM PUBLIC, anon/.test(migration2) &&
  /GRANT EXECUTE ON FUNCTION public\.update_customer_tracking_status\(UUID, TEXT\) TO authenticated/.test(migration2))

console.log('\n[Suite 2b] OTP cryptography — CSPRNG, HMAC secret, constant-time & replay safety')
test('Every OTP code is generated with unbiased rejection sampling over CSPRNG bytes (no modulo bias, no random(), never the Worker)',
  /extensions\.gen_random_bytes\(4\)/.test(migration2) &&
  /v_reject_above CONSTANT BIGINT := 4294000000/.test(migration2) &&
  /EXIT WHEN v_value < v_reject_above;/.test(migration2) &&
  /LOOP\s*\n\s*v_bytes := extensions\.gen_random_bytes\(4\);/.test(migration2.replace(/\r/g, '')) &&
  !/floor\(\s*random\(\)/.test(migration2) &&
  !/random\(\) \* 1000000/.test(migration2))
test('The database stores only an HMAC-SHA256 digest, computed in the Worker over identifier-domain-separated material',
  migration2.includes('CREATE OR REPLACE FUNCTION public.seal_tracking_otp') &&
  /p_code_hash !~ '\^\[0-9a-f\]\{64\}\$'/.test(migration2) &&
  trackingService.includes("'HMAC'") &&
  trackingService.includes('hash: \'SHA-256\'') &&
  trackingService.includes('${OTP_HMAC_PURPOSE}:${identifier}:${code}'))
test('HMAC input is domain-separated and bound to the OTP purpose, the database-normalized identifier and the code',
  trackingService.includes("OTP_HMAC_PURPOSE = 'ars:tracking:otp:v1'") &&
  !/hmacOtpMaterial\(\s*secret\s*,\s*(contact|body\.contact)/.test(trackingService) &&
  trackingService.includes('String(data.identifier)'))
test('The HMAC secret lives only in Cloudflare Worker secrets — never in the repo frontend, migration or database',
  trackingService.includes('TRACKING_OTP_HMAC_SECRET') &&
  worker.includes('TRACKING_OTP_HMAC_SECRET') === false &&
  !/TRACKING_OTP_HMAC_SECRET/.test(migration2) &&
  !/TRACKING_OTP_HMAC_SECRET/.test(adminProvider) &&
  !/TRACKING_OTP_HMAC_SECRET/.test(trackingCard))
test('A missing or too-short secret fails closed with a generic 503',
  trackingService.includes('OTP_SECRET_MIN_LENGTH') &&
  /secret\.length < OTP_SECRET_MIN_LENGTH/.test(trackingService) &&
  /GENERIC_UNAVAILABLE_MESSAGE/.test(trackingService))
test('Verification is constant-time: runtime timingSafeEqual with a branch-free XOR fallback; no plaintext equality',
  trackingService.includes('timingSafeEqual') &&
  trackingService.includes('diff |= a[index] ^ b[index]') &&
  !/candidateHash === storedHash|stored\.code_hash === |=== storedDigest/.test(trackingService) &&
  !/\.code_hash\s*===\s/.test(trackingService))
test('Seal happens before the email is sent — an intense sealing failure sends nothing',
  /seal_tracking[\s\S]{0,400}?sendNotificationEmail|const sealed = await callTrackingRpc\(env, 'seal_tracking_otp'/.test(trackingService) &&
  /if \(!sealed\.ok\)/.test(trackingService))
test('Replay prevention: the challenge row is consumed on success; replays find nothing valid',
  /DELETE FROM public\.customer_tracking_otp WHERE identifier = v_identifier;\s*\n\s*INSERT INTO public\.customer_tracking_sessions/.test(
    migration2.replace(/\r/g, '')
  ) &&
  /IF v_row\.code_hash IS NULL THEN/.test(migration2))
test('Expiry is re-validated at BOTH challenge fetch and completion (no verification window)',
  (migration2.match(/v_row\.expires_at < now\(\)/g) || []).length >= 2)
test('Wrong codes burn verify attempts (5 → 30-minute lockout) through fail_tracking_otp',
  migration2.includes('CREATE OR REPLACE FUNCTION public.fail_tracking_otp') &&
  /verify_attempts \+ 1 >= 5/.test(migration2) &&
  /interval '30 minutes'/.test(migration2) &&
  trackingService.includes("'fail_tracking_otp'"))
test('Session tokens are 256-bit CSPRNG strings from the Worker; only SHA-256 digests touch the database',
  trackingService.includes('crypto.getRandomValues') &&
  trackingService.includes("new Uint8Array(32)") &&
  /crypto\.subtle\.digest\('SHA-256'/.test(trackingService) &&
  /'complete_tracking_otp'/.test(trackingService) &&
  !/md5\(/.test(migration2))
test('Single-use challenge survives resend cycles: a new send nulls the previous digest',
  /code_hash = NULL,/.test(migration2))
test('The Worker never logs OTP codes, digests or the secret',
  !/console\..*(otp_code|code_hash|TRACKING_OTP_SECRET|secret)/.test(trackingService) &&
  !/console\..*otp/i.test(worker.replace('[tracking-otp] OTP request failed', '')))
test('No HTTP response body or OTP notification ever carries the digest, secret or challenge material',
  !/noStoreJson\(\{[^}]*otp_code/.test(trackingService) &&
  !/noStoreJson\(\{[^}]*code_hash/.test(trackingService) &&
  (trackingService.split('function buildOtpEmail')[1]?.split('export async function handleTrackingOtpRequest')[0] || '')
    .includes('code_hash') === false)
test('OTP and session RPC responses keep anti-enumeration wording identical for all callers',
  /return noStoreJson\(\{ success: true, message: GENERIC_OTP_MESSAGE \}\)/.test(trackingService) &&
  (trackingService.match(/GENERIC_FAIL_MESSAGE/g) || []).length >= 6)

console.log('\n[Suite 2c] Engineer contact from the staff record (assignment = approval)')

test('Customer-visible contact is derived server-side from the assigned engineer staff record',
  migration3.includes('CREATE OR REPLACE FUNCTION public.list_customer_enquiries') &&
  /e\.assigned_employee_phone/.test(migration3) &&
  migration3.includes('public.admin_users au') &&
  migration3.includes('au.phone_number') &&
  migration3.includes('au.id = e.assigned_employee_id AND au.is_active') &&
  migration3.includes('WHEN e.engineer_contact_hidden THEN NULL'))
test('Derivation only exposes the assigned engineer of THAT enquiry — never the staff directory',
  migration3.includes('au.id = e.assigned_employee_id') &&
  migration3.includes('WHEN e.assigned_employee_id IS NULL THEN NULL') &&
  !/FROM public\.admin_users(?![\s\S]{0,120}assigned_employee_id)/.test(
    migration3.split('CREATE OR REPLACE FUNCTION public.update_customer_visit_details')[0]
  ))
test('No private staff fields (email, employee_code, aadhaar) are selected from admin_users for the customer',
  !/(SELECT[\s\S]{0,200}?public\.admin_users[\s\S]{0,200}?(employee_code|aadhaar_number)[\s\S]{0,200}?AS engineer_contact_display)|\(SELECT NULLIF\(btrim\(au\.phone_number\), ''\)[\s\S]{0,200}?aadhaar/.test(migration3))
test('Staff hide beats derivation: explicit hide flag is additive with default false',
  migration3.includes('ADD COLUMN IF NOT EXISTS engineer_contact_hidden BOOLEAN NOT NULL DEFAULT false'))
test('Derivation requires an ACTIVE staff record (deactivated engineers are hidden)',
  /NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.admin_users au\s*\n\s*WHERE au\.id = e\.assigned_employee_id AND au\.is_active\s*\n\s*\)/.test(migration3))
test('Deactivating the assigned engineer hides ALL numbers, including staff-typed approved ones',
  (() => {
    const sql = migration3.replace(/\r/g, '')
    const listBody = sql.split('CREATE OR REPLACE FUNCTION public.list_customer_enquiries')[1]
      .split('REVOKE EXECUTE ON FUNCTION public.list_customer_enquiries')[0] || ''
    const deactivationBranch = listBody.indexOf('WHEN NOT EXISTS (')
    const overrideBranch = listBody.indexOf("NULLIF(btrim(e.engineer_contact_display), '') IS NOT NULL")
    const hiddenBranch = listBody.indexOf('WHEN e.engineer_contact_hidden THEN NULL')
    return deactivationBranch >= 0 &&
      overrideBranch > deactivationBranch &&
      /WHEN NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.admin_users au\s*\n\s*WHERE au\.id = e\.assigned_employee_id AND au\.is_active\s*\n\s*\) THEN NULL/.test(listBody) &&
      /WHEN e\.engineer_contact_hidden THEN NULL/.test(listBody) &&
      hiddenBranch < deactivationBranch
  })())
test('list_customer_enquiries stays service-role only',
  /GRANT EXECUTE ON FUNCTION public\.list_customer_enquiries\(TEXT\) TO service_role/.test(migration3) &&
  /REVOKE EXECUTE ON FUNCTION public\.list_customer_enquiries\(TEXT\) FROM PUBLIC, anon, authenticated/.test(migration3))
test('Session validation and identifier resolution are byte-preserved in the derived version',
  /token_hash = pg_catalog\.encode\(extensions\.digest\(v_token, 'sha256'\), 'hex'\)/.test(migration3) &&
  /revoked_at IS NULL/.test(migration3) &&
  /expires_at > now\(\)/.test(migration3) &&
  /tracking_enquiry_ids_for_identifier\(v_channel, v_identifier\)/.test(migration3))
test('update_customer_visit_details guard and audit are preserved; blank save = explicit customer hide',
  migration3.includes('CREATE OR REPLACE FUNCTION public.update_customer_visit_details') &&
  /NOT public\.is_enquiry_management_staff\(\)/.test(migration3) &&
  /engineer_contact_hidden = v_hidden/.test(migration3) &&
  /v_enquiry\.engineer_contact_display IS DISTINCT FROM v_contact\s*\n\s*OR v_enquiry\.engineer_contact_hidden IS DISTINCT FROM v_hidden/.test(migration3.replace(/\r/g, '')))
test('update_customer_visit_details remains denied to anon/public',
  /REVOKE EXECUTE ON FUNCTION public\.update_customer_visit_details\(UUID, TEXT, TEXT, TEXT\)\s*\n\s*FROM PUBLIC, anon/.test(migration3.replace(/\r/g, '')) &&
  /GRANT EXECUTE ON FUNCTION public\.update_customer_visit_details\(UUID, TEXT, TEXT, TEXT\)\s*\n\s*TO authenticated/.test(migration3.replace(/\r/g, '')))
test('Customer card shows phone as tel: link directly under the name with the new fallback',
  trackingCard.includes('Contact number not yet available.') &&
  trackingCard.includes("engineer.contact.replace(/[^0-9+]/g, '')") &&
  /<strong>\{engineer\.name\}<\/strong>[\s\S]{0,600}?href=\{`tel:\$\{engineer\.contact\.replace\(\/\[\^0-9\+\]\/g, ''\)\}`\}[\s\S]{0,80}?\{engineer\.contact\}/.test(trackingCard.replace(/\r/g, '')))
test('Admin panel documents the auto-share default and explicit hide',
  adminEnquiries.includes("Auto: engineer's registered phone") &&
  adminEnquiries.includes('hide the customer-visible contact'))

console.log('\n[Suite 3] Services page & submission flow')

test('Services hero uses a two-column layout with the tracking card on the right',
  customerHome.includes('<EnquiryTrackingCard />') &&
  customerHome.includes('services-introduction'))
test('Contact form submission uses the secure RPC and stores the returned Enquiry ID',
  customerHome.includes("supabase.rpc('create_customer_enquiry'") &&
  customerHome.includes('Your Enquiry ID'))
test('Service & Repair form uses the same secure RPC without duplicate enquiry records',
  serviceForm.includes("supabase.rpc('create_customer_enquiry'") &&
  !serviceForm.includes(".from('enquiries')\n          .insert"))
test('Service & Repair confirmation preserves the official Enquiry ID reference',
  serviceForm.includes('service-reference-note'))

console.log('\n[Suite 4] Customer tracking card — OTP flow, security & UX')
test('Tracking card no longer uses the Enquiry-ID lookup; contact is enough',
  !trackingCard.includes("supabase.rpc('track_enquiry'") &&
  trackingCard.includes('/api/tracking/otp/request') &&
  trackingCard.includes('/api/tracking/otp/verify') &&
  trackingCard.includes('/api/tracking/enquiries') &&
  trackingCard.includes('Registered Email or Mobile Number'))
test('No enquiry data is shown before server-side OTP verification',
  trackingCard.includes('sessionToken') &&
  /sessionToken.*useState\(null\)/.test(trackingCard.replace(/\s+/g, ' ')))
test('Session token is kept in memory only — never in web storage',
  !trackingCard.includes('localStorage') &&
  !trackingCard.includes('sessionStorage') &&
  !trackingCard.includes('document.cookie'))
test('No Supabase credentials or service-role keys reach the customer components',
  !trackingCard.includes('SUPABASE_SERVICE_ROLE_KEY') &&
  !trackingCard.includes('serviceRoleKey') &&
  !customerHome.includes('SUPABASE_SERVICE_ROLE_KEY'))
test('Expired sessions force re-verification instead of showing stale data',
  /setStep\('contact'\)/.test(trackingCard) &&
  trackingCard.includes('setSessionToken(null)'))
test('Exact fallback texts are used for missing engineer, missing number and missing visit schedule',
  trackingCard.includes('Engineer not assigned yet. Our team will update you once an engineer is assigned.') &&
  trackingCard.includes('Contact number not yet available.') &&
  !trackingCard.includes('Engineer contact number will be shared at the visit') &&
  trackingCard.includes('Visit schedule is not available yet.'))
test('All customer-facing status labels are represented with chips',
  ['Enquiry Received', 'Under Review', 'In Progress', 'Engineer Assigned', 'Visit Scheduled', 'Waiting for Customer', 'Service Completed'].every(
    (label) => trackingCard.includes(`'${label}'`)
  ))
test('Detail view shows enquiry number, dates, description, engineer and visit blocks',
  trackingCard.includes('enquiry_number') &&
  trackingCard.includes('submitted_at') &&
  trackingCard.includes('updated_at') &&
  trackingCard.includes('description') &&
  trackingCard.includes('assigned_employee_name') &&
  trackingCard.includes('expected_visit_at') &&
  trackingCard.includes('expected_arrival') &&
  trackingCard.includes('visit_status'))
test('Customer timeline renders real audit values from the database',
  trackingCard.includes('timeline') &&
  trackingCard.includes('previous_value') &&
  trackingCard.includes('new_value') &&
  trackingCard.includes('updated_by'))
test('Need More Information directs customers to the official contact channels',
  trackingCard.includes('tracking-contact-link') &&
  trackingCard.includes('ARS_SALES_TEL_HREF') &&
  contactLib.includes('+917078382213'))
test('Display contact is clickable via tel: only stripped of formatting characters',
  trackingCard.includes("engineer.contact.replace(/[^0-9+]/g, '')"))
test('Tracking card shows all of a verified customer\'s enquiries in a list',
  trackingCard.includes('Your Enquiries') &&
  trackingCard.includes('enquiries.map') &&
  trackingCard.includes('Back to my enquiries'))
test('Desktop layout keeps the tracking box compact on the right',
  /grid-template-columns: minmax\(0, 1\.6fr\) minmax\(300px, 0\.9fr\)/.test(css) &&
  css.includes('.enquiry-tracking-card') && css.includes('max-width: 430px'))
test('Responsive styles exist for OTP, list, detail and timeline elements',
  css.includes('.tracking-otp-input') &&
  css.includes('.tracking-enquiry-item') &&
  css.includes('.tracking-timeline') &&
  css.includes('.tracking-fallback') &&
  css.includes('.tracking-engineer-box') &&
  css.includes('.tracking-visit-box'))
test('Mobile refinements prevent overflow',
  /@media \(max-width: 480px\)/.test(css) &&
  css.includes('grid-template-columns: 1fr'))

console.log('\n[Suite 5] Worker OTP service (server-side delivery & generic errors)')
test('Worker exposes the three tracking routes as POST-only endpoints',
  worker.includes("'/api/tracking/otp/request'") &&
  worker.includes("'/api/tracking/otp/verify'") &&
  worker.includes("'/api/tracking/enquiries'") &&
  /tracking\/\*.*\n[\s\S]*?request\.method !== 'POST'/.test(worker) &&
  worker.includes("return jsonResponse({ success: false, error: 'Method not allowed.' }, 405)"))
test('Worker never logs or returns OTP codes',
  /data\.delivered === true && data\.otp_code/.test(trackingService) &&
  /return noStoreJson\(\{ success: true, message: GENERIC_OTP_MESSAGE \}\)/.test(trackingService) &&
  !/otp_code/.test(worker) &&
  !/console\.error.*otp_code/.test(trackingService))
test('Unknown/failed requests return generic errors with anti-enumeration wording',
  trackingService.includes('GENERIC_OTP_MESSAGE') &&
  trackingService.includes('GENERIC_FAIL_MESSAGE') &&
  trackingService.includes('GENERIC_SESSION_MESSAGE'))
test('Identical response for both delivered and undelivered OTP requests',
  /noStoreJson\(\{ success: true, message: GENERIC_OTP_MESSAGE \}\)/.test(trackingService) &&
  !/delivered\s*===?\s*false/.test(trackingService.split('handleTrackingOtpRequest')[1]?.split('handleTrackingOtpVerify')[0] || ''))
test('Client IP is hashed (SHA-256) and never forwarded raw by the Worker',
  trackingService.includes('crypto.subtle.digest') &&
  trackingService.includes('CF-Connecting-IP'))
test('Tracking responses are no-store and never cached',
  /no-store, private/.test(trackingService) &&
  trackingService.includes('X-Content-Type-Options'))
test('OTP email goes through the existing Resend pipeline with the official contact number',
  trackingService.includes('sendNotificationEmail') &&
  trackingService.includes('+91 70783 82213') &&
  contactLib.includes('+917078382213'))
test('Invalid contact shapes are rejected client-side before any RPC call',
  trackingService.includes('isValidTrackContact') &&
  /digits\.length >= 10 && digits\.length <= 15/.test(trackingService))
test('Session fetch failure does not keep customer data anywhere client-side',
  /setEnquiries\(\[\]\)/.test(trackingCard) &&
  trackingService.includes('GENERIC_SESSION_MESSAGE'))

console.log('\n[Suite 6] Admin dashboard integration')
test('Admin data layer updates tracking through the staff-guarded RPC',
  adminProvider.includes("supabase.rpc('update_customer_tracking_status'") &&
  adminProvider.includes('Access denied: Authorized staff privileges required to update enquiry tracking.') &&
  adminProvider.includes("'received', 'in_progress', 'needs_info', 'completed'"))
test('Admin data layer fetches append-only tracking history with audit values',
  adminProvider.includes("from('enquiry_tracking_history')") &&
  adminProvider.includes('change_kind, previous_value, new_value') &&
  adminProvider.includes('updateCustomerTrackingStatus,') &&
  adminProvider.includes('fetchCustomerTrackingHistory,'))
test('Admin data layer exposes the customer visit-details RPC',
  adminProvider.includes("supabase.rpc('update_customer_visit_details'") &&
  adminProvider.includes('updateCustomerVisitDetails,') &&
  adminProvider.includes('Authorized staff privileges required to update visit details.'))
test('Admin Enquiries page exposes the Customer Tracking card in the existing details modal',
  adminEnquiries.includes('Customer Tracking') &&
  adminEnquiries.includes('handleCustomerTrackingSave') &&
  adminEnquiries.includes('setTrackingDraft'))
test('Admin can edit customer-visible engineer contact, visit status and note',
  adminEnquiries.includes('VISIT_STATUS_OPTIONS') &&
  adminEnquiries.includes("value: 'scheduled'") &&
  adminEnquiries.includes("value: 'in_progress'") &&
  adminEnquiries.includes("value: 'completed'") &&
  adminEnquiries.includes("value: 'cancelled'") &&
  adminEnquiries.includes('engineer-contact-display') &&
  adminEnquiries.includes('visit-progress-note') &&
  adminEnquiries.includes('handleVisitDetailsSave'))
test('Visit-details drafts stay in sync with the selected enquiry',
  adminEnquiries.includes('visitDetailDraft') &&
  adminEnquiries.includes('syncVisitDetailDraft') &&
  adminEnquiries.includes('hasVisitDetailChanges'))
test('Admin sees who last updated tracking and the full audit timeline',
  adminEnquiries.includes('customer_tracking_updated_by_name') &&
  adminEnquiries.includes('Tracking History') &&
  adminEnquiries.includes('customerTrackingHistory') &&
  adminEnquiries.includes('previous_value') &&
  adminEnquiries.includes('new_value'))
test('Visit editor only accepts approved customer-facing contact (never staff private data)',
  adminEnquiries.includes('Customer-visible') &&
  adminEnquiries.includes('Private staff phone details are never exposed'))
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
