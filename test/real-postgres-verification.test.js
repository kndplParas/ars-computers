/**
 * ARS Computers — Real Isolated PostgreSQL Database Execution Verification
 * Strictly connects to local isolated Supabase instance (http://127.0.0.1:54321).
 * Tests all Phase 2 requirements against real PostgreSQL execution.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { downloadMonthlyEnquiriesExcel, filterEnquiriesByReportingMonth } from '../src/utils/excelReportGenerator.js'

function executeSql(sql) {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const stmt of statements) {
    const tmpPath = path.join(
      process.cwd(),
      'supabase',
      '.temp',
      `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sql`
    )
    fs.writeFileSync(tmpPath, stmt + ';', 'utf8')
    try {
      execSync(`npx supabase db query --local -f "${tmpPath}"`, { encoding: 'utf8' })
    } catch (err) {
      console.error('SQL EXECUTION FAILED:\nSTATEMENT:\n', stmt, '\nSTDOUT:\n', err.stdout, '\nSTDERR:\n', err.stderr)
      throw err
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    }
  }
}

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const HEAD_EMAIL = 'head.verifier@arscomputers.in'
const HEAD_PASSWORD = 'HeadVerifier#2026!Secure'
const EMP_EMAIL = 'emp.verifier@arscomputers.in'
const EMP_PASSWORD = 'EmpVerifier#2026!Secure'

const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let headUser = null
let empUser = null
let headClient = null
let empClient = null

test.before(async () => {
  // 1. Provision Head (superadmin)
  const { error: headAuthErr } = await serviceClient.auth.admin.createUser({
    email: HEAD_EMAIL,
    password: HEAD_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Ankit Bathla (Head)' }
  })
  if (headAuthErr && !headAuthErr.message.toLowerCase().includes('already')) {
    throw new Error(`Failed to create head user: ${headAuthErr.message}`)
  }
  const { data: users } = await serviceClient.auth.admin.listUsers()
  headUser = users.users.find((u) => u.email === HEAD_EMAIL)

  await serviceClient.from('admin_users').upsert({
    id: headUser.id,
    email: HEAD_EMAIL,
    role: 'superadmin',
    full_name: 'Ankit Bathla',
    employee_code: 'ARS-HEAD-001',
    is_active: true
  })

  // 2. Provision Employee (admin)
  const { data: empAuth, error: empAuthErr } = await serviceClient.auth.admin.createUser({
    email: EMP_EMAIL,
    password: EMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Rohan Sharma (Technician)' }
  })
  if (empAuthErr && !empAuthErr.message.toLowerCase().includes('already')) {
    throw new Error(`Failed to create emp user: ${empAuthErr.message}`)
  }
  empUser = users.users.find((u) => u.email === EMP_EMAIL) || empAuth?.user

  await serviceClient.from('admin_users').upsert({
    id: empUser.id,
    email: EMP_EMAIL,
    role: 'admin',
    full_name: 'Rohan Sharma',
    employee_code: 'ARS-EMP-007',
    is_active: true
  })

  // 3. Authenticate clients
  headClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: headLoginErr } = await headClient.auth.signInWithPassword({
    email: HEAD_EMAIL,
    password: HEAD_PASSWORD
  })
  assert.ifError(headLoginErr, 'Head login must succeed')

  empClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { error: empLoginErr } = await empClient.auth.signInWithPassword({
    email: EMP_EMAIL,
    password: EMP_PASSWORD
  })
  assert.ifError(empLoginErr, 'Employee login must succeed')

  executeSql('DELETE FROM public.enquiry_rate_limits;')
})

test('PostgreSQL Workflow: Full Lifecycle, Server-Derived Snapshots & Delete Blockers', async (t) => {
  let enquiryId = null

  await t.test('1. Insert representative customer enquiry and verify atomic enquiry_number sequence', async () => {
    const { data: insertData, error: insertErr } = await serviceClient
      .from('enquiries')
      .insert({
        name: 'Vikas Kumar',
        contact_info: '+91 98765 43210, vikas@example.com',
        category_interest: 'general',
        message: 'Need urgent CCTV surveillance installation for showroom and 4 cameras setup.'
      })
      .select()
      .single()

    assert.ifError(insertErr, 'Insert should succeed')
    assert.ok(insertData.id, 'Must have UUID id')
    assert.match(insertData.enquiry_number, /^ARS-ENQ-\d{5}$/, 'enquiry_number must match sequence pattern ARS-ENQ-XXXXX')
    enquiryId = insertData.id
  })

  await t.test('2. Employee submits completion and server derives identity snapshots', async () => {
    const { data: submitRes, error: submitErr } = await empClient.rpc('submit_enquiry_completion', {
      p_enquiry_id: enquiryId,
      p_completion_summary: 'Completed camera wiring, configured NVR recorder, tested remote mobile viewing successfully.'
    })

    assert.ifError(submitErr, 'submit_enquiry_completion RPC should succeed')
    assert.equal(submitRes.success, true)
    assert.equal(submitRes.status, 'completion_requested')

    // Verify row directly in PostgreSQL
    const { data: dbRow, error: fetchErr } = await serviceClient
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single()

    assert.ifError(fetchErr)
    assert.equal(dbRow.status, 'completion_requested')
    assert.equal(dbRow.completion_requested_by, empUser.id, 'Must record auth.uid() server-side')
    assert.equal(dbRow.completed_by_name, 'Rohan Sharma', 'Must snapshot employee full name from admin_users')
    assert.equal(dbRow.completed_by_employee_code, 'ARS-EMP-007', 'Must snapshot employee code from admin_users')
    assert.ok(dbRow.completion_requested_at, 'Must record timestamp')
    assert.equal(
      dbRow.completion_summary,
      'Completed camera wiring, configured NVR recorder, tested remote mobile viewing successfully.'
    )
  })

  await t.test('3. Employee self-approval attempt MUST FAIL', async () => {
    const { error: selfApproveErr } = await empClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enquiryId,
      p_decision: 'approved',
      p_review_notes: 'Self approval attempt by employee'
    })

    assert.ok(selfApproveErr, 'Employee review attempt must fail with authorization error')
    assert.match(
      selfApproveErr.message,
      /superadministrator/i,
      'Error message must indicate superadministrator requirement'
    )
  })

  await t.test('4. Head approves completion: permanently archives with server-derived Head snapshot', async () => {
    const { data: approveRes, error: approveErr } = await headClient.rpc('review_enquiry_completion', {
      p_enquiry_id: enquiryId,
      p_decision: 'approved',
      p_review_notes: 'Verified CCTV installation checklist and customer sign-off. Approved.'
    })

    assert.ifError(approveErr, 'Head approval must succeed')
    assert.equal(approveRes.success, true)
    assert.equal(approveRes.status, 'completed')

    // Inspect PostgreSQL row
    const { data: approvedRow, error: fetchErr } = await serviceClient
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single()

    assert.ifError(fetchErr)
    assert.equal(approvedRow.status, 'completed', 'Status must be completed')
    assert.equal(approvedRow.is_archived, true, 'is_archived must be true')
    assert.equal(approvedRow.is_in_bin, false, 'is_in_bin must be false')
    assert.equal(approvedRow.scheduled_deletion_at, null, 'scheduled_deletion_at must be NULL')
    assert.equal(approvedRow.completion_approved_by, headUser.id, 'Must record Head auth.uid()')
    assert.equal(approvedRow.approved_by_name, 'Ankit Bathla', 'Must snapshot Head name')
    assert.equal(approvedRow.approved_by_employee_code, 'ARS-HEAD-001', 'Must snapshot Head code')
    assert.ok(approvedRow.completion_approved_at, 'Must have completion_approved_at timestamp')
    assert.equal(approvedRow.approval_remarks, 'Verified CCTV installation checklist and customer sign-off. Approved.')
  })

  await t.test('5. Attempt to direct DELETE approved enquiry MUST FAIL at database level', async () => {
    const { error: deleteErr } = await serviceClient
      .from('enquiries')
      .delete()
      .eq('id', enquiryId)

    assert.ok(deleteErr, 'Direct delete must be blocked by database trigger')
    assert.match(
      deleteErr.message,
      /(permanent archive protection.*cannot be deleted|audit logs and activity histories are strictly append-only)/i,
      'Trigger error must explain permanent archive protection or audit immutability'
    )

    // Verify row still exists
    const { data: checkRow } = await serviceClient
      .from('enquiries')
      .select('id')
      .eq('id', enquiryId)
      .single()
    assert.ok(checkRow, 'Enquiry must still exist in database')
  })

  await t.test('6. Purge execution: Approved completed enquiry MUST SURVIVE', async () => {
    // Attempt purge with 0 grace seconds
    const { error: purgeErr } = await headClient.rpc('purge_expired_bin_enquiries', {
      p_retention_grace_seconds: 0
    })
    assert.ifError(purgeErr)

    // Confirm enquiry is unaffected
    const { data: survivingRow } = await serviceClient
      .from('enquiries')
      .select('id, status, is_archived')
      .eq('id', enquiryId)
      .single()

    assert.ok(survivingRow, 'Approved record must survive purge')
    assert.equal(survivingRow.status, 'completed')
  })

  await t.test('7. Attempt to restore/reopen approved enquiry MUST FAIL', async () => {
    const { error: restoreErr } = await headClient.rpc('restore_enquiry', {
      p_enquiry_id: enquiryId
    })

    assert.ok(restoreErr, 'Restoring completed enquiry must fail')
    assert.match(
      restoreErr.message,
      /cannot be unarchived or reopened/i,
      'Must explain approved enquiries cannot be unarchived'
    )
  })

  await t.test('8. Authorized staff can SELECT archived record, but public cannot', async () => {
    // Employee can select
    const { data: empRead, error: empReadErr } = await empClient
      .from('enquiries')
      .select('id, enquiry_number, status, completed_by_name, approved_by_name')
      .eq('id', enquiryId)
      .single()

    assert.ifError(empReadErr)
    assert.equal(empRead.id, enquiryId)
    assert.equal(empRead.completed_by_name, 'Rohan Sharma')
    assert.equal(empRead.approved_by_name, 'Ankit Bathla')

    // Anonymous cannot select
    const { data: anonRead } = await anonClient
      .from('enquiries')
      .select('id')
      .eq('id', enquiryId)

    assert.equal(anonRead?.length || 0, 0, 'Anonymous user must receive 0 records')
  })
})

test('PostgreSQL Cross-Month Reporting Invariant Test', async () => {
  // Insert an enquiry created in September 2026 (status 'new' enforced by trigger)
  const { data: crossMonthEnq, error: createErr } = await serviceClient
    .from('enquiries')
    .insert({
      name: 'Ramesh Patel',
      contact_info: 'ramesh@example.com',
      category_interest: 'laptop',
      message: 'Laptop motherboard rework and battery replacement.',
      created_at: '2026-09-30T10:00:00.000Z'
    })
    .select()
    .single()

  assert.ifError(createErr)
  assert.equal(crossMonthEnq.status, 'new')

  // Employee submits completion
  const { error: submitErr } = await empClient.rpc('submit_enquiry_completion', {
    p_enquiry_id: crossMonthEnq.id,
    p_completion_summary: 'Replaced motherboard charging IC and verified battery charging cycle.'
  })
  assert.ifError(submitErr)

  // Head approves completion today (October 2026)
  const { error: approveErr } = await headClient.rpc('review_enquiry_completion', {
    p_enquiry_id: crossMonthEnq.id,
    p_decision: 'approved',
    p_review_notes: 'Tested and verified. Approved for customer handover.'
  })
  assert.ifError(approveErr)

  // Fetch all archived enquiries from database
  const { data: allArchived, error: fetchErr } = await serviceClient
    .from('enquiries')
    .select('*')
    .eq('status', 'completed')
    .eq('is_archived', true)

  assert.ifError(fetchErr)

  // 1. Filter for September 2026 (Month index 8) -> created_at was Sept 30, but approval was Oct
  const septemberReport = filterEnquiriesByReportingMonth(allArchived, 8, 2026)
  const inSeptember = septemberReport.some((e) => e.id === crossMonthEnq.id)
  assert.equal(inSeptember, false, 'Enquiry created in September but approved in October MUST NOT appear in September report')

  // 2. Filter for October 2026 (Month index 9) -> approval was in October
  const octoberReport = filterEnquiriesByReportingMonth(allArchived, 9, 2026)
  const inOctober = octoberReport.some((e) => e.id === crossMonthEnq.id)
  assert.equal(inOctober, true, 'Enquiry created in September but approved in October MUST appear in October report')

  // 3. Generate real XLSX for October 2026 with ExcelJS
  const { buffer, filename, count } = await downloadMonthlyEnquiriesExcel(
    allArchived,
    9,
    2026
  )

  assert.equal(filename, 'ARS_Enquiries_October_2026.xlsx', 'Filename must match ARS_Enquiries_<Month>_<Year>.xlsx')
  assert.ok(count >= 2, 'Must contain at least 2 records approved in October')
  assert.ok(buffer.byteLength > 1000, 'Buffer must be valid binary XLSX')

  // 4. Verify XLSX workbook contents by reading it back
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.getWorksheet('October 2026 Enquiries')
  assert.ok(worksheet, 'Must have "October 2026 Enquiries" sheet')

  // Header row is row 1 with 18 columns
  const headerRow = worksheet.getRow(1)
  assert.equal(headerRow.getCell(1).value, 'Enquiry ID')
  assert.equal(headerRow.getCell(2).value, 'Customer Name')
  assert.equal(headerRow.getCell(3).value, 'Contact Information')
  assert.equal(headerRow.getCell(8).value, 'Completed By')
  assert.equal(headerRow.getCell(9).value, 'Completed By Employee ID/Code')
  assert.equal(headerRow.getCell(13).value, 'Approved By')
  assert.equal(headerRow.getCell(14).value, 'Approval Date')
  assert.equal(headerRow.getCell(17).value, 'Final Status')
  assert.equal(headerRow.getCell(18).value, 'Archive Date')

  // Verify cross-month row data in sheet
  let foundCrossMonthRow = false
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && row.getCell(2).value === 'Ramesh Patel') {
      foundCrossMonthRow = true
      assert.equal(row.getCell(3).value, 'ramesh@example.com')
      assert.equal(row.getCell(8).value, 'Rohan Sharma')
      assert.equal(row.getCell(9).value, 'ARS-EMP-007')
      assert.equal(row.getCell(13).value, 'Ankit Bathla')
      assert.equal(row.getCell(17).value, 'completed')
    }
  })
  assert.ok(foundCrossMonthRow, 'Cross-month row must be correctly written to XLSX')
})

test('PostgreSQL Migration Regression: Legacy Approved Bin Record Transition to Permanent Archive', async () => {
  const legacyId = crypto.randomUUID()

  // Drop constraint to simulate pre-migration legacy database condition
  executeSql(`
    ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS chk_enquiries_approved_not_in_bin;
  `)

  // 1. Insert a legacy Head-approved record simulating Phase 1 old Bin lifecycle
  executeSql(`
    ALTER TABLE public.enquiries DISABLE TRIGGER USER;
    INSERT INTO public.enquiries (
      id, name, contact_info, category_interest, message,
      status, is_in_bin, scheduled_deletion_at, is_archived,
      completion_approved_at, completion_approved_by,
      completion_summary, completion_requested_by, completion_requested_at,
      created_at
    ) VALUES (
      '${legacyId}', 'Legacy Production Customer', 'legacy.prod@example.com', 'Hardware Repair', 'Display flickering on RTX 4070 laptop',
      'in_bin', true, '2026-11-04 10:00:00+00', false,
      '2026-10-24 10:00:00+00', '${headUser.id}',
      'Replaced internal eDP cable and stress-tested display', '${empUser.id}', '2026-10-24 09:15:00+00',
      '2026-10-23 14:00:00+00'
    );
    ALTER TABLE public.enquiries ENABLE TRIGGER USER;
  `)

  // Verify it exists in the legacy condition
  const { data: preMigration, error: preErr } = await serviceClient
    .from('enquiries')
    .select('*')
    .eq('id', legacyId)
    .single()
  assert.ifError(preErr)
  assert.equal(preMigration.status, 'in_bin')
  assert.equal(preMigration.is_in_bin, true)
  assert.ok(preMigration.scheduled_deletion_at)

  // 2. Execute the migration historical transition query
  executeSql(`
    UPDATE public.enquiries
    SET
      is_in_bin = false,
      scheduled_deletion_at = NULL,
      is_archived = true,
      status = 'completed'
    WHERE completion_approved_at IS NOT NULL
      AND (
        is_in_bin = true
        OR scheduled_deletion_at IS NOT NULL
        OR status = 'in_bin'
      );

    ALTER TABLE public.enquiries ADD CONSTRAINT chk_enquiries_approved_not_in_bin
      CHECK (NOT (completion_approved_at IS NOT NULL AND (is_in_bin = true OR scheduled_deletion_at IS NOT NULL)));
  `)

  // 3. Verify the legacy record was automatically transitioned to permanent archive
  const { data: postMigration, error: postErr } = await serviceClient
    .from('enquiries')
    .select('*')
    .eq('id', legacyId)
    .single()
  assert.ifError(postErr)
  assert.equal(postMigration.status, 'completed', 'Legacy record must now have status="completed"')
  assert.equal(postMigration.is_archived, true, 'Legacy record must now be is_archived=true')
  assert.equal(postMigration.is_in_bin, false, 'Legacy record must now be is_in_bin=false')
  assert.equal(postMigration.scheduled_deletion_at, null, 'Legacy record must have scheduled_deletion_at=null')
  assert.equal(postMigration.completion_approved_at, '2026-10-24T10:00:00+00:00', 'Original approval timestamp must be preserved')
  assert.equal(postMigration.completion_approved_by, headUser.id, 'Original approval identity must be preserved')
  assert.equal(postMigration.name, 'Legacy Production Customer', 'Customer name must be preserved')
  assert.equal(postMigration.contact_info, 'legacy.prod@example.com', 'Customer contact must be preserved')

  // 4. Verify DELETE is blocked at the database level
  const { error: deleteErr } = await serviceClient
    .from('enquiries')
    .delete()
    .eq('id', legacyId)
  assert.ok(deleteErr, 'Direct DELETE on transitioned legacy approved enquiry must fail')
  assert.ok(
    deleteErr.message.toLowerCase().includes('cannot be deleted'),
    `Delete error must mention deletion block, got: ${deleteErr.message}`
  )

  // 5. Verify Purge cannot delete it
  const { error: purgeErr } = await headClient.rpc('purge_expired_bin_enquiries')
  assert.ifError(purgeErr, 'Purge RPC must execute without error')
  const { data: stillAlive } = await serviceClient
    .from('enquiries')
    .select('id')
    .eq('id', legacyId)
    .single()
  assert.ok(stillAlive, 'Transitioned legacy enquiry must survive purge')

  // 6. Verify Restore/Reopen cannot reactivate it
  const { error: restoreErr } = await headClient.rpc('restore_enquiry', { p_enquiry_id: legacyId })
  assert.ok(restoreErr, 'restore_enquiry must fail on transitioned legacy approved enquiry')
  assert.ok(
    restoreErr.message.toLowerCase().includes('cannot be unarchived or reopened'),
    `Restore error must reject approved enquiry, got: ${restoreErr.message}`
  )

  // 7. Verify Monthly reporting still uses original completion_approved_at
  const octReport = filterEnquiriesByReportingMonth([postMigration], 9, 2026)
  assert.equal(octReport.length, 1, 'October 24 approved enquiry must belong to October report')
  const novReport = filterEnquiriesByReportingMonth([postMigration], 10, 2026)
  assert.equal(novReport.length, 0, 'October 24 approved enquiry must NOT belong to November report')
})
