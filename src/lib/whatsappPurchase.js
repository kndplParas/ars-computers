/**
 * ARS Computers — WhatsApp Purchase Enquiry Helpers
 *
 * Pure, client-safe helpers that build wa.me links from real catalogue data.
 * Messages never invent prices, stock, brands, models, or specifications.
 * WhatsApp is used only for purchase discussion and requirements; this module
 * never represents an enquiry as a confirmed order or completed payment.
 */

export const WHATSAPP_BUSINESS_NUMBER = '917078382213'
export const WHATSAPP_DISPLAY_NUMBER = '+91 7078382213'
export const DEFAULT_APP_BASE_URL = 'https://arscomputer.com'

function clean(value) {
  return String(value ?? '').trim()
}

function getProductSlug(product) {
  return clean(product?.slug)
}

export function getProductDisplayName(product) {
  return clean(product?.rawName) || clean(product?.name)
}

export function getProductReference(product) {
  return clean(product?.sku) || clean(product?.id)
}

export function getProductCategoryLabel(product, category = null) {
  return (
    clean(product?.categoryTitle) ||
    clean(category?.title) ||
    clean(category?.shortTitle) ||
    clean(product?.categoryId) ||
    clean(category?.slug) ||
    clean(category?.id)
  )
}

export function getProductBrandModel(product) {
  const brand = clean(product?.brand)
  const model = clean(product?.model)

  if (brand && model) {
    if (model.toLowerCase().includes(brand.toLowerCase())) return model
    return `${brand} / ${model}`
  }

  return brand || model
}

export function getAppBaseUrl() {
  if (typeof window !== 'undefined') {
    const origin = clean(window.location?.origin)
    if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, '')
  }

  return DEFAULT_APP_BASE_URL
}

export function buildProductUrl(product, baseUrl = DEFAULT_APP_BASE_URL) {
  const base = clean(baseUrl || DEFAULT_APP_BASE_URL).replace(/\/+$/, '')
  const slug = getProductSlug(product)

  return slug ? `${base}/products/${encodeURIComponent(slug)}` : base
}

function buildProductBlock(product, { category = null, baseUrl, quantity = 1, index = null } = {}) {
  const name = getProductDisplayName(product)
  const reference = getProductReference(product)
  const categoryLabel = getProductCategoryLabel(product, category)
  const brandModel = getProductBrandModel(product)
  const productUrl = buildProductUrl(product, baseUrl)
  const safeQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1)

  const lines = [
    index ? `${index}. Product: ${name}` : `Product: ${name}`
  ]

  if (reference) lines.push(`Product ID: ${reference}`)
  if (categoryLabel) lines.push(`Category: ${categoryLabel}`)
  if (brandModel) lines.push(`Brand/Model: ${brandModel}`)
  lines.push(`Quantity: ${safeQuantity}`)
  if (getProductSlug(product)) lines.push(`Product Link: ${productUrl}`)

  return lines.join('\n')
}

export function buildProductWhatsAppMessage({
  product,
  category = null,
  baseUrl = DEFAULT_APP_BASE_URL,
  quantity = 1
} = {}) {
  if (!product) return ''

  return [
    'Hello ARS Computers,',
    '',
    'I am interested in purchasing the following product:',
    '',
    buildProductBlock(product, { category, baseUrl, quantity }),
    '',
    'Please share the latest price, availability and purchase details.',
    '',
    'My additional requirements:',
    '[Customer can type here]',
    '',
    'Thank you.'
  ].join('\n')
}

export function buildMultiProductWhatsAppMessage({
  products = [],
  baseUrl = DEFAULT_APP_BASE_URL
} = {}) {
  const items = Array.isArray(products) ? products.filter(Boolean) : []
  if (items.length === 0) return ''

  const blocks = items.map((product, index) =>
    buildProductBlock(product, {
      category: product?.selectedCategory || null,
      baseUrl,
      quantity: 1,
      index: index + 1
    })
  )

  return [
    'Hello ARS Computers,',
    '',
    'I am interested in purchasing the following products:',
    '',
    blocks.join('\n\n'),
    '',
    'Please share the latest price, availability and purchase details for these items.',
    '',
    'My additional requirements:',
    '[Customer can type here]',
    '',
    'Thank you.'
  ].join('\n')
}

export function buildWhatsAppUrl(message) {
  const text = clean(message)
  const suffix = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}${suffix}`
}

export function buildProductWhatsAppUrl(options = {}) {
  return buildWhatsAppUrl(buildProductWhatsAppMessage(options))
}

export function buildMultiProductWhatsAppUrl(options = {}) {
  return buildWhatsAppUrl(buildMultiProductWhatsAppMessage(options))
}
