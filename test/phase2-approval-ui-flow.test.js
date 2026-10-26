/**
 * ============================================================================
 * ARS Computers — Phase 2 Rejection Review & Approval Verification Suite
 * ============================================================================
 * Verifies:
 * 1. Dedicated test enquiry creation and employee rejection requests.
 * 2. Strict backend denial when employees attempt to approve/deny rejections.
 * 3. Superadmin authorization to Approve (status -> 'rejected') and Deny (status -> previous_status).
 * 4. Preservation of immutable activity timelines with decision records and review notes.
 * 5. Frontend UI component invariants for Superadmin review controls.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

async function runApprovalSuite() {
  console.log('\n====================================================================')
  console.log('ARS Computers — Rejection Review & Approval Verification Suite')
  console.log('====================================================================')

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

  // --- 1. Create Dedicated Test Enquiries ---
  console.log('\n[Phase 1] Creating Dedicated Test Enquiries:')
  const emailA = `test.approval.a.${Date.now()}@example.com`
  const emailB = `test.denial.b.${Date.now()}@example.com`

  const { error: insAErr } = await anonClient.from('enquiries').insert([{
    name: 'Approval Flow Test Customer A',
    contact_info: emailA,
    category_interest: 'computer-laptop',
    message: 'Test enquiry A for verifying Superadmin APPROVE rejection workflow.'
  }])
  assertTest(!insAErr, 'Test Enquiry A created successfully via public submission', insAErr?.message)

  const { data: enqARow } = await employeeClient
    .from('enquiries')
    .select('id')
    .eq('contact_info', emailA)
    .single()
  const testAId = enqARow?.id

  const { error: insBErr } = await anonClient.from('enquiries').insert([{
    name: 'Denial Flow Test Customer B',
    contact_info: emailB,
    category_interest: 'computer-laptop',
    message: 'Test enquiry B for verifying Superadmin DENY rejection workflow.'
  }])
  assertTest(!insBErr, 'Test Enquiry B created successfully via public submission', insBErr?.message)

  const { data: enqBRow } = await employeeClient
    .from('enquiries')
    .select('id')
    .eq('contact_info', emailB)
    .single()
  const testBId = enqBRow?.id

  // --- 2. Employee Progresses Enquiries and Requests Rejection ---
  console.log('\n[Phase 2] Employee Advances Progress and Submits Rejection Requests:')
  const { error: progAErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testAId,
    p_next_status: 'quoted'
  })
  assertTest(!progAErr, 'Employee advances Enquiry A to "quoted"')

  const { error: progBErr } = await employeeClient.rpc('update_enquiry_progress', {
    p_enquiry_id: testBId,
    p_next_status: 'quoted'
  })
  assertTest(!progBErr, 'Employee advances Enquiry B to "quoted"')

  const { data: reqARes, error: reqAErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testAId,
    p_reason: 'Requested rackmount server components are permanently end-of-life.'
  })
  assertTest(!reqAErr && reqARes?.status === 'rejection_requested', 'Employee requests rejection for Enquiry A with reason')

  const { data: reqBRes, error: reqBErr } = await employeeClient.rpc('request_enquiry_rejection', {
    p_enquiry_id: testBId,
    p_reason: 'Client did not reply to initial quotation email; requested closing.'
  })
  assertTest(!reqBErr && reqBRes?.status === 'rejection_requested', 'Employee requests rejection for Enquiry B with reason')

  // --- 3. Verify Employee Cannot Approve or Deny Rejections ---
  console.log('\n[Phase 3] Testing Employee Rejection Review Denial (Least-Privilege):')
  const { error: empApproveErr } = await employeeClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testAId,
    p_decision: 'approved',
    p_review_notes: 'Employee attempting unauthorized approval'
  })
  assertTest(
    Boolean(empApproveErr && (empApproveErr.code === '42501' || empApproveErr.message.includes('Only superadministrators'))),
    'Employee attempt to approve rejection is strictly blocked by database RPC'
  )

  const { error: empDenyErr } = await employeeClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testBId,
    p_decision: 'denied',
    p_review_notes: 'Employee attempting unauthorized denial'
  })
  assertTest(
    Boolean(empDenyErr && (empDenyErr.code === '42501' || empDenyErr.message.includes('Only superadministrators'))),
    'Employee attempt to deny rejection is strictly blocked by database RPC'
  )

  // --- 4. Superadmin Approves Enquiry A ---
  console.log('\n[Phase 4] Superadmin Reviews and APPROVES Rejection on Enquiry A:')
  const { data: approveData, error: approveErr } = await superadminClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testAId,
    p_decision: 'approved',
    p_review_notes: 'Approved by Head Person - verified component EOL status with distributor.'
  })
  assertTest(!approveErr && approveData?.success === true, 'Superadmin successfully approves Enquiry A rejection')
  assertTest(approveData?.new_status === 'rejected', 'Resulting status for Enquiry A is strictly "rejected"')

  const { data: postApproveEnq } = await superadminClient
    .from('enquiries')
    .select('id, status, rejection_reason')
    .eq('id', testAId)
    .single()
  assertTest(postApproveEnq?.status === 'rejected', 'Enquiry A persisted status in database is "rejected"')
  assertTest(Boolean(postApproveEnq?.rejection_reason), 'Enquiry A preserves original employee rejection reason for audit')

  // --- 5. Superadmin Denies Enquiry B and Restores Previous Status ---
  console.log('\n[Phase 5] Superadmin Reviews and DENIES Rejection on Enquiry B:')
  const { data: denyData, error: denyErr } = await superadminClient.rpc('review_enquiry_rejection', {
    p_enquiry_id: testBId,
    p_decision: 'denied',
    p_review_notes: 'Denied by Head Person - client requested WhatsApp follow-up instead of email. Continue outreach.'
  })
  assertTest(!denyErr && denyData?.success === true, 'Superadmin successfully denies Enquiry B rejection')
  assertTest(denyData?.new_status === 'quoted', 'Denial restores previous operational status "quoted"')

  const { data: postDenyEnq } = await superadminClient
    .from('enquiries')
    .select('id, status, previous_status, rejection_reason, rejection_requested_by')
    .eq('id', testBId)
    .single()
  assertTest(postDenyEnq?.status === 'quoted', 'Enquiry B persisted status in database is restored to "quoted"')
  assertTest(postDenyEnq?.rejection_reason === null, 'Enquiry B active rejection_reason is cleared upon denial')
  assertTest(postDenyEnq?.rejection_requested_by === null, 'Enquiry B active rejection_requested_by is cleared upon denial')

  // --- 6. Verify Immutable Activity Timeline Records ---
  console.log('\n[Phase 6] Verifying Immutable Activity Timeline Records:')
  const { data: actsA } = await superadminClient
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', testAId)
    .order('created_at', { ascending: true })

  const approveEvent = actsA?.find((a) => a.activity_type === 'rejection_reviewed')
  assertTest(Boolean(approveEvent), 'Enquiry A activity log contains "rejection_reviewed" event')
  assertTest(approveEvent?.metadata?.decision === 'approved', 'Activity log records decision as "approved"')
  assertTest(approveEvent?.metadata?.reviewer_email === SUPERADMIN_EMAIL, 'Activity log records reviewer email accurately')
  assertTest(approveEvent?.content?.includes('verified component EOL'), 'Activity log records superadmin review notes')

  const { data: actsB } = await superadminClient
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', testBId)
    .order('created_at', { ascending: true })

  const denyEvent = actsB?.find((a) => a.activity_type === 'rejection_reviewed')
  assertTest(Boolean(denyEvent), 'Enquiry B activity log contains "rejection_reviewed" event')
  assertTest(denyEvent?.metadata?.decision === 'denied', 'Activity log records decision as "denied"')
  assertTest(denyEvent?.metadata?.resulting_status === 'quoted', 'Activity log records restored status "quoted"')
  assertTest(denyEvent?.content?.includes('WhatsApp follow-up'), 'Activity log records superadmin denial notes')

  // --- 7. Verify Frontend Component Codebase Invariants ---
  console.log('\n[Phase 7] Verifying Admin Portal UI Component Code Invariants:')
  const pagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
  const pageCode = fs.readFileSync(pagePath, 'utf8')

  assertTest(pageCode.includes('rejection-review-panel'), 'AdminEnquiriesPage renders dedicated rejection-review-panel')
  assertTest(pageCode.includes('approve-rejection-btn') || pageCode.includes('btn-approve-rejection'), 'AdminEnquiriesPage renders Approve Rejection button')
  assertTest(pageCode.includes('deny-rejection-btn') || pageCode.includes('btn-deny-rejection'), 'AdminEnquiriesPage renders Deny Rejection button')
  assertTest(pageCode.includes('rejection-review-notes-input'), 'AdminEnquiriesPage renders review notes input in modal')
  assertTest(pageCode.includes('approve-rejection-action-btn'), 'AdminEnquiriesPage renders quick Approve action button in table/cards')
  assertTest(pageCode.includes('deny-rejection-action-btn'), 'AdminEnquiriesPage renders quick Deny action button in table/cards')
  assertTest(pageCode.includes('reviewConfirmTarget'), 'AdminEnquiriesPage supports review confirmation dialog')
  assertTest(
    pageCode.includes("isSuperadmin ? (") && pageCode.includes("rejection-review-panel"),
    'AdminEnquiriesPage restricts rejection review action controls to Superadmin'
  )

  const cssPath = path.join(projectRoot, 'src', 'App.css')
  const cssCode = fs.readFileSync(cssPath, 'utf8')
  assertTest(cssCode.includes('.btn-approve-rejection'), 'App.css defines .btn-approve-rejection styling')
  assertTest(cssCode.includes('.btn-deny-rejection'), 'App.css defines .btn-deny-rejection styling')

  // Clean up dedicated test enquiries
  await serviceClient.from('enquiries').delete().in('id', [testAId, testBId])
  console.log('\n  Cleanup: Dedicated test enquiries removed cleanly.')

  console.log('\n====================================================================')
  console.log(`Rejection Review Suite Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================\n')

  if (failed > 0) process.exit(1)
}

runApprovalSuite().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
