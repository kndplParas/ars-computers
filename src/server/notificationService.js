/**
 * ARS Computers — Enquiry Email Notification Service
 *
 * Runs exclusively in the Cloudflare Worker / trusted server environment.
 * - Reads the pending notification outbox from Supabase using the service role.
 * - Resolves recipients server-side from the existing public.admin_users table.
 *   - new enquiry: every active staff member with a valid registered email.
 *   - assignment/reassignment: the newly assigned active employee plus every
 *     active Superadmin (the previous assignee is excluded on reassignment).
 * - Deduplicates recipients case-insensitively and skips inactive/invalid rows.
 * - Sends one email per recipient through Resend (or an optional Cloudflare
 *   send_email binding) with a per-recipient idempotency key.
 * - Never exposes API keys, SMTP credentials, recipient lists, or secrets to
 *   the frontend.
 * - Never lets an email failure break enquiry submission or assignment.
 */

const DEFAULT_APP_BASE_URL = 'https://arscomputer.com'
const DEFAULT_BATCH_LIMIT = 10
const DEFAULT_MAX_AGE_HOURS = 24
const MAX_ATTEMPTS = 5
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const MAX_EMAIL_LENGTH = 254

export class NotificationConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NotificationConfigurationError'
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Normalizes a registered email for comparison and delivery. Recipient
 * deduplication is case-insensitive, so this is the canonical form.
 */
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

/**
 * Validates an address against the same practical shape enforced by the
 * public.admin_users.email constraint. Empty, malformed, and over-long
 * values are never used as recipients.
 */
export function isValidEmail(email) {
  const normalized = normalizeEmail(email)
  return (
    normalized.length > 0 &&
    normalized.length <= MAX_EMAIL_LENGTH &&
    EMAIL_PATTERN.test(normalized)
  )
}

/**
 * Filters out inactive, missing, invalid, and duplicate recipients. The first
 * occurrence wins, which preserves the caller's ordering.
 */
export function dedupeRecipients(recipients = []) {
  const seen = new Set()
  const result = []

  for (const recipient of Array.isArray(recipients) ? recipients : []) {
    if (!recipient || recipient.is_active === false) continue

    const email = normalizeEmail(recipient.email)
    if (!isValidEmail(email) || seen.has(email)) continue

    seen.add(email)
    result.push({
      ...recipient,
      email,
      fullName: String(recipient.full_name || recipient.fullName || ''),
      role: String(recipient.role || '')
    })
  }

  return result
}

export function getNotificationConfig(env = {}) {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '')
  const resendApiKey = String(env.RESEND_API_KEY || '')
  const emailFrom = String(env.EMAIL_FROM || '').trim()
  const cloudflareBinding =
    env.NOTIFICATION_EMAIL && typeof env.NOTIFICATION_EMAIL.send === 'function'
      ? env.NOTIFICATION_EMAIL
      : null

  let provider = null
  if (resendApiKey && emailFrom) {
    provider = 'resend'
  } else if (cloudflareBinding && emailFrom) {
    provider = 'cloudflare'
  }

  return {
    configured: Boolean(supabaseUrl && serviceRoleKey && provider && emailFrom),
    supabaseUrl,
    serviceRoleKey,
    resendApiKey,
    emailFrom,
    cloudflareBinding,
    provider,
    appBaseUrl: String(env.APP_BASE_URL || DEFAULT_APP_BASE_URL).replace(/\/+$/, ''),
    batchLimit: parsePositiveInt(env.NOTIFICATION_BATCH_LIMIT, DEFAULT_BATCH_LIMIT),
    maxAgeHours: parsePositiveInt(env.NOTIFICATION_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS)
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function maskEmail(email) {
  const value = String(email || '')
  const atIndex = value.lastIndexOf('@')
  if (atIndex <= 0) return value ? '***' : ''
  const local = value.slice(0, atIndex)
  const domain = value.slice(atIndex + 1)
  const visible = local.length >= 2 ? `${local[0]}***${local[local.length - 1]}` : '*'
  return `${visible}@${domain}`
}

export function formatIstDateTime(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  try {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date)
    return `${formatted} IST`
  } catch {
    return date.toISOString()
  }
}

export function buildAdminEnquiryUrl(appBaseUrl, enquiryId) {
  const base = String(appBaseUrl || DEFAULT_APP_BASE_URL).replace(/\/+$/, '')
  return `${base}/admin/enquiries?enquiry=${encodeURIComponent(String(enquiryId || ''))}`
}

function enquiryReference(payload = {}) {
  return payload.enquiry_number || payload.enquiry_id || 'Unknown enquiry'
}

function emailShell({ heading, intro, details, message, actionUrl, actionLabel, footer }) {
  const detailRows = details
    .filter((row) => row && row.value !== null && row.value !== undefined && row.value !== '')
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;white-space:nowrap;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:20px 24px;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#93c5fd;">ARS Computers</div>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;border-top:1px solid #e2e8f0;">
                  ${detailRows}
                </table>
                ${
                  message
                    ? `<div style="margin-top:20px;">
                        <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">Customer message / details</div>
                        <div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:14px;line-height:1.55;color:#0f172a;">${escapeHtml(message)}</div>
                      </div>`
                    : ''
                }
                <div style="margin-top:24px;">
                  <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:8px;">${escapeHtml(actionLabel)}</a>
                </div>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function buildNewEnquiryEmail({ payload = {}, appBaseUrl = DEFAULT_APP_BASE_URL }) {
  const reference = enquiryReference(payload)
  const customerName = payload.customer_name || 'Customer'
  const submittedAt = formatIstDateTime(payload.created_at)
  const actionUrl = buildAdminEnquiryUrl(appBaseUrl, payload.enquiry_id)

  const subject = `[ARS Computers] New enquiry ${reference} requires review`

  const text = [
    'A new customer enquiry requires review.',
    '',
    'Notification type: New website enquiry',
    `Enquiry reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Contact number / email: ${payload.contact_info || 'Not provided'}`,
    `Enquiry type: ${payload.category_interest || 'General enquiry'}`,
    `Submitted: ${submittedAt}`,
    '',
    'Customer message / details:',
    payload.message || 'No message provided.',
    '',
    `Open in Admin Portal: ${actionUrl}`,
    '',
    'This is an automated notification from the ARS Computers website.'
  ].join('\n')

  const html = emailShell({
    heading: 'New enquiry requires review',
    intro: 'A new customer enquiry has been submitted through the website and is waiting for review in the Admin Portal.',
    details: [
      { label: 'Notification type', value: 'New website enquiry' },
      { label: 'Enquiry reference', value: reference },
      { label: 'Customer name', value: customerName },
      { label: 'Contact number / email', value: payload.contact_info || 'Not provided' },
      { label: 'Enquiry type', value: payload.category_interest || 'General enquiry' },
      { label: 'Submitted', value: submittedAt }
    ],
    message: payload.message || 'No message provided.',
    actionUrl,
    actionLabel: 'Open enquiry in Admin Portal',
    footer: 'This is an automated notification. Please do not reply to this email.'
  })

  return { subject, text, html }
}

export function buildAssignmentEmail({
  eventType,
  payload = {},
  appBaseUrl = DEFAULT_APP_BASE_URL
}) {
  const isReassignment = eventType === 'enquiry_reassigned'
  const reference = enquiryReference(payload)
  const customerName = payload.customer_name || 'Customer'
  const previousName = payload.previous_employee_name || payload.previous_employee_id || ''
  const previousCode = payload.previous_employee_code ? ` [${payload.previous_employee_code}]` : ''
  const newName = payload.new_employee_name || payload.new_employee_id || 'Assigned employee'
  const newCode = payload.new_employee_code ? ` [${payload.new_employee_code}]` : ''
  const assignedAt = formatIstDateTime(payload.assigned_at)
  const actionUrl = buildAdminEnquiryUrl(appBaseUrl, payload.enquiry_id)
  const assignmentLabel = isReassignment ? 'Employee reassignment' : 'New assignment'

  const subject = isReassignment
    ? `[ARS Computers] Enquiry ${reference} reassigned to ${newName}`
    : `[ARS Computers] Enquiry ${reference} assigned to ${newName}`

  const textLines = [
    isReassignment
      ? 'An engineer/employee has been reassigned to a customer enquiry.'
      : 'An engineer/employee has been assigned to a customer enquiry.',
    '',
    `Assignment type: ${assignmentLabel}`,
    `Enquiry reference: ${reference}`,
    `Customer name: ${customerName}`,
    `Contact number / email: ${payload.contact_info || 'Not provided'}`
  ]

  if (isReassignment && previousName) {
    textLines.push(`Previous assignee: ${previousName}${previousCode}`)
  }

  textLines.push(
    `New assignee: ${newName}${newCode}`,
    `Assigned by: ${payload.assigned_by_name || 'Head / Superadmin'}`,
    `Assignment date and time: ${assignedAt}`,
    '',
    `Open in Admin Portal: ${actionUrl}`,
    '',
    'This is an automated notification from the ARS Computers Admin Portal.'
  )

  const details = [
    { label: 'Assignment type', value: assignmentLabel },
    { label: 'Enquiry reference', value: reference },
    { label: 'Customer name', value: customerName },
    { label: 'Contact number / email', value: payload.contact_info || 'Not provided' }
  ]

  if (isReassignment && previousName) {
    details.push({ label: 'Previous assignee', value: `${previousName}${previousCode}` })
  }

  details.push(
    { label: 'New assignee', value: `${newName}${newCode}` },
    { label: 'Assigned by', value: payload.assigned_by_name || 'Head / Superadmin' },
    { label: 'Assignment date and time', value: assignedAt }
  )

  const html = emailShell({
    heading: isReassignment ? 'Employee reassignment' : 'New employee assignment',
    intro: isReassignment
      ? 'The Head/Superadmin has changed the engineer/employee assigned to a customer enquiry.'
      : 'The Head/Superadmin has assigned an engineer/employee to a customer enquiry.',
    details,
    message: '',
    actionUrl,
    actionLabel: 'Open enquiry in Admin Portal',
    footer: 'This is an automated notification. Please do not reply to this email.'
  })

  return { subject, text: textLines.join('\n'), html }
}

export function buildNotificationEmailForRow(row, appBaseUrl) {
  if (!row || typeof row !== 'object') {
    throw new NotificationConfigurationError('Notification row is missing.')
  }

  if (row.event_type === 'new_enquiry') {
    return buildNewEnquiryEmail({ payload: row.payload || {}, appBaseUrl })
  }

  if (row.event_type === 'enquiry_assigned' || row.event_type === 'enquiry_reassigned') {
    return buildAssignmentEmail({
      eventType: row.event_type,
      payload: row.payload || {},
      appBaseUrl
    })
  }

  throw new NotificationConfigurationError(
    `Unsupported notification event type: ${String(row.event_type || 'unknown')}`
  )
}

function serviceRoleHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  }
}

async function readErrorMessage(response) {
  try {
    const contentType = response.headers?.get?.('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await response.json()
      return String(body?.message || body?.error?.message || body?.error || '').slice(0, 500)
    }
    return String(await response.text()).slice(0, 500)
  } catch {
    return ''
  }
}

/**
 * Reads every active staff account from public.admin_users using the service
 * role. The query is server-side only and never reaches the browser.
 */
export async function fetchActiveStaff(config, fetchImpl = fetch) {
  const params = new URLSearchParams({
    select: 'id,email,full_name,role,is_active',
    is_active: 'eq.true',
    order: 'created_at.asc'
  })

  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/admin_users?${params.toString()}`,
    { method: 'GET', headers: serviceRoleHeaders(config) }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to resolve active staff email addresses (HTTP ${response.status}).`
    )
  }

  const rows = await response.json()
  return Array.isArray(rows) ? rows.filter((row) => row && row.is_active !== false) : []
}

/**
 * Pure recipient selection for an outbox event.
 *
 * - new_enquiry: all active staff with a valid, deduplicated email.
 * - enquiry_assigned: newly assigned active employee + all active Superadmins.
 * - enquiry_reassigned: same, but the previous assignee is excluded unless
 *   they are also the new assignee.
 */
export function selectNotificationRecipients({ eventType, payload = {}, staff = [] }) {
  const activeStaff = dedupeRecipients(staff)

  if (eventType === 'new_enquiry') {
    return activeStaff
  }

  if (eventType !== 'enquiry_assigned' && eventType !== 'enquiry_reassigned') {
    throw new NotificationConfigurationError(
      `Unsupported notification event type: ${String(eventType || 'unknown')}`
    )
  }

  const byId = new Map(activeStaff.map((person) => [String(person.id), person]))
  const selected = []

  const newEmployee = byId.get(String(payload.new_employee_id || ''))
  if (newEmployee) selected.push(newEmployee)

  for (const person of activeStaff) {
    if (person.role === 'superadmin') selected.push(person)
  }

  let recipients = dedupeRecipients(selected)

  if (eventType === 'enquiry_reassigned') {
    const previousId = String(payload.previous_employee_id || '')
    const newId = String(payload.new_employee_id || '')

    if (previousId && previousId !== newId) {
      recipients = recipients.filter((person) => String(person.id) !== previousId)
    }
  }

  return recipients
}

/**
 * Used only by the protected test route. It intentionally returns a single
 * primary administrator so a test can never become a bulk email to all staff.
 */
export async function resolvePrimaryRecipient(config, fetchImpl = fetch) {
  const staff = dedupeRecipients(await fetchActiveStaff(config, fetchImpl))

  return (
    staff.find((person) => person.role === 'superadmin') ||
    staff.find((person) => person.role === 'admin') ||
    null
  )
}

/**
 * Builds a deterministic provider idempotency key per event + recipient.
 * Sending one request per recipient is deliberate: staff addresses are not
 * exposed to each other, and a failure for one recipient cannot block others.
 */
export async function buildRecipientIdempotencyKey(eventKey, email) {
  const input = new TextEncoder().encode(`${String(eventKey)}:${normalizeEmail(email)}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return `notify:${hash}`
}

export async function sendNotificationEmail(
  config,
  { to, subject, text, html, idempotencyKey },
  fetchImpl = fetch
) {
  if (!config?.configured) {
    throw new NotificationConfigurationError(
      'Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM on the Cloudflare Worker.'
    )
  }

  if (!to) {
    throw new NotificationConfigurationError('Notification recipient is missing.')
  }

  if (config.provider === 'resend') {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject,
        text,
        html
      })
    })

    if (!response.ok) {
      const detail = await readErrorMessage(response)
      const safeDetail = detail.replaceAll(String(to), maskEmail(to))
      throw new Error(
        `Email provider rejected the message (HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : ''}).`
      )
    }

    let messageId = null
    try {
      const body = await response.json()
      messageId = body?.id || null
    } catch {
      // A successful send does not require a JSON body.
    }

    return { provider: 'resend', messageId }
  }

  if (config.provider === 'cloudflare') {
    await config.cloudflareBinding.send({
      from: config.emailFrom,
      to,
      subject,
      text,
      html
    })
    return { provider: 'cloudflare', messageId: null }
  }

  throw new NotificationConfigurationError('No supported email provider is configured.')
}

async function listPendingRows(config, fetchImpl) {
  const params = new URLSearchParams({
    select: 'id,event_key,event_type,enquiry_id,payload,attempts,status,delivered_to',
    status: 'in.(pending,failed)',
    attempts: `lt.${MAX_ATTEMPTS}`,
    order: 'created_at.asc',
    limit: String(config.batchLimit)
  })

  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/notification_outbox?${params.toString()}`,
    { method: 'GET', headers: serviceRoleHeaders(config) }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to read the notification outbox (HTTP ${response.status}).`
    )
  }

  const rows = await response.json()
  return Array.isArray(rows) ? rows : []
}

async function claimRow(config, fetchImpl, row, nowIso) {
  const params = new URLSearchParams({
    id: `eq.${row.id}`,
    status: 'in.(pending,failed)',
    attempts: `eq.${row.attempts ?? 0}`,
    select: 'id,event_key,event_type,enquiry_id,payload,attempts,status,delivered_to'
  })

  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/notification_outbox?${params.toString()}`,
    {
      method: 'PATCH',
      headers: serviceRoleHeaders(config, { Prefer: 'return=representation' }),
      body: JSON.stringify({
        status: 'processing',
        attempts: Number(row.attempts || 0) + 1,
        processing_started_at: nowIso
      })
    }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to claim notification ${row.id} (HTTP ${response.status}).`
    )
  }

  const claimed = await response.json()
  return Array.isArray(claimed) && claimed.length > 0 ? claimed[0] : null
}

async function updateRow(config, fetchImpl, rowId, patch) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/notification_outbox?id=eq.${encodeURIComponent(rowId)}`,
    {
      method: 'PATCH',
      headers: serviceRoleHeaders(config),
      body: JSON.stringify(patch)
    }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to update notification ${rowId} (HTTP ${response.status}).`
    )
  }
}

async function resetStaleProcessing(config, fetchImpl, now) {
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    status: 'eq.processing',
    processing_started_at: `lt.${cutoff}`
  })

  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/notification_outbox?${params.toString()}`,
    {
      method: 'PATCH',
      headers: serviceRoleHeaders(config),
      body: JSON.stringify({ status: 'pending' })
    }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to recover stale notifications (HTTP ${response.status}).`
    )
  }
}

async function expireOldPending(config, fetchImpl, now) {
  const cutoff = new Date(now.getTime() - config.maxAgeHours * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    status: 'eq.pending',
    created_at: `lt.${cutoff}`
  })

  const response = await fetchImpl(
    `${config.supabaseUrl}/rest/v1/notification_outbox?${params.toString()}`,
    {
      method: 'PATCH',
      headers: serviceRoleHeaders(config),
      body: JSON.stringify({
        status: 'skipped',
        last_error: 'Expired before delivery could be completed.',
        processed_at: now.toISOString()
      })
    }
  )

  if (!response.ok) {
    throw new NotificationConfigurationError(
      `Unable to expire stale notifications (HTTP ${response.status}).`
    )
  }
}

export async function processNotificationOutbox(env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch
  const logger = deps.logger || console
  const now =
    deps.now instanceof Date
      ? deps.now
      : typeof deps.now === 'function'
        ? deps.now()
        : new Date()
  const config = getNotificationConfig(env)
  const summary = {
    configured: config.configured,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    emailsSent: 0,
    emailsFailed: 0
  }

  if (!config.configured) {
    logger.warn?.(
      '[email-notifications] Provider not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and EMAIL_FROM on the Cloudflare Worker. Outbox rows remain pending.'
    )
    return summary
  }

  // One staff lookup per run keeps recipient resolution consistent and avoids
  // a database round-trip for every event. Rows stay pending if this fails.
  let staff = []
  try {
    staff = await fetchActiveStaff(config, fetchImpl)
  } catch (error) {
    logger.error?.('[email-notifications] Active staff lookup failed:', error?.message || error)
    return summary
  }

  try {
    await resetStaleProcessing(config, fetchImpl, now)
    await expireOldPending(config, fetchImpl, now)
  } catch (error) {
    logger.warn?.('[email-notifications] Maintenance step failed:', error?.message || error)
  }

  let rows = []
  try {
    rows = await listPendingRows(config, fetchImpl)
  } catch (error) {
    logger.error?.('[email-notifications] Outbox read failed:', error?.message || error)
    return summary
  }

  for (const row of rows) {
    let claimed = null
    try {
      claimed = await claimRow(config, fetchImpl, row, now.toISOString())
    } catch (error) {
      logger.warn?.('[email-notifications] Claim failed:', error?.message || error)
      continue
    }

    if (!claimed) continue

    summary.processed += 1

    let email
    try {
      email = buildNotificationEmailForRow(claimed, config.appBaseUrl)
    } catch (error) {
      summary.failed += 1
      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'failed',
          last_error: String(error?.message || 'Unable to build notification email.').slice(0, 1000),
          processed_at: now.toISOString()
        })
      } catch {
        // The row remains claimed for a later cleanup/retry.
      }
      continue
    }

    let recipients = []
    try {
      recipients = selectNotificationRecipients({
        eventType: claimed.event_type,
        payload: claimed.payload || {},
        staff
      })
    } catch (error) {
      summary.failed += 1
      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'failed',
          last_error: String(error?.message || 'Unable to resolve notification recipients.').slice(0, 1000),
          processed_at: now.toISOString()
        })
      } catch {
        // The row remains claimed for a later cleanup/retry.
      }
      continue
    }

    const delivered = new Set(
      (Array.isArray(claimed.delivered_to) ? claimed.delivered_to : [])
        .map(normalizeEmail)
        .filter(isValidEmail)
    )
    const pendingRecipients = recipients.filter((person) => !delivered.has(person.email))

    if (recipients.length === 0) {
      summary.skipped += 1
      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'skipped',
          last_error: 'No active staff recipient with a valid registered email address.',
          processed_at: now.toISOString()
        })
      } catch {
        // The row remains claimed for a later cleanup/retry.
      }
      logger.warn?.('[email-notifications] Notification skipped: no valid active recipients.', {
        eventType: claimed.event_type,
        eventKey: claimed.event_key
      })
      continue
    }

    if (pendingRecipients.length === 0) {
      summary.sent += 1
      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'sent',
          last_error: null,
          processed_at: now.toISOString(),
          delivered_to: [...delivered]
        })
      } catch (error) {
        logger.warn?.('[email-notifications] Final status update failed:', error?.message || error)
      }
      continue
    }

    const failureMessages = []

    for (const recipient of pendingRecipients) {
      try {
        const result = await sendNotificationEmail(
          config,
          {
            to: recipient.email,
            subject: email.subject,
            text: email.text,
            html: email.html,
            idempotencyKey: await buildRecipientIdempotencyKey(claimed.event_key, recipient.email)
          },
          fetchImpl
        )

        delivered.add(recipient.email)
        summary.emailsSent += 1

        // Checkpoint each successful recipient so a retry never re-sends them.
        try {
          await updateRow(config, fetchImpl, claimed.id, { delivered_to: [...delivered] })
        } catch (error) {
          logger.warn?.('[email-notifications] Delivered checkpoint failed:', error?.message || error)
        }

        logger.info?.('[email-notifications] Notification sent.', {
          eventType: claimed.event_type,
          eventKey: claimed.event_key,
          provider: result.provider,
          recipient: maskEmail(recipient.email)
        })
      } catch (error) {
        summary.emailsFailed += 1
        const safeMessage = String(error?.message || 'Email delivery failed.')
          .replaceAll(String(recipient.email), maskEmail(recipient.email))
          .slice(0, 500)

        failureMessages.push(`${maskEmail(recipient.email)}: ${safeMessage}`)
        logger.error?.('[email-notifications] Notification delivery failed.', {
          eventType: claimed.event_type,
          eventKey: claimed.event_key,
          recipient: maskEmail(recipient.email),
          error: safeMessage
        })
      }
    }

    if (failureMessages.length === 0) {
      summary.sent += 1
      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'sent',
          last_error: null,
          processed_at: now.toISOString(),
          delivered_to: [...delivered]
        })
      } catch (error) {
        logger.warn?.('[email-notifications] Final status update failed:', error?.message || error)
      }
    } else {
      summary.failed += 1
      const lastError =
        `Delivery failed for ${failureMessages.length} of ${recipients.length} recipients. ` +
        failureMessages.join(' | ')

      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'failed',
          last_error: lastError.slice(0, 1000),
          processed_at: now.toISOString(),
          delivered_to: [...delivered]
        })
      } catch {
        // The row remains claimed for a later cleanup/retry.
      }
    }
  }

  return summary
}

export async function sendTestNotification(env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch
  const config = getNotificationConfig(env)

  if (!config.configured) {
    throw new NotificationConfigurationError(
      'Email provider is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and EMAIL_FROM on the Cloudflare Worker.'
    )
  }

  const recipient = await resolvePrimaryRecipient(config, fetchImpl)
  if (!recipient) {
    throw new NotificationConfigurationError(
      'No active superadmin or admin email is registered in admin_users.'
    )
  }

  const now =
    deps.now instanceof Date
      ? deps.now
      : typeof deps.now === 'function'
        ? deps.now()
        : new Date()
  const subject = '[ARS Computers] Email notification test'
  const text = [
    'This is a safe test notification from the ARS Computers Admin Portal.',
    '',
    `Sent at: ${formatIstDateTime(now.toISOString())}`,
    `Recipient role: ${recipient.role}`,
    'Recipients: primary administrator only (this test never emails all staff)',
    '',
    'If you received this email, the Cloudflare Worker notification pipeline is configured correctly.'
  ].join('\n')

  const html = emailShell({
    heading: 'Email notification test',
    intro: 'This is a safe test notification from the ARS Computers Admin Portal.',
    details: [
      { label: 'Sent at', value: formatIstDateTime(now.toISOString()) },
      { label: 'Recipient role', value: recipient.role },
      { label: 'Recipients', value: 'Primary administrator only (never all staff)' }
    ],
    message: '',
    actionUrl: `${config.appBaseUrl}/admin/dashboard`,
    actionLabel: 'Open Admin Dashboard',
    footer: 'No customer or business record was created or modified by this test.'
  })

  const result = await sendNotificationEmail(
    config,
    {
      to: recipient.email,
      subject,
      text,
      html,
      idempotencyKey: `notification-test:${now.toISOString()}`
    },
    fetchImpl
  )

  return {
    success: true,
    provider: result.provider,
    recipient: maskEmail(recipient.email),
    sentAt: now.toISOString()
  }
}

export const notificationInternals = {
  MAX_ATTEMPTS,
  DEFAULT_BATCH_LIMIT,
  DEFAULT_MAX_AGE_HOURS
}
