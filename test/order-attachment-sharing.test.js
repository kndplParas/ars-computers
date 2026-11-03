/**
 * ARS Computers — Step 5: Customer-Shareable Order Attachments Test Suite
 *
 * Verifies:
 * 1. Role hierarchy: only Head (superadmin) can approve customer shareability.
 * 2. Document classification and keyword defense-in-depth.
 * 3. Token generation, entropy, and SHA-256 hashing at rest.
 * 4. Server-side download proxy (streaming, Cache-Control: no-store, zero URLs leaked).
 * 5. Server-derived audit logging (IP and user-agent).
 * 6. Expiry and instantaneous revocation enforcement.
 * 7. Order cancellation binding.
 * 8. Cross-order and IDOR isolation.
 * 9. Rate limiting and brute-force throttling.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  handleCustomerAttachmentDownload,
  resetRateLimitsForTesting
} from '../src/server/shareAttachmentHandler.js'

const LOCAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const TEST_PASSWORD = 'TestPassword123!'

describe('ARS Computers — Step 5 Customer-Shareable Order Attachments Suite', () => {
  let serviceClient
  let headClient
  let adminClient
  let engineerClient
  let inventoryClient

  let testOrderId
  let testAttachmentId
  let testStoragePath
  let testDummyPdfBuffer

  const roles = [
    { email: 'step5-head@arscomputers.test', role: 'superadmin', fullName: 'Head Test Admin' },
    { email: 'step5-admin@arscomputers.test', role: 'admin', fullName: 'Store Admin Test' },
    { email: 'step5-engineer@arscomputers.test', role: 'engineer', fullName: 'Engineer Test' },
    { email: 'step5-inventory@arscomputers.test', role: 'inventory_staff', fullName: 'Inventory Test' }
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

    const client = createClient(LOCAL_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon', {
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

    headClient = await getOrCreateUser(roles[0].email, roles[0].role, roles[0].fullName)
    adminClient = await getOrCreateUser(roles[1].email, roles[1].role, roles[1].fullName)
    engineerClient = await getOrCreateUser(roles[2].email, roles[2].role, roles[2].fullName)
    inventoryClient = await getOrCreateUser(roles[3].email, roles[3].role, roles[3].fullName)

    // Clean up any stale test orders with prefix
    await serviceClient.from('orders').delete().ilike('order_number', '%ORD-STEP5%')

    // Create a dedicated active test order
    testOrderId = crypto.randomUUID()
    const uniqueOrderNum = `ORD-STEP5-${Date.now()}`
    const { error: orderErr } = await serviceClient.from('orders').insert({
      id: testOrderId,
      order_number: uniqueOrderNum,
      customer_name: 'Vikram Malhotra',
      contact_info: '+919876543210',
      status: 'new',
      total_amount: 15500,
      paid_amount: 0,
      payment_method: 'upi',
      payment_status: 'pending'
    })
    if (orderErr) throw orderErr

    // Upload valid 1-page PDF into storage bucket 'order-attachments'
    testDummyPdfBuffer = Buffer.from(
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
    testStoragePath = `${testOrderId}/customer_tax_invoice_${crypto.randomUUID()}.pdf`

    await serviceClient.storage.from('order-attachments').upload(testStoragePath, testDummyPdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

    // Register attachment in public.order_attachments via serviceClient
    testAttachmentId = crypto.randomUUID()
    const { error: attErr } = await serviceClient.from('order_attachments').insert({
      id: testAttachmentId,
      order_id: testOrderId,
      storage_path: testStoragePath,
      original_filename: 'Tax_Invoice_ORD-STEP5-TEST-001.pdf',
      mime_type: 'application/pdf',
      file_size: testDummyPdfBuffer.length,
      document_type: 'OTHER_INTERNAL',
      is_customer_shareable: false,
      is_head_approved: false
    })
    if (attErr) throw attErr
  })

  after(async () => {
    // Cleanup test records
    if (testOrderId) {
      await serviceClient.from('order_attachment_shares').delete().eq('order_id', testOrderId)
      await serviceClient.from('order_attachments').delete().eq('order_id', testOrderId)
      await serviceClient.from('orders').delete().eq('id', testOrderId)
      if (testStoragePath) {
        await serviceClient.storage.from('order-attachments').remove([testStoragePath])
      }
    }
  })

  test('1. Default attachment state is internal and unapproved', async () => {
    const { data: att, error } = await serviceClient
      .from('order_attachments')
      .select('is_customer_shareable, is_head_approved, document_type')
      .eq('id', testAttachmentId)
      .single()

    assert.equal(error, null)
    assert.equal(att.is_customer_shareable, false)
    assert.equal(att.is_head_approved, false)
    assert.equal(att.document_type, 'OTHER_INTERNAL')
  })

  test('2. Store Admin CANNOT approve customer shareability (Head only: 42501)', async () => {
    const { error } = await adminClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })

    assert.notEqual(error, null)
    assert.match(error.message, /Access denied: Only Head \/ Superadmin/i)
  })

  test('3. Engineer and Inventory Staff CANNOT approve shareability', async () => {
    const { error: engErr } = await engineerClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })
    assert.notEqual(engErr, null)

    const { error: invErr } = await inventoryClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })
    assert.notEqual(invErr, null)
  })

  test('4. Sensitive keyword defense-in-depth blocks internal cost/Aadhaar documents', async () => {
    // Create an attachment with sensitive name
    const sensitivePath = `${testOrderId}/supplier_purchase_cost_margin_${crypto.randomUUID()}.pdf`
    const sensitiveId = crypto.randomUUID()

    await serviceClient.from('order_attachments').insert({
      id: sensitiveId,
      order_id: testOrderId,
      storage_path: sensitivePath,
      original_filename: 'Internal_Supplier_Bill_Cost_Margin.pdf',
      mime_type: 'application/pdf',
      file_size: 1024,
      document_type: 'SUPPLIER_PURCHASE_BILL',
      is_customer_shareable: false
    })

    const { error } = await headClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: sensitiveId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })

    assert.notEqual(error, null)
    assert.match(error.message, /Security violation: Documents with internal cost/i)

    // Clean up sensitive record
    await serviceClient.from('order_attachments').delete().eq('id', sensitiveId)
  })

  test('5. Head Superadmin can approve customer shareability with valid document type', async () => {
    const { data: res, error } = await headClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })

    assert.equal(error, null)
    assert.equal(res.success, true)
    assert.equal(res.is_customer_shareable, true)
    assert.equal(res.is_head_approved, true)
    assert.equal(res.document_type, 'CUSTOMER_INVOICE')

    // Verify activity logged
    const { data: activities } = await serviceClient
      .from('order_activities')
      .select('*')
      .eq('order_id', testOrderId)
      .eq('activity_type', 'ATTACHMENT_MARKED_CUSTOMER_SHAREABLE')

    assert.ok(activities && activities.length > 0)
  })

  test('6. Store Admin CAN create share link for Head-approved attachment', async () => {
    const { data: res, error } = await adminClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 48
    })

    assert.equal(error, null)
    assert.equal(res.success, true)
    assert.ok(res.share_id)
    assert.ok(res.raw_token)
    assert.equal(res.raw_token.length, 64) // 256 bits in hex

    // Verify raw_token is NEVER stored in database (only token_hash is stored)
    const { data: dbShare } = await serviceClient
      .from('order_attachment_shares')
      .select('token_hash')
      .eq('id', res.share_id)
      .single()

    assert.notEqual(dbShare.token_hash, res.raw_token)

    // Verify token_hash is exact SHA-256 of raw_token
    const computedHash = crypto
      .createHash('sha256')
      .update(Buffer.from(res.raw_token, 'hex'))
      .digest('hex')
    assert.equal(dbShare.token_hash, computedHash)
  })

  test('7. Server download proxy streams binary with Cache-Control: no-store and logs access', async () => {
    resetRateLimitsForTesting()

    // Create a fresh share
    const { data: shareRes } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 24
    })

    const rawToken = shareRes.raw_token
    const testIp = '203.0.113.42'
    const testUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser/1.0'

    const response = await handleCustomerAttachmentDownload({
      token: rawToken,
      clientIp: testIp,
      userAgent: testUa,
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers['Content-Type'], 'application/pdf')
    assert.match(response.headers['Content-Disposition'], /attachment; filename="Tax_Invoice_ORD-STEP5-TEST-001\.pdf"/)
    assert.equal(response.headers['Cache-Control'], 'no-store, no-cache, must-revalidate, private, max-age=0')
    assert.equal(response.headers['X-Content-Type-Options'], 'nosniff')
    assert.ok(response.body)
    assert.deepEqual(response.body, testDummyPdfBuffer)

    // Verify access logged in order_attachment_access_logs
    const { data: logs } = await serviceClient
      .from('order_attachment_access_logs')
      .select('*')
      .eq('share_id', shareRes.share_id)

    assert.ok(logs && logs.length === 1)
    assert.equal(logs[0].ip_address, testIp)
    assert.equal(logs[0].user_agent, testUa)
    assert.equal(logs[0].response_status, 200)

    // Verify access_count incremented
    const { data: updatedShare } = await serviceClient
      .from('order_attachment_shares')
      .select('access_count')
      .eq('id', shareRes.share_id)
      .single()

    assert.equal(updatedShare.access_count, 1)
  })

  test('8. Revoking share immediately rejects future download requests (410 Gone)', async () => {
    resetRateLimitsForTesting()

    const { data: shareRes } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 24
    })

    // Revoke share
    const { data: revokeRes, error: revokeErr } = await adminClient.rpc('revoke_order_attachment_share', {
      p_share_id: shareRes.share_id,
      p_reason: 'Testing customer revocation'
    })

    assert.equal(revokeErr, null)
    assert.equal(revokeRes.is_revoked, true)

    // Attempt download with revoked token
    const response = await handleCustomerAttachmentDownload({
      token: shareRes.raw_token,
      clientIp: '198.51.100.12',
      userAgent: 'TestClient/2.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 410)
    const body = JSON.parse(response.body)
    assert.equal(body.success, false)
    assert.match(body.error, /invalid, has expired, or was revoked/i)
  })

  test('9. Unmarking attachment by Head cascades to invalidate active shares', async () => {
    resetRateLimitsForTesting()

    const { data: shareRes } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 24
    })

    // Head unmarks attachment back to internal
    await headClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: false,
      p_document_type: 'OTHER_INTERNAL'
    })

    // Attempt download
    const response = await handleCustomerAttachmentDownload({
      token: shareRes.raw_token,
      clientIp: '198.51.100.15',
      userAgent: 'TestClient/2.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 410)

    // Re-approve for remaining tests
    await headClient.rpc('approve_order_attachment_shareability', {
      p_attachment_id: testAttachmentId,
      p_is_shareable: true,
      p_document_type: 'CUSTOMER_INVOICE'
    })
  })

  test('10. Expired tokens are strictly rejected with 410 Gone', async () => {
    resetRateLimitsForTesting()

    const { data: shareRes } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: testAttachmentId,
      p_duration_hours: 1
    })

    // Manually set expires_at in the past
    await serviceClient
      .from('order_attachment_shares')
      .update({ expires_at: new Date(Date.now() - 3600000).toISOString() })
      .eq('id', shareRes.share_id)

    const response = await handleCustomerAttachmentDownload({
      token: shareRes.raw_token,
      clientIp: '198.51.100.20',
      userAgent: 'TestClient/2.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 410)
  })

  test('11. Cancelled orders strictly block attachment download', async () => {
    resetRateLimitsForTesting()

    // Create a separate order and attachment specifically for cancellation test
    const cancelledOrderId = crypto.randomUUID()
    const cancelledAttId = crypto.randomUUID()
    const cancelledStoragePath = `${cancelledOrderId}/cancelled_order_doc_${crypto.randomUUID()}.pdf`

    const { error: insOrderErr } = await serviceClient.from('orders').insert({
      id: cancelledOrderId,
      order_number: `ORD-STEP5-CANCELLED-${Date.now()}`,
      customer_name: 'Test Customer',
      contact_info: '+919876543211',
      status: 'new',
      total_amount: 1000,
      paid_amount: 0,
      payment_method: 'cash',
      payment_status: 'pending'
    })
    if (insOrderErr) throw insOrderErr

    await serviceClient.storage.from('order-attachments').upload(cancelledStoragePath, testDummyPdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

    const { error: insAttErr } = await serviceClient.from('order_attachments').insert({
      id: cancelledAttId,
      order_id: cancelledOrderId,
      storage_path: cancelledStoragePath,
      original_filename: 'Invoice_Cancelled_Order.pdf',
      mime_type: 'application/pdf',
      file_size: testDummyPdfBuffer.length,
      document_type: 'CUSTOMER_INVOICE',
      is_customer_shareable: true,
      is_head_approved: true
    })
    if (insAttErr) throw insAttErr

    const { data: shareRes, error: shareErr } = await headClient.rpc('create_order_attachment_share', {
      p_attachment_id: cancelledAttId,
      p_duration_hours: 24
    })
    if (shareErr) throw shareErr

    // Now cancel the order
    await serviceClient
      .from('orders')
      .update({ status: 'cancelled', cancellation_reason: 'Customer requested cancellation' })
      .eq('id', cancelledOrderId)

    // Attempt download of share for cancelled order
    const response = await handleCustomerAttachmentDownload({
      token: shareRes.raw_token,
      clientIp: '198.51.100.25',
      userAgent: 'TestClient/2.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 410)

    // Cleanup cancelled order test data
    await serviceClient.from('order_attachment_shares').delete().eq('order_id', cancelledOrderId)
    await serviceClient.from('order_attachments').delete().eq('order_id', cancelledOrderId)
    await serviceClient.from('orders').delete().eq('id', cancelledOrderId)
    await serviceClient.storage.from('order-attachments').remove([cancelledStoragePath])
  })

  test('12. IDOR & Tampered tokens return 410 without leaking other order details', async () => {
    resetRateLimitsForTesting()

    // Random non-existent 64-hex token
    const fakeToken = crypto.randomBytes(32).toString('hex')

    const response = await handleCustomerAttachmentDownload({
      token: fakeToken,
      clientIp: '198.51.100.30',
      userAgent: 'AttackerScanner/1.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(response.status, 410)
    const body = JSON.parse(response.body)
    assert.equal(body.success, false)
    assert.match(body.error, /invalid, has expired, or was revoked/i)
    // No UUIDs or paths leaked
    assert.equal(body.order_id, undefined)
    assert.equal(body.storage_path, undefined)
  })

  test('13. Rate limiting blocks brute-force enumeration after 5 failed attempts', async () => {
    resetRateLimitsForTesting()
    const attackerIp = '198.51.100.99'

    for (let i = 0; i < 5; i++) {
      const fakeToken = crypto.randomBytes(32).toString('hex')
      const res = await handleCustomerAttachmentDownload({
        token: fakeToken,
        clientIp: attackerIp,
        userAgent: 'BruteForceTool/1.0',
        supabaseUrl: LOCAL_SUPABASE_URL,
        serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
      })
      assert.equal(res.status, 410)
    }

    // 6th attempt from the same IP must be rejected with 429
    const sixthRes = await handleCustomerAttachmentDownload({
      token: crypto.randomBytes(32).toString('hex'),
      clientIp: attackerIp,
      userAgent: 'BruteForceTool/1.0',
      supabaseUrl: LOCAL_SUPABASE_URL,
      serviceRoleKey: LOCAL_SERVICE_ROLE_KEY
    })

    assert.equal(sixthRes.status, 429)
    const body = JSON.parse(sixthRes.body)
    assert.match(body.error, /Too many requests/i)
  })

  test('14. Inventory staff cannot query order_attachment_shares directly via RLS', async () => {
    const { data: shares } = await inventoryClient
      .from('order_attachment_shares')
      .select('*')

    // RLS blocks inventory_staff (empty array or error)
    assert.ok(shares === null || (Array.isArray(shares) && shares.length === 0))
  })
})
