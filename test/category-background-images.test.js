import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, CATEGORY_BACKGROUND_IMAGES } from '../src/data/categories.js'
import { getInstantCatalog } from '../src/lib/catalog.js'

describe('Category Background Images Verification', () => {
  const EXPECTED_CATEGORIES = [
    'computer-laptop',
    'cctv',
    'printer',
    'biometric-machine',
    'accessories'
  ]

  it('CATEGORY_BACKGROUND_IMAGES exports all 5 target categories', () => {
    EXPECTED_CATEGORIES.forEach((slug) => {
      assert.ok(
        CATEGORY_BACKGROUND_IMAGES[slug],
        `CATEGORY_BACKGROUND_IMAGES must define background for category: ${slug}`
      )
      assert.ok(
        typeof CATEGORY_BACKGROUND_IMAGES[slug] === 'string' &&
        CATEGORY_BACKGROUND_IMAGES[slug].length > 0,
        `CATEGORY_BACKGROUND_IMAGES[${slug}] must be a non-empty string path`
      )
    })
  })

  it('CATEGORIES static definitions each include their dedicated bgImage', () => {
    EXPECTED_CATEGORIES.forEach((slug) => {
      const cat = CATEGORIES.find((c) => c.slug === slug || c.id === slug)
      assert.ok(cat, `Category ${slug} must exist in CATEGORIES`)
      assert.ok(
        cat.bgImage,
        `Category ${slug} must have bgImage assigned`
      )
      assert.equal(
        cat.bgImage,
        CATEGORY_BACKGROUND_IMAGES[slug],
        `Category ${slug} bgImage must match CATEGORY_BACKGROUND_IMAGES[${slug}]`
      )
    })
  })

  it('getInstantCatalog returns categories with bgImage attached', () => {
    const catalog = getInstantCatalog()
    assert.ok(catalog.categories && catalog.categories.length === 5)
    catalog.categories.forEach((cat) => {
      const slug = cat.slug || cat.id
      assert.ok(
        cat.bgImage || CATEGORY_BACKGROUND_IMAGES[slug],
        `Catalog category ${slug} must have a valid background image`
      )
    })
  })
})
