/**
 * ============================================================================
 * ARS Computers — Phase 3: Task Completion, Head-Person Approval, Rework & Bin Workflow
 * ============================================================================
 * Automated test suite verifying:
 * 1. Employee can work on an enquiry and add notes
 * 2. Employee can submit a meaningful completion summary (>= 10 chars)
 * 3. Pending submission appears in the Head Person's review queue
 * 4. Employee cannot approve their own submission via direct RPC
 * 5. Head Person approval moves enquiry to Bin and sets retention deadline
 * 6. Head Person rejection/return leaves enquiry active and enables rework
 * 7. Resubmission creates new history without erasing earlier decisions
 * 8. Head Person can restore an enquiry before the retention deadline
 * 9. Employees cannot access privileged actions through direct RPC/REST calls
 * 10. Permanent deletion is blocked before the deadline and succeeds only after expiry
 * 11. Audit history is preserved appropriately after deletion with customer PII redacted
 * 12. Concurrent/duplicate approval, restoration and cleanup attempts are handled safely
 * 13. Existing customer-submission immutability, anonymous defaults & rejection workflow continue working
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

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

async function runCompletionAndBinWorkflowTests() {
  console.log('====================================================================')
  console.log('ARS Computers — Task Completion, Head-Person Approval, Rework & Bin Tests')
  console.log('====================================================================')

  // Setup clients
  const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })
  const employeeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })
  const superadminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })
  const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // Sign in Employee
  const { data: empAuth, error: empAuthErr } = await employeeClient.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD
  })
  if (empAuthErr) {
    console.error('Failed to authenticate as employee:', empAuthErr.message)
    process.exit(1)
  }

  // Sign in Superadmin
  let superAuth = null
  if (SUPERADMIN_PASSWORD) {
    const { data: saLogin, error: saLoginErr } = await superadminClient.auth.signInWithPassword({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD
    })
    if (!saLoginErr && saLogin?.session) {
      superAuth = saLogin
    }
  }

  if (!superAuth) {
    const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: SUPERADMIN_EMAIL
    })
    if (linkErr) {
      console.error('Failed to generate magic link for superadmin:', linkErr.message)
      process.exit(1)
    }
    const tokenHash = linkData?.properties?.hashed_token
    if (tokenHash) {
      const { data: verifyData, error: verifyErr } = await superadminClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink'
      })
      if (verifyErr) {
        console.error('Failed to verify OTP for superadmin:', verifyErr.message)
        process.exit(1)
      }
      superAuth = verifyData
    }
  }

  console.log('Authenticated Sessions:')
  console.log(`  Employee: ${empAuth?.user?.email} (${empAuth?.user?.id})`)
  console.log(`  Superadmin: ${superAuth?.user?.email || SUPERADMIN_EMAIL} (${superadminClient.auth.getUser() ? 'OK' : 'FAIL'})`)

  const testPrefix = `[TEST-COMPLETION-${Date.now()}]`
  const testEnquiriesToClean = []

  // Helper to create test enquiry through anonymous submission and fetch by employee
  async function createTestEnquiry(name, email, message, extra = {}) {
    const { error: insErr } = await anonClient.from('enquiries').insert([{
      name: `${testPrefix} ${name}`,
      contact_info: email,
      message,
      category_interest: 'Repair Service',
      ...extra
    }])
    if (insErr) return { enquiry: null, error: insErr }

    const { data: enq, error: fetchErr } = await employeeClient
      .from('enquiries')
      .select('*')
      .eq('contact_info', email)
      .single()
    if (enq?.id) testEnquiriesToClean.push(enq.id)
    return { enquiry: enq, error: fetchErr }
  }

  try {
    // ------------------------------------------------------------------------
    // Scenario 1: Employee can work on an enquiry and add follow-up notes
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Employee Work & Follow-Up Notes ---')
    const email1 = `alice.${Date.now()}@example.com`
    const { enquiry: enq1, error: createErr1 } = await createTestEnquiry(
      'Customer Alice',
      email1,
      'Need urgent laptop repair - no display'
    )

    assertTest(!createErr1 && enq1?.id, '1.1 Customer can submit initial enquiry', createErr1?.message)

    // Employee moves progress to in_progress
    const { data: prog1, error: progErr1 } = await employeeClient.rpc('update_enquiry_progress', {
      p_enquiry_id: enq1.id,
      p_next_status: 'in_progress'
    })
    assertTest(!progErr1 && (prog1?.new_status === 'in_progress' || prog1?.status === 'in_progress'), '1.2 Employee can progress enquiry to in_progress', progErr1?.message)

    // Employee adds follow-up note
    const noteText1 = 'Completed initial diagnosis: Disassembled chassis and found damaged EDP display cable.'
    const { data: noteRes1, error: noteErr1 } = await employeeClient.rpc('add_enquiry_note', {
      p_enquiry_id: enq1.id,
      p_content: noteText1
    })
    assertTest(!noteErr1 && noteRes1?.success, '1.3 Employee can add follow-up note via RPC')

    // Verify activity logged
    const { data: acts1, error: actsErr1 } = await employeeClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', enq1.id)
      .eq('activity_type', 'note')
    assertTest(!actsErr1 && acts1?.length >= 1 && acts1[0].content === noteText1, '1.4 Note recorded in immutable enquiry_activities')

    // ------------------------------------------------------------------------
    // Scenario 2: Employee submits a meaningful completion summary
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Employee Completion Submission Validation ---')
    // Attempt with summary < 10 characters -> must be rejected
    const { data: _shortSub, error: shortSubErr } = await employeeClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enq1.id,
      p_completion_summary: 'Done fast'
    })
    assertTest(Boolean(shortSubErr), '2.1 Short completion summary (< 10 chars) is rejected', shortSubErr?.message)

    // Valid completion summary (>= 10 characters)
    const validSummary1 = 'Replaced damaged EDP cable with OEM replacement, verified full display brightness and ran 12h burn-in test.'
    const { data: subRes1, error: subErr1 } = await employeeClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enq1.id,
      p_completion_summary: validSummary1
    })
    assertTest(!subErr1 && subRes1?.status === 'completion_requested', '2.2 Valid completion summary moves status to completion_requested', subErr1?.message)

    // Verify enquiry row updated
    const { data: enq1AfterSub } = await employeeClient
      .from('enquiries')
      .select('*')
      .eq('id', enq1.id)
      .single()
    assertTest(
      enq1AfterSub?.completion_summary === validSummary1 &&
      enq1AfterSub?.completion_requested_by === empAuth.user.id &&
      Boolean(enq1AfterSub?.completion_requested_at) &&
      enq1AfterSub?.previous_status === 'in_progress',
      '2.3 Enquiry row records submitter, timestamp, summary, and previous status'
    )

    // Verify enquiry activity logged
    const { data: compActs } = await employeeClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', enq1.id)
      .eq('activity_type', 'completion_requested')
    assertTest(compActs?.length >= 1 && compActs[0].content.includes(validSummary1), '2.4 Activity logged for completion_requested')

    // Prevent employee from altering status or progress once submitted
    const { error: bypassErr } = await employeeClient.rpc('update_enquiry_progress', {
      p_enquiry_id: enq1.id,
      p_next_status: 'quoted'
    })
    assertTest(Boolean(bypassErr), '2.5 Employee cannot alter progress while pending completion review', bypassErr?.message)

    // ------------------------------------------------------------------------
    // Scenario 3: Submission appears in Head Person's review queue
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Head Person Review Queue Visibility ---')
    const { data: saQueue, error: saQueueErr } = await superadminClient
      .from('enquiries')
      .select('id, status, name, completion_summary, completion_requested_by')
      .eq('status', 'completion_requested')
      .eq('id', enq1.id)
    assertTest(!saQueueErr && saQueue?.length === 1, '3.1 Pending submission appears in superadmin completion queue', saQueueErr?.message)

    // ------------------------------------------------------------------------
    // Scenario 4: Employee cannot approve their own submission
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Authorization Barrier: Self-Approval Prevention ---')
    const { error: empApproveErr } = await employeeClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq1.id,
      p_decision: 'approved',
      p_review_notes: 'Employee self-approval attempt',
      p_retention_days: 7
    })
    assertTest(
      Boolean(empApproveErr) && (empApproveErr.message.includes('insufficient_privilege') || empApproveErr.message.includes('Unauthorized')),
      '4.1 Employee direct RPC call to review_enquiry_completion is blocked',
      empApproveErr?.message
    )

    // ------------------------------------------------------------------------
    // Scenario 5: Head Person approval moves enquiry to Bin with retention deadline
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Head Person Approval & Bin Transition ---')
    const { data: approveRes, error: approveErr } = await superadminClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq1.id,
      p_decision: 'approved',
      p_review_notes: 'Work inspected and approved. Ready for invoice archiving.',
      p_retention_days: 7
    })
    assertTest(!approveErr && approveRes?.status === 'in_bin', '5.1 Head Person can approve completion, moving status to in_bin', approveErr?.message)

    const { data: enq1InBin } = await superadminClient
      .from('enquiries')
      .select('*')
      .eq('id', enq1.id)
      .single()
    assertTest(
      enq1InBin?.is_in_bin === true &&
      Boolean(enq1InBin?.bin_entered_at) &&
      Boolean(enq1InBin?.scheduled_deletion_at) &&
      Boolean(enq1InBin?.completion_approved_at),
      '5.2 Enquiry in Bin has is_in_bin = true, bin_entered_at, and scheduled_deletion_at'
    )

    // Verify scheduled_deletion_at is approximately 7 days from now (within 6 to 8 days)
    const deletionDate = new Date(enq1InBin.scheduled_deletion_at).getTime()
    const now = Date.now()
    const diffDays = (deletionDate - now) / (1000 * 60 * 60 * 24)
    assertTest(diffDays >= 6.9 && diffDays <= 7.1, '5.3 Retention period correctly calculated as ~7 days')

    // Verify bin activities
    const { data: binActs } = await superadminClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', enq1.id)
      .in('activity_type', ['completion_reviewed', 'bin_entered'])
    assertTest(binActs?.length >= 2, '5.4 completion_reviewed and bin_entered activities logged in timeline')

    // ------------------------------------------------------------------------
    // Scenario 6: Head Person rejection/return leaves enquiry active & enables rework
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Head Person Return for Rework ---')
    const email2 = `bob.${Date.now()}@example.com`
    const { enquiry: enq2 } = await createTestEnquiry(
      'Customer Bob',
      email2,
      'Desktop RAM upgrade and cleaning',
      { category_interest: 'Hardware Upgrade' }
    )

    await employeeClient.rpc('update_enquiry_progress', { p_enquiry_id: enq2.id, p_next_status: 'in_progress' })
    await employeeClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enq2.id,
      p_completion_summary: 'Installed 16GB Corsair DDR4 module, PC booted to BIOS.'
    })

    // Rework return without reason (< 5 chars) -> must be rejected
    const { error: noReasonErr } = await superadminClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq2.id,
      p_decision: 'returned_for_rework',
      p_review_notes: 'Fix'
    })
    assertTest(Boolean(noReasonErr), '6.1 Return for rework requires minimum 5-character reason', noReasonErr?.message)

    // Valid return for rework
    const reworkReason1 = 'Memory was not stress-tested in Windows. Please run MemTest86 and verify dual-channel operation.'
    const { data: reworkRes, error: reworkErr } = await superadminClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq2.id,
      p_decision: 'returned_for_rework',
      p_review_notes: reworkReason1
    })
    assertTest(!reworkErr && reworkRes?.status === 'returned_for_rework', '6.2 Valid return moves status to returned_for_rework', reworkErr?.message)

    const { data: enq2AfterRework } = await employeeClient
      .from('enquiries')
      .select('*')
      .eq('id', enq2.id)
      .single()
    assertTest(
      enq2AfterRework?.status === 'returned_for_rework' &&
      enq2AfterRework?.is_in_bin === false &&
      enq2AfterRework?.completion_rework_reason === reworkReason1,
      '6.3 Enquiry remains active, is_in_bin = false, and rework reason is visible to employee'
    )

    // ------------------------------------------------------------------------
    // Scenario 7: Resubmission creates new history without erasing earlier decisions
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Employee Rework Resubmission & History Preservation ---')
    // Employee adds follow-up note documenting rework
    await employeeClient.rpc('add_enquiry_note', {
      p_enquiry_id: enq2.id,
      p_content: 'Ran MemTest86 for 4 passes (0 errors). Confirmed dual-channel 3200MHz in CPU-Z.'
    })

    const resubmitSummary = 'Installed Corsair 16GB module, passed 4 passes of MemTest86 without errors, verified Windows 11 dual-channel active.'
    const { data: resubRes, error: resubErr } = await employeeClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enq2.id,
      p_completion_summary: resubmitSummary
    })
    assertTest(!resubErr && resubRes?.status === 'completion_requested', '7.1 Employee can resubmit reworked task for approval', resubErr?.message)

    // Verify immutable history preserved all events
    const { data: enq2History } = await employeeClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', enq2.id)
      .order('created_at', { ascending: true })

    const actTypes = enq2History.map((a) => a.activity_type)
    assertTest(
      actTypes.includes('completion_requested') &&
      actTypes.includes('completion_reviewed') &&
      enq2History.filter((a) => a.activity_type === 'completion_requested').length === 2,
      '7.2 Immutable timeline contains both initial submission, rework return, and resubmission'
    )

    // ------------------------------------------------------------------------
    // Scenario 8: Head Person can restore an enquiry before retention deadline
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Head Person Bin Restoration ---')
    // Restore enq1 (which was moved to Bin in Scenario 5)
    const { data: restoreRes, error: restoreErr } = await superadminClient.rpc('restore_enquiry_from_bin', {
      p_enquiry_id: enq1.id
    })
    assertTest(!restoreErr && restoreRes?.status === 'in_progress', '8.1 Superadmin can restore enquiry from Bin to in_progress', restoreErr?.message)

    const { data: enq1Restored } = await superadminClient
      .from('enquiries')
      .select('*')
      .eq('id', enq1.id)
      .single()
    assertTest(
      enq1Restored?.is_in_bin === false &&
      enq1Restored?.bin_entered_at === null &&
      enq1Restored?.scheduled_deletion_at === null,
      '8.2 Restored enquiry clears Bin flags and cancels scheduled deletion'
    )

    const { data: restoreAct } = await superadminClient
      .from('enquiry_activities')
      .select('*')
      .eq('enquiry_id', enq1.id)
      .eq('activity_type', 'bin_restored')
    assertTest(restoreAct?.length >= 1, '8.3 bin_restored activity logged in audit history')

    // ------------------------------------------------------------------------
    // Scenario 9: Employees cannot access privileged actions through direct RPC/REST
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Direct Access & Privilege Escalation Prevention ---')
    // Employee calling restore_enquiry_from_bin
    const { error: empRestoreErr } = await employeeClient.rpc('restore_enquiry_from_bin', {
      p_enquiry_id: enq1.id
    })
    assertTest(Boolean(empRestoreErr), '9.1 Employee cannot call restore_enquiry_from_bin RPC')

    // Employee calling purge_expired_bin_enquiries
    const { error: empPurgeErr } = await employeeClient.rpc('purge_expired_bin_enquiries', {
      p_retention_grace_seconds: 0
    })
    assertTest(Boolean(empPurgeErr), '9.2 Employee cannot call purge_expired_bin_enquiries RPC')

    // Employee attempting direct REST update on Bin flags
    const { data: restUpdateRes, error: restUpdateErr } = await employeeClient
      .from('enquiries')
      .update({ is_in_bin: true, status: 'in_bin' })
      .eq('id', enq1.id)
      .select()
    assertTest(
      Boolean(restUpdateErr) || restUpdateRes?.length === 0,
      '9.3 Employee direct REST update on status/is_in_bin is blocked by RLS'
    )

    // ------------------------------------------------------------------------
    // Scenario 10: Permanent deletion is blocked before deadline and succeeds after
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Bin Permanent Deletion & Retention Gate ---')
    // Create enquiry 3, approve into Bin with 7-day retention
    const email3 = `charlie.${Date.now()}@example.com`
    const { enquiry: enq3 } = await createTestEnquiry(
      'Customer Charlie',
      email3,
      'Data backup service test'
    )

    const { error: p3Err } = await employeeClient.rpc('update_enquiry_progress', { p_enquiry_id: enq3.id, p_next_status: 'in_progress' })
    assertTest(!p3Err, '10.0a Enquiry 3 moved to in_progress', p3Err?.message)

    const { error: sub3Err } = await employeeClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enq3.id,
      p_completion_summary: 'Backed up 500GB customer drive to external storage with checksums matching.'
    })
    assertTest(!sub3Err, '10.0b Enquiry 3 completion submitted', sub3Err?.message)

    const { error: app3Err } = await superadminClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq3.id,
      p_decision: 'approved',
      p_review_notes: 'Approved for archiving.',
      p_retention_days: 7
    })
    assertTest(!app3Err, '10.0c Enquiry 3 approved into Bin', app3Err?.message)

    // Run purge now -> enq3 scheduled_deletion_at is 7 days in future, must NOT be deleted
    const { data: _earlyPurge, error: earlyPurgeErr } = await superadminClient.rpc('purge_expired_bin_enquiries', {
      p_retention_grace_seconds: 0
    })
    assertTest(!earlyPurgeErr, '10.1 Purge RPC runs safely without error')

    const { data: enq3StillPresent } = await superadminClient
      .from('enquiries')
      .select('id, is_in_bin, scheduled_deletion_at')
      .eq('id', enq3.id)
      .single()
    assertTest(enq3StillPresent?.id === enq3.id, '10.2 Enquiry is NOT deleted before retention deadline')

    // Simulate expired retention on enq3 by updating scheduled_deletion_at to 1 hour ago (via service client)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString()
    const { error: updErr } = await serviceClient
      .from('enquiries')
      .update({ scheduled_deletion_at: oneHourAgo })
      .eq('id', enq3.id)

    if (updErr) {
      console.error('Service client update scheduled_deletion_at failed:', updErr.message)
    }

    // Now run purge again -> enq3 is expired and must be purged
    const { data: expiredPurge, error: expiredPurgeErr } = await superadminClient.rpc('purge_expired_bin_enquiries', {
      p_retention_grace_seconds: 0
    })
    assertTest(!expiredPurgeErr && expiredPurge?.purged_count >= 1, '10.3 Expired enquiry is permanently deleted by purge RPC', expiredPurgeErr?.message)

    const { data: enq3AfterPurge } = await superadminClient
      .from('enquiries')
      .select('id')
      .eq('id', enq3.id)
      .maybeSingle()
    assertTest(enq3AfterPurge === null, '10.4 Expired enquiry is completely deleted from public.enquiries table')

    // ------------------------------------------------------------------------
    // Scenario 11: Audit history preserved after deletion with customer PII redacted
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Audit History & Customer PII Redaction ---')
    const { data: deleteAudit, error: auditErr } = await serviceClient
      .from('audit_logs')
      .select('*')
      .eq('action', 'DELETE')
      .eq('entity_type', 'enquiries')
      .order('created_at', { ascending: false })
      .limit(10)

    const matchingAudit = deleteAudit?.find((a) => a.entity_id === enq3.id || a.old_values?.id === enq3.id)
    assertTest(
      Boolean(matchingAudit),
      '11.1 Immutable audit log records DELETE action for purged enquiry',
      auditErr?.message
    )
    assertTest(
      matchingAudit?.old_values?.customer_pii_redacted === true &&
      !matchingAudit?.old_values?.name &&
      !matchingAudit?.old_values?.contact_info &&
      !matchingAudit?.old_values?.message,
      '11.2 Customer personal data (name, contact_info, message) is redacted from audit record'
    )
    assertTest(
      Boolean(matchingAudit?.old_values?.status) &&
      Boolean(matchingAudit?.old_values?.bin_entered_at) &&
      Boolean(matchingAudit?.old_values?.scheduled_deletion_at),
      '11.3 Audit metadata (status, bin_entered_at, scheduled_deletion_at) is preserved'
    )

    // ------------------------------------------------------------------------
    // Scenario 12: Concurrent / duplicate review & restore attempts handled safely
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Concurrent & Conflict Handling ---')
    // Attempting to restore an enquiry not in bin (enq1 is now in_progress)
    const { error: nonBinRestoreErr } = await superadminClient.rpc('restore_enquiry_from_bin', {
      p_enquiry_id: enq1.id
    })
    assertTest(
      Boolean(nonBinRestoreErr) && nonBinRestoreErr.message.includes('not currently in the Bin'),
      '12.1 Restoring an enquiry not in Bin throws informative error',
      nonBinRestoreErr?.message
    )

    // Attempting to review completion on an enquiry not in completion_requested
    const { error: invalidReviewErr } = await superadminClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enq1.id,
      p_decision: 'approved',
      p_review_notes: 'Duplicate approval attempt',
      p_retention_days: 7
    })
    assertTest(
      Boolean(invalidReviewErr) && invalidReviewErr.message.includes('pending completion review'),
      '12.2 Reviewing an enquiry not in completion_requested throws conflict error',
      invalidReviewErr?.message
    )

    // ------------------------------------------------------------------------
    // Scenario 13: Immutability, anonymous insert & rejection workflow intact
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 13: Backward Compatibility & Customer Immutability ---')
    // Customer submission immutability
    const { error: anonTamperErr } = await anonClient
      .from('enquiries')
      .update({ message: 'Tampered message', status: 'converted' })
      .eq('id', enq1.id)
    assertTest(Boolean(anonTamperErr), '13.1 Anonymous users cannot modify existing enquiries')

    // Anonymous insertion cannot set completion or bin columns
    const sneakEmail = `hacker.${Date.now()}@example.com`
    const { error: sneakInsertErr } = await anonClient
      .from('enquiries')
      .insert([{
        name: `${testPrefix} Malicious Anon`,
        contact_info: sneakEmail,
        message: 'Attempting to inject bin flag',
        is_in_bin: true,
        status: 'in_bin'
      }])

    // Query back row to verify trigger overrode or defaulted it
    const { data: sneakEnq } = await employeeClient
      .from('enquiries')
      .select('*')
      .eq('contact_info', sneakEmail)
      .maybeSingle()

    if (sneakEnq?.id) testEnquiriesToClean.push(sneakEnq.id)

    assertTest(
      sneakInsertErr || (sneakEnq?.status === 'new' && sneakEnq?.is_in_bin === false),
      '13.2 Anonymous insertion defaults status to new and prevents injection of is_in_bin'
    )

    // Existing rejection request and review flow still works
    const email4 = `reject.${Date.now()}@example.com`
    const { enquiry: enq4 } = await createTestEnquiry(
      'Customer Rejection Test',
      email4,
      'Customer requested cancellation'
    )

    await employeeClient.rpc('request_enquiry_rejection', {
      p_enquiry_id: enq4.id,
      p_reason: 'Customer bought from competitor and cancelled order'
    })
    const { data: enq4Rej } = await superadminClient
      .from('enquiries')
      .select('status, rejection_reason')
      .eq('id', enq4.id)
      .single()
    assertTest(enq4Rej?.status === 'rejection_requested', '13.3 Rejection request workflow operates normally')

    await superadminClient.rpc('review_enquiry_rejection', {
      p_enquiry_id: enq4.id,
      p_decision: 'approved',
      p_review_notes: 'Cancellation confirmed with customer'
    })
    const { data: enq4Closed } = await superadminClient
      .from('enquiries')
      .select('status')
      .eq('id', enq4.id)
      .single()
    assertTest(enq4Closed?.status === 'rejected', '13.4 Rejection approval closes enquiry as rejected')

  } finally {
    // Clean up dedicated test enquiries safely
    console.log('\nCleaning up dedicated test records...')
    for (const testId of testEnquiriesToClean) {
      await serviceClient.from('enquiries').delete().eq('id', testId)
    }
    console.log(`Cleaned up ${testEnquiriesToClean.length} test records.`)
  }

  console.log('\n====================================================================')
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runCompletionAndBinWorkflowTests().catch((err) => {
  console.error('Test execution failed with unhandled exception:', err)
  process.exit(1)
})
