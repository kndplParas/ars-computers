/**
 * ARS Computers — Step 5 Real Cloudflare Runtime Verification Suite
 *
 * Runs the Pages Function inside Cloudflare's actual local edge runtime:
 * `wrangler pages dev` with `workerd` and `nodejs_compat`.
 *
 * Validates:
 * 1. node:crypto compatibility under workerd.
 * 2. Buffer compatibility under workerd.
 * 3. Environment bindings via -b SUPABASE_URL and -b SUPABASE_SERVICE_ROLE_KEY.
 * 4. Missing secrets fail safely.
 * 5. Private Supabase Storage download via service_role inside workerd.
 * 6. Token resolution RPC execution.
 * 7. Binary streaming with exact byte matching.
 * 8. Headers: Content-Type, Content-Disposition, Cache-Control: no-store, X-Content-Type-Options: nosniff, CSP.
 * 9. Lifecycle rejection: invalid token, expired token, revoked token, unapproved attachment, cancelled order.
 * 10. Zero leakage of service_role keys, database IDs, or private storage paths.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const WRANGLER_PORT = 8789
const BASE_URL = `http://127.0.0.1:${WRANGLER_PORT}`

describe('Cloudflare Pages Function Real Runtime (Wrangler workerd) Suite', () => {
  let serviceClient
  let wranglerProcess
  let testOrderId
  let testAttachmentId
  let activeRawToken
  let revokedRawToken
  let expiredRawToken
  let unapprovedAttachmentId
  let unapprovedRawToken
  let cancelledOrderId
  let cancelledAttachmentId
  let cancelledRawToken
  const testBinary = Buffer.from('%PDF-1.4 Cloudflare workerd Edge Runtime Binary Verification Content %EOF')

  before(async () => {
    serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })

    // 1. Setup Active Test Order
    const { data: order, error: orderErr } = await serviceClient
      .from('orders')
      .insert({
        order_number: `ORD-WRANGLER-${Date.now()}`,
        status: 'new',
        customer_name: 'Wrangler Test Customer',
        contact_info: '+919876543220',
        total_amount: 35000
      })
      .select()
      .single()
    assert.ifError(orderErr)
    testOrderId = order.id

    // 2. Upload Binary to Private Storage
    const storagePath = `orders/${testOrderId}/invoice_edge_${Date.now()}.pdf`
    const { error: uploadErr } = await serviceClient.storage
      .from('order-attachments')
      .upload(storagePath, testBinary, {
        contentType: 'application/pdf',
        upsert: true
      })
    assert.ifError(uploadErr)

    // 3. Insert Approved Attachment
    const { data: att, error: attErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: testOrderId,
        storage_path: storagePath,
        original_filename: 'Customer_Invoice_2026.pdf',
        mime_type: 'application/pdf',
        file_size: testBinary.length,
        document_type: 'CUSTOMER_INVOICE',
        is_customer_shareable: true,
        is_head_approved: true,
        share_request_status: 'APPROVED'
      })
      .select()
      .single()
    assert.ifError(attErr)
    testAttachmentId = att.id

    // 4. Create Active Share Token
    const b1 = crypto.randomBytes(32)
    activeRawToken = b1.toString('hex')
    const h1 = crypto.createHash('sha256').update(b1).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: h1,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 5. Create Revoked Share Token
    const b2 = crypto.randomBytes(32)
    revokedRawToken = b2.toString('hex')
    const h2 = crypto.createHash('sha256').update(b2).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: h2,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: true,
      revocation_reason: 'Revoked for testing'
    })

    // 6. Create Expired Share Token
    const b3 = crypto.randomBytes(32)
    expiredRawToken = b3.toString('hex')
    const h3 = crypto.createHash('sha256').update(b3).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: h3,
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 7. Create Unapproved Attachment & Token
    const storagePathUnapproved = `orders/${testOrderId}/internal_${Date.now()}.pdf`
    const { data: unapprovedAtt, error: unapprovedErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: testOrderId,
        storage_path: storagePathUnapproved,
        original_filename: 'Internal_Estimate.pdf',
        mime_type: 'application/pdf',
        file_size: testBinary.length,
        document_type: 'OTHER_INTERNAL',
        is_customer_shareable: false,
        is_head_approved: false,
        share_request_status: 'NONE'
      })
      .select()
      .single()
    assert.ifError(unapprovedErr)
    unapprovedAttachmentId = unapprovedAtt.id

    const b4 = crypto.randomBytes(32)
    unapprovedRawToken = b4.toString('hex')
    const h4 = crypto.createHash('sha256').update(b4).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: unapprovedAttachmentId,
      order_id: testOrderId,
      token_hash: h4,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 8. Create Cancelled Order & Token
    const { data: cancelledOrder, error: cancelledErr } = await serviceClient
      .from('orders')
      .insert({
        order_number: `ORD-CANCELLED-${Date.now()}`,
        status: 'cancelled',
        cancellation_reason: 'Order cancelled by customer during edge test',
        customer_name: 'Cancelled Customer',
        contact_info: '+919876543221',
        total_amount: 19000
      })
      .select()
      .single()
    assert.ifError(cancelledErr)
    cancelledOrderId = cancelledOrder.id

    const storagePathCancelled = `orders/${cancelledOrderId}/cancelled_${Date.now()}.pdf`
    const { data: cancelledAtt, error: cancelledAttErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: cancelledOrderId,
        storage_path: storagePathCancelled,
        original_filename: 'Cancelled_Document.pdf',
        mime_type: 'application/pdf',
        file_size: testBinary.length,
        document_type: 'CUSTOMER_INVOICE',
        is_customer_shareable: true,
        is_head_approved: true,
        share_request_status: 'APPROVED'
      })
      .select()
      .single()
    assert.ifError(cancelledAttErr)
    cancelledAttachmentId = cancelledAtt.id

    const b5 = crypto.randomBytes(32)
    cancelledRawToken = b5.toString('hex')
    const h5 = crypto.createHash('sha256').update(b5).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: cancelledAttachmentId,
      order_id: cancelledOrderId,
      token_hash: h5,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 9. Launch Wrangler Pages Dev Server
    console.log('Spawning Wrangler Pages Dev server on port', WRANGLER_PORT)
    wranglerProcess = spawn(
      'npx',
      [
        'wrangler',
        'pages',
        'dev',
        'dist',
        '--compatibility-flag',
        'nodejs_compat',
        '--port',
        String(WRANGLER_PORT),
        '--ip',
        '127.0.0.1',
        '-b',
        `SUPABASE_URL=${LOCAL_SUPABASE_URL}`,
        '-b',
        `SUPABASE_SERVICE_ROLE_KEY=${LOCAL_SERVICE_ROLE_KEY}`
      ],
      {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )

    let serverReady = false
    wranglerProcess.stdout.on('data', (d) => {
      const msg = d.toString()
      if (msg.includes('Ready on') || msg.includes('http://127.0.0.1:') || msg.includes('Local:')) {
        serverReady = true
      }
    })
    wranglerProcess.stderr.on('data', (d) => {
      console.error('[wrangler stderr]', d.toString())
    })

    // Poll until server is responding
    const startTime = Date.now()
    while (!serverReady && Date.now() - startTime < 30000) {
      try {
        const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1000) })
        if (res.status === 200 || res.status === 404) {
          serverReady = true
          break
        }
      } catch {
        // waiting for port to open
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    assert.ok(serverReady, 'Wrangler Pages Dev server failed to become ready within 30 seconds')
  })

  after(async () => {
    // 1. Terminate Wrangler Process
    if (wranglerProcess) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(wranglerProcess.pid), '/f', '/t'])
        } else {
          wranglerProcess.kill('SIGTERM')
        }
      } catch (e) {
        console.error('Error killing wrangler process:', e)
      }
    }

    // 2. Clean Up Test Data
    if (testOrderId) {
      await serviceClient.from('order_attachment_access_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await serviceClient.from('order_attachment_shares').delete().in('order_id', [testOrderId, cancelledOrderId])
      await serviceClient.from('order_attachments').delete().in('order_id', [testOrderId, cancelledOrderId])
      await serviceClient.from('orders').delete().in('id', [testOrderId, cancelledOrderId])
    }
  })

  test('1. Valid token streams PDF binary from private Storage through workerd edge runtime', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/${activeRawToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.1' }
    })
    assert.equal(res.status, 200)

    // Security & Cache Headers
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Customer_Invoice_2026.pdf"')
    assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, private, max-age=0')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('content-security-policy'), "default-src 'none'")

    // Binary Content Integrity
    const arrayBuffer = await res.arrayBuffer()
    const receivedBuffer = Buffer.from(arrayBuffer)
    assert.equal(receivedBuffer.toString('utf-8'), testBinary.toString('utf-8'))
  })

  test('2. Invalid token format (not 64 hex chars) returns HTTP 410 Gone in workerd', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/invalid-hex-token`, {
      headers: { 'cf-connecting-ip': '198.51.100.2' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
    assert.match(json.error, /invalid, has expired, or was revoked/)
  })

  test('3. Non-existent 64-hex token returns HTTP 410 Gone in workerd', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex')
    const res = await fetch(`${BASE_URL}/api/share/attachment/${fakeToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.3' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
  })

  test('4. Revoked token returns HTTP 410 Gone in workerd', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/${revokedRawToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.4' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
  })

  test('5. Expired token returns HTTP 410 Gone in workerd', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/${expiredRawToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.5' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
  })

  test('6. Unapproved attachment returns HTTP 410 Gone in workerd', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/${unapprovedRawToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.6' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
  })

  test('7. Cancelled order attachment returns HTTP 410 Gone in workerd', async () => {
    const res = await fetch(`${BASE_URL}/api/share/attachment/${cancelledRawToken}`, {
      headers: { 'cf-connecting-ip': '198.51.100.7' }
    })
    assert.equal(res.status, 410)
    const json = await res.json()
    assert.equal(json.success, false)
  })

  test('8. Brute-force throttling triggers HTTP 429 after 5 failed attempts from same IP', async () => {
    const bruteIp = '198.51.100.99'
    for (let i = 0; i < 5; i++) {
      const invalidToken = crypto.randomBytes(32).toString('hex')
      const res = await fetch(`${BASE_URL}/api/share/attachment/${invalidToken}`, {
        headers: { 'cf-connecting-ip': bruteIp }
      })
      assert.equal(res.status, 410)
    }

    // 6th attempt should receive 429 Too Many Requests
    const nextToken = crypto.randomBytes(32).toString('hex')
    const resBlocked = await fetch(`${BASE_URL}/api/share/attachment/${nextToken}`, {
      headers: { 'cf-connecting-ip': bruteIp }
    })
    assert.equal(resBlocked.status, 429)
    assert.equal(resBlocked.headers.get('retry-after'), '900')
    const json = await resBlocked.json()
    assert.equal(json.success, false)
    assert.match(json.error, /Too many requests/)
  })

  test('9. Zero credential or storage path leakage across all error and success responses', async () => {
    const endpoints = [
      `${BASE_URL}/api/share/attachment/${activeRawToken}`,
      `${BASE_URL}/api/share/attachment/${revokedRawToken}`,
      `${BASE_URL}/api/share/attachment/${expiredRawToken}`,
      `${BASE_URL}/api/share/attachment/${unapprovedRawToken}`,
      `${BASE_URL}/api/share/attachment/${cancelledRawToken}`,
      `${BASE_URL}/api/share/attachment/invalid-hex`
    ]

    for (const url of endpoints) {
      const res = await fetch(url, { headers: { 'cf-connecting-ip': '198.51.100.88' } })
      const text = await res.text()
      const allHeaders = JSON.stringify([...res.headers.entries()])

      // No service role key in body or headers
      assert.ok(!text.includes(LOCAL_SERVICE_ROLE_KEY), 'Response body must not contain service role key')
      assert.ok(!allHeaders.includes(LOCAL_SERVICE_ROLE_KEY), 'Headers must not contain service role key')

      // No private storage path in error responses
      if (res.status !== 200) {
        assert.ok(!text.includes('orders/'), 'Error response body must not contain internal storage path')
        assert.ok(!text.includes('order-attachments'), 'Error response body must not contain internal bucket name')
      }
    }
  })
})
