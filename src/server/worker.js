/**
 * ARS Computers — Cloudflare Worker Entrypoint
 *
 * Runs on Cloudflare Workers edge runtime with static assets.
 * - Handles customer attachment download proxy at /api/share/attachment/:token.
 * - Supports GET and HEAD methods (HEAD preserves all status codes and headers with null body).
 * - Rejects unsupported HTTP verbs with HTTP 405 Method Not Allowed.
 * - Safely delegates all other requests (SPA routes, static assets, any other API paths) to Cloudflare Static Assets.
 */

import { handleCustomerAttachmentDownload } from './shareAttachmentHandler.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

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
  }
}
