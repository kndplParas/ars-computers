import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('Deployment Cache Mismatch & Reliability Verification', () => {
  it('public/_headers enforces no-cache for HTML, immutable for /assets/*, and no-store for /api/*', () => {
    const headersPath = path.join(rootDir, 'public', '_headers')
    assert.ok(fs.existsSync(headersPath), 'public/_headers must exist')
    const content = fs.readFileSync(headersPath, 'utf8')

    // Verify /* has no-cache, must-revalidate
    assert.ok(
      content.includes('/*') && content.includes('Cache-Control: no-cache, must-revalidate'),
      'public/_headers must enforce Cache-Control: no-cache, must-revalidate on /*'
    )

    // Verify /assets/* has immutable caching for 1 year
    assert.ok(
      content.includes('/assets/*') && content.includes('Cache-Control: public, max-age=31536000, immutable'),
      'public/_headers must enforce Cache-Control: public, max-age=31536000, immutable on /assets/*'
    )

    // Verify /api/* has no-store
    assert.ok(
      content.includes('/api/*') && content.includes('Cache-Control: no-store, no-cache, must-revalidate'),
      'public/_headers must preserve /api/* no-store cache control'
    )

    // Verify security headers remain intact
    assert.ok(content.includes('X-Content-Type-Options: nosniff'), 'Preserves X-Content-Type-Options')
    assert.ok(content.includes('X-Frame-Options: DENY'), 'Preserves X-Frame-Options')
    assert.ok(content.includes('Content-Security-Policy:'), 'Preserves Content-Security-Policy')
  })

  it('wrangler.jsonc routes /api/* and /assets/* through Worker first', () => {
    const wranglerPath = path.join(rootDir, 'wrangler.jsonc')
    assert.ok(fs.existsSync(wranglerPath), 'wrangler.jsonc must exist')
    const config = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'))

    assert.ok(Array.isArray(config.assets?.run_worker_first), 'run_worker_first must be an array')
    assert.ok(config.assets.run_worker_first.includes('/api/*'), 'run_worker_first must include /api/*')
    assert.ok(config.assets.run_worker_first.includes('/assets/*'), 'run_worker_first must include /assets/*')
    assert.equal(config.assets.not_found_handling, 'single-page-application', 'Preserves SPA not_found_handling')
  })

  it('src/server/worker.js returns true 404 for missing static assets instead of SPA HTML fallback', async () => {
    const workerModule = await import('../src/server/worker.js')
    const worker = workerModule.default

    assert.ok(typeof worker.fetch === 'function', 'worker must export fetch handler')

    // Scenario A: Existing JS asset returns 200 text/javascript
    const mockEnvSuccess = {
      ASSETS: {
        async fetch(req) {
          return new Response('console.log("existing asset");', {
            status: 200,
            headers: { 'Content-Type': 'text/javascript', 'ETag': 'W/"abc"' }
          })
        }
      }
    }
    const reqExisting = new Request('https://arscomputer.com/assets/index-test.js')
    const resExisting = await worker.fetch(reqExisting, mockEnvSuccess)
    assert.equal(resExisting.status, 200, 'Existing asset returns 200 OK')
    assert.equal(resExisting.headers.get('Content-Type'), 'text/javascript', 'Existing asset preserves JS MIME type')

    // Scenario B: Missing JS asset returns text/html from ASSETS (Cloudflare SPA fallback)
    // Worker MUST intercept this and return a 404 text/plain
    const mockEnvMissing = {
      ASSETS: {
        async fetch(req) {
          return new Response('<!doctype html><html><body>SPA Fallback</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        }
      }
    }
    const reqMissing = new Request('https://arscomputer.com/assets/AdminEnquiriesPage-oldChunk.js')
    const resMissing = await worker.fetch(reqMissing, mockEnvMissing)
    assert.equal(resMissing.status, 404, 'Missing asset returns 404 Not Found')
    assert.equal(resMissing.headers.get('Content-Type'), 'text/plain; charset=utf-8', 'Missing asset returns text/plain')
    assert.equal(resMissing.headers.get('X-Asset-Missing'), 'true', 'Marks asset as missing')

    // Scenario C: Non-asset SPA route (e.g. /admin/enquiries) delegates directly to SPA fallback
    const reqSpa = new Request('https://arscomputer.com/admin/enquiries')
    const resSpa = await worker.fetch(reqSpa, mockEnvMissing)
    assert.equal(resSpa.status, 200, 'Application SPA route returns 200 OK from ASSETS')
    assert.ok(resSpa.headers.get('Content-Type').includes('text/html'), 'Application SPA route returns text/html')
  })

  it('src/main.jsx implements vite:preloadError recovery with single attempt per tab/session guard', () => {
    const mainPath = path.join(rootDir, 'src', 'main.jsx')
    const mainCode = fs.readFileSync(mainPath, 'utf8')

    assert.ok(mainCode.includes('vite:preloadError'), 'main.jsx must listen for vite:preloadError')
    assert.ok(mainCode.includes('ars_chunk_reload_attempted'), 'main.jsx must use sessionStorage single attempt recovery key')
    assert.ok(!mainCode.includes('15000'), 'main.jsx must not allow repeated reloads every 15s; must be 1 attempt per session')
    assert.ok(mainCode.includes('window.location.reload()'), 'main.jsx must trigger reload on initial chunk error')
  })

  it('src/components/common/ErrorBoundary.jsx handles chunk mismatch with friendly update UI', () => {
    const errorBoundaryPath = path.join(rootDir, 'src', 'components', 'common', 'ErrorBoundary.jsx')
    const ebCode = fs.readFileSync(errorBoundaryPath, 'utf8')

    assert.ok(
      ebCode.includes('Failed to fetch dynamically imported module'),
      'ErrorBoundary must detect Failed to fetch dynamically imported module'
    )
    assert.ok(
      ebCode.includes('Application Update Available'),
      'ErrorBoundary must display Application Update Available heading'
    )
    assert.ok(
      ebCode.includes('Update Application'),
      'ErrorBoundary must provide Update Application button'
    )
    assert.ok(
      ebCode.includes('Something went wrong loading this view'),
      'ErrorBoundary must preserve standard error message for unrelated runtime errors'
    )
  })
})
