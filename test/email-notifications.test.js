/**
 * ARS Computers — Enquiry Email Notification Test Suite
 *
 * Verifies server-side notification rendering, multi-recipient resolution,
 * inactive/invalid/duplicate filtering, assignment and reassignment rules,
 * per-recipient idempotency, partial-failure retries, protected Worker routes,
 * and the additive database migrations. No real emails are sent.
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
  buildRecipientIdempotencyKey,
  dedupeRecipients,
  fetchActiveStaff,
  getNotificationConfig,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  processNotificationOutbox,
  resolvePrimaryRecipient,
  selectNotificationRecipients,
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
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function matchesFilter(row, key, raw) {
  const value = row[key]

  if (raw.startsWith('eq.')) return String(value ?? '') === raw.slice(3)

  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const list = raw
      .slice(4, -1)
      .split(',')
      .map((item) => item.trim())
    return list.includes(String(value ?? ''))
  }

  if (raw.startsWith('lte.')) return value != null && String(value) <= raw.slice(4)
  if (raw.startsWith('lt.')) return value != null && String(value) < raw.slice(3)
  if (raw.startsWith('gte.')) return value != null && String(value) >= raw.slice(4)
  if (raw.startsWith('gt.')) return value != null && String(value) > raw.slice(3)

  return true
}

function applyFilters(rows, parsed) {
  return rows.filter((row) => {
    for (const [key, raw] of parsed.searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue
      if (!matchesFilter(row, key, raw)) return false
    }
    return true
  })
}

/**
 * Stateful fake for PostgREST and Resend. It models the outbox filters used by
 * the Worker so partial-failure retries can be exercised realistically.
 */
function createNotificationFetch({
  rows = [],
  staff = [],
  sendResolver = () => ({ status: 200, body: { id: 'email-test-id' } })
} = {}) {
  const calls = []
  const state = {
    rows: rows.map((row) => ({
      ...row,
      payload: row.payload ? { ...row.payload } : {},
      delivered_to: Array.isArray(row.delivered_to) ? [...row.delivered_to] : []
    })),
    staff: staff.map((person) => ({ ...person }))
  }

  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url)
    const method = (options.method || 'GET').toUpperCase()
    const headers = options.headers || {}
    calls.push({ url: parsed, method, headers, body: options.body })

    if (parsed.pathname === '/rest/v1/admin_users' && method === 'GET') {
      return jsonResponse(applyFilters(state.staff, parsed))
    }

    if (parsed.pathname === '/rest/v1/notification_outbox' && method === 'GET') {
      const matched = applyFilters(state.rows, parsed)
      const limit = Number(parsed.searchParams.get('limit') || matched.length)
      return jsonResponse(matched.slice(0, limit))
    }

    if (parsed.pathname === '/rest/v1/notification_outbox' && method === 'PATCH') {
      const patch = options.body ? JSON.parse(options.body) : {}
      const matched = applyFilters(state.rows, parsed)
      for (const row of matched) Object.assign(row, patch)

      const wantsRepresentation = String(headers.Prefer || '').includes('return=representation')
      return jsonResponse(wantsRepresentation ? matched.map((row) => ({ ...row })) : [])
    }

    if (parsed.hostname === 'api.resend.com' && method === 'POST') {
      const payload = options.body ? JSON.parse(options.body) : {}
      const outcome = sendResolver(payload, calls) || { status: 200, body: { id: 'email-test-id' } }
      return jsonResponse(outcome.body, outcome.status ?? 200)
    }

    throw new Error(`Unexpected fetch in test: ${method} ${url}`)
  }

  return { fetchImpl, calls, state }
}

function resendCalls(calls) {
  return calls.filter((call) => call.url.hostname === 'api.resend.com')
}

function sentAddresses(calls) {
  return resendCalls(calls).map((call) => JSON.parse(call.body).to[0])
}

function idempotencyKeys(calls) {
  return resendCalls(calls).map((call) => call.headers['Idempotency-Key'])
}

const QUIET_LOGGER = { warn() {}, error() {}, info() {} }

const STAFF = [
  { id: 'u1', email: 'head@example.com', full_name: 'Head', role: 'superadmin', is_active: true },
  { id: 'u2', email: 'engineer@example.com', full_name: 'Engineer', role: 'admin', is_active: true },
  { id: 'u3', email: 'old.engineer@example.com', full_name: 'Old Engineer', role: 'admin', is_active: true },
  { id: 'u4', email: 'tech@example.com', full_name: 'Technician', role: 'technical', is_active: true },
  { id: 'u5', email: 'inactive@example.com', full_name: 'Inactive', role: 'admin', is_active: false },
  { id: 'u6', email: '', full_name: 'No Email', role: 'hr', is_active: true },
  { id: 'u7', email: 'not-an-email', full_name: 'Bad Email', role: 'account', is_active: true }
]

function newEnquiryRow(overrides = {}) {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  return {
    id,
    event_key: `new_enquiry:${id}`,
    event_type: 'new_enquiry',
    enquiry_id: id,
    payload: {
      enquiry_id: id,
      enquiry_number: 'ARS-ENQ-00789',
      customer_name: 'Neha',
      contact_info: 'neha@example.com',
      category_interest: 'Laptops',
      message: 'Need a business laptop.',
      created_at: '2026-11-04T08:00:00.000Z'
    },
    attempts: 0,
    status: 'pending',
    delivered_to: [],
    ...overrides
  }
}

function assignmentRow(eventType, payload = {}, overrides = {}) {
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  return {
    id,
    event_key: `${eventType}:${id}:${payload.new_employee_id || 'none'}`,
    event_type: eventType,
    enquiry_id: id,
    payload: {
      enquiry_id: id,
      enquiry_number: 'ARS-ENQ-00456',
      customer_name: 'Rahul Mehta',
      contact_info: 'rahul@example.com',
      assigned_by_name: 'Head Admin',
      assigned_at: '2026-11-04T12:00:00.000Z',
      ...payload
    },
    attempts: 0,
    status: 'pending',
    delivered_to: [],
    ...overrides
  }
}

describe('Notification email rendering', () => {
  test('new enquiry email contains required details, event label, and escaping', () => {
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
    assert.match(email.text, /Notification type: New website enquiry/)
    assert.match(email.text, /Asha Verma/)
    assert.match(email.text, /\+91 98765 43210/)
    assert.match(email.text, /CCTV & Security/)
    assert.match(email.text, /Need 4 cameras/)
    assert.match(email.text, /\/admin\/enquiries\?enquiry=11111111-1111-4111-8111-111111111111/)
    assert.match(email.text, /IST/)
    assert.doesNotMatch(email.html, /<script>alert\(1\)<\/script>/)
    assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.match(email.html, /New website enquiry/)
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

describe('Email validation and deduplication', () => {
  test('normalizes and validates registered addresses', () => {
    assert.equal(normalizeEmail('  Head@Example.COM '), 'head@example.com')
    assert.equal(isValidEmail('head@example.com'), true)
    assert.equal(isValidEmail('  HEAD@EXAMPLE.COM '), true)
    assert.equal(isValidEmail('not-an-email'), false)
    assert.equal(isValidEmail(''), false)
    assert.equal(isValidEmail(null), false)
  })

  test('deduplicates case-insensitively and excludes inactive/missing/invalid', () => {
    const recipients = dedupeRecipients([
      { id: '1', email: 'Head@Example.com', role: 'superadmin', is_active: true },
      { id: '2', email: 'head@example.com', role: 'admin', is_active: true },
      { id: '3', email: 'inactive@example.com', role: 'admin', is_active: false },
      { id: '4', email: '', role: 'hr', is_active: true },
      { id: '5', role: 'account', is_active: true },
      { id: '6', email: 'bad-email', role: 'technical', is_active: true }
    ])

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['head@example.com']
    )
    assert.equal(recipients[0].id, '1')
  })
})

describe('Recipient selection rules', () => {
  test('new enquiry targets every active staff member with a valid email', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'new_enquiry',
      payload: {},
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['head@example.com', 'engineer@example.com', 'old.engineer@example.com', 'tech@example.com']
    )
  })

  test('assignment targets the new employee plus active Superadmins only', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_assigned',
      payload: { new_employee_id: 'u2' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['engineer@example.com', 'head@example.com']
    )
  })

  test('assignment deduplicates a new employee who is also a Superadmin', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_assigned',
      payload: { new_employee_id: 'u1' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['head@example.com']
    )
  })

  test('assignment to an inactive employee only reaches active Superadmins', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_assigned',
      payload: { new_employee_id: 'u5' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['head@example.com']
    )
  })

  test('reassignment excludes the previous assignee', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_reassigned',
      payload: { previous_employee_id: 'u3', new_employee_id: 'u2' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['engineer@example.com', 'head@example.com']
    )
    assert.equal(recipients.some((person) => person.id === 'u3'), false)
  })

  test('reassignment keeps the previous assignee only when they are also the new assignee', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_reassigned',
      payload: { previous_employee_id: 'u2', new_employee_id: 'u2' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['engineer@example.com', 'head@example.com']
    )
  })

  test('reassignment does not notify a previous Superadmin assignee unless still new', () => {
    const recipients = selectNotificationRecipients({
      eventType: 'enquiry_reassigned',
      payload: { previous_employee_id: 'u1', new_employee_id: 'u2' },
      staff: STAFF
    })

    assert.deepEqual(
      recipients.map((person) => person.email),
      ['engineer@example.com']
    )
  })

  test('unsupported event types are rejected', () => {
    assert.throws(
      () =>
        selectNotificationRecipients({
          eventType: 'unexpected',
          payload: {},
          staff: STAFF
        }),
      /Unsupported notification event type/
    )
  })
})

describe('Provider and primary-recipient resolution', () => {
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

  test('active staff lookup uses the service role and filters inactive rows', async () => {
    const { fetchImpl, calls } = createNotificationFetch({ staff: STAFF })
    const staff = await fetchActiveStaff(getNotificationConfig(BASE_ENV), fetchImpl)

    assert.equal(staff.length, 6)
    assert.equal(staff.some((person) => person.is_active === false), false)

    const request = calls.find((call) => call.url.pathname === '/rest/v1/admin_users')
    assert.ok(request)
    assert.equal(request.headers.apikey, BASE_ENV.SUPABASE_SERVICE_ROLE_KEY)
    assert.equal(request.url.searchParams.get('is_active'), 'eq.true')
    assert.match(request.url.searchParams.get('select'), /id,email,full_name,role,is_active/)
  })

  test('primary recipient is the oldest active Superadmin, then Admin', async () => {
    const { fetchImpl } = createNotificationFetch({ staff: STAFF })
    const primary = await resolvePrimaryRecipient(getNotificationConfig(BASE_ENV), fetchImpl)
    assert.equal(primary.email, 'head@example.com')
    assert.equal(primary.role, 'superadmin')

    const adminOnly = STAFF.filter((person) => person.role !== 'superadmin')
    const { fetchImpl: adminFetch } = createNotificationFetch({ staff: adminOnly })
    const fallback = await resolvePrimaryRecipient(getNotificationConfig(BASE_ENV), adminFetch)
    assert.equal(fallback.email, 'engineer@example.com')
    assert.equal(fallback.role, 'admin')
  })

  test('per-recipient idempotency keys are deterministic and unique', async () => {
    const first = await buildRecipientIdempotencyKey('new_enquiry:abc', 'Head@Example.com')
    const repeat = await buildRecipientIdempotencyKey('new_enquiry:abc', 'head@example.com')
    const other = await buildRecipientIdempotencyKey('new_enquiry:abc', 'engineer@example.com')

    assert.equal(first, repeat)
    assert.notEqual(first, other)
    assert.match(first, /^notify:[a-f0-9]{64}$/)
    assert.ok(first.length <= 256)
  })

  test('Resend request includes sender, single recipient, content, and idempotency key', async () => {
    const { fetchImpl, calls } = createNotificationFetch()
    const result = await sendNotificationEmail(
      getNotificationConfig(BASE_ENV),
      {
        to: 'head@example.com',
        subject: 'Test subject',
        text: 'Test text',
        html: '<p>Test html</p>',
        idempotencyKey: 'notify:abc'
      },
      fetchImpl
    )

    assert.equal(result.provider, 'resend')
    assert.equal(result.messageId, 'email-test-id')

    const request = resendCalls(calls)[0]
    assert.ok(request)
    assert.equal(request.headers.Authorization, `Bearer ${BASE_ENV.RESEND_API_KEY}`)
    assert.equal(request.headers['Idempotency-Key'], 'notify:abc')

    const body = JSON.parse(request.body)
    assert.equal(body.from, BASE_ENV.EMAIL_FROM)
    assert.deepEqual(body.to, ['head@example.com'])
    assert.equal(body.subject, 'Test subject')
    assert.equal(body.text, 'Test text')
    assert.equal(body.html, '<p>Test html</p>')
  })

  test('provider failure is surfaced as a sanitized error', async () => {
    const { fetchImpl } = createNotificationFetch({
      sendResolver: () => ({ status: 422, body: { message: 'Sender domain is not verified.' } })
    })

    await assert.rejects(
      sendNotificationEmail(
        getNotificationConfig(BASE_ENV),
        {
          to: 'head@example.com',
          subject: 'Test',
          text: 'Test',
          html: '<p>Test</p>',
          idempotencyKey: 'notify:test'
        },
        fetchImpl
      ),
      /Email provider rejected the message \(HTTP 422: Sender domain is not verified\.\)/
    )
  })
})

describe('Outbox processing', () => {
  test('does nothing while the provider is not configured', async () => {
    const { fetchImpl, calls } = createNotificationFetch({ rows: [newEnquiryRow()], staff: STAFF })
    const summary = await processNotificationOutbox({}, { fetchImpl, logger: QUIET_LOGGER })

    assert.deepEqual(summary, {
      configured: false,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      emailsSent: 0,
      emailsFailed: 0
    })
    assert.equal(calls.length, 0)
  })

  test('new enquiry sends one email per active, valid, deduplicated recipient', async () => {
    const staff = [
      ...STAFF,
      { id: 'u8', email: 'HEAD@EXAMPLE.COM', full_name: 'Duplicate Head', role: 'admin', is_active: true }
    ]
    const { fetchImpl, calls, state } = createNotificationFetch({
      rows: [newEnquiryRow()],
      staff
    })

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T08:01:00.000Z')
    })

    assert.equal(summary.processed, 1)
    assert.equal(summary.sent, 1)
    assert.equal(summary.failed, 0)
    assert.equal(summary.emailsSent, 4)
    assert.equal(summary.emailsFailed, 0)

    const addresses = sentAddresses(calls)
    assert.deepEqual(addresses.sort(), [
      'engineer@example.com',
      'head@example.com',
      'old.engineer@example.com',
      'tech@example.com'
    ])
    assert.equal(new Set(addresses).size, addresses.length)

    const keys = idempotencyKeys(calls)
    assert.equal(new Set(keys).size, keys.length)
    for (const key of keys) assert.match(key, /^notify:[a-f0-9]{64}$/)

    assert.equal(state.rows[0].status, 'sent')
    assert.deepEqual(
      [...state.rows[0].delivered_to].sort(),
      ['engineer@example.com', 'head@example.com', 'old.engineer@example.com', 'tech@example.com']
    )
  })

  test('assignment sends to the new employee and active Superadmins', async () => {
    const { fetchImpl, calls, state } = createNotificationFetch({
      rows: [assignmentRow('enquiry_assigned', { new_employee_id: 'u2', new_employee_name: 'Engineer' })],
      staff: STAFF
    })

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T12:01:00.000Z')
    })

    assert.equal(summary.sent, 1)
    assert.equal(summary.emailsSent, 2)
    assert.deepEqual(sentAddresses(calls).sort(), ['engineer@example.com', 'head@example.com'])
    assert.equal(sentAddresses(calls).includes('old.engineer@example.com'), false)
    assert.equal(state.rows[0].status, 'sent')
  })

  test('reassignment sends to the new employee and Superadmin, not the old employee', async () => {
    const { fetchImpl, calls } = createNotificationFetch({
      rows: [
        assignmentRow('enquiry_reassigned', {
          previous_employee_id: 'u3',
          previous_employee_name: 'Old Engineer',
          new_employee_id: 'u2',
          new_employee_name: 'Engineer'
        })
      ],
      staff: STAFF
    })

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T12:01:00.000Z')
    })

    assert.equal(summary.sent, 1)
    assert.deepEqual(sentAddresses(calls).sort(), ['engineer@example.com', 'head@example.com'])
    assert.equal(sentAddresses(calls).includes('old.engineer@example.com'), false)
  })

  test('a partial failure retries only the failed recipient', async () => {
    let failedOnce = false
    const attemptsByAddress = new Map()

    const { fetchImpl, calls, state } = createNotificationFetch({
      rows: [newEnquiryRow()],
      staff: STAFF,
      sendResolver: (payload) => {
        const address = payload.to[0]
        attemptsByAddress.set(address, (attemptsByAddress.get(address) || 0) + 1)

        if (address === 'engineer@example.com' && !failedOnce) {
          failedOnce = true
          return { status: 500, body: { message: 'Temporary provider outage' } }
        }

        return { status: 200, body: { id: `sent-${address}` } }
      }
    })

    const first = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T08:01:00.000Z')
    })

    assert.equal(first.emailsSent, 3)
    assert.equal(first.emailsFailed, 1)
    assert.equal(first.failed, 1)
    assert.equal(state.rows[0].status, 'failed')
    assert.deepEqual(
      [...state.rows[0].delivered_to].sort(),
      ['head@example.com', 'old.engineer@example.com', 'tech@example.com']
    )
    assert.match(state.rows[0].last_error, /engineer@example\.com|e\*\*\*r@example\.com/)

    const second = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T08:02:00.000Z')
    })

    assert.equal(second.emailsSent, 1)
    assert.equal(second.emailsFailed, 0)
    assert.equal(second.sent, 1)
    assert.equal(state.rows[0].status, 'sent')

    // Three recipients succeeded on the first run, one failed and succeeded on
    // the retry. Successful recipients are never contacted twice.
    assert.equal(attemptsByAddress.get('head@example.com'), 1)
    assert.equal(attemptsByAddress.get('old.engineer@example.com'), 1)
    assert.equal(attemptsByAddress.get('tech@example.com'), 1)
    assert.equal(attemptsByAddress.get('engineer@example.com'), 2)
    assert.equal(resendCalls(calls).length, 5)
  })

  test('no active valid recipients marks the row skipped without sending', async () => {
    const { fetchImpl, calls, state } = createNotificationFetch({
      rows: [newEnquiryRow()],
      staff: [
        { id: 'x1', email: 'inactive@example.com', role: 'admin', is_active: false },
        { id: 'x2', email: '', role: 'hr', is_active: true },
        { id: 'x3', email: 'invalid', role: 'account', is_active: true }
      ]
    })

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl,
      logger: QUIET_LOGGER,
      now: new Date('2026-11-04T08:01:00.000Z')
    })

    assert.equal(summary.skipped, 1)
    assert.equal(summary.emailsSent, 0)
    assert.equal(resendCalls(calls).length, 0)
    assert.equal(state.rows[0].status, 'skipped')
    assert.match(state.rows[0].last_error, /No active staff recipient/)
  })

  test('staff lookup failure leaves the outbox pending', async () => {
    const { fetchImpl, calls, state } = createNotificationFetch({ rows: [newEnquiryRow()], staff: STAFF })
    const failingFetch = async (url, options) => {
      const parsed = new URL(url)
      if (parsed.pathname === '/rest/v1/admin_users') {
        return jsonResponse({ message: 'temporary database error' }, 500)
      }
      return fetchImpl(url, options)
    }

    const summary = await processNotificationOutbox(BASE_ENV, {
      fetchImpl: failingFetch,
      logger: QUIET_LOGGER
    })

    assert.equal(summary.processed, 0)
    assert.equal(summary.emailsSent, 0)
    assert.equal(state.rows[0].status, 'pending')
    assert.equal(resendCalls(calls).length, 0)
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
  const deliveryMigration = fs.readFileSync(
    path.join(
      projectRoot,
      'supabase',
      'migrations',
      '20261104000026_notification_outbox_delivered_recipients.sql'
    ),
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

  test('delivery tracking migration is additive and has an empty-array default', () => {
    assert.match(
      deliveryMigration,
      /ALTER TABLE public\.notification_outbox\s+ADD COLUMN IF NOT EXISTS delivered_to TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/
    )
    assert.match(deliveryMigration, /COMMENT ON COLUMN public\.notification_outbox\.delivered_to/)
    assert.doesNotMatch(deliveryMigration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|ALTER\s+POLICY/i)
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
