/**
 * ============================================================================
 * ARS Computers — Phase 2 Security Hardening & Regression Verification Suite
 * ============================================================================
 * Validates against local database:
 * 1. Direct DELETE on enquiries revoked for all application users.
 * 2. Direct INSERT on enquiry_activities revoked for all client roles.
 * 3. Legitimate workflow RPCs append validated activities properly.
 * 4. Bin retention: Expired items purged with PII redaction; unexpired items protected.
 * 5. Server-side abuse controls: Input validation, request bounds, XSS script reject,
 *    and contact rate limiting.
 * 6. Immediate denial of access for inactive staff accounts.
 * 7. Product & catalog permissions strictly enforced at database layer.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const EMPLOYEE_EMAIL = 'employee.test@arscomputers.in'
const EMPLOYEE_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'ArsEmpTemp#2026!Oct'
const _SUPERADMIN_EMAIL = 'ankitbathla.ind@gmail.com'

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

async function runTests() {
  console.log('====================================================================')
  console.log('ARS Computers — Phase 2 Security Hardening Regression Verification')
  console.log('====================================================================')

  const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // Authenticate real employee
  const employeeClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const { data: _empLogin, error: empLoginErr } = await employeeClient.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD
  })
  if (empLoginErr) throw new Error('Employee authentication failed: ' + empLoginErr.message)

  // Authenticate superadmin via admin session token
  const superadminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  const { data: adminUserRow } = await serviceClient
    .from('admin_users')
    .select('id, email')
    .eq('role', 'superadmin')
    .eq('is_active', true)
    .single()

  const { data: impersonatedLink } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: adminUserRow.email
  })
  const hashedToken = impersonatedLink?.properties?.hashed_token
  await superadminClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'magiclink'
  })

  // --------------------------------------------------------------------------
  // Suite 1: Direct Table Deletion Revocation on public.enquiries
  // --------------------------------------------------------------------------
  console.log('\n[Suite 1] Direct Deletion Prevention & Bin Lifecycle Enforcement:')
  const { data: testEnq1 } = await serviceClient
    .from('enquiries')
    .insert([{
      name: 'Direct Delete Test Enq',
      contact_info: `test.del.${Date.now()}@example.com`,
      category_interest: 'computer-laptop',
      message: 'Test direct delete permissions',
      status: 'new'
    }])
    .select('id')
    .single()

  // 1.1 Anonymous direct DELETE
  const { error: anonDelErr } = await anonClient
    .from('enquiries')
    .delete()
    .eq('id', testEnq1.id)
  assertTest(Boolean(anonDelErr), 'Anonymous direct DELETE on enquiries is denied by database privileges', anonDelErr?.message)

  // 1.2 Employee direct DELETE
  const { error: empDelErr, count: empDelCount } = await employeeClient
    .from('enquiries')
    .delete({ count: 'exact' })
    .eq('id', testEnq1.id)
  assertTest(Boolean(empDelErr) || empDelCount === 0, 'Employee direct DELETE on enquiries fails (0 rows deleted / permission revoked)', empDelErr?.message)

  // 1.3 Superadmin direct DELETE
  const { error: superDelErr } = await superadminClient
    .from('enquiries')
    .delete()
    .eq('id', testEnq1.id)
  assertTest(Boolean(superDelErr), 'Superadmin direct REST DELETE on enquiries is denied (must use Bin purge lifecycle)', superDelErr?.message)

  // Verify record remains untouched
  const { data: checkEnq1 } = await serviceClient.from('enquiries').select('id').eq('id', testEnq1.id).maybeSingle()
  assertTest(Boolean(checkEnq1?.id), 'Enquiry remains safely intact in database despite direct delete attempts')

  // --------------------------------------------------------------------------
  // Suite 2: Direct Activity Insertion Revocation on public.enquiry_activities
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2] Audit Integrity & Activity Forgery Prevention:')
  // 2.1 Anonymous direct activity insertion
  const { error: anonActErr } = await anonClient
    .from('enquiry_activities')
    .insert([{
      enquiry_id: testEnq1.id,
      activity_type: 'note',
      content: 'Forged anonymous note'
    }])
  assertTest(Boolean(anonActErr), 'Anonymous direct INSERT into enquiry_activities is blocked by database permissions', anonActErr?.message)

  // 2.2 Employee direct activity insertion
  const { error: empActErr } = await employeeClient
    .from('enquiry_activities')
    .insert([{
      enquiry_id: testEnq1.id,
      activity_type: 'system_event',
      content: 'Forged employee activity record'
    }])
  assertTest(Boolean(empActErr), 'Employee direct INSERT into enquiry_activities is blocked by database permissions', empActErr?.message)

  // 2.3 Superadmin direct activity insertion
  const { error: superActErr } = await superadminClient
    .from('enquiry_activities')
    .insert([{
      enquiry_id: testEnq1.id,
      activity_type: 'rejection_reviewed',
      content: 'Forged superadmin approval record'
    }])
  assertTest(Boolean(superActErr), 'Superadmin direct INSERT into enquiry_activities is blocked (must use workflow RPC)', superActErr?.message)

  // --------------------------------------------------------------------------
  // Suite 3: Legitimate Workflow RPCs Record Verified Activity History
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3] Legitimate Activity Logging via Server-Side Workflow RPCs:')
  const noteText = 'Valid technician inspection completed at ' + new Date().toISOString()
  const { data: noteRpcRes, error: noteRpcErr } = await employeeClient.rpc('add_enquiry_note', {
    p_enquiry_id: testEnq1.id,
    p_content: noteText
  })
  assertTest(!noteRpcErr && noteRpcRes?.success, 'Employee successfully appends follow-up note via trusted add_enquiry_note RPC')

  const { data: verifyActs } = await superadminClient
    .from('enquiry_activities')
    .select('activity_type, content, actor_email, actor_role')
    .eq('enquiry_id', testEnq1.id)
    .eq('activity_type', 'note')
    .maybeSingle()

  assertTest(verifyActs?.content === noteText, 'Activity record created contains accurate content')
  assertTest(verifyActs?.actor_email === EMPLOYEE_EMAIL, 'Activity actor_email strictly reflects authenticated session')
  assertTest(verifyActs?.actor_role === 'admin', 'Activity actor_role strictly reflects verified database profile')

  // --------------------------------------------------------------------------
  // Suite 4: Bin Retention & Purge Authorization Controls
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4] Bin Retention Lifecycle & Authorized Purge Workflow:')
  // Advance to quoted
  await employeeClient.rpc('update_enquiry_progress', { p_enquiry_id: testEnq1.id, p_next_status: 'in_progress' })
  await employeeClient.rpc('update_enquiry_progress', { p_enquiry_id: testEnq1.id, p_next_status: 'quoted' })

  // Employee requests completion
  await employeeClient.rpc('submit_enquiry_completion', {
    p_enquiry_id: testEnq1.id,
    p_completion_summary: 'Hardware deployment completed and customer tested.'
  })

  // Superadmin approves to Bin with 7-day retention
  await superadminClient.rpc('review_enquiry_completion', {
    p_enquiry_id: testEnq1.id,
    p_decision: 'approved'
  })

  // 4.1 Unexpired Bin record cannot be purged
  const { data: prematurePurgeRes, error: prematurePurgeErr } = await superadminClient.rpc('purge_expired_bin_enquiries', {
    p_retention_grace_seconds: 0
  })
  assertTest(!prematurePurgeErr && prematurePurgeRes?.purged_count === 0, 'Unexpired Bin records are NOT deleted prematurely by purge RPC')

  const { data: stillInBin } = await superadminClient
    .from('enquiries')
    .select('id, is_in_bin, scheduled_deletion_at')
    .eq('id', testEnq1.id)
    .single()
  assertTest(stillInBin?.is_in_bin === true, 'Enquiry is preserved in Bin for the mandatory retention duration')

  // 4.2 Unauthorized caller (Employee or Anon) cannot call purge RPC
  const { error: empPurgeErr } = await employeeClient.rpc('purge_expired_bin_enquiries', { p_retention_grace_seconds: 0 })
  assertTest(Boolean(empPurgeErr), 'Ordinary employees cannot call purge_expired_bin_enquiries RPC (superadmin only)', empPurgeErr?.message)

  // 4.3 Expired Bin records can be purged when expiration threshold is passed
  // Expire the scheduled_deletion_at artificially for this test item
  await serviceClient
    .from('enquiries')
    .update({ scheduled_deletion_at: new Date(Date.now() - 3600000).toISOString() })
    .eq('id', testEnq1.id)

  const { data: expiredPurgeRes, error: expiredPurgeErr } = await superadminClient.rpc('purge_expired_bin_enquiries', {
    p_retention_grace_seconds: 0
  })
  assertTest(!expiredPurgeErr && expiredPurgeRes?.purged_count >= 1, 'Expired Bin records are permanently purged by authorized purge RPC')

  // Verify customer PII redaction in audit_logs
  const { data: deleteAuditLog } = await serviceClient
    .from('audit_logs')
    .select('action, old_values')
    .eq('entity_id', testEnq1.id)
    .eq('action', 'DELETE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  assertTest(Boolean(deleteAuditLog), 'Audit log records DELETE event for the purged enquiry')
  assertTest(deleteAuditLog?.old_values?.customer_pii_redacted === true, 'Customer PII is strictly redacted from audit_logs old_values')
  assertTest(!deleteAuditLog?.old_values?.contact_info, 'Customer contact_info is omitted from audit log payload')

  // --------------------------------------------------------------------------
  // Suite 5: Server-Side Public Enquiry Abuse Controls & Validation
  // --------------------------------------------------------------------------
  console.log('\n[Suite 5] Server-Side Abuse Prevention, Request Size & Spam Controls:')
  // 5.1 Valid anonymous submission succeeds
  const validContact = `legit.cust.${Date.now()}@example.com`
  const { error: validAnonErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'Valid Customer',
      contact_info: validContact,
      category_interest: 'printer',
      message: 'Need 2 heavy-duty laser printers for office.',
      status: 'new'
    }])
  assertTest(!validAnonErr, 'Legitimate anonymous enquiry submission succeeds without friction', validAnonErr?.message)

  const { data: validAnonEnq } = await serviceClient
    .from('enquiries')
    .select('id')
    .eq('contact_info', validContact)
    .single()

  // 5.2 Short name validation (< 2 characters)
  const { error: shortNameErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'A',
      contact_info: `cust.${Date.now()}@example.com`,
      message: 'Need quotation for server hardware.',
      status: 'new'
    }])
  assertTest(Boolean(shortNameErr), 'Server-side trigger rejects short customer name (< 2 chars)', shortNameErr?.message)

  // 5.3 Oversized name (> 100 characters)
  const { error: longNameErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'A'.repeat(101),
      contact_info: `cust.${Date.now()}@example.com`,
      message: 'Need quotation for server hardware.',
      status: 'new'
    }])
  assertTest(Boolean(longNameErr), 'Server-side trigger rejects oversized customer name (> 100 chars)', longNameErr?.message)

  // 5.4 Malicious script injection in message
  const { error: scriptErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'Malicious Attacker',
      contact_info: `attacker.${Date.now()}@example.com`,
      message: '<script>alert("XSS payload")</script>',
      status: 'new'
    }])
  assertTest(Boolean(scriptErr), 'Server-side trigger rejects message containing <script> injection tag', scriptErr?.message)

  // 5.5 Control character / null byte injection
  const { error: nullByteErr } = await anonClient
    .from('enquiries')
    .insert([{
      name: 'Hacker\x00Name',
      contact_info: `hack.${Date.now()}@example.com`,
      message: 'Malformed binary payload',
      status: 'new'
    }])
  assertTest(Boolean(nullByteErr), 'Server-side trigger rejects non-printable control characters', nullByteErr?.message)

  // 5.6 Contact-fingerprint server rate limiting (flooding with same contact info)
  const spamContact = `spammer.${Date.now()}@example.com`
  let spamCount = 0
  let rateLimitCaught = false

  for (let i = 0; i < 6; i++) {
    const { error: spamErr } = await anonClient
      .from('enquiries')
      .insert([{
        name: `Spammer Instance ${i}`,
        contact_info: spamContact,
        message: 'Spam submission attempt number ' + i,
        status: 'new'
      }])

    if (spamErr && (spamErr.message.includes('Rate limit exceeded') || spamErr.code === 'P0001')) {
      rateLimitCaught = true
      break
    } else if (!spamErr) {
      spamCount++
    }
  }
  assertTest(rateLimitCaught, `Server-side trigger enforces contact rate limit after rapid submissions (${spamCount} permitted before cutoff)`)

  // --------------------------------------------------------------------------
  // Suite 6: Staff Account Deactivation & Immediate Revocation
  // --------------------------------------------------------------------------
  console.log('\n[Suite 6] Staff Account Deactivation & Immediate Authorization Denial:')
  // Create disposable test employee
  const tempEmpEmail = `temp.emp.${Date.now()}@arscomputers.in`
  const { data: tempEmpAuth } = await serviceClient.auth.admin.createUser({
    email: tempEmpEmail,
    password: 'TempPassword123#2026',
    email_confirm: true
  })
  const tempEmpId = tempEmpAuth?.user?.id

  await serviceClient.from('admin_users').insert([{
    id: tempEmpId,
    email: tempEmpEmail,
    full_name: 'Temporary Test Staff',
    role: 'admin',
    is_active: true
  }])

  const tempEmpClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } })
  await tempEmpClient.auth.signInWithPassword({
    email: tempEmpEmail,
    password: 'TempPassword123#2026'
  })

  // Confirm active access
  const { data: activeRead, error: activeReadErr } = await tempEmpClient.from('enquiries').select('id').limit(1)
  assertTest(!activeReadErr && Array.isArray(activeRead), 'Active staff member can query enquiries under is_admin() RLS policy')

  // Superadmin deactivates staff member
  await serviceClient
    .from('admin_users')
    .update({ is_active: false })
    .eq('id', tempEmpId)

  // Immediate query attempt with existing unexpired JWT must be denied by PostgreSQL RLS
  const { data: deactivatedRead, error: deactivatedReadErr } = await tempEmpClient.from('enquiries').select('id').limit(1)
  assertTest(
    deactivatedReadErr !== null || (Array.isArray(deactivatedRead) && deactivatedRead.length === 0),
    'Deactivated staff member is immediately denied data access by PostgreSQL get_staff_role() RLS check (returns 0 rows)'
  )

  // Direct RPC attempt by deactivated staff must be rejected
  const { error: deactivatedRpcErr } = await tempEmpClient.rpc('add_enquiry_note', {
    p_enquiry_id: validAnonEnq.id,
    p_content: 'Attempt by deactivated user'
  })
  assertTest(Boolean(deactivatedRpcErr), 'Deactivated staff member is rejected by SECURITY DEFINER RPC role verification', deactivatedRpcErr?.message)

  // Cleanup disposable test staff
  await serviceClient.from('admin_users').delete().eq('id', tempEmpId)
  await serviceClient.auth.admin.deleteUser(tempEmpId)

  // --------------------------------------------------------------------------
  // Suite 7: Database-Enforced Product & Inventory Permissions
  // --------------------------------------------------------------------------
  console.log('\n[Suite 7] Product Catalog & Stock Authorization Enforcement:')
  // Employee cannot insert product
  const { error: empProdInsertErr } = await employeeClient.from('products').insert([{
    name: 'Unauthorized Laptop',
    slug: 'unauthorized-laptop-' + Date.now(),
    price: 99999,
    category_id: 'computer-laptop'
  }])
  assertTest(Boolean(empProdInsertErr), 'Employee cannot INSERT into products (blocked by RLS)', empProdInsertErr?.message)

  // Employee cannot alter commercial fields (price)
  const { data: sampleProd } = await serviceClient.from('products').select('id, price, stock_quantity').limit(1).single()
  const { error: empPriceUpdateErr } = await employeeClient
    .from('products')
    .update({ price: 1 })
    .eq('id', sampleProd.id)
  assertTest(Boolean(empPriceUpdateErr), 'Employee cannot alter product commercial price (blocked by database trigger)', empPriceUpdateErr?.message)

  // Clean up disposable test enquiries
  if (validAnonEnq?.id) {
    await serviceClient.from('enquiries').delete().eq('id', validAnonEnq.id)
  }

  console.log('\n====================================================================')
  console.log(`Phase 2 Hardening Suite Summary: ${passed} passed, ${failed} failed.`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err)
  process.exit(1)
})
