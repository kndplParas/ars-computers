import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  fetchProductBySlug,
  fetchCategoryBySlug,
  getInstantProductBySlug
} from '../lib/catalog'
import { PRODUCT_IMAGE_CAPTIONS } from '../data/productImages'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import WhatsAppButton from '../components/WhatsAppButton'
import WhatsAppSelectionBar from '../components/WhatsAppSelectionBar'
import { useProductSelection } from '../lib/useProductSelection'
import '../App.css'

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
                      href="tel:+919810000000"
                      className="btn-outline btn-lg phone-cta"
                    >
                      📞 Call Sales Desk
                    </a>
                  </div>
                  <p className="whatsapp-cta-note">
                    Opens WhatsApp with this product&apos;s details prefilled. No order is
                    confirmed and no payment is collected on this website.
                  </p>
                  {/* Product Overview & Description */}
                  {product.description && (
                    <div className="product-description-card">
                      <h3 className="specs-section-title">Product Overview</h3>
                      <p className="product-description-text">{product.description}</p>
                    </div>
                  )}
                  {/* Key Specifications Grid */}
                  <div className="product-specs-section">
                    <h3 className="specs-section-title">Hardware Specifications</h3>
                    <div className="specs-grid">
                      <div className="spec-row">
                        <span className="spec-label">Configuration Summary</span>
                        <span className="spec-value highlight">{product.spec}</span>
                      </div>

                      {product.brand && (
                        <div className="spec-row">
                          <span className="spec-label">Manufacturer / Brand</span>
                          <span className="spec-value">{product.brand}</span>
                        </div>
                      )}

                      {product.model && (
                        <div className="spec-row">
                          <span className="spec-label">Model Series</span>
                          <span className="spec-value">{product.model}</span>
                        </div>
                      )}

                      <div className="spec-row">
                        <span className="spec-label">Warranty</span>
                        <span className="spec-value">
                          {product.warrantyText || 'Standard policy applies / Inquire for model terms'}
                        </span>
                      </div>

                      {product.hsnCode && (
                        <div className="spec-row">
                          <span className="spec-label">HSN Code</span>
                          <span className="spec-value">{product.hsnCode}</span>
                        </div>
                      )}

                      <div className="spec-row">
                        <span className="spec-label">Installation &amp; Setup</span>
                        <span className="spec-value">Certified Engineering Setup Available</span>
                      </div>

                      {product.specAttributes && Object.keys(product.specAttributes).length > 0 && (
                        Object.entries(product.specAttributes).map(([key, val]) => (
                          <div key={key} className="spec-row">
                            <span className="spec-label">{key.replace(/_/g, ' ')}</span>
                            <span className="spec-value">{String(val)}</span>
                          </div>
                        ))
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
