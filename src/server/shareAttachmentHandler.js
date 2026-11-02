/**
 * ARS Computers — Step 5: Server-Side Customer Attachment Download Proxy
 *
 * Runs exclusively in trusted server environments (Cloudflare Pages Functions / Node dev server).
 * - Never bundles with Vite client code.
 * - Extracts verified IP and user-agent from server request headers.
 * - Enforces IP rate limiting and brute-force throttling.
 * - Resolves token hash via PostgreSQL RPC (zero raw tokens stored at rest).
 * - Streams object binary directly from private Supabase Storage (zero URLs exposed).
 * - Applies strict cache-prevention headers: Cache-Control: no-store.
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

// Local Development & Single-Instance Rate Limiting
// NOTE (Priority 3 Remediation):
// In production on Cloudflare Pages, edge isolates run across distributed data centers with
// independent heap memory. Therefore, these in-memory Maps serve strictly as local development
// emulation and secondary defense. Production distributed protection MUST be configured via
// Cloudflare WAF Rate Limiting rules (see docs/CLOUDFLARE_RATE_LIMITING_AND_LOG_RETENTION.md).
const ipRequestCounts = new Map() // ip -> { count, resetAt }
const ipFailedAttempts = new Map() // ip -> { count, blockedUntil }

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30 // 30 requests per minute
const MAX_FAILED_ATTEMPTS = 5 // 5 failed tokens
const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes block

/**
 * Clean up stale rate-limiting entries
 */
function cleanupRateLimitEntries(now) {
  for (const [ip, data] of ipRequestCounts.entries()) {
    if (now > data.resetAt) ipRequestCounts.delete(ip)
  }
  for (const [ip, data] of ipFailedAttempts.entries()) {
    if (data.blockedUntil > 0 && now > data.blockedUntil) ipFailedAttempts.delete(ip)
  }
}

/**
 * Check and record client IP for rate limiting
 */
export function checkRateLimit(clientIp) {
  const now = Date.now()
  if (Math.random() < 0.05) cleanupRateLimitEntries(now)

  // Check brute-force block
  const blockData = ipFailedAttempts.get(clientIp)
  if (blockData && blockData.blockedUntil > 0 && now < blockData.blockedUntil) {
    return { allowed: false, reason: 'BLOCKED' }
  }

  // Check window rate limit
  let reqData = ipRequestCounts.get(clientIp)
  if (!reqData || now > reqData.resetAt) {
    reqData = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
    ipRequestCounts.set(clientIp, reqData)
  } else {
    reqData.count += 1
    if (reqData.count > MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' }
    }
  }

  return { allowed: true }
}

/**
 * Record a failed attempt (invalid, expired, or revoked token)
 */
export function recordFailedAttempt(clientIp) {
  const now = Date.now()
  let failed = ipFailedAttempts.get(clientIp)
  if (!failed || (failed.blockedUntil > 0 && now > failed.blockedUntil)) {
    failed = { count: 1, blockedUntil: 0 }
    ipFailedAttempts.set(clientIp, failed)
  } else {
    failed.count += 1
  }

  if (failed.count >= MAX_FAILED_ATTEMPTS) {
    failed.blockedUntil = now + BLOCK_DURATION_MS
  }
}

/**
 * Reset rate limit stores (used for testing)
 */
export function resetRateLimitsForTesting() {
  ipRequestCounts.clear()
  ipFailedAttempts.clear()
}

/**
 * Main Download Proxy Handler
 *
 * @param {Object} options
 * @param {string} options.token - 64-character hex raw token from URL
 * @param {string} options.clientIp - Verified server-derived IP
 * @param {string} options.userAgent - Verified user-agent
 * @param {string} options.supabaseUrl - Supabase URL
 * @param {string} options.serviceRoleKey - Private Supabase service role key
 * @returns {Promise<Object>} Response descriptor { status, headers, body, isStream }
 */
export async function handleCustomerAttachmentDownload({
  token,
  clientIp = '0.0.0.0',
  userAgent = 'Unknown',
  supabaseUrl,
  serviceRoleKey
}) {
  const cleanIp = String(clientIp || '0.0.0.0').trim()
  const cleanUa = String(userAgent || 'Unknown').trim()

  // 1. Rate Limiting Check
  const rateLimit = checkRateLimit(cleanIp)
  if (!rateLimit.allowed) {
    return {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'Retry-After': '900'
      },
      body: JSON.stringify({
        success: false,
        error: 'Too many requests. Please wait before trying again.'
      })
    }
  }

  // 2. Token Format Validation (Must be exactly 64 hex characters)
  if (!token || typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token.trim())) {
    recordFailedAttempt(cleanIp)
    return {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private'
      },
      body: JSON.stringify({
        success: false,
        error: 'This document access link is invalid, has expired, or was revoked. Please contact ARS Computers for assistance.'
      })
    }
  }

  const cleanToken = token.trim().toLowerCase()

  // 3. Compute SHA-256 Token Hash at Rest
  const tokenBytes = Buffer.from(cleanToken, 'hex')
  const tokenHash = crypto.createHash('sha256').update(tokenBytes).digest('hex')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing server Supabase configuration for attachment proxy.')
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
      body: JSON.stringify({ success: false, error: 'Server configuration error.' })
    }
  }

  // 4. Initialize Trusted Server Client
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  // 5. Resolve Token via Database RPC
  const { data: resolveResult, error: rpcError } = await serverClient.rpc(
    'resolve_shared_attachment_token',
    {
      p_token_hash: tokenHash,
      p_client_ip: cleanIp,
      p_user_agent: cleanUa
    }
  )

  if (rpcError || !resolveResult || !resolveResult.valid) {
    recordFailedAttempt(cleanIp)
    return {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private'
      },
      body: JSON.stringify({
        success: false,
        error: 'This document access link is invalid, has expired, or was revoked. Please contact ARS Computers for assistance.'
      })
    }
  }

  // 6. Download Binary from Private Storage Bucket
  const storagePath = resolveResult.storage_path
  const originalFilename = resolveResult.original_filename || 'document.pdf'
  const mimeType = resolveResult.mime_type || 'application/octet-stream'

  const { data: blob, error: downloadError } = await serverClient.storage
    .from('order-attachments')
    .download(storagePath)

  if (downloadError || !blob) {
    console.error('Storage download failure for shared attachment:', downloadError)
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
      body: JSON.stringify({ success: false, error: 'The requested document file could not be found.' })
    }
  }

  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 7. Stream Response Directly with Strict Security & No-Store Headers
  // Sanitize filename for Content-Disposition header
  const safeFilename = originalFilename.replace(/["\r\n\\]/g, '_')

  return {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'"
    },
    body: buffer,
    isStream: true
  }
}
