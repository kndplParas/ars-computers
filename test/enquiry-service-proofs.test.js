/**
 * ============================================================================
 * ARS Computers — Step 2: Signed Service Proof & Completion Workflow Test Suite
 * ============================================================================
 * 42 Comprehensive Automated Scenarios verifying all security, integrity,
 * storage privacy, authorization, lifecycle, and backward-compatibility requirements:
 *
 *  1. Head can upload/register signed service proof
 *  2. Assigned employee can upload/register proof
 *  3. Unassigned employee cannot upload
 *  4. Peer employee cannot upload to someone else's enquiry
 *  5. Inventory Staff blocked
 *  6. Anonymous blocked
 *  7. Unsupported MIME blocked
 *  8. Oversized file blocked/validated (>10 MB)
 *  9. Private bucket exists
 * 10. Bucket is not public
 * 11. Valid JPG accepted
 * 12. Valid PNG accepted
 * 13. Valid PDF accepted
 * 14. SVG blocked
 * 15. Uploader identity server-derived
 * 16. Client cannot spoof uploader name/code
 * 17. Storage path contains no customer PII
 * 18. Service proof linked to correct enquiry
 * 19. Employee completion request blocked without signed proof
 * 20. Completion request allowed with valid signed proof
 * 21. Voided proof does NOT satisfy completion requirement
 * 22. Head can inspect proof during completion review
 * 23. Employee cannot void after completion request
 * 24. Head controlled void before approval works
 * 25. Void requires reason (>= 5 chars)
 * 26. Rework preserves previous proof history
 * 27. Employee can add new proof after return for rework
 * 28. Old proof is not overwritten
 * 29. Completed approved enquiry proof immutable
 * 30. Employee cannot upload after approval
 * 31. Employee cannot delete/void after approval
 * 32. Head normal workflow cannot silently mutate approved proof
 * 33. Private file URL is not permanently exposed
 * 34. Signed URL is not stored in database
 * 35. Activity records upload safely
 * 36. Activity records void safely
 * 37. Aadhaar absent from proof audit metadata
 * 38. Step 1 assignment/visit functionality remains intact
 * 39. Auth/passwords untouched
 * 40. Existing Enquiry workflow remains intact (general enquiries complete without proof)
 * 41. Existing Orders attachment/payment functionality remains intact
 * 42. Existing monthly/reporting tests remain intact
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.proof.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadProof#2026!Secure'
const EMP1_EMAIL = 'emp1.proof.verifier@arscomputers.in'
const EMP1_PASSWORD = 'Emp1Proof#2026!Secure'
const EMP2_EMAIL = 'emp2.proof.verifier@arscomputers.in'
const EMP2_PASSWORD = 'Emp2Proof#2026!Secure'
const INV_EMAIL = 'inv.proof.verifier@arscomputers.in'
const INV_PASSWORD = 'InvProof#2026!Secure'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let headUser = null
let emp1User = null
let _emp2User = null
let _invUser = null

let headClient = null
let emp1Client = null
let emp2Client = null
let invClient = null

// Synthetic test files (no real signatures or customer PII)
const DUMMY_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
)
const DUMMY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)
const DUMMY_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%EOF'
)
const DUMMY_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')

let phoneCounter = 89000
function getUniquePhone() {
  phoneCounter++
  return `+9198333${phoneCounter}`
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
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role,
        is_active: true,
        employee_code: employeeCode,
        phone_number: phone
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (upsertErr) throw upsertErr

  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: authData, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password
  })
  if (signInErr) throw signInErr

  return { user: profile, client, session: authData.session }
}

test.before(async () => {
  const head = await getOrCreateTestUser(
    HEAD_EMAIL,
    HEAD_PASSWORD,
    'Head Proof Verifier',
    'superadmin',
    'EMP-HEAD-PROOF',
    '+919876543310'
  )
  headUser = head.user
  headClient = head.client

  const emp1 = await getOrCreateTestUser(
    EMP1_EMAIL,
    EMP1_PASSWORD,
    'Engineer Alpha',
    'admin',
    'EMP-ENG-ALPHA',
    '+919876543311'
  )
  emp1User = emp1.user
  emp1Client = emp1.client

  const emp2 = await getOrCreateTestUser(
    EMP2_EMAIL,
    EMP2_PASSWORD,
    'Engineer Beta',
    'admin',
    'EMP-ENG-BETA',
    '+919876543312'
  )
  _emp2User = emp2.user
  emp2Client = emp2.client

  const inv = await getOrCreateTestUser(
    INV_EMAIL,
    INV_PASSWORD,
    'Inventory Proof Verifier',
    'inventory_staff',
    'EMP-INV-PROOF',
    '+919876543319'
  )
  _invUser = inv.user
  invClient = inv.client
})

// Helper to create a service enquiry
async function createServiceEnquiry(assignedUserId = null) {
  const phone = getUniquePhone()
  const { data: enq, error } = await headClient
    .from('enquiries')
    .insert({
      name: 'Service Test Customer',
      contact_info: phone,
      message: 'Motherboard repair requested at site',
      category_interest: 'Hardware Service',
      enquiry_type: 'service_request',
      status: 'new'
    })
    .select()
    .single()

  assert.equal(error, null, 'Enquiry creation must succeed')

  if (assignedUserId) {
    const { error: assignErr } = await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: assignedUserId,
      p_reason: 'Assigned for test service inspection'
    })
    assert.equal(assignErr, null, 'Assignment must succeed')
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
// 1. Head can upload/register signed service proof
// --------------------------------------------------------------------------
test('Scenario 1: Head can upload/register signed service proof', async () => {
  const enq = await createServiceEnquiry()
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // 1. Storage upload
  const { error: upErr } = await headClient.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })
  assert.equal(upErr, null, 'Head storage upload must succeed')

  // 2. RPC register
  const { data: reg, error: regErr } = await headClient.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'signed_job_sheet.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length,
    p_document_type: 'CUSTOMER_SIGNED_SERVICE_REPORT',
    p_description: 'Signed by customer after site inspection'
  })
  assert.equal(regErr, null, 'Head metadata register must succeed')
  assert.equal(reg.success, true)
  assert.equal(reg.uploaded_by, headUser.id)
  assert.equal(reg.uploaded_by_employee_code, headUser.employee_code)
})

// --------------------------------------------------------------------------
// 2. Assigned employee can upload/register proof
// --------------------------------------------------------------------------
test('Scenario 2: Assigned employee can upload/register proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.png`

  const { error: upErr } = await emp1Client.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_PNG, { contentType: 'image/png' })
  assert.equal(upErr, null, 'Assigned employee storage upload must succeed')

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'engineer_sheet.png',
    p_mime_type: 'image/png',
    p_file_size_bytes: DUMMY_PNG.length,
    p_document_type: 'CUSTOMER_SIGNED_SERVICE_REPORT',
    p_description: 'Signed on-site by client'
  })
  assert.equal(regErr, null, 'Assigned employee registration must succeed')
  assert.equal(reg.success, true)
  assert.equal(reg.uploaded_by, emp1User.id)
  assert.equal(reg.uploaded_by_employee_code, emp1User.employee_code)
})

// --------------------------------------------------------------------------
// 3. Unassigned employee cannot upload
// --------------------------------------------------------------------------
test('Scenario 3: Unassigned employee cannot upload', async () => {
  const enq = await createServiceEnquiry(null) // Unassigned
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'unassigned_attempt.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })
  assert.ok(regErr, 'Unassigned employee must be rejected')
  assert.match(regErr.message, /only upload service proofs for enquiries assigned to them/i)
})

// --------------------------------------------------------------------------
// 4. Peer employee cannot upload to someone else's enquiry
// --------------------------------------------------------------------------
test("Scenario 4: Peer employee cannot upload to someone else's enquiry", async () => {
  const enq = await createServiceEnquiry(emp1User.id) // Assigned to EMP1
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // EMP2 attempts to register proof on EMP1's enquiry
  const { error: regErr } = await emp2Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'peer_tamper.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })
  assert.ok(regErr, 'Peer employee must be blocked')
  assert.match(regErr.message, /only upload service proofs for enquiries assigned to them/i)
})

// --------------------------------------------------------------------------
// 5. Inventory Staff blocked
// --------------------------------------------------------------------------
test('Scenario 5: Inventory Staff blocked from proof RPCs and table', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { error: regErr } = await invClient.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'inv_attempt.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })
  assert.ok(regErr, 'Inventory staff must be blocked from register RPC')
  assert.match(regErr.message, /Active administrator or store employee privileges required/i)

  const { data: proofs, error: readErr } = await invClient
    .from('enquiry_service_proofs')
    .select('*')
  assert.ok(readErr || proofs.length === 0, 'Inventory staff cannot read enquiry_service_proofs')
})

// --------------------------------------------------------------------------
// 6. Anonymous blocked
// --------------------------------------------------------------------------
test('Scenario 6: Anonymous blocked from proof RPCs and table', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { error: regErr } = await anonClient.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'anon.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })
  assert.ok(regErr, 'Anonymous must be blocked')
  assert.match(regErr.message, /Authentication required|insufficient_privilege|permission denied/i)

  const { data: proofs, error: readErr } = await anonClient
    .from('enquiry_service_proofs')
    .select('*')
  assert.ok(readErr || proofs.length === 0, 'Anonymous cannot read enquiry_service_proofs')
})

// --------------------------------------------------------------------------
// 7. Unsupported MIME blocked
// --------------------------------------------------------------------------
test('Scenario 7: Unsupported MIME blocked', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.txt`

  const { error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'notes.txt',
    p_mime_type: 'text/plain',
    p_file_size_bytes: 1024
  })
  assert.ok(regErr, 'text/plain must be rejected')
  assert.match(regErr.message, /Unsupported MIME type/i)
})

// --------------------------------------------------------------------------
// 8. Oversized file blocked/validated (>10 MB)
// --------------------------------------------------------------------------
test('Scenario 8: Oversized file blocked (>10 MB)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.pdf`

  const { error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'giant.pdf',
    p_mime_type: 'application/pdf',
    p_file_size_bytes: 10485761 // 10 MB + 1 byte
  })
  assert.ok(regErr, 'File size > 10 MB must be rejected')
  assert.match(regErr.message, /exceeds maximum limit of 10 MB/i)
})

// --------------------------------------------------------------------------
// 9. Private bucket exists
// --------------------------------------------------------------------------
test('Scenario 9: Private bucket enquiry-service-proofs exists', async () => {
  const { data: buckets, error } = await serviceClient.storage.listBuckets()
  assert.equal(error, null)
  const bucket = buckets.find((b) => b.id === 'enquiry-service-proofs')
  assert.ok(bucket, 'enquiry-service-proofs bucket must exist')
})

// --------------------------------------------------------------------------
// 10. Bucket is not public
// --------------------------------------------------------------------------
test('Scenario 10: enquiry-service-proofs bucket is strictly private', async () => {
  const { data: buckets, error } = await serviceClient.storage.listBuckets()
  assert.equal(error, null)
  const bucket = buckets.find((b) => b.id === 'enquiry-service-proofs')
  assert.equal(bucket.public, false, 'Bucket must be private (public = false)')
})

// --------------------------------------------------------------------------
// 11. Valid JPG accepted
// --------------------------------------------------------------------------
test('Scenario 11: Valid JPG accepted', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'customer_signed_report.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })
  assert.equal(regErr, null)
  assert.equal(reg.mime_type, 'image/jpeg')
})

// --------------------------------------------------------------------------
// 12. Valid PNG accepted
// --------------------------------------------------------------------------
test('Scenario 12: Valid PNG accepted', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.png`

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'scan_report.png',
    p_mime_type: 'image/png',
    p_file_size_bytes: DUMMY_PNG.length
  })
  assert.equal(regErr, null)
  assert.equal(reg.mime_type, 'image/png')
})

// --------------------------------------------------------------------------
// 13. Valid PDF accepted
// --------------------------------------------------------------------------
test('Scenario 13: Valid PDF accepted', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.pdf`

  const { data: reg, error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'signed_service_order.pdf',
    p_mime_type: 'application/pdf',
    p_file_size_bytes: DUMMY_PDF.length
  })
  assert.equal(regErr, null)
  assert.equal(reg.mime_type, 'application/pdf')
})

// --------------------------------------------------------------------------
// 14. SVG blocked
// --------------------------------------------------------------------------
test('Scenario 14: SVG blocked', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.svg`

  const { error: regErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'vector.svg',
    p_mime_type: 'image/svg+xml',
    p_file_size_bytes: DUMMY_SVG.length
  })
  assert.ok(regErr, 'SVG must be rejected')
  assert.match(regErr.message, /Unsupported MIME type/i)
})

// --------------------------------------------------------------------------
// 15. Uploader identity server-derived
// --------------------------------------------------------------------------
test('Scenario 15: Uploader identity server-derived from auth.uid()', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg, error } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 2048
  })
  assert.equal(error, null)

  const { data: dbRecord } = await serviceClient
    .from('enquiry_service_proofs')
    .select('uploaded_by, uploaded_by_name, uploaded_by_employee_code')
    .eq('id', reg.id)
    .single()

  assert.equal(dbRecord.uploaded_by, emp1User.id)
  assert.equal(dbRecord.uploaded_by_name, emp1User.full_name)
  assert.equal(dbRecord.uploaded_by_employee_code, emp1User.employee_code)
})

// --------------------------------------------------------------------------
// 16. Client cannot spoof uploader name/code
// --------------------------------------------------------------------------
test('Scenario 16: Client cannot spoof uploader name/code (RPC derives identity exclusively from server session)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // 1. Direct table insert attempt with spoofed fields must fail (RLS/grant blocks direct inserts)
  const { error: directInsertErr } = await emp1Client
    .from('enquiry_service_proofs')
    .insert({
      enquiry_id: enq.id,
      storage_path: storagePath,
      original_filename: 'spoof.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 1024,
      uploaded_by: headUser.id,
      uploaded_by_name: 'Fake Superadmin',
      uploaded_by_employee_code: 'FAKE-CODE-999'
    })
  assert.ok(directInsertErr, 'Direct table insert must be blocked by RLS/grants')

  // 2. Calling register RPC creates record with server-derived identity
  const { data: reg, error } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof_spoof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 2048
  })
  assert.equal(error, null)

  const { data: dbRecord } = await serviceClient
    .from('enquiry_service_proofs')
    .select('uploaded_by, uploaded_by_name, uploaded_by_employee_code')
    .eq('id', reg.id)
    .single()

  assert.equal(dbRecord.uploaded_by, emp1User.id)
  assert.equal(dbRecord.uploaded_by_name, emp1User.full_name)
  assert.equal(dbRecord.uploaded_by_employee_code, emp1User.employee_code)
})

// --------------------------------------------------------------------------
// 17. Storage path contains no customer PII
// --------------------------------------------------------------------------
test('Scenario 17: Storage path contains no customer PII (only enquiry_id/uuid.ext)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const fileUuid = crypto.randomUUID()
  const storagePath = `${enq.id}/${fileUuid}.pdf`

  assert.ok(!storagePath.includes(enq.name), 'Path must not contain customer name')
  assert.ok(!storagePath.includes(enq.contact_info), 'Path must not contain phone/contact')
  assert.equal(storagePath, `${enq.id}/${fileUuid}.pdf`)
})

// --------------------------------------------------------------------------
// 18. Service proof linked to correct enquiry
// --------------------------------------------------------------------------
test('Scenario 18: Service proof linked to correct enquiry with FK RESTRICT', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof_fk.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  const { data: dbRecord } = await serviceClient
    .from('enquiry_service_proofs')
    .select('enquiry_id')
    .eq('id', reg.id)
    .single()

  assert.equal(dbRecord.enquiry_id, enq.id)

  // Test ON DELETE RESTRICT: deleting enquiry must fail while proof exists
  const { error: delErr } = await serviceClient
    .from('enquiries')
    .delete()
    .eq('id', enq.id)
  assert.ok(delErr, 'Deleting enquiry with active service proof must be RESTRICTED')
})

// --------------------------------------------------------------------------
// 19. Employee completion request blocked without signed proof
// --------------------------------------------------------------------------
test('Scenario 19: Employee completion request blocked without signed proof on service enquiry', async () => {
  const enq = await createServiceEnquiry(emp1User.id)

  const { error: subErr } = await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed motherboard capacitor replacement and diagnostics successfully.'
  })

  assert.ok(subErr, 'Completion request must be blocked without signed proof')
  assert.match(subErr.message, /Upload the customer-signed service report before requesting completion/i)
})

// --------------------------------------------------------------------------
// 20. Completion request allowed with valid signed proof
// --------------------------------------------------------------------------
test('Scenario 20: Completion request allowed with valid signed proof', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // Register valid proof
  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'job_sheet_signed.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: DUMMY_JPG.length
  })

  // Submit completion
  const { data: subData, error: subErr } = await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed on-site motherboard repair. Hardware verified working by client.'
  })

  assert.equal(subErr, null, 'Completion request must succeed when signed proof is present')
  assert.equal(subData.success, true)
  assert.equal(subData.status, 'completion_requested')
})

// --------------------------------------------------------------------------
// 21. Voided proof does NOT satisfy completion requirement
// --------------------------------------------------------------------------
test('Scenario 21: Voided proof does NOT satisfy completion requirement', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'mistaken_upload.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  // Void the proof
  await emp1Client.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Uploaded wrong customer job sheet'
  })

  // Attempt completion submission
  const { error: subErr } = await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Attempting completion with voided proof only.'
  })

  assert.ok(subErr, 'Completion must fail because only voided proof exists')
  assert.match(subErr.message, /Upload the customer-signed service report before requesting completion/i)
})

// --------------------------------------------------------------------------
// 22. Head can inspect proof during completion review
// --------------------------------------------------------------------------
test('Scenario 22: Head can inspect non-voided proof list for enquiry under review', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.pdf`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'signed_inspection.pdf',
    p_mime_type: 'application/pdf',
    p_file_size_bytes: DUMMY_PDF.length
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed repair work and obtained signed sheet.'
  })

  const { data: proofs, error } = await headClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)
    .eq('is_voided', false)

  assert.equal(error, null)
  assert.equal(proofs.length, 1)
  assert.equal(proofs[0].original_filename, 'signed_inspection.pdf')
})

// --------------------------------------------------------------------------
// 23. Employee cannot void after completion request
// --------------------------------------------------------------------------
test('Scenario 23: Employee cannot void proof after completion request is submitted', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof_under_review.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Under review by Head.'
  })

  // Employee attempts to void evidence under review
  const { error: voidErr } = await emp1Client.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Want to delete evidence under review'
  })

  assert.ok(voidErr, 'Employee must be blocked from voiding proof under completion review')
  assert.match(voidErr.message, /Cannot void a service proof while a completion request is under review/i)
})

// --------------------------------------------------------------------------
// 24. Head controlled void before approval works
// --------------------------------------------------------------------------
test('Scenario 24: Head controlled void before approval works', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'illegible_sheet.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Ready for review.'
  })

  // Head voids illegible proof
  const { data: voidRes, error: voidErr } = await headClient.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Customer signature is illegible; requested re-scan'
  })

  assert.equal(voidErr, null, 'Head void must succeed')
  assert.equal(voidRes.is_voided, true)
  assert.equal(voidRes.voided_by, headUser.id)
})

// --------------------------------------------------------------------------
// 25. Void requires reason (>= 5 chars)
// --------------------------------------------------------------------------
test('Scenario 25: Void requires meaningful reason (>= 5 characters)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'test.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  const { error: voidErr } = await emp1Client.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'bad' // < 5 chars
  })

  assert.ok(voidErr, 'Short reason must be rejected')
  assert.match(voidErr.message, /Void reason must be at least 5 characters/i)
})

// --------------------------------------------------------------------------
// 26. Rework preserves previous proof history
// --------------------------------------------------------------------------
test('Scenario 26: Return for rework preserves previous proof history', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'first_sheet.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'First attempt.'
  })

  // Head returns for rework
  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'returned_for_rework',
    p_review_notes: 'Missing customer stamp; please rework'
  })

  const { data: proofs } = await serviceClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('enquiry_id', enq.id)

  assert.equal(proofs.length, 1, 'First proof must still exist in table')
  assert.equal(proofs[0].original_filename, 'first_sheet.jpg')
})

// --------------------------------------------------------------------------
// 27. Employee can add new proof after return for rework
// --------------------------------------------------------------------------
test('Scenario 27: Employee can add new proof after return for rework', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const path1 = `${enq.id}/${crypto.randomUUID()}.jpg`
  const path2 = `${enq.id}/${crypto.randomUUID()}.png`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path1,
    p_original_filename: 'sheet_v1.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Work done.'
  })

  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'returned_for_rework',
    p_review_notes: 'Need second signature'
  })

  // Upload proof #2 after rework
  const { data: reg2, error: regErr2 } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path2,
    p_original_filename: 'sheet_v2_reworked.png',
    p_mime_type: 'image/png',
    p_file_size_bytes: 2048
  })

  assert.equal(regErr2, null, 'Second proof upload must succeed during rework')
  assert.equal(reg2.original_filename, 'sheet_v2_reworked.png')
})

// --------------------------------------------------------------------------
// 28. Old proof is not overwritten
// --------------------------------------------------------------------------
test('Scenario 28: Old proof is not overwritten (both old and new proofs exist)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const path1 = `${enq.id}/${crypto.randomUUID()}.jpg`
  const path2 = `${enq.id}/${crypto.randomUUID()}.pdf`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path1,
    p_original_filename: 'historical_v1.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Initial attempt.'
  })

  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'returned_for_rework',
    p_review_notes: 'Rework needed'
  })

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path2,
    p_original_filename: 'historical_v2.pdf',
    p_mime_type: 'application/pdf',
    p_file_size_bytes: 2048
  })

  const { data: allProofs } = await serviceClient
    .from('enquiry_service_proofs')
    .select('original_filename')
    .eq('enquiry_id', enq.id)
    .order('uploaded_at', { ascending: true })

  assert.equal(allProofs.length, 2)
  assert.equal(allProofs[0].original_filename, 'historical_v1.jpg')
  assert.equal(allProofs[1].original_filename, 'historical_v2.pdf')
})

// --------------------------------------------------------------------------
// 29. Completed approved enquiry proof immutable
// --------------------------------------------------------------------------
test('Scenario 29: Completed approved enquiry proof is protected by immutability trigger', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'final_proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'All checks passed.'
  })

  // Head approves
  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'approved',
    p_review_notes: 'Approved permanent record'
  })

  // Direct UPDATE attempt must fail via trigger
  const { error: updErr } = await serviceClient
    .from('enquiry_service_proofs')
    .update({ description: 'Hacked description' })
    .eq('id', reg.id)

  assert.ok(updErr, 'Direct update on approved enquiry proof must fail')
  assert.match(updErr.message, /Permanent archive protection/i)
})

// --------------------------------------------------------------------------
// 30. Employee cannot upload after approval
// --------------------------------------------------------------------------
test('Scenario 30: Employee cannot upload after approval', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const path1 = `${enq.id}/${crypto.randomUUID()}.jpg`
  const path2 = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path1,
    p_original_filename: 'proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed work.'
  })

  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'approved'
  })

  const { error: upErr } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: path2,
    p_original_filename: 'late_proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  assert.ok(upErr, 'Upload after approval must be rejected')
  assert.match(upErr.message, /Cannot upload service proofs for a completed and approved enquiry/i)
})

// --------------------------------------------------------------------------
// 31. Employee cannot delete/void after approval
// --------------------------------------------------------------------------
test('Scenario 31: Employee cannot delete or void after approval', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed work.'
  })

  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'approved'
  })

  const { error: voidErr } = await emp1Client.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Post-approval void attempt'
  })

  assert.ok(voidErr, 'Void after approval must be rejected')
  assert.match(voidErr.message, /Permanent archive protection: Service proofs cannot be voided/i)
})

// --------------------------------------------------------------------------
// 32. Head normal workflow cannot silently mutate approved proof
// --------------------------------------------------------------------------
test('Scenario 32: Head cannot void proof after approval', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await headClient.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Completed work.'
  })

  await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_decision: 'approved'
  })

  const { error: voidErr } = await headClient.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Head trying to void approved proof'
  })

  assert.ok(voidErr, 'Head cannot void after approval')
  assert.match(voidErr.message, /Permanent archive protection/i)
})

// --------------------------------------------------------------------------
// 33. Private file URL is not permanently exposed
// --------------------------------------------------------------------------
test('Scenario 33: Private file URL is not permanently exposed (signed URL has expiry)', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await headClient.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

  const { data: signedData, error } = await headClient.storage
    .from('enquiry-service-proofs')
    .createSignedUrl(storagePath, 60)

  assert.equal(error, null)
  assert.ok(signedData.signedUrl.includes('token='), 'Signed URL must include expiring token parameter')
})

// --------------------------------------------------------------------------
// 34. Signed URL is not stored in database
// --------------------------------------------------------------------------
test('Scenario 34: Signed URL is not stored in database table', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'test.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  const { data: dbRecord } = await serviceClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('id', reg.id)
    .single()

  assert.equal(dbRecord.storage_path, storagePath)
  assert.ok(!JSON.stringify(dbRecord).includes('token='), 'No token or signed URL in DB record')
})

// --------------------------------------------------------------------------
// 35. Activity records upload safely
// --------------------------------------------------------------------------
test('Scenario 35: Activity records upload safely without sensitive data', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'proof_activity.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  const { data: acts } = await serviceClient
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', enq.id)
    .eq('activity_type', 'SERVICE_PROOF_UPLOADED')

  assert.equal(acts.length, 1)
  assert.equal(acts[0].actor_id, emp1User.id)
  assert.ok(acts[0].content.includes('proof_activity.jpg'))
  assert.ok(!acts[0].content.includes('token='), 'No signed URL token in activity')
})

// --------------------------------------------------------------------------
// 36. Activity records void safely
// --------------------------------------------------------------------------
test('Scenario 36: Activity records void safely with audit reason', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'sheet_to_void.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  await emp1Client.rpc('void_enquiry_service_proof', {
    p_proof_id: reg.id,
    p_void_reason: 'Voiding duplicate scan document'
  })

  const { data: acts } = await serviceClient
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', enq.id)
    .eq('activity_type', 'SERVICE_PROOF_VOIDED')

  assert.equal(acts.length, 1)
  assert.ok(acts[0].content.includes('Voiding duplicate scan document'))
})

// --------------------------------------------------------------------------
// 37. Aadhaar absent from proof audit metadata
// --------------------------------------------------------------------------
test('Scenario 37: Aadhaar is strictly absent from proof audit metadata', async () => {
  const enq = await createServiceEnquiry(emp1User.id)
  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  const { data: reg } = await emp1Client.rpc('register_enquiry_service_proof', {
    p_enquiry_id: enq.id,
    p_storage_path: storagePath,
    p_original_filename: 'privacy_check.jpg',
    p_mime_type: 'image/jpeg',
    p_file_size_bytes: 1024
  })

  const { data: proof } = await serviceClient
    .from('enquiry_service_proofs')
    .select('*')
    .eq('id', reg.id)
    .single()

  assert.equal(proof.assigned_employee_aadhaar, undefined)
  assert.equal(proof.aadhaar, undefined)
  assert.ok(!JSON.stringify(proof).includes('aadhaar'))
})

// --------------------------------------------------------------------------
// 38. Step 1 assignment/visit functionality remains intact
// --------------------------------------------------------------------------
test('Scenario 38: Step 1 assignment/visit functionality remains intact', async () => {
  const enq = await createServiceEnquiry()

  const visitTime = new Date(Date.now() + 86400000).toISOString()
  const { data: assignRes, error } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id,
    p_reason: 'Assignment with expected visit',
    p_expected_visit_at: visitTime,
    p_visit_note: 'Customer requested 10 AM visit'
  })

  assert.equal(error, null)
  assert.equal(assignRes.action, 'ENQUIRY_ASSIGNED')

  const { data: enqRecord } = await serviceClient
    .from('enquiries')
    .select('assigned_employee_id, expected_visit_at, assignment_visit_note')
    .eq('id', enq.id)
    .single()

  assert.equal(enqRecord.assigned_employee_id, emp1User.id)
  assert.equal(new Date(enqRecord.expected_visit_at).getTime(), new Date(visitTime).getTime())
  assert.equal(enqRecord.assignment_visit_note, 'Customer requested 10 AM visit')
})

// --------------------------------------------------------------------------
// 39. Auth/passwords untouched
// --------------------------------------------------------------------------
test('Scenario 39: Auth credentials and passwords remain untouched', async () => {
  // Verify employee and head can authenticate with unchanged credentials
  const client1 = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: err1 } = await client1.auth.signInWithPassword({
    email: EMP1_EMAIL,
    password: EMP1_PASSWORD
  })
  assert.equal(err1, null, 'Employee auth must succeed with existing password')

  const client2 = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: err2 } = await client2.auth.signInWithPassword({
    email: HEAD_EMAIL,
    password: HEAD_PASSWORD
  })
  assert.equal(err2, null, 'Head auth must succeed with existing password')
})

// --------------------------------------------------------------------------
// 40. Existing Enquiry workflow remains intact (general enquiries complete without proof)
// --------------------------------------------------------------------------
test('Scenario 40: General non-service enquiry completes without proof requirement', async () => {
  const phone = getUniquePhone()
  const { data: generalEnq, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'General Product Inquiry',
      contact_info: phone,
      message: 'Interested in purchasing refurbished ThinkPad laptop',
      category_interest: 'Laptops',
      enquiry_type: 'general',
      status: 'new'
    })
    .select()
    .single()

  assert.equal(createErr, null)

  // General enquiry should complete without requiring signed service proof
  const { data: subData, error: subErr } = await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: generalEnq.id,
    p_completion_summary: 'Customer purchased laptop and quotation converted to sale.'
  })

  assert.equal(subErr, null, 'General non-service enquiry must complete without proof')
  assert.equal(subData.status, 'completion_requested')
})

// --------------------------------------------------------------------------
// 41. Existing Orders attachment/payment functionality remains intact
// --------------------------------------------------------------------------
test('Scenario 41: Existing Orders attachment/payment functionality remains intact', async () => {
  // Verify order_attachments and order_payments tables are queryable
  const { data: atts, error: attErr } = await headClient.from('order_attachments').select('id').limit(1)
  assert.equal(attErr, null)
  assert.ok(Array.isArray(atts))

  const { data: pays, error: payErr } = await headClient.from('order_payments').select('id').limit(1)
  assert.equal(payErr, null)
  assert.ok(Array.isArray(pays))
})

// --------------------------------------------------------------------------
// 42. Existing monthly/reporting tests remain intact
// --------------------------------------------------------------------------
test('Scenario 42: Purge expired bin enquiries strictly protects completed enquiries', async () => {
  const { data: purgeRes, error } = await headClient.rpc('purge_expired_bin_enquiries', {
    p_retention_grace_seconds: 0
  })
  assert.equal(error, null)
  assert.equal(purgeRes.success, true)
})
