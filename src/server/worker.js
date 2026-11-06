/**
 * ARS Computers — Cloudflare Worker Entrypoint
 *
 * Runs on Cloudflare Workers edge runtime with static assets.
 * - Handles customer attachment download proxy at /api/share/attachment/:token.
 * - Processes the enquiry email notification outbox on a cron schedule.
 * - Exposes token-protected notification processing/test routes.
 * - Supports GET and HEAD methods (HEAD preserves all status codes and headers with null body).
 * - Rejects unsupported HTTP verbs with HTTP 405 Method Not Allowed.
 * - Safely delegates all other requests (SPA routes, static assets, any other API paths) to Cloudflare Static Assets.
 */

import { handleCustomerAttachmentDownload } from './shareAttachmentHandler.js'
import {
  NotificationConfigurationError,
  processNotificationOutbox,
  sendTestNotification
} from './notificationService.js'
import {
  handleTrackingEnquiries,
  handleTrackingOtpRequest,
  handleTrackingOtpVerify
} from './trackingOtpService.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private'
    }
  })
}

function safeTokenEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false
  if (provided.length !== expected.length) return false

  let mismatch = 0
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return mismatch === 0
}

function isAuthorizedNotificationRequest(request, env) {
  const expected = env.NOTIFICATION_PROCESS_TOKEN
  if (!expected) return { allowed: false, hidden: true }
  const provided = request.headers.get('x-notification-token') || ''
  return { allowed: safeTokenEqual(provided, expected), hidden: false }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Route: notification outbox processing / safe test (token protected)
    if (url.pathname === '/api/notifications/process' || url.pathname === '/api/notifications/test') {
      if (request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method not allowed.' }, 405)
      }

      const authorization = isAuthorizedNotificationRequest(request, env)
      if (authorization.hidden) {
        return jsonResponse({ success: false, error: 'Not found.' }, 404)
      }
      if (!authorization.allowed) {
        return jsonResponse({ success: false, error: 'Unauthorized.' }, 401)
      }

      try {
        if (url.pathname === '/api/notifications/test') {
          const result = await sendTestNotification(env)
          return jsonResponse(result)
        }

        const summary = await processNotificationOutbox(env)
        return jsonResponse({ success: true, ...summary })
      } catch (error) {
        const message =
          error instanceof NotificationConfigurationError
            ? error.message
            : 'Notification processing failed. Check the Worker logs.'
        console.error('[email-notifications] Manual notification route failed:', error?.message || error)
        return jsonResponse({ success: false, error: message }, 503)
      }
    }

    // Route: /api/tracking/* — customer OTP + sanitized enquiry tracking.
    // Public (no process token) because customers use this flow; the database
    // applies per-identifier and per-IP rate limits inside the RPCs.
    if (url.pathname.startsWith('/api/tracking/')) {
      if (request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method not allowed.' }, 405)
      }

      const trackingRoute = url.pathname
      if (trackingRoute === '/api/tracking/otp/request') {
        return handleTrackingOtpRequest(request, env)
      }
      if (trackingRoute === '/api/tracking/otp/verify') {
        return handleTrackingOtpVerify(request, env)
      }
      if (trackingRoute === '/api/tracking/enquiries') {
        return handleTrackingEnquiries(request, env)
      }

      return jsonResponse({ success: false, error: 'Not found.' }, 404)
    }

    // Route: /api/share/attachment/:token
    if (url.pathname.startsWith('/api/share/attachment/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(
          JSON.stringify({ success: false, error: 'Method not allowed.' }),
          {
            status: 405,
            headers: {
              'Content-Type': 'application/json',
              'Allow': 'GET, HEAD',
              'Cache-Control': 'no-store, private'
            }
          }
        )
      }

      const token = url.pathname.replace(/^\/api\/share\/attachment\//, '').split('?')[0]
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '0.0.0.0'
      const userAgent = request.headers.get('user-agent') || 'Unknown'
      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        const errorBody = request.method === 'HEAD' ? null : JSON.stringify({
          success: false,
          error: 'Server configuration missing. Please ensure Cloudflare environment secrets are configured.'
        })

        return new Response(errorBody, {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private'
          }
        })
      }

      const result = await handleCustomerAttachmentDownload({
        token,
        clientIp,
        userAgent,
        supabaseUrl,
        serviceRoleKey
      })

      // RFC 7231: HEAD must return the exact same status and headers as GET, but never include a response body
      const responseBody = request.method === 'HEAD' ? null : result.body

      return new Response(responseBody, {
        status: result.status,
        headers: result.headers
      })
    }

    // Delegate all other requests (static assets, client-side SPA routing, other paths) to ASSETS binding
    return env.ASSETS.fetch(request)
  },

  async scheduled(_event, env, ctx) {
    const task = processNotificationOutbox(env).catch((error) => {
      console.error(
        '[email-notifications] Scheduled notification processing failed:',
        error?.message || error
      )
    })

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task)
    } else {
      await task
    }
  }
}
