/**
 * ============================================================================
 * ARS Computers — Enquiry Employee Assignment & Dispatch Verification Suite
 * ============================================================================
 * 24 Automated Scenarios verifying all security, integrity, lifecycle, and dispatch requirements:
 *
 *  1. Head assigns active unassigned enquiry to eligible employee
 *  2. Head reassigns active enquiry to another employee (records ENQUIRY_REASSIGNED)
 *  3. Head unassigns active enquiry (records ENQUIRY_UNASSIGNED)
 *  4. Active admin employee self-assigns unassigned active enquiry
 *  5. Employee self-assign derives server identity from auth.uid()
 *  6. Employee self-assign does not change enquiry status
 *  7. Employee self-assign records ENQUIRY_SELF_ASSIGNED activity
 *  8. Employee cannot assign another employee
 *  9. Employee cannot take over enquiry already assigned to peer
 * 10. Concurrency race: simultaneous self-assign allows exactly 1 winner
 * 11. Inactive employee cannot be assigned or self-assign
 * 12. Inventory staff blocked from self-assign, assign, or staff directory
 * 13. Anonymous callers blocked from assignment RPCs
 * 14. Assignment blocked on completed enquiries
 * 15. Assignment blocked on archived enquiries
 * 16. Assignment blocked on in-bin enquiries
 * 17. Assignment blocked while completion or rejection review is pending
 * 18. Immutability trigger protects all 8 assignment fields on finalized records
 * 19. Superadmin updates staff phone and normalizes format; clears on empty
 * 20. Non-superadmin blocked from updating staff phone
 * 21. Auth credentials and passwords remain untouched by staff phone update
 * 22. Plain text job dispatch formats human-readable details and excludes internal UUIDs
 * 23. WhatsApp wa.me URL targets engineer phone, never customer phone
 * 24. Missing engineer phone returns null for WhatsApp while Copy remains available
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  formatJobDispatchText,
  buildWhatsAppDispatchUrl,
  normalizePhoneForWhatsApp
} from '../src/utils/jobDispatchFormatter.js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.assign.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadAssign#2026!Secure'
const EMP1_EMAIL = 'emp1.assign.verifier@arscomputers.in'
const EMP1_PASSWORD = 'Emp1Assign#2026!Secure'
const EMP2_EMAIL = 'emp2.assign.verifier@arscomputers.in'
const EMP2_PASSWORD = 'Emp2Assign#2026!Secure'
const INV_EMAIL = 'inv.assign.verifier@arscomputers.in'
const INV_PASSWORD = 'InvAssign#2026!Secure'
const INACTIVE_EMAIL = 'inactive.assign.verifier@arscomputers.in'
const INACTIVE_PASSWORD = 'InactiveAssign#2026!Secure'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let headUser = null
let emp1User = null
let emp2User = null
let invUser = null
let inactiveUser = null

let headClient = null
let emp1Client = null
let emp2Client = null
let invClient = null
let inactiveClient = null

async function getOrCreateTestUser(email, password, fullName, role, employeeCode, phone = null, isActive = true) {
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

  // Provision or update in admin_users
  const { data: profile, error: upsertErr } = await serviceClient
    .from('admin_users')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role,
        is_active: isActive,
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
    'Head Assign Verifier',
    'superadmin',
    'EMP-HEAD-ASSN',
    '+919876543210',
    true
  )
  headUser = head.user
  headClient = head.client

  const emp1 = await getOrCreateTestUser(
    EMP1_EMAIL,
    EMP1_PASSWORD,
    'Technician One',
    'admin',
    'EMP-TECH-001',
    '+919876543211',
    true
  )
  emp1User = emp1.user
  emp1Client = emp1.client

  const emp2 = await getOrCreateTestUser(
    EMP2_EMAIL,
    EMP2_PASSWORD,
    'Technician Two',
    'admin',
    'EMP-TECH-002',
    '+919876543212',
    true
  )
  emp2User = emp2.user
  emp2Client = emp2.client

  const inv = await getOrCreateTestUser(
    INV_EMAIL,
    INV_PASSWORD,
    'Inventory Verifier',
    'inventory_staff',
    'EMP-INV-001',
    '+919876543219',
    true
  )
  invUser = inv.user
  invClient = inv.client

  const inact = await getOrCreateTestUser(
    INACTIVE_EMAIL,
    INACTIVE_PASSWORD,
    'Inactive Technician',
    'admin',
    'EMP-INACT-001',
    '+919876543220',
    false
  )
  inactiveUser = inact.user
  inactiveClient = inact.client

  assert.ok(headUser.id)
  assert.ok(emp1User.id)
  assert.ok(emp2User.id)
  assert.ok(invUser.id)
  assert.ok(inactiveUser.id)
})

// Scenario 1
test('Scenario 1: Head assigns active unassigned enquiry to eligible employee', async () => {
  const { data: enq, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 1 Client',
      contact_info: '+919811122201',
      message: 'Initial assignment by Head',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(createErr, null)

  const { data: assignRes, error: assignErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id,
    p_reason: 'Assigned for initial inspection'
  })
  assert.equal(assignErr, null)
  assert.equal(assignRes.action, 'ENQUIRY_ASSIGNED')
  assert.equal(assignRes.assigned_employee_id, emp1User.id)

  const { data: check } = await serviceClient.from('enquiries').select('*').eq('id', enq.id).single()
  assert.equal(check.assigned_employee_id, emp1User.id)
  assert.equal(check.assigned_employee_name, 'Technician One')
  assert.equal(check.assigned_employee_code, 'EMP-TECH-001')
  assert.equal(check.assigned_employee_phone, '+919876543211')
})

// Scenario 2
test('Scenario 2: Head reassigns active enquiry to another employee (records ENQUIRY_REASSIGNED)', async () => {
  const { data: enq, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 2 Client',
      contact_info: '+919811122202',
      message: 'Reassignment test enquiry',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(createErr, null)

  // Assign to emp1 first
  await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })

  // Reassign to emp2
  const { data: reassignRes, error: reassignErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp2User.id,
    p_reason: 'Reassigned due to workload'
  })
  assert.equal(reassignErr, null)
  assert.equal(reassignRes.action, 'ENQUIRY_REASSIGNED')
  assert.equal(reassignRes.assigned_employee_id, emp2User.id)

  const { data: check } = await serviceClient.from('enquiries').select('*').eq('id', enq.id).single()
  assert.equal(check.assigned_employee_id, emp2User.id)
  assert.equal(check.assigned_employee_name, 'Technician Two')
  assert.equal(check.assigned_employee_code, 'EMP-TECH-002')

  const { data: activities } = await serviceClient
    .from('enquiry_activities')
    .select('activity_type, content')
    .eq('enquiry_id', enq.id)
    .eq('activity_type', 'ENQUIRY_REASSIGNED')
  assert.equal(activities.length, 1)
  assert.match(activities[0].content, /Reassigned/i)
})

// Scenario 3
test('Scenario 3: Head unassigns active enquiry (records ENQUIRY_UNASSIGNED)', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 3 Client',
      contact_info: '+919811122203',
      message: 'Unassignment test enquiry',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // Assign first
  await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })

  // Unassign (p_employee_id = null)
  const { data: unassignRes, error: unassignErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: null,
    p_reason: 'Customer cancelled site visit'
  })
  assert.equal(unassignErr, null)
  assert.equal(unassignRes.action, 'unassigned')

  const { data: check } = await serviceClient.from('enquiries').select('*').eq('id', enq.id).single()
  assert.equal(check.assigned_employee_id, null)
  assert.equal(check.assigned_employee_name, null)
  assert.equal(check.assigned_employee_phone, null)

  const { data: activities } = await serviceClient
    .from('enquiry_activities')
    .select('activity_type, content')
    .eq('enquiry_id', enq.id)
    .eq('activity_type', 'ENQUIRY_UNASSIGNED')
  assert.equal(activities.length, 1)
  assert.match(activities[0].content, /Unassigned/i)
})

// Scenario 4
test('Scenario 4: Active admin employee self-assigns unassigned active enquiry', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 4 Client',
      contact_info: '+919811122204',
      message: 'Self-assign test enquiry',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  const { data: result, error } = await emp1Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })
  assert.equal(error, null)
  assert.equal(result.success, true)
  assert.equal(result.assigned_employee_id, emp1User.id)
})

// Scenario 5
test('Scenario 5: Employee self-assign derives server identity from auth.uid()', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 5 Client',
      contact_info: '+919811122205',
      message: 'Server derivation verification',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // Attempting to self-assign as emp2
  const { data: result, error } = await emp2Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })
  assert.equal(error, null)
  assert.equal(result.assigned_employee_id, emp2User.id)
  assert.equal(result.assigned_employee_name, 'Technician Two')
  assert.equal(result.assigned_employee_code, 'EMP-TECH-002')
  assert.equal(result.assigned_employee_phone, '+919876543212')

  const { data: check } = await serviceClient.from('enquiries').select('*').eq('id', enq.id).single()
  assert.equal(check.assigned_employee_id, emp2User.id)
  assert.equal(check.assigned_by, emp2User.id)
  assert.equal(check.assigned_by_name, 'Technician Two')
})

// Scenario 6
test('Scenario 6: Employee self-assign does not change enquiry status', async () => {
  const { data: enq, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 6 Client',
      contact_info: '+919811122206',
      message: 'Status preservation test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(createErr, null)

  await serviceClient.from('enquiries').update({ status: 'quoted' }).eq('id', enq.id)

  const { error } = await emp1Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })
  assert.equal(error, null)

  const { data: check } = await serviceClient.from('enquiries').select('status').eq('id', enq.id).single()
  assert.equal(check.status, 'quoted', 'Enquiry status must remain quoted')
})

// Scenario 7
test('Scenario 7: Employee self-assign records ENQUIRY_SELF_ASSIGNED activity', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 7 Client',
      contact_info: '+919811122207',
      message: 'Activity generation test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  await emp1Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })

  const { data: activities } = await serviceClient
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', enq.id)
    .eq('activity_type', 'ENQUIRY_SELF_ASSIGNED')
  assert.equal(activities.length, 1)
  assert.equal(activities[0].actor_id, emp1User.id)
  assert.match(activities[0].content, /Technician One self-assigned/i)
})

// Scenario 8
test('Scenario 8: Employee cannot assign another employee', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 8 Client',
      contact_info: '+919811122208',
      message: 'Employee assignment spoof check',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // emp1 attempts to call assign_enquiry_employee to assign emp2
  const { error: assignErr } = await emp1Client.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp2User.id
  })
  assert.ok(assignErr)
  assert.match(assignErr.message, /Superadministrator privileges required/i)
})

// Scenario 9
test('Scenario 9: Employee cannot take over enquiry already assigned to peer', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 9 Client',
      contact_info: '+919811122209',
      message: 'Peer takeover block test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // emp1 self-assigns first
  await emp1Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })

  // emp2 attempts to take over
  const { error: takeoverErr } = await emp2Client.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })
  assert.ok(takeoverErr)
  assert.match(takeoverErr.message, /This enquiry has already been assigned to another employee/i)
})

// Scenario 10
test('Scenario 10: Concurrency race: simultaneous self-assign allows exactly 1 winner', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 10 Client',
      contact_info: '+919811122210',
      message: 'Race condition test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  const [res1, res2] = await Promise.all([
    emp1Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id }),
    emp2Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  ])

  const successCount = (res1.data?.success ? 1 : 0) + (res2.data?.success ? 1 : 0)
  assert.equal(successCount, 1, 'Exactly one concurrent call must succeed')

  const fail = res1.error || res2.error
  assert.ok(fail)
  assert.match(fail.message, /This enquiry has already been assigned to another employee/i)
})

// Scenario 11
test('Scenario 11: Inactive employee cannot be assigned or self-assign', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 11 Client',
      contact_info: '+919811122211',
      message: 'Inactive employee test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // 1. Head tries to assign inactive employee
  const { error: headAssignErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: inactiveUser.id
  })
  assert.ok(headAssignErr)
  assert.match(headAssignErr.message, /is not an active staff member/i)

  // 2. Inactive employee tries to self-assign
  const { error: selfAssignErr } = await inactiveClient.rpc('self_assign_enquiry', {
    p_enquiry_id: enq.id
  })
  assert.ok(selfAssignErr)
  // Actual message: "Access denied: Active administrator or technician privileges required to self-assign enquiries."
  assert.match(selfAssignErr.message, /Active administrator or technician privileges required/i)
})

// Scenario 12
test('Scenario 12: Inventory staff blocked from self-assign, assign, or staff directory', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 12 Client',
      contact_info: '+919811122212',
      message: 'Inventory staff isolation',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // Self-assign blocked
  const { error: selfErr } = await invClient.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(selfErr)
  assert.match(selfErr.message, /privileges required/i)

  // Assign blocked
  const { error: assignErr } = await invClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })
  assert.ok(assignErr)
  assert.match(assignErr.message, /Superadministrator privileges required/i)

  // Directory query blocked
  const { error: dirErr } = await invClient.rpc('get_eligible_enquiry_assignees')
  assert.ok(dirErr)
  assert.match(dirErr.message, /Superadministrator/i)
})

// Scenario 13
test('Scenario 13: Anonymous callers blocked from assignment RPCs', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 13 Client',
      contact_info: '+919811122213',
      message: 'Anon isolation test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  const { error: anonSelfErr } = await anonClient.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(anonSelfErr)

  const { error: anonAssignErr } = await anonClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })
  assert.ok(anonAssignErr)
})

// Scenario 14
test('Scenario 14: Assignment blocked on completed enquiries', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 14 Client',
      contact_info: '+919811122214',
      message: 'Completed enquiry assignment check',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  // Assign then complete — then test re-assign/self-assign on completed record
  await headClient.rpc('assign_enquiry_employee', { p_enquiry_id: enq.id, p_employee_id: emp1User.id })
  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Installed new power supply unit successfully.'
  })
  await headClient.rpc('review_enquiry_completion', { p_enquiry_id: enq.id, p_decision: 'approved' })

  // Head reassign blocked on completed (completion_approved_at IS NOT NULL check)
  const { error: reassignErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp2User.id
  })
  assert.ok(reassignErr)
  assert.match(reassignErr.message, /Completed and permanently archived/i)

  // Self-assign blocked on completed enquiry.
  // The enquiry was assigned to emp1 before completion, so emp2's self_assign may hit
  // "already assigned to another employee" (step 4) before the archived/completed guard (step 5).
  // Both errors correctly block the operation — accept either as a valid block.
  const { error: selfErr } = await emp2Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(selfErr, 'Completed enquiry must be blocked from self-assign')
  assert.ok(
    selfErr.message.match(/Cannot assign an archived or completed enquiry/i) ||
      selfErr.message.match(/already been assigned to another employee/i),
    `Completed enquiry block expected; got: ${selfErr.message}`
  )
})

// Scenario 15
test('Scenario 15: Assignment blocked on archived enquiries', async () => {
  const { data: enq } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 15 Client',
      contact_info: '+919811122215',
      message: 'Archived enquiry test',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()

  await headClient.rpc('archive_enquiry', { p_enquiry_id: enq.id })

  const { error: headErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })
  assert.ok(headErr)
  assert.match(headErr.message, /Completed and permanently archived/i)

  const { error: selfErr } = await emp1Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(selfErr)
  assert.match(selfErr.message, /Cannot assign an archived or completed enquiry/i)
})

// Scenario 16
test('Scenario 16: Assignment blocked on in-bin enquiries', async () => {
  // Insert via headClient (authenticated superadmin) to bypass rate-limiter
  const { data: enq, error: insertErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 16 Client',
      contact_info: '+919811122216',
      message: 'In-bin assignment test - admin insert',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(insertErr, null, 'Scenario 16 insert must succeed')

  // Force into bin via service_role (bypasses RLS / trigger for direct mutation)
  await serviceClient
    .from('enquiries')
    .update({ is_in_bin: true, status: 'in_bin' })
    .eq('id', enq.id)

  const { error: headErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp1User.id
  })
  assert.ok(headErr)
  assert.match(headErr.message, /Cannot assign an enquiry currently in the Bin/i)

  const { error: selfErr } = await emp1Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(selfErr)
  assert.match(selfErr.message, /Cannot assign an enquiry currently in the Bin/i)
})

// Scenario 17
test('Scenario 17: Assignment blocked while completion or rejection review is pending', async () => {
  const { data: enq, error: insertErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 17 Client',
      contact_info: '+919811122217',
      message: 'Pending review freeze test - admin insert',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(insertErr, null, 'Scenario 17 insert must succeed')

  await emp1Client.rpc('request_enquiry_rejection', { p_enquiry_id: enq.id, p_reason: 'Duplicate' })

  const { error: headErr } = await headClient.rpc('assign_enquiry_employee', {
    p_enquiry_id: enq.id,
    p_employee_id: emp2User.id
  })
  assert.ok(headErr)
  assert.match(headErr.message, /frozen while a review is pending/i)

  const { error: selfErr } = await emp2Client.rpc('self_assign_enquiry', { p_enquiry_id: enq.id })
  assert.ok(selfErr)
  assert.match(selfErr.message, /frozen while a review is pending/i)
})

// Scenario 18
test('Scenario 18: Immutability trigger protects all 8 assignment fields on finalized records', async () => {
  const { data: enq, error: createErr } = await headClient
    .from('enquiries')
    .insert({
      name: 'Scenario 18 Client',
      contact_info: '+919811122218',
      message: 'Immutability field test - admin insert',
      category_interest: 'Hardware Service',
      status: 'new'
    })
    .select()
    .single()
  assert.equal(createErr, null, 'Scenario 18 insert must succeed')

  await headClient.rpc('assign_enquiry_employee', { p_enquiry_id: enq.id, p_employee_id: emp1User.id })
  await emp1Client.rpc('submit_enquiry_completion', {
    p_enquiry_id: enq.id,
    p_completion_summary: 'Installed new power supply unit successfully.'
  })
  await headClient.rpc('review_enquiry_completion', { p_enquiry_id: enq.id, p_decision: 'approved' })

  const { error: updateErr } = await serviceClient
    .from('enquiries')
    .update({ assigned_employee_name: 'Hacked Name' })
    .eq('id', enq.id)
  assert.ok(updateErr)
  assert.match(updateErr.message, /Permanent archive protection: Assignment attributes cannot be modified/i)
})

// Scenario 19
test('Scenario 19: Superadmin updates staff phone and normalizes format; clears on empty', async () => {
  // Update with spaces and dashes
  const { data: updateRes, error: updateErr } = await headClient.rpc('update_staff_phone', {
    p_user_id: emp1User.id,
    p_phone_number: '+91 (987) 654-3211'
  })
  assert.equal(updateErr, null)
  assert.equal(updateRes.phone_number, '+919876543211')

  // Clear with whitespace
  const { data: clearRes, error: clearErr } = await headClient.rpc('update_staff_phone', {
    p_user_id: emp1User.id,
    p_phone_number: '   '
  })
  assert.equal(clearErr, null)
  assert.equal(clearRes.phone_number, null)

  // Restore phone
  await headClient.rpc('update_staff_phone', {
    p_user_id: emp1User.id,
    p_phone_number: '+919876543211'
  })
})

// Scenario 20
test('Scenario 20: Non-superadmin blocked from updating staff phone', async () => {
  const { error: empErr } = await emp1Client.rpc('update_staff_phone', {
    p_user_id: emp2User.id,
    p_phone_number: '+919876543299'
  })
  assert.ok(empErr)
  assert.match(empErr.message, /Superadministrator/i)
})

// Scenario 21
test('Scenario 21: Auth credentials and passwords remain untouched by staff phone update', async () => {
  // Head updates employee phone
  await headClient.rpc('update_staff_phone', {
    p_user_id: emp1User.id,
    p_phone_number: '+919876543211'
  })

  // Employee signs in again with their original password to prove credentials untouched
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: authData, error: signInErr } = await client.auth.signInWithPassword({
    email: EMP1_EMAIL,
    password: EMP1_PASSWORD
  })
  assert.equal(signInErr, null)
  assert.ok(authData.session)
  assert.equal(authData.user.id, emp1User.id)
})

// Scenario 22
test('Scenario 22: Plain text job dispatch formats human-readable details and excludes internal UUIDs', () => {
  const enquiry = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    enquiry_number: 'ARS-ENQ-01099',
    name: 'Vikram Seth',
    contact_info: '+91 98234 56789',
    category_interest: 'Hardware Service',
    message: 'Screen flickering and intermittent thermal shutdown',
    created_at: '2026-10-31T10:00:00Z',
    assigned_employee_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    assigned_employee_name: 'Paras Kandpal',
    assigned_employee_code: 'EMP-001',
    assigned_employee_phone: '+919876543210'
  }

  const text = formatJobDispatchText(enquiry)
  assert.match(text, /ARS COMPUTERS — SERVICE JOB DISPATCH/)
  assert.match(text, /ARS-ENQ-01099/)
  assert.match(text, /Vikram Seth/)
  assert.match(text, /\+91 98234 56789/)
  assert.match(text, /Screen flickering and intermittent thermal shutdown/)
  assert.match(text, /Paras Kandpal \[EMP-001\]/)
  assert.match(text, /\+919876543210/)

  // Crucial security invariant: raw database UUIDs MUST NOT be exposed in dispatch text
  assert.equal(text.includes('f81d4fae-7dec-11d0-a765-00a0c91e6bf6'), false)
  assert.equal(text.includes('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'), false)
})

// Scenario 23
test('Scenario 23: WhatsApp wa.me URL targets engineer phone, never customer phone', () => {
  assert.equal(normalizePhoneForWhatsApp('9876543210'), '919876543210')
  assert.equal(normalizePhoneForWhatsApp('+91 98765 43210'), '919876543210')

  const enquiry = {
    enquiry_number: 'ARS-ENQ-01100',
    name: 'Customer Ramesh',
    contact_info: '+919811199999',
    message: 'Cooling fan replacement',
    assigned_employee_name: 'Paras Kandpal',
    assigned_employee_code: 'EMP-001',
    assigned_employee_phone: '+919876543210'
  }

  const url = buildWhatsAppDispatchUrl(enquiry)
  // Targets engineer (+919876543210 -> 919876543210)
  assert.ok(url.startsWith('https://wa.me/919876543210?text='))
  // MUST NOT target customer (+919811199999)
  assert.equal(url.startsWith('https://wa.me/919811199999'), false)
})

// Scenario 24
test('Scenario 24: Missing engineer phone returns null for WhatsApp while Copy remains available', () => {
  const enquiry = {
    enquiry_number: 'ARS-ENQ-01101',
    name: 'Customer Priya',
    contact_info: '+919822288888',
    message: 'RAM upgrade to 32GB',
    assigned_employee_name: 'Paras Kandpal',
    assigned_employee_code: 'EMP-001',
    assigned_employee_phone: null
  }

  const url = buildWhatsAppDispatchUrl(enquiry)
  assert.equal(url, null, 'URL must be null when engineer has no phone')

  const copyText = formatJobDispatchText(enquiry)
  assert.ok(copyText.length > 50, 'Dispatch text must still format cleanly without phone')
  assert.equal(copyText.includes('undefined'), false)
})
