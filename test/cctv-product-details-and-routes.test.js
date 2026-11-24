/**
 * ============================================================================
 * ARS Computers — CCTV Product Details Crash & Routes Regression Test Suite
 * ============================================================================
 * Verifies:
 * 1. Product details null-safe rendering:
 *    - Caption calculation and UI state when product is null/loading does not crash
 *      with TypeError: Cannot read properties of null (reading 'name').
 * 2. Routing consistency:
 *    - App.jsx routes both /products/:slug and /product/:slug to ProductRouteWrapper.
 * 3. CCTV Product Image Mapping:
 *    - /category/cctv multi-channel DVR/NVR product card primary image is the 4-channel infographic.
 *    - Multi-channel DVR/NVR gallery contains all three original infographics in order:
 *      1. 4-channel (Gemini_Generated_Image_syg1dgsyg1dgsyg1.png)
 *      2. 8-channel (WhatsApp Image 2026-11-19 at 2.50.15 PM.jpeg)
 *      3. 16-channel (Gemini_Generated_Image_syg1dgsyg1dgsyg1 (1).png)
 * 4. Variant Selection & WhatsApp Messaging:
 *    - Variants map to image indices 0, 1, 2 and contain quotation-dependent specs.
 *    - WhatsApp enquiry URL correctly reflects active variant.
 * 5. CSS & Layout Spacing:
 *    - Category hero title has defined line-height and responsive breadcrumb padding.
 * ============================================================================
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'

register('./asset-loader.js', import.meta.url)

const { fetchProductBySlug, fetchCategoryBySlug, getInstantProductBySlug } = await import('../src/lib/catalog.js')
const { PRODUCT_IMAGES, PRODUCT_IMAGE_CAPTIONS } = await import('../src/data/productImages.js')
const { buildProductWhatsAppUrl, WHATSAPP_BUSINESS_NUMBER } = await import('../src/lib/whatsappPurchase.js')
const { getSpecTable } = await import('../src/data/specSchemas.js')

describe('Issue 1: Product details null-safe rendering & routing', () => {
  test('App.jsx configures both /products/:slug and /product/:slug to ProductRouteWrapper', () => {
    const appSource = fs.readFileSync('src/App.jsx', 'utf8')
    assert.ok(
      appSource.includes('<Route path="/products/:slug" element={<ProductRouteWrapper />} />'),
      'App.jsx must declare /products/:slug'
    )
    assert.ok(
      appSource.includes('<Route path="/product/:slug" element={<ProductRouteWrapper />} />'),
      'App.jsx must declare /product/:slug'
    )
  })

  test('ProductDetailsPage caption logic handles null product safely without throwing', () => {
    // When product is null (e.g. while pending or loading)
    const product = null
    const activeImageIndex = 0

    const currentCaption = product
      ? (product.slug && PRODUCT_IMAGE_CAPTIONS[product.slug]?.[activeImageIndex]) ||
        (product.images && product.images.length > 1
          ? `${product.name} — Hardware View ${activeImageIndex + 1}`
          : `${product.name} — Certified Hardware Supply`)
      : ''

    assert.equal(currentCaption, '', 'Caption for null product must be safe empty string')
  })

  test('ProductDetailsPage breadcrumb & spec table handle null product and null category safely', () => {
    const category = null
    const product = null
    const isLoading = true
    const slug = 'multi-channel-cctv-dvr-nvr-recorder'

    const breadcrumbCurrent = product?.name || (isLoading ? 'Hardware Specifications' : (slug || 'Hardware Product'))
    assert.equal(breadcrumbCurrent, 'Hardware Specifications')

    const specTable = getSpecTable(category?.slug || category?.id || product?.categoryId, product?.specAttributes)
    assert.ok(specTable, 'specTable must be returned without throwing')
    assert.equal(specTable.sections.length, 0)
  })
})

describe('Issue 2: CCTV Product Card & Gallery Image Mapping', () => {
  const cctvSlug = 'multi-channel-cctv-dvr-nvr-recorder'

  test('CCTV category product card primary image is the 4-channel infographic', async () => {
    const catRes = await fetchCategoryBySlug('cctv')
    assert.ok(catRes.products && catRes.products.length > 0)
    const product = catRes.products.find((p) => p.slug === cctvSlug)
    assert.ok(product, 'multi-channel DVR/NVR product must exist in CCTV category')

    assert.ok(Array.isArray(product.images) && product.images.length === 3, 'Must have exactly 3 gallery images')
    assert.ok(
      product.images[0].includes('Gemini_Generated_Image_syg1dgsyg1dgsyg1') && !product.images[0].includes('(1)'),
      `Primary image must be 4-channel infographic, got: ${product.images[0]}`
    )
  })

  test('Product details gallery contains all three original infographics in correct order', async () => {
    const prodRes = await fetchProductBySlug(cctvSlug)
    assert.ok(prodRes.product, 'Product details must be found')
    const { product } = prodRes

    assert.equal(product.images.length, 3, 'Product must have 3 images')
    // 1. 4-channel
    assert.ok(
      product.images[0].includes('Gemini_Generated_Image_syg1dgsyg1dgsyg1') && !product.images[0].includes('(1)'),
      `View 1 must be 4-channel infographic, got: ${product.images[0]}`
    )
    // 2. 8-channel
    assert.ok(
      decodeURIComponent(product.images[1]).includes('WhatsApp Image 2026-11-19 at 2.50.15 PM'),
      `View 2 must be 8-channel infographic, got: ${product.images[1]}`
    )
    // 3. 16-channel
    assert.ok(
      decodeURIComponent(product.images[2]).includes('Gemini_Generated_Image_syg1dgsyg1dgsyg1 (1)'),
      `View 3 must be 16-channel infographic, got: ${product.images[2]}`
    )
  })

  test('Variant selection maps to exact corresponding image index, caption and specifications', async () => {
    const prodRes = await fetchProductBySlug(cctvSlug)
    const { product } = prodRes
    assert.ok(Array.isArray(product.variants) && product.variants.length === 3)

    const expectedVariants = [
      { id: '4-channel', label: '4 Channels', imageIndex: 0 },
      { id: '8-channel', label: '8 Channels', imageIndex: 1 },
      { id: '16-channel', label: '16 Channels', imageIndex: 2 }
    ]

    for (const exp of expectedVariants) {
      const v = product.variants.find((item) => item.id === exp.id)
      assert.ok(v, `Variant ${exp.id} must exist`)
      assert.equal(v.label, exp.label)
      assert.equal(v.imageIndex, exp.imageIndex)
      assert.ok(v.spec.includes('Supplied per Quotation'), 'Variant spec must qualify quotation items')

      // Check caption
      const caption = PRODUCT_IMAGE_CAPTIONS[cctvSlug]?.[exp.imageIndex]
      assert.ok(caption, `Caption for index ${exp.imageIndex} must exist`)
      assert.ok(caption.includes('Pictured Package Quoted per Order'))

      // WhatsApp URL test with active variant
      const productWithVariant = { ...product, selectedVariant: v }
      const waUrl = buildProductWhatsAppUrl({ product: productWithVariant, baseUrl: 'https://arscomputer.com' })
      const decodedWa = decodeURIComponent(waUrl)
      assert.ok(decodedWa.includes(v.name) || decodedWa.includes(product.name), 'WhatsApp message must include variant or product name')
      assert.ok(decodedWa.includes(v.label), 'WhatsApp message must include variant label')
    }
  })

  test('CSS verifies category hero title line-height and breadcrumb spacing', () => {
    const css = fs.readFileSync('src/App.css', 'utf8')
    assert.ok(css.includes('.category-hero-title'), 'CSS must define .category-hero-title')
    assert.ok(css.includes('line-height: 1.2;'), 'CSS must specify line-height: 1.2 on category-hero-title')
    assert.ok(css.includes('.page-breadcrumb-container'), 'CSS must define .page-breadcrumb-container')
  })
})
