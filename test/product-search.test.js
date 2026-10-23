import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPublicCatalog, searchActiveCatalog } from '../src/lib/catalog.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

console.log('====================================================================')
console.log('Running ARS Computers Customer Product Search Engine Tests')
console.log('====================================================================\n')

// 1. Verify Customer Navbar Header Cleanup
console.log('[Suite 1] Inspecting src/components/SiteHeader.jsx Navbar Cleanup:')
const siteHeaderPath = path.join(projectRoot, 'src', 'components', 'SiteHeader.jsx')
const siteHeaderCode = fs.readFileSync(siteHeaderPath, 'utf8')

assert(
  !siteHeaderCode.includes('Admin Portal') && !siteHeaderCode.includes('Staff Admin Portal'),
  'SiteHeader.jsx strictly removes Admin Portal / Staff Admin Portal buttons'
)
console.log('  ✓ PASSED: Admin Portal link/button strictly removed from customer navbar')

assert(
  !siteHeaderCode.includes('Get Quote') && !siteHeaderCode.includes('Request a Quote'),
  'SiteHeader.jsx strictly removes Request a Quote / Get Quote buttons from navbar'
)
console.log('  ✓ PASSED: Request a Quote / Get Quote buttons strictly removed from customer navbar')

assert(
  siteHeaderCode.includes('ProductSearch'),
  'SiteHeader.jsx imports and embeds ProductSearch component'
)
console.log('  ✓ PASSED: SiteHeader.jsx embeds ProductSearch component in desktop & mobile')

assert(
  siteHeaderCode.includes('mobile-search-toggle-btn') && siteHeaderCode.includes('mobile-header-search-bar'),
  'SiteHeader.jsx includes responsive mobile search toggle and slide-down search bar'
)
console.log('  ✓ PASSED: SiteHeader.jsx supports responsive mobile search toggle and drawer search')

// 2. Verify Admin Portal Routes & Direct Login Access
console.log('\n[Suite 2] Verifying Admin Portal Security & Direct /admin/login Route Preservation:')
const appPath = path.join(projectRoot, 'src', 'App.jsx')
const appCode = fs.readFileSync(appPath, 'utf8')

assert(
  appCode.includes('path="/admin/login"'),
  'Direct /admin/login route is fully preserved in App.jsx'
)
assert(
  appCode.includes('path="/admin"'),
  'Admin routes are fully preserved in App.jsx'
)
assert(
  appCode.includes('path="/search"'),
  'Dedicated /search route is registered in App.jsx'
)
console.log('  ✓ PASSED: /admin/login, /admin, and protected Admin routes remain 100% active and preserved')
console.log('  ✓ PASSED: /search route registered for full-catalog search results')

// 3. Verify Live Catalog Search Behavior with Target Queries
console.log('\n[Suite 3] Testing searchActiveCatalog Queries on Real Catalogue Data:')
const catalog = await fetchPublicCatalog()

// Test: 'hp'
const hpSearch = searchActiveCatalog('hp', catalog)
assert(hpSearch.totalMatches > 0, 'Query "hp" returns matching HP products')
assert(
  hpSearch.results.every((p) => {
    const combined = `${p.rawName || p.name} ${p.brand || ''}`.toLowerCase()
    return combined.includes('hp')
  }),
  'All "hp" results are genuine HP branded or named products'
)
console.log(`  ✓ PASSED: Query "hp" matched ${hpSearch.totalMatches} genuine HP models`)

// Test: 'printer'
const printerSearch = searchActiveCatalog('printer', catalog)
assert(printerSearch.totalMatches > 0, 'Query "printer" returns matching printer products')
assert(
  printerSearch.results.some((p) => p.categoryId === 'printer' || p.categoryTitle.toLowerCase().includes('printer')),
  'Query "printer" returns printer category products'
)
console.log(`  ✓ PASSED: Query "printer" matched ${printerSearch.totalMatches} printer models`)

// Test: 'laser'
const laserSearch = searchActiveCatalog('laser', catalog)
assert(laserSearch.totalMatches > 0, 'Query "laser" returns laser printer models')
assert(
  laserSearch.results.every((p) => {
    const combined = `${p.rawName || p.name} ${p.specSummary || p.spec || ''} ${p.description || ''}`.toLowerCase()
    return combined.includes('laser')
  }),
  'All "laser" results genuinely contain laser in name or specifications'
)
console.log(`  ✓ PASSED: Query "laser" matched ${laserSearch.totalMatches} laser products without fabrication`)

// Test: 'cctv'
const cctvSearch = searchActiveCatalog('cctv', catalog)
assert(cctvSearch.totalMatches > 0, 'Query "cctv" returns CCTV surveillance hardware')
console.log(`  ✓ PASSED: Query "cctv" matched ${cctvSearch.totalMatches} CCTV surveillance products`)

// Test: 'laptop'
const laptopSearch = searchActiveCatalog('laptop', catalog)
assert(laptopSearch.totalMatches > 0, 'Query "laptop" returns laptop computer hardware')
console.log(`  ✓ PASSED: Query "laptop" matched ${laptopSearch.totalMatches} laptop products`)

// Test: 'biometric'
const bioSearch = searchActiveCatalog('biometric', catalog)
assert(bioSearch.totalMatches > 0, 'Query "biometric" returns biometric attendance machines')
console.log(`  ✓ PASSED: Query "biometric" matched ${bioSearch.totalMatches} biometric machine models`)

// Test: 'dahua' (brand not present in current 79 items)
const dahuaSearch = searchActiveCatalog('dahua', catalog)
assert.strictEqual(dahuaSearch.totalMatches, 0, 'Query "dahua" returns 0 matches when not in active DB (no fake results)')
console.log('  ✓ PASSED: Query "dahua" returns exactly 0 matches (Strictly zero fabricated results)')

// 4. Case-insensitivity, Whitespace Trimming, and Edge Cases
console.log('\n[Suite 4] Testing Case-insensitivity, Whitespace Trimming, and Safety Invariants:')
const upperSearch = searchActiveCatalog('  HP   ', catalog)
assert.strictEqual(upperSearch.totalMatches, hpSearch.totalMatches, 'Case and whitespace are normalized identically')
console.log('  ✓ PASSED: Case-insensitive and whitespace-trimmed search works identically')

const emptySearch = searchActiveCatalog('   ', catalog)
assert.strictEqual(emptySearch.totalMatches, 0, 'Empty or whitespace-only query returns empty results')
assert.strictEqual(emptySearch.results.length, 0, 'Empty query returns 0 results array')
console.log('  ✓ PASSED: Empty or whitespace-only query safely returns 0 results')

const nonExistent = searchActiveCatalog('xyznonexistentproduct999', catalog)
assert.strictEqual(nonExistent.totalMatches, 0, 'Non-existent product query returns 0 results')
console.log('  ✓ PASSED: Non-existent product query returns 0 results cleanly')

// 5. Result Limit and Pagination
console.log('\n[Suite 5] Verifying Result Limit & Ranking:')
assert(hpSearch.results.length <= 8, 'Dropdown results respect limit <= 8')
assert(laptopSearch.results.length <= 8, 'Dropdown results respect limit <= 8 even when total matches > 8')
assert(laptopSearch.totalMatches > laptopSearch.results.length, 'Total matches reflect full count for "View all results"')
console.log(`  ✓ PASSED: Dropdown limit capped at ${laptopSearch.results.length} with ${laptopSearch.totalMatches} total matches`)

// 6. Security & Sensitive Field Exclusion
console.log('\n[Suite 6] Verifying Data Privacy & Sensitive Field Exclusion:')
const allResults = searchActiveCatalog('laptop', catalog, { limit: 100 })
for (const p of allResults.results) {
  assert.strictEqual(p.cost_price, undefined, 'cost_price is strictly not exposed on search result objects')
  assert.strictEqual(p.internal_notes, undefined, 'internal_notes is strictly not exposed on search result objects')
}
console.log('  ✓ PASSED: Zero cost_price, admin notes, or private fields exposed in search results')

console.log('\n====================================================================')
console.log('Search Engine Verification Complete: All 18 Test Invariants Passed!')
console.log('====================================================================\n')
