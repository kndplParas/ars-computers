import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'ars-whatsapp-product-selection-v1'
const MAX_SELECTION = 20

function clean(value) {
  return String(value ?? '').trim()
}

export function getSelectionKey(product) {
  return clean(product?.slug) || clean(product?.id)
}

function sanitizeSelectionEntry(product, category = null) {
  const key = getSelectionKey(product)
  const name = clean(product?.rawName) || clean(product?.name)

  if (!key || !name) return null

  return {
    id: clean(product?.id),
    slug: clean(product?.slug),
    sku: clean(product?.sku),
    name,
    rawName: name,
    brand: clean(product?.brand),
    model: clean(product?.model),
    categoryTitle:
      clean(product?.categoryTitle) ||
      clean(category?.title) ||
      clean(category?.shortTitle),
    categoryId:
      clean(product?.categoryId) ||
      clean(category?.slug) ||
      clean(category?.id)
  }
}

function readStoredSelection() {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []

    const seen = new Set()
    const result = []

    for (const item of parsed) {
      const entry = sanitizeSelectionEntry(item)
      const key = getSelectionKey(entry)
      if (!entry || !key || seen.has(key)) continue

      seen.add(key)
      result.push(entry)
      if (result.length >= MAX_SELECTION) break
    }

    return result
  } catch {
    return []
  }
}

/**
 * Lightweight, session-scoped product selection for a single combined WhatsApp
 * enquiry. It is intentionally not a cart or checkout: nothing is priced,
 * reserved, ordered, or paid for on the website.
 */
export function useProductSelection() {
  const [selected, setSelected] = useState(readStoredSelection)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selected))
    } catch {
      // Selection still works for the current page when storage is unavailable.
    }
  }, [selected])

  const isSelected = useCallback(
    (product) => {
      const key = getSelectionKey(product)
      return Boolean(key) && selected.some((item) => getSelectionKey(item) === key)
    },
    [selected]
  )

  const toggle = useCallback((product, category = null) => {
    const key = getSelectionKey(product)
    if (!key) return

    setSelected((current) => {
      const exists = current.some((item) => getSelectionKey(item) === key)
      if (exists) return current.filter((item) => getSelectionKey(item) !== key)

      const entry = sanitizeSelectionEntry(product, category)
      if (!entry || current.length >= MAX_SELECTION) return current

      return [...current, entry]
    })
  }, [])

  const clear = useCallback(() => setSelected([]), [])

  return {
    selected,
    isSelected,
    toggle,
    clear,
    maxSelection: MAX_SELECTION,
    isFull: selected.length >= MAX_SELECTION
  }
}
