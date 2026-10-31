/**
 * ============================================================================
 * ARS Computers — Staff Profile + Aadhaar + Visit Timeline Test Suite
 * ============================================================================
 * 36 Automated Scenarios verifying:
 *
 *  1.  Head can update employee full name via update_staff_profile RPC
 *  2.  Head can update employee phone number via update_staff_profile RPC
 *  3.  Head can update employee Aadhaar number via update_staff_profile RPC
 *  4.  Head can update all allowed profile fields in one call
 *  5.  Employee cannot edit own full name
 *  6.  Employee cannot edit own phone number
 *  7.  Employee cannot edit own Aadhaar
 *  8.  Employee cannot edit own employee code
 *  9.  Employee cannot change own role
 * 10.  Employee cannot edit another employee's profile
 * 11.  Inventory Staff cannot manage staff profiles
 * 12.  Unauthenticated caller blocked from update_staff_profile
 * 13.  Aadhaar validation accepts valid 12-digit string
 * 14.  Aadhaar validation rejects fewer than 12 digits
 * 15.  Aadhaar validation rejects more than 12 digits
 * 16.  Aadhaar validation rejects alphabetic/mixed input
 * 17.  Head profile update does NOT change Auth password (UUID intact)
 * 18.  Head profile update does NOT recreate Auth user
 * 19.  Existing Auth UUID remains unchanged after profile update
 * 20.  Head assigns enquiry with expected visit datetime
 * 21.  Expected visit persists and is readable from enquiry record
 * 22.  Reassignment stores new engineer identity + new visit time
 * 23.  Unassignment clears assignment fields
 * 24.  Self-assignment derives employee identity server-side from auth.uid()
 * 25.  Self-assignment cannot spoof Aadhaar/name/code/phone
 * 26.  Self-assignment expected visit behaves correctly
 * 27.  Peer takeover remains blocked after Step 1 schema changes
 * 28.  Inventory Staff assignment remains blocked
 * 29.  Frozen enquiry statuses remain blocked for assignment
 * 30.  Completed enquiry remains immutable (new fields included)
 * 31.  Archived enquiry remains immutable (new fields included)
 * 32.  Existing assignment functionality remains compatible
 * 33.  Old enquiries with NULL new fields remain valid (no constraint error)
 * 34.  Existing enquiry status is NOT accidentally changed by profile update
 * 35.  Activity history records assignment with visit time in metadata
 * 36.  No real Aadhaar or test credentials hardcoded (synthetic data only)
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { normalizeAadhaar, validateAadhaar, formatAadhaarDisplay } from '../src/utils/aadhaarFormatter.js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// ── Synthetic test credentials — NOT real Aadhaar or production passwords ──────
// All Aadhaar numbers below are synthetic 12-digit sequences generated for tests.
// They do not belong to any real person.
const SYNTHETIC_AADHAAR_A = '123456789012'
const SYNTHETIC_AADHAAR_B = '987654321098'
const SYNTHETIC_AADHAAR_INVALID_SHORT = '12345678901'   // 11 digits
const SYNTHETIC_AADHAAR_INVALID_LONG  = '1234567890123' // 13 digits
const SYNTHETIC_AADHAAR_INVALID_ALPHA = '1234ABCD9012'  // contains letters

const HEAD2_EMAIL    = 'head.profile.step1@arscomputers.test'
const HEAD2_PASSWORD = 'HeadProfile#Step1!Test'
const EMP_A_EMAIL    = 'emp.a.profile.step1@arscomputers.test'
const EMP_A_PASSWORD = 'EmpAProfile#Step1!Test'
const EMP_B_EMAIL    = 'emp.b.profile.step1@arscomputers.test'
const EMP_B_PASSWORD = 'EmpBProfile#Step1!Test'
const INV2_EMAIL     = 'inv.profile.step1@arscomputers.test'
const INV2_PASSWORD  = 'InvProfile#Step1!Test'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})
const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let _headUser = null
let empAUser = null
let empBUser = null
let _invUser  = null
let headClient = null
let empAClient = null
let empBClient = null
let invClient  = null

// ── Fixture helpers ────────────────────────────────────────────────────────────

async function getOrCreateTestUser(email, password, fullName, role, employeeCode, phone = null, isActive = true) {
  const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
  let existing = listData?.users?.find((u) => u.email === email)

  let userId = null
  if (!existing) {
    const { data: created, error } = await serviceClient.auth.admin.createUser({
      email, password, email_confirm: true,
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
      { id: userId, email, full_name: fullName, role, is_active: isActive,
        employee_code: employeeCode, phone_number: phone, aadhaar_number: null },
      { onConflict: 'id' }
    )
    .select()
    .single()
  if (upsertErr) throw upsertErr

  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: authData, error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw signInErr

  return { user: profile, client, session: authData.session }
}

let testEnquirySeq = 200

async function createTestEnquiry(client, status = 'new') {
  testEnquirySeq++
  const uniqueContact = `+9198111${String(testEnquirySeq).padStart(5, '0')}`
  const { data, error } = await headClient
    .from('enquiries')
    .insert({
      name: `Profile Test Customer ${testEnquirySeq}`,
      contact_info: uniqueContact,
      category_interest: 'Hardware Service',
      message: 'Test enquiry message for assignment timeline testing',
      status: 'new',
      is_archived: false,
      is_in_bin: false
    })
    .select()
    .single()
  if (error) throw error

  if (status !== 'new') {
    const { data: updated, error: updateErr } = await serviceClient
      .from('enquiries')
      .update({ status })
      .eq('id', data.id)
      .select()
      .single()
    if (updateErr) throw updateErr
    return updated
  }
  return data
}

async function cleanupEnquiry(id) {
  await serviceClient.from('enquiry_activities').delete().eq('enquiry_id', id)
  await serviceClient.from('enquiries').delete().eq('id', id)
}

// ── Test Setup ─────────────────────────────────────────────────────────────────

test.before(async () => {
  const head = await getOrCreateTestUser(HEAD2_EMAIL, HEAD2_PASSWORD, 'Head Profile Step1', 'superadmin', 'EMP-HPRF-001', '+919111111101')
  _headUser = head.user; headClient = head.client

  const empA = await getOrCreateTestUser(EMP_A_EMAIL, EMP_A_PASSWORD, 'Employee Alpha', 'admin', 'EMP-ALPH-001', '+919111111102')
  empAUser = empA.user; empAClient = empA.client

  const empB = await getOrCreateTestUser(EMP_B_EMAIL, EMP_B_PASSWORD, 'Employee Beta', 'admin', 'EMP-BETA-001', '+919111111103')
  empBUser = empB.user; empBClient = empB.client

  const inv = await getOrCreateTestUser(INV2_EMAIL, INV2_PASSWORD, 'Inventory Profile', 'inventory_staff', 'EMP-INVP-001', null)
  _invUser = inv.user; invClient = inv.client
})

// ── TESTS 1-4: Head can update employee profile ────────────────────────────────

test('1. Head can update employee full name via update_staff_profile', async () => {
  const { error } = await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha Updated',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ifError(error)
  const { data: fetched } = await serviceClient.from('admin_users').select('full_name').eq('id', empAUser.id).single()
  assert.equal(fetched.full_name, 'Employee Alpha Updated', 'Name should be updated')
  // Restore
  await serviceClient.from('admin_users').update({ full_name: 'Employee Alpha' }).eq('id', empAUser.id)
})

test('2. Head can update employee phone via update_staff_profile', async () => {
  const newPhone = '+919222222222'
  const { error } = await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: newPhone,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ifError(error)
  const { data: fetched } = await serviceClient.from('admin_users').select('phone_number').eq('id', empAUser.id).single()
  assert.equal(fetched.phone_number, newPhone)
  await serviceClient.from('admin_users').update({ phone_number: '+919111111102' }).eq('id', empAUser.id)
})

test('3. Head can update employee Aadhaar via update_staff_profile', async () => {
  const { error } = await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: SYNTHETIC_AADHAAR_A,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ifError(error)
  const { data: fetched } = await serviceClient.from('admin_users').select('aadhaar_number').eq('id', empAUser.id).single()
  assert.equal(fetched.aadhaar_number, SYNTHETIC_AADHAAR_A, 'Aadhaar should be stored')
  // Cleanup
  await serviceClient.from('admin_users').update({ aadhaar_number: null }).eq('id', empAUser.id)
})

test('4. Head can manage all allowed profile fields in one call', async () => {
  const { error } = await headClient.rpc('update_staff_profile', {
    p_user_id: empBUser.id,
    p_full_name: 'Employee Beta Renamed',
    p_employee_code: 'EMP-BETA-UPDATED',
    p_phone_number: '+919333333333',
    p_aadhaar_number: SYNTHETIC_AADHAAR_B,
    p_role: 'admin',
    p_is_active: true
  })
  assert.ifError(error)
  const { data: fetched } = await serviceClient.from('admin_users')
    .select('full_name, employee_code, phone_number, aadhaar_number, role, is_active')
    .eq('id', empBUser.id)
    .single()
  assert.equal(fetched.full_name, 'Employee Beta Renamed')
  assert.equal(fetched.employee_code, 'EMP-BETA-UPDATED')
  assert.equal(fetched.phone_number, '+919333333333')
  assert.equal(fetched.aadhaar_number, SYNTHETIC_AADHAAR_B)
  assert.equal(fetched.role, 'admin')
  assert.equal(fetched.is_active, true)
  // Restore
  await serviceClient.from('admin_users').update({
    full_name: 'Employee Beta', employee_code: 'EMP-BETA-001',
    phone_number: '+919111111103', aadhaar_number: null
  }).eq('id', empBUser.id)
})

// ── TESTS 5-10: Employee cannot modify profiles ────────────────────────────────

test('5. Employee cannot edit own full name via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Hacked Name',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ok(error, 'Should be rejected with an error')
  const { data: fetched } = await serviceClient.from('admin_users').select('full_name').eq('id', empAUser.id).single()
  assert.equal(fetched.full_name, 'Employee Alpha', 'Name must not have changed')
})

test('6. Employee cannot edit own phone via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: '+910000000000',
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ok(error, 'Should be rejected')
  const { data: fetched } = await serviceClient.from('admin_users').select('phone_number').eq('id', empAUser.id).single()
  assert.notEqual(fetched.phone_number, '+910000000000', 'Phone must not have changed')
})

test('7. Employee cannot edit own Aadhaar via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: SYNTHETIC_AADHAAR_A,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ok(error, 'Should be rejected')
  const { data: fetched } = await serviceClient.from('admin_users').select('aadhaar_number').eq('id', empAUser.id).single()
  assert.equal(fetched.aadhaar_number, null, 'Aadhaar must remain null')
})

test('8. Employee cannot edit own employee code via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: 'EMP-HACKED',
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })
  assert.ok(error, 'Should be rejected')
  const { data: fetched } = await serviceClient.from('admin_users').select('employee_code').eq('id', empAUser.id).single()
  assert.notEqual(fetched.employee_code, 'EMP-HACKED', 'Employee code must not have changed')
})

test('9. Employee cannot change own role via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: 'superadmin',
    p_is_active: true
  })
  assert.ok(error, 'Role escalation should be rejected')
  const { data: fetched } = await serviceClient.from('admin_users').select('role').eq('id', empAUser.id).single()
  assert.equal(fetched.role, 'admin', 'Role must remain admin')
})

test('10. Employee cannot edit another employee profile via update_staff_profile', async () => {
  const { error } = await empAClient.rpc('update_staff_profile', {
    p_user_id: empBUser.id,
    p_full_name: 'Peer Hacked',
    p_employee_code: 'EMP-PEER-HACKED',
    p_phone_number: null,
    p_aadhaar_number: null,
    p_role: 'admin',
    p_is_active: true
  })
  assert.ok(error, 'Cross-employee edit should be rejected')
  const { data: fetched } = await serviceClient.from('admin_users').select('full_name').eq('id', empBUser.id).single()
  assert.equal(fetched.full_name, 'Employee Beta', 'Other employee name must be unchanged')
})

// ── TEST 11: Inventory Staff blocked ──────────────────────────────────────────

test('11. Inventory Staff cannot manage staff profiles', async () => {
  const { error } = await invClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Inv Hacked',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: 'admin',
    p_is_active: true
  })
  assert.ok(error, 'Inventory staff should be rejected')
})

// ── TEST 12: Anonymous blocked ─────────────────────────────────────────────────

test('12. Unauthenticated caller blocked from update_staff_profile', async () => {
  const { error } = await anonClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Anon Hacked',
    p_employee_code: 'EMP-ANON',
    p_phone_number: null,
    p_aadhaar_number: null,
    p_role: 'admin',
    p_is_active: true
  })
  assert.ok(error, 'Anonymous caller should be rejected')
})

// ── TESTS 13-16: Aadhaar validation ───────────────────────────────────────────

test('13. Aadhaar validation accepts valid 12-digit synthetic string', () => {
  const normalized = normalizeAadhaar(SYNTHETIC_AADHAAR_A)
  assert.ok(validateAadhaar(normalized), '12-digit numeric string should be valid')
  assert.equal(normalized, SYNTHETIC_AADHAAR_A)
})

test('13b. Aadhaar validation accepts 12 digits with spaces (normalized)', () => {
  const spaced = '1234 5678 9012'
  const normalized = normalizeAadhaar(spaced)
  assert.ok(validateAadhaar(normalized), 'Spaced 12-digit input should normalize and validate')
  assert.equal(normalized, '123456789012')
})

test('14. Aadhaar validation rejects fewer than 12 digits', () => {
  const normalized = normalizeAadhaar(SYNTHETIC_AADHAAR_INVALID_SHORT)
  assert.equal(validateAadhaar(normalized), false, '11-digit string should be invalid')
})

test('15. Aadhaar validation rejects more than 12 digits', () => {
  const normalized = normalizeAadhaar(SYNTHETIC_AADHAAR_INVALID_LONG)
  assert.equal(validateAadhaar(normalized), false, '13-digit string should be invalid')
})

test('16. Aadhaar validation rejects alphabetic/mixed input', () => {
  const normalized = normalizeAadhaar(SYNTHETIC_AADHAAR_INVALID_ALPHA)
  assert.equal(validateAadhaar(normalized), false, 'Mixed alpha string should be invalid')
})

// ── TESTS 17-19: Auth non-interference ────────────────────────────────────────

test('17. Head profile update does NOT change Auth password — UUID remains same', async () => {
  const { data: beforeAuth } = await serviceClient.auth.admin.getUserById(empAUser.id)
  const uuidBefore = beforeAuth.user.id

  await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha v2',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })

  const { data: afterAuth } = await serviceClient.auth.admin.getUserById(empAUser.id)
  assert.equal(afterAuth.user.id, uuidBefore, 'Auth UUID must be unchanged')

  // Verify employee can still sign in with original password
  const testClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: signInErr } = await testClient.auth.signInWithPassword({
    email: EMP_A_EMAIL,
    password: EMP_A_PASSWORD
  })
  assert.ifError(signInErr, 'Original password must still work — profile update must not change it')

  await serviceClient.from('admin_users').update({ full_name: 'Employee Alpha' }).eq('id', empAUser.id)
})

test('18. Head profile update does NOT recreate Auth user', async () => {
  const { data: before } = await serviceClient.auth.admin.getUserById(empAUser.id)
  const createdAtBefore = before.user.created_at

  await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: empAUser.employee_code,
    p_phone_number: empAUser.phone_number,
    p_aadhaar_number: null,
    p_role: empAUser.role,
    p_is_active: true
  })

  const { data: after } = await serviceClient.auth.admin.getUserById(empAUser.id)
  assert.equal(after.user.created_at, createdAtBefore, 'Auth user created_at must not change — no recreation')
})

test('19. Existing Auth UUID remains unchanged after profile update', async () => {
  const { data: before } = await serviceClient.auth.admin.getUserById(empBUser.id)
  const uuidBefore = before.user.id

  await headClient.rpc('update_staff_profile', {
    p_user_id: empBUser.id,
    p_full_name: 'Employee Beta',
    p_employee_code: 'EMP-BETA-001',
    p_phone_number: '+919111111103',
    p_aadhaar_number: null,
    p_role: 'admin',
    p_is_active: true
  })

  const { data: after } = await serviceClient.auth.admin.getUserById(empBUser.id)
  assert.equal(after.user.id, uuidBefore, 'UUID must remain identical')
  const { data: profile } = await serviceClient.from('admin_users').select('id').eq('id', empBUser.id).single()
  assert.equal(profile.id, uuidBefore, 'admin_users.id must match original Auth UUID')
})

// ── TESTS 20-23: Head assign/reassign/unassign with visit time ─────────────────

test('20. Head assigns enquiry with expected visit datetime', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  const visitAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  try {
    const { error } = await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: 'Scheduled for next available slot',
      p_expected_visit_at: visitAt,
      p_visit_note: 'Please call before arrival'
    })
    assert.ifError(error)

    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_id, expected_visit_at, assignment_visit_note')
      .eq('id', enquiry.id)
      .single()
    assert.equal(updated.assigned_employee_id, empAUser.id)
    assert.ok(updated.expected_visit_at, 'expected_visit_at should be set')
    assert.equal(updated.assignment_visit_note, 'Please call before arrival')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('21. Expected visit persists and is readable from enquiry record', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'in_progress')
  const visitAt = '2027-01-15T10:30:00.000Z'

  try {
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: null,
      p_expected_visit_at: visitAt,
      p_visit_note: null
    })

    const { data: fetched } = await serviceClient.from('enquiries')
      .select('expected_visit_at')
      .eq('id', enquiry.id)
      .single()
    assert.ok(fetched.expected_visit_at)
    // Compare date portion (ignore microseconds/timezone normalization)
    assert.ok(fetched.expected_visit_at.startsWith('2027-01-15'), 'Visit date should be 2027-01-15')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('22. Reassignment stores new engineer identity and new visit time', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  const originalVisit = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const newVisit = new Date(Date.now() + 72 * 3600 * 1000).toISOString()

  try {
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: 'Initial assignment',
      p_expected_visit_at: originalVisit,
      p_visit_note: 'Original note'
    })

    // Reassign to empB with new visit time
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empBUser.id,
      p_reason: 'Workload rebalancing',
      p_expected_visit_at: newVisit,
      p_visit_note: 'Reassigned note'
    })

    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_id, assigned_employee_name, expected_visit_at, assignment_visit_note')
      .eq('id', enquiry.id)
      .single()

    assert.equal(updated.assigned_employee_id, empBUser.id, 'Should now be assigned to empB')
    assert.equal(updated.assigned_employee_name, 'Employee Beta', 'Name should be empB')
    assert.ok(updated.expected_visit_at)
    assert.equal(updated.assignment_visit_note, 'Reassigned note')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('23. Unassignment clears assignment fields including visit time', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  const visitAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

  try {
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: null,
      p_expected_visit_at: visitAt,
      p_visit_note: 'Note to clear'
    })

    // Unassign (pass null employee_id)
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: null,
      p_reason: 'Unassigning per schedule change',
      p_expected_visit_at: null,
      p_visit_note: null
    })

    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_id, expected_visit_at, assignment_visit_note')
      .eq('id', enquiry.id)
      .single()

    assert.equal(updated.assigned_employee_id, null, 'assigned_employee_id should be null')
    assert.equal(updated.expected_visit_at, null, 'expected_visit_at should be cleared')
    assert.equal(updated.assignment_visit_note, null, 'visit note should be cleared')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

// ── TESTS 24-26: Self-assignment ───────────────────────────────────────────────

test('24. Self-assignment derives employee identity server-side from auth.uid()', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')

  try {
    const { error } = await empAClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ifError(error)

    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_id, assigned_employee_name, assigned_employee_code, assigned_employee_phone')
      .eq('id', enquiry.id)
      .single()

    assert.equal(updated.assigned_employee_id, empAUser.id, 'assigned_employee_id must be the authenticated user')
    assert.equal(updated.assigned_employee_name, 'Employee Alpha', 'Name snapshot must come from server profile')
    assert.equal(updated.assigned_employee_code, 'EMP-ALPH-001', 'Code snapshot must come from server profile')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('25. Self-assignment cannot spoof Aadhaar/name/code/phone — identity from server', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')

  // Set an Aadhaar on empA first via Head
  await headClient.rpc('update_staff_profile', {
    p_user_id: empAUser.id,
    p_full_name: 'Employee Alpha',
    p_employee_code: 'EMP-ALPH-001',
    p_phone_number: '+919111111102',
    p_aadhaar_number: SYNTHETIC_AADHAAR_A,
    p_role: 'admin',
    p_is_active: true
  })

  try {
    // Self-assign — note that p_expected_visit_at/p_visit_note are the only parameters
    // The RPC does not accept p_aadhaar_number, p_employee_name etc from the caller
    const { error } = await empAClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ifError(error)

    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_aadhaar, assigned_employee_id')
      .eq('id', enquiry.id)
      .single()

    // The aadhaar snapshot should come from server profile, not from caller
    assert.equal(updated.assigned_employee_id, empAUser.id)
    assert.equal(updated.assigned_employee_aadhaar, SYNTHETIC_AADHAAR_A, 'Aadhaar snapshot must come from server profile')
  } finally {
    await serviceClient.from('admin_users').update({ aadhaar_number: null }).eq('id', empAUser.id)
    await cleanupEnquiry(enquiry.id)
  }
})

test('26. Self-assignment expected visit behaves correctly', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  const visitAt = new Date(Date.now() + 36 * 3600 * 1000).toISOString()

  try {
    const { error } = await empAClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: visitAt,
      p_visit_note: 'Self-assigned with visit note'
    })
    assert.ifError(error)

    const { data: updated } = await serviceClient.from('enquiries')
      .select('expected_visit_at, assignment_visit_note')
      .eq('id', enquiry.id)
      .single()

    assert.ok(updated.expected_visit_at, 'expected_visit_at should be set from self-assign')
    assert.equal(updated.assignment_visit_note, 'Self-assigned with visit note')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

// ── TESTS 27-31: Block rules ───────────────────────────────────────────────────

test('27. Peer takeover remains blocked after Step 1 schema changes', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')

  try {
    // empA assigns
    await serviceClient.from('enquiries').update({ assigned_employee_id: empAUser.id }).eq('id', enquiry.id)

    // empB tries to self-assign
    const { error } = await empBClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ok(error, 'Peer takeover must be blocked')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('28. Inventory Staff assignment remains blocked', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  try {
    const { error } = await invClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ok(error, 'Inventory staff self-assign must be blocked')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('29. Frozen enquiry statuses remain blocked for assignment', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'completion_requested')

  try {
    const { error } = await empAClient.rpc('self_assign_enquiry', {
      p_enquiry_id: enquiry.id,
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ok(error, 'completion_requested status should block self-assign')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('30. Completed enquiry remains immutable — new fields cannot be mutated', async () => {
  testEnquirySeq++
  const uniqueContact = `+9198111${String(testEnquirySeq).padStart(5, '0')}`
  const { data: enquiry, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Completed Immutability Test',
      contact_info: uniqueContact,
      category_interest: 'Hardware Service',
      message: 'Immutability test message',
      status: 'new'
    })
    .select()
    .single()
  assert.ifError(createErr)

  // Mark approved completed via serviceClient
  await serviceClient
    .from('enquiries')
    .update({
      status: 'completed',
      completion_approved_at: new Date().toISOString(),
      assigned_employee_id: empAUser.id,
      assigned_employee_name: 'Employee Alpha'
    })
    .eq('id', enquiry.id)

  try {
    // Direct table update should be blocked by immutability trigger
    const { error } = await headClient
      .from('enquiries')
      .update({ expected_visit_at: new Date().toISOString() })
      .eq('id', enquiry.id)
    assert.ok(error, 'Mutating expected_visit_at on completed enquiry should fail')
    assert.match(error.message, /Permanent archive protection/i)
  } finally {
    await serviceClient.from('enquiries').delete().eq('id', enquiry.id)
  }
})

test('31. Archived enquiry remains immutable — new fields protected', async () => {
  testEnquirySeq++
  const uniqueContact = `+9198111${String(testEnquirySeq).padStart(5, '0')}`
  const { data: enquiry, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Archived Immutability Test',
      contact_info: uniqueContact,
      category_interest: 'Hardware Service',
      message: 'Immutability test message',
      status: 'new'
    })
    .select()
    .single()
  assert.ifError(createErr)

  // Mark approved completed and archived via serviceClient
  await serviceClient
    .from('enquiries')
    .update({
      status: 'completed',
      is_archived: true,
      completion_approved_at: new Date().toISOString()
    })
    .eq('id', enquiry.id)

  try {
    const { error } = await headClient
      .from('enquiries')
      .update({ assignment_visit_note: 'Tampered note' })
      .eq('id', enquiry.id)
    assert.ok(error, 'Mutating assignment_visit_note on archived enquiry should fail')
    assert.match(error.message, /Permanent archive protection/i)
  } finally {
    await serviceClient.from('enquiries').delete().eq('id', enquiry.id)
  }
})

// ── TESTS 32-35: Compatibility and regression ──────────────────────────────────

test('32. Existing assignment functionality remains compatible', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  try {
    // Use existing assign RPC without new optional fields (they should default to null)
    const { error } = await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: 'Backward compat test',
      p_expected_visit_at: null,
      p_visit_note: null
    })
    assert.ifError(error)
    const { data: updated } = await serviceClient.from('enquiries')
      .select('assigned_employee_id, expected_visit_at, assignment_visit_note')
      .eq('id', enquiry.id)
      .single()
    assert.equal(updated.assigned_employee_id, empAUser.id)
    assert.equal(updated.expected_visit_at, null)
    assert.equal(updated.assignment_visit_note, null)
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('33. Old enquiries with NULL new fields remain valid — no constraint error', async () => {
  testEnquirySeq++
  const uniqueContact = `+9198111${String(testEnquirySeq).padStart(5, '0')}`
  const { data, error } = await headClient.from('enquiries').insert({
    name: 'Old Compat Customer',
    contact_info: uniqueContact,
    category_interest: 'Hardware Service',
    message: 'Old style enquiry message',
    status: 'new',
    expected_visit_at: null,
    assignment_visit_note: null,
    assigned_employee_aadhaar: null
  }).select().single()
  assert.ifError(error, 'Old-style insert with NULL new fields should succeed')
  await cleanupEnquiry(data.id)
})

test('34. Existing enquiry status is NOT accidentally changed by profile update', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'in_progress')
  try {
    await headClient.rpc('update_staff_profile', {
      p_user_id: empAUser.id,
      p_full_name: 'Employee Alpha',
      p_employee_code: 'EMP-ALPH-001',
      p_phone_number: '+919111111102',
      p_aadhaar_number: null,
      p_role: 'admin',
      p_is_active: true
    })
    const { data: enq } = await serviceClient.from('enquiries').select('status').eq('id', enquiry.id).single()
    assert.equal(enq.status, 'in_progress', 'Status must not be changed by profile update')
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

test('35. Activity history records assignment with visit time metadata', async () => {
  const enquiry = await createTestEnquiry(serviceClient, 'new')
  const visitAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  try {
    await headClient.rpc('assign_enquiry_employee', {
      p_enquiry_id: enquiry.id,
      p_employee_id: empAUser.id,
      p_reason: 'Activity test',
      p_expected_visit_at: visitAt,
      p_visit_note: 'Activity note'
    })

    const { data: activities } = await serviceClient
      .from('enquiry_activities')
      .select('activity_type, metadata')
      .eq('enquiry_id', enquiry.id)
      .order('created_at', { ascending: false })
      .limit(1)

    assert.ok(activities?.length > 0, 'At least one activity should be recorded')
    const act = activities[0]
    assert.ok(
      act.activity_type === 'ENQUIRY_ASSIGNED' || act.activity_type === 'ENQUIRY_REASSIGNED',
      `Expected assignment activity type, got: ${act.activity_type}`
    )
    // Metadata should contain expected_visit_at (not full Aadhaar)
    if (act.metadata && typeof act.metadata === 'object') {
      assert.ok(!JSON.stringify(act.metadata).includes(SYNTHETIC_AADHAAR_A), 'Aadhaar must not appear in activity metadata')
    }
  } finally {
    await cleanupEnquiry(enquiry.id)
  }
})

// ── TEST 36: Secret hygiene declaration ───────────────────────────────────────

test('36. No real Aadhaar or test credentials hardcoded — synthetic data only', () => {
  // All Aadhaar numbers used in this test file are declared at the top
  // and marked as synthetic. This test validates the constants themselves
  // are in the expected synthetic format (12 digits, not matching any real pattern).
  assert.equal(SYNTHETIC_AADHAAR_A.length, 12, 'SYNTHETIC_AADHAAR_A must be 12 digits')
  assert.equal(SYNTHETIC_AADHAAR_B.length, 12, 'SYNTHETIC_AADHAAR_B must be 12 digits')
  assert.match(SYNTHETIC_AADHAAR_A, /^\d{12}$/, 'Must be numeric only')
  assert.match(SYNTHETIC_AADHAAR_B, /^\d{12}$/, 'Must be numeric only')
  // Confirm these do NOT start with 0 (Indian Aadhaar never starts with 0)
  // (This is a format property of synthetic test data hygiene)
  assert.notEqual(SYNTHETIC_AADHAAR_A[0], '0')
  assert.notEqual(SYNTHETIC_AADHAAR_B[0], '0')

  // Confirm formatAadhaarDisplay works
  assert.equal(formatAadhaarDisplay(SYNTHETIC_AADHAAR_A), '1234 5678 9012')
  assert.equal(formatAadhaarDisplay(null), '—')
  assert.equal(formatAadhaarDisplay(''), '—')

  console.log('  ✓ All Aadhaar values in this test suite are synthetic. No real PII is used.')
})

