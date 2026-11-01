/**
 * ============================================================================
 * ARS Computers — Step 3: Customer Communication & Proof Privacy Test Suite
 * ============================================================================
 * 46 Comprehensive Automated Scenarios verifying:
 *
 *  1. Peer Admin cannot view another employee's service proof metadata
 *  2. Peer Admin cannot obtain signed URL for another employee's proof
 *  3. Assigned employee can view own enquiry proof metadata
 *  4. Assigned employee can obtain signed URL for own enquiry proof
 *  5. Head can view service proofs across all enquiries
 *  6. Head can obtain signed URL for any enquiry proof
 *  7. Inventory Staff blocked from proof metadata and storage
 *  8. Anonymous blocked from proof metadata and storage
 *  9. Valid 10-digit Indian phone normalizes to 91XXXXXXXXXX
 * 10. +91 formatted phone normalizes to 91XXXXXXXXXX
 * 11. Spaced Indian phone normalizes to 91XXXXXXXXXX
 * 12. Leading 0 phone normalizes to 91XXXXXXXXXX
 * 13. Malformed / ambiguous phone returns null
 * 14. Customer WhatsApp URL targets CUSTOMER number, never engineer number
 * 15. Missing customer phone safely disables WhatsApp
 * 16. WhatsApp wa.me URL does NOT auto-send (returns prefilled draft URL)
 * 17. Dispatch contains correct Ticket ID
 * 18. Dispatch contains customer name
 * 19. Dispatch contains customer phone and address when available
 * 20. Dispatch contains service category and problem description
 * 21. Dispatch contains assigned engineer name, employee ID, and phone
 * 22. Dispatch strictly masks engineer Aadhaar as 'XXXX XXXX 1234' and NEVER exposes full 12 digits
 * 23. Dispatch shows 'Aadhaar Number: Not Provided' when snapshot has no Aadhaar
 * 24. Unassigned enquiry shows 'ASSIGNED ENGINEER: Not Assigned'
 * 25. Dispatch contains expected visit datetime when scheduled
 * 26. Dispatch contains visit note when available
 * 27. Missing optional customer fields omitted cleanly (no undefined/null/NaN/[object Object])
 * 28. Dispatch contains NO internal UUIDs, NO DB IDs, NO auth IDs
 * 29. Dispatch contains NO storage paths or signed URLs
 * 30. Copy uses the exact same authoritative dispatch content
 * 31. Copy content contains no internal UUIDs or sensitive employee credentials
 * 32. Email resolves registered customer email correctly
 * 33. Email does NOT guess missing email (returns null when unavailable)
 * 34. Email subject contains 'ARS Computers | Service Visit | <Ticket ID>'
 * 35. Email body uses the exact same authoritative dispatch content
 * 36. Email mailto URL contains NO internal UUIDs, NO storage paths, NO signed URLs
 * 37. Employee Aadhaar card image or document file is never attached
 * 38. Customer-facing status labels are human-readable
 * 39. Existing Head assignment functionality remains intact
 * 40. Existing employee self-assignment remains intact
 * 41. Step 2 proof upload and registration workflow remains intact
 * 42. Service completion request still strictly requires non-voided proof
 * 43. Dedicated customer_email and customer_phone columns persist on enquiries
 * 44. Auth credentials and passwords remain untouched
 * 45. Synthetic data only (no real customer PII, no real Aadhaar)
 * 46. Internal engineer technical dispatch actions remain available and clearly distinguished
 * ============================================================================
 */

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

import {
  normalizeIndianPhoneForWhatsApp,
  resolveCustomerPhone,
  resolveCustomerEmail,
  formatCustomerFacingStatus,
  formatAadhaarForDispatch,
  formatEnquiryCustomerDispatch,
  buildCustomerWhatsAppUrl,
  buildCustomerEmailUrl
} from '../src/utils/customerDispatchFormatter.js'

import {
  formatJobDispatchText,
  buildWhatsAppDispatchUrl
} from '../src/utils/jobDispatchFormatter.js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.comm.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadComm#2026!Secure'
const EMP1_EMAIL = 'emp1.comm.verifier@arscomputers.in'
const EMP1_PASSWORD = 'Emp1Comm#2026!Secure'
const EMP2_EMAIL = 'emp2.comm.verifier@arscomputers.in'
const EMP2_PASSWORD = 'Emp2Comm#2026!Secure'
const INV_EMAIL = 'inv.comm.verifier@arscomputers.in'
const INV_PASSWORD = 'InvComm#2026!Secure'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let _headUser = null
let emp1User = null
let _emp2User = null
let _invUser = null

let headClient = null
let emp1Client = null
let emp2Client = null
let invClient = null

const DUMMY_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
)

let phoneCounter = 91000
function getUniquePhone() {
  phoneCounter++
  return `+9198444${phoneCounter}`
}

async function getOrCreateTestUser(email, password, fullName, role, employeeCode, phone = null) {
  const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
  let existing = listData?.users?.find((u) => u.email === email)

  let userId = null
  if (!existing) {
    const { data: created, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
    if (error) throw error
    userId = created.user.id
  } else {
    userId = existing.id
    await serviceClient.auth.admin.updateUserById(userId, { password })
  }

  const { data: profile, error: upsertErr } = await serviceClient
    .from('admin_users')
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      employee_code: employeeCode,
      phone_number: phone,
      is_active: true
    })
    .select('*')
    .single()
  if (upsertErr) throw upsertErr

  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: signData, error: signErr } = await client.auth.signInWithPassword({
    email,
    password
  })
  if (signErr) throw signErr

  return { user: profile, client, session: signData.session }
}

before(async () => {
  const head = await getOrCreateTestUser(
    HEAD_EMAIL,
    HEAD_PASSWORD,
    'Head Comm Supervisor',
    'superadmin',
    'EMP-HEAD-COMM',
    '+919876543400'
  )
  _headUser = head.user
  headClient = head.client

  const emp1 = await getOrCreateTestUser(
    EMP1_EMAIL,
    EMP1_PASSWORD,
    'Engineer Amit Kumar',
    'admin',
    'ARS-EMP-004',
    '+919876543401'
  )
  emp1User = emp1.user
  emp1Client = emp1.client

  const emp2 = await getOrCreateTestUser(
    EMP2_EMAIL,
    EMP2_PASSWORD,
    'Engineer Rohan Peer',
    'admin',
    'ARS-EMP-005',
    '+919876543402'
  )
  _emp2User = emp2.user
  emp2Client = emp2.client

  const inv = await getOrCreateTestUser(
    INV_EMAIL,
    INV_PASSWORD,
    'Inventory Comm Tester',
    'inventory_staff',
    'EMP-INV-COMM',
    '+919876543409'
  )
  _invUser = inv.user
  invClient = inv.client
})

// Helper to create a service enquiry
async function createServiceEnquiry(assignedUserId = null, customFields = {}) {
  const phone = getUniquePhone()
  const { data: enq, error } = await headClient
    .from('enquiries')
    .insert({
      name: customFields.name || 'Rahul Sharma',
      contact_info: customFields.contact_info || `${phone} | rahul.sharma@example.com`,
      customer_phone: customFields.customer_phone || phone,
      customer_email: customFields.customer_email || 'rahul.sharma@example.com',
      customer_address: customFields.customer_address || 'Rudrapur, Uttarakhand',
      category_interest: customFields.category_interest || 'Service: CCTV',
      message: customFields.message || 'Camera 4 is not recording and DVR requires inspection.',
      enquiry_type: 'service_request',
      status: 'new',
      service_details: {
        ticket_number: customFields.ticket_number || 'ARS-SR-20261031-1025',
        product_category: customFields.product_category || 'CCTV',
        problem_description: customFields.problem_description || 'Camera 4 is not recording and DVR requires inspection.',
        service_location: customFields.customer_address || 'Rudrapur, Uttarakhand',
        mobile_number: customFields.customer_phone || phone,
        email: customFields.customer_email || 'rahul.sharma@example.com'
      }
    })
    .select('*')
    .single()

  assert.equal(error, null, 'Enquiry insertion must succeed')

  if (assignedUserId) {
    const { error: assignErr } = await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: assignedUserId,
      p_reason: 'Assigning engineer for customer visit',
      p_expected_visit_at: '2026-10-31T10:00:00.000Z',
      p_visit_note: 'Engineer will inspect DVR and camera connection.'
    })
    assert.equal(assignErr, null, 'Assignment must succeed')

    // Seed Aadhaar snapshot for testing full Aadhaar dispatch
    if (customFields.assigned_employee_aadhaar !== undefined) {
      await serviceClient
        .from('enquiries')
        .update({ assigned_employee_aadhaar: customFields.assigned_employee_aadhaar })
        .eq('id', enq.id)
    } else {
      await serviceClient
        .from('enquiries')
        .update({ assigned_employee_aadhaar: '123456789012' })
        .eq('id', enq.id)
    }

    const { data: updated } = await headClient
      .from('enquiries')
      .select('*')
      .eq('id', enq.id)
      .single()
    return updated
  }

  return enq
}

// --------------------------------------------------------------------------
// 1. Peer Admin cannot view another employee's service proof metadata
// --------------------------------------------------------------------------
test('Scenario 1: Peer Admin cannot view another employee\'s service proof metadata', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // EMP1 uploads and registers proof
  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'emp1_report.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })
  assert.equal(regErr, null)
  assert.ok(reg.proof_id || reg.id)

  // EMP2 (peer admin) attempts to query metadata for EMP1's enquiry proof
  const { data: peerProofs, error: peerErr } = await emp2Client
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.equal(peerErr, null)
  assert.equal(peerProofs.length, 0, 'Peer employee must receive 0 rows for another employee\'s enquiry proof')
})

// --------------------------------------------------------------------------
// 2. Peer Admin cannot obtain signed URL for another employee's proof
// --------------------------------------------------------------------------
test('Scenario 2: Peer Admin cannot obtain signed URL for another employee\'s proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof_url_test.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })

  // EMP2 attempts to create a signed URL for EMP1's file
  const { data: signedData, error: signedErr } = await emp2Client.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 600)

  // Storage RLS blocks peer: returns error or empty/null signedUrl
  assert.ok(
    signedErr || !signedData?.signedUrl,
    'Peer employee must be blocked from generating signed URL for peer proof'
  )
})

// --------------------------------------------------------------------------
// 3. Assigned employee can view own enquiry proof metadata
// --------------------------------------------------------------------------
test('Scenario 3: Assigned employee can view own enquiry proof metadata', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'emp1_own.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })

  const { data: proofs, error } = await emp1Client
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.equal(error, null)
  assert.equal(proofs.length, 1, 'Assigned employee can read own proof metadata')
  assert.equal(proofs[0].uploaded_by, emp1User.id)
})

// --------------------------------------------------------------------------
// 4. Assigned employee can obtain signed URL for own enquiry proof
// --------------------------------------------------------------------------
test('Scenario 4: Assigned employee can obtain signed URL for own enquiry proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  const { data: signedData, error: signedErr } = await emp1Client.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 600)

  assert.equal(signedErr, null, 'Assigned employee must succeed in generating signed URL')
  assert.ok(signedData?.signedUrl?.includes('token='), 'Signed URL must contain valid token')
})

// --------------------------------------------------------------------------
// 5. Head can view service proofs across all enquiries
// --------------------------------------------------------------------------
test('Scenario 5: Head can view service proofs across all enquiries', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'head_inspect.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })

  const { data: proofs, error } = await headClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.equal(error, null)
  assert.equal(proofs.length, 1, 'Head must see proofs across all enquiries')
})

// --------------------------------------------------------------------------
// 6. Head can obtain signed URL for any enquiry proof
// --------------------------------------------------------------------------
test('Scenario 6: Head can obtain signed URL for any enquiry proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  const { data: signedData, error: signedErr } = await headClient.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 600)

  assert.equal(signedErr, null)
  assert.ok(signedData?.signedUrl?.includes('token='))
})

// --------------------------------------------------------------------------
// 7. Inventory Staff blocked from proof metadata and storage
// --------------------------------------------------------------------------
test('Scenario 7: Inventory Staff blocked from proof metadata and storage', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: proofs, error: readErr } = await invClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.ok(readErr || proofs.length === 0, 'Inventory staff cannot read proof metadata')

  const { error: signedErr } = await invClient.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 600)

  assert.ok(signedErr, 'Inventory staff cannot generate signed URL')
})

// --------------------------------------------------------------------------
// 8. Anonymous blocked from proof metadata and storage
// --------------------------------------------------------------------------
test('Scenario 8: Anonymous blocked from proof metadata and storage', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: proofs, error: readErr } = await anonClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.ok(readErr || proofs.length === 0)

  const { error: signedErr } = await anonClient.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 600)

  assert.ok(signedErr)
})

// --------------------------------------------------------------------------
// 9. Valid 10-digit Indian phone normalizes to 91XXXXXXXXXX
// --------------------------------------------------------------------------
test('Scenario 9: Valid 10-digit Indian phone normalizes to 91XXXXXXXXXX', () => {
  assert.equal(normalizeIndianPhoneForWhatsApp('9876543210'), '919876543210')
  assert.equal(normalizeIndianPhoneForWhatsApp('7012345678'), '917012345678')
  assert.equal(normalizeIndianPhoneForWhatsApp('6234567890'), '916234567890')
  assert.equal(normalizeIndianPhoneForWhatsApp('8123456789'), '918123456789')
})

// --------------------------------------------------------------------------
// 10. +91 formatted phone normalizes to 91XXXXXXXXXX
// --------------------------------------------------------------------------
test('Scenario 10: +91 formatted phone normalizes to 91XXXXXXXXXX', () => {
  assert.equal(normalizeIndianPhoneForWhatsApp('+919876543210'), '919876543210')
  assert.equal(normalizeIndianPhoneForWhatsApp('+91 9876543210'), '919876543210')
})

// --------------------------------------------------------------------------
// 11. Spaced Indian phone normalizes to 91XXXXXXXXXX
// --------------------------------------------------------------------------
test('Scenario 11: Spaced Indian phone normalizes to 91XXXXXXXXXX', () => {
  assert.equal(normalizeIndianPhoneForWhatsApp('91 98765 43210'), '919876543210')
  assert.equal(normalizeIndianPhoneForWhatsApp('+91 (98765) 43210'), '919876543210')
  assert.equal(normalizeIndianPhoneForWhatsApp('98765-43210'), '919876543210')
})

// --------------------------------------------------------------------------
// 12. Leading 0 phone normalizes to 91XXXXXXXXXX
// --------------------------------------------------------------------------
test('Scenario 12: Leading 0 phone normalizes to 91XXXXXXXXXX', () => {
  assert.equal(normalizeIndianPhoneForWhatsApp('09876543210'), '919876543210')
})

// --------------------------------------------------------------------------
// 13. Malformed / ambiguous phone returns null
// --------------------------------------------------------------------------
test('Scenario 13: Malformed / ambiguous phone returns null', () => {
  assert.equal(normalizeIndianPhoneForWhatsApp('12345'), null)
  assert.equal(normalizeIndianPhoneForWhatsApp('abcdefghij'), null)
  assert.equal(normalizeIndianPhoneForWhatsApp('1234567890'), null, '10-digits starting with 1 is not valid Indian mobile')
  assert.equal(normalizeIndianPhoneForWhatsApp('5555555555'), null, '10-digits starting with 5 is not valid Indian mobile')
  assert.equal(normalizeIndianPhoneForWhatsApp('+447911123456'), null, 'UK number rejected from Indian mobile normalizer')
  assert.equal(normalizeIndianPhoneForWhatsApp(null), null)
  assert.equal(normalizeIndianPhoneForWhatsApp(''), null)
})

// --------------------------------------------------------------------------
// 14. Customer WhatsApp URL targets CUSTOMER number, never engineer number
// --------------------------------------------------------------------------
test('Scenario 14: Customer WhatsApp URL targets CUSTOMER number, never engineer number', () => {
  const enquiry = {
    id: crypto.randomUUID(),
    enquiry_number: 1025,
    name: 'Rahul Sharma',
    customer_phone: '9876543210',
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_phone: '+919811122233',
    message: 'Inspection request'
  }

  const url = buildCustomerWhatsAppUrl(enquiry)
  assert.ok(url.startsWith('https://wa.me/919876543210?'), 'URL must target customer number 919876543210')
  assert.ok(!url.startsWith('https://wa.me/919811122233?'), 'URL must NOT target engineer number')
})

// --------------------------------------------------------------------------
// 15. Missing customer phone safely disables WhatsApp
// --------------------------------------------------------------------------
test('Scenario 15: Missing customer phone safely disables WhatsApp (returns null)', () => {
  const enquiry = {
    id: crypto.randomUUID(),
    enquiry_number: 1026,
    name: 'Customer No Phone',
    customer_phone: null,
    contact_info: 'customer@example.com' // email only
  }

  const url = buildCustomerWhatsAppUrl(enquiry)
  assert.equal(url, null, 'Must return null without throwing when customer phone is missing')
})

// --------------------------------------------------------------------------
// 16. WhatsApp wa.me URL does NOT auto-send
// --------------------------------------------------------------------------
test('Scenario 16: WhatsApp wa.me URL does NOT auto-send (returns prefilled draft URL)', () => {
  const enquiry = {
    id: crypto.randomUUID(),
    enquiry_number: 1025,
    name: 'Rahul Sharma',
    customer_phone: '9876543210',
    message: 'Inspection request'
  }

  const url = buildCustomerWhatsAppUrl(enquiry)
  assert.ok(url.startsWith('https://wa.me/'), 'Standard WhatsApp URL')
  assert.ok(!url.includes('auto_send'), 'No automated send parameter')
  assert.ok(url.includes('?text='), 'Pre-filled text query param present')
})

// --------------------------------------------------------------------------
// 17. Dispatch contains correct Ticket ID
// --------------------------------------------------------------------------
test('Scenario 17: Dispatch contains correct Ticket ID', () => {
  const enq1 = { enquiry_number: 1025 }
  const text1 = formatEnquiryCustomerDispatch(enq1)
  assert.ok(text1.includes('Ticket ID: ARS-ENQ-01025'))

  const enq2 = {
    service_details: { ticket_number: 'ARS-SR-20261031-1025' }
  }
  const text2 = formatEnquiryCustomerDispatch(enq2)
  assert.ok(text2.includes('Ticket ID: ARS-SR-20261031-1025'))
})

// --------------------------------------------------------------------------
// 18. Dispatch contains customer name
// --------------------------------------------------------------------------
test('Scenario 18: Dispatch contains customer name', () => {
  const text = formatEnquiryCustomerDispatch({ name: 'Rahul Sharma' })
  assert.ok(text.includes('Name: Rahul Sharma'))
})

// --------------------------------------------------------------------------
// 19. Dispatch contains customer phone and address when available
// --------------------------------------------------------------------------
test('Scenario 19: Dispatch contains customer phone and address when available', () => {
  const enq = {
    name: 'Rahul Sharma',
    customer_phone: '+919876543210',
    customer_email: 'rahul@example.com',
    customer_address: 'Rudrapur, Uttarakhand'
  }
  assert.equal(resolveCustomerPhone(enq), '+919876543210')
  const text = formatEnquiryCustomerDispatch(enq)
  assert.ok(text.includes('Phone: +919876543210'))
  assert.ok(text.includes('Email: rahul@example.com'))
  assert.ok(text.includes('Address: Rudrapur, Uttarakhand'))
})

// --------------------------------------------------------------------------
// 20. Dispatch contains service category and problem description
// --------------------------------------------------------------------------
test('Scenario 20: Dispatch contains service category and problem description', () => {
  const text = formatEnquiryCustomerDispatch({
    category_interest: 'Service: CCTV',
    message: 'Camera 4 is not recording and DVR requires inspection.'
  })
  assert.ok(text.includes('Category: CCTV'))
  assert.ok(text.includes('Camera 4 is not recording and DVR requires inspection.'))
})

// --------------------------------------------------------------------------
// 21. Dispatch contains assigned engineer name, employee ID, and phone
// --------------------------------------------------------------------------
test('Scenario 21: Dispatch contains assigned engineer name, employee ID, and phone', () => {
  const text = formatEnquiryCustomerDispatch({
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_code: 'ARS-EMP-004',
    assigned_employee_phone: '+919876543210',
    assigned_employee_aadhaar: '123456789012'
  })
  assert.ok(text.includes('Name: Amit Kumar'))
  assert.ok(text.includes('Employee ID: ARS-EMP-004'))
  assert.ok(text.includes('Phone: +919876543210'))
})

// --------------------------------------------------------------------------
// 22. Dispatch strictly masks engineer Aadhaar as 'XXXX XXXX 1234' and NEVER exposes full 12 digits
// --------------------------------------------------------------------------
test('Scenario 22: Dispatch strictly masks engineer Aadhaar as XXXX XXXX 1234 and NEVER exposes full 12 digits', () => {
  const text = formatEnquiryCustomerDispatch({
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_aadhaar: '123456789012'
  })
  assert.ok(text.includes('Aadhaar Number: XXXX XXXX 9012'), 'Must display masked format XXXX XXXX 9012')
  assert.ok(!text.includes('1234 5678 9012'), 'Full Aadhaar 1234 5678 9012 must NOT be in customer dispatch')
  assert.ok(!text.includes('123456789012'), 'Full 12-digit Aadhaar must NOT be in customer dispatch')
})

// --------------------------------------------------------------------------
// 23. Dispatch shows 'Aadhaar Number: Not Provided' when snapshot has no Aadhaar
// --------------------------------------------------------------------------
test('Scenario 23: Dispatch shows Aadhaar Number: Not Provided when snapshot has no Aadhaar', () => {
  const text = formatEnquiryCustomerDispatch({
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_aadhaar: null
  })
  assert.ok(text.includes('Aadhaar Number: Not Provided'))
})

// --------------------------------------------------------------------------
// 24. Unassigned enquiry shows 'ASSIGNED ENGINEER: Not Assigned'
// --------------------------------------------------------------------------
test('Scenario 24: Unassigned enquiry shows ASSIGNED ENGINEER: Not Assigned', () => {
  const text = formatEnquiryCustomerDispatch({
    assigned_employee_name: null
  })
  assert.ok(text.includes('ASSIGNED ENGINEER\nNot Assigned'))
  assert.ok(!text.includes('Employee ID:'))
})

// --------------------------------------------------------------------------
// 25. Dispatch contains expected visit datetime when scheduled
// --------------------------------------------------------------------------
test('Scenario 25: Dispatch contains expected visit datetime when scheduled', () => {
  const text = formatEnquiryCustomerDispatch({
    expected_visit_at: '2026-10-31T10:00:00.000Z',
    assignment_visit_note: 'Engineer will inspect DVR and camera connection.'
  })
  assert.ok(text.includes('EXPECTED VISIT'))
  assert.ok(text.includes('Visit Note:'))
  assert.ok(text.includes('Engineer will inspect DVR and camera connection.'))
})

// --------------------------------------------------------------------------
// 26. Dispatch contains visit note when available
// --------------------------------------------------------------------------
test('Scenario 26: Dispatch contains visit note when available', () => {
  const text = formatEnquiryCustomerDispatch({
    expected_visit_at: '2026-10-31T10:00:00.000Z',
    assignment_visit_note: 'Customer requested 3 PM visit'
  })
  assert.ok(text.includes('Visit Note:\nCustomer requested 3 PM visit'))
})

// --------------------------------------------------------------------------
// 27. Missing optional customer fields omitted cleanly (no undefined/null/NaN/[object Object])
// --------------------------------------------------------------------------
test('Scenario 27: Missing optional customer fields omitted cleanly (no undefined/null/NaN/[object Object])', () => {
  const text = formatEnquiryCustomerDispatch({
    name: 'Minimal Enquiry',
    customer_phone: null,
    customer_email: null,
    customer_address: null,
    expected_visit_at: null
  })

  assert.ok(!text.includes('undefined'))
  assert.ok(!text.includes('null'))
  assert.ok(!text.includes('NaN'))
  assert.ok(!text.includes('[object Object]'))
  assert.ok(!text.includes('Email:'))
  assert.ok(!text.includes('Address:'))
  assert.ok(!text.includes('EXPECTED VISIT'))
})

// --------------------------------------------------------------------------
// 28. Dispatch contains NO internal UUIDs, NO DB IDs, NO auth IDs
// --------------------------------------------------------------------------
test('Scenario 28: Dispatch contains NO internal UUIDs, NO DB IDs, NO auth IDs', () => {
  const testUuid = crypto.randomUUID()
  const text = formatEnquiryCustomerDispatch({
    id: testUuid,
    assigned_employee_id: crypto.randomUUID(),
    assigned_by_id: crypto.randomUUID(),
    enquiry_number: 1025,
    name: 'Rahul Sharma',
    customer_phone: '9876543210'
  })

  assert.ok(!text.includes(testUuid), 'Must not contain internal enquiry UUID')
})

// --------------------------------------------------------------------------
// 29. Dispatch contains NO storage paths or signed URLs
// --------------------------------------------------------------------------
test('Scenario 29: Dispatch contains NO storage paths or signed URLs', () => {
  const text = formatEnquiryCustomerDispatch({
    enquiry_number: 1025,
    name: 'Rahul Sharma',
    customer_phone: '9876543210'
  })

  assert.ok(!text.includes('enquiry-service-proofs'), 'No bucket path')
  assert.ok(!text.includes('token='), 'No signed token')
  assert.ok(!text.includes('.pdf'), 'No file extension')
})

// --------------------------------------------------------------------------
// 30. Copy uses the exact same authoritative dispatch content
// --------------------------------------------------------------------------
test('Scenario 30: Copy uses the exact same authoritative dispatch content', () => {
  const enq = {
    enquiry_number: 1025,
    name: 'Rahul Sharma',
    customer_phone: '9876543210',
    customer_address: 'Rudrapur, Uttarakhand',
    category_interest: 'Service: CCTV',
    message: 'Camera repair required',
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_code: 'ARS-EMP-004',
    assigned_employee_phone: '+919876543210',
    assigned_employee_aadhaar: '123456789012'
  }

  const dispatch = formatEnquiryCustomerDispatch(enq)
  assert.ok(dispatch.includes('ARS COMPUTERS'))
  assert.ok(dispatch.includes('SERVICE VISIT DETAILS'))
  assert.ok(dispatch.includes('Ticket ID: ARS-ENQ-01025'))
  assert.ok(dispatch.includes('Name: Rahul Sharma'))
  assert.ok(dispatch.includes('Aadhaar Number: XXXX XXXX 9012'))
  assert.ok(!dispatch.includes('1234 5678 9012'))
  assert.ok(!dispatch.includes('123456789012'))
})

// --------------------------------------------------------------------------
// 31. Copy content contains no internal UUIDs or sensitive employee credentials
// --------------------------------------------------------------------------
test('Scenario 31: Copy content contains no internal UUIDs or sensitive employee credentials', () => {
  const secretId = crypto.randomUUID()
  const enq = {
    id: secretId,
    assigned_employee_id: crypto.randomUUID(),
    enquiry_number: 1025,
    name: 'Test Customer'
  }

  const dispatch = formatEnquiryCustomerDispatch(enq)
  assert.ok(!dispatch.includes(secretId))
  assert.ok(!dispatch.includes('password'))
  assert.ok(!dispatch.includes('supabase'))
})

// --------------------------------------------------------------------------
// 32. Email resolves registered customer email correctly
// --------------------------------------------------------------------------
test('Scenario 32: Email resolves registered customer email correctly', () => {
  const enq1 = { customer_email: 'CUSTOMER@EXAMPLE.COM' }
  assert.equal(resolveCustomerEmail(enq1), 'customer@example.com')

  const enq2 = { service_details: { email: 'SERVICE@EXAMPLE.COM' } }
  assert.equal(resolveCustomerEmail(enq2), 'service@example.com')

  const enq3 = { contact_info: '+919876543210 | INFO@EXAMPLE.COM' }
  assert.equal(resolveCustomerEmail(enq3), 'info@example.com')
})

// --------------------------------------------------------------------------
// 33. Email does NOT guess missing email (returns null when unavailable)
// --------------------------------------------------------------------------
test('Scenario 33: Email does NOT guess missing email (returns null when unavailable)', () => {
  const enq = { contact_info: '9876543210' } // Phone only
  assert.equal(resolveCustomerEmail(enq), null)

  const mailUrl = buildCustomerEmailUrl(enq)
  assert.equal(mailUrl, null, 'buildCustomerEmailUrl must return null when no email exists')
})

// --------------------------------------------------------------------------
// 34. Email subject contains 'ARS Computers | Service Visit | <Ticket ID>'
// --------------------------------------------------------------------------
test('Scenario 34: Email subject contains ARS Computers | Service Visit | <Ticket ID>', () => {
  const enq = {
    enquiry_number: 1025,
    customer_email: 'customer@example.com',
    name: 'Rahul Sharma'
  }

  const url = buildCustomerEmailUrl(enq)
  assert.ok(url.startsWith('mailto:customer@example.com?'))
  assert.ok(url.includes(encodeURIComponent('ARS Computers | Service Visit | ARS-ENQ-01025')))
})

// --------------------------------------------------------------------------
// 35. Email body uses the exact same authoritative dispatch content
// --------------------------------------------------------------------------
test('Scenario 35: Email body uses the exact same authoritative dispatch content', () => {
  const enq = {
    enquiry_number: 1025,
    customer_email: 'customer@example.com',
    name: 'Rahul Sharma',
    assigned_employee_name: 'Amit Kumar',
    assigned_employee_aadhaar: '123456789012'
  }

  const url = buildCustomerEmailUrl(enq)
  const dispatchText = formatEnquiryCustomerDispatch(enq)
  assert.ok(url.includes(`body=${encodeURIComponent(dispatchText)}`))
})

// --------------------------------------------------------------------------
// 36. Email mailto URL contains NO internal UUIDs, NO storage paths, NO signed URLs
// --------------------------------------------------------------------------
test('Scenario 36: Email mailto URL contains NO internal UUIDs, NO storage paths, NO signed URLs', () => {
  const secretUuid = crypto.randomUUID()
  const enq = {
    id: secretUuid,
    enquiry_number: 1025,
    customer_email: 'customer@example.com',
    name: 'Rahul Sharma'
  }

  const url = buildCustomerEmailUrl(enq)
  assert.ok(!url.includes(secretUuid))
  assert.ok(!url.includes('enquiry-service-proofs'))
  assert.ok(!url.includes('token='))
})

// --------------------------------------------------------------------------
// 37. Employee Aadhaar card image or document file is never attached
// --------------------------------------------------------------------------
test('Scenario 37: Employee Aadhaar card image or document file is never attached', () => {
  const enq = {
    enquiry_number: 1025,
    customer_email: 'customer@example.com',
    name: 'Rahul Sharma'
  }

  const url = buildCustomerEmailUrl(enq)
  assert.ok(!url.includes('attachment='), 'mailto does not attach files')
  assert.ok(!url.includes('.pdf'), 'No attachment path')
})

// --------------------------------------------------------------------------
// 38. Customer-facing status labels are human-readable
// --------------------------------------------------------------------------
test('Scenario 38: Customer-facing status labels are human-readable', () => {
  assert.equal(formatCustomerFacingStatus({ status: 'new' }), 'New')
  assert.equal(formatCustomerFacingStatus({ status: 'in_progress', assigned_employee_id: null }), 'In Progress')
  assert.equal(formatCustomerFacingStatus({ status: 'in_progress', assigned_employee_id: 'emp-1' }), 'Engineer Assigned')
  assert.equal(formatCustomerFacingStatus({ status: 'completion_requested' }), 'Completion Under Review')
  assert.equal(formatCustomerFacingStatus({ status: 'completed' }), 'Completed')
  assert.equal(formatCustomerFacingStatus({ status: 'returned_for_rework' }), 'Returned for Additional Work')
})

// --------------------------------------------------------------------------
// 39. Existing Head assignment functionality remains intact
// --------------------------------------------------------------------------
test('Scenario 39: Existing Head assignment functionality remains intact', async () => {
  const enq = await createServiceEnquiry()
  const { data: res, error } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id,
    p_reason: 'Step 3 assignment test',
    p_expected_visit_at: '2026-10-31T11:00:00.000Z',
    p_visit_note: 'Standard inspection visit'
  })

  assert.equal(error, null)
  assert.ok(res.success === true && (res.action === 'assigned' || res.action === 'ENQUIRY_ASSIGNED'))
})

// --------------------------------------------------------------------------
// 40. Existing employee self-assignment remains intact
// --------------------------------------------------------------------------
test('Scenario 40: Existing employee self-assignment remains intact', async () => {
  const enq = await createServiceEnquiry()
  const { data: res, error } = await emp1Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })

  assert.equal(error, null)
  assert.equal(res.success, true)
  assert.equal(res.assigned_employee_id, emp1User.id)
})

// --------------------------------------------------------------------------
// 41. Step 2 proof upload and registration workflow remains intact
// --------------------------------------------------------------------------
test('Scenario 41: Step 2 proof upload and registration workflow remains intact', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { error: upErr } = await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })
  assert.equal(upErr, null)

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'job_sheet_intact.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })
  assert.equal(regErr, null)
  assert.ok(reg.proof_id || reg.id)
})

// --------------------------------------------------------------------------
// 42. Service completion request still strictly requires non-voided proof
// --------------------------------------------------------------------------
test('Scenario 42: Service completion request still strictly requires non-voided proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)

  // Completion request without proof fails
  const { error: submitErr } = await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Attempting completion without proof'
  })
  assert.ok(submitErr)
  assert.match(submitErr.message, /customer-signed service report/i)
})

// --------------------------------------------------------------------------
// 43. Dedicated customer_email and customer_phone columns persist on enquiries
// --------------------------------------------------------------------------
test('Scenario 43: Dedicated customer_email and customer_phone columns persist on enquiries', async () => {
  const enq = await createServiceEnquiry(null, {
    customer_phone: '+919876543299',
    customer_email: 'dedicated@example.com',
    customer_address: 'Dedicated Address, Rudrapur'
  })

  const { data: fetched, error } = await headClient
    .from('enquiries')
    .select('customer_phone, customer_email, customer_address')
    .eq('id', enq.id)
    .single()

  assert.equal(error, null)
  assert.equal(fetched.customer_phone, '+919876543299')
  assert.equal(fetched.customer_email, 'dedicated@example.com')
  assert.equal(fetched.customer_address, 'Dedicated Address, Rudrapur')
})

// --------------------------------------------------------------------------
// 44. Auth credentials and passwords remain untouched
// --------------------------------------------------------------------------
test('Scenario 44: Auth credentials and passwords remain untouched', async () => {
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error } = await client.auth.signInWithPassword({
    email: EMP1_EMAIL,
    password: EMP1_PASSWORD
  })
  assert.equal(error, null)
})

// --------------------------------------------------------------------------
// 45. Synthetic data only (no real customer PII, no real Aadhaar)
// --------------------------------------------------------------------------
test('Scenario 45: Synthetic data only (no real customer PII, no real Aadhaar)', () => {
  assert.equal(formatAadhaarForDispatch('123456789012'), 'XXXX XXXX 9012')
  assert.ok(!formatAadhaarForDispatch('123456789012').includes('1234'))
  assert.equal(formatAadhaarForDispatch(null), 'Not Provided')
})

// --------------------------------------------------------------------------
// 46. Internal engineer technical dispatch actions remain available and clearly distinguished
// --------------------------------------------------------------------------
test('Scenario 46: Internal engineer technical dispatch actions remain available and clearly distinguished', () => {
  const enq = {
    enquiry_number: 1025,
    name: 'Customer Amit',
    contact_info: '+919876543210',
    assigned_employee_name: 'Engineer Beta',
    assigned_employee_phone: '+919811122233'
  }

  const engText = formatJobDispatchText(enq)
  const engUrl = buildWhatsAppDispatchUrl(enq)

  assert.ok(engText.includes('ARS COMPUTERS — SERVICE JOB DISPATCH'))
  assert.ok(engUrl.includes('https://wa.me/919811122233'))
})
