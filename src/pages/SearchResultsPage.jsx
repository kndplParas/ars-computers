import { useState, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { fetchPublicCatalog, searchActiveCatalog } from '../lib/catalog'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import '../App.css'

export default function SearchResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryParams = new URLSearchParams(location.search)
  const searchQuery = queryParams.get('q') || ''

  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    window.scrollTo({ top: 0, behavior: 'instant' })

    fetchPublicCatalog()
      .then((res) => {
        if (!isMounted) return
        if (res.categories && res.categories.length > 0) {
          setCategories(res.categories)
        }
      })
      .catch((err) => {
        console.warn('SearchResultsPage catalog load error:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const { allResults, totalMatches } = searchActiveCatalog(searchQuery, categories, {
    limit: 500
  })

  return (
    <div className="app-container">
      <SiteHeader activeSection="products" />

      <main className="search-results-page-main">
        {/* Breadcrumb Navigation */}
        <div className="page-breadcrumb-container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-link">
              Home
            </Link>
            <span className="breadcrumb-sep">/</span>
            <Link to="/#products" className="breadcrumb-link">
              Products
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current" aria-current="page">
              Search Results
            </span>
          </nav>
        </div>

        <section className="search-results-hero">
          <div className="section-container">
            <div className="search-hero-badge">Hardware Catalogue Search</div>
            <h1 className="search-hero-title">
              {searchQuery.trim()
                ? `Results for "${searchQuery.trim()}"`
                : 'All Hardware Products'}
            </h1>
            <p className="search-hero-subtitle">
              {isLoading
                ? 'Searching authentic hardware inventory...'
                : `Showing ${totalMatches} matching verified genuine product${
                    totalMatches === 1 ? '' : 's'
                  } with official manufacturer warranties.`}
            </p>
          </div>
        </section>

        <section className="search-results-grid-section">
          <div className="section-container">
            {isLoading ? (
              <div
                className="category-product-cards-grid"
                aria-busy="true"
                aria-label="Loading search results"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="category-product-card skeleton-card">
                    <div
                      className="skeleton-card-visual skeleton-shimmer"
                      style={{ height: '160px' }}
                    ></div>
                    <div className="skeleton-card-body" style={{ padding: '16px' }}>
                      <div
                        className="skeleton-line"
                        style={{ width: '70%', height: '18px', marginBottom: '10px' }}
                      ></div>
                      <div
                        className="skeleton-line"
                        style={{ width: '90%', height: '14px', marginBottom: '16px' }}
                      ></div>
                      <div
                        className="skeleton-line"
                        style={{ width: '100%', height: '38px' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : totalMatches === 0 ? (
              <div className="search-page-empty-card">
                <span className="empty-search-icon" aria-hidden="true">
                  🔍
                </span>
                <h2>No Products Found</h2>
                <p>
                  We couldn't find any hardware models matching "
                  <strong>{searchQuery}</strong>".
                </p>
                <p className="empty-search-help">
                  Please verify spelling or search by general category like{' '}
                  <Link to="/category/computer-laptop">Laptops</Link>,{' '}
                  <Link to="/category/cctv">CCTV</Link>,{' '}
                  <Link to="/category/printer">Printers</Link>, or{' '}
                  <Link to="/category/biometric-machine">Biometrics</Link>.
                </p>
                <div style={{ marginTop: '24px' }}>
                  <Link to="/#products" className="btn-primary">
                    Browse All Categories
                  </Link>
                </div>
              </div>
            ) : (
              <div className="category-product-cards-grid">
                {allResults.map((item) => (
                  <article
                    key={item.slug || item.id}
                    className="category-product-card"
                    onClick={() => navigate(`/products/${item.slug}`)}
                  >
                    <div
                      className="product-card-visual"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/products/${item.slug}`)
                      }}
                    >
                      {item.images && item.images.length > 0 && item.images[0] ? (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="product-card-img"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="product-card-placeholder">
                          <span className="placeholder-icon" aria-hidden="true">
                            {item.categoryIcon || '💻'}
                          </span>
                          <div className="placeholder-badge">Certified Genuine</div>
                        </div>
                      )}

                      {item.isFeatured && (
                        <span className="product-featured-tag">★ Featured</span>
                      )}
                    </div>

                    <div className="product-card-body">
                      <div className="product-card-header">
                        <span className="product-category-label">
                          {item.categoryTitle || 'Hardware'}
                        </span>
                        {item.brand && (
                          <span
                            className="product-category-label"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 600
                            }}
                          >
                            {item.brand}
                          </span>
                        )}
                      </div>

                      <h3 className="product-card-title">{item.rawName || item.name}</h3>
                      <p className="product-card-spec">{item.spec || item.specSummary}</p>

                      <div className="product-card-footer">
                        <button
                          type="button"
                          className="btn-product-quote"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/products/${item.slug}`)
                          }}
                        >
                          View Specifications &amp; Request Quote →
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
