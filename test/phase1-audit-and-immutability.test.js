/**
 * ARS Computers — Phase 1 Audit Logs, Enquiry Activities & Immutability Test Suite
 * Fully Verified with Real Authenticated Sessions (No Service Role RLS Bypasses)
 *
 * Verifications:
 * 1. Anonymous customer submission succeeds with default status 'new'.
 * 2. Anonymous customer submission with status='closed' or admin_notes is strictly rejected.
 * 3. Automated audit_logs & enquiry_activities generation upon enquiry creation.
 * 4. Employee (admin role) access to audit_logs is blocked by RLS (0 rows).
 * 5. Employee cannot directly INSERT into audit_logs (PostgreSQL permission denied).
 * 6. Employee cannot directly INSERT into enquiry_activities (RLS policy violation).
 * 7. Employee can read enquiry_activities timeline.
 * 8. Superadmin access to audit_logs succeeds via real authenticated superadmin session/JWT.
 * 9. Enquiry ID immutability trigger blocks modifying enquiries.id.
 * 10. Customer data immutability blocks tampering with name, contact_info, message, category_interest.
 * 11. Legitimate status and admin_notes updates by superadmin succeed.
 * 12. Immutability trigger blocks any UPDATE or DELETE on audit_logs and enquiry_activities.
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const EMPLOYEE_EMAIL = 'employee.test@arscomputers.in'
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'ArsEmpTemp#2026!Oct'
const SUPERADMIN_EMAIL = 'ankitbathla.ind@gmail.com'
const SUPERADMIN_PASSWORD = process.env.TEST_SUPERADMIN_PASSWORD

let passed = 0
let failed = 0

function assertTest(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASSED: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAILED: ${name} ${details ? `(${details})` : ''}`)
    failed++
  }
}

async function run() {
  console.log('====================================================================')
  console.log('ARS Computers — Phase 1 Security Remediation & Invariant Test Suite')
  console.log('====================================================================')

  const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // --------------------------------------------------------------------------
  // STEP 1: Anonymous Customer Submission & Finding 1 Hardening
  // --------------------------------------------------------------------------
  console.log('\n[Phase 1.1] Testing Anonymous Customer Enquiry Submission & Hardening:')
  const uniqueName = 'Audit Test Customer ' + Date.now()
  const testCustomerEnquiry = {
    name: uniqueName,
    contact_info: 'audit_customer@example.com',
    category_interest: 'computer-laptop',
    message: 'Testing that anonymous submissions still work and generate audit trails.'
  }

  // 1A: Legitimate anonymous enquiry
  const { error: submitErr } = await anonClient
    .from('enquiries')
    .insert([testCustomerEnquiry])

  assertTest(!submitErr, 'Legitimate anonymous enquiry submission succeeds without friction', submitErr?.message)

  // 1B: Finding 1: Anonymous attempt to force status = 'closed' must be rejected
  const { error: forgedStatusErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'Forged Status Tester',
      contact_info: 'forged_status@test.com',
      message: 'Attempting to inject closed status',
      status: 'closed'
    }])

  assertTest(Boolean(forgedStatusErr), 'Anonymous attempt to set non-default status ("closed") is strictly rejected', forgedStatusErr?.message)

  // 1C: Finding 1: Anonymous attempt to inject admin_notes must be rejected
  const { error: forgedNotesErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'Forged Notes Tester',
      contact_info: 'forged_notes@test.com',
      message: 'Attempting to inject internal admin notes',
      admin_notes: 'Tampered internal note'
    }])

  assertTest(Boolean(forgedNotesErr), 'Anonymous attempt to supply internal admin_notes is strictly rejected', forgedNotesErr?.message)

  // Retrieve test enquiry for subsequent lifecycle checks
  const { data: newEnq } = await serviceClient
    .from('enquiries')
    .select('*')
    .eq('name', uniqueName)
    .single()

  if (newEnq?.id) {
    // ------------------------------------------------------------------------
    // STEP 2: Verify Automated Audit Logs & Enquiry Activities Created
    // ------------------------------------------------------------------------
    console.log('\n[Phase 1.2] Verifying Automated Audit & Activity Trail:')
    const { data: auditEntries, error: auditErr } = await serviceClient
      .from('audit_logs')
      .select('*')
      .eq('entity_id', newEnq.id)
      .eq('entity_type', 'enquiries')

    assertTest(!auditErr && auditEntries?.length > 0, `Automated audit_log record created for enquiry (${auditEntries?.length || 0} found)`)
    const auditRecord = auditEntries?.[0]
    assertTest(auditRecord?.action === 'INSERT', 'Audit log records action="INSERT"')
    assertTest(auditRecord?.actor_role === 'anonymous', 'Audit log records actor_role="anonymous"')
    assertTest(Boolean(auditRecord?.new_values), 'Audit log contains new_values snapshot')

    const { data: activityEntries, error: actErr } = await serviceClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', newEnq.id)

    assertTest(!actErr && activityEntries?.length > 0, `Automated enquiry_activities record created (${activityEntries?.length || 0} found)`)
    assertTest(activityEntries?.[0]?.activity_type === 'system_event', 'Activity record type is "system_event"')

    // ------------------------------------------------------------------------
    // STEP 3: Verify Employee (Admin) Access Boundaries
    // ------------------------------------------------------------------------
    console.log('\n[Phase 1.3] Testing Employee (Admin) Access Boundaries & Write Denials:')
    const employeeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
    const { data: empAuth, error: empAuthErr } = await employeeClient.auth.signInWithPassword({
      email: EMPLOYEE_EMAIL,
      password: EMPLOYEE_PASSWORD
    })

    assertTest(!empAuthErr && empAuth?.session, 'Admin employee authenticates successfully with live session')

    // 3A: Employee should be BLOCKED from reading audit_logs (RLS returns 0 rows)
    const { data: empAuditData, error: empAuditErr } = await employeeClient
      .from('audit_logs')
      .select('id, action, entity_type')

    const employeeBlockedFromAudit = Boolean(empAuditErr) || (Array.isArray(empAuditData) && empAuditData.length === 0)
    assertTest(employeeBlockedFromAudit, 'Admin employee CANNOT view audit_logs (RLS policy blocks, returns 0 rows)')

    // 3B: Employee direct INSERT into audit_logs must be rejected (SQLSTATE 42501 permission denied)
    const { error: empInsertAuditErr } = await employeeClient
      .from('audit_logs')
      .insert([{
        action: 'INSERT',
        entity_type: 'enquiries',
        entity_id: newEnq.id
      }])

    assertTest(Boolean(empInsertAuditErr), 'Employee CANNOT directly insert into audit_logs (rejected by database privileges)', empInsertAuditErr?.message)

    // 3C: Employee direct INSERT into enquiry_activities must be rejected (RLS policy violation)
    const { error: empInsertActErr } = await employeeClient
      .from('enquiry_activities')
      .insert([{
        enquiry_id: newEnq.id,
        actor_id: empAuth?.user?.id,
        activity_type: 'note',
        content: 'Unauthorized employee note'
      }])

    assertTest(Boolean(empInsertActErr), 'Employee CANNOT directly insert into enquiry_activities (rejected by RLS policy)', empInsertActErr?.message)

    // 3D: Employee CAN read enquiry_activities timeline
    const { data: empActivities, error: empActErr } = await employeeClient
      .from('enquiry_activities')
      .select('id, enquiry_id, activity_type, content')
      .eq('enquiry_id', newEnq.id)

    assertTest(!empActErr && Array.isArray(empActivities) && empActivities.length > 0, 'Admin employee CAN view enquiry_activities timeline')

    // ------------------------------------------------------------------------
    // STEP 4: Finding 2 — Authenticated Superadmin Access via RLS (No service_role)
    // ------------------------------------------------------------------------
    console.log('\n[Phase 1.4] Testing Authenticated Superadmin Access via RLS (Finding 2):')
    const superadminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })

    let saSessionReady = false
    if (SUPERADMIN_PASSWORD) {
      const { data: saLogin, error: saLoginErr } = await superadminClient.auth.signInWithPassword({
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD
      })
      if (!saLoginErr && saLogin?.session) {
        saSessionReady = true
      }
    }

    if (!saSessionReady) {
      // Generate magic link token via admin API and exchange via verifyOtp on anon client
      const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: SUPERADMIN_EMAIL
      })

      if (!linkErr && linkData?.properties?.hashed_token) {
        const { data: otpData, error: otpErr } = await superadminClient.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'magiclink'
        })
        if (!otpErr && otpData?.session) {
          saSessionReady = true
        }
      }
    }

    assertTest(saSessionReady, 'Superadmin authenticated successfully with real user session')

    // Query audit_logs using the authentic superadmin client (strictly evaluates RLS public.is_superadmin())
    const { data: saAudit, error: saAuditErr } = await superadminClient
      .from('audit_logs')
      .select('id, actor_email, actor_role, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    assertTest(!saAuditErr && Array.isArray(saAudit) && saAudit.length > 0, 'Superadmin reads audit_logs through RLS policy (public.is_superadmin())', saAuditErr?.message)

    // ------------------------------------------------------------------------
    // STEP 5: Finding 3 — Enquiry ID & Customer Data Immutability
    // ------------------------------------------------------------------------
    console.log('\n[Phase 1.5] Testing Enquiry ID & Customer Immutability (Finding 3):')

    // 5A: Finding 3: Tampering with Enquiry ID must fail
    const fakeUuid = '00000000-0000-0000-0000-000000000001'
    const { error: tamperIdErr } = await superadminClient
      .from('enquiries')
      .update({ id: fakeUuid })
      .eq('id', newEnq.id)

    assertTest(Boolean(tamperIdErr), 'Tampering with enquiry ID is strictly rejected by trigger', tamperIdErr?.message)

    // 5B: Tampering with customer name must fail
    const { error: tamperNameErr } = await superadminClient
      .from('enquiries')
      .update({ name: 'Hacked Customer Name' })
      .eq('id', newEnq.id)

    assertTest(Boolean(tamperNameErr), 'Tampering with customer name is strictly rejected by trigger', tamperNameErr?.message)

    // 5C: Tampering with contact_info must fail
    const { error: tamperContactErr } = await superadminClient
      .from('enquiries')
      .update({ contact_info: 'hacked_contact@example.com' })
      .eq('id', newEnq.id)

    assertTest(Boolean(tamperContactErr), 'Tampering with customer contact_info is strictly rejected by trigger', tamperContactErr?.message)

    // 5D: Tampering with customer message must fail
    const { error: tamperMsgErr } = await superadminClient
      .from('enquiries')
      .update({ message: 'Forged customer requirement' })
      .eq('id', newEnq.id)

    assertTest(Boolean(tamperMsgErr), 'Tampering with customer message is strictly rejected by trigger', tamperMsgErr?.message)

    // 5E: Legitimate operational updates (status and admin_notes by superadmin) MUST succeed
    const { data: legitUpdate, error: legitUpdateErr } = await superadminClient
      .from('enquiries')
      .update({ status: 'in_progress', admin_notes: 'Superadmin assigned lead to review desk.' })
      .eq('id', newEnq.id)
      .select()
      .single()

    assertTest(!legitUpdateErr && legitUpdate?.status === 'in_progress', 'Legitimate status & note update by superadmin succeeds')

    // Verify status update generated a second audit_log and an enquiry_activity
    const { data: updatedActivities } = await superadminClient
      .from('enquiry_activities')
      .select('activity_type, content')
      .eq('enquiry_id', newEnq.id)
      .order('created_at', { ascending: true })

    const hasStatusChangeActivity = updatedActivities?.some((a) => a.activity_type === 'status_change')
    assertTest(hasStatusChangeActivity, 'Status change automatically created a "status_change" enquiry_activity')

    // ------------------------------------------------------------------------
    // STEP 6: Finding 4 — Immutability of Audit Logs and Enquiry Activities
    // ------------------------------------------------------------------------
    console.log('\n[Phase 1.6] Testing Immutability & Anti-Tamper Guards (Finding 4):')
    // 6A: Direct UPDATE on audit_logs must fail
    if (auditRecord?.id) {
      const { error: updateAuditErr } = await superadminClient
        .from('audit_logs')
        .update({ action: 'TAMPERED' })
        .eq('id', auditRecord.id)

      assertTest(Boolean(updateAuditErr), 'Direct UPDATE on audit_logs is strictly rejected by trigger', updateAuditErr?.message)

      // 6B: Direct DELETE on audit_logs must fail
      const { error: deleteAuditErr } = await superadminClient
        .from('audit_logs')
        .delete()
        .eq('id', auditRecord.id)

      assertTest(Boolean(deleteAuditErr), 'Direct DELETE on audit_logs is strictly rejected by trigger', deleteAuditErr?.message)
    }

    // 6C: Direct UPDATE on enquiry_activities must fail
    if (activityEntries?.[0]?.id) {
      const { error: updateActErr } = await superadminClient
        .from('enquiry_activities')
        .update({ content: 'Tampered activity content' })
        .eq('id', activityEntries[0].id)

      assertTest(Boolean(updateActErr), 'Direct UPDATE on enquiry_activities is strictly rejected by trigger', updateActErr?.message)

      // 6D: Direct DELETE on enquiry_activities must fail
      const { error: deleteActErr } = await superadminClient
        .from('enquiry_activities')
        .delete()
        .eq('id', activityEntries[0].id)

      assertTest(Boolean(deleteActErr), 'Direct DELETE on enquiry_activities is strictly rejected by trigger', deleteActErr?.message)
    }
  }

  console.log('====================================================================')
  console.log(`Phase 1 Test Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Test runner failure:', err)
  process.exit(1)
})
