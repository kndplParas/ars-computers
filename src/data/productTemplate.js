/**
 * ARS Computers — Real Product Catalogue Schema Specification & Validator
 *
 * PURPOSE:
 * Defines the canonical contract for real, physical computer hardware items.
 * Distinguishes between generic solution offerings (isGeneric: true) and
 * verified OEM products with actual part numbers, brands, and warranties (isGeneric: false).
 *
 * CRITICAL SECURITY INVARIANT:
 * `cost_price` is an internal administrative field. It must NEVER be included
 * in public queries or returned to anonymous/customer clients.
 */

export const VALID_AVAILABILITY_STATUSES = [
  'in_stock',
  'out_of_stock',
  'on_demand',
  'discontinued'
]

/**
 * Empty starter template for onboarding a real hardware product.
 * Unverified fields start as null or default values.
 */
export const BLANK_PRODUCT_TEMPLATE = Object.freeze({
  category_id: null,
  category_slug: null,
  name: '',
  slug: '',
  sku: null,
  brand: null,
  model: null,
  spec_summary: '',
  spec_attributes: {},
  price: null,
  cost_price: null, // Private / admin only
  stock_quantity: 0,
  min_stock_alert: 2,
  is_featured: false,
  is_active: true,
  is_generic: false,
  warranty_text: null,
  hsn_code: null,
  availability_status: 'on_demand',
  images: []
})

/**
 * Validates a candidate product object before insertion into the database or catalogue.
 *
 * @param {Object} product
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProductPayload(product) {
  const errors = []

  if (!product || typeof product !== 'object') {
    return { valid: false, errors: ['Product payload must be an object.'] }
  }

  // 1. Name validation
  if (!product.name || typeof product.name !== 'string' || product.name.trim().length < 3) {
    errors.push('Product name is required (at least 3 characters).')
  }

  // 2. Slug validation
  if (!product.slug || typeof product.slug !== 'string' || !/^[a-z0-9-]+$/.test(product.slug)) {
    errors.push('Product slug must be non-empty and contain only lowercase letters, numbers, and hyphens.')
  }

  // 3. Category validation
  if (!product.category_id && !product.category_slug) {
    errors.push('Product must be assigned to a valid category (category_id or category_slug required).')
  }

  // 4. Distinction between Generic and Real Products
  if (product.is_generic === false) {
    if (!product.brand || typeof product.brand !== 'string' || product.brand.trim().length < 2) {
      errors.push('Real products (is_generic: false) must have a verified manufacturer Brand (e.g. Dell, HP, Hikvision).')
    }
    if (!product.model || typeof product.model !== 'string' || product.model.trim().length < 1) {
      errors.push('Real products (is_generic: false) must specify an OEM Model number or series.')
    }
  }

  // 5. Price validation
  if (product.price !== null && product.price !== undefined) {
    const numPrice = Number(product.price)
    if (isNaN(numPrice) || numPrice < 0) {
      errors.push('Price must be a valid non-negative number, or null for quote-based pricing.')
    }
  }

  // 6. Cost Price validation (private)
  if (product.cost_price !== null && product.cost_price !== undefined) {
    const numCost = Number(product.cost_price)
    if (isNaN(numCost) || numCost < 0) {
      errors.push('Cost price must be a valid non-negative number, or null.')
    }
  }

  // 7. Stock quantity validation
  if (typeof product.stock_quantity === 'number' && product.stock_quantity < 0) {
    errors.push('Stock quantity cannot be negative.')
  }

  // 8. Availability status validation
  if (product.availability_status && !VALID_AVAILABILITY_STATUSES.includes(product.availability_status)) {
    errors.push(`Availability status must be one of: ${VALID_AVAILABILITY_STATUSES.join(', ')}.`)
  }

  // 9. Images validation
  if (product.images && !Array.isArray(product.images)) {
    errors.push('Images must be an array of image URL strings.')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
