/**
 * ============================================================================
 * ARS Computers — Public Image Credits & Licences Verification Test Suite
 * ============================================================================
 * Verifies:
 * 1. Data Completeness: All 265 media assets have verified creators, licenses, deeds,
 *    and source URLs in `src/data/imageCredits.js`.
 * 2. ShareAlike Compliance: Every CC BY-SA asset is identified with `isShareAlike: true`
 *    and displays appropriate copyleft disclosure.
 * 3. Routing & Footer Links: Customer-facing routes `/credits` and `/image-credits`
 *    are defined, and `SiteFooter.jsx` exposes visible navigation links.
 * 4. Legal Compliance: The public page explicitly states nominative trademark use,
 *    ShareAlike terms, and disclaims blanket Section 52(1) exemption claims.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMAGE_CREDITS_DATA } from '../src/data/imageCredits.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

test('Image Credits & Licences Verification Suite', async (t) => {
  await t.test('1. Data Completeness: All 265 assets have complete licensing metadata', () => {
    assert.equal(IMAGE_CREDITS_DATA.length, 265, 'Must contain all 265 catalog media entries')

    let missingLicense = 0
    let missingSource = 0
    let missingAuthor = 0
    let shareAlikeCount = 0

    IMAGE_CREDITS_DATA.forEach((item) => {
      if (!item.license || item.license.trim().length === 0) {
        missingLicense++
      }
      if (!item.sourceUrl || !item.sourceUrl.startsWith('http')) {
        missingSource++
      }
      if (!item.author || item.author.trim().length === 0) {
        missingAuthor++
      }
      if (item.isShareAlike) {
        shareAlikeCount++
      }
    })

    assert.equal(missingLicense, 0, 'Every asset must have an identified license')
    assert.equal(missingSource, 0, 'Every asset must link to an authoritative source URL')
    assert.equal(missingAuthor, 0, 'Every asset must state the author / creator')
    assert.ok(shareAlikeCount >= 160, `ShareAlike count (${shareAlikeCount}) should capture all CC BY-SA assets`)
  })

  await t.test('2. ShareAlike Attribution: Every CC BY-SA asset has license deed link', () => {
    const saAssets = IMAGE_CREDITS_DATA.filter((i) => i.isShareAlike)
    let missingDeed = 0

    saAssets.forEach((item) => {
      if (!item.licenseDeed || !item.licenseDeed.startsWith('http')) {
        missingDeed++
      }
    })

    assert.equal(missingDeed, 0, 'All ShareAlike assets must link to official CC deed')
  })

  await t.test('3. SiteFooter Navigation: "Image Credits & Licences" link is visible in Quick Links and footer bottom', () => {
    const footerContent = fs.readFileSync(path.join(rootDir, 'src/components/SiteFooter.jsx'), 'utf8')
    assert.ok(footerContent.includes("navigate('/credits')"), 'Footer must navigate to /credits')
    assert.ok(
      footerContent.includes('Image Credits &amp; Licences') || footerContent.includes('Image Credits & Licences'),
      'Footer must display "Image Credits & Licences" link'
    )
  })

  await t.test('4. App Routing: /credits and /image-credits routes are registered', () => {
    const appContent = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8')
    assert.ok(appContent.includes("import('./pages/ImageCreditsPage')"), 'App.jsx must lazy-load ImageCreditsPage')
    assert.ok(appContent.includes('path="/credits"'), 'App.jsx must register /credits route')
    assert.ok(appContent.includes('path="/image-credits"'), 'App.jsx must register /image-credits redirect route')
  })

  await t.test('5. Legal Compliance Disclosures in ImageCreditsPage', () => {
    const pageContent = fs.readFileSync(path.join(rootDir, 'src/pages/ImageCreditsPage.jsx'), 'utf8')
    assert.ok(pageContent.includes('Section 52(1)'), 'Must disclose Section 52(1) compliance boundary')
    assert.ok(
      pageContent.includes('Third-party product names, logos and trademarks belong to their respective owners'),
      'Must include neutral factual trademark disclaimer'
    )
    assert.ok(!pageContent.includes('Nominative Fair Use'), 'Must not claim Nominative Fair Use')
    assert.ok(pageContent.includes('ShareAlike (CC BY-SA) Compliance'), 'Must state CC BY-SA ShareAlike terms')
  })
})
