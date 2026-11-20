/**
 * ARS Computers — Automated Product Variant Enrichment & WhatsApp Selection Test Suite
 *
 * Verifies that the production enrichment function `enrichProductWithVariants`
 * correctly attaches variant families and options to products fetched from the database,
 * and confirms that all 13 variant families (35 total options) support variant
 * selection, image switching, specification resolution, and WhatsApp URL generation.
 *
 * Covers:
 * 1. Category matching by ID, slug, and title.
 * 2. Empty database image fallback to PRODUCT_IMAGES.
 * 3. Strict preservation of existing database attributes.
 * 4. All 13 variant families and 35 variant options.
 *
 * Execution: node --test test/product-variants.test.js
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

// Register the project's official test asset loader before importing catalog modules
register('./asset-loader.js', import.meta.url)

const { enrichProductWithVariants, PRODUCT_SLUG_ALIASES } = await import('../src/lib/catalog.js')
const { CATEGORIES } = await import('../src/data/categories.js')
const { PRODUCT_IMAGES } = await import('../src/data/productImages.js')
const { buildProductWhatsAppUrl, WHATSAPP_BUSINESS_NUMBER } = await import('../src/lib/whatsappPurchase.js')

describe('Production Variant Enrichment Helper (src/lib/catalog.js)', () => {
  const accessoriesCat = CATEGORIES.find((c) => c.id === 'accessories')
  assert.ok(accessoriesCat, 'Accessories category must exist in CATEGORIES')

  const variantFamilies = (accessoriesCat.products || []).filter(
    (p) => Array.isArray(p.variants) && p.variants.length > 0
  )

  test('detects exactly 13 variant families and 35 total options in static catalog', () => {
    assert.equal(variantFamilies.length, 13, 'Expected exactly 13 variant families')
    const totalOptions = variantFamilies.reduce((sum, f) => sum + f.variants.length, 0)
    assert.equal(totalOptions, 35, 'Expected exactly 35 variant options across all families')
  })

  test('non-variant product returns null variants and leaves fields untouched', () => {
    const rawDbProduct = {
      id: 'mock-non-variant-uuid',
      slug: 'terabyte-usb-2-0-to-rj45-lan-adapter',
      name: 'Terabyte High-Speed USB 2.0 to Fast Ethernet 10/100M RJ45 Network LAN Adapter',
      categoryId: 'accessories',
      images: []
    }

    const enriched = enrichProductWithVariants(rawDbProduct)
    assert.equal(enriched.variants, null)
    assert.equal(enriched.variantSelectorLabel, null)
    assert.equal(enriched.variantType, null)
  })

  test('empty database image fallback resolves through PRODUCT_IMAGES', () => {
    const rawDbProductWithEmptyImages = {
      id: 'db-item-empty-images',
      slug: 'standard-male-to-male-hdmi-cable',
      name: 'Standard High-Speed HDMI Male-to-Male Cable',
      categoryId: 'accessories',
      images: [] // database holds empty array
    }

    const enriched = enrichProductWithVariants(rawDbProductWithEmptyImages)
    assert.ok(Array.isArray(enriched.images) && enriched.images.length > 0, 'images should fall back to PRODUCT_IMAGES')
    assert.equal(enriched.images.length, (PRODUCT_IMAGES['standard-male-to-male-hdmi-cable'] || []).length)
    assert.ok(enriched.variants[0].image, 'variant option must have a resolved image')
  })

  test('preserves valid database metadata (pricing, custom sku, timestamps, admin notes)', () => {
    const rawDbProduct = {
      id: 'db-custom-uuid-001',
      slug: 'standard-male-to-male-hdmi-cable',
      name: 'Standard High-Speed HDMI Male-to-Male Cable',
      categoryId: 'accessories',
      price: 249.00,
      sku: 'STORE-HDMI-001',
      cost_price: 150.00,
      stock_quantity: 12,
      min_stock_alert: 3,
      availability_status: 'in_stock',
      admin_notes: 'Verified shelf location Bin B4',
      created_at: '2026-10-20T10:00:00Z',
      images: ['/custom-showroom-image.jpg']
    }

    const enriched = enrichProductWithVariants(rawDbProduct)
    assert.equal(enriched.id, 'db-custom-uuid-001')
    assert.equal(enriched.price, 249.00)
    assert.equal(enriched.sku, 'STORE-HDMI-001')
    assert.equal(enriched.cost_price, 150.00)
    assert.equal(enriched.stock_quantity, 12)
    assert.equal(enriched.min_stock_alert, 3)
    assert.equal(enriched.availability_status, 'in_stock')
    assert.equal(enriched.admin_notes, 'Verified shelf location Bin B4')
    assert.equal(enriched.created_at, '2026-10-20T10:00:00Z')
    assert.deepEqual(enriched.images, ['/custom-showroom-image.jpg'], 'Custom database images must not be wiped out')
  })

  test('resolves category matching across id, slug, and categoryTitle', () => {
    const testCases = [
      { categoryId: 'accessories' },
      { categoryId: 'Accessories' },
      { categoryTitle: 'Accessories' }
    ]

    for (const tc of testCases) {
      const prod = {
        slug: 'adnet-ad-001-laptop-power-cable',
        name: 'ADNet 3-Pin Laptop Power Cable (AD-001)',
        ...tc
      }
      const enriched = enrichProductWithVariants(prod)
      assert.ok(Array.isArray(enriched.variants), `Failed to match category for ${JSON.stringify(tc)}`)
      assert.equal(enriched.variants.length, 2)
    }
  })

  test('null or invalid input handled safely without exceptions', () => {
    assert.equal(enrichProductWithVariants(null), null)
    assert.equal(enrichProductWithVariants(undefined), undefined)
    assert.deepEqual(enrichProductWithVariants('not-an-object'), 'not-an-object')
  })

  // Test all 13 variant families and their 35 options through the real production helper
  for (const family of variantFamilies) {
    describe(`Variant Family: ${family.name} (${family.slug})`, () => {
      const rawDbProduct = {
        id: `mock-uuid-${family.slug}`,
        slug: family.slug,
        name: family.name,
        categoryId: 'accessories',
        categoryTitle: 'Accessories',
        images: PRODUCT_IMAGES[family.slug] || []
      }

      // CALL ACTUAL PRODUCTION HELPER
      const enriched = enrichProductWithVariants(rawDbProduct)

      test('enriches database product with exact manifest label, type, and options count', () => {
        assert.ok(Array.isArray(enriched.variants), 'variants must be an array')
        assert.equal(enriched.variants.length, family.variants.length)
        assert.equal(enriched.variantSelectorLabel, family.variantSelectorLabel)
        assert.equal(enriched.variantType, family.variantType)
      })

      for (let i = 0; i < family.variants.length; i++) {
        const option = family.variants[i]
        const enrichedOption = enriched.variants[i]

        test(`Option [${option.label}]: resolves image, specification, and WhatsApp URL`, () => {
          assert.equal(enrichedOption.id, option.id)
          assert.equal(enrichedOption.label, option.label)
          assert.equal(enrichedOption.spec, option.spec)

          // Verify image resolution
          const expectedImageIndex = typeof option.imageIndex === 'number' ? option.imageIndex : 0
          assert.equal(enrichedOption.imageIndex, expectedImageIndex)
          if (enriched.images.length > expectedImageIndex) {
            assert.equal(enrichedOption.image, enriched.images[expectedImageIndex])
          }

          // Build WhatsApp Enquiry URL with active variant selected
          const productWithActiveVariant = {
            ...enriched,
            selectedVariant: enrichedOption
          }

          const whatsappUrl = buildProductWhatsAppUrl({
            product: productWithActiveVariant,
            baseUrl: 'https://arscomputer.com'
          })

          assert.ok(whatsappUrl.startsWith(`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=`))
          const decodedText = decodeURIComponent(whatsappUrl.split('?text=')[1])

          // WhatsApp text must contain product name, product link, and the selected variant label
          assert.ok(decodedText.includes(family.name), 'WhatsApp message must include product name')
          assert.ok(decodedText.includes(option.label), `WhatsApp message must include variant option label: ${option.label}`)
          assert.ok(decodedText.includes(`https://arscomputer.com/products/${family.slug}`), 'WhatsApp message must include product link')
        })
      }
    })
  }

  describe('Product Slug Aliases & Legacy URLs', () => {
    test('PRODUCT_SLUG_ALIASES maps legacy cat6 10m cable to grey patch cable with 10m default', () => {
      const alias = PRODUCT_SLUG_ALIASES['cat6-rj45-gigabit-network-cable-10m']
      assert.ok(alias, 'Legacy alias cat6-rj45-gigabit-network-cable-10m must exist')
      assert.equal(alias.targetSlug, 'cat6-rj45-gigabit-ethernet-patch-cable-grey')
      assert.equal(alias.defaultVariantId, '10m')

      // Ensure the target product exists in static catalog and actually has the 10m variant
      const targetFamily = variantFamilies.find((f) => f.slug === alias.targetSlug)
      assert.ok(targetFamily, 'Aliased target slug must exist as a valid variant family')
      const targetOption = targetFamily.variants.find((v) => v.id === alias.defaultVariantId)
      assert.ok(targetOption, 'Aliased default variant id must match a real option in the target family')
      assert.equal(targetOption.label, '10m')
    })

    test('enrichProductWithVariants enriches aliased target family with valid 10m option', () => {
      const alias = PRODUCT_SLUG_ALIASES['cat6-rj45-gigabit-network-cable-10m']
      const targetFamily = variantFamilies.find((f) => f.slug === alias.targetSlug)
      const rawDbProduct = {
        id: 'mock-target-uuid',
        slug: targetFamily.slug,
        name: targetFamily.name,
        categoryId: 'accessories',
        images: PRODUCT_IMAGES[targetFamily.slug] || []
      }

      const enriched = enrichProductWithVariants(rawDbProduct)
      assert.equal(enriched.slug, 'cat6-rj45-gigabit-ethernet-patch-cable-grey')
      assert.equal(enriched.variants.length, 4)
      const option10m = enriched.variants.find((v) => v.id === alias.defaultVariantId)
      assert.ok(option10m, 'Must find 10m option')
      assert.equal(option10m.imageIndex, 3)
      assert.equal(option10m.image, PRODUCT_IMAGES['cat6-rj45-gigabit-ethernet-patch-cable-grey'][3])
    })
  })
})
