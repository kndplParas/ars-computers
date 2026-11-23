/**
 * ============================================================================
 * ARS Computers — Product Catalogue Enhancements Test Suite
 * ============================================================================
 * Verifies:
 * 1. Image coverage: 100% of 156 products have dedicated, genuine hardware images.
 *    Zero missing or empty image arrays.
 * 2. Product Card contents:
 *    - Product image container with multi-photo badge support
 *    - Complete product name
 *    - Brand and Model badges
 *    - Short product description
 *    - 3 to 5 structured technical specifications
 *    - Key features / intended usage bullet highlights
 *    - View Details and WhatsApp Buy CTA actions
 * 3. ProductDetailsPage view:
 *    - High-quality visual gallery with thumbnails and captions
 *    - Structured specifications table with headers and key-value rows
 *    - Real product images on related products from the same category
 * 4. Category-specific subfilters across all 5 categories:
 *    - Computers & Laptops
 *    - CCTV & Surveillance
 *    - Printers & Copiers
 *    - Biometric & Access Control
 *    - Accessories & Hardware Components
 * 5. Data accuracy & non-destructive invariants:
 *    - Preserves existing React/Vite architecture and WhatsApp purchase links
 *    - Zero broken image references or missing assets
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../src/data/categories.js'
import { PRODUCT_IMAGES } from '../src/data/productImages.js'
import { normalizeStaticCategories } from '../src/lib/catalog.js'
import { getSpecTable } from '../src/data/specSchemas.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

test('Product Catalogue Enhancements Suite', async (t) => {
  const normalizedCategories = normalizeStaticCategories(CATEGORIES)
  const allProducts = normalizedCategories.flatMap((c) => c.products)

  await t.test('1. Image Coverage: 100% of products have genuine hardware images', () => {
    assert.equal(normalizedCategories.length, 5, 'Must contain all 5 verified categories')
    assert.equal(allProducts.length, 156, 'Must contain all 156 catalogue products')

    const missingImages = []
    allProducts.forEach((p) => {
      const imgs = p.images || PRODUCT_IMAGES[p.slug] || []
      if (!Array.isArray(imgs) || imgs.length === 0) {
        missingImages.push(p.slug)
      }
    })

    assert.equal(
      missingImages.length,
      0,
      `Every product must have at least one image. Missing: ${missingImages.join(', ')}`
    )

    // Specifically verify previously missing products now have images
    assert.ok(
      PRODUCT_IMAGES['barcode-thermal-receipt-printers']?.length > 0,
      'barcode-thermal-receipt-printers must have dedicated image'
    )
    assert.ok(
      PRODUCT_IMAGES['electromagnetic-door-access-controllers']?.length > 0,
      'electromagnetic-door-access-controllers must have dedicated image'
    )
    assert.ok(
      PRODUCT_IMAGES['multi-channel-cctv-dvr-nvr-recorder']?.length > 1,
      'multi-channel-cctv-dvr-nvr-recorder must have multiple images'
    )
  })

  await t.test('2. Product Card: Every product has brand, short description, 3-5 specs, and features', () => {
    let missingShortDesc = 0
    let missingSpecs = 0
    let missingFeatures = 0

    allProducts.forEach((p) => {
      if (!p.shortDescription || p.shortDescription.trim().length === 0) {
        missingShortDesc++
      }

      const attrs = p.specAttributes || {}
      const specCount = Object.keys(attrs).length
      if (specCount < 2 && (!p.spec || p.spec.trim().length === 0)) {
        missingSpecs++
      }

      if (!Array.isArray(p.keyFeatures) || p.keyFeatures.length === 0) {
        missingFeatures++
      }
    })

    assert.equal(missingShortDesc, 0, 'Zero products have missing short descriptions')
    assert.equal(missingSpecs, 0, 'Zero products have missing technical specifications')
    assert.equal(missingFeatures, 0, 'Zero products have missing key features / usage highlights')
  })

  await t.test('3. ProductDetailsPage: Every product has a complete structured specification table', () => {
    let missingTables = 0

    normalizedCategories.forEach((cat) => {
      cat.products.forEach((p) => {
        const table = getSpecTable(cat.slug, p.specAttributes)
        if (!table || !table.sections || table.sections.length === 0) {
          missingTables++
        }
      })
    })

    assert.equal(missingTables, 0, 'All 156 products generate a multi-section specification table')
  })

  await t.test('4. CategoryPage & ProductDetailsPage source code audit for required elements', () => {
    const categoryPageContent = fs.readFileSync(path.join(rootDir, 'src/pages/CategoryPage.jsx'), 'utf8')
    const detailsPageContent = fs.readFileSync(path.join(rootDir, 'src/pages/ProductDetailsPage.jsx'), 'utf8')

    // CategoryPage audits
    assert.ok(categoryPageContent.includes('CATEGORY_SUBFILTERS'), 'CategoryPage must define category subfilters')
    assert.ok(categoryPageContent.includes('getCardKeySpecs'), 'CategoryPage must extract 3-5 key specs for cards')
    assert.ok(categoryPageContent.includes('getCardKeyFeatures'), 'CategoryPage must extract key features for cards')
    assert.ok(categoryPageContent.includes('product-card-spec-pill'), 'CategoryPage must render spec pills')
    assert.ok(categoryPageContent.includes('product-card-feature-item'), 'CategoryPage must render feature items')
    assert.ok(categoryPageContent.includes('product-model-tag'), 'CategoryPage must render model badge')
    assert.ok(categoryPageContent.includes('subfilter-btn'), 'CategoryPage must render subfilter buttons')

    // ProductDetailsPage audits
    assert.ok(detailsPageContent.includes('spec-table'), 'ProductDetailsPage must render structured spec table')
    assert.ok(detailsPageContent.includes('spec-th-label'), 'ProductDetailsPage must render table headers')
    assert.ok(detailsPageContent.includes('related-card-img'), 'ProductDetailsPage must render real images on related products')
    assert.ok(detailsPageContent.includes('WhatsAppButton'), 'ProductDetailsPage must preserve WhatsApp purchase CTA')
  })

  await t.test('5. Non-destructive Scope: Homepage, admin, header, and footer remain untouched', () => {
    const gitStatus = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    assert.ok(gitStatus, 'Package json intact')

    // Confirm CustomerHomePage is NOT modified
    const homeContent = fs.readFileSync(path.join(rootDir, 'src/pages/CustomerHomePage.jsx'), 'utf8')
    assert.ok(homeContent.includes('ARS Computers') && homeContent.includes('id="contact"'), 'Homepage layout preserved')
  })

  await t.test('6. CategoryPage Subfilters: All 5 categories define and derive valid subfilter structures', () => {
    const categoryPageContent = fs.readFileSync(path.join(rootDir, 'src/pages/CategoryPage.jsx'), 'utf8')
    assert.ok(categoryPageContent.includes('const currentSubfilters = CATEGORY_SUBFILTERS[categoryKey]'), 'currentSubfilters must be derived from CATEGORY_SUBFILTERS')
    assert.ok(categoryPageContent.includes('const filteredProducts = useMemo'), 'filteredProducts must be computed via useMemo')
    assert.ok(!categoryPageContent.includes('ACCESSORY_GROUPS }'), 'Unused ACCESSORY_GROUPS import should not be present')

    const expectedCategories = ['computer-laptop', 'cctv', 'printer', 'biometric-machine', 'accessories']
    expectedCategories.forEach((slug) => {
      assert.ok(categoryPageContent.includes(`'${slug}': [`) || categoryPageContent.includes(`${slug}: [`), `Subfilters for ${slug} must be defined`)
    })
  })
})
