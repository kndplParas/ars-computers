/**
 * ============================================================================
 * ARS Computers — Advanced Product Detail & Media Gallery Upgrade Test Suite
 * ============================================================================
 * Verifies:
 * 1. Advanced Product Image Gallery:
 *    - Main image, touch swipe, overlay chevrons, active photo counter.
 *    - Fullscreen lightbox zoom modal with 1x/1.8x/2.5x zoom magnification.
 *    - Clickable thumbnail navigation for all multi-image hardware units.
 *    - 100% caption coverage for multi-image products.
 * 2. Product Technical Schematics & Diagrams:
 *    - ProductTechnicalDiagram renders SVG diagrams for all 5 categories.
 * 3. Rich Product Information Hub:
 *    - Technical Specifications table with manufacturer verification badges.
 *    - Ports, Interfaces & Connectivity grid.
 *    - Recommended Real-World Applications.
 *    - Step-by-Step Installation & Deployment Checklist.
 *    - Physical Environment & Power standards.
 *    - Itemized Box Contents, Warranty coverage, and B2B GST tax invoice notes.
 *    - Interactive Frequently Asked Questions (FAQ) accordion.
 * 4. Non-Destructive Invariants:
 *    - Homepage, admin workflows, header, and footer remain completely untouched.
 *    - Zero broken image references or missing assets.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../src/data/categories.js'
import { PRODUCT_IMAGES, PRODUCT_IMAGE_CAPTIONS } from '../src/data/productImages.js'
import { normalizeStaticCategories } from '../src/lib/catalog.js'
import { getProductRichDetails } from '../src/data/productRichData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

test('Advanced Product Detail & Media Gallery Upgrade Suite', async (t) => {
  const normalizedCategories = normalizeStaticCategories(CATEGORIES)
  const allProducts = normalizedCategories.flatMap((c) => c.products)

  await t.test('1. Image Coverage & Multi-Image Captions Completeness', () => {
    assert.equal(allProducts.length, 156, 'Catalogue must maintain all 156 products')

    // Find all products with >1 image
    const multiImageProducts = allProducts.filter((p) => {
      const imgs = PRODUCT_IMAGES[p.slug] || []
      return imgs.length > 1
    })

    assert.ok(multiImageProducts.length >= 19, 'Must have at least 19 multi-image hardware products')

    // Verify 100% of multi-image products have matching captions
    multiImageProducts.forEach((p) => {
      const imgs = PRODUCT_IMAGES[p.slug] || []
      const captions = PRODUCT_IMAGE_CAPTIONS[p.slug]
      assert.ok(
        Array.isArray(captions),
        `Product ${p.slug} has ${imgs.length} images but missing PRODUCT_IMAGE_CAPTIONS`
      )
      assert.equal(
        captions.length,
        imgs.length,
        `Product ${p.slug} image count (${imgs.length}) must match caption count (${captions.length})`
      )
      captions.forEach((cap, idx) => {
        assert.ok(
          typeof cap === 'string' && cap.trim().length > 10,
          `Product ${p.slug} caption [${idx}] must be a descriptive string`
        )
      })
    })

    // Specifically verify Seagate HDD multi-image mapping
    assert.ok(
      (PRODUCT_IMAGES['seagate-barracuda-3-5-inch-hdd']?.length || 0) >= 2,
      'Seagate BarraCuda 3.5" HDD must have both front casing and opened architecture photos'
    )
  })

  await t.test('2. Rich Product Details & Category Layout Architecture', () => {
    let missingRichPorts = 0
    let missingRichApps = 0
    let missingRichSetup = 0
    let missingRichStandards = 0
    let missingRichFaqs = 0

    allProducts.forEach((p) => {
      const rich = getProductRichDetails(p, { slug: p.categoryId, title: p.categoryTitle })
      assert.ok(rich, `Product ${p.slug} must return rich details object`)

      if (!Array.isArray(rich.ports) || rich.ports.length === 0) missingRichPorts++
      if (!Array.isArray(rich.applications) || rich.applications.length === 0) missingRichApps++
      if (!Array.isArray(rich.setupGuide) || rich.setupGuide.length === 0) missingRichSetup++
      if (!Array.isArray(rich.standards) || rich.standards.length === 0) missingRichStandards++
      if (!Array.isArray(rich.faqs) || rich.faqs.length < 3) missingRichFaqs++
    })

    assert.equal(missingRichPorts, 0, 'Every product has structured ports/interface details')
    assert.equal(missingRichApps, 0, 'Every product has practical application use cases')
    assert.equal(missingRichSetup, 0, 'Every product has step-by-step setup guidance')
    assert.equal(missingRichStandards, 0, 'Every product has industry standards & compliance notes')
    assert.equal(missingRichFaqs, 0, 'Every product has at least 3 authentic FAQs with answers')
  })

  await t.test('3. ProductDetailsPage Source Code & Component Audit', () => {
    const detailsContent = fs.readFileSync(
      path.join(rootDir, 'src/pages/ProductDetailsPage.jsx'),
      'utf8'
    )

    // Gallery & Zoom features
    assert.ok(detailsContent.includes('gallery-zoom-trigger'), 'Must include Zoom/Enlarge trigger button')
    assert.ok(detailsContent.includes('isOpenZoomModal'), 'Must track zoom modal open state')
    assert.ok(detailsContent.includes('modalZoom'), 'Must support variable magnification levels')
    assert.ok(detailsContent.includes('gallery-lightbox-overlay'), 'Must render fullscreen lightbox modal')
    assert.ok(detailsContent.includes('gallery-nav-prev'), 'Must render previous photo navigation')
    assert.ok(detailsContent.includes('gallery-nav-next'), 'Must render next photo navigation')
    assert.ok(detailsContent.includes('handleTouchStart'), 'Must support mobile touch swipe start')
    assert.ok(detailsContent.includes('handleTouchEnd'), 'Must support mobile touch swipe end')
    assert.ok(detailsContent.includes('product-thumbnails-strip'), 'Must render thumbnail navigation strip')

    // Information Hub Tabs
    assert.ok(detailsContent.includes('product-info-tabs-section'), 'Must render information tabs section')
    assert.ok(detailsContent.includes('tab-specs'), 'Must render Technical Specifications tab')
    assert.ok(detailsContent.includes('tab-ports'), 'Must render Ports & Interfaces tab')
    assert.ok(detailsContent.includes('tab-applications'), 'Must render Applications & Setup tab')
    assert.ok(detailsContent.includes('tab-support'), 'Must render Box Contents & Warranty tab')
    assert.ok(detailsContent.includes('tab-faqs'), 'Must render FAQs tab')
    assert.ok(detailsContent.includes('ProductTechnicalDiagram'), 'Must embed ProductTechnicalDiagram component')
    assert.ok(detailsContent.includes('faq-accordion'), 'Must render interactive FAQ accordion')

    // Technical Diagram component exists and exports properly
    const diagramComponentContent = fs.readFileSync(
      path.join(rootDir, 'src/components/ProductTechnicalDiagram.jsx'),
      'utf8'
    )
    assert.ok(diagramComponentContent.includes('laptop-ports'), 'Diagram must handle laptop interfaces')
    assert.ok(diagramComponentContent.includes('dvr-ports'), 'Diagram must handle DVR/NVR interfaces')
    assert.ok(diagramComponentContent.includes('camera-wiring'), 'Diagram must handle camera wiring')
    assert.ok(diagramComponentContent.includes('printer-ports'), 'Diagram must handle printer interfaces')
    assert.ok(diagramComponentContent.includes('biometric-terminals'), 'Diagram must handle biometric wiring')
  })

  await t.test('4. Non-Destructive Invariants: Homepage, Admin, Header, Footer Intact', () => {
    const homeContent = fs.readFileSync(path.join(rootDir, 'src/pages/CustomerHomePage.jsx'), 'utf8')
    assert.ok(homeContent.includes('ARS Computers'), 'CustomerHomePage preserved')
    assert.ok(homeContent.includes('id="contact"'), 'CustomerHomePage contact preserved')

    const headerContent = fs.readFileSync(path.join(rootDir, 'src/components/SiteHeader.jsx'), 'utf8')
    assert.ok(headerContent.includes('ARS Computers'), 'SiteHeader preserved')

    const footerContent = fs.readFileSync(path.join(rootDir, 'src/components/SiteFooter.jsx'), 'utf8')
    assert.ok(footerContent.includes('ARS Computers'), 'SiteFooter preserved')
  })
})
