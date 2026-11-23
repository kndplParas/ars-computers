import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { IMAGE_CREDITS_DATA } from '../data/imageCredits'
import '../App.css'

export default function ImageCreditsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const stats = useMemo(() => {
    let sa = 0
    let by = 0
    let cc0 = 0
    IMAGE_CREDITS_DATA.forEach((item) => {
      if (item.isShareAlike) sa++
      else if (/CC BY/i.test(item.license)) by++
      else if (/CC0|Public Domain|Free Use/i.test(item.license)) cc0++
    })
    return { total: IMAGE_CREDITS_DATA.length, sa, by, cc0 }
  }, [])

  const filteredCredits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return IMAGE_CREDITS_DATA.filter((item) => {
      // License category filter
      if (selectedFilter === 'sharealike' && !item.isShareAlike) return false
      if (selectedFilter === 'cc-by' && (item.isShareAlike || !/CC BY/i.test(item.license))) return false
      if (selectedFilter === 'cc0' && !/CC0|Public Domain|Free Use/i.test(item.license)) return false

      // Text search filter
      if (!q) return true
      return (
        item.heading.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.license.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, selectedFilter])

  return (
    <div className="app-container">
      <SiteHeader activeSection="credits" />

      <main className="credits-page-main">
        {/* Breadcrumb Navigation */}
        <div className="page-breadcrumb-container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-link">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current" aria-current="page">Image Credits &amp; Licences</span>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="credits-hero-section">
          <div className="credits-hero-content">
            <div className="credits-hero-badge">
              <span>⚖️ Open-Access Licences &amp; Attributions</span>
            </div>
            <h1 className="credits-hero-title">Catalogue Media Credits &amp; Licences</h1>
            <p className="credits-hero-tagline">
              ARS Computers respects intellectual property rights. This registry provides transparent legal attribution, original creator citations, and license deed references for all {stats.total} Creative Commons and open-access photographic assets utilized across our hardware catalog.
            </p>

            {/* Legal Notice Box */}
            <div className="credits-legal-notice-box">
              <div className="notice-point">
                <strong>Creative Commons ShareAlike (CC BY-SA) Compliance:</strong>{' '}
                Images marked with ShareAlike (CC BY-SA) require any derivative adaptation to be released under the same license. ARS Computers utilizes these photographic assets in their original, unmodified form solely for nominative hardware identification and consumer transparency.
              </div>
              <div className="notice-point">
                <strong>Nominative Fair Use &amp; Trademarks:</strong>{' '}
                All manufacturer trademarks, logos, and model names (including Dell, HP, Lenovo, ASUS, Acer, Hikvision, CP PLUS, Epson, Canon, Brother, Samsung, Seagate, Corsair, Kingston, D-Link, Zebronics) remain the exclusive property of their respective trademark holders and are cited nominatively to signify hardware compatibility and OEM provenance.
              </div>
              <div className="notice-point">
                <strong>Commercial Legal Compliance:</strong>{' '}
                This catalogue does not claim blanket exemption under Section 52(1) of the Indian Copyright Act, 1957. Every third-party asset is maintained strictly under its verified open-access license (CC0, CC BY, CC BY-SA) or proprietary ARS Computers store photography.
              </div>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="credits-content-section">
          <div className="credits-controls-wrapper">
            <div className="credits-search-box">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="credits-search-input"
                placeholder="Search by product, creator, model, or license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search image credits"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="credits-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="credits-filter-pills" role="tablist" aria-label="Filter by license type">
              <button
                type="button"
                role="tab"
                aria-selected={selectedFilter === 'all'}
                className={`filter-pill ${selectedFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('all')}
              >
                All Licences ({stats.total})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedFilter === 'sharealike'}
                className={`filter-pill ${selectedFilter === 'sharealike' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('sharealike')}
              >
                CC BY-SA ShareAlike ({stats.sa})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedFilter === 'cc-by'}
                className={`filter-pill ${selectedFilter === 'cc-by' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('cc-by')}
              >
                CC BY Attribution ({stats.by})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedFilter === 'cc0'}
                className={`filter-pill ${selectedFilter === 'cc0' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('cc0')}
              >
                CC0 / Public Domain ({stats.cc0})
              </button>
            </div>
          </div>

          <div className="credits-results-header">
            <span className="results-count">
              Showing <strong>{filteredCredits.length}</strong> of {stats.total} Media Attributions
            </span>
            {searchQuery && (
              <span className="results-query">
                matching &ldquo;<em>{searchQuery}</em>&rdquo;
              </span>
            )}
          </div>

          {/* Credits Grid */}
          {filteredCredits.length === 0 ? (
            <div className="credits-empty-state">
              <p>No media asset attributions match your search or filter.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedFilter('all')
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="credits-grid">
              {filteredCredits.map((item) => (
                <article key={item.id} className="credit-card" id={`credit-${item.id}`}>
                  <div className="credit-card-header">
                    <span className="credit-index-badge">#{item.id}</span>
                    <h3 className="credit-heading">{item.heading}</h3>
                  </div>

                  <div className="credit-details-body">
                    {item.slug && (
                      <div className="credit-row">
                        <span className="credit-label">Catalog Product:</span>
                        <Link to={`/products/${item.slug}`} className="credit-product-link">
                          {item.slug} ↗
                        </Link>
                      </div>
                    )}

                    {item.title && (
                      <div className="credit-row">
                        <span className="credit-label">Source Work:</span>
                        <span className="credit-value" title={item.title}>
                          {item.title.replace('File:', '')}
                        </span>
                      </div>
                    )}

                    <div className="credit-row">
                      <span className="credit-label">Creator / Author:</span>
                      <span className="credit-value credit-author">
                        {item.author || 'Designated author on Wikimedia Commons'}
                      </span>
                    </div>

                    <div className="credit-row">
                      <span className="credit-label">License:</span>
                      <div className="credit-license-wrap">
                        <span className={`license-badge ${item.isShareAlike ? 'badge-sa' : 'badge-cc'}`}>
                          {item.license}
                        </span>
                        {item.licenseDeed && (
                          <a
                            href={item.licenseDeed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="credit-link"
                            title="Read official Creative Commons license deed"
                          >
                            Read License Deed ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {item.isShareAlike && (
                      <div className="credit-sa-notice">
                        <span className="sa-icon" aria-hidden="true">🔄</span>
                        <span>
                          <strong>ShareAlike Notice:</strong> If adapted or modified, the derivative work must be distributed under the same license deed.
                        </span>
                      </div>
                    )}

                    {item.sourceUrl && (
                      <div className="credit-row credit-source-row">
                        <span className="credit-label">Source Asset:</span>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="credit-source-link"
                          title="View source asset on repository"
                        >
                          View Original Repository Source ↗
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
