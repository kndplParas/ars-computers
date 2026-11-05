/**
 * ARS Computers — Product content registry.
 *
 * Merges the category-specific content modules into a single lookup used by
 * the public catalogue fallback and by the seed migration generator. Each
 * entry carries honest, product-specific content: either manufacturer-backed
 * details or clearly labelled configuration-dependent information.
 */

import { COMPUTER_CONTENT } from './product-content/computers.js'
import { CCTV_CONTENT } from './product-content/cctv.js'
import { PRINTER_CONTENT } from './product-content/printers.js'
import { BIOMETRIC_CONTENT } from './product-content/biometrics.js'
import { ACCESSORY_CORE_CONTENT } from './product-content/accessories-core.js'
import { ACCESSORY_PERIPHERAL_CONTENT } from './product-content/accessories-peripherals.js'
import { ACCESSORY_CABLE_CONTENT } from './product-content/accessories-cables.js'

const CONTENT_MODULES = [
  COMPUTER_CONTENT,
  CCTV_CONTENT,
  PRINTER_CONTENT,
  BIOMETRIC_CONTENT,
  ACCESSORY_CORE_CONTENT,
  ACCESSORY_PERIPHERAL_CONTENT,
  ACCESSORY_CABLE_CONTENT
]

export const PRODUCT_CONTENT = {}
for (const module of CONTENT_MODULES) {
  for (const [slug, content] of Object.entries(module)) {
    if (PRODUCT_CONTENT[slug]) {
      throw new Error(`Duplicate product content entry for slug: ${slug}`)
    }
    PRODUCT_CONTENT[slug] = content
  }
}

export const PRODUCT_CONTENT_SLUGS = Object.freeze(Object.keys(PRODUCT_CONTENT).sort())

export function getProductContent(slug) {
  if (!slug) return null
  return PRODUCT_CONTENT[String(slug).trim().toLowerCase()] || null
}

/**
 * Coverage statistics used by tests and the admin audit report.
 */
export function getProductContentStats() {
  const entries = Object.entries(PRODUCT_CONTENT)
  const verified = entries.filter(([, item]) => item.specsVerified === 'verified').length
  const partiallyVerified = entries.filter(([, item]) => item.specsVerified === 'partially_verified').length
  const configurationDependent = entries.filter(([, item]) => item.specsVerified === 'configuration_dependent').length

  return {
    total: entries.length,
    verified,
    partiallyVerified,
    configurationDependent,
    complete: verified + partiallyVerified,
    missing: 0
  }
}
