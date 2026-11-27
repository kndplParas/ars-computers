/**
 * ============================================================================
 * ARS Computers — Real Isolated PostgreSQL Enquiry Editing Integration Tests
 * ============================================================================
 * Strictly connects to the isolated local PostgreSQL instance (PostgreSQL 17.11)
 * running in the disposable database 'test_enquiry_editing'.
 * Baseline: Every migration up to 20261123000027_make_enquiry_email_optional.sql.
 * Never connects to production Supabase or shared database.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'

const CONTAINER_NAME = 'supabase_db_ARS_Computers'
const DB_NAME = 'test_enquiry_editing'

// Helper to execute SQL via psql inside the container as supabase_admin
function runSql(sql) {
  try {
    const output = execSync(
      `docker exec -i ${CONTAINER_NAME} psql -U supabase_admin -d ${DB_NAME} -X -v ON_ERROR_STOP=1 -P pager=off`,
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return { success: true, output }
  } catch (err) {
    return {
      success: false,
      output: err.stdout ? err.stdout.toString() : '',
      error: err.stderr ? err.stderr.toString() : err.message
    }
  }
}

// Helper to execute query as a specific authenticated user
function runAuthSql(userId, sql) {
  const wrappedSql = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '${userId}';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
${sql};
COMMIT;
`
  return runSql(wrappedSql)
}

// Asynchronous execution for concurrency testing
function runAuthSqlAsync(userId, sql) {
  return new Promise((resolve) => {
    const wrappedSql = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '${userId}';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
${sql};
COMMIT;
`
    const proc = spawn(
      'docker',
      ['exec', '-i', CONTAINER_NAME, 'psql', '-U', 'supabase_admin', '-d', DB_NAME, '-X', '-v', 'ON_ERROR_STOP=1'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      resolve({ success: code === 0, output: stdout, error: stderr })
    })
    proc.stdin.write(wrappedSql)
    proc.stdin.end()
  })
}

// Helper to execute query as anon role
function runAnonSql(sql) {
  const wrappedSql = `
BEGIN;
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.role" = 'anon';
${sql};
COMMIT;
`
  return runSql(wrappedSql)
}

// Helper to execute query as service_role
function runServiceRoleSql(sql) {
  const wrappedSql = `
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claim.role" = 'service_role';
${sql};
COMMIT;
`
  return runSql(wrappedSql)
}

// Helper to parse JSON output from psql using unaligned output via stdin
function queryJson(sql) {
  try {
    const cleanSql = sql.trim().replace(/;+$/, '')
    const wrapped = `SELECT json_agg(t) FROM (${cleanSql}) t;\n`
    const output = execSync(
      `docker exec -i ${CONTAINER_NAME} psql -U supabase_admin -d ${DB_NAME} -X -A -t -v ON_ERROR_STOP=1`,
      { input: wrapped, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const trimmed = output.trim()
    if (!trimmed || trimmed === 'null' || trimmed === '') return []
    return JSON.parse(trimmed)
  } catch (err) {
    throw new Error(`Query failed: ${err.stderr ? err.stderr.toString() : err.message}`)
  }
}

// Test User UUIDs
const HEAD_ID = '5f4e11d7-6087-4fbf-a9ce-1cbf5c83628d' // superadmin
const EMP_ID = '0cb85bd4-cf9a-4e73-97c6-f6781b132138'  // admin
const INV_ID = 'e0ea31d6-a177-4488-9ca2-f2695c1d20cd'  // inventory_staff
const INACTIVE_ID = '99999999-9999-9999-9999-999999999999' // inactive admin

test.before(() => {
  // 1. Setup inactive admin user if not present
  runSql(`
    INSERT INTO public.admin_users (id, email, full_name, role, is_active)
    VALUES ('${INACTIVE_ID}', 'inactive.user@arscomputers.in', 'Inactive Admin', 'admin', false)
    ON CONFLICT (id) DO UPDATE SET is_active = false;
  `)

  // 2. Ensure forward migration is applied cleanly
  const forwardSql = fs.readFileSync('supabase/migrations/20261127000001_complete_enquiry_editing_and_audit.sql', 'utf8')
  const applyRes = runSql(forwardSql)
  if (!applyRes.success) {
    throw new Error(`Failed to initialize database with forward migration: ${applyRes.error}`)
  }
})

test('1. Schema & Migration Verification: Objects, Ownership, and Grants', () => {
  // Verify columns added
  const cols = queryJson(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'enquiries' 
      AND column_name IN ('company', 'service_requested')
  `)
  assert.equal(cols.length, 2, 'Columns company and service_requested must exist')

  // Verify ars_internal schema exists
  const schemas = queryJson(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ars_internal'
  `)
  assert.equal(schemas.length, 1, 'ars_internal schema must exist')

  // Verify ars_internal.active_enquiry_edits table exists and is owned by postgres
  const ledgerTable = queryJson(`
    SELECT tableowner FROM pg_tables WHERE schemaname = 'ars_internal' AND tablename = 'active_enquiry_edits'
  `)
  assert.equal(ledgerTable.length, 1)
  assert.equal(ledgerTable[0].tableowner, 'postgres', 'active_enquiry_edits table must be owned by postgres')

  // Verify function ownership and execution permissions
  const funcs = queryJson(`
    SELECT proname, prosecdef, rolname AS owner
    FROM pg_proc p
    JOIN pg_roles r ON p.proowner = r.oid
    WHERE proname IN ('update_enquiry_details', 'protect_enquiry_customer_and_archive_immutability')
  `)
  assert.equal(funcs.length, 2)
  for (const f of funcs) {
    assert.equal(f.prosecdef, true, `${f.proname} must be SECURITY DEFINER`)
    assert.equal(f.owner, 'postgres', `${f.proname} must be owned by postgres`)
  }

  // Verify direct UPDATE and DELETE revoked from authenticated on public.enquiries
  const tablePrivs = queryJson(`
    SELECT privilege_type 
    FROM information_schema.role_table_grants 
    WHERE table_schema = 'public' AND table_name = 'enquiries' AND grantee = 'authenticated'
  `)
  const privTypes = tablePrivs.map(p => p.privilege_type)
  assert.ok(privTypes.includes('SELECT'), 'authenticated must have SELECT on enquiries')
  assert.ok(!privTypes.includes('UPDATE'), 'authenticated must NOT have UPDATE on enquiries')
  assert.ok(!privTypes.includes('DELETE'), 'authenticated must NOT have DELETE on enquiries')
})

test('2. Authorized Active Employee Editing: Full field update and Dual Audit creation', () => {
  const enqId = crypto.randomUUID()

  // Insert test enquiry as admin user
  const insertRes = runAuthSql(EMP_ID, `
    INSERT INTO public.enquiries (
      id, name, contact_info, customer_name, customer_phone, customer_email,
      category_interest, enquiry_type, message, status
    ) VALUES (
      '${enqId}', 'Original Customer', '9876543210 | orig@test.com', 'Original Customer',
      '9876543210', 'orig@test.com', 'desktop', 'general', 'Original problem message exceeding minimum length', 'new'
    );
  `)
  assert.ok(insertRes.success, `Insert failed: ${insertRes.error}`)

  // Execute update_enquiry_details as employee (EMP_ID)
  const rpcCall = `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Updated Customer Name',
      p_customer_phone := '9876500000',
      p_customer_email := 'updated@test.com',
      p_company := 'Acme Tech Pvt Ltd',
      p_customer_address := '123 Tech Park, Bangalore',
      p_category_interest := 'networking',
      p_enquiry_type := 'service_request',
      p_service_requested := 'Router Config',
      p_message := 'New detailed problem requirement message exceeding minimum length',
      p_admin_notes := 'Follow up scheduled for Monday morning',
      p_service_details := '{"deviceBrand": "Cisco", "modelNumber": "Catalyst 2960"}'::jsonb,
      p_edit_summary := 'Employee updated customer and hardware requirements'
    );
  `
  const res = runAuthSql(EMP_ID, rpcCall)
  assert.ok(res.success, `RPC call failed: ${res.error}`)

  // Verify database record updated
  const updated = queryJson(`SELECT * FROM public.enquiries WHERE id = '${enqId}'`)
  assert.equal(updated.length, 1)
  const row = updated[0]
  assert.equal(row.customer_name, 'Updated Customer Name')
  assert.equal(row.customer_phone, '9876500000')
  assert.equal(row.customer_email, 'updated@test.com')
  assert.equal(row.contact_info, '9876500000 | updated@test.com')
  assert.equal(row.company, 'Acme Tech Pvt Ltd')
  assert.equal(row.customer_address, '123 Tech Park, Bangalore')
  assert.equal(row.category_interest, 'networking')
  assert.equal(row.enquiry_type, 'service_request')
  assert.equal(row.service_requested, 'Router Config')
  assert.equal(row.message, 'New detailed problem requirement message exceeding minimum length')
  assert.equal(row.admin_notes, 'Follow up scheduled for Monday morning')
  assert.deepEqual(row.service_details, { deviceBrand: 'Cisco', modelNumber: 'Catalyst 2960' })

  // Verify public.audit_logs record
  const auditLogs = queryJson(`
    SELECT * FROM public.audit_logs WHERE entity_id = '${enqId}' AND action = 'UPDATE' ORDER BY created_at DESC LIMIT 1
  `)
  assert.equal(auditLogs.length, 1, 'Audit log for update must be created')
  assert.equal(auditLogs[0].action, 'UPDATE')
  assert.equal(auditLogs[0].actor_id, EMP_ID)
  assert.equal(auditLogs[0].actor_role, 'admin')
  assert.ok(auditLogs[0].new_values.customer_name === 'Updated Customer Name')
  assert.ok(auditLogs[0].old_values.customer_name === 'Original Customer')

  // Verify public.enquiry_activities record
  const activities = queryJson(`
    SELECT * FROM public.enquiry_activities WHERE enquiry_id = '${enqId}' ORDER BY created_at DESC LIMIT 1
  `)
  assert.equal(activities.length, 1, 'Enquiry activity record must be created')
  assert.equal(activities[0].activity_type, 'note')
  assert.equal(activities[0].actor_id, EMP_ID)
  assert.equal(activities[0].content, 'Employee updated customer and hardware requirements')
  assert.equal(activities[0].metadata.action, 'ENQUIRY_DETAILS_EDITED')

  // Verify ledger is clean (atomically consumed)
  const ledger = queryJson(`SELECT * FROM ars_internal.active_enquiry_edits WHERE enquiry_id = '${enqId}'`)
  assert.equal(ledger.length, 0, 'Ledger entry must be consumed and empty')
})

test('3. Permissions: Inactive employee, unauthorized role, and unauthenticated access are rejected', () => {
  const enqId = crypto.randomUUID()
  runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, contact_info, message)
    VALUES ('${enqId}', 'Perm Test', '9876543210', 'Perm Test Message long enough');
  `)

  // Inactive employee call
  const inactiveRes = runAuthSql(INACTIVE_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Tampered'
    );
  `)
  assert.equal(inactiveRes.success, false)
  assert.match(inactiveRes.error, /Access denied: Enquiry editing is restricted to authorized administrative staff/)

  // Unauthorized role call (inventory_staff)
  const invRes = runAuthSql(INV_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Tampered'
    );
  `)
  assert.equal(invRes.success, false)
  assert.match(invRes.error, /Access denied: Enquiry editing is restricted to authorized administrative staff/)

  // Unauthenticated call (anon)
  const anonRes = runAnonSql(`
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Tampered'
    );
  `)
  assert.equal(anonRes.success, false)
  assert.match(anonRes.error, /permission denied for function update_enquiry_details/)
})

test('4. Approval & Lifecycle Restrictions: Completed, Rejected, Closed, Bin, and Removed', () => {
  const completedEnq = crypto.randomUUID()
  const rejectedEnq = crypto.randomUUID()
  const binEnq = crypto.randomUUID()
  const removedEnq = crypto.randomUUID()

  // Insert records as HEAD_ID (is_admin() is true) with valid message length >= 10
  const setupRes = runAuthSql(HEAD_ID, `
    -- Completed & approved enquiry
    INSERT INTO public.enquiries (id, name, contact_info, message, status, completion_approved_at, completion_approved_by)
    VALUES ('${completedEnq}', 'Completed Customer', '9876543210', 'Completed message satisfied length', 'completed', now(), '${HEAD_ID}');

    -- Rejected enquiry
    INSERT INTO public.enquiries (id, name, contact_info, message, status, rejection_reason)
    VALUES ('${rejectedEnq}', 'Rejected Customer', '9876543210', 'Rejected message satisfied length', 'rejected', 'Out of service area');

    -- Bin enquiry
    INSERT INTO public.enquiries (id, name, contact_info, message, is_in_bin, status)
    VALUES ('${binEnq}', 'Bin Customer', '9876543210', 'Bin message satisfied length', true, 'in_bin');

    -- Removed enquiry
    INSERT INTO public.enquiries (id, name, contact_info, message, is_removed)
    VALUES ('${removedEnq}', 'Removed Customer', '9876543210', 'Removed message satisfied length', true);
  `)
  assert.ok(setupRes.success, `Setup failed: ${setupRes.error}`)

  // Employee attempts to edit completed enquiry -> REJECTED
  const empCompletedRes = runAuthSql(EMP_ID, `
    SELECT public.update_enquiry_details(p_enquiry_id := '${completedEnq}'::uuid, p_customer_name := 'Hacked');
  `)
  assert.equal(empCompletedRes.success, false)
  assert.match(empCompletedRes.error, /Enquiry completion has already been approved by Head Admin/)

  // Superadmin privileged correction on completed enquiry -> ALLOWED
  const headCompletedRes = runAuthSql(HEAD_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${completedEnq}'::uuid,
      p_customer_address := 'Corrected Address By Head',
      p_edit_summary := 'Head Admin clerical correction'
    );
  `)
  assert.ok(headCompletedRes.success, `Head edit on completed enquiry failed: ${headCompletedRes.error}`)

  // Employee attempts to edit rejected enquiry -> REJECTED
  const empRejectedRes = runAuthSql(EMP_ID, `
    SELECT public.update_enquiry_details(p_enquiry_id := '${rejectedEnq}'::uuid, p_customer_name := 'Hacked');
  `)
  assert.equal(empRejectedRes.success, false)
  assert.match(empRejectedRes.error, /Editing closed or rejected enquiries is restricted to Head-Person/)

  // Superadmin attempts to edit rejected enquiry -> ALLOWED
  const headRejectedRes = runAuthSql(HEAD_ID, `
    SELECT public.update_enquiry_details(p_enquiry_id := '${rejectedEnq}'::uuid, p_customer_name := 'Reopened Name');
  `)
  assert.ok(headRejectedRes.success)

  // Attempt to edit bin enquiry -> REJECTED
  const binRes = runAuthSql(HEAD_ID, `
    SELECT public.update_enquiry_details(p_enquiry_id := '${binEnq}'::uuid, p_customer_name := 'Hacked');
  `)
  assert.equal(binRes.success, false)
  assert.match(binRes.error, /Cannot edit an enquiry currently in the Bin/)

  // Attempt to edit removed enquiry -> REJECTED
  const removedRes = runAuthSql(HEAD_ID, `
    SELECT public.update_enquiry_details(p_enquiry_id := '${removedEnq}'::uuid, p_customer_name := 'Hacked');
  `)
  assert.equal(removedRes.success, false)
  assert.match(removedRes.error, /Cannot edit a removed enquiry record/)
})

test('5. Optional Field Clearing vs. Omission and Mandatory Preservation', () => {
  const enqId = crypto.randomUUID()
  const insertRes = runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (
      id, name, customer_name, contact_info, customer_phone, customer_email,
      company, customer_address, message, admin_notes
    ) VALUES (
      '${enqId}', 'Clearing Test', 'Clearing Test', '9876543210 | test@co.com',
      '9876543210', 'test@co.com', 'Existing Co', 'Existing Address', 'Valid Message Length Here', 'Existing Notes'
    );
  `)
  assert.ok(insertRes.success, `Insert failed: ${insertRes.error}`)

  // Step A: Clear optional fields customer_email, company, admin_notes explicitly
  const clearRes = runAuthSql(EMP_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_cleared_fields := ARRAY['customer_email', 'company', 'admin_notes']::text[]
    );
  `)
  assert.ok(clearRes.success, `Clearing optional fields failed: ${clearRes.error}`)

  const afterClear = queryJson(`SELECT * FROM public.enquiries WHERE id = '${enqId}'`)
  assert.equal(afterClear[0].customer_email, null)
  assert.equal(afterClear[0].company, null)
  assert.equal(afterClear[0].admin_notes, null)
  // Preserved omitted fields
  assert.equal(afterClear[0].customer_address, 'Existing Address')
  assert.equal(afterClear[0].customer_phone, '9876543210')

  // Step B: Attempt to clear mandatory field (customer_name) -> REJECTED
  const mandatoryClearRes = runAuthSql(EMP_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_cleared_fields := ARRAY['customer_name']::text[]
    );
  `)
  assert.equal(mandatoryClearRes.success, false)
  assert.match(mandatoryClearRes.error, /Mandatory field "customer_name" cannot be cleared/)
})

test('6. Anti-Bypass Security: Direct SQL Updates Blocked by Trigger and Privileges', () => {
  const enqId = crypto.randomUUID()
  runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, customer_name, contact_info, customer_phone, message)
    VALUES ('${enqId}', 'Bypass Test', 'Bypass Test', '9876543210', '9876543210', 'Original message valid length');
  `)

  // Attack 1: Authenticated user direct table UPDATE
  const directAuthUpdate = runAuthSql(HEAD_ID, `
    UPDATE public.enquiries SET customer_phone = '9999999999' WHERE id = '${enqId}';
  `)
  assert.equal(directAuthUpdate.success, false)
  assert.match(directAuthUpdate.error, /permission denied for table enquiries/)

  // Attack 2: Direct UPDATE executed as superuser/postgres bypassing RPC
  // Must be blocked by trigger Rule 4 because ledger has no entry!
  const directSuperuserUpdate = runSql(`
    UPDATE public.enquiries SET customer_phone = '9999999999' WHERE id = '${enqId}';
  `)
  assert.equal(directSuperuserUpdate.success, false)
  assert.match(directSuperuserUpdate.error, /customer_phone can only be modified through update_enquiry_details/)

  // Attack 3: Direct UPDATE on admin_notes by superuser bypassing RPC
  const directNotesUpdate = runSql(`
    UPDATE public.enquiries SET admin_notes = 'forged note' WHERE id = '${enqId}';
  `)
  assert.equal(directNotesUpdate.success, false)
  assert.match(directNotesUpdate.error, /admin_notes can only be modified through update_enquiry_details/)
})

test('7. Ledger Isolation: Direct Manipulation of ars_internal Blocked', () => {
  // Attempt 1: Authenticated role inserts into ars_internal.active_enquiry_edits
  const authInsert = runAuthSql(HEAD_ID, `
    INSERT INTO ars_internal.active_enquiry_edits (enquiry_id, actor_id, nonce)
    VALUES (gen_random_uuid(), '${HEAD_ID}', 'forged');
  `)
  assert.equal(authInsert.success, false)
  assert.match(authInsert.error, /permission denied for schema ars_internal/)

  // Attempt 2: Service_role attempts to insert into ars_internal.active_enquiry_edits
  const serviceInsert = runServiceRoleSql(`
    INSERT INTO ars_internal.active_enquiry_edits (enquiry_id, actor_id, nonce)
    VALUES (gen_random_uuid(), '${HEAD_ID}', 'forged');
  `)
  assert.equal(serviceInsert.success, false)
  assert.match(serviceInsert.error, /permission denied for schema ars_internal/)
})

test('8. Existing Workflow Compatibility: self_assign and status updates are NOT blocked', () => {
  const enqId = crypto.randomUUID()
  runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, customer_name, contact_info, customer_phone, message, status)
    VALUES ('${enqId}', 'Workflow Test', 'Workflow Test', '9876543210', '9876543210', 'Workflow Msg valid length', 'new');
  `)

  // Execute self_assign_enquiry as employee (using exact parameter names)
  const assignRes = runAuthSql(EMP_ID, `
    SELECT public.self_assign_enquiry(
      p_enquiry_id := '${enqId}'::uuid,
      p_expected_visit_at := (now() + interval '1 day'),
      p_visit_note := 'Will visit customer tomorrow'
    );
  `)
  assert.ok(assignRes.success, `self_assign_enquiry failed: ${assignRes.error}`)

  // Verify status updated to in_progress and assigned_to is set
  const assignedEnq = queryJson(`SELECT status, assigned_employee_id FROM public.enquiries WHERE id = '${enqId}'`)
  assert.equal(assignedEnq[0].status, 'in_progress')
  assert.equal(assignedEnq[0].assigned_employee_id, EMP_ID)
})

test('9. Activity Content Bounding: 3,000-character safety constraint', () => {
  const enqId = crypto.randomUUID()
  runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, contact_info, message)
    VALUES ('${enqId}', 'Len Test', '9876543210', 'Original message satisfied length');
  `)

  // Supply a 5,000 character edit summary
  const hugeSummary = 'X'.repeat(5000)
  const res = runAuthSql(EMP_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Truncated Summary Test',
      p_edit_summary := '${hugeSummary}'
    );
  `)
  assert.ok(res.success, `Update with long summary failed: ${res.error}`)

  const act = queryJson(`
    SELECT content, char_length(content) AS len 
    FROM public.enquiry_activities 
    WHERE enquiry_id = '${enqId}' 
    ORDER BY created_at DESC LIMIT 1
  `)
  assert.equal(act.length, 1)
  assert.equal(act[0].len, 3000, 'Content must be bounded to exactly 3,000 characters')
})

test('10. Rollback and Reapplication Verification', () => {
  // Step A: Execute rollback migration
  const rollbackSql = fs.readFileSync('supabase/rollbacks/20261127000002_rollback_complete_enquiry_editing_and_audit.sql', 'utf8')
  const rollbackRes = runSql(rollbackSql)
  assert.ok(rollbackRes.success, `Rollback failed: ${rollbackRes.error}`)

  // Verify update_enquiry_details is dropped
  const rpcCheck = queryJson(`
    SELECT proname FROM pg_proc WHERE proname = 'update_enquiry_details'
  `)
  assert.equal(rpcCheck.length, 0, 'update_enquiry_details must be dropped after rollback')

  // Verify ars_internal schema is dropped
  const schemaCheck = queryJson(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ars_internal'
  `)
  assert.equal(schemaCheck.length, 0, 'ars_internal schema must be dropped after rollback')

  // Verify table UPDATE privilege is restored to authenticated
  const privCheck = queryJson(`
    SELECT privilege_type 
    FROM information_schema.role_table_grants 
    WHERE table_schema = 'public' AND table_name = 'enquiries' 
      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
  `)
  assert.equal(privCheck.length, 1, 'UPDATE privilege on enquiries must be restored to authenticated')

  // Verify policy "Superadmins can update enquiries" is restored
  const polCheck = queryJson(`
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'enquiries' 
      AND policyname = 'Superadmins can update enquiries'
  `)
  assert.equal(polCheck.length, 1, 'Policy Superadmins can update enquiries must be restored')

  // Step B: Reapply forward migration
  const forwardSql = fs.readFileSync('supabase/migrations/20261127000001_complete_enquiry_editing_and_audit.sql', 'utf8')
  const forwardRes = runSql(forwardSql)
  assert.ok(forwardRes.success, `Reapplying forward migration failed: ${forwardRes.error}`)

  // Verify update_enquiry_details and ars_internal are recreated cleanly
  const rpcRecheck = queryJson(`
    SELECT proname FROM pg_proc WHERE proname = 'update_enquiry_details'
  `)
  assert.equal(rpcRecheck.length, 1, 'update_enquiry_details must exist after reapplication')

  const schemaRecheck = queryJson(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ars_internal'
  `)
  assert.equal(schemaRecheck.length, 1, 'ars_internal schema must exist after reapplication')
})

test('11. Concurrent Edits: Row Locking, Consistency, and Ledger Cleanup', async () => {
  const enqId = crypto.randomUUID()
  const insertRes = runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, customer_name, contact_info, customer_phone, message)
    VALUES ('${enqId}', 'Concurrent Customer Initial', 'Concurrent Customer Initial', '9876543210', '9876543210', 'Initial message for concurrency test');
  `)
  assert.ok(insertRes.success, `Insert failed: ${insertRes.error}`)

  // Launch Session 1: locks row, updates name to 'Session A Name', sleeps 1.5s, then commits
  const session1Promise = runAuthSqlAsync(EMP_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Session A Name',
      p_edit_summary := 'Edit by Session A'
    );
    SELECT pg_sleep(1.5);
  `)

  // Wait 200ms to guarantee Session 1 holds the lock first
  await new Promise((r) => setTimeout(r, 200))

  // Launch Session 2: attempts to update the same enquiry concurrently
  // It will block on the row lock until Session 1 completes its sleep and commits
  const session2Promise = runAuthSqlAsync(HEAD_ID, `
    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Session B Name',
      p_edit_summary := 'Edit by Session B'
    );
  `)

  // Await both sessions
  const [res1, res2] = await Promise.all([session1Promise, session2Promise])
  assert.ok(res1.success, `Session 1 failed: ${res1.error}`)
  assert.ok(res2.success, `Session 2 failed: ${res2.error}`)

  // Verify final enquiry state (Session 2 executed second after acquiring the lock)
  const finalRow = queryJson(`SELECT customer_name, name FROM public.enquiries WHERE id = '${enqId}'`)
  assert.equal(finalRow[0].customer_name, 'Session B Name', 'Final value must reflect the serialized second edit')

  // Verify audit consistency: exactly 2 UPDATE activity entries in enquiry_activities
  const acts = queryJson(`
    SELECT content FROM public.enquiry_activities WHERE enquiry_id = '${enqId}' ORDER BY created_at ASC
  `)
  assert.equal(acts.length, 2, 'Exactly 2 activity entries must be created')
  assert.equal(acts[0].content, 'Edit by Session A')
  assert.equal(acts[1].content, 'Edit by Session B')

  // Verify audit logs created for UPDATE
  const audits = queryJson(`
    SELECT actor_id, actor_role, old_values->>'customer_name' AS old_name, new_values->>'customer_name' AS new_name
    FROM public.audit_logs 
    WHERE entity_id = '${enqId}' AND action = 'UPDATE'
    ORDER BY created_at ASC
  `)
  assert.ok(audits.length >= 2, 'At least 2 UPDATE audit logs must be recorded')

  // Verify ledger cleanup: 0 leftover entries
  const ledger = queryJson(`SELECT * FROM ars_internal.active_enquiry_edits WHERE enquiry_id = '${enqId}'`)
  assert.equal(ledger.length, 0, 'No ledger entry must remain active')
})

test('12. Forced Database Failure: Complete Transaction Atomicity and Rollback', () => {
  const enqId = crypto.randomUUID()
  const insertRes = runAuthSql(HEAD_ID, `
    INSERT INTO public.enquiries (id, name, customer_name, contact_info, customer_phone, message)
    VALUES ('${enqId}', 'Unmodified Name', 'Unmodified Name', '9876543210', '9876543210', 'Initial message for rollback test');
  `)
  assert.ok(insertRes.success, `Insert failed: ${insertRes.error}`)

  // Execute update inside a transaction block that encounters a subsequent failure (division by zero)
  const failingTx = runSql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${EMP_ID}';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    SELECT public.update_enquiry_details(
      p_enquiry_id := '${enqId}'::uuid,
      p_customer_name := 'Tampered Name Rolled Back',
      p_edit_summary := 'This should never commit'
    );

    -- Force intentional PostgreSQL transaction abort
    SELECT 1 / 0;

    COMMIT;
  `)

  assert.equal(failingTx.success, false)
  assert.match(failingTx.error, /division by zero/)

  // 1. Verify enquiry table row was completely rolled back
  const enquiry = queryJson(`SELECT customer_name, name FROM public.enquiries WHERE id = '${enqId}'`)
  assert.equal(enquiry.length, 1)
  assert.equal(enquiry[0].customer_name, 'Unmodified Name', 'Customer name must remain unmodified')

  // 2. Verify ledger was rolled back (0 rows)
  const ledger = queryJson(`SELECT * FROM ars_internal.active_enquiry_edits WHERE enquiry_id = '${enqId}'`)
  assert.equal(ledger.length, 0, 'Ledger entry must be rolled back completely')

  // 3. Verify audit_logs for UPDATE was rolled back (0 rows with action = 'UPDATE')
  const audits = queryJson(`SELECT * FROM public.audit_logs WHERE entity_id = '${enqId}' AND action = 'UPDATE'`)
  assert.equal(audits.length, 0, 'Audit log update entry must be rolled back completely')

  // 4. Verify enquiry_activities was rolled back (0 rows)
  const activities = queryJson(`SELECT * FROM public.enquiry_activities WHERE enquiry_id = '${enqId}'`)
  assert.equal(activities.length, 0, 'Enquiry activities entry must be rolled back completely')
})
