/**
 * ARS Computers — Enquiry Email Notification Service
 *
 * Runs exclusively in the Cloudflare Worker / trusted server environment.
 * - Reads the pending notification outbox from Supabase using the service role.
 * - Resolves the existing registered main/admin email server-side.
 * - Sends new-enquiry and employee-assignment notifications through Resend
 *   (or an optional Cloudflare send_email binding).
 * - Uses the outbox unique event key as the provider idempotency key.
 * - Never exposes API keys, SMTP credentials, or secrets to the frontend.
 * - Never lets an email failure break enquiry submission or assignment.
 */

const DEFAULT_APP_BASE_URL = 'https://arscomputer.com'
const DEFAULT_BATCH_LIMIT = 10
const DEFAULT_MAX_AGE_HOURS = 24
const MAX_ATTEMPTS = 5
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

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

export async function resolveNotificationRecipient(config, fetchImpl = fetch) {
  const roles = ['superadmin', 'admin']

  for (const role of roles) {
    const url =
      `${config.supabaseUrl}/rest/v1/admin_users` +
      '?select=email,full_name,role' +
      '&is_active=eq.true' +
      `&role=eq.${encodeURIComponent(role)}` +
      '&order=created_at.asc' +
      '&limit=1'

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: serviceRoleHeaders(config)
    })

    if (!response.ok) {
      throw new NotificationConfigurationError(
        `Unable to resolve the registered admin email (HTTP ${response.status}).`
      )
    }

    const rows = await response.json()
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.email) {
      return {
        email: String(rows[0].email),
        fullName: String(rows[0].full_name || ''),
        role: String(rows[0].role || role)
      }
    }
  }

  return null
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
    select: 'id,event_key,event_type,enquiry_id,payload,attempts,status',
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
    select: 'id,event_key,event_type,enquiry_id,payload,attempts,status'
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
        last_error: 'Expired before the email provider was configured.',
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
  const summary = { configured: config.configured, processed: 0, sent: 0, failed: 0, skipped: 0 }

  if (!config.configured) {
    logger.warn?.(
      '[email-notifications] Provider not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and EMAIL_FROM on the Cloudflare Worker. Outbox rows remain pending.'
    )
    return summary
  }

  let recipient = null
  try {
    recipient = await resolveNotificationRecipient(config, fetchImpl)
  } catch (error) {
    logger.error?.('[email-notifications] Recipient lookup failed:', error?.message || error)
    return summary
  }

  if (!recipient) {
    logger.error?.(
      '[email-notifications] No active superadmin/admin recipient was found. Outbox rows remain pending.'
    )
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

    try {
      const result = await sendNotificationEmail(
        config,
        {
          to: recipient.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          idempotencyKey: claimed.event_key
        },
        fetchImpl
      )

      await updateRow(config, fetchImpl, claimed.id, {
        status: 'sent',
        processed_at: now.toISOString(),
        last_error: null
      })

      summary.sent += 1
      logger.info?.('[email-notifications] Notification sent.', {
        eventType: claimed.event_type,
        eventKey: claimed.event_key,
        provider: result.provider,
        recipient: maskEmail(recipient.email)
      })
    } catch (error) {
      summary.failed += 1
      const safeMessage = String(error?.message || 'Email delivery failed.')
        .replaceAll(String(recipient.email), maskEmail(recipient.email))
        .slice(0, 1000)

      try {
        await updateRow(config, fetchImpl, claimed.id, {
          status: 'failed',
          last_error: safeMessage,
          processed_at: now.toISOString()
        })
      } catch {
        // The row remains claimed for a later cleanup/retry.
      }

      logger.error?.('[email-notifications] Notification delivery failed.', {
        eventType: claimed.event_type,
        eventKey: claimed.event_key,
        recipient: maskEmail(recipient.email),
        error: safeMessage
      })
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

  const recipient = await resolveNotificationRecipient(config, fetchImpl)
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
    '',
    'If you received this email, the Cloudflare Worker notification pipeline is configured correctly.'
  ].join('\n')

  const html = emailShell({
    heading: 'Email notification test',
    intro: 'This is a safe test notification from the ARS Computers Admin Portal.',
    details: [
      { label: 'Sent at', value: formatIstDateTime(now.toISOString()) },
      { label: 'Recipient role', value: recipient.role }
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
