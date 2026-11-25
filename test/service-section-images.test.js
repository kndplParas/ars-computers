import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('Service Section Images Verification', () => {
  const EXPECTED_SERVICE_IMAGES = [
    {
      service: 'Custom PC Assembly & Upgrades',
      file: 'Gemini_Generated_Image_qx3vpzqx3vpzqx3v.png',
      alt: 'Custom PC Assembly & Upgrades'
    },
    {
      service: 'CCTV Surveillance Setup & AMC',
      file: 'Gemini_Generated_Image_t9ckf7t9ckf7t9ck.png',
      alt: 'CCTV Surveillance Setup & AMC'
    },
    {
      service: 'Biometric Machine & Access Control',
      file: 'Gemini_Generated_Image_t9ckf7t9ckf7t9ck (1).png',
      alt: 'Biometric Machine & Access Control'
    },
    {
      service: 'Printer Care, Refills & Servicing',
      file: 'Gemini_Generated_Image_qx3vpzqx3vpzqx3v (4).png',
      alt: 'Printer Care, Refills & Servicing'
    }
  ]

  it('All 4 service photo assets exist on disk in src/assets', () => {
    EXPECTED_SERVICE_IMAGES.forEach(({ file }) => {
      const filePath = path.join(rootDir, 'src', 'assets', file)
      assert.ok(fs.existsSync(filePath), `Asset ${file} must exist in src/assets`)
      const stat = fs.statSync(filePath)
      assert.ok(stat.size > 1000000, `Asset ${file} must be a high-resolution image (>1MB)`)
    })
  })

  it('CustomerHomePage.jsx imports all 4 service image assets', () => {
    const pagePath = path.join(rootDir, 'src', 'pages', 'CustomerHomePage.jsx')
    const pageCode = fs.readFileSync(pagePath, 'utf8')

    EXPECTED_SERVICE_IMAGES.forEach(({ file, alt }) => {
      assert.ok(
        pageCode.includes(file),
        `CustomerHomePage.jsx must import ${file}`
      )
      assert.ok(
        pageCode.includes(`alt="${alt}"`),
        `CustomerHomePage.jsx must include img with alt="${alt}"`
      )
    })
  })

  it('CustomerHomePage.jsx preserves all 4 service titles, features, and ticket buttons', () => {
    const pagePath = path.join(rootDir, 'src', 'pages', 'CustomerHomePage.jsx')
    const pageCode = fs.readFileSync(pagePath, 'utf8')

    EXPECTED_SERVICE_IMAGES.forEach(({ service }) => {
      assert.ok(
        pageCode.includes(service.replace('&', '&amp;')) || pageCode.includes(service),
        `CustomerHomePage.jsx must preserve service heading: ${service}`
      )
    })

    assert.ok(pageCode.includes('Raise PC / Laptop Ticket'), 'Preserves PC ticket button')
    assert.ok(pageCode.includes('Raise CCTV Service Ticket'), 'Preserves CCTV ticket button')
    assert.ok(pageCode.includes('Raise Biometric Ticket'), 'Preserves Biometric ticket button')
    assert.ok(pageCode.includes('Raise Printer Ticket'), 'Preserves Printer ticket button')
  })

  it('App.css defines complete responsive styling for service card images', () => {
    const cssPath = path.join(rootDir, 'src', 'App.css')
    const cssCode = fs.readFileSync(cssPath, 'utf8')

    assert.ok(cssCode.includes('.service-card-image-wrap'), 'App.css must define .service-card-image-wrap')
    assert.ok(cssCode.includes('.service-card-image'), 'App.css must define .service-card-image')
    assert.ok(cssCode.includes('.service-card-image-overlay'), 'App.css must define .service-card-image-overlay')
    assert.ok(cssCode.includes('.service-card-content'), 'App.css must define .service-card-content')
  })

  it('CustomerHomePage.jsx does not render symbol icon badges over category or service photos', () => {
    const pagePath = path.join(rootDir, 'src', 'pages', 'CustomerHomePage.jsx')
    const pageCode = fs.readFileSync(pagePath, 'utf8')

    assert.ok(!pageCode.includes('className="card-icon"'), 'Category cards must not overlay card-icon symbol')
    assert.ok(!pageCode.includes('className="service-icon"'), 'Service cards must not overlay service-icon symbol')
  })
})
