import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; frame-src 'self' https://www.google.com https://maps.google.com; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://*.supabase.co;"
}

/**
 * Local Development Plugin: Serves /api/share/attachment/:token during `npm run dev`
 * mirroring the Cloudflare Pages Function behavior locally.
 */
function localAttachmentProxyPlugin() {
  return {
    name: 'local-attachment-download-proxy',
    configureServer(server) {
      server.middlewares.use('/api/share/attachment', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        const token = req.url.replace(/^\//, '').split('?')[0]
        if (!token) return next()

        try {
          const { handleCustomerAttachmentDownload } = await import('./src/server/shareAttachmentHandler.js')
          const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
          const userAgent = req.headers['user-agent'] || 'LocalDev'
          const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

          const result = await handleCustomerAttachmentDownload({
            token,
            clientIp,
            userAgent,
            supabaseUrl,
            serviceRoleKey
          })

          res.writeHead(result.status, result.headers)
          res.end(result.body)
        } catch (err) {
          console.error('Local attachment proxy error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localAttachmentProxyPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase'
          }
        }
      }
    }
  },
  server: {
    headers: SECURITY_HEADERS
  },
  preview: {
    headers: SECURITY_HEADERS
  }
})
