/**
 * ============================================================================
 * ARS Computers — Phase 2: Workflow, Approval Queue & Security Verification
 * ============================================================================
 * Tests live API endpoints and RPC functions against the local Supabase instance
 * using real authenticated sessions for:
 * 1. Anonymous Customer (Public API submission restrictions)
 * 2. Authenticated Admin Employee (employee.test@arscomputers.in)
 * 3. Authenticated Superadmin (ankitbathla.ind@gmail.com)
 *
 * Verifies all 7 mandatory safeguards:
 * - Safeguard 1: Rejection history & repeated rejection requests after denial
 * - Safeguard 2: Secure SECURITY DEFINER RPCs & REST update bypass protection
 * - Safeguard 3: Assignment and visibility documentation & verification
 * - Safeguard 4: Atomic workflow transitions, row locks & conflict rejection
 * - Safeguard 5: Schema compatibility & anonymous submission hardening
 * - Safeguard 6: Safe notes (whitespace rejection, length, separate storage)
 * - Safeguard 7: Live authenticated role-based session testing (not service_role)
 * ============================================================================
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

async function runPhase2Tests() {
  console.log('====================================================================')
  console.log('ARS Computers — Phase 2 Workflow & Head-Person Approval Test Suite')
  console.log('====================================================================')

  // Client 1: Anonymous public client
  const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })

  // Client 2: Employee authenticated client
  const employeeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })

  // Client 3: Superadmin authenticated client
  const superadminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false }
  })

  // Client 4: Service role client for session generation only
  const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // Authenticate Employee
  const { data: empAuth, error: empAuthErr } = await employeeClient.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD
  })
  if (empAuthErr) {
    console.error('Failed to sign in as employee:', empAuthErr.message)
    process.exit(1)
  }

  // Authenticate Superadmin (via password or admin-generated session token exchange)
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

    const { data: otpData, error: otpErr } = await superadminClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink'
    })
    if (otpErr || !otpData?.session) {
      console.error('Failed to verify otp for superadmin:', otpErr?.message)
      process.exit(1)
    }
    superAuth = otpData
  }

  // --------------------------------------------------------------------------
  // SUITE 1: Anonymous Public Customer Submissions & Hardening (Safeguard 5)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 1] Testing Anonymous Customer Submissions & Workflow Injection Protection:')

  const uniqueEmail = `customer.workflow.${Date.now()}@example.com`
  const validEnquiryPayload = {
    name: 'Workflow Test Customer',
    contact_info: uniqueEmail,
    category_interest: 'computer-laptop',
    message: 'Need a quotation for 5 high-performance workstation laptops.'
  }

  const { error: createErr } = await anonClient
    .from('enquiries')
    .insert([validEnquiryPayload])

  assertTest(!createErr, 'Legitimate anonymous customer submission succeeds without friction', createErr?.message)

  // Verify created enquiry via authenticated employee client (since anon has no SELECT grant)
  const { data: createdEnquiry, error: readEnqErr } = await employeeClient
    .from('enquiries')
    .select('id, name, status, is_archived, rejection_reason')
    .eq('contact_info', uniqueEmail)
    .single()

  assertTest(!readEnqErr && createdEnquiry?.id, 'Enquiry retrieved by staff: record successfully created')
  assertTest(createdEnquiry?.status === 'new', 'Enquiry initial status is strictly "new"')
  assertTest(createdEnquiry?.is_archived === false, 'Enquiry is not archived on submission')
  assertTest(createdEnquiry?.rejection_reason === null, 'Enquiry rejection reason is null')

  const testEnquiryId = createdEnquiry.id

  // Attempt to submit with non-new status
  const { error: nonNewErr } = await anonClient
    .from('enquiries')
    .insert([{
      ...validEnquiryPayload,
      contact_info: `bypass.status.${Date.now()}@example.com`,
      status: 'closed'
    }])
  assertTest(Boolean(nonNewErr), 'Anonymous attempt to submit with status="closed" is rejected', nonNewErr?.message)

  // Attempt to submit with admin_notes
  const { error: notesErr } = await anonClient
    .from('enquiries')
    .insert([{
      ...validEnquiryPayload,
      contact_info: `bypass.notes.${Date.now()}@example.com`,
      admin_notes: 'Internal secret notes'
    }])
  assertTest(Boolean(notesErr), 'Anonymous attempt to submit with admin_notes is rejected', notesErr?.message)

  // Attempt to submit with is_archived=true
  const { error: archiveErr } = await anonClient
    .from('enquiries')
    .insert([{
      ...validEnquiryPayload,
      contact_info: `bypass.archive.${Date.now()}@example.com`,
      is_archived: true
    }])
  assertTest(Boolean(archiveErr), 'Anonymous attempt to submit with is_archived=true is rejected', archiveErr?.message)

  // Attempt to submit with rejection_reason
  const { error: rejReasonErr } = await anonClient
    .from('enquiries')
    .insert([{
      ...validEnquiryPayload,
      contact_info: `bypass.rej.${Date.now()}@example.com`,
      rejection_reason: 'Spam enquiry'
    }])
  assertTest(Boolean(rejReasonErr), 'Anonymous attempt to submit with rejection_reason is rejected', rejReasonErr?.message)

  // --------------------------------------------------------------------------
  // SUITE 2: Employee Direct REST Bypass Protections (Safeguard 2)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2] Testing Employee Direct REST Bypass & Least-Privilege Protections:')

  // Direct table UPDATE attempt on enquiries by employee
  const { data: directUpdateRes, error: directUpdateErr } = await employeeClient
    .from('enquiries')
    .update({ status: 'rejected' })
    .eq('id', testEnquiryId)
    .select()

  assertTest(
    Boolean(directUpdateErr) || (Array.isArray(directUpdateRes) && directUpdateRes.length === 0),
    'Employee direct REST UPDATE on enquiries table is strictly blocked (0 rows updated)'
  )

  // Direct table DELETE attempt on enquiries by employee
  const { data: directDelRes, error: directDelErr } = await employeeClient
    .from('enquiries')
    .delete()
    .eq('id', testEnquiryId)
    .select()

  assertTest(
    Boolean(directDelErr) || (Array.isArray(directDelRes) && directDelRes.length === 0),
    'Employee direct REST DELETE on enquiries table is strictly blocked (0 rows deleted)'
  )

  // Direct INSERT attempt on enquiry_activities by employee
  const { error: directActivityErr } = await employeeClient
    .from('enquiry_activities')
    .insert({
      enquiry_id: testEnquiryId,
      actor_id: empAuth.user.id,
      actor_role: 'superadmin', // attempted spoof
      activity_type: 'note',
      content: 'Forged activity entry'
    })
  assertTest(Boolean(directActivityErr), 'Employee direct REST INSERT on enquiry_activities is blocked by RLS', directActivityErr?.message)

  // --------------------------------------------------------------------------
  // SUITE 3: Safe Follow-Up Notes RPC (Safeguard 6)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3] Testing Follow-Up Notes RPC & Validation Guards:')

  // Whitespace-only note rejection
  const { error: spaceNoteErr } = await employeeClient.rpc('add_enquiry_note', {
    p_enquiry_id: testEnquiryId,
    p_content: '   '
  })
  assertTest(Boolean(spaceNoteErr), 'Adding empty or whitespace-only note is strictly rejected', spaceNoteErr?.message)

  // Short note (< 2 chars) rejection
  const { error: shortNoteErr } = await employeeClient.rpc('add_enquiry_note', {
    p_enquiry_id: testEnquiryId,
    p_content: 'x'
  })
  assertTest(Boolean(shortNoteErr), 'Adding note shorter than 2 characters is rejected', shortNoteErr?.message)

  // Valid note addition
  const noteContent = 'Called customer regarding hardware requirements. Client requested Dell Latitude spec sheet.'
  const { data: noteRes, error: noteSuccessErr } = await employeeClient.rpc('add_enquiry_note', {
    p_enquiry_id: testEnquiryId,
    p_content: noteContent
  })
  assertTest(!noteSuccessErr && noteRes?.success === true, 'Employee successfully records follow-up note via RPC')

  // Verify activity record recorded authoritatively without client spoofing
  const { data: noteActivity, error: fetchActErr } = await employeeClient
    .from('enquiry_activities')
    .select('id, actor_id, actor_email, actor_role, activity_type, content')
    .eq('enquiry_id', testEnquiryId)
    .eq('activity_type', 'note')
    .single()

  assertTest(!fetchActErr && noteActivity, 'Note is persisted in append-only enquiry_activities table')
  assertTest(noteActivity?.actor_id === empAuth.user.id, 'Actor ID is authenticated user ID (not client spoofed)')
  assertTest(noteActivity?.actor_role === 'admin', 'Actor role is verified database role "admin"')
  assertTest(noteActivity?.content === noteContent, 'Note content matches recorded text')

  // --------------------------------------------------------------------------
  // SUITE 4: Operational Progress Transitions & State Rules (Safeguard 4)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4] Testing Operational Progress State Transitions:')

  // Transition 1: new -> in_progress (Employee allowed)
  const { data: prog1, error: prog1Err } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'in_progress'
  })
  assertTest(!prog1Err && prog1?.new_status === 'in_progress', 'Employee advances enquiry progress: "new" -> "in_progress"')

  // Transition 2: in_progress -> quoted (Employee allowed)
  const { data: prog2, error: prog2Err } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'quoted'
  })
  assertTest(!prog2Err && prog2?.new_status === 'quoted', 'Employee advances enquiry progress: "in_progress" -> "quoted"')

  // Transition 3: quoted -> closed (Employee unauthorized to close)
  const { error: empCloseErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'closed'
  })
  assertTest(Boolean(empCloseErr), 'Employee is blocked from transitioning enquiry to terminal status "closed"', empCloseErr?.message)

  // Transition 4: quoted -> rejected (Employee unauthorized to directly reject)
  const { error: empRejErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'rejected'
  })
  assertTest(Boolean(empRejErr), 'Employee is blocked from directly marking enquiry "rejected"', empRejErr?.message)

  // Verify status in DB remains "quoted"
  const { data: currentEnq } = await employeeClient
    .from('enquiries')
    .select('status')
    .eq('id', testEnquiryId)
    .single()
  assertTest(currentEnq?.status === 'quoted', 'Enquiry status remains securely at "quoted"')

  // --------------------------------------------------------------------------
  // SUITE 5: Rejection Request & Concurrency Guards (Safeguard 1 & 4)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 5] Testing Rejection Request & Concurrency Guards:')

  // Reason too short (< 5 chars)
  const { error: shortRejErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_reason: 'bad'
  })
  assertTest(Boolean(shortRejErr), 'Rejection request with reason < 5 characters is rejected', shortRejErr?.message)

  // Valid rejection request
  const rejectionReason = 'Requested workstation models are out of stock and manufacturer discontinued.'
  const { data: reqRes, error: reqErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_reason: rejectionReason
  })
  assertTest(!reqErr && reqRes?.status === 'rejection_requested', 'Employee successfully submits rejection request with mandatory reason')

  // Verify enquiry state
  const { data: pendingEnq } = await employeeClient
    .from('enquiries')
    .select('status, previous_status, rejection_reason, rejection_requested_by')
    .eq('id', testEnquiryId)
    .single()

  assertTest(pendingEnq?.status === 'rejection_requested', 'Enquiry status changed to "rejection_requested"')
  assertTest(pendingEnq?.previous_status === 'quoted', 'Enquiry previous_status is preserved as "quoted"')
  assertTest(pendingEnq?.rejection_reason === rejectionReason, 'Rejection reason is recorded on enquiry')
  assertTest(pendingEnq?.rejection_requested_by === empAuth.user.id, 'Requester ID matches employee ID')

  // Concurrency guard: Duplicate rejection request while already pending
  const { error: dupRejErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_reason: 'Duplicate attempt to request rejection'
  })
  assertTest(Boolean(dupRejErr), 'Duplicate rejection request while pending review is rejected with conflict error', dupRejErr?.message)

  // Guard: Cannot change progress while pending rejection review
  const { error: progWhileRejErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'in_progress'
  })
  assertTest(Boolean(progWhileRejErr), 'Updating progress while rejection review is pending is strictly blocked', progWhileRejErr?.message)

  // --------------------------------------------------------------------------
  // SUITE 6: Head-Person Approval / Denial & Rejection History (Safeguard 1 & 2)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 6] Testing Head-Person Review, Denial, and Repeat Rejection History:')

  // Employee attempting to review / approve rejection request
  const { error: empReviewErr } = await employeeClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_decision: 'approved'
  })
  assertTest(Boolean(empReviewErr), 'Employee attempt to review/approve rejection is blocked (superadmin only)', empReviewErr?.message)

  // Superadmin denies first rejection request
  const reviewNoteDenial = 'Alternative ThinkPad workstation model is available. Propose alternative to client.'
  const { data: denyRes, error: denyErr } = await superadminClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_decision: 'denied',
    p_review_notes: reviewNoteDenial
  })
  assertTest(!denyErr && denyRes?.new_status === 'quoted', 'Superadmin denies rejection request -> reverts status to previous ("quoted")', denyErr?.message || JSON.stringify(denyRes))

  // Verify enquiry cleared pending rejection fields but reverted status
  const { data: revertedEnq } = await employeeClient
    .from('enquiries')
    .select('status, rejection_reason, rejection_requested_by')
    .eq('id', testEnquiryId)
    .single()
  assertTest(revertedEnq?.status === 'quoted', 'Enquiry status is restored to operational status "quoted"')
  assertTest(revertedEnq?.rejection_reason === null, 'Enquiry active rejection_reason is cleared')

  // REPEAT REJECTION REQUEST: Employee submits a second rejection request after customer rejects alternative
  const secondRejectionReason = 'Customer declined alternative ThinkPad model and requested full quote cancellation.'
  const { data: secondReqRes, error: secondReqErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_reason: secondRejectionReason
  })
  assertTest(!secondReqErr && secondReqRes?.status === 'rejection_requested', 'Repeat rejection request submitted after denial succeeds')

  // Verify COMPLETE history is preserved in enquiry_activities (Safeguard 1)
  const { data: allActivities } = await employeeClient
    .from('enquiry_activities')
    .select('activity_type, content, metadata, created_at')
    .eq('enquiry_id', testEnquiryId)
    .order('created_at', { ascending: true })

  const rejReqActivities = allActivities.filter((a) => a.activity_type === 'rejection_requested')
  const rejRevActivities = allActivities.filter((a) => a.activity_type === 'rejection_reviewed')

  assertTest(rejReqActivities.length === 2, `Both rejection requests preserved in immutable activity log (found ${rejReqActivities.length})`)
  assertTest(rejRevActivities.length === 1, `Previous denial decision preserved in activity log (found ${rejRevActivities.length})`)
  assertTest(rejReqActivities[0].content === rejectionReason, 'First rejection reason preserved intact')
  assertTest(rejReqActivities[1].content === secondRejectionReason, 'Second rejection reason recorded accurately')
  assertTest(rejRevActivities[0].metadata?.decision === 'denied', 'Denial decision metadata preserved with reviewer info')

  // Superadmin approves the second rejection request
  const { data: approveRes, error: approveErr } = await superadminClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testEnquiryId,
    p_decision: 'approved',
    p_review_notes: 'Confirmed client declined alternative. Rejection approved.'
  })
  assertTest(!approveErr && approveRes?.new_status === 'rejected', 'Superadmin approves second rejection -> status set to "rejected"')

  // --------------------------------------------------------------------------
  // SUITE 7: Archive & Restore Lifecycle (Safeguard 4)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 7] Testing Archive & Restore Controls:')

  // Employee attempting to archive
  const { error: empArchiveErr } = await employeeClient.rpc('archive_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(Boolean(empArchiveErr), 'Employee is blocked from calling archive_enquiry (superadmin only)', empArchiveErr?.message)

  // Superadmin archives enquiry
  const { data: archRes, error: archErr } = await superadminClient.rpc('archive_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(!archErr && archRes?.is_archived === true, 'Superadmin archives enquiry successfully')

  // Verify enquiry in DB is archived but status is preserved
  const { data: archivedEnq } = await superadminClient
    .from('enquiries')
    .select('is_archived, status, archived_by')
    .eq('id', testEnquiryId)
    .single()
  assertTest(archivedEnq?.is_archived === true, 'Enquiry is_archived flag is true')
  assertTest(archivedEnq?.status === 'rejected', 'Underlying status ("rejected") is preserved without corruption')
  assertTest(archivedEnq?.archived_by === superAuth.user.id, 'archived_by matches superadmin ID')

  // Concurrency guard: Duplicate archive on already archived enquiry
  const { error: dupArchErr } = await superadminClient.rpc('archive_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(Boolean(dupArchErr), 'Duplicate archive call on already-archived enquiry is rejected', dupArchErr?.message)

  // Guard: Cannot update progress of archived enquiry
  const { error: progOnArchErr } = await superadminClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testEnquiryId,
    p_next_status: 'in_progress'
  })
  assertTest(Boolean(progOnArchErr), 'Updating progress on an archived enquiry is rejected', progOnArchErr?.message)

  // Employee attempting to restore
  const { error: empRestoreErr } = await employeeClient.rpc('restore_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(Boolean(empRestoreErr), 'Employee is blocked from calling restore_enquiry (superadmin only)', empRestoreErr?.message)

  // Superadmin restores enquiry
  const { data: restoreRes, error: restoreErr } = await superadminClient.rpc('restore_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(!restoreErr && restoreRes?.is_archived === false, 'Superadmin restores enquiry from archive')

  // Verify enquiry restored in DB
  const { data: restoredEnq } = await superadminClient
    .from('enquiries')
    .select('is_archived, status, archived_by, archived_at')
    .eq('id', testEnquiryId)
    .single()
  assertTest(restoredEnq?.is_archived === false, 'Enquiry is_archived is false after restore')
  assertTest(restoredEnq?.archived_by === null && restoredEnq?.archived_at === null, 'Archive metadata cleared on restore')
  assertTest(restoredEnq?.status === 'rejected', 'Enquiry status preserved as "rejected" upon restoration')

  // Concurrency guard: Duplicate restore on non-archived enquiry
  const { error: dupRestoreErr } = await superadminClient.rpc('restore_enquiry', {
    p_enquiry_id: testEnquiryId
  })
  assertTest(Boolean(dupRestoreErr), 'Duplicate restore call on active enquiry is rejected', dupRestoreErr?.message)

  // --------------------------------------------------------------------------
  // SUITE 8: Assignment & Visibility Inspection (Safeguard 3)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 8] Documenting & Verifying Visibility Model (Safeguard 3):')

  const { data: empVisibleEnquiries, error: empVisErr } = await employeeClient
    .from('enquiries')
    .select('id, name, status, is_archived')

  const { data: superVisibleEnquiries, error: superVisErr } = await superadminClient
    .from('enquiries')
    .select('id, name, status, is_archived')

  assertTest(!empVisErr && Array.isArray(empVisibleEnquiries), 'Employee can query enquiries table under public.is_admin() policy')
  assertTest(!superVisErr && Array.isArray(superVisibleEnquiries), 'Superadmin can query enquiries table under public.is_admin() policy')
  assertTest(
    empVisibleEnquiries.length === superVisibleEnquiries.length,
    `Shared visibility confirmed: All active staff view all enquiries (${empVisibleEnquiries.length} rows seen by both)`
  )

  console.log('  ℹ️ NOTATION (Safeguard 3): Current schema uses shared administrative visibility ("Admins can view enquiries").')
  console.log('     Individual staff enquiry assignment is not implemented in this phase and shared visibility is preserved.')

  // --------------------------------------------------------------------------
  // Clean up disposable test record
  // --------------------------------------------------------------------------
  await superadminClient.from('enquiries').delete().eq('id', testEnquiryId)

  console.log('====================================================================')
  console.log(`Phase 2 Test Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase2Tests().catch((err) => {
  console.error('Unhandled test failure:', err)
  process.exit(1)
})
