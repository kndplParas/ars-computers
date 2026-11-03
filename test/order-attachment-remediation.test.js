/**
 * ARS Computers — Step 5 Security Remediation Verification Suite
 *
 * Verifies all 5 Priorities:
 * 1. RPC Permissions: resolve_shared_attachment_token executable by service_role ONLY.
 *    Blocked for authenticated, anon, and all employee roles.
 * 2. RLS Security: order_attachment_shares and order_attachment_access_logs viewable
 *    exclusively by Head ('superadmin') and Store Admin ('admin'). Blocked for all other roles.
 * 3. Client Write Prevention: Client roles cannot INSERT, UPDATE, or DELETE on access logs.
 * 4. Admin Request & Head Approval Workflow:
 *    - Store Admin can submit shareability request (persisted with requester & timestamp).
 *    - Store Admin CANNOT self-approve (insufficient_privilege).
 *    - Head Superadmin alone can approve or reject.
 *    - Only Head-approved attachments can generate customer share links.
 * 5. Access-Log Privacy & Retention:
 *    - IP masking helper functions correctly on IPv4 and IPv6.
 *    - 90-day retention cleanup RPC successfully deletes expired records while preserving active ones.
 * 6. Cloudflare distributed rate limiting prerequisites documented.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { handleCustomerAttachmentDownload } from '../src/server/shareAttachmentHandler.js'

const LOCAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TEST_PASSWORD = 'TestPassword123!'

describe('ARS Computers — Step 5 Security Remediation Test Suite', () => {
  let serviceClient
  let headClient
  let adminClient
  let technicalClient
  let engineerClient
  let hrClient
  let accountClient
  let inventoryClient
  let anonClient

  let testOrderId
  let testAttachmentId
  let testShareId
  let testRawToken
  let testTokenHash

  const staffProfiles = [
    { email: 'rem-head@arscomputers.test', role: 'superadmin', fullName: 'Remediation Head' },
    { email: 'rem-admin@arscomputers.test', role: 'admin', fullName: 'Remediation Admin' },
    { email: 'rem-technical@arscomputers.test', role: 'technical', fullName: 'Remediation Technical' },
    { email: 'rem-engineer@arscomputers.test', role: 'engineer', fullName: 'Remediation Engineer' },
    { email: 'rem-hr@arscomputers.test', role: 'hr', fullName: 'Remediation HR' },
    { email: 'rem-account@arscomputers.test', role: 'account', fullName: 'Remediation Account' },
    { email: 'rem-inventory@arscomputers.test', role: 'inventory_staff', fullName: 'Remediation Inventory' }
  ]

  async function getOrCreateUser(email, role, fullName) {
    const { data: userList } = await serviceClient.auth.admin.listUsers()
    let user = userList?.users?.find((u) => u.email === email)
    if (!user) {
      const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true
      })
      if (createErr) throw createErr
      user = newUser.user
    }

    await serviceClient.from('admin_users').upsert({
      id: user.id,
      email,
      role,
      full_name: fullName,
      is_active: true
    })

    const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false }
    })
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
    if (signInErr) throw signInErr
    return client
  }

  before(async () => {
    serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })

    anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false }
    })

    headClient = await getOrCreateUser(staffProfiles[0].email, staffProfiles[0].role, staffProfiles[0].fullName)
    adminClient = await getOrCreateUser(staffProfiles[1].email, staffProfiles[1].role, staffProfiles[1].fullName)
    technicalClient = await getOrCreateUser(staffProfiles[2].email, staffProfiles[2].role, staffProfiles[2].fullName)
    engineerClient = await getOrCreateUser(staffProfiles[3].email, staffProfiles[3].role, staffProfiles[3].fullName)
    hrClient = await getOrCreateUser(staffProfiles[4].email, staffProfiles[4].role, staffProfiles[4].fullName)
    accountClient = await getOrCreateUser(staffProfiles[5].email, staffProfiles[5].role, staffProfiles[5].fullName)
    inventoryClient = await getOrCreateUser(staffProfiles[6].email, staffProfiles[6].role, staffProfiles[6].fullName)

    // Set up dedicated test order and attachment
    testOrderId = crypto.randomUUID()
    const uniqueOrderNum = `ORD-REM-${Date.now()}`
    const { error: orderErr } = await serviceClient.from('orders').insert({
      id: testOrderId,
      order_number: uniqueOrderNum,
      customer_name: 'Ananya Sharma',
      contact_info: '+919812345678',
      total_amount: 12500,
      paid_amount: 5000,
      payment_status: 'partial',
      status: 'new'
    })
    if (orderErr) throw orderErr

    const { error: payErr } = await serviceClient.from('order_payments').insert({
      order_id: testOrderId,
      amount_received: 5000,
      payment_method: 'upi',
      transaction_reference: 'INITIAL_DOWNPAYMENT',
      remarks: 'Step 5 security remediation test fixture initial downpayment',
      received_at: new Date().toISOString()
    })
    if (payErr) throw payErr

    testAttachmentId = crypto.randomUUID()
    const storagePath = `orders/${testOrderId}/${testAttachmentId}_tax_invoice.pdf`
    const dummyPdf = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n' +
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
      '5 0 obj\n<< /Length 44 >>\nstream\n' +
      'BT\n/F1 14 Tf\n72 720 Td\n(ARS Computers - Invoice) Tj\nET\n' +
      'endstream\nendobj\n' +
      'xref\n0 6\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000058 00000 n \n' +
      '0000000115 00000 n \n' +
      '0000000224 00000 n \n' +
      '0000000295 00000 n \n' +
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n390\n%%EOF'
    )

    await serviceClient.storage.from('order-attachments').upload(storagePath, dummyPdf, {
      contentType: 'application/pdf',
      upsert: true
    })

    const { error: attErr } = await serviceClient.from('order_attachments').insert({
      id: testAttachmentId,
      order_id: testOrderId,
      storage_path: storagePath,
      original_filename: 'Tax_Invoice_2026.pdf',
      mime_type: 'application/pdf',
      file_size: dummyPdf.length,
      document_type: 'OTHER_INTERNAL',
      is_customer_shareable: false,
      is_head_approved: false,
      share_request_status: 'NONE'
    })
    if (attErr) throw attErr
  })

  after(async () => {
    if (testOrderId) {
      await serviceClient.from('orders').delete().eq('id', testOrderId)
    }
  })

  // --------------------------------------------------------------------------
  // PRIORITY 1: CRITICAL RPC PERMISSION DEFECT
  // --------------------------------------------------------------------------
  test('1. Priority 1 — resolve_shared_attachment_token execution permissions', async (t) => {
    // Generate a valid token using serviceClient
    // First approve the attachment via Head
    await headClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })

    const { data: shareData, error: shareErr } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 48
    })
    assert.equal(shareErr, null, 'create_order_attachment_share must succeed for Head')
    testShareId = shareData.share_id
    testRawToken = shareData.raw_token
    testTokenHash = crypto.createHash('sha256').update(Buffer.from(testRawToken, 'hex')).digest('hex')

    await t.test('1a. service_role CAN execute resolve_shared_attachment_token', async () => {
      const { data, error } = await serviceClient.rpc('resolve_shared_attachment_token', {
        p_token_hash: testTokenHash,
        p_client_ip: '103.21.244.10',
        p_user_agent: 'TestAgent/1.0'
      })
      assert.equal(error, null, 'service_role must have EXECUTE permission')
      assert.equal(data?.valid, true, 'Token resolution must succeed')
      assert.ok(data?.storage_path, 'Must return storage_path to service_role')
    })

    await t.test('1b. authenticated role (Admin) CANNOT execute resolve_shared_attachment_token', async () => {
      const { data, error } = await adminClient.rpc('resolve_shared_attachment_token', {
        p_token_hash: testTokenHash,
        p_client_ip: '103.21.244.10',
        p_user_agent: 'TestAgent/1.0'
      })
      assert.ok(error, 'Admin client must be denied execution')
      assert.match(error.message, /permission denied|function public\.resolve_shared_attachment_token.*does not exist/i)
      assert.equal(data, null)
    })

    await t.test('1c. authenticated role (Head Superadmin) CANNOT execute resolve_shared_attachment_token directly', async () => {
      const { data, error } = await headClient.rpc('resolve_shared_attachment_token', {
        p_token_hash: testTokenHash,
        p_client_ip: '103.21.244.10',
        p_user_agent: 'TestAgent/1.0'
      })
      assert.ok(error, 'Head client must be denied direct execution through authenticated role')
      assert.match(error.message, /permission denied|function public\.resolve_shared_attachment_token.*does not exist/i)
      assert.equal(data, null)
    })

    await t.test('1d. authenticated role (Engineer, Technical, HR, Account, Inventory) CANNOT execute RPC', async () => {
      for (const client of [engineerClient, technicalClient, hrClient, accountClient, inventoryClient]) {
        const { data, error } = await client.rpc('resolve_shared_attachment_token', {
          p_token_hash: testTokenHash,
          p_client_ip: '103.21.244.10',
          p_user_agent: 'TestAgent/1.0'
        })
        assert.ok(error, 'Staff roles must be denied execution')
        assert.match(error.message, /permission denied|function public\.resolve_shared_attachment_token.*does not exist/i)
        assert.equal(data, null)
      }
    })

    await t.test('1e. anon role CANNOT execute resolve_shared_attachment_token', async () => {
      const { data, error } = await anonClient.rpc('resolve_shared_attachment_token', {
        p_token_hash: testTokenHash,
        p_client_ip: '103.21.244.10',
        p_user_agent: 'TestAgent/1.0'
      })
      assert.ok(error, 'anon must be denied execution')
      assert.match(error.message, /permission denied|function public\.resolve_shared_attachment_token.*does not exist/i)
      assert.equal(data, null)
    })

    await t.test('1f. Server-side proxy function still resolves token and streams binary', async () => {
      const res = await handleCustomerAttachmentDownload({
        token: testRawToken,
        clientIp: '103.21.244.10',
        userAgent: 'RemediationSuite/1.0',
        supabaseUrl: LOCAL_SUPABASE_URL,
        serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
      })
      assert.equal(res.status, 200, 'Server proxy using service_role must successfully serve attachment')
      assert.equal(res.headers['Content-Type'], 'application/pdf')
      assert.match(res.headers['Cache-Control'], /no-store/)
    })
  })

  // --------------------------------------------------------------------------
  // PRIORITY 2: SHARE AND ACCESS-LOG RLS PERMISSIONS
  // --------------------------------------------------------------------------
  test('2. Priority 2 — RLS policies on order_attachment_shares & access_logs', async (t) => {
    await t.test('2a. Head Superadmin CAN read order_attachment_shares and access logs', async () => {
      const { data: shares, error: shareErr } = await headClient
        .from('order_attachment_shares')
        .select('*')
        .eq('id', testShareId)
      assert.equal(shareErr, null)
      assert.ok(shares && shares.length > 0, 'Head must see share records')

      const { data: logs, error: logErr } = await headClient
        .from('order_attachment_access_logs')
        .select('*')
        .eq('share_id', testShareId)
      assert.equal(logErr, null)
      assert.ok(logs && logs.length > 0, 'Head must see access logs')
    })

    await t.test('2b. Store Admin CAN read order_attachment_shares and access logs', async () => {
      const { data: shares, error: shareErr } = await adminClient
        .from('order_attachment_shares')
        .select('*')
        .eq('id', testShareId)
      assert.equal(shareErr, null)
      assert.ok(shares && shares.length > 0, 'Store Admin must see share records')

      const { data: logs, error: logErr } = await adminClient
        .from('order_attachment_access_logs')
        .select('*')
        .eq('share_id', testShareId)
      assert.equal(logErr, null)
      assert.ok(logs && logs.length > 0, 'Store Admin must see access logs')
    })

    await t.test('2c. Technical, Engineer, HR, Account, and Inventory staff get 0 rows via RLS', async () => {
      const restrictedClients = [
        { client: technicalClient, name: 'technical' },
        { client: engineerClient, name: 'engineer' },
        { client: hrClient, name: 'hr' },
        { client: accountClient, name: 'account' },
        { client: inventoryClient, name: 'inventory_staff' }
      ]

      for (const { client, name } of restrictedClients) {
        const { data: shares, error: shareErr } = await client
          .from('order_attachment_shares')
          .select('*')
          .eq('id', testShareId)
        assert.equal(shareErr, null, `${name} query must not crash but return 0 rows`)
        assert.equal(shares?.length, 0, `${name} must receive 0 share rows`)

        const { data: logs, error: logErr } = await client
          .from('order_attachment_access_logs')
          .select('*')
          .eq('share_id', testShareId)
        assert.equal(logErr, null, `${name} query must not crash but return 0 rows`)
        assert.equal(logs?.length, 0, `${name} must receive 0 log rows`)
      }
    })

    await t.test('2d. Anonymous users have zero access to shares and access logs', async () => {
      const { data: shares, error: shareErr } = await anonClient
        .from('order_attachment_shares')
        .select('*')
        .eq('id', testShareId)
      assert.ok(shareErr || (shares && shares.length === 0), 'anon must have no share access')

      const { data: logs, error: logErr } = await anonClient
        .from('order_attachment_access_logs')
        .select('*')
        .eq('share_id', testShareId)
      assert.ok(logErr || (logs && logs.length === 0), 'anon must have no log access')
    })

    await t.test('2e. Client roles CANNOT INSERT, UPDATE, or DELETE on access logs', async () => {
      // Direct INSERT attempt
      const { error: insertErr } = await adminClient.from('order_attachment_access_logs').insert({
        share_id: testShareId,
        ip_address: '1.2.3.4',
        user_agent: 'TamperAgent'
      })
      assert.ok(insertErr, 'Client INSERT on access logs must be rejected')

      // Direct UPDATE attempt
      const { error: updateErr } = await headClient
        .from('order_attachment_access_logs')
        .update({ ip_address: '0.0.0.0' })
        .eq('share_id', testShareId)
      assert.ok(updateErr, 'Client UPDATE on access logs must be rejected')

      // Direct DELETE attempt
      const { error: deleteErr } = await headClient
        .from('order_attachment_access_logs')
        .delete()
        .eq('share_id', testShareId)
      assert.ok(deleteErr, 'Client DELETE on access logs must be rejected')
    })
  })

  // --------------------------------------------------------------------------
  // PRIORITY 4: ADMIN REQUEST & HEAD APPROVAL WORKFLOW
  // --------------------------------------------------------------------------
  test('3. Priority 4 — Admin request & Head approval workflow', async (t) => {
    // Create an unapproved attachment
    const newAttId = crypto.randomUUID()
    const newPath = `orders/${testOrderId}/${newAttId}_receipt.pdf`
    await serviceClient.from('order_attachments').insert({
      id: newAttId,
      order_id: testOrderId,
      storage_path: newPath,
      original_filename: 'Customer_Advance_Receipt.pdf',
      mime_type: 'application/pdf',
      file_size: 1024,
      document_type: 'OTHER_INTERNAL',
      is_customer_shareable: false,
      is_head_approved: false,
      share_request_status: 'NONE'
    })

    await t.test('3a. Non-admin roles CANNOT request shareability', async () => {
      for (const client of [engineerClient, technicalClient, hrClient, accountClient, inventoryClient]) {
        const { error } = await client.rpc('request_order_attachment_shareability', {
          p_attachment_id: newAttId,
          p_document_type: 'CUSTOMER_RECEIPT',
          p_notes: 'Please approve receipt'
        })
        assert.ok(error, 'Non-admin role must be rejected')
        assert.match(error.message, /Access denied/i)
      }
    })

    await t.test('3b. Store Admin CAN submit customer shareability request', async () => {
      const { data, error } = await adminClient.rpc('request_order_attachment_shareability', {
        p_attachment_id: newAttId,
        p_document_type: 'CUSTOMER_RECEIPT',
        p_notes: 'Urgent customer requirement for warranty registration'
      })
      assert.equal(error, null, 'Admin request must succeed')
      assert.equal(data?.success, true)
      assert.equal(data?.share_request_status, 'PENDING')

      // Check persisted fields
      const { data: att } = await serviceClient
        .from('order_attachments')
        .select('*')
        .eq('id', newAttId)
        .single()
      assert.equal(att.share_request_status, 'PENDING')
      assert.equal(att.share_requested_document_type, 'CUSTOMER_RECEIPT')
      assert.equal(att.share_request_notes, 'Urgent customer requirement for warranty registration')
      assert.ok(att.share_requested_at)
      assert.equal(att.is_head_approved, false, 'Must remain unapproved until Head review')
    })

    await t.test('3c. Store Admin CANNOT self-approve or review share request', async () => {
      const { data, error } = await adminClient.rpc('review_order_attachment_share_request', {
        p_attachment_id: newAttId,
        p_decision: 'APPROVED',
        p_document_type: 'CUSTOMER_RECEIPT'
      })
      assert.ok(error, 'Admin cannot approve share request')
      assert.match(error.message, /Access denied: Only Head \/ Superadmin can review or approve/i)
      assert.equal(data, null)
    })

    await t.test('3d. Unapproved attachment CANNOT generate customer share links', async () => {
      const { data, error } = await adminClient.rpc('create_order_attachment_share', {
        p_attachment_id: newAttId,
        p_duration_hours: 48
      })
      assert.ok(error, 'create_order_attachment_share must fail for unapproved attachment')
      assert.match(error.message, /Attachment has not been approved for customer sharing by Head Admin/i)
      assert.equal(data, null)
    })

    await t.test('3e. Head Superadmin can REJECT the share request with reason', async () => {
      const { data, error } = await headClient.rpc('review_order_attachment_share_request', {
        p_attachment_id: newAttId,
        p_decision: 'REJECTED',
        p_rejection_reason: 'Missing customer GSTIN and authorized signature'
      })
      assert.equal(error, null, 'Head rejection must succeed')
      assert.equal(data?.share_request_status, 'REJECTED')
      assert.equal(data?.is_customer_shareable, false)

      const { data: att } = await serviceClient
        .from('order_attachments')
        .select('*')
        .eq('id', newAttId)
        .single()
      assert.equal(att.share_request_status, 'REJECTED')
      assert.equal(att.share_review_rejection_reason, 'Missing customer GSTIN and authorized signature')
      assert.equal(att.is_head_approved, false)
    })

    await t.test('3f. Store Admin can re-submit after rejection', async () => {
      const { data, error } = await adminClient.rpc('request_order_attachment_shareability', {
        p_attachment_id: newAttId,
        p_document_type: 'CUSTOMER_RECEIPT',
        p_notes: 'Updated document with signature and stamp'
      })
      assert.equal(error, null)
      assert.equal(data?.share_request_status, 'PENDING')
    })

    await t.test('3g. Head Superadmin can APPROVE the share request', async () => {
      const { data, error } = await headClient.rpc('review_order_attachment_share_request', {
        p_attachment_id: newAttId,
        p_decision: 'APPROVED',
        p_document_type: 'CUSTOMER_RECEIPT'
      })
      assert.equal(error, null, 'Head approval must succeed')
      assert.equal(data?.share_request_status, 'APPROVED')
      assert.equal(data?.is_customer_shareable, true)
      assert.equal(data?.is_head_approved, true)

      // Now Store Admin CAN generate share link
      const { data: shareData, error: shareErr } = await adminClient.rpc('create_order_attachment_share', {
        p_attachment_id: newAttId,
        p_duration_hours: 24
      })
      assert.equal(shareErr, null, 'Store Admin can now generate share link for Head-approved document')
      assert.ok(shareData?.raw_token)
    })
  })

  // --------------------------------------------------------------------------
  // PRIORITY 5: IP MASKING & ACCESS LOG RETENTION
  // --------------------------------------------------------------------------
  test('4. Priority 5 — IP masking & 90-day retention cleanup', async (t) => {
    await t.test('4a. IP masking helper correctly masks IPv4 and IPv6', async () => {
      const { data: maskV4 } = await serviceClient.rpc('mask_ip_address', { p_ip: '49.207.210.88' })
      assert.equal(maskV4, '49.207.210.xxx', 'IPv4 last octet must be masked')

      const { data: maskV6 } = await serviceClient.rpc('mask_ip_address', { p_ip: '2405:201:6803:905e:88b1:4799:3c65:982b' })
      assert.equal(maskV6, '2405:201:6803:905e:88b1:4799:3c65:xxxx', 'IPv6 last segment must be masked')
    })

    await t.test('4b. Access log records populate masked_ip on token resolution', async () => {
      const { data: logs } = await serviceClient
        .from('order_attachment_access_logs')
        .select('masked_ip')
        .eq('share_id', testShareId)
        .order('accessed_at', { ascending: false })
        .limit(1)
      assert.ok(logs && logs.length > 0)
      assert.equal(logs[0].masked_ip, '103.21.244.xxx')
    })

    await t.test('4c. Retention cleanup RPC removes expired logs and preserves active logs', async () => {
      const now = new Date()
      const expiredDate = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString() // 95 days ago
      const activeDate = new Date(now.getTime() + 80 * 24 * 60 * 60 * 1000).toISOString() // 80 days in future

      // Insert mock expired log
      const expiredLogId = crypto.randomUUID()
      await serviceClient.from('order_attachment_access_logs').insert({
        id: expiredLogId,
        share_id: testShareId,
        accessed_at: expiredDate,
        ip_address: '1.1.1.1',
        masked_ip: '1.1.1.xxx',
        user_agent: 'ExpiredAgent',
        retention_until: expiredDate
      })

      // Insert mock active log
      const activeLogId = crypto.randomUUID()
      await serviceClient.from('order_attachment_access_logs').insert({
        id: activeLogId,
        share_id: testShareId,
        accessed_at: now.toISOString(),
        ip_address: '2.2.2.2',
        masked_ip: '2.2.2.xxx',
        user_agent: 'ActiveAgent',
        retention_until: activeDate
      })

      // Run cleanup RPC via service_role
      const { data: cleanupRes, error: cleanupErr } = await serviceClient.rpc(
        'cleanup_expired_order_attachment_access_logs'
      )
      assert.equal(cleanupErr, null)
      assert.equal(cleanupRes?.success, true)
      assert.ok(cleanupRes?.deleted_logs_count >= 1, 'Must delete at least 1 expired log')

      // Verify expired log is gone
      const { data: checkExpired } = await serviceClient
        .from('order_attachment_access_logs')
        .select('id')
        .eq('id', expiredLogId)
      assert.equal(checkExpired?.length, 0, 'Expired log must be purged')

      // Verify active log is still present
      const { data: checkActive } = await serviceClient
        .from('order_attachment_access_logs')
        .select('id')
        .eq('id', activeLogId)
      assert.equal(checkActive?.length, 1, 'Active log must be preserved')

      // Clean up active test log
      await serviceClient.from('order_attachment_access_logs').delete().eq('id', activeLogId)
    })

    await t.test('4d. Non-superadmin client roles CANNOT execute cleanup_expired_order_attachment_access_logs', async () => {
      const { error: adminErr } = await adminClient.rpc('cleanup_expired_order_attachment_access_logs')
      assert.ok(adminErr, 'Admin must not be able to trigger log retention cleanup')
      assert.match(adminErr.message, /Access denied/i)

      const { error: engineerErr } = await engineerClient.rpc('cleanup_expired_order_attachment_access_logs')
      assert.ok(engineerErr, 'Engineer must not be able to trigger log retention cleanup')
    })
  })

  // --------------------------------------------------------------------------
  // PRIORITY 3: DISTRIBUTED RATE LIMITING DOCUMENTATION
  // --------------------------------------------------------------------------
  test('5. Priority 3 — Documentation of Cloudflare Rate Limiting rules', async () => {
    const docPath = path.join(process.cwd(), 'docs', 'CLOUDFLARE_RATE_LIMITING_AND_LOG_RETENTION.md')
    assert.ok(fs.existsSync(docPath), 'Documentation file must exist')
    const docContent = fs.readFileSync(docPath, 'utf8')

    assert.match(
      docContent,
      /http\.request\.uri\.path matches "\^\/api\/share\/attachment\/\[0-9a-f\]\{64\}\$"/,
      'Document must specify exact regex path expression for WAF rate limiting'
    )
    assert.match(
      docContent,
      /30 requests/i,
      'Document must specify 30 requests threshold'
    )
    assert.match(
      docContent,
      /900 seconds/i,
      'Document must specify 900 seconds / 15 minutes mitigation action'
    )
    assert.match(
      docContent,
      /cleanup_expired_order_attachment_access_logs/,
      'Document must specify database cleanup procedure'
    )
  })
})
