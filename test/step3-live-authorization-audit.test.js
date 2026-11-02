/**
 * ============================================================================
 * ARS Computers — Step 3 Live Database & Storage Security Audit Test Suite
 * ============================================================================
 * Executes live against the isolated local Supabase instance (http://127.0.0.1:54321).
 * Tests all 8 security invariants using real authenticated role identities:
 *
 * 1. Head / Superadmin: Full proof metadata, storage object SELECT, and signed URL generation across all enquiries.
 * 2. Currently assigned employee: Own assigned enquiry proofs metadata, storage object SELECT, and signed URL generation.
 * 3. Previously assigned employee: Immediately denied metadata, storage, and signed URL generation upon reassignment.
 * 4. Unassigned employee: Immediately denied metadata, storage, and signed URL generation upon unassignment.
 * 5. Peer employees (Engineer, Technical, HR, Account): Strictly denied access to other employees' proofs.
 * 6. Technical, HR, and Account roles: Retain exact Engineer-level parity (access ONLY when assigned, blocked when unassigned).
 * 7. Inventory Staff & Anonymous: Strictly denied proof metadata, storage objects, and signed URL generation across all enquiries.
 * 8. Bearer signed URL expiry: Cryptographic token remains valid until explicit expiration timestamp, then strictly expires.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DUMMY_JPG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9
])

const TEST_USERS = {
  superadmin: { email: 'head.audit@arscomputers.in', role: 'superadmin', name: 'Superadmin Head' },
  emp1: { email: 'engineer1.audit@arscomputers.in', role: 'engineer', name: 'Field Engineer 1' },
  emp2: { email: 'engineer2.audit@arscomputers.in', role: 'engineer', name: 'Field Engineer 2' },
  technical: { email: 'technical.audit@arscomputers.in', role: 'technical', name: 'Technical Specialist' },
  hr: { email: 'hr.audit@arscomputers.in', role: 'hr', name: 'HR Executive' },
  account: { email: 'account.audit@arscomputers.in', role: 'account', name: 'Accountant' },
  inventory: { email: 'inventory.audit@arscomputers.in', role: 'inventory_staff', name: 'Inventory Manager' }
}

const clients = {}
const userRecords = {}

async function getOrCreateTestUser(key, spec) {
  const password = `Audit#2026!${key}Pass`
  let user = null

  const { data: list } = await serviceClient.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === spec.email)

  if (existing) {
    user = existing
    await serviceClient.auth.admin.updateUserById(user.id, { password })
  } else {
    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: spec.name }
    })
    if (createErr) throw createErr
    user = created.user
  }

  // Ensure record in admin_users with exact role
  await serviceClient.from('admin_users').upsert({
    id: user.id,
    email: spec.email,
    full_name: spec.name,
    role: spec.role,
    is_active: true,
    phone_number: '+919876543210'
  })

  // Create authenticated client
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: spec.email,
    password
  })
  if (signInErr) throw signInErr

  return { user, client }
}

async function createEnquiryWithProof(assignedEmployeeId) {
  // Use unique contact info to avoid trigger rate limiter
  const randomSuffix = Math.floor(10000 + Math.random() * 90000)
  const phone = `+9198765${randomSuffix}`

  const { data: enq, error: enqErr } = await clients.superadmin
    .from('enquiries')
    .insert({
      name: `Audit Customer ${randomSuffix}`,
      contact_info: phone,
      customer_phone: phone,
      category_interest: 'Service: CCTV Security',
      message: 'Need urgent CCTV inspection and repair',
      enquiry_type: 'service_request',
      status: 'new'
    })
    .select('*')
    .single()
  if (enqErr) throw enqErr

  if (assignedEmployeeId) {
    const { error: assignErr } = await clients.superadmin.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: assignedEmployeeId,
      p_reason: 'Assigning engineer for inspection visit',
      p_expected_visit_at: new Date(Date.now() + 86400000).toISOString(),
      p_visit_note: 'Initial assignment'
    })
    if (assignErr) throw assignErr
  }

  const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`

  // Upload object to storage bucket using service role
  const { error: uploadErr } = await serviceClient.storage
    .from('enquiry-service-proofs')
    .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })
  if (uploadErr) throw uploadErr

  // Register proof record in public.enquiry_service_proofs
  const { data: proof, error: proofErr } = await serviceClient
    .from('enquiry_service_proofs')
    .insert({
      enquiry_id: enq.id,
      storage_path: storagePath,
      original_filename: 'service_report_audit.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: DUMMY_JPG.length,
      document_type: 'CUSTOMER_SIGNED_SERVICE_REPORT',
      description: 'Audit service proof',
      uploaded_by: assignedEmployeeId || userRecords.superadmin.id,
      uploaded_by_name: 'Audit Uploader',
      is_customer_signed: true,
      is_voided: false
    })
    .select('*')
    .single()
  if (proofErr) throw proofErr

  return { enq, proof, storagePath }
}

test('ARS Computers — Step 3 Live Security & Authorization Audit', async (t) => {
  // 1. Provision all test role accounts
  await t.test('Setup: Provision 7 role identities and sign in', async () => {
    for (const [key, spec] of Object.entries(TEST_USERS)) {
      const { user, client } = await getOrCreateTestUser(key, spec)
      userRecords[key] = user
      clients[key] = client
      assert.ok(user.id, `User ${key} must have UUID`)
    }
  })

  // 2. Currently Assigned Employee Access
  await t.test('Currently Assigned Employee: Access GRANTED to metadata, storage, and signed URL', async () => {
    const { enq, proof, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // A. Metadata SELECT
    const { data: proofs, error: metaErr } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('*')
      .eq('enquiry_id', enq.id)
    assert.equal(metaErr, null)
    assert.equal(proofs.length, 1, 'Assigned employee must see own enquiry proof')
    assert.equal(proofs[0].id, proof.id)

    // B. Storage Object SELECT
    const { data: objects, error: objErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .list(enq.id)
    assert.equal(objErr, null)
    assert.ok(objects.length >= 1, 'Assigned employee must be able to list objects in own enquiry folder')

    // C. Signed URL generation
    const { data: signed, error: signErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.equal(signErr, null)
    assert.ok(signed?.signedUrl, 'Assigned employee must be able to generate signed URL')
  })

  // 3. Head / Superadmin Access
  await t.test('Head / Superadmin: Access GRANTED across all enquiries', async () => {
    const { enq, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // Metadata
    const { data: proofs, error: metaErr } = await clients.superadmin
      .from('enquiry_service_proofs')
      .select('*')
      .eq('enquiry_id', enq.id)
    assert.equal(metaErr, null)
    assert.equal(proofs.length, 1)

    // Storage object list
    const { data: objects, error: objErr } = await clients.superadmin.storage
      .from('enquiry-service-proofs')
      .list(enq.id)
    assert.equal(objErr, null)
    assert.ok(objects.length >= 1)

    // Signed URL
    const { data: signed, error: signErr } = await clients.superadmin.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.equal(signErr, null)
    assert.ok(signed?.signedUrl)
  })

  // 4. Peer Employee Denial (Engineer, Technical, HR, Account)
  await t.test('Peer Employees: DENIED metadata, storage, and signed URL generation', async () => {
    const { enq, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    const peerKeys = ['emp2', 'technical', 'hr', 'account']
    for (const pKey of peerKeys) {
      const pClient = clients[pKey]

      // A. Metadata SELECT -> 0 rows returned
      const { data: proofs } = await pClient
        .from('enquiry_service_proofs')
        .select('*')
        .eq('enquiry_id', enq.id)
      assert.equal(proofs?.length || 0, 0, `Peer ${pKey} must receive 0 rows for another employee's proof`)

      // B. Storage Object List -> 0 objects returned
      const { data: objects } = await pClient.storage
        .from('enquiry-service-proofs')
        .list(enq.id)
      assert.equal(objects?.length || 0, 0, `Peer ${pKey} must not list storage objects of another employee`)

      // C. Signed URL generation -> Error / denied
      const { data: signed, error: signErr } = await pClient.storage
        .from('enquiry-service-proofs')
        .createSignedUrl(storagePath, 60)
      assert.ok(signErr || !signed?.signedUrl, `Peer ${pKey} must be denied signed URL generation`)
    }
  })

  // 5. Inventory Staff & Anonymous Denial
  await t.test('Inventory Staff & Anonymous: Strictly DENIED access across all enquiries', async () => {
    const { enq, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // Inventory Staff
    const { data: invProofs } = await clients.inventory
      .from('enquiry_service_proofs')
      .select('*')
      .eq('enquiry_id', enq.id)
    assert.equal(invProofs?.length || 0, 0, 'Inventory staff must receive 0 rows')

    const { error: invSignErr } = await clients.inventory.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.ok(invSignErr, 'Inventory staff must be denied signed URL')

    // Anonymous
    const { data: anonProofs, error: anonMetaErr } = await anonClient
      .from('enquiry_service_proofs')
      .select('*')
      .eq('enquiry_id', enq.id)
    assert.ok(anonMetaErr || (anonProofs?.length || 0) === 0, 'Anonymous must receive 0 rows or error')

    const { error: anonSignErr } = await anonClient.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.ok(anonSignErr, 'Anonymous must be denied signed URL')
  })

  // 6. Reassignment Immediate Access Removal
  await t.test('Reassignment: Previous employee IMMEDIATELY loses access; new employee GRANTED access', async () => {
    // Initially assigned to EMP1
    const { enq, proof, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // Verify EMP1 has initial access
    const { data: initialEmp1 } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('id')
      .eq('id', proof.id)
    assert.equal(initialEmp1.length, 1, 'EMP1 must have initial access')

    // Superadmin reassigns to EMP2
    const { data: reassignRes, error: reassignErr } = await clients.superadmin.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: userRecords.emp2.id,
      p_reason: 'Reassigning from EMP1 to EMP2 due to schedule change'
    })
    assert.equal(reassignErr, null)
    assert.equal(reassignRes.success, true)

    // IMMEDIATELY: EMP1 must be DENIED
    const { data: emp1After } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp1After?.length || 0, 0, 'Previously assigned EMP1 must immediately lose proof metadata access')

    const { error: emp1SignErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.ok(emp1SignErr, 'Previously assigned EMP1 must immediately be denied signed URL generation')

    // IMMEDIATELY: EMP2 must be GRANTED
    const { data: emp2After, error: emp2MetaErr } = await clients.emp2
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp2MetaErr, null)
    assert.equal(emp2After.length, 1, 'Newly assigned EMP2 must immediately gain proof metadata access')

    const { data: emp2Sign, error: emp2SignErr } = await clients.emp2.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.equal(emp2SignErr, null)
    assert.ok(emp2Sign?.signedUrl, 'Newly assigned EMP2 must gain signed URL generation access')
  })

  // 7. Unassignment Immediate Access Removal
  await t.test('Unassignment: Employee IMMEDIATELY loses access upon unassignment', async () => {
    const { enq, proof, storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // Superadmin unassigns enquiry
    const { data: unassignRes, error: unassignErr } = await clients.superadmin.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: null,
      p_reason: 'Unassigning enquiry'
    })
    assert.equal(unassignErr, null)
    assert.equal(unassignRes.success, true)

    // EMP1 must be DENIED
    const { data: emp1After } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp1After?.length || 0, 0, 'Unassigned employee must immediately lose proof metadata access')

    const { error: emp1SignErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.ok(emp1SignErr, 'Unassigned employee must immediately be denied signed URL generation')

    // Head retains access
    const { data: headAfter } = await clients.superadmin
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(headAfter.length, 1, 'Head retains access even when enquiry is unassigned')
  })

  // 8. Exact Parity for Technical, HR, and Account Roles
  await t.test('Role Parity: Technical, HR, and Account have exact Engineer-level access when assigned', async () => {
    const parityRoles = ['technical', 'hr', 'account']

    for (const rKey of parityRoles) {
      const uRecord = userRecords[rKey]
      const rClient = clients[rKey]

      // Assign to this role
      const { enq: _enq, proof, storagePath } = await createEnquiryWithProof(uRecord.id)

      // When assigned: GRANTED
      const { data: proofs, error: pErr } = await rClient
        .from('enquiry_service_proofs')
        .select('*')
        .eq('id', proof.id)
      assert.equal(pErr, null)
      assert.equal(proofs.length, 1, `${rKey} must have access when enquiry is assigned to them`)

      const { data: signed, error: sErr } = await rClient.storage
        .from('enquiry-service-proofs')
        .createSignedUrl(storagePath, 60)
      assert.equal(sErr, null)
      assert.ok(signed?.signedUrl, `${rKey} must be able to generate signed URL when assigned`)

      // Other roles (including Engineer EMP1) are DENIED for this enquiry
      const { data: emp1Check } = await clients.emp1
        .from('enquiry_service_proofs')
        .select('*')
        .eq('id', proof.id)
      assert.equal(emp1Check?.length || 0, 0, `Engineer must be blocked from proof assigned to ${rKey}`)
    }
  })

  // 9. Bearer Signed URL Expiry Lifecycle
  await t.test('Signed URL Expiry: URL remains valid until explicit expiry timestamp passes', async () => {
    const { storagePath } = await createEnquiryWithProof(userRecords.emp1.id)

    // Generate short-lived signed URL (3 seconds)
    const { data: signed, error: signErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 3)
    assert.equal(signErr, null)
    assert.ok(signed?.signedUrl)

    const url = signed.signedUrl.startsWith('http')
      ? signed.signedUrl
      : `${LOCAL_SUPABASE_URL}/storage/v1${signed.signedUrl}`

    // 1. Fetch immediately -> Must return 200 OK
    const resImmediate = await fetch(url)
    assert.equal(resImmediate.status, 200, 'Bearer URL must be valid before expiration')

    // 2. Wait 4 seconds for expiry
    await new Promise((resolve) => setTimeout(resolve, 4000))

    // 3. Fetch after expiry -> Must fail (400 Expired URL error)
    const resExpired = await fetch(url)
    assert.notEqual(resExpired.status, 200, 'Bearer URL must NOT be accessible after expiration')
  })
})
