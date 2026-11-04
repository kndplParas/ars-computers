/**
 * ARS Computers — Enquiry Email Notification Test Suite
 *
 * Verifies server-side notification rendering, recipient resolution, provider
 * requests, idempotency, failure isolation, protected Worker routes, and the
 * additive database migration invariants. No real emails are sent.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildAssignmentEmail,
  buildNewEnquiryEmail,
  buildNotificationEmailForRow,
  getNotificationConfig,
  maskEmail,
  processNotificationOutbox,
  resolveNotificationRecipient,
  sendNotificationEmail
} from '../src/server/notificationService.js'
import worker from '../src/server/worker.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const BASE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'ARS Computers <notifications@arscomputer.com>',
  APP_BASE_URL: 'https://arscomputer.com'
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function createOutboxFetch({
  rows = [],
  recipient = { email: 'main.admin@example.com', full_name: 'Main Admin', role: 'superadmin' },
  sendStatus = 200,
  sendBody = { id: 'email-test-id' }
} = {}) {
  const calls = []

  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url)
    const method = options.method || 'GET'
    calls.push({ url: parsed, method, headers: options.headers || {}, body: options.body })

    if (parsed.pathname === '/rest/v1/admin_users') {
      return jsonResponse(recipient ? [recipient] : [])
    }

    if (parsed.pathname === '/rest/v1/notification_outbox' && method === 'GET') {
      return jsonResponse(rows)
    }

    if (parsed.pathname === '/rest/v1/notification_outbox' && method === 'PATCH') {
      const body = options.body ? JSON.parse(options.body) : {}
      const idParam = parsed.searchParams.get('id')
      const id = idParam?.startsWith('eq.') ? idParam.slice(3) : idParam

      if (id && parsed.searchParams.get('status')?.startsWith('in.')) {
        const row = rows.find((entry) => entry.id === id)
        return jsonResponse(row ? [{ ...row, ...body }] : [])
      }

      return jsonResponse([])
    }

    if (parsed.hostname === 'api.resend.com') {
      return jsonResponse(sendBody, sendStatus)
    }

    throw new Error(`Unexpected fetch in test: ${method} ${url}`)
  }

  return { fetchImpl, calls }
}

function findCall(calls, predicate) {
  return calls.find(predicate)
}

describe('Notification email rendering', () => {
  test('new enquiry email contains all required review details and escapes HTML', () => {
    const email = buildNewEnquiryEmail({
      appBaseUrl: 'https://arscomputer.com',
      payload: {
        enquiry_id: '11111111-1111-4111-8111-111111111111',
        enquiry_number: 'ARS-ENQ-00123',
        customer_name: 'Asha Verma',
        contact_info: '+91 98765 43210',
        category_interest: 'CCTV & Security',
        message: 'Need 4 cameras <script>alert(1)</script>',
        created_at: '2026-11-04T10:30:00.000Z'
      }
    })

    assert.match(email.subject, /New enquiry ARS-ENQ-00123 requires review/)
    assert.match(email.text, /A new customer enquiry requires review/)
    assert.match(email.text, /Asha Verma/)
    assert.match(email.text, /\+91 98765 43210/)
    assert.match(email.text, /CCTV & Security/)
    assert.match(email.text, /Need 4 cameras/)
    assert.match(email.text, /\/admin\/enquiries\?enquiry=11111111-1111-4111-8111-111111111111/)
    assert.match(email.text, /IST/)
    assert.doesNotMatch(email.html, /<script>alert\(1\)<\/script>/)
    assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.match(email.html, /Open enquiry in Admin Portal/)
    assert.match(email.html, /Requires review|requires review/i)
  })

  test('new assignment and reassignment emails are clearly distinguished', () => {
    const basePayload = {
      enquiry_id: '22222222-2222-4222-8222-222222222222',
      enquiry_number: 'ARS-ENQ-00456',
      customer_name: 'Rahul Mehta',
      contact_info: 'rahul@example.com',
      new_employee_id: '33333333-3333-4333-8333-333333333333',
      new_employee_name: 'Engineer One',
      new_employee_code: 'EMP-010',
      assigned_by_name: 'Head Admin',
      assigned_at: '2026-11-04T12:00:00.000Z'
    }

    const assigned = buildAssignmentEmail({
      eventType: 'enquiry_assigned',
      appBaseUrl: 'https://arscomputer.com',
      payload: basePayload
    })

    assert.match(assigned.subject, /assigned to Engineer One/)
    assert.match(assigned.text, /Assignment type: New assignment/)
    assert.doesNotMatch(assigned.text, /Previous assignee:/)
    assert.match(assigned.text, /Engineer One \[EMP-010\]/)
    assert.match(assigned.text, /Head Admin/)
    assert.match(assigned.text, /IST/)

    const reassigned = buildAssignmentEmail({
      eventType: 'enquiry_reassigned',
      appBaseUrl: 'https://arscomputer.com',
      payload: {
        ...basePayload,
        previous_employee_id: '44444444-4444-4444-8444-444444444444',
        previous_employee_name: 'Engineer Old',
        previous_employee_code: 'EMP-004'
      }
    })

    assert.match(reassigned.subject, /reassigned to Engineer One/)
    assert.match(reassigned.text, /Assignment type: Employee reassignment/)
    assert.match(reassigned.text, /Previous assignee: Engineer Old \[EMP-004\]/)
    assert.match(reassigned.html, /Employee reassignment/)
  })

  test('row builder routes supported event types and rejects unknown ones', () => {
    const newEmail = buildNotificationEmailForRow(
      {
        event_type: 'new_enquiry',
        payload: { enquiry_id: 'x', customer_name: 'A', message: 'B' }
      },
      'https://arscomputer.com'
    )
    assert.match(newEmail.subject, /requires review/)

    const assignedEmail = buildNotificationEmailForRow({
      event_type: 'enquiry_assigned',
      payload: { enquiry_id: 'x', new_employee_name: 'Engineer' }
    })
    assert.match(assignedEmail.subject, /assigned to Engineer/)

    assert.throws(
      () => buildNotificationEmailForRow({ event_type: 'unexpected', payload: {} }),
      /Unsupported notification event type/
    )
  })

  test('recipient masking never exposes the full local part', () => {
    assert.equal(maskEmail('ankit@example.com'), 'a***t@example.com')
    assert.equal(maskEmail('x@example.com'), '*@example.com')
    assert.equal(maskEmail(''), '')
  })
})

describe('Provider and recipient resolution', () => {
  test('configuration requires Supabase credentials, a provider, and a sender', () => {
    const resend = getNotificationConfig(BASE_ENV)
    assert.equal(resend.configured, true)
    assert.equal(resend.provider, 'resend')

    assert.equal(getNotificationConfig({ ...BASE_ENV, RESEND_API_KEY: '' }).configured, false)
    assert.equal(getNotificationConfig({ ...BASE_ENV, EMAIL_FROM: '' }).configured, false)
    assert.equal(getNotificationConfig({ ...BASE_ENV, SUPABASE_SERVICE_ROLE_KEY: '' }).configured, false)

    const cloudflare = getNotificationConfig({
      ...BASE_ENV,
      RESEND_API_KEY: '',
      NOTIFICATION_EMAIL: { send: async () => ({}) }
    })
    assert.equal(cloudflare.configured, true)
    assert.equal(cloudflare.provider, 'cloudflare')
  })

  test('recipient lookup prefers the oldest active superadmin then falls back to admin', async () => {
    const superadmin = { email: 'head@example.com', full_name: 'Head', role: 'superadmin' }
    const { fetchImpl, calls } = createOutboxFetch({ recipient: superadmin })
    const config = getNotificationConfig(BASE_ENV)

    const resolved = await resolveNotificationRecipient(config, fetchImpl)
    assert.deepEqual(resolved, {
      email: 'head@example.com',
      fullName: 'Head',
      role: 'superadmin'
    })
    assert.equal(calls.length, 1)
    assert.match(calls[0].url.searchParams.get('role'), /superadmin/)
    assert.equal(calls[0].headers.apikey, BASE_ENV.SUPABASE_SERVICE_ROLE_KEY)
  })

  test('recipient lookup falls back to an active admin when no superadmin exists', async () => {
    const calls = []
    const fetchImpl = async (url) => {
      const parsed = new URL(url)
      calls.push(parsed)
      const role = parsed.searchParams.get('role')
      if (role === 'eq.superadmin') return jsonResponse([])
      return jsonResponse([{ email: 'admin@example.com', full_name: 'Admin', role: 'admin' }])
    }

    const resolved = await resolveNotificationRecipient(getNotificationConfig(BASE_ENV), fetchImpl)
    assert.equal(resolved.email, 'admin@example.com')
    assert.deepEqual(
      calls.map((call) => call.searchParams.get('role')),
      ['eq.superadmin', 'eq.admin']
    )
  })

  test('Resend request includes sender, recipient, content, and idempotency key', async () => {
    const { fetchImpl, calls } = createOutboxFetch()
    const result = await sendNotificationEmail(
      getNotificationConfig(BASE_ENV),
      {
        to: 'head@example.com',
        subject: 'Test subject',
        text: 'Test text',
        html: '<p>Test html</p>',
        idempotencyKey: 'new_enquiry:abc'
      },
      fetchImpl
    )

    assert.equal(result.provider, 'resend')
    assert.equal(result.messageId, 'email-test-id')

    const request = findCall(calls, (call) => call.url.hostname === 'api.resend.com')
    assert.ok(request)
    assert.equal(request.headers.Authorization, `Bearer ${BASE_ENV.RESEND_API_KEY}`)
    assert.equal(request.headers['Idempotency-Key'], 'new_enquiry:abc')

    const body = JSON.parse(request.body)
    assert.equal(body.from, BASE_ENV.EMAIL_FROM)
    assert.deepEqual(body.to, ['head@example.com'])
    assert.equal(body.subject, 'Test subject')
    assert.equal(body.text, 'Test text')
    assert.equal(body.html, '<p>Test html</p>')
  })

  test('provider failure is surfaced as a sanitized error', async () => {
    const { fetchImpl } = createOutboxFetch({
      sendStatus: 422,
      sendBody: { message: 'Sender domain is not verified.' }
    })

    await assert.rejects(
      sendNotificationEmail(
        getNotificationConfig(BASE_ENV),
        {
          to: 'head@example.com',
          subject: 'Test',
          text: 'Test',
          html: '<p>Test</p>',
          idempotencyKey: 'test:1'
        },
        fetchImpl
      ),
      /Email provider rejected the message \(HTTP 422: Sender domain is not verified\.\)/
    )
  })
})

describe('Outbox processing', () => {
  const row = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_key: 'new_enquiry:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    event_type: 'new_enquiry',
    enquiry_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payload: {
      enquiry_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      enquiry_number: 'ARS-ENQ-00789',
      customer_name: 'Neha',
      contact_info: 'neha@example.com',
      category_interest: 'Laptops',
      message: 'Need a business laptop.',
      created_at: '2026-11-04T08:00:00.000Z'
    },
    attempts: 0,
    status: 'pending'
  }

  test('does nothing while the provider is not configured', async () => {
    const { fetchImpl, calls } = createOutboxFetch({ rows: [row] })
    const summary = await processNotificationOutbox({}, { fetchImpl, logger: { warn() {}, error() {}, info() {} } })

    assert.deepEqual(summary, { configured: false, processed: 0, sent: 0, failed: 0, skipped: 0 })
    assert.equal(calls.length, 0)
  })

  test('claims and sends a pending event exactly once per row', async () => {
    const { fetchImpl, calls } = createOutboxFetch({ rows: [row] })
    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: { warn() {}, error() {}, info() {} },
      now: new Date('2026-11-04T08:01:00.000Z')
    })

    assert.deepEqual(summary, { configured: true, processed: 1, sent: 1, failed: 0, skipped: 0 })

    const providerCall = findCall(calls, (call) => call.url.hostname === 'api.resend.com')
    assert.ok(providerCall)
    assert.equal(providerCall.headers['Idempotency-Key'], row.event_key)

    const sentPatch = findCall(
      calls,
      (call) =>
        call.method === 'PATCH' &&
        call.url.pathname === '/rest/v1/notification_outbox' &&
        JSON.parse(call.body || '{}').status === 'sent'
    )
    assert.ok(sentPatch)
  })

  test('a failed send is recorded without throwing or blocking other rows', async () => {
    const { fetchImpl, calls } = createOutboxFetch({
      rows: [row],
      sendStatus: 500,
      sendBody: { message: 'Provider unavailable' }
    })

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: { warn() {}, error() {}, info() {} },
      now: new Date('2026-11-04T08:01:00.000Z')
    })

    assert.deepEqual(summary, { configured: true, processed: 1, sent: 0, failed: 1, skipped: 0 })

    const failedPatch = findCall(
      calls,
      (call) =>
        call.method === 'PATCH' &&
        call.url.pathname === '/rest/v1/notification_outbox' &&
        JSON.parse(call.body || '{}').status === 'failed'
    )
    assert.ok(failedPatch)
    assert.match(JSON.parse(failedPatch.body).last_error, /HTTP 500/)
  })

  test('no active recipient leaves the outbox untouched', async () => {
    const { fetchImpl, calls } = createOutboxFetch({ rows: [row], recipient: null })
    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: { warn() {}, error() {}, info() {} }
    })

    assert.equal(summary.processed, 0)
    assert.equal(summary.sent, 0)
    assert.equal(
      calls.some((call) => call.url.hostname === 'api.resend.com'),
      false
    )
  })
})

describe('Worker routes and deployment invariants', () => {
  test('notification routes are hidden without a process token', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/notifications/test', { method: 'POST' }),
      {}
    )
    assert.equal(response.status, 404)
  })

  test('notification routes reject an invalid process token', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/notifications/test', {
        method: 'POST',
        headers: { 'x-notification-token': 'wrong-token' }
      }),
      { NOTIFICATION_PROCESS_TOKEN: 'correct-token' }
    )
    assert.equal(response.status, 401)
  })

  test('test route returns a safe configuration error without a provider', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/notifications/test', {
        method: 'POST',
        headers: { 'x-notification-token': 'correct-token' }
      }),
      { NOTIFICATION_PROCESS_TOKEN: 'correct-token' }
    )

    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.success, false)
    assert.match(body.error, /not configured/i)
  })

  test('worker exports a scheduled handler and cron is configured', () => {
    assert.equal(typeof worker.scheduled, 'function')

    const wrangler = fs.readFileSync(path.join(projectRoot, 'wrangler.jsonc'), 'utf8')
    assert.match(wrangler, /"triggers"/)
    assert.match(wrangler, /"crons"\s*:\s*\["\* \* \* \* \*"\]/)
  })
})

describe('Additive database migration invariants', () => {
  const migration = fs.readFileSync(
    path.join(projectRoot, 'supabase', 'migrations', '20261104000024_enquiry_email_notifications.sql'),
    'utf8'
  )
  const realtimeMigration = fs.readFileSync(
    path.join(projectRoot, 'supabase', 'migrations', '20261104000025_enable_dashboard_realtime.sql'),
    'utf8'
  )

  test('outbox is service-role only and has a unique idempotency key', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_outbox/)
    assert.match(migration, /event_key TEXT NOT NULL UNIQUE/)
    assert.match(migration, /REVOKE ALL ON TABLE public\.notification_outbox FROM PUBLIC, anon, authenticated/)
    assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.notification_outbox TO service_role/)
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  })

  test('trigger queues new enquiries and only changed assignments', () => {
    assert.match(migration, /AFTER INSERT OR UPDATE OF assigned_employee_id ON public\.enquiries/)
    assert.match(migration, /NEW\.assigned_employee_id IS NOT DISTINCT FROM OLD\.assigned_employee_id/)
    assert.match(migration, /WHEN OLD\.assigned_employee_id IS NULL THEN 'enquiry_assigned'/)
    assert.match(migration, /'enquiry_reassigned'/)
    assert.match(migration, /EXCEPTION WHEN OTHERS THEN/)
    assert.match(migration, /RAISE WARNING/)
  })

  test('realtime migration is additive and includes all dashboard tables', () => {
    for (const table of [
      'products',
      'categories',
      'enquiries',
      'admin_users',
      'service_requests',
      'orders',
      'order_items',
      'order_payments'
    ]) {
      assert.match(realtimeMigration, new RegExp(`'${table}'`))
    }
    assert.match(realtimeMigration, /ALTER PUBLICATION supabase_realtime ADD TABLE/)
    assert.doesNotMatch(realtimeMigration, /DROP TABLE|DELETE FROM|TRUNCATE/i)
  })
})
