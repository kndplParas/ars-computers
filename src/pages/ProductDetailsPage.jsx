import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  fetchProductBySlug,
  fetchCategoryBySlug,
  getInstantProductBySlug
} from '../lib/catalog'
import { PRODUCT_IMAGE_CAPTIONS } from '../data/productImages'
import { getSpecTable } from '../data/specSchemas'
import { ARS_SALES_DISPLAY_NUMBER, ARS_SALES_TEL_HREF } from '../lib/contact'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import WhatsAppButton from '../components/WhatsAppButton'
import WhatsAppSelectionBar from '../components/WhatsAppSelectionBar'
import { useProductSelection } from '../lib/useProductSelection'
import '../App.css'

const SPEC_VERIFICATION_META = {
  verified: {
    icon: '✓',
    label: 'Manufacturer specifications',
    description: 'Values are backed by manufacturer documentation.',
    tone: 'verified'
  },
  partially_verified: {
    icon: '◐',
    label: 'Partially verified',
    description: 'Core values are confirmed; some model-specific details may vary.',
    tone: 'partial'
  },
  configuration_dependent: {
    icon: '?',
    label: 'Configuration dependent — confirm with sales',
    description: 'Values depend on the selected stock or build and must be confirmed before ordering.',
    tone: 'dependent'
  }
}

export default function ProductDetailsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  // Synchronous instant initialization from cache or verified static catalog
  const initialData = getInstantProductBySlug(slug)

  const [product, setProduct] = useState(() => initialData?.product || null)
  const [category, setCategory] = useState(() => initialData?.category || null)
  const [relatedProducts, setRelatedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(() => !initialData?.product)
  const [error, setError] = useState(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [prevSlug, setPrevSlug] = useState(slug)
  const { selected, isSelected, toggle, clear, isFull, maxSelection } = useProductSelection()

  // Reset gallery selection when navigating to a new product
  if (prevSlug !== slug) {
    setPrevSlug(slug)
    setActiveImageIndex(0)
  }

  // Retry handler for user clicks
  const handleRetry = async () => {
    setIsRetrying(true)
    setError(null)

    try {
      const result = await fetchProductBySlug(slug, { forceRefresh: true })

      if (result.product) {
        setProduct(result.product)
        setCategory(result.category)
        setError(null)

        const catSlug = result.category?.slug || result.category?.id || result.product.categoryId
        if (catSlug) {
          fetchCategoryBySlug(catSlug).then((catRes) => {
            if (catRes.products) {
              const filtered = catRes.products.filter(p => p.slug !== slug)
              setRelatedProducts(filtered)
            }
          }).catch(() => {})
        }
      } else {
        const instantFallback = getInstantProductBySlug(slug)
        if (instantFallback?.product) {
          setProduct(instantFallback.product)
          setCategory(instantFallback.category)
          setError(null)
        } else {
          setError(result.error || `Product "${slug}" was not found.`)
        }
      }
    } catch (err) {
      console.warn('Product retry error:', err)
      setError(err?.message || 'Unable to load product details.')
    } finally {
      setIsLoading(false)
      setIsRetrying(false)
    }
  }

  // Scroll to top and trigger async background revalidation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })

    let isMounted = true

    fetchProductBySlug(slug)
      .then((result) => {
        if (!isMounted) return
        if (result.product) {
          setProduct(result.product)
          setCategory(result.category)
          setError(null)

          const catSlug = result.category?.slug || result.category?.id || result.product.categoryId
          if (catSlug) {
            fetchCategoryBySlug(catSlug).then((catRes) => {
              if (isMounted && catRes.products) {
                const filtered = catRes.products.filter(p => p.slug !== slug)
                setRelatedProducts(filtered)
              }
            }).catch(() => {})
          }
        } else {
          const instantFallback = getInstantProductBySlug(slug)
          if (!instantFallback?.product) {
            setError(result.error || `Product "${slug}" was not found.`)
          }
        }
        setIsLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Product fetch error:', err)
        const instantFallback = getInstantProductBySlug(slug)
        if (!instantFallback?.product) {
          setError(err?.message || 'Unable to load product details.')
        }
        setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  const specTable = getSpecTable(category || product?.categoryId, product?.specAttributes)
  const verification = product
    ? SPEC_VERIFICATION_META[product.specsVerified] || SPEC_VERIFICATION_META.configuration_dependent
    : null

  return (
    <div className="app-container">
      <SiteHeader selectedCategory={category?.slug || category?.id} activeSection="products" />

      <main className="product-details-main">
        {/* Breadcrumb Navigation */}
        <div className="page-breadcrumb-container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-link">Home</Link>
            <span className="breadcrumb-sep">/</span>
            {category ? (
              <>
                <Link to={`/category/${category.slug || category.id}`} className="breadcrumb-link">
                  {category.title}
                </Link>
                <span className="breadcrumb-sep">/</span>
              </>
            ) : (
              <>
                <Link to="/#products" className="breadcrumb-link">Products</Link>
                <span className="breadcrumb-sep">/</span>
              </>
            )}
            <span className="breadcrumb-current" aria-current="page">
              {product ? product.name : (isLoading ? 'Hardware Specifications' : slug)}
            </span>
          </nav>

          {/* Quick Back Button */}
          {category && (
            <button
              className="breadcrumb-back-btn"
              onClick={() => navigate(`/category/${category.slug || category.id}`)}
            >
              ← Back to {category.title}
            </button>
          )}
        </div>

        {/* 1. Skeleton Loading (only when product is not yet in instant cache) */}
        {isLoading && !product ? (
          <div className="product-skeleton-wrapper" aria-busy="true" aria-label="Loading product details">
            <div className="product-showcase-grid">
              <div className="skeleton-visual-box skeleton-shimmer"></div>
              <div className="skeleton-info-box">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-line skeleton-tagline"></div>
                <div className="skeleton-line skeleton-spec"></div>
                <div className="skeleton-line skeleton-btn"></div>
              </div>
            </div>
          </div>
        ) : error && !product ? (
          /* 2. Error / Not Found State */
          <div className="category-error-state">
            <div className="error-icon">⚠️</div>
            <h2>Product Not Found</h2>
            <p>{error || `We could not locate a hardware product matching "${slug}".`}</p>
            <div className="error-actions">
              <button
                className="btn-primary"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Retrying...' : '↻ Try Again'}
              </button>
              <Link to="/#products" className="btn-outline">
                Explore All Products
              </Link>
              <Link to="/" className="btn-outline">
                Back to Homepage
              </Link>
            </div>
          </div>
        ) : (
          /* 3. Fully Rendered Product Page (Instant!) */
          product && (
            <div className="product-details-wrapper">
              {/* Primary Product Showcase Section */}
              <section className="product-showcase-grid">
                {/* Left Column: Visual Hardware Card */}
                <div className="product-visual-column">
                  <div className="product-image-frame">
                    {product.images && product.images.length > 0 && (product.images[activeImageIndex] || product.images[0]) ? (
                      <img
                        src={product.images[activeImageIndex] || product.images[0]}
                        alt={`${product.name} view`}
                        className="product-main-img"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="product-designed-placeholder">
                        <div className="placeholder-halo"></div>
                        <span className="placeholder-big-icon" aria-hidden="true">
                          {category?.icon || product.categoryIcon || '💻'}
                        </span>
                        <div className="placeholder-watermark">ARS COMPUTERS</div>
                        <div className="placeholder-genuine-tag">
                          <span>{product.isGeneric ? '📦 Solution Configuration' : '🛡️ Certified Genuine Hardware'}</span>
                        </div>
                      </div>
                    )}

                    <div className="product-visual-badges">
                      <span className="visual-badge-oem">{product.isGeneric ? 'Custom Solution' : 'Hardware Supply'}</span>
                      {product.images && product.images.length > 1 ? (
                        <span className="visual-badge-warranty">📷 {activeImageIndex + 1} of {product.images.length} Photos</span>
                      ) : (
                        <span className="visual-badge-warranty">{product.isGeneric ? 'Solution Group' : 'Genuine Hardware'}</span>
                      )}
                    </div>
                  </div>

                  {/* Hardware photo caption for multi-image galleries */}
                  {product.slug && PRODUCT_IMAGE_CAPTIONS[product.slug] && PRODUCT_IMAGE_CAPTIONS[product.slug][activeImageIndex] && (
                    <div className="product-image-caption" aria-label="Photo description">
                      <span className="caption-tag">Hardware View</span>
                      <span className="caption-text">{PRODUCT_IMAGE_CAPTIONS[product.slug][activeImageIndex]}</span>
                    </div>
                  )}

                  {/* Thumbnail gallery selector for multi-image products */}
                  {product.images && product.images.length > 1 && (
                    <div className="product-thumbnails-strip" aria-label="Product image gallery">
                      {product.images.map((imgSrc, idx) => {
                        const thumbLabel = PRODUCT_IMAGE_CAPTIONS[product.slug]?.[idx] || `${product.name} - View ${idx + 1}`
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`product-thumb-btn ${activeImageIndex === idx ? 'active' : ''}`}
                            onClick={() => setActiveImageIndex(idx)}
                            aria-label={`View photo ${idx + 1}: ${thumbLabel}`}
                            title={thumbLabel}
                          >
                            <img src={imgSrc} alt="" className="product-thumb-img" />
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Trust Highlights below visual */}
                  <div className="product-trust-strip">
                    <div className="trust-strip-item">
                      <span className="trust-icon" aria-hidden="true">🛠️</span>
                      <div>
                        <strong>Installation Support</strong>
                        <span>Available on-site &amp; remote</span>
                      </div>
                    </div>
                    <div className="trust-strip-item">
                      <span className="trust-icon" aria-hidden="true">⚡</span>
                      <div>
                        <strong>Same-Day Dispatch</strong>
                        <span>For in-stock configurations</span>
                      </div>
                    </div>
                    <div className="trust-strip-item">
                      <span className="trust-icon" aria-hidden="true">📜</span>
                      <div>
                        <strong>GST Invoice</strong>
                        <span>Full input tax credit eligibility</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Specifications & Purchasing Panel */}
                <div className="product-info-column">
                  <div className="product-meta-header">
                    <span className="product-category-chip">
                      {category?.icon} {category?.title || 'Hardware'}
                    </span>
                    {product.brand ? (
                      <span className="product-brand-chip">Brand: {product.brand}</span>
                    ) : product.isGeneric ? (
                      <span className="product-brand-chip generic-chip">Solution Group</span>
                    ) : null}
                    {product.isFeatured && (
                      <span className="product-featured-badge">★ Featured</span>
                    )}
                  </div>

                  <h1 className="product-details-title">{product.name}</h1>

                  {product.model && (
                    <div className="product-model-number">
                      Model / SKU: <span>{product.model || product.sku}</span>
                    </div>
                  )}

                  {/* Pricing and Stock Bar */}
                  <div className="product-pricing-card">
                    {typeof product.price === 'number' && product.price > 0 && (
                      <div className="pricing-col">
                        <span className="pricing-label">Official Pricing</span>
                        <div className="pricing-value-wrap">
                          <span className="pricing-main-val">
                            ₹{Number(product.price).toLocaleString('en-IN')}
                          </span>
                          <span className="pricing-tax-note">+ GST (Input Credit Available)</span>
                        </div>
                      </div>
                    )}

                    <div className="stock-col">
                      <span className="pricing-label">Availability</span>
                      {product.availabilityStatus === 'in_stock' || (typeof product.stock === 'number' && product.stock > 0) ? (
                        <div className="stock-status-pill in-stock">
                          <span className="stock-dot"></span>
                          <span>In Stock{typeof product.stock === 'number' && product.stock > 0 ? ` (${product.stock} units available)` : ''}</span>
                        </div>
                      ) : product.availabilityStatus === 'out_of_stock' ? (
                        <div className="stock-status-pill out-of-stock">
                          <span className="stock-dot"></span>
                          <span>Out of Stock</span>
                        </div>
                      ) : product.availabilityStatus === 'discontinued' ? (
                        <div className="stock-status-pill discontinued">
                          <span className="stock-dot"></span>
                          <span>Discontinued Model</span>
                        </div>
                      ) : (
                        <div className="stock-status-pill on-demand">
                          <span className="stock-dot"></span>
                          <span>Contact us for availability</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary CTA Buttons */}
                  <div className="product-cta-bar">
                    <WhatsAppButton
                      product={product}
                      category={category}
                      label="Buy"
                      className="whatsapp-detail-btn"
                    />
                    <button
                      type="button"
                      className={`product-select-btn product-detail-select-btn ${isSelected(product) ? 'selected' : ''}`}
                      aria-pressed={isSelected(product)}
                      disabled={!isSelected(product) && isFull}
                      title={
                        !isSelected(product) && isFull
                          ? `You can send up to ${maxSelection} products in one WhatsApp enquiry.`
                          : isSelected(product)
                            ? 'Remove this product from the WhatsApp enquiry'
                            : 'Add this product to a combined WhatsApp enquiry'
                      }
                      onClick={() => toggle(product, category)}
                    >
                      {isSelected(product) ? '✓ Added to enquiry' : '+ Add to enquiry'}
                    </button>
                    <a
                      href={ARS_SALES_TEL_HREF}
                      className="btn-outline btn-lg phone-cta"
                      aria-label={`Call ARS Computers at ${ARS_SALES_DISPLAY_NUMBER}`}
                      title={`Call ARS Computers at ${ARS_SALES_DISPLAY_NUMBER}`}
                    >
                      📞 Call Sales Desk
                    </a>
                  </div>
                  <p className="whatsapp-cta-note">
                    Opens WhatsApp with this product&apos;s details prefilled. No order is
                    confirmed and no payment is collected on this website.
                  </p>
                  {/* Product Overview & Key Features */}
                  <div className="product-overview-card">
                    <div className="overview-header">
                      <h3 className="specs-section-title">Product Overview</h3>
                      {verification && (
                        <div
                          className={`spec-verification-badge ${verification.tone}`}
                          title={verification.description}
                        >
                          <span className="verification-icon" aria-hidden="true">{verification.icon}</span>
                          <span className="verification-text">
                            <strong>{verification.label}</strong>
                            <small>{verification.description}</small>
                          </span>
                        </div>
                      )}
                    </div>
                    {product.description ? (
                      <p className="product-description-text">{product.description}</p>
                    ) : (
                      <p className="product-description-text muted">Product description is being updated by the admin.</p>
                    )}
                    {product.spec && (
                      <div className="config-summary-callout">
                        <span className="config-summary-label">Configuration Summary</span>
                        <p>{product.spec}</p>
                      </div>
                    )}
                  </div>

                  {Array.isArray(product.keyFeatures) && product.keyFeatures.length > 0 && (
                    <div className="product-key-features">
                      <h3 className="specs-section-title">Key Features &amp; Highlights</h3>
                      <ul className="key-features-list">
                        {product.keyFeatures.map((feature, idx) => (
                          <li key={idx}>
                            <span className="feature-check" aria-hidden="true">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Organised Technical Specifications */}
                  {specTable.sections.length > 0 && (
                    <div className="product-spec-card">
                      <div className="spec-card-header">
                        <h3 className="specs-section-title">{specTable.label}</h3>
                        <span className="spec-group-count">{specTable.sections.length} section{specTable.sections.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="spec-groups">
                        {specTable.sections.map((section) => (
                          <section className="spec-group" key={section.title}>
                            <h4 className="spec-group-title">{section.title}</h4>
                            <dl className="spec-list">
                              {section.rows.map((row) => (
                                <div className="spec-line" key={row.key}>
                                  <dt className="spec-line-label">{row.label}</dt>
                                  <dd className="spec-line-value">{row.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </section>
                        ))}
                      </div>
                      {product.specSource && (
                        <p className="spec-source-note">
                          <strong>Verification source:</strong> {product.specSource}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Compatibility & Usage */}
                  {product.compatibility && (
                    <div className="product-compatibility-card">
                      <h3 className="specs-section-title">Compatibility &amp; Usage</h3>
                      <p>{product.compatibility}</p>
                    </div>
                  )}

                  {/* Warranty & Box Contents */}
                  <div className="product-support-card">
                    <h3 className="specs-section-title">Warranty &amp; What&apos;s in the Box</h3>
                    <div className="support-grid">
                      <div className="support-item">
                        <span className="support-label">Warranty</span>
                        <p>{product.warrantyText || 'Not specified by manufacturer — confirmed by ARS Computers at order.'}</p>
                      </div>
                      <div className="support-item">
                        <span className="support-label">Box Contents</span>
                        <p>{product.boxContents || 'Box contents are confirmed at order.'}</p>
                      </div>
                      {product.hsnCode && (
                        <div className="support-item">
                          <span className="support-label">HSN Code</span>
                          <p>{product.hsnCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Related Products from this Category */}
              {relatedProducts.length > 0 && (
                <section className="related-products-section">
                  <div className="related-header">
                    <h3>More Hardware in {category?.title || 'This Category'}</h3>
                    <Link
                      to={`/category/${category?.slug || category?.id}`}
                      className="related-view-all-link"
                    >
                      View All {category?.title} →
                    </Link>
                  </div>

                  <div className="related-products-grid">
                    {relatedProducts.slice(0, 3).map((item) => (
                      <div
                        key={item.slug || item.id}
                        className="related-product-card"
                        onClick={() => navigate(`/products/${item.slug}`)}
                      >
                        <div className="related-card-top">
                          <span className="related-card-icon">{category?.icon || '💻'}</span>
                          <span className="related-card-category">{category?.shortTitle || category?.title}</span>
                        </div>
                        <h4 className="related-card-title">{item.name}</h4>
                        <p className="related-card-spec">{item.spec}</p>
                        <div className="related-card-footer">
                          <span className="related-card-action">View Details →</span>
                          <WhatsAppButton
                            product={item}
                            category={category}
                            label="Buy"
                            className="whatsapp-related-btn"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}
      </main>

      <WhatsAppSelectionBar selected={selected} onClear={clear} />

      <SiteFooter />
    </div>
  )
}
