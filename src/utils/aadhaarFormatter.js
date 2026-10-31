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
 * - Display format in authorized UI: "1234 5678 9012".
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
 * Formats a normalized 12-digit Aadhaar number for authorized UI display:
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

