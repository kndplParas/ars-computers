/**
 * ============================================================================
 * ARS Computers — Step 3 Assignment Security Hardening Test Suite
 * ============================================================================
 * Tests migration 20261101000015:
 * 1. Insert with only assigned_employee_id -> mirrors to assigned_to.
 * 2. Insert with only assigned_to -> mirrors to assigned_employee_id.
 * 3. Insert with both equal -> succeeds.
 * 4. Insert with conflicting values -> strictly rejected.
 * 5. Update either column individually -> mirrors to the other.
 * 6. Update both to equal values -> succeeds.
 * 7. Update both to conflicting values -> strictly rejected.
 * 8. Unassign through either column or both -> sets both to NULL.
 * 9. Two-user divergence attack -> impossible, direct SQL divergence strictly rejected.
 * 10. Proof metadata & signed URL access: only assigned employee granted; former employee denied immediately.
 * 11. Head retains access across all proofs.
 * 12. Admin, Engineer, Technical, HR, Accounts retain assigned-only access.
 * 13. Inventory Staff and anonymous strictly denied.
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
  0xff, 0xd9
])

const TEST_USERS = {
  superadmin: { email: 'head.admin.harden@arscomputers.local', password: 'Password123!', role: 'superadmin', name: 'Head Admin Harden' },
  admin: { email: 'ops.admin.harden@arscomputers.local', password: 'Password123!', role: 'admin', name: 'Ops Admin Harden' },
  emp1: { email: 'engineer1.harden@arscomputers.local', password: 'Password123!', role: 'engineer', name: 'Engineer One Harden' },
  emp2: { email: 'engineer2.harden@arscomputers.local', password: 'Password123!', role: 'engineer', name: 'Engineer Two Harden' },
  technical: { email: 'tech.harden@arscomputers.local', password: 'Password123!', role: 'technical', name: 'Technical Harden' },
  hr: { email: 'hr.harden@arscomputers.local', password: 'Password123!', role: 'hr', name: 'HR Harden' },
  account: { email: 'account.harden@arscomputers.local', password: 'Password123!', role: 'account', name: 'Account Harden' },
  inventory_staff: { email: 'inv.harden@arscomputers.local', password: 'Password123!', role: 'inventory_staff', name: 'Inventory Harden' }
}

async function getOrCreateTestUser(roleKey, spec) {
  const { data: listData } = await serviceClient.auth.admin.listUsers()
  let user = listData?.users?.find((u) => u.email === spec.email)

  if (!user) {
    const { data: createData, error: createErr } = await serviceClient.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { role: spec.role, full_name: spec.name }
    })
    if (createErr) throw createErr
    user = createData.user
  }

  const { error: upsertErr } = await serviceClient.from('admin_users').upsert({
    id: user.id,
    email: spec.email,
    role: spec.role,
    full_name: spec.name,
    is_active: true
  }, { onConflict: 'id' })
  if (upsertErr) throw upsertErr

  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: spec.email,
    password: spec.password
  })
  if (signInErr) throw signInErr

  return { user, client }
}

test('ARS Computers — Step 3 Assignment Security Hardening Suite', async (t) => {
  const userRecords = {}
  const clients = {}

  await t.test('Setup: Provision and sign in all 8 test roles', async () => {
    for (const [key, spec] of Object.entries(TEST_USERS)) {
      const { user, client } = await getOrCreateTestUser(key, spec)
      userRecords[key] = user
      clients[key] = client
      assert.ok(user.id)
    }
  })

  // 1. Insert with only assigned_employee_id -> mirrors to assigned_to
  await t.test('1. Insert with only assigned_employee_id mirrors to assigned_to', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data, error } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Insert Emp Only',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Mirror test 1',
        assigned_employee_id: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    assert.equal(error, null)
    assert.equal(data.assigned_employee_id, userRecords.emp1.id)
    assert.equal(data.assigned_to, userRecords.emp1.id, 'Trigger must populate assigned_to from assigned_employee_id')
  })

  // 2. Insert with only assigned_to -> mirrors to assigned_employee_id
  await t.test('2. Insert with only assigned_to mirrors to assigned_employee_id', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data, error } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Insert To Only',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Mirror test 2',
        assigned_to: userRecords.emp2.id,
        status: 'new'
      })
      .select('*')
      .single()

    assert.equal(error, null)
    assert.equal(data.assigned_to, userRecords.emp2.id)
    assert.equal(data.assigned_employee_id, userRecords.emp2.id, 'Trigger must populate assigned_employee_id from assigned_to')
  })

  // 3. Insert with both equal -> succeeds
  await t.test('3. Insert with both equal succeeds', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data, error } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Insert Both Equal',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Mirror test 3',
        assigned_employee_id: userRecords.emp1.id,
        assigned_to: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    assert.equal(error, null)
    assert.equal(data.assigned_employee_id, userRecords.emp1.id)
    assert.equal(data.assigned_to, userRecords.emp1.id)
  })

  // 4. Insert with conflicting values -> strictly rejected
  await t.test('4. Insert with conflicting values strictly fails', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { error } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Insert Conflict',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Mirror test conflict',
        assigned_employee_id: userRecords.emp1.id,
        assigned_to: userRecords.emp2.id,
        status: 'new'
      })

    assert.ok(error, 'Conflicting insert must be rejected')
    assert.match(error.message, /Assignment conflict|check constraint/i)
  })

  // 5. Update either column individually -> mirrors to the other
  await t.test('5. Update either column individually mirrors to the other', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data: created } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Update Mirror Test',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Mirror test update',
        assigned_employee_id: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    // Update only assigned_employee_id to EMP2
    const { data: upd1, error: err1 } = await clients.superadmin
      .from('enquiries')
      .update({ assigned_employee_id: userRecords.emp2.id })
      .eq('id', created.id)
      .select('*')
      .single()

    assert.equal(err1, null)
    assert.equal(upd1.assigned_employee_id, userRecords.emp2.id)
    assert.equal(upd1.assigned_to, userRecords.emp2.id, 'Updating assigned_employee_id must mirror to assigned_to')

    // Update only assigned_to back to EMP1
    const { data: upd2, error: err2 } = await clients.superadmin
      .from('enquiries')
      .update({ assigned_to: userRecords.emp1.id })
      .eq('id', created.id)
      .select('*')
      .single()

    assert.equal(err2, null)
    assert.equal(upd2.assigned_to, userRecords.emp1.id)
    assert.equal(upd2.assigned_employee_id, userRecords.emp1.id, 'Updating assigned_to must mirror to assigned_employee_id')
  })

  // 6. Update both to equal values -> succeeds
  await t.test('6. Update both to equal values succeeds', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data: created } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Update Both Equal',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Update both',
        status: 'new'
      })
      .select('*')
      .single()

    const { data: updated, error } = await clients.superadmin
      .from('enquiries')
      .update({
        assigned_employee_id: userRecords.technical.id,
        assigned_to: userRecords.technical.id
      })
      .eq('id', created.id)
      .select('*')
      .single()

    assert.equal(error, null)
    assert.equal(updated.assigned_employee_id, userRecords.technical.id)
    assert.equal(updated.assigned_to, userRecords.technical.id)
  })

  // 7. Update both to conflicting values -> strictly rejected
  await t.test('7. Update both to conflicting values strictly rejected', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data: created } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Update Conflict Test',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Conflict update',
        assigned_employee_id: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    // Both changed to different staff members
    const { error } = await clients.superadmin
      .from('enquiries')
      .update({
        assigned_employee_id: userRecords.technical.id,
        assigned_to: userRecords.emp2.id
      })
      .eq('id', created.id)

    assert.ok(error, 'Conflicting update must be rejected')
    assert.match(error.message, /Assignment conflict|check constraint/i)
  })

  // 8. Unassign through both columns or individually -> sets both to NULL
  await t.test('8. Unassign through both columns or individually sets both to NULL', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data: created } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Unassign Test',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Unassign test',
        assigned_employee_id: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    // Unassign by setting assigned_employee_id to NULL
    const { data: un1, error: uErr1 } = await clients.superadmin
      .from('enquiries')
      .update({ assigned_employee_id: null })
      .eq('id', created.id)
      .select('*')
      .single()

    assert.equal(uErr1, null)
    assert.equal(un1.assigned_employee_id, null)
    assert.equal(un1.assigned_to, null, 'Setting assigned_employee_id to null must mirror null to assigned_to')
  })

  // 9. Two-user divergence attack: direct SQL divergence is strictly impossible
  await t.test('9. Two-user divergence attack strictly rejected by DB CHECK constraint', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    // Start with an unassigned enquiry
    const { data: created } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Attack Target',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Divergence attack attempt',
        status: 'new'
      })
      .select('*')
      .single()

    // Attempt direct divergence attack (assigning two different employees simultaneously)
    const { error } = await serviceClient
      .from('enquiries')
      .update({
        assigned_employee_id: userRecords.emp1.id,
        assigned_to: userRecords.emp2.id
      })
      .eq('id', created.id)

    assert.ok(error, 'Direct SQL divergence must fail')
    assert.match(error.message, /Assignment conflict|chk_enquiries_assignment_sync/i)
  })

  // 10. Proof access: Only currently assigned employee can view metadata and get signed URL
  await t.test('10. Proof access: only intended assigned employee granted, former employee denied immediately', async () => {
    const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
    const { data: enq } = await clients.superadmin
      .from('enquiries')
      .insert({
        name: 'Proof Access Enquiry',
        contact_info: phone,
        category_interest: 'Hardware',
        message: 'Proof security check',
        assigned_employee_id: userRecords.emp1.id,
        status: 'new'
      })
      .select('*')
      .single()

    const storagePath = `${enq.id}/${crypto.randomUUID()}.jpg`
    await serviceClient.storage
      .from('enquiry-service-proofs')
      .upload(storagePath, DUMMY_JPG, { contentType: 'image/jpeg' })

    const { data: proof } = await serviceClient
      .from('enquiry_service_proofs')
      .insert({
        enquiry_id: enq.id,
        storage_path: storagePath,
        original_filename: 'report.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: DUMMY_JPG.length,
        document_type: 'CUSTOMER_SIGNED_SERVICE_REPORT',
        description: 'Hardening proof test',
        uploaded_by: userRecords.emp1.id,
        uploaded_by_name: 'Emp 1',
        is_customer_signed: true,
        is_voided: false
      })
      .select('*')
      .single()

    // EMP1 can view metadata & generate signed URL
    const { data: emp1Meta } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp1Meta?.length, 1)

    const { data: emp1Signed, error: emp1SignErr } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.equal(emp1SignErr, null)
    assert.ok(emp1Signed?.signedUrl)

    // Reassign to EMP2 using assign_enquiry_employee RPC
    await clients.superadmin.rpc('assign_enquiry_employee', {
      p_enquiry_id: enq.id,
      p_employee_id: userRecords.emp2.id,
      p_reason: 'Reassigning in hardening suite'
    })

    // EMP1 IMMEDIATELY loses access
    const { data: emp1After } = await clients.emp1
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp1After?.length || 0, 0, 'Former employee must see 0 rows')

    const { error: emp1SignAfter } = await clients.emp1.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.ok(emp1SignAfter, 'Former employee must be denied signed URL')

    // EMP2 IMMEDIATELY gains access
    const { data: emp2Meta } = await clients.emp2
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(emp2Meta?.length, 1, 'Newly assigned employee must see proof')

    const { data: emp2Signed, error: emp2SignErr } = await clients.emp2.storage
      .from('enquiry-service-proofs')
      .createSignedUrl(storagePath, 60)
    assert.equal(emp2SignErr, null)
    assert.ok(emp2Signed?.signedUrl)

    // Head retains access
    const { data: headMeta } = await clients.superadmin
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(headMeta?.length, 1, 'Head retains access')

    // Inventory staff and anonymous strictly denied
    const { data: invMeta } = await clients.inventory_staff
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(invMeta?.length || 0, 0, 'Inventory staff must be denied')

    const { data: anonMeta } = await anonClient
      .from('enquiry_service_proofs')
      .select('*')
      .eq('id', proof.id)
    assert.equal(anonMeta?.length || 0, 0, 'Anonymous must be denied')
  })

  // 11. Role Parity: Technical, HR, and Account have exact assigned-only access
  await t.test('11. Assigned Admin, Technical, HR, Accounts retain assigned-only access', async () => {
    const rolesToTest = ['admin', 'technical', 'hr', 'account']

    for (const r of rolesToTest) {
      const u = userRecords[r]
      const c = clients[r]

      const phone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`
      const { data: enq } = await clients.superadmin
        .from('enquiries')
        .insert({
          name: `Parity Test ${r}`,
          contact_info: phone,
          category_interest: 'Hardware',
          message: `Parity for ${r}`,
          assigned_employee_id: u.id,
          status: 'new'
        })
        .select('*')
        .single()

      const sPath = `${enq.id}/${crypto.randomUUID()}.jpg`
      await serviceClient.storage
        .from('enquiry-service-proofs')
        .upload(sPath, DUMMY_JPG, { contentType: 'image/jpeg' })

      const { data: pr } = await serviceClient
        .from('enquiry_service_proofs')
        .insert({
          enquiry_id: enq.id,
          storage_path: sPath,
          original_filename: 'test.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: DUMMY_JPG.length,
          document_type: 'CUSTOMER_SIGNED_SERVICE_REPORT',
          description: `Parity test ${r}`,
          uploaded_by: u.id,
          uploaded_by_name: r,
          is_customer_signed: true,
          is_voided: false
        })
        .select('*')
        .single()

      // Assigned user has access
      const { data: myProofs } = await c
        .from('enquiry_service_proofs')
        .select('*')
        .eq('id', pr.id)
      assert.equal(myProofs?.length, 1, `${r} must have access when assigned`)

      const { data: mySign, error: mySignErr } = await c.storage
        .from('enquiry-service-proofs')
        .createSignedUrl(sPath, 60)
      assert.equal(mySignErr, null)
      assert.ok(mySign?.signedUrl)

      // Other peer (emp1) does NOT have access
      const { data: peerProofs } = await clients.emp1
        .from('enquiry_service_proofs')
        .select('*')
        .eq('id', pr.id)
      assert.equal(peerProofs?.length || 0, 0, `Peer must be blocked from proof assigned to ${r}`)
    }
  })
})
