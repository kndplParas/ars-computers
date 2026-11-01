/**
 * ============================================================================
 * ARS Computers — Aadhaar Formatter & Validation Utility
 * ============================================================================
 * Handles normalization, validation, and display formatting for employee
 * Aadhaar identification numbers.
 *
 * Requirements:
 * - Exactly 12 numeric digits.
 * - Spaces and hyphens accepted in user input and stripped deterministically.
 * - Display format in authorized internal UI: "1234 5678 9012".
 * - Customer-facing masked format: "XXXX XXXX 9012" (first 8 digits masked).
 * ============================================================================
 */

/**
 * Normalizes user input by stripping all whitespace and hyphens.
 * Returns null if the result is empty or not provided.
 *
 * @param {string|number|null|undefined} val
 * @returns {string|null}
 */
export function normalizeAadhaar(val) {
  if (val === null || val === undefined) return null
  const str = String(val).trim().replace(/[\s-]/g, '')
  return str.length > 0 ? str : null
}

/**
 * Validates whether an Aadhaar number contains exactly 12 numeric digits.
 *
 * @param {string|number|null|undefined} val
 * @returns {boolean}
 */
export function validateAadhaar(val) {
  const normalized = normalizeAadhaar(val)
  if (!normalized) return false
  return /^[0-9]{12}$/.test(normalized)
}

/**
 * Formats a normalized 12-digit Aadhaar number for authorized internal staff UI display:
 * "1234 5678 9012"
 *
 * If invalid or empty, returns fallback text (default: "—").
 *
 * @param {string|number|null|undefined} val
 * @param {string} [fallback='—']
 * @returns {string}
 */
export function formatAadhaarDisplay(val, fallback = '—') {
  const normalized = normalizeAadhaar(val)
  if (!normalized || !/^[0-9]{12}$/.test(normalized)) {
    return fallback
  }
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 8)} ${normalized.slice(8, 12)}`
}

/**
 * Formats a 12-digit Aadhaar number with the first 8 digits strictly masked
 * for customer-facing communication, previews, and dispatch:
 * "XXXX XXXX 9012"
 *
 * If invalid or empty, returns fallback text (default: 'Not Provided').
 *
 * @param {string|number|null|undefined} val
 * @param {string} [fallback='Not Provided']
 * @returns {string}
 */
export function formatAadhaarMasked(val, fallback = 'Not Provided') {
  const normalized = normalizeAadhaar(val)
  if (!normalized || !/^[0-9]{12}$/.test(normalized)) {
    return fallback
  }
  return `XXXX XXXX ${normalized.slice(8, 12)}`
}
