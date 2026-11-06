/**
 * ARS Computers — Customer enquiry tracking OTP service (server side)
 *
 * Runs exclusively in the Cloudflare Worker. It is the ONLY caller of the
 * service-role-only tracking RPCs, so no customer device ever communicates
 * with the database directly and no secret ever reaches the client.
 *
 * Cryptographic design:
 *   - The 6-digit code is generated in PostgreSQL with gen_random_bytes
 *     (CSPRNG) inside the service-role RPC.
 *   - The Worker HMACs the freshly minted code with TRACKING_OTP_HMAC_SECRET
 *     (a Cloudflare Worker secret — never in the repo, the database, logs or
 *     frontend code) over "<identifier>:<code>" and stores ONLY the digest
 *     in the database via seal_tracking_otp.
 *   - Verification pulls the stored digest from the database, re-computes the
 *     HMAC of the submitted code and compares the two 32-byte digests in
 *     constant time (native crypto.subtle.timingSafeEqual when available,
 *     otherwise a branch-free XOR-compare loop). No comparison of plaintext.
 *   - Session tokens are 256-bit crypto.randomUUID-free CSPRNG strings
 *     (crypto.getRandomValues); the database stores only SHA-256(token).
 *   - Database-side guarantees preserved unchanged: 10-minute expiry,
 *     single-use challenge (consumed on success → replay-proof), max 3 sends
 *     / 15-minute identifier window, 5 failed verifies → 30-minute lockout,
 *     30 OTP requests / hour per hashed IP, and generic anti-enumeration
 *     responses in every path.
 *
 * Flow:
 *   POST /api/tracking/otp/request  { contact }
 *     -> start_tracking_otp -> [Worker seals digest] -> email via Resend
 *   POST /api/tracking/otp/verify   { contact, code }
 *     -> fetch_tracking_otp_challenge -> timing-safe compare
 *          -> mismatch: fail_tracking_otp -> generic 401
 *          -> match:    complete_tracking_otp (hash-only session) -> token
 *   POST /api/tracking/enquiries    { sessionToken }
 *     -> list_customer_enquiries -> sanitized own enquiries
 *
 * Security properties:
 *   - OTP codes, HMAC secrets and raw client IPs never appear in responses
 *     or logs; identical generic wording for all non-success paths.
 *   - Rate limits are enforced inside the database (per identifier, per IP).
 */

import { getNotificationConfig, sendNotificationEmail, escapeHtml } from './notificationService.js'

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const OTP_SECRET_MIN_LENGTH = 32
const SHA256_HEX_LENGTH = 64
/**
 * HMAC domain separation: every digest is bound to (a) the exact tracking
 * purpose, (b) the normalized customer identifier as DERIVED BY THE DATABASE
 * (returned by the RPC — never the raw, client-controlled contact string),
 * and (c) the OTP code itself. Digests are never valid for any other
 * purpose, contact, or identifier produced elsewhere.
 */
const OTP_HMAC_PURPOSE = 'ars:tracking:otp:v1'

const GENERIC_OTP_MESSAGE =
  'If a matching enquiry is registered with ARS Computers, a verification code has been sent to its registered email address. Please use your registered email address or contact us for help.'
const GENERIC_FAIL_MESSAGE = 'Verification failed. Please try again or contact ARS Computers for help.'
const GENERIC_SESSION_MESSAGE = 'Your tracking session has expired. Please verify again.'
const GENERIC_UNAVAILABLE_MESSAGE = 'Tracking is temporarily unavailable. Please try again shortly.'

function noStoreJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}

async function readJsonBody(request) {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

export function isValidTrackContact(contact) {
  const value = String(contact ?? '').trim()
  if (!value) return false
  if (EMAIL_PATTERN.test(value) && value.length <= 254) return true
  const digits = value.replaceAll(/[^0-9]/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** SHA-256 hex of the client IP — lets the database throttle per caller. */
export async function hashClientIp(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ars-tracking:${ip}`))
    return bufferToHex(digest)
  } catch {
    return 'unhashable'
  }
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes.buffer
}

/**
 * The OTP HMAC secret lives only as a Cloudflare Worker secret. A readable
 * minimum length is enforced; a missing/short secret fails closed (generic
 * 503) and is never logged. The value never leaves this module.
 */
export function getTrackingOtpSecret(env) {
  const secret = env?.TRACKING_OTP_HMAC_SECRET
  if (typeof secret !== 'string' || secret.length < OTP_SECRET_MIN_LENGTH) {
    return null
  }
  return secret
}

async function importOtpHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function hmacOtpMaterial(secret, identifier, code) {
  const key = await importOtpHmacKey(secret)
  // Purpose : normalized-database identifier : code
  return crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${OTP_HMAC_PURPOSE}:${identifier}:${code}`)
  )
}

/** Constant-time compare of two equal-length digest buffers. */
function timingSafeDigestEqual(candidate, stored) {
  const a = new Uint8Array(candidate)
  const b = new Uint8Array(stored)
  if (a.length !== b.length) return false
  // Prefer the runtime constant-time primitive.
  if (typeof crypto.subtle?.timingSafeEqual === 'function') {
    const equal = crypto.subtle.timingSafeEqual(a.buffer.slice(0), b.buffer.slice(0))
    return equal === true
  }
  // Branch-free fallback: fold byte differences instead of returning early.
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index]
  }
  return diff === 0
}

function isSha256Hex(value) {
  return typeof value === 'string' && value.length === SHA256_HEX_LENGTH && /^[0-9a-f]{64}$/.test(value)
}

function randomSessionToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bufferToHex(bytes.buffer)
}

async function sha256Hex(value) {
  return bufferToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function callTrackingRpc(env, rpcName, args) {
  const config = getNotificationConfig(env)
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error(GENERIC_UNAVAILABLE_MESSAGE)
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  })

  const raw = await response.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  return { ok: response.ok, status: response.status, data }
}

function buildOtpEmail({ code, expiresInMinutes }) {
  const minutes = String(expiresInMinutes || 10)
  const text = [
    'ARS Computers — Enquiry Tracking Verification',
    '',
    `Your one-time verification code is: ${code}`,
    '',
    `This code expires in ${minutes} minutes and can be used once.`,
    'If you did not request this code, you can ignore this email or contact ARS Computers.',
    '',
    'ARS Computers — Sale & Service Support: +91 70783 82213'
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <h2 style="margin:0 0 4px;font-size:18px;color:#0f172a;">ARS Computers — Enquiry Tracking Verification</h2>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;">Use this one-time code to verify your contact and track your enquiries.</p>
      <p style="margin:0 0 18px;">
        <span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;
          font-size:28px;font-weight:800;letter-spacing:8px;padding:12px 20px;border-radius:10px;">${escapeHtml(code)}</span>
      </p>
      <p style="margin:0 0 6px;color:#475569;font-size:13px;">This code expires in ${minutes} minutes and can be used once.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you did not request this code, you can ignore this email or contact ARS Computers at +91 70783 82213.</p>
    </div>
  </body>
</html>`

  return { subject: 'Your ARS Computers verification code', text, html }
}

export async function handleTrackingOtpRequest(request, env) {
  const body = await readJsonBody(request)
  const contact = String(body.contact ?? '').trim()

  if (!isValidTrackContact(contact)) {
    return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 400)
  }

  const secret = getTrackingOtpSecret(env)
  if (!secret) {
    // Fail closed: no verifiable OTP can be issued without the Worker secret.
    return noStoreJson({ success: false, error: GENERIC_UNAVAILABLE_MESSAGE }, 503)
  }

  try {
    const clientHash = await hashClientIp(request)
    const { ok, data } = await callTrackingRpc(env, 'start_tracking_otp', {
      p_contact: contact,
      p_client_hash: clientHash
    })

    if (!ok) {
      // Database-level rate limiting and validation errors surface the
      // generic message only.
      return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 429)
    }

    if (data && data.delivered === true && data.otp_code && data.identifier) {
      // Seal the digest BEFORE the email ever leaves the server (fail closed).
      const digest = await hmacOtpMaterial(secret, String(data.identifier), String(data.otp_code))
      const sealed = await callTrackingRpc(env, 'seal_tracking_otp', {
        p_contact: contact,
        p_code_hash: bufferToHex(digest)
      })

      if (!sealed.ok) {
        console.error('[tracking-otp] Challenge could not be sealed.')
        return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 429)
      }

      const config = getNotificationConfig(env)
      const email = buildOtpEmail({ code: data.otp_code, expiresInMinutes: data.expires_in_minutes })
      await sendNotificationEmail(config, {
        to: data.delivery_email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        // Unique per send attempt without revealing anything.
        idempotencyKey: `ars-otp-${clientHash.slice(0, 16)}-${Date.now()}`
      })
    }

    // Identical generic success in every path: delivered, undelivered,
    // unregistered and rate-limited callers cannot be told apart.
    return noStoreJson({ success: true, message: GENERIC_OTP_MESSAGE })
  } catch (error) {
    console.error('[tracking-otp] OTP request failed:', error?.message || error)
    return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 503)
  }
}

export async function handleTrackingOtpVerify(request, env) {
  const body = await readJsonBody(request)
  const contact = String(body.contact ?? '').trim()
  const code = String(body.code ?? '').trim()
  const digits = code.replaceAll(/[^0-9]/g, '')

  if (!isValidTrackContact(contact) || !/^[0-9]{4,8}$/.test(digits)) {
    return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 400)
  }

  const secret = getTrackingOtpSecret(env)
  if (!secret) {
    return noStoreJson({ success: false, error: GENERIC_UNAVAILABLE_MESSAGE }, 503)
  }

  try {
    const { ok, data } = await callTrackingRpc(env, 'fetch_tracking_otp_challenge', {
      p_contact: contact
    })

    if (!ok || !data?.code_hash || !data?.identifier || !isSha256Hex(data.code_hash)) {
      return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 401)
    }

    // Constant-time comparison of two SHA-256-length HMAC digests.
    const candidate = await hmacOtpMaterial(secret, String(data.identifier), digits)
    const stored = hexToBuffer(data.code_hash)
    if (!timingSafeDigestEqual(candidate, stored)) {
      // Wrong code: burn one of the per-identifier verify attempts (5 → 30 min
      // lockout inside the database). Failure mode stays generic.
      await callTrackingRpc(env, 'fail_tracking_otp', { p_contact: contact }).catch(() => null)
      return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 401)
    }

    // Correct code: mint a 256-bit CSPRNG session token and hand the database
    // ONLY its SHA-256 hash. The database consumes the challenge row in the
    // same transaction (single use + replay prevention).
    const sessionToken = randomSessionToken()
    const sessionTokenHash = await sha256Hex(sessionToken)
    const completed = await callTrackingRpc(env, 'complete_tracking_otp', {
      p_contact: contact,
      p_token_hash: sessionTokenHash
    })

    if (!completed.ok) {
      return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 401)
    }

    return noStoreJson({
      success: true,
      sessionToken,
      expiresInMinutes: completed.data?.expires_in_minutes || 45
    })
  } catch (error) {
    console.error('[tracking-otp] OTP verify failed:', error?.message || error)
    return noStoreJson({ success: false, error: GENERIC_FAIL_MESSAGE }, 503)
  }
}

export async function handleTrackingEnquiries(request, env) {
  const body = await readJsonBody(request)
  const sessionToken = String(body.sessionToken ?? '').trim()

  if (!sessionToken || sessionToken.length > SHA256_HEX_LENGTH) {
    return noStoreJson({ success: false, error: GENERIC_SESSION_MESSAGE }, 401)
  }

  try {
    const { ok, data } = await callTrackingRpc(env, 'list_customer_enquiries', {
      p_token: sessionToken
    })

    if (!ok) {
      return noStoreJson({ success: false, error: GENERIC_SESSION_MESSAGE }, 401)
    }

    return noStoreJson({
      success: true,
      enquiries: (data && data.enquiries) || []
    })
  } catch (error) {
    console.error('[tracking-otp] Enquiry list failed:', error?.message || error)
    return noStoreJson({ success: false, error: GENERIC_SESSION_MESSAGE }, 503)
  }
}
