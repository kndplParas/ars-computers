/**
 * ARS Computers — WhatsApp Purchase Enquiry Test Suite
 *
 * Verifies the WhatsApp number, single- and multi-product message content,
 * optional catalogue fields, URL encoding, coverage of every catalogue
 * category, future admin-added products, and the additive page integration.
 * No network requests or real messages are made.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_APP_BASE_URL,
  WHATSAPP_BUSINESS_NUMBER,
  WHATSAPP_DISPLAY_NUMBER,
  buildMultiProductWhatsAppMessage,
  buildMultiProductWhatsAppUrl,
  buildProductUrl,
  buildProductWhatsAppMessage,
  buildProductWhatsAppUrl,
  buildWhatsAppUrl,
  getProductBrandModel,
  getProductCategoryLabel,
  getProductDisplayName,
  getProductReference
} from '../src/lib/whatsappPurchase.js'
import { getSelectionKey } from '../src/lib/useProductSelection.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const CATALOG_PATH = path.join(projectRoot, 'src', 'data', 'categories.js')
const CATEGORY_PAGE_PATH = path.join(projectRoot, 'src', 'pages', 'CategoryPage.jsx')
const SEARCH_PAGE_PATH = path.join(projectRoot, 'src', 'pages', 'SearchResultsPage.jsx')
const DETAILS_PAGE_PATH = path.join(projectRoot, 'src', 'pages', 'ProductDetailsPage.jsx')
const BUTTON_PATH = path.join(projectRoot, 'src', 'components', 'WhatsAppButton.jsx')
const SELECTION_BAR_PATH = path.join(projectRoot, 'src', 'components', 'WhatsAppSelectionBar.jsx')
const SELECTION_HOOK_PATH = path.join(projectRoot, 'src', 'lib', 'useProductSelection.js')
const CSS_PATH = path.join(projectRoot, 'src', 'App.css')

const EXPECTED_CATEGORIES = [
  { id: 'computer-laptop', title: 'Computer / Laptop' },
  { id: 'cctv', title: 'CCTV' },
  { id: 'printer', title: 'Printer' },
  { id: 'biometric-machine', title: 'Biometric Machine' },
  { id: 'accessories', title: 'Accessories' }
]

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

/** Scans a JS source string and returns the text of the balanced `{...}` object. */
function readBalancedObject(source, objectStart) {
  let depth = 0
  let inString = false
  let quote = null
  let escaped = false

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        inString = false
      }
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = true
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(objectStart, index + 1)
    }
  }

  return ''
}

/** Returns the end index of the balanced `[...]` array. */
function readBalancedArray(source, arrayStart) {
  let depth = 0
  let inString = false
  let quote = null
  let escaped = false

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        inString = false
      }
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = true
      quote = char
      continue
    }

    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return source.length
}

function readField(objectSource, fieldName) {
  const match = objectSource.match(new RegExp(`${fieldName}:\\s*'((?:\\\\.|[^'\\\\])*)'`))
  return match ? match[1].replace(/\\'/g, "'") : ''
}

/**
 * Extracts the real category blocks and their product objects from the static
 * catalogue source without importing image assets (which Node cannot load).
 */
function readCatalogueSource() {
  const source = read(CATALOG_PATH)
  const categoryMatches = [...source.matchAll(/^ {4}id: '([^']+)',$/gm)]

  return categoryMatches.map((match, index) => {
    const start = match.index
    const end = index + 1 < categoryMatches.length ? categoryMatches[index + 1].index : source.length
    const block = source.slice(start, end)
    const productsStart = block.indexOf('products: [')
    const products = []

    if (productsStart !== -1) {
      let cursor = block.indexOf('[', productsStart)
      const productsEnd = readBalancedArray(block, cursor)
      while (cursor !== -1 && cursor < productsEnd) {
        const objectStart = block.indexOf('{', cursor)
        if (objectStart === -1 || objectStart > productsEnd) break

        const objectSource = readBalancedObject(block, objectStart)
        if (!objectSource) break

        const productSlug = readField(objectSource, 'slug')
        const productName = readField(objectSource, 'name')
        if (productSlug && productName) {
          products.push({
            slug: productSlug,
            name: productName,
            brand: readField(objectSource, 'brand'),
            model: readField(objectSource, 'model'),
            id: '',
            sku: '',
            categoryTitle: readField(block, 'title'),
            categoryId: match[1]
          })
        }

        cursor = block.indexOf('{', objectStart + objectSource.length)
        if (cursor === -1 || cursor > productsEnd) break
      }
    }

    return {
      id: match[1],
      slug: readField(block, 'slug'),
      title: readField(block, 'title'),
      products
    }
  })
}

const CATALOGUE = readCatalogueSource()

function firstProductFor(categoryId) {
  const category = CATALOGUE.find((entry) => entry.id === categoryId)
  assert.ok(category, `Catalogue category ${categoryId} should exist`)
  assert.ok(category.products.length > 0, `Catalogue category ${categoryId} should have products`)
  return category.products[0]
}

describe('WhatsApp number and base URL', () => {
  test('uses the ARS Computers WhatsApp number in international format', () => {
    assert.equal(WHATSAPP_BUSINESS_NUMBER, '917078382213')
    assert.equal(WHATSAPP_DISPLAY_NUMBER, '+91 7078382213')
    assert.equal(DEFAULT_APP_BASE_URL, 'https://arscomputer.com')
  })

  test('wa.me links always target the configured business number', () => {
    assert.equal(buildWhatsAppUrl(''), `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}`)
    assert.match(
      buildWhatsAppUrl('Hello'),
      new RegExp(`^https://wa\\.me/${WHATSAPP_BUSINESS_NUMBER}\\?text=`)
    )
  })
})

describe('Single-product enquiry message', () => {
  const product = {
    id: 'prd-001',
    sku: 'ARS-LAP-001',
    slug: 'dell-latitude-business-laptop',
    name: 'Dell Latitude Business Laptop',
    rawName: 'Dell Latitude Business Laptop',
    brand: 'Dell',
    model: 'Latitude Series',
    categoryTitle: 'Computer / Laptop',
    categoryId: 'computer-laptop',
    price: 54999,
    stock: 7
  }

  test('contains the required professional enquiry fields', () => {
    const message = buildProductWhatsAppMessage({ product })

    assert.match(message, /^Hello ARS Computers,/)
    assert.match(message, /I am interested in purchasing the following product:/)
    assert.match(message, /Product: Dell Latitude Business Laptop/)
    assert.match(message, /Product ID: ARS-LAP-001/)
    assert.match(message, /Category: Computer \/ Laptop/)
    assert.match(message, /Brand\/Model: Dell \/ Latitude Series/)
    assert.match(message, /Quantity: 1/)
    assert.match(message, /Product Link: https:\/\/arscomputer\.com\/products\/dell-latitude-business-laptop/)
    assert.match(message, /Please share the latest price, availability and purchase details\./)
    assert.match(message, /My additional requirements:/)
    assert.match(message, /\[Customer can type here\]/)
    assert.match(message, /Thank you\.$/)
  })

  test('does not invent or expose pricing, stock, order, or payment claims', () => {
    const message = buildProductWhatsAppMessage({ product })

    assert.doesNotMatch(message, /54999|54,999/)
    assert.doesNotMatch(message, /In Stock|stock quantity/i)
    assert.doesNotMatch(message, /order (?:is )?confirmed|payment (?:is )?completed|paid/i)
  })

  test('falls back to id when SKU is absent and reads category from category data', () => {
    const message = buildProductWhatsAppMessage({
      product: { ...product, sku: '', categoryTitle: '' },
      category: { title: 'CCTV', slug: 'cctv', id: 'cctv' }
    })

    assert.match(message, /Product ID: prd-001/)
    assert.match(message, /Category: CCTV/)
  })

  test('omits optional fields instead of inventing values', () => {
    const message = buildProductWhatsAppMessage({
      product: {
        name: 'Generic Accessory',
        slug: 'generic-accessory'
      }
    })

    assert.match(message, /Product: Generic Accessory/)
    assert.match(message, /Product Link: https:\/\/arscomputer\.com\/products\/generic-accessory/)
    assert.doesNotMatch(message, /Product ID:/)
    assert.doesNotMatch(message, /Brand\/Model:/)
  })

  test('returns no message and no text parameter without a product', () => {
    assert.equal(buildProductWhatsAppMessage({}), '')
    assert.equal(buildProductWhatsAppMessage(), '')
    assert.equal(buildProductWhatsAppUrl({}), `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}`)
  })
})

describe('Multiple-product enquiry message', () => {
  const selected = [
    {
      slug: 'hikvision-full-hd-dome-camera',
      name: 'Hikvision Full HD Dome Camera',
      sku: 'ARS-CCTV-001',
      brand: 'Hikvision',
      categoryTitle: 'CCTV'
    },
    {
      slug: 'epson-ecotank-ink-tank-printer',
      name: 'Epson EcoTank Ink Tank Printer',
      sku: 'ARS-PRN-001',
      brand: 'Epson',
      categoryTitle: 'Printer'
    },
    {
      slug: 'hikvision-minmoe-face-terminal',
      name: 'Hikvision MinMoe Face Terminal',
      sku: 'ARS-BIO-001',
      brand: 'Hikvision',
      categoryTitle: 'Biometric Machine'
    }
  ]

  test('numbers every selected product and keeps all details in one message', () => {
    const message = buildMultiProductWhatsAppMessage({ products: selected })

    assert.match(message, /I am interested in purchasing the following products:/)
    assert.match(message, /1\. Product: Hikvision Full HD Dome Camera/)
    assert.match(message, /2\. Product: Epson EcoTank Ink Tank Printer/)
    assert.match(message, /3\. Product: Hikvision MinMoe Face Terminal/)
    assert.match(message, /Product ID: ARS-CCTV-001/)
    assert.match(message, /Product ID: ARS-PRN-001/)
    assert.match(message, /Product ID: ARS-BIO-001/)
    assert.match(message, /Category: CCTV/)
    assert.match(message, /Category: Printer/)
    assert.match(message, /Category: Biometric Machine/)
    assert.match(message, /Product Link: https:\/\/arscomputer\.com\/products\/hikvision-full-hd-dome-camera/)
    assert.match(message, /Product Link: https:\/\/arscomputer\.com\/products\/epson-ecotank-ink-tank-printer/)
    assert.match(message, /Product Link: https:\/\/arscomputer\.com\/products\/hikvision-minmoe-face-terminal/)
    assert.equal((message.match(/Quantity: 1/g) || []).length, 3)
    assert.match(message, /purchase details for these items\./)
    assert.match(message, /Thank you\.$/)
  })

  test('handles empty and filtered input safely', () => {
    assert.equal(buildMultiProductWhatsAppMessage({ products: [] }), '')
    assert.equal(buildMultiProductWhatsAppMessage({ products: [null, undefined] }), '')
    assert.equal(buildMultiProductWhatsAppMessage(), '')
    assert.equal(buildMultiProductWhatsAppUrl({ products: [] }), `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}`)
  })

  test('selection keys are stable and prefer the product slug', () => {
    assert.equal(getSelectionKey({ slug: 'dell-laptop', id: '123' }), 'dell-laptop')
    assert.equal(getSelectionKey({ id: '123' }), '123')
    assert.equal(getSelectionKey({}), '')
    assert.equal(getSelectionKey(null), '')
  })
})

describe('Catalogue category coverage', () => {
  test('the static catalogue contains every expected category', () => {
    assert.deepEqual(
      CATALOGUE.map((category) => category.id),
      EXPECTED_CATEGORIES.map((category) => category.id)
    )
    for (const expected of EXPECTED_CATEGORIES) {
      const category = CATALOGUE.find((entry) => entry.id === expected.id)
      assert.equal(category.title, expected.title)
    }
  })

  for (const expected of EXPECTED_CATEGORIES) {
    test(`builds a valid WhatsApp enquiry for ${expected.title}`, () => {
      const product = firstProductFor(expected.id)
      const category = CATALOGUE.find((entry) => entry.id === expected.id)
      const message = buildProductWhatsAppMessage({ product, category })
      const url = buildProductWhatsAppUrl({ product, category })

      assert.match(message, new RegExp(`Product: ${escapeRegExp(product.name)}`))
      assert.match(message, new RegExp(`Category: ${escapeRegExp(expected.title)}`))
      assert.match(
        message,
        new RegExp(`Product Link: https://arscomputer\\.com/products/${escapeRegExp(product.slug)}`)
      )
      assert.equal(new URL(url).searchParams.get('text'), message)
    })
  }
})

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('Future admin-added products', () => {
  test('supports a product in a new category without catalogue changes', () => {
    const product = {
      id: '9f7c6b5a-0000-4000-8000-000000000001',
      sku: 'ARS-NET-9001',
      slug: 'managed-24-port-gigabit-switch',
      name: 'Managed 24-Port Gigabit Switch',
      rawName: 'Managed 24-Port Gigabit Switch',
      brand: 'TP-Link',
      model: 'TL-SG1024',
      categoryTitle: 'Networking',
      categoryId: 'networking'
    }

    const message = buildProductWhatsAppMessage({ product })

    assert.match(message, /Product: Managed 24-Port Gigabit Switch/)
    assert.match(message, /Product ID: ARS-NET-9001/)
    assert.match(message, /Category: Networking/)
    assert.match(message, /Brand\/Model: TP-Link \/ TL-SG1024/)
    assert.match(message, /Quantity: 1/)
    assert.match(
      message,
      /Product Link: https:\/\/arscomputer\.com\/products\/managed-24-port-gigabit-switch/
    )
  })

  test('uses real catalogue helpers for display name, reference, category, and brand', () => {
    const product = {
      id: 'fallback-id',
      slug: 'product-slug',
      name: 'Normalized Name',
      rawName: 'Original Admin Name',
      brand: 'Dell',
      model: 'Dell Latitude 5540',
      categoryTitle: 'Laptops'
    }

    assert.equal(getProductDisplayName(product), 'Original Admin Name')
    assert.equal(getProductDisplayName({ name: 'Normalized Name' }), 'Normalized Name')
    assert.equal(getProductReference(product), 'fallback-id')
    assert.equal(getProductReference({ id: 'id-only', sku: ' SKU-1 ' }), 'SKU-1')
    assert.equal(getProductCategoryLabel(product), 'Laptops')
    assert.equal(getProductCategoryLabel({}, { title: 'CCTV' }), 'CCTV')
    assert.equal(getProductCategoryLabel({ categoryId: 'accessories' }), 'accessories')
    assert.equal(getProductBrandModel(product), 'Dell Latitude 5540')
    assert.equal(getProductBrandModel({ brand: 'HP', model: 'ProBook' }), 'HP / ProBook')
    assert.equal(getProductBrandModel({ brand: 'HP' }), 'HP')
    assert.equal(getProductBrandModel({ model: 'Only Model' }), 'Only Model')
    assert.equal(getProductBrandModel({}), '')
  })

  test('builds product URLs from the live origin or a supplied base', () => {
    assert.equal(
      buildProductUrl({ slug: 'sample-product' }, 'https://arscomputer.com/'),
      'https://arscomputer.com/products/sample-product'
    )
    assert.equal(buildProductUrl({}, 'https://arscomputer.com'), 'https://arscomputer.com')
    assert.equal(buildProductUrl(null), 'https://arscomputer.com')
  })
})

describe('URL encoding', () => {
  test('encodes reserved characters, spaces, and newlines exactly once', () => {
    const product = {
      name: 'CCTV Camera & DVR / 4K #1',
      slug: 'cctv-camera',
      sku: 'SKU & 100%',
      brand: 'Brand / Co',
      categoryTitle: 'CCTV & Security'
    }
    const message = buildProductWhatsAppMessage({ product })
    const url = buildProductWhatsAppUrl({ product })

    assert.match(url, /^https:\/\/wa\.me\/917078382213\?text=/)
    assert.match(url, /%26/)
    assert.match(url, /%2F/)
    assert.match(url, /%23/)
    assert.match(url, /%20/)
    assert.doesNotMatch(url, /[\r\n ]/)
    assert.equal(new URL(url).searchParams.get('text'), message)
  })

  test('multi-product URLs round-trip through the text parameter', () => {
    const products = [
      { name: 'Product One & Two', slug: 'product-one', sku: 'A-1' },
      { name: 'Product/Three', slug: 'product-three', sku: 'A/2' }
    ]
    const message = buildMultiProductWhatsAppMessage({ products })
    const url = buildMultiProductWhatsAppUrl({ products })

    assert.equal(new URL(url).searchParams.get('text'), message)
    assert.match(message, /1\. Product: Product One & Two/)
    assert.match(message, /2\. Product: Product\/Three/)
  })
})

describe('Website integration', () => {
  test('category and search product cards render the WhatsApp CTA and selection tray', () => {
    for (const filePath of [CATEGORY_PAGE_PATH, SEARCH_PAGE_PATH]) {
      const source = read(filePath)
      assert.match(source, /import WhatsAppButton from '\.\.\/components\/WhatsAppButton'/)
      assert.match(source, /import WhatsAppSelectionBar from '\.\.\/components\/WhatsAppSelectionBar'/)
      assert.match(source, /useProductSelection/)
      assert.match(source, /<WhatsAppButton[\s\S]*?product=\{item\}/)
      assert.match(source, /<WhatsAppSelectionBar selected=\{selected\}/)
    }
  })

  test('product details page has the prominent CTA, disclaimer, and related-product links', () => {
    const source = read(DETAILS_PAGE_PATH)

    assert.match(source, /import WhatsAppButton from '\.\.\/components\/WhatsAppButton'/)
    assert.match(source, /<WhatsAppButton[\s\S]*?product=\{product\}[\s\S]*?category=\{category\}/)
    assert.match(source, /label="Buy on WhatsApp"/)
    assert.match(source, /No order is[\s\S]*?confirmed[\s\S]*?no payment is collected/)
    assert.match(source, /<WhatsAppButton[\s\S]*?product=\{item\}[\s\S]*?label="WhatsApp"/)
  })

  test('the reusable button opens a new tab with safe link attributes', () => {
    const source = read(BUTTON_PATH)

    assert.match(source, /buildProductWhatsAppUrl/)
    assert.match(source, /buildMultiProductWhatsAppUrl/)
    assert.match(source, /target="_blank"/)
    assert.match(source, /rel="noopener noreferrer"/)
    assert.match(source, /aria-label=\{accessibleName\}/)
    assert.match(source, /event\.stopPropagation\(\)/)
  })

  test('multi-product selection is session-scoped, capped, and not a checkout', () => {
    const hook = read(SELECTION_HOOK_PATH)
    const bar = read(SELECTION_BAR_PATH)

    assert.match(hook, /sessionStorage/)
    assert.match(hook, /MAX_SELECTION = 20/)
    assert.match(hook, /sanitizeSelectionEntry/)
    assert.doesNotMatch(hook, /localStorage/)
    assert.match(bar, /no order or payment is placed here/i)
    assert.match(bar, /<WhatsAppButton[\s\S]*?products=\{selected\}/)
  })

  test('WhatsApp styles are bright green, visible, and responsive', () => {
    const css = read(CSS_PATH)

    assert.match(css, /\.btn-whatsapp\s*\{/)
    assert.match(css, /#25d366/)
    assert.match(css, /\.whatsapp-card-btn/)
    assert.match(css, /\.whatsapp-detail-btn|\.product-cta-bar \.btn-whatsapp/)
    assert.match(css, /\.whatsapp-selection-bar/)
    assert.match(css, /@media \(max-width: 720px\)/)
  })
})
