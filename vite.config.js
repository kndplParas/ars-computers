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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: SECURITY_HEADERS
  },
  preview: {
    headers: SECURITY_HEADERS
  }
})
