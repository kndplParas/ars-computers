/**
 * ARS Computers — Step 7 Real Isolated Database Verification
 * Executes directly against the local isolated Supabase instance (http://127.0.0.1:54321).
 * Tests all 7 roles against RLS policies, RPC authorization, and business rules.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
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

const ROLES = [
  { role: 'superadmin', email: 'test.superadmin@ars.local', name: 'Superadmin Head' },
  { role: 'admin', email: 'test.admin@ars.local', name: 'Admin Operations' },
  { role: 'technical', email: 'test.technical@ars.local', name: 'Technical Specialist' },
  { role: 'engineer', email: 'test.engineer@ars.local', name: 'Field Engineer' },
  { role: 'hr', email: 'test.hr@ars.local', name: 'HR Manager' },
  { role: 'account', email: 'test.account@ars.local', name: 'Accounts Officer' },
  { role: 'inventory_staff', email: 'test.inventory@ars.local', name: 'Inventory Manager' }
]

const PASSWORD = 'TestRole#2026!Password'
const roleClients = {}
const roleUsers = {}

test('ARS Computers — Step 7 Isolated Database Live Verification', async (suite) => {
  await suite.test('Setup: Provision 7 role accounts and authenticate clients', async () => {
    for (const r of ROLES) {
      // 1. Create/Ensure Auth user
      const { data: userList } = await serviceClient.auth.admin.listUsers()
      let existing = userList?.users?.find((u) => u.email === r.email)

      if (!existing) {
        const { data: created, error } = await serviceClient.auth.admin.createUser({
          email: r.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: r.name }
        })
        assert.ok(!error, `Failed to create auth user for ${r.role}: ${error?.message}`)
        existing = created.user
      } else {
        await serviceClient.auth.admin.updateUserById(existing.id, {
          password: PASSWORD,
          email_confirm: true
        })
      }

      roleUsers[r.role] = existing

      // 2. Ensure public.admin_users record with exact role
      const { error: upsertErr } = await serviceClient.from('admin_users').upsert({
        id: existing.id,
        email: r.email,
        role: r.role,
        full_name: r.name,
        employee_code: `ARS-${r.role.toUpperCase().slice(0, 4)}-01`,
        is_active: true
      })
      assert.ok(!upsertErr, `Failed to upsert admin_users for ${r.role}: ${upsertErr?.message}`)

      // 3. Authenticate dedicated Supabase client for this role
      const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      const { data: session, error: loginErr } = await client.auth.signInWithPassword({
        email: r.email,
        password: PASSWORD
      })
      assert.ok(!loginErr, `Failed to log in as ${r.role}: ${loginErr?.message}`)
      assert.ok(session?.session?.access_token, `Missing token for ${r.role}`)

      roleClients[r.role] = client
    }
  })

  let currentMonthEnquiryId = null
  let previousMonthEnquiryId = null
  let futureEnquiryId = null
  let completedEnquiryId = null

  await suite.test('Setup: Seed test enquiries in isolated database', async () => {
    const now = new Date()
    const currentMonthIso = now.toISOString()

    // 1. Current month active enquiry (eligible)
    const { data: enq1, error: err1 } = await serviceClient
      .from('enquiries')
      .insert({
        name: 'Spam Submitter Bot',
        contact_info: '+919999900001',
        message: 'Cheap SEO backlinks service',
        category_interest: 'General Hardware',
        status: 'new',
        created_at: currentMonthIso
      })
      .select()
      .single()
    assert.ok(!err1, `Failed to seed current month enquiry: ${err1?.message}`)
    currentMonthEnquiryId = enq1.id

    // 2. Previous month enquiry (locked historical month)
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0)
    const { data: enq2, error: err2 } = await serviceClient
      .from('enquiries')
      .insert({
        name: 'Old Historical Enquiry',
        contact_info: '+919999900002',
        message: 'Old enquiry from last month',
        category_interest: 'Networking',
        status: 'new',
        created_at: prevMonth.toISOString()
      })
      .select()
      .single()
    assert.ok(!err2, `Failed to seed previous month enquiry: ${err2?.message}`)
    previousMonthEnquiryId = enq2.id

    // 3. Future-dated enquiry
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 12, 0, 0)
    const { data: enq3, error: err3 } = await serviceClient
      .from('enquiries')
      .insert({
        name: 'Future Bot Enquiry',
        contact_info: '+919999900003',
        message: 'Future timestamp test',
        category_interest: 'CCTV Systems',
        status: 'new',
        created_at: futureDate.toISOString()
      })
      .select()
      .single()
    assert.ok(!err3, `Failed to seed future enquiry: ${err3?.message}`)
    futureEnquiryId = enq3.id

    // 4. Completed & approved genuine enquiry
    const { data: enq4, error: err4 } = await serviceClient
      .from('enquiries')
      .insert({
        name: 'Genuine Ramesh Kumar',
        contact_info: '+919814099999',
        message: 'Motherboard repair done and approved',
        category_interest: 'Laptop Repair',
        status: 'new',
        created_at: currentMonthIso
      })
      .select()
      .single()
    assert.ok(!err4, `Failed to seed completed enquiry: ${err4?.message}`)
    completedEnquiryId = enq4.id

    // Transition to completed & approved
    const { error: updErr } = await serviceClient
      .from('enquiries')
      .update({
        status: 'completed',
        completion_requested_at: currentMonthIso,
        completion_approved_at: currentMonthIso,
        completion_approved_by: roleUsers.superadmin.id
      })
      .eq('id', completedEnquiryId)
    assert.ok(!updErr, `Failed to approve completed enquiry: ${updErr?.message}`)
  })

  await suite.test('Verification: Non-superadmin roles are strictly denied remove_current_month_enquiry', async () => {
    const nonHeadRoles = ['admin', 'technical', 'engineer', 'hr', 'account', 'inventory_staff']
    for (const r of nonHeadRoles) {
      const client = roleClients[r]
      const { data, error } = await client.rpc('remove_current_month_enquiry', {
        p_enquiry_id: currentMonthEnquiryId,
        p_category: 'spam',
        p_reason: `Attempted removal by role ${r}`
      })
      assert.ok(error, `Role ${r} should have been rejected by RPC! Received data: ${JSON.stringify(data)}`)
      assert.match(
        error.message,
        /Access denied: Only Superadministrator can remove fake, spam, or invalid enquiries/,
        `Role ${r} error message must clearly indicate Superadmin restriction`
      )
    }

    // Anonymous client must also be denied
    const { error: anonErr } = await anonClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'spam',
      p_reason: 'Anonymous attempt'
    })
    assert.ok(anonErr, 'Anonymous user must be rejected')
  })

  await suite.test('Verification: Business rule validations enforced by PostgreSQL engine', async () => {
    const superClient = roleClients.superadmin

    // 1. Previous calendar month enquiry cannot be removed
    const { error: prevMonthErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: previousMonthEnquiryId,
      p_category: 'spam',
      p_reason: 'Testing historical month block'
    })
    assert.ok(prevMonthErr, 'Previous month enquiry removal must fail')
    assert.match(
      prevMonthErr.message,
      /Historical lock violation/,
      'Must raise Historical lock violation for prior months'
    )

    // 2. Future-dated enquiry cannot be removed
    const { error: futureErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: futureEnquiryId,
      p_category: 'spam',
      p_reason: 'Testing future dated block'
    })
    assert.ok(futureErr, 'Future-dated enquiry removal must fail')
    assert.match(
      futureErr.message,
      /Future-dated enquiries cannot be processed/,
      'Must reject future-dated enquiries'
    )

    // 3. Completed and approved enquiry cannot be removed
    const { error: completedErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: completedEnquiryId,
      p_category: 'spam',
      p_reason: 'Testing completed protection'
    })
    assert.ok(completedErr, 'Completed and approved enquiry removal must fail')
    assert.match(
      completedErr.message,
      /Completed and approved enquiries cannot be removed/,
      'Must reject removal of completed genuine enquiry'
    )

    // 4. Invalid category rejected
    const { error: badCatErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'invalid_category_xyz',
      p_reason: 'Reason with sufficient characters'
    })
    assert.ok(badCatErr, 'Invalid category must fail')
    assert.match(badCatErr.message, /Removal category must be one of/)

    // 5. Short reason (< 3 chars) rejected
    const { error: shortReasonErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'spam',
      p_reason: 'ab'
    })
    assert.ok(shortReasonErr, 'Short reason must fail')
    assert.match(shortReasonErr.message, /minimum 3 characters/)

    // 6. Category "other" requires >= 5 chars and non-trivial reason
    const { error: trivialOtherErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'other',
      p_reason: 'other'
    })
    assert.ok(trivialOtherErr, 'Trivial explanation for Other category must fail')
    assert.match(trivialOtherErr.message, /Detailed explanation required for "Other" category/)
  })

  await suite.test('Verification: Superadmin successfully soft-removes current-month enquiry', async () => {
    const superClient = roleClients.superadmin
    const { data, error } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'spam',
      p_reason: 'Automated spam backlinks bot form submission'
    })
    assert.ok(!error, `Failed to remove current month enquiry: ${error?.message}`)
    assert.equal(data.success, true)
    assert.equal(data.is_removed, true)
    assert.equal(data.removal_category, 'spam')

    // Second removal attempt must fail as conflict
    const { error: duplicateErr } = await superClient.rpc('remove_current_month_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_category: 'spam',
      p_reason: 'Duplicate removal attempt'
    })
    assert.ok(duplicateErr, 'Duplicate removal must fail')
    assert.match(duplicateErr.message, /already marked as removed/)

    // Audit trail in enquiry_activities verified
    const { data: activities, error: actErr } = await serviceClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', currentMonthEnquiryId)
      .eq('activity_type', 'removed')
    assert.ok(!actErr, `Failed to fetch activities: ${actErr?.message}`)
    assert.equal(activities.length, 1, 'Exactly one removal activity logged')
    assert.equal(activities[0].metadata.action, 'soft_remove')
    assert.equal(activities[0].metadata.removal_category, 'spam')
  })

  await suite.test('Verification: SELECT RLS policy strictly hides removed enquiry from non-superadmin', async () => {
    // 1. Superadmin can SELECT the removed enquiry
    const superClient = roleClients.superadmin
    const { data: superData, error: superErr } = await superClient
      .from('enquiries')
      .select('id, name, is_removed, removal_category')
      .eq('id', currentMonthEnquiryId)
    assert.ok(!superErr, `Superadmin SELECT error: ${superErr?.message}`)
    assert.equal(superData.length, 1, 'Superadmin MUST see removed enquiry')
    assert.equal(superData[0].is_removed, true)

    // 2. All 6 non-superadmin roles CANNOT SELECT the removed enquiry
    const nonHeadRoles = ['admin', 'technical', 'engineer', 'hr', 'account', 'inventory_staff']
    for (const r of nonHeadRoles) {
      const client = roleClients[r]
      const { data, error } = await client
        .from('enquiries')
        .select('id, name, is_removed')
        .eq('id', currentMonthEnquiryId)
      assert.ok(!error, `Unexpected error for role ${r}: ${error?.message}`)
      assert.equal(data.length, 0, `Security violation: Role ${r} was able to view soft-removed enquiry!`)
    }

    // 3. Anonymous user CANNOT SELECT the removed enquiry
    const { data: anonData } = await anonClient
      .from('enquiries')
      .select('id, name')
      .eq('id', currentMonthEnquiryId)
    assert.equal(anonData?.length || 0, 0, 'Anonymous user must not see removed enquiry')

    // 4. Verify standard active enquiry is still visible to operational staff (regression check)
    const { data: activeData, error: activeErr } = await roleClients.admin
      .from('enquiries')
      .select('id, name')
      .eq('id', completedEnquiryId)
    assert.ok(!activeErr, `Admin failed to select active enquiry: ${activeErr?.message}`)
    assert.equal(activeData.length, 1, 'Admin must still see non-removed enquiries')
  })

  await suite.test('Verification: Superadmin restores removed enquiry and verifies RLS visibility restored', async () => {
    const superClient = roleClients.superadmin

    // Non-superadmin cannot restore
    const { error: deniedRestore } = await roleClients.admin.rpc('restore_removed_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_reason: 'Unauthorized restore attempt'
    })
    assert.ok(deniedRestore, 'Admin should not be able to restore')
    assert.match(deniedRestore.message, /Access denied: Only Superadministrator can restore/)

    // Superadmin restores
    const { data: restoreData, error: restoreErr } = await superClient.rpc('restore_removed_enquiry', {
      p_enquiry_id: currentMonthEnquiryId,
      p_reason: 'Restored after manual false-positive verification'
    })
    assert.ok(!restoreErr, `Superadmin restore failed: ${restoreErr?.message}`)
    assert.equal(restoreData.success, true)
    assert.equal(restoreData.is_removed, false)

    // Now Admin CAN SELECT it again
    const { data: adminPostRestore, error: adminPostErr } = await roleClients.admin
      .from('enquiries')
      .select('id, name, is_removed')
      .eq('id', currentMonthEnquiryId)
    assert.ok(!adminPostErr, `Admin error: ${adminPostErr?.message}`)
    assert.equal(adminPostRestore.length, 1, 'Admin must see restored enquiry once is_removed is false')
    assert.equal(adminPostRestore[0].is_removed, false)

    // Restoration audit activity logged
    const { data: activities } = await serviceClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', currentMonthEnquiryId)
      .eq('activity_type', 'restored')
    assert.equal(activities.length, 1, 'Restoration activity logged')
  })
})
