/**
 * Cloudflare Pages Function: Customer Attachment Download Proxy
 *
 * Route: GET /api/share/attachment/:token
 *
 * Deployed automatically by Cloudflare Pages from the `functions/` root directory.
 * Runs on Cloudflare Workers edge runtime.
 *
 * Security:
 * - Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exclusively from context.env (Cloudflare secrets).
 * - Extracts trusted cf-connecting-ip and user-agent directly from Cloudflare request headers.
 * - Streams file binary directly to customer with Cache-Control: no-store.
 * - Never leaks storage paths, signed URLs, database IDs, or internal notes.
 */

import { handleCustomerAttachmentDownload } from '../../../../src/server/shareAttachmentHandler.js'

export async function onRequestGet(context) {
  const { params, request, env } = context
  const token = params.token

  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '0.0.0.0'
  const userAgent = request.headers.get('user-agent') || 'Unknown'

  const supabaseUrl = env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Server configuration missing. Please ensure Cloudflare environment secrets are configured.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    )
  }

  const result = await handleCustomerAttachmentDownload({
    token,
    clientIp,
    userAgent,
    supabaseUrl,
    serviceRoleKey
  })

  return new Response(result.body, {
    status: result.status,
    headers: result.headers
  })
}

