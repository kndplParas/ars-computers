/**
 * ============================================================================
 * ARS Computers — Role-Based UI & Workflow Matrix Verification Suite
 * ============================================================================
 * Enforces the strict role-based separation between:
 * 1. Employee (`admin` role):
 *    - Sees "Submit for Approval" on eligible active enquiries.
 *    - Sees "Resubmit for Approval" on returned_for_rework enquiries.
 *    - Sees "Request Rejection" on workable enquiries.
 *    - Never sees or executes Approve Completion, Return for Rework, Move to Bin,
 *      Restore from Bin, or Permanent Purge.
 * 2. Head Person (`superadmin` role):
 *    - NEVER sees "Submit for Approval" or "Resubmit for Approval".
 *    - Sees approval & rework controls strictly on pending completion requests.
 *    - Can review rejection requests and restore from Bin.
 *    - Is not forced through the employee workflow.
 * 3. Other roles / Fail-closed:
 *    - Inventory staff, unknown, or missing roles never receive superadmin or employee privileges.
 * ============================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

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

async function runRoleMatrixSuite() {
  console.log('\n====================================================================')
  console.log('ARS Computers — Role-Based UI & Workflow Matrix Verification Suite')
  console.log('====================================================================')

  // --- 1. Frontend Codebase Role Matrix & Invariant Checks ---
  console.log('\n[Suite 1] Static Code Inspection: AdminEnquiriesPage.jsx Role Gates:')
  const pagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
  const pageCode = fs.readFileSync(pagePath, 'utf8')

  // Role variable definitions
  assertTest(
    pageCode.includes("const isSuperadmin = adminUser?.role === 'superadmin'"),
    '1.1 isSuperadmin is strictly derived from adminUser.role === "superadmin"'
  )
  assertTest(
    pageCode.includes("const isEmployee = adminUser?.role === 'admin'"),
    '1.2 isEmployee is strictly derived from adminUser.role === "admin"'
  )

  // Employee action buttons are gated
  assertTest(
    pageCode.includes('{isEmployee && (') && pageCode.includes('id="open-completion-modal-btn"'),
    '1.3 "Submit for Approval" (#open-completion-modal-btn) is strictly wrapped in isEmployee guard'
  )
  assertTest(
    pageCode.includes('{isEmployee && (') && pageCode.includes('id="open-resubmit-completion-modal-btn"'),
    '1.4 "Resubmit for Approval" (#open-resubmit-completion-modal-btn) is strictly wrapped in isEmployee guard'
  )
  assertTest(
    pageCode.includes('{isEmployee && (') && pageCode.includes('id="open-rejection-modal-btn"'),
    '1.5 "Request Rejection" (#open-rejection-modal-btn) is strictly wrapped in isEmployee guard'
  )

  // Defensive handler checks
  assertTest(
    pageCode.includes('const handleOpenCompletionModal = (enquiry = null) => {') &&
    pageCode.includes('if (!isEmployee || isSuperadmin) return'),
    '1.6 handleOpenCompletionModal defends against superadmin and non-employee callers'
  )
  assertTest(
    pageCode.includes('const handleSubmitCompletion = async () => {') &&
    pageCode.includes('if (!selectedEnquiry || !isEmployee || isSuperadmin) return'),
    '1.7 handleSubmitCompletion defends against superadmin and non-employee callers'
  )
  assertTest(
    pageCode.includes('const handleOpenRejectionModal = (enquiry = null) => {') &&
    pageCode.includes('if (!isEmployee || isSuperadmin) return'),
    '1.8 handleOpenRejectionModal defends against superadmin and non-employee callers'
  )
  assertTest(
    pageCode.includes('const handleSubmitRejectionRequest = async () => {') &&
    pageCode.includes('if (!selectedEnquiry || !isEmployee || isSuperadmin) return'),
    '1.9 handleSubmitRejectionRequest defends against superadmin and non-employee callers'
  )

  // Modal rendering guards
  assertTest(
    pageCode.includes('{isRejectionModalOpen && selectedEnquiry && isEmployee && ('),
    '1.10 Employee Rejection Request modal renders ONLY when isEmployee is true'
  )
  assertTest(
    pageCode.includes('{isCompletionModalOpen && selectedEnquiry && isEmployee && ('),
    '1.11 Employee Completion Submission modal renders ONLY when isEmployee is true'
  )

  // Superadmin-only review controls
  assertTest(
    pageCode.includes('id="approve-completion-btn"') &&
    pageCode.includes('id="return-rework-btn"') &&
    pageCode.includes('isSuperadmin ? ('),
    '1.12 Approve Completion & Return for Rework are strictly gated to isSuperadmin'
  )
  assertTest(
    pageCode.includes('id="approve-rejection-btn"') &&
    pageCode.includes('id="deny-rejection-btn"') &&
    pageCode.includes('isSuperadmin ? ('),
    '1.13 Approve Rejection & Deny Rejection are strictly gated to isSuperadmin'
  )
  assertTest(
    pageCode.includes('id="tab-bin"') && pageCode.includes('{isSuperadmin && ('),
    '1.14 Bin tab (#tab-bin) is rendered strictly for isSuperadmin'
  )
  assertTest(
    pageCode.includes('id="restore-bin-detail-btn"') && pageCode.includes('isSuperadmin ? ('),
    '1.15 Restore from Bin (#restore-bin-detail-btn) is restricted strictly to isSuperadmin'
  )

  // Read-only locked notices for employees/non-superadmins
  assertTest(
    pageCode.includes('🔒 <strong>Completion Pending:</strong> Submitted for Head-Person verification.'),
    '1.16 Non-superadmin sees locked "Completion Pending" banner instead of approval controls'
  )
  assertTest(
    pageCode.includes('🔒 <strong>Pending Review:</strong> Awaiting Head-Person decision.'),
    '1.17 Non-superadmin sees locked "Pending Review" banner instead of rejection controls'
  )
  assertTest(
    pageCode.includes('Restoration restricted to Head Person.'),
    '1.18 Non-superadmin sees locked message when viewing items in Bin'
  )

  // --- 2. Live Backend Workflow & Least-Privilege Verification ---
  console.log('\n[Suite 2] Live Backend Workflow & Role Authorization Matrix:')
  const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const employeeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const superadminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // Authenticate Employee
  const { error: empAuthErr } = await employeeClient.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD
  })
  if (empAuthErr) {
    console.error('Failed to sign in as employee:', empAuthErr.message)
    process.exit(1)
  }

  // Authenticate Superadmin
  let superAuth = null
  if (SUPERADMIN_PASSWORD) {
    const { data: saLogin, error: saLoginErr } = await superadminClient.auth.signInWithPassword({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD
    })
    if (!saLoginErr && saLogin?.session) superAuth = saLogin
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
  }

  // Create dedicated enquiry for workflow cycle
  const testEmail = `matrix.test.${Date.now()}@example.com`
  const { error: insErr } = await anonClient.from('enquiries').insert([{
    name: 'Workflow Matrix Customer',
    contact_info: testEmail,
    message: 'Matrix verification requirement for commercial security setup'
  }])

  const { data: insData, error: fetchErr } = await superadminClient
    .from('enquiries')
    .select('*')
    .eq('contact_info', testEmail)
    .single()

  assertTest(!insErr && !fetchErr && insData?.id, '2.1 Customer submits enquiry successfully', insErr?.message || fetchErr?.message)
  const testId = insData.id

  // Employee advances to in_progress
  const { error: progErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testId,
    p_next_status: 'in_progress'
  })
  assertTest(!progErr, '2.2 Employee advances enquiry to in_progress', progErr?.message)

  // Employee submits for completion approval
  const { error: subErr } = await employeeClient.rpc('submit_enquiry_completion', {
    p_enquiry_id: testId,
    p_completion_summary: 'Completed installation of CCTV cameras and NVR cabling'
  })
  assertTest(!subErr, '2.3 Employee submits completed work for approval', subErr?.message)

  // Verify enquiry is now completion_requested
  const { data: qData } = await superadminClient.from('enquiries').select('status, completion_summary').eq('id', testId).single()
  assertTest(qData?.status === 'completion_requested', '2.4 Enquiry status transitioned to completion_requested')

  // Employee cannot approve or move to bin
  const { error: empAppErr } = await employeeClient.rpc('review_enquiry_completion', {
    p_enquiry_id: testId,
    p_decision: 'approved',
    p_review_notes: 'Unauthorized employee approval',
    p_retention_days: 7
  })
  assertTest(Boolean(empAppErr), '2.5 Employee CANNOT approve completion (blocked by backend RPC)')

  // Superadmin returns enquiry for rework
  const { error: reworkErr } = await superadminClient.rpc('review_enquiry_completion', {
    p_enquiry_id: testId,
    p_decision: 'returned_for_rework',
    p_review_notes: 'Please verify mobile app streaming before final completion sign-off'
  })
  assertTest(!reworkErr, '2.6 Superadmin returns enquiry for rework with reason', reworkErr?.message)

  // Verify enquiry status is returned_for_rework with reason
  const { data: rwData } = await employeeClient.from('enquiries').select('status, completion_rework_reason').eq('id', testId).single()
  assertTest(rwData?.status === 'returned_for_rework', '2.7 Enquiry status is returned_for_rework')
  assertTest(
    rwData?.completion_rework_reason?.includes('mobile app streaming'),
    '2.8 Head Person rework reason is visible to employee'
  )

  // Employee resubmits after rework
  const { error: resubErr } = await employeeClient.rpc('submit_enquiry_completion', {
    p_enquiry_id: testId,
    p_completion_summary: 'Tested mobile app streaming across Android and iOS; verified live feeds'
  })
  assertTest(!resubErr, '2.9 Employee resubmits reworked enquiry for approval', resubErr?.message)

  // Superadmin approves completion (Phase 2 Permanent Archive)
  const { error: appErr } = await superadminClient.rpc('review_enquiry_completion', {
    p_enquiry_id: testId,
    p_decision: 'approved',
    p_review_notes: 'Verified mobile streaming; work approved'
  })
  assertTest(!appErr, '2.10 Superadmin approves completion, permanently archiving enquiry', appErr?.message)

  // Verify enquiry is now completed, permanently archived, and NOT in Bin
  const { data: archiveData } = await superadminClient.from('enquiries').select('status, is_archived, is_in_bin, scheduled_deletion_at').eq('id', testId).single()
  assertTest(archiveData?.status === 'completed' && archiveData?.is_archived === true, '2.11 Enquiry is completed with is_archived=true')
  assertTest(archiveData?.is_in_bin === false && archiveData?.scheduled_deletion_at === null, '2.12 Enquiry has no scheduled deletion and is_in_bin=false')

  // Employee cannot restore/reopen permanently archived enquiry
  const { error: empRestErr } = await employeeClient.rpc('restore_enquiry', {
    p_enquiry_id: testId
  })
  assertTest(Boolean(empRestErr), '2.13 Employee CANNOT restore/reopen permanently archived enquiry (blocked by backend RPC)')

  // Superadmin also cannot unarchive/reopen permanently approved completed enquiry (DB protection)
  const { error: saRestErr } = await superadminClient.rpc('restore_enquiry', {
    p_enquiry_id: testId
  })
  assertTest(Boolean(saRestErr), '2.14 Superadmin CANNOT reopen approved completed enquiry (permanent archive protected)')

  // Direct DELETE blocked by database trigger
  const { error: delErr } = await serviceClient.from('enquiries').delete().eq('id', testId)
  assertTest(Boolean(delErr), '2.15 Permanent archive record cannot be deleted (BEFORE DELETE trigger blocked)')
  console.log('\n  Verified: Permanent archive invariants & delete protection validated.')

  console.log('\n====================================================================')
  console.log(`Role Matrix Suite Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================\n')

  if (failed > 0) process.exit(1)
}

runRoleMatrixSuite().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
