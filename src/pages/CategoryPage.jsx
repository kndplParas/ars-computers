import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  fetchCategoryBySlug,
  fetchPublicCatalog,
  getInstantCategoryBySlug,
  getInstantCatalog,
  normalizeCategorySlug
} from '../lib/catalog'
import { groupAccessories } from '../data/accessoryGroups'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import WhatsAppButton from '../components/WhatsAppButton'
import WhatsAppSelectionBar from '../components/WhatsAppSelectionBar'
import { useProductSelection } from '../lib/useProductSelection'
import '../App.css'

function ProductCard({ item, category, navigate }) {
  return (
    <article
      key={item.slug || item.id}
      className="category-product-card"
      onClick={() => navigate(`/products/${item.slug}`)}
    >
      {/* Visual hardware preview placeholder or image */}
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
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="product-card-placeholder">
            <span className="placeholder-icon" aria-hidden="true">{category.icon}</span>
            <div className="placeholder-badge">
              {item.isGeneric ? 'Solution Package' : 'Certified Genuine'}
            </div>
          </div>
        )}

        {item.isFeatured && (
          <span className="product-featured-tag">★ Featured</span>
        )}
      </div>

      {/* Product Info */}
      <div className="product-card-body">
        <div className="product-card-header">
          <span className="product-category-label">{category.title}</span>
          {item.brand ? (
            <span className="product-brand-tag">{item.brand}</span>
          ) : item.isGeneric ? (
            <span className="product-brand-tag generic-tag">Hardware Solution</span>
          ) : null}
        </div>

        <h3 className="product-card-title">
          <Link
            to={`/products/${item.slug}`}
            className="product-title-link"
            onClick={(e) => e.stopPropagation()}
          >
            {item.name}
          </Link>
        </h3>

        <p className="product-card-spec">{item.spec}</p>

        {item.variants && item.variants.length > 0 && (
          <div className="product-card-variants-badge">
            <span className="variants-badge-text">
              {item.variantSelectorLabel ? item.variantSelectorLabel.replace(/^Select\s+/i, '') : 'Options'}: {item.variants.length} available ({item.variants.map((v) => v.label).slice(0, 3).join(', ')}{item.variants.length > 3 ? '…' : ''})
            </span>
          </div>
        )}

        {((typeof item.price === 'number' && item.price > 0) ||
          (typeof item.stock === 'number' && item.stock > 0)) && (
          <div className="product-card-pricing-row">
            {typeof item.price === 'number' && item.price > 0 && (
              <div className="product-card-price-wrap">
                <span className="price-label">Price</span>
                <span className="price-val">₹{Number(item.price).toLocaleString('en-IN')}</span>
              </div>
            )}

            {typeof item.stock === 'number' && item.stock > 0 && (
              <div className="product-card-stock-wrap">
                <span className="stock-pill in-stock">✓ In Stock</span>
              </div>
            )}
          </div>
        )}

        <div className="product-card-actions">
          <Link
            to={`/products/${item.slug}`}
            className="btn-primary w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            View Details
          </Link>

          <WhatsAppButton
            product={item}
            category={category}
            className="whatsapp-card-btn"
          />
        </div>
      </div>
    </article>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const normalizedSlug = normalizeCategorySlug(slug)

  // Synchronous instant initialization from memory cache or verified static catalog
  const initialData = getInstantCategoryBySlug(slug)
  const initialCatalog = getInstantCatalog()

  const [category, setCategory] = useState(() => initialData?.category || null)
  const [products, setProducts] = useState(() => initialData?.products || [])
  const [allCategories, setAllCategories] = useState(() => initialCatalog?.categories || [])
  const [isLoading, setIsLoading] = useState(() => !initialData?.category)
  const [error, setError] = useState(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const { selected, clear } = useProductSelection()

  const isAccessories = category?.id === 'accessories' || normalizedSlug === 'accessories'
  const groupedAccessories = useMemo(() => {
    return isAccessories ? groupAccessories(products) : []
  }, [isAccessories, products])

  // Retry handler for user clicks
  const handleRetry = async () => {
    setIsRetrying(true)
    setError(null)

    try {
      const [catResult, catalogResult] = await Promise.all([
        fetchCategoryBySlug(slug, { forceRefresh: true }),
        fetchPublicCatalog({ forceRefresh: true })
      ])

      if (catResult.category) {
        setCategory(catResult.category)
        setProducts(catResult.products || [])
        setError(null)
      } else {
        const instantFallback = getInstantCategoryBySlug(slug)
        if (instantFallback?.category) {
          setCategory(instantFallback.category)
          setProducts(instantFallback.products || [])
          setError(null)
        } else {
          setError(catResult.error || `Category "${slug}" not found.`)
        }
      }

      if (catalogResult.categories && catalogResult.categories.length > 0) {
        setAllCategories(catalogResult.categories)
      }
    } catch (err) {
      console.warn('Category retry error:', err)
      setError(err?.message || 'Unable to connect to the hardware catalog.')
    } finally {
      setIsLoading(false)
      setIsRetrying(false)
    }
  }

  // Scroll to top and trigger async background revalidation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })

    let isMounted = true

    fetchCategoryBySlug(slug)
      .then((catResult) => {
        if (!isMounted) return
        if (catResult.category) {
          setCategory(catResult.category)
          setProducts(catResult.products || [])
          setError(null)
        } else {
          const instantFallback = getInstantCategoryBySlug(slug)
          if (!instantFallback?.category) {
            setError(catResult.error || `Category "${slug}" not found.`)
          }
        }
        setIsLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Category fetch error:', err)
        const instantFallback = getInstantCategoryBySlug(slug)
        if (!instantFallback?.category) {
          setError(err?.message || 'Unable to connect to the hardware catalog.')
        }
        setIsLoading(false)
      })

    fetchPublicCatalog()
      .then((catalogResult) => {
        if (!isMounted) return
        if (catalogResult.categories && catalogResult.categories.length > 0) {
          setAllCategories(catalogResult.categories)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [slug])

  return (
    <div className="app-container">
      <SiteHeader selectedCategory={normalizedSlug || slug} activeSection="products" />

      <main className="category-page-main">
        {/* Breadcrumb Navigation */}
        <div className="page-breadcrumb-container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-link">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to="/#products" className="breadcrumb-link">Categories</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current" aria-current="page">
              {category ? category.title : (isLoading ? 'Hardware Catalog' : slug)}
            </span>
          </nav>
        </div>

        {/* 1. Loading Skeleton (Only shown if category is not yet available in instant cache) */}
        {isLoading && !category ? (
          <div className="category-skeleton-wrapper" aria-busy="true" aria-label="Loading catalog">
            <div className="category-hero-section skeleton-hero">
              <div className="category-hero-content">
                <div className="skeleton-line skeleton-badge"></div>
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line skeleton-tagline"></div>
              </div>
            </div>
            <div className="section-container">
              <div className="category-product-cards-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="category-product-card skeleton-card">
                    <div className="skeleton-card-visual skeleton-shimmer"></div>
                    <div className="skeleton-card-body">
                      <div className="skeleton-line skeleton-card-title"></div>
                      <div className="skeleton-line skeleton-card-spec"></div>
                      <div className="skeleton-line skeleton-card-btn"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error && !category ? (
          /* 2. Error / Not Found State */
          <div className="category-error-state">
            <div className="error-icon">⚠️</div>
            <h2>Category Not Found</h2>
            <p>{error || `We couldn't find a hardware category matching "${slug}".`}</p>
            <div className="error-actions">
              <button
                className="btn-primary"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Retrying...' : '↻ Try Again'}
              </button>
              <Link to="/#products" className="btn-outline">
                Browse All Categories
              </Link>
              <Link to="/" className="btn-outline">
                Return to Home
              </Link>
            </div>
          </div>
        ) : (
          /* 3. Fully Rendered Category Page (Instant!) */
          category && (
            <>
              {/* Category Hero Banner */}
              <section className="category-hero-section">
                <div className="category-hero-content">
                  <div className="category-hero-badge-wrap">
                    <span className="category-hero-icon" aria-hidden="true">{category.icon}</span>
                    <span className="category-hero-badge">{category.badge || 'Official Hardware'}</span>
                    <span className="category-hero-count">
                      {products.length} {products.length === 1 ? 'Product Model' : 'Product Models'} Available
                    </span>
                  </div>

                  <h1 className="category-hero-title">{category.title}</h1>
                  <p className="category-hero-tagline">{category.tagline}</p>

                  {/* Quick Category Switcher Tabs */}
                  {allCategories.length > 0 && (
                    <div className="category-switcher-bar">
                      <span className="switcher-label">Switch Category:</span>
                      <div className="switcher-pills">
                        {allCategories.map((c) => {
                          const cSlug = c.slug || c.id
                          const isActive = cSlug === normalizedSlug || cSlug === slug || c.id === slug
                          return (
                            <button
                              key={c.id || c.slug}
                              className={`switcher-pill ${isActive ? 'active' : ''}`}
                              onClick={() => navigate(`/category/${cSlug}`)}
                            >
                              <span aria-hidden="true">{c.icon}</span> {c.shortTitle || c.title}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Products Grid Section */}
              <section className="category-products-section">
                <div className="section-container">
                  <div className="category-section-heading">
                    <div>
                      <h2 className="section-title">Hardware Models &amp; Configurations</h2>
                      <p className="section-subtitle">
                        Genuine hardware backed by official manufacturer warranties, custom configurations, and authorized service support.
                      </p>
                    </div>
                  </div>

                  {products.length === 0 ? (
                    <div className="category-empty-state">
                      <p>No product models are currently cataloged under this category.</p>
                      <Link to="/#products" className="btn-primary">
                        View Other Categories
                      </Link>
                    </div>
                  ) : isAccessories && groupedAccessories.length > 0 ? (
                    <div className="accessories-grouped-container">
                      {/* Section Quick Jump Bar */}
                      <div className="accessories-group-jump-bar" aria-label="Jump to accessory section">
                        <span className="group-jump-label">Jump to Section:</span>
                        <div className="group-jump-pills">
                          {groupedAccessories.map((grp) => (
                            <a
                              key={grp.id}
                              href={`#${grp.id}`}
                              className="group-jump-pill"
                            >
                              <span aria-hidden="true">{grp.icon}</span>
                              <span>{grp.title}</span>
                              <span className="group-jump-pill-count">{grp.products.length}</span>
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Group Sections */}
                      {groupedAccessories.map((grp) => (
                        <section key={grp.id} id={grp.id} className="accessory-group-section" aria-labelledby={`heading-${grp.id}`}>
                          <div className="accessory-group-header">
                            <div className="accessory-group-title-row">
                              <span className="accessory-group-icon" aria-hidden="true">{grp.icon}</span>
                              <h3 id={`heading-${grp.id}`} className="accessory-group-title">{grp.title}</h3>
                              <span className="accessory-group-count">
                                {grp.products.length} {grp.products.length === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                            {grp.description && (
                              <p className="accessory-group-description">{grp.description}</p>
                            )}
                          </div>

                          <div className="category-product-cards-grid">
                            {grp.products.map((item) => (
                              <ProductCard
                                key={item.slug || item.id}
                                item={item}
                                category={category}
                                navigate={navigate}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="category-product-cards-grid">
                      {products.map((item) => (
                        <ProductCard
                          key={item.slug || item.id}
                          item={item}
                          category={category}
                          navigate={navigate}
                        />
                      ))}
                    </div>
                  )}

                  {/* Bottom Assistance Banner */}
                  <div className="category-cta-banner">
                    <div className="cta-banner-content">
                      <h3>Need Assistance with {category.title}?</h3>
                      <p>
                        Our certified engineers can help you select the exact hardware model, conduct on-site surveys, or draft an itemized institutional proposal.
                      </p>
                    </div>
                    <div className="cta-banner-actions">
                      <button
                        className="btn-primary"
                        onClick={() => navigate(`/#contact`)}
                      >
                        Contact Technical Desk
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => navigate('/#products')}
                      >
                        All Categories
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )
        )}
      </main>

      <WhatsAppSelectionBar selected={selected} onClear={clear} />

      <SiteFooter />
    </div>
  )
}
