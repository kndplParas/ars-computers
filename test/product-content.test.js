/**
 * ARS Computers — Product content, specification schema and database migration tests.
 * Execution: node test/product-content.test.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PRODUCT_CONTENT,
  PRODUCT_CONTENT_SLUGS,
  getProductContent,
  getProductContentStats
} from '../src/data/productContent.js'
import {
  getSpecTable,
  getSpecTemplate,
  normalizeSpecKey,
  formatSpecLabel,
  SPEC_LABELS
} from '../src/data/specSchemas.js'
import { SHORT_PRODUCT_DESCRIPTIONS } from '../src/data/product-content/short-descriptions.js'
import { CATEGORY_PRODUCTS } from './known-products.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const migrationPath = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261105000001_product_description_schema.sql'
)
const seedPath = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261105000002_product_description_seed.sql'
)
const shortMigrationPath = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261106000001_product_short_description.sql'
)
const shortSeedPath = path.join(
  projectRoot,
  'supabase',
  'migrations',
  '20261106000002_product_short_description_seed.sql'
)
const productDetailsPagePath = path.join(
  projectRoot,
  'src',
  'pages',
  'ProductDetailsPage.jsx'
)
const adminPagePath = path.join(
  projectRoot,
  'src',
  'pages',
  'admin',
  'AdminProductsPage.jsx'
)
const catalogPath = path.join(projectRoot, 'src', 'lib', 'catalog.js')

let passed = 0
let failed = 0
const failures = []

function test(message, condition) {
  if (condition) {
    passed += 1
    console.log(`  PASS: ${message}`)
  } else {
    failed += 1
    failures.push(message)
    console.error(`  FAIL: ${message}`)
  }
}

function readText(pathname) {
  try {
    return fs.readFileSync(pathname, 'utf8')
  } catch (error) {
    console.error(`Unable to read ${pathname}: ${error.message}`)
    return ''
  }
}

const GENERIC_PHRASES = [
  'high-quality product',
  'high quality product',
  'best performance',
  'superior quality',
  'unmatched value',
  'premium quality',
  'top-quality'
]

console.log('====================================================================')
console.log('ARS Computers — Product Content & Specification Test Suite')
console.log('====================================================================')

// 1. Coverage: every audited live product has authored content.
console.log('\n[Suite 1] Product content coverage')
const expectedSlugs = Object.keys(CATEGORY_PRODUCTS).sort()
test('Authored content covers every audited catalogue product', PRODUCT_CONTENT_SLUGS.length === 79)
test('No missing audited catalogue slugs', expectedSlugs.every((slug) => PRODUCT_CONTENT[slug]))
test('PRODUCT_CONTENT and PRODUCT_CONTENT_SLUGS agree', PRODUCT_CONTENT_SLUGS.length === Object.keys(PRODUCT_CONTENT).length &&
  PRODUCT_CONTENT_SLUGS.every((slug) => PRODUCT_CONTENT.hasOwnProperty(slug)))
test('getProductContent is case-insensitive', getProductContent('DELL-LATITUDE-BUSINESS-LAPTOP')?.description?.length > 0)
test('Unknown slugs return null', getProductContent('not-a-real-product-slug') === null)

const stats = getProductContentStats()
test('Every authored entry is verified or clearly configuration-dependent', stats.total === 79 &&
  stats.verified + stats.partiallyVerified + stats.configurationDependent === 79)

console.log('\n[Suite 2] Product content quality')
for (const slug of expectedSlugs) {
  const item = PRODUCT_CONTENT[slug]
  const label = slug
  test(`${label}: has product-specific description (>= 220 characters)`,
    typeof item.description === 'string' && item.description.trim().length >= 220)
  test(`${label}: has at least 4 key features`,
    Array.isArray(item.keyFeatures) && item.keyFeatures.length >= 4)
  test(`${label}: key features are free of generic marketing fluff`,
    item.keyFeatures.every((feature) => {
      const lowered = String(feature).toLowerCase()
      return !GENERIC_PHRASES.some((phrase) => lowered.includes(phrase))
    }) && !GENERIC_PHRASES.some((phrase) => item.description.toLowerCase().includes(phrase)))
  test(`${label}: has compatibility guidance`,
    typeof item.compatibility === 'string' && item.compatibility.trim().length >= 40)
  test(`${label}: has box contents note`,
    typeof item.boxContents === 'string' && item.boxContents.trim().length >= 20)
  test(`${label}: specification verification is recognised`,
    ['verified', 'partially_verified', 'configuration_dependent'].includes(item.specsVerified))
  test(`${label}: verification source is stated`,
    typeof item.specSource === 'string' && item.specSource.trim().length >= 30)
}

// 2b. Short product descriptions: concise, unique and product-specific.
console.log('\n[Suite 2b] Short product descriptions')
const shortKeys = Object.keys(SHORT_PRODUCT_DESCRIPTIONS).sort()
test('Short descriptions cover every audited catalogue product exactly once',
  shortKeys.length === expectedSlugs.length && expectedSlugs.every((slug) => SHORT_PRODUCT_DESCRIPTIONS[slug]))
test('Short descriptions match exported product content entries',
  expectedSlugs.every((slug) => PRODUCT_CONTENT[slug]?.shortDescription === SHORT_PRODUCT_DESCRIPTIONS[slug]))
for (const slug of expectedSlugs) {
  const summary = SHORT_PRODUCT_DESCRIPTIONS[slug]
  test(`${slug}: short description is concise (80–360 characters)`,
    typeof summary === 'string' && summary.trim().length >= 80 && summary.trim().length <= 360)
  test(`${slug}: short description avoids generic availability placeholder text`,
    typeof summary === 'string' &&
      !/contact us for availability/i.test(summary) &&
      !/high-quality product|best performance|premium quality/i.test(summary))
}
test('Short descriptions are all unique',
  new Set(Object.values(SHORT_PRODUCT_DESCRIPTIONS).map((value) => String(value).trim().toLowerCase())).size ===
    Object.values(SHORT_PRODUCT_DESCRIPTIONS).length)

// 3. Category-specific schema: authored keys are known and render in expected sections.
console.log('\n[Suite 3] Category specification schemas')
for (const [slug, item] of Object.entries(PRODUCT_CONTENT)) {
  const category = CATEGORY_PRODUCTS[slug]
  const table = getSpecTable(category, item.specs)
  test(`${slug}: specification table is not empty`, table.sections.length > 0)
  const additional = table.sections.find((section) => section.title === 'Additional Specifications')
  test(`${slug}: no unmapped specification keys remain (${category})`,
    !additional)
  test(`${slug}: every key has a readable label`,
    Object.keys(item.specs).every((key) => formatSpecLabel(key).length > 0))
}

const computerTemplate = getSpecTemplate('computer-laptop')
const cctvTemplate = getSpecTemplate('cctv')
const printerTemplate = getSpecTemplate('printer')
const biometricTemplate = getSpecTemplate('biometric-machine')
const accessoryTemplate = getSpecTemplate('accessories')
test('Computer template includes processor and memory fields',
  computerTemplate.includes('Processor') && computerTemplate.includes('Installed RAM'))
test('CCTV template includes camera and recorder fields',
  cctvTemplate.includes('Camera Type') && cctvTemplate.includes('Channels'))
test('Printer template includes printing technology fields',
  printerTemplate.includes('Print Technology') && printerTemplate.includes('Print Speed'))
test('Biometric template includes authentication fields',
  biometricTemplate.includes('Authentication Methods') && biometricTemplate.includes('User Capacity'))
test('Accessory template includes connector fields',
  accessoryTemplate.includes('Connector') && accessoryTemplate.includes('Interface'))
test('normalizeSpecKey maps labels back to canonical keys',
  normalizeSpecKey('Installed RAM') === 'ram' && normalizeSpecKey('IR / Warm-Light Range') === 'ir_range')
test('All known keys have labels',
  Object.keys(SPEC_LABELS).every((key) => typeof SPEC_LABELS[key] === 'string' && SPEC_LABELS[key].length > 0))

// 4. Migration integrity and security surface.
console.log('\n[Suite 4] Product content database migration')
const schemaSql = readText(migrationPath)
const seedSql = readText(seedPath)
const shortSchemaSql = readText(shortMigrationPath)
const shortSeedSql = readText(shortSeedPath)
test('Schema migration exists and is non-destructive for existing product columns',
  fs.existsSync(migrationPath) &&
  schemaSql.includes('ADD COLUMN IF NOT EXISTS description') &&
  schemaSql.includes('ADD COLUMN IF NOT EXISTS key_features') &&
  schemaSql.includes('ADD COLUMN IF NOT EXISTS specs_verified') &&
  !/ALTER TABLE public\.products\s+DROP COLUMN/i.test(schemaSql))
test('Schema migration does not add public cost_price access',
  schemaSql.includes('cost_price') &&
  schemaSql.includes('GRANT SELECT (') &&
  !/GRANT SELECT \([^)]*cost_price/is.test(schemaSql))
test('Schema migration recreates get_admin_products with new return columns',
  schemaSql.includes('DROP FUNCTION IF EXISTS public.get_admin_products') &&
  schemaSql.includes('description TEXT') &&
  schemaSql.includes('spec_source TEXT'))
test('Schema migration keeps get_admin_products limited to authenticated role',
  schemaSql.includes("REVOKE EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon") &&
  schemaSql.includes('GRANT EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated'))
test('Schema migration protects new content fields from inventory staff updates',
  ['description', 'key_features', 'compatibility', 'box_contents', 'specs_verified', 'spec_source']
    .every((column) => schemaSql.includes(`(NEW.${column} IS DISTINCT FROM OLD.${column})`)))
test('Seed migration updates every audited product by slug',
  expectedSlugs.every((slug) => seedSql.includes(`WHERE slug = '${slug}';`)))
test('Seed migration verifies affected rows and fails loudly',
  seedSql.includes('RAISE EXCEPTION') &&
  seedSql.includes("v_missing") && seedSql.includes("v_blank"))
test('Seed migration does not modify cost_price or permissions',
  !seedSql.includes('cost_price') &&
  !seedSql.includes('GRANT') &&
  !seedSql.includes('REVOKE') &&
  !seedSql.includes('CREATE POLICY') &&
  !seedSql.includes('auth.users'))
test('Seed migration contains no empty descriptions',
  !/description = \$ars_product_content\$\s*\$ars_product_content\$/.test(seedSql))

// 4b. Short description database migration
console.log('\n[Suite 4b] Short description database migration')
test('Short description migration adds the new customer-facing field safely',
  fs.existsSync(shortMigrationPath) &&
  shortSchemaSql.includes('ADD COLUMN IF NOT EXISTS short_description') &&
  !/ALTER TABLE public\.products\s+DROP COLUMN/i.test(shortSchemaSql))
test('Short description migration does not grant public cost_price access',
  shortSchemaSql.includes('GRANT SELECT (') &&
  !/GRANT SELECT \([^)]*cost_price/is.test(shortSchemaSql) &&
  shortSchemaSql.includes('short_description TEXT'))
test('Short description migration recreates admin RPC with short_description only for authenticated administrators',
  shortSchemaSql.includes('DROP FUNCTION IF EXISTS public.get_admin_products') &&
  shortSchemaSql.includes('short_description TEXT') &&
  shortSchemaSql.includes("REVOKE EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon") &&
  shortSchemaSql.includes('GRANT EXECUTE ON FUNCTION public.get_admin_products(UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated'))
test('Short description migration shields inventory staff from editing customer content',
  shortSchemaSql.includes('(NEW.short_description IS DISTINCT FROM OLD.short_description)'))
test('Short description seed updates every audited product by slug',
  expectedSlugs.every((slug) => shortSeedSql.includes(`WHERE slug = '${slug}';`)))
test('Short description seed fails loudly when a slug is missing or blank',
  shortSeedSql.includes('RAISE EXCEPTION') &&
  shortSeedSql.includes('v_missing') && shortSeedSql.includes('v_blank'))
test('Short description seed does not modify permissions, policies or Auth',
  !shortSeedSql.includes('GRANT') &&
  !shortSeedSql.includes('REVOKE') &&
  !shortSeedSql.includes('CREATE POLICY') &&
  !shortSeedSql.includes('auth.users'))

// 5. Admin editor supports the same structure for future products.
console.log('\n[Suite 5] Admin product editor support')
const adminCode = readText(adminPagePath)
test('Admin editor edits the same description and key-feature fields',
  adminCode.includes('description') &&
  adminCode.includes('key_features_text') &&
  adminCode.includes('key_features: keyFeatures'))
test('Admin editor edits compatibility and box contents',
  adminCode.includes('compatibility') && adminCode.includes('box_contents'))
test('Admin editor edits specification verification and source',
  adminCode.includes('specs_verified') && adminCode.includes('spec_source'))
test('Admin editor requires and saves short product descriptions',
  adminCode.includes('short_description') &&
  adminCode.includes('A product-specific short description is required.') &&
  adminCode.includes('short_description: formData.short_description'.trim()))
const detailsCode = readText(productDetailsPagePath)
test('Product details render the product-specific short description card',
  detailsCode.includes('product.shortDescription') &&
  detailsCode.includes('short-description-card'))
test('Product details no longer show the generic availability box',
  !detailsCode.includes('Contact us for availability') &&
  !detailsCode.includes('<span className="pricing-label">Availability</span>') &&
  !detailsCode.includes('stock-status-pill on-demand'))
test('Admin editor can insert a category-specific specification template',
  adminCode.includes('getSpecTemplate') && adminCode.includes('Insert Category Template'))
test('Admin editor stores specifications under canonical keys',
  adminCode.includes('normalizeSpecKey(rawKey, specCategoryKey)') &&
  adminCode.includes('spec_attributes: specAttributes'))
test('Admin editor requires product-specific content before save',
  adminCode.includes('A product-specific description is required.') &&
  adminCode.includes('Compatibility and usage guidance is required.'))
test('Catalogue normalization merges database and authored content',
  readText(catalogPath).includes('mergeProductContentFields') &&
  readText(catalogPath).includes('getProductContent') &&
  readText(catalogPath).includes("'key_features'"))

console.log('\n====================================================================')
console.log(`Product content tests passed: ${passed}`)
console.log(`Product content tests failed: ${failed}`)
if (failures.length > 0) {
  console.log('Failures:')
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
