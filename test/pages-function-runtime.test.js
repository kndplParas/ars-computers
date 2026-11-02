/**
 * ARS Computers — Step 5 Cloudflare Pages Function Runtime Verification Suite
 *
 * Verifies functions/api/share/attachment/[token].js (onRequestGet) directly against
 * the Cloudflare Workers / Pages runtime signature: context = { params, request, env }.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { onRequestGet } from '../functions/api/share/attachment/[token].js'
import { resetRateLimitsForTesting } from '../src/server/shareAttachmentHandler.js'

const LOCAL_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe('Cloudflare Pages Function: Customer Attachment Download Proxy Suite', () => {
  let serviceClient
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
  const testFileContent = Buffer.from('%PDF-1.4 Mock Customer Invoice Binary Content for Verification')

  before(async () => {
    serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })

    // 1. Create test order
    const { data: order, error: orderErr } = await serviceClient
      .from('orders')
      .insert({
        order_number: `ORD-CF-${Date.now()}`,
        status: 'new',
        customer_name: 'Cloudflare Runtime Test Customer',
        contact_info: '+919876543210',
        total_amount: 45000
      })
      .select()
      .single()
    assert.ifError(orderErr)
    testOrderId = order.id

    // 2. Upload test attachment file to private storage
    const storagePath = `orders/${testOrderId}/invoice_${Date.now()}.pdf`
    const { error: uploadErr } = await serviceClient.storage
      .from('order-attachments')
      .upload(storagePath, testFileContent, {
        contentType: 'application/pdf',
        upsert: true
      })
    assert.ifError(uploadErr)

    // 3. Create active approved attachment record
    const { data: att, error: attErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: testOrderId,
        storage_path: storagePath,
        original_filename: 'Tax_Invoice_2026.pdf',
        mime_type: 'application/pdf',
        file_size: testFileContent.length,
        document_type: 'CUSTOMER_INVOICE',
        is_customer_shareable: true,
        is_head_approved: true,
        share_request_status: 'APPROVED'
      })
      .select()
      .single()
    assert.ifError(attErr)
    testAttachmentId = att.id

    // 4. Generate active share token
    const tokenBytes1 = crypto.randomBytes(32)
    activeRawToken = tokenBytes1.toString('hex')
    const hash1 = crypto.createHash('sha256').update(tokenBytes1).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: hash1,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 5. Generate revoked share token
    const tokenBytes2 = crypto.randomBytes(32)
    revokedRawToken = tokenBytes2.toString('hex')
    const hash2 = crypto.createHash('sha256').update(tokenBytes2).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: hash2,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: true,
      revocation_reason: 'Testing revocation flow'
    })

    // 6. Generate expired share token
    const tokenBytes3 = crypto.randomBytes(32)
    expiredRawToken = tokenBytes3.toString('hex')
    const hash3 = crypto.createHash('sha256').update(tokenBytes3).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: testAttachmentId,
      order_id: testOrderId,
      token_hash: hash3,
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
      is_revoked: false
    })

    // 7. Create unapproved attachment and share token
    const storagePathUnapproved = `orders/${testOrderId}/memo_${Date.now()}.pdf`
    const { data: unapprovedAtt, error: unapprovedErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: testOrderId,
        storage_path: storagePathUnapproved,
        original_filename: 'Internal_Memo.pdf',
        mime_type: 'application/pdf',
        file_size: testFileContent.length,
        document_type: 'OTHER_INTERNAL',
        is_customer_shareable: false,
        is_head_approved: false,
        share_request_status: 'NONE'
      })
      .select()
      .single()
    assert.ifError(unapprovedErr)
    unapprovedAttachmentId = unapprovedAtt.id

    const tokenBytes4 = crypto.randomBytes(32)
    unapprovedRawToken = tokenBytes4.toString('hex')
    const hash4 = crypto.createHash('sha256').update(tokenBytes4).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: unapprovedAttachmentId,
      order_id: testOrderId,
      token_hash: hash4,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })

    // 8. Create cancelled order with attachment
    const { data: cancelledOrder, error: cancelledOrderErr } = await serviceClient
      .from('orders')
      .insert({
        order_number: `ORD-CANCELLED-${Date.now()}`,
        status: 'cancelled',
        cancellation_reason: 'Order cancelled by customer request',
        customer_name: 'Cancelled Order Customer',
        contact_info: '+919876543211',
        total_amount: 12000
      })
      .select()
      .single()
    assert.ifError(cancelledOrderErr)
    cancelledOrderId = cancelledOrder.id

    const storagePathCancelled = `orders/${cancelledOrderId}/cancelled_${Date.now()}.pdf`
    const { data: cancelledAtt, error: cancelledErr } = await serviceClient
      .from('order_attachments')
      .insert({
        order_id: cancelledOrderId,
        storage_path: storagePathCancelled,
        original_filename: 'Cancelled_Invoice.pdf',
        mime_type: 'application/pdf',
        file_size: testFileContent.length,
        document_type: 'CUSTOMER_INVOICE',
        is_customer_shareable: true,
        is_head_approved: true,
        share_request_status: 'APPROVED'
      })
      .select()
      .single()
    assert.ifError(cancelledErr)
    cancelledAttachmentId = cancelledAtt.id

    const tokenBytes5 = crypto.randomBytes(32)
    cancelledRawToken = tokenBytes5.toString('hex')
    const hash5 = crypto.createHash('sha256').update(tokenBytes5).digest('hex')
    await serviceClient.from('order_attachment_shares').insert({
      attachment_id: cancelledAttachmentId,
      order_id: cancelledOrderId,
      token_hash: hash5,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_revoked: false
    })
  })

  after(async () => {
    // Cleanup test data
    if (testOrderId) {
      await serviceClient.from('order_attachment_access_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await serviceClient.from('order_attachment_shares').delete().in('order_id', [testOrderId, cancelledOrderId])
      await serviceClient.from('order_attachments').delete().in('order_id', [testOrderId, cancelledOrderId])
      await serviceClient.from('orders').delete().in('id', [testOrderId, cancelledOrderId])
    }
  })

  test('1. Missing Cloudflare environment secrets returns HTTP 500 error', async () => {
    const context = {
      params: { token: activeRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${activeRawToken}`),
      env: {} // Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 500)
    const json = await response.json()
    assert.equal(json.success, false)
    assert.match(json.error, /Server configuration missing/)
  })

  test('2. Valid token successfully streams binary file with strict security headers', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: activeRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${activeRawToken}`, {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'
        }
      }),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/pdf')
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Tax_Invoice_2026.pdf"')
    assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, private, max-age=0')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')

    const arrayBuffer = await response.arrayBuffer()
    const receivedBuffer = Buffer.from(arrayBuffer)
    assert.equal(receivedBuffer.toString('utf-8'), testFileContent.toString('utf-8'))
  })

  test('3. Invalid token format (non-hex or incorrect length) returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: 'invalid-non-hex-token' },
      request: new Request('https://arscomputer.com/api/share/attachment/invalid-non-hex-token'),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
    assert.match(json.error, /invalid, has expired, or was revoked/)
  })

  test('4. Non-existent token returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const fakeToken = crypto.randomBytes(32).toString('hex')
    const context = {
      params: { token: fakeToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${fakeToken}`),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
  })

  test('5. Revoked token returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: revokedRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${revokedRawToken}`),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
  })

  test('6. Expired token returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: expiredRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${expiredRawToken}`),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
  })

  test('7. Unapproved attachment returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: unapprovedRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${unapprovedRawToken}`),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
  })

  test('8. Cancelled order attachment returns HTTP 410 Gone', async () => {
    resetRateLimitsForTesting()
    const context = {
      params: { token: cancelledRawToken },
      request: new Request(`https://arscomputer.com/api/share/attachment/${cancelledRawToken}`),
      env: {
        SUPABASE_URL: LOCAL_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
      }
    }

    const response = await onRequestGet(context)
    assert.equal(response.status, 410)
    const json = await response.json()
    assert.equal(json.success, false)
  })

  test('9. Brute-force throttling triggers HTTP 429 after 5 failed attempts', async () => {
    resetRateLimitsForTesting()
    const bruteIp = '198.51.100.77'
    const env = {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY
    }

    // Attempt 5 invalid tokens
    for (let i = 0; i < 5; i++) {
      const invalidToken = crypto.randomBytes(32).toString('hex')
      const req = new Request(`https://arscomputer.com/api/share/attachment/${invalidToken}`, {
        headers: { 'cf-connecting-ip': bruteIp }
      })
      const res = await onRequestGet({ params: { token: invalidToken }, request: req, env })
      assert.equal(res.status, 410)
    }

    // 6th attempt should receive 429 Too Many Requests
    const nextToken = crypto.randomBytes(32).toString('hex')
    const reqBlocked = new Request(`https://arscomputer.com/api/share/attachment/${nextToken}`, {
      headers: { 'cf-connecting-ip': bruteIp }
    })
    const resBlocked = await onRequestGet({ params: { token: nextToken }, request: reqBlocked, env })
    assert.equal(resBlocked.status, 429)
    assert.equal(resBlocked.headers.get('retry-after'), '900')
    const json = await resBlocked.json()
    assert.equal(json.success, false)
    assert.match(json.error, /Too many requests/)
  })
})
