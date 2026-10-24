import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  fetchProductBySlug,
  fetchCategoryBySlug,
  getInstantProductBySlug
} from '../lib/catalog'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { PRODUCT_IMAGE_CAPTIONS } from '../data/productImages'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import '../App.css'

export default function ProductDetailsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const quoteFormRef = useRef(null)

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

  // Reset gallery selection when navigating to a new product
  if (prevSlug !== slug) {
    setPrevSlug(slug)
    setActiveImageIndex(0)
  }

  // Product-specific enquiry state
  const [formData, setFormData] = useState({
    name: '',
    contact_info: '',
    message: initialData?.product
      ? `I would like to request an official quotation and stock availability for: ${initialData.product.name}. Please share pricing and warranty terms.`
      : ''
  })
  const [formStatus, setFormStatus] = useState({
    loading: false,
    success: false,
    error: null
  })

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

  const scrollToQuoteForm = () => {
    if (quoteFormRef.current) {
      quoteFormRef.current.scrollIntoView({ behavior: 'smooth' })
      const nameInput = document.getElementById('product-quote-name')
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 300)
      }
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleQuoteSubmit = async (e) => {
    e.preventDefault()

    if (formStatus.loading) return // Prevent accidental double submission

    const name = formData.name.trim()
    const contactInfo = formData.contact_info.trim()
    const message = formData.message.trim()

    if (name.length < 2) {
      setFormStatus({ loading: false, success: false, error: 'Please enter your full name (at least 2 characters).' })
      return
    }
    if (contactInfo.length < 5) {
      setFormStatus({ loading: false, success: false, error: 'Please enter a valid phone number or email (at least 5 characters).' })
      return
    }
    if (message.length < 5) {
      setFormStatus({ loading: false, success: false, error: 'Please specify your requirements (at least 5 characters).' })
      return
    }

    setFormStatus({ loading: true, success: false, error: null })

    const categoryInterest = category?.slug || category?.id || product?.categoryId || 'general'
    const fullMessage = `[Product Inquiry: ${product?.name} (Slug: ${slug})] ${message}`

    try {
      if (isSupabaseConfigured && supabase) {
        // Strict 8-second timeout on enquiry submission to avoid hanging
        const submitPromise = supabase.from('enquiries').insert([
          {
            name,
            contact_info: contactInfo,
            category_interest: categoryInterest,
            message: fullMessage,
            status: 'new'
          }
        ])

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Submission timed out')), 8000)
        )

        const { error: insertErr } = await Promise.race([submitPromise, timeoutPromise])

        if (insertErr) {
          throw insertErr
        }
      } else {
        // Graceful local handling when offline or unconfigured
        await new Promise(resolve => setTimeout(resolve, 400))
      }

      setFormStatus({ loading: false, success: true, error: null })
      setFormData({
        name: '',
        contact_info: '',
        message: ''
      })
    } catch (err) {
      setFormStatus({
        loading: false,
        success: false,
        error: err?.message || 'Unable to submit your quote request. Please call our desk directly.'
      })
    }
  }

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
                    <div className="pricing-col">
                      <span className="pricing-label">Official Pricing</span>
                      <div className="pricing-value-wrap">
                        {typeof product.price === 'number' && product.price > 0 ? (
                          <>
                            <span className="pricing-main-val">
                              ₹{Number(product.price).toLocaleString('en-IN')}
                            </span>
                            <span className="pricing-tax-note">+ GST (Input Credit Available)</span>
                          </>
                        ) : (
                          <div className="pricing-quote-callout">
                            <span className="quote-callout-pill">Competitive B2B / Retail Quote</span>
                            <span className="quote-callout-sub">Custom quotes provided based on quantity &amp; configuration</span>
                          </div>
                        )}
                      </div>
                    </div>

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
                          <span>Out of Stock / Inquire for Restock</span>
                        </div>
                      ) : product.availabilityStatus === 'discontinued' ? (
                        <div className="stock-status-pill discontinued">
                          <span className="stock-dot"></span>
                          <span>Discontinued Model</span>
                        </div>
                      ) : (
                        <div className="stock-status-pill on-demand">
                          <span className="stock-dot"></span>
                          <span>Available on Order / Custom Solution</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary CTA Buttons */}
                  <div className="product-cta-bar">
                    <button
                      className="btn-primary btn-lg"
                      onClick={scrollToQuoteForm}
                    >
                      Request Quotation &amp; Best Price →
                    </button>
                    <a
                      href="tel:+919810000000"
                      className="btn-outline btn-lg phone-cta"
                    >
                      📞 Call Sales Desk
                    </a>
                  </div>
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

              {/* Dedicated Product Quote Form */}
              <section className="product-quote-section" ref={quoteFormRef} id="quote-form">
                <div className="quote-form-container">
                  <div className="quote-form-header">
                    <span className="section-tag">Instant Sales Enquiry</span>
                    <h3 className="section-title">Request Quotation for {product.name}</h3>
                    <p className="section-subtitle">
                      Need custom hardware specifications, bulk order corporate discounts, or on-site deployment? Fill out the details below and our sales desk will reach out within 1 business hour.
                    </p>
                  </div>

                  {formStatus.success ? (
                    <div className="quote-success-banner">
                      <div className="success-icon">✓</div>
                      <h4>Quotation Request Received!</h4>
                      <p>
                        Thank you for your interest in <strong>{product.name}</strong>. Our engineering desk has received your request and will contact you promptly with itemized pricing and availability.
                      </p>
                      <button
                        className="btn-outline"
                        onClick={() => setFormStatus({ loading: false, success: false, error: null })}
                      >
                        Submit Another Request
                      </button>
                    </div>
                  ) : (
                    <form className="product-quote-form" onSubmit={handleQuoteSubmit}>
                      {formStatus.error && (
                        <div className="form-error-alert" role="alert">
                          ⚠️ {formStatus.error}
                        </div>
                      )}

                      <div className="form-grid-2">
                        <div className="form-group">
                          <label htmlFor="product-quote-name">
                            Your Name / Company Name <span className="req">*</span>
                          </label>
                          <input
                            id="product-quote-name"
                            name="name"
                            type="text"
                            required
                            placeholder="e.g. Rahul Sharma / ABC Logistics"
                            value={formData.name}
                            onChange={handleInputChange}
                            disabled={formStatus.loading}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="product-quote-contact">
                            Phone Number or Email <span className="req">*</span>
                          </label>
                          <input
                            id="product-quote-contact"
                            name="contact_info"
                            type="text"
                            required
                            placeholder="e.g. 9812345678 or sales@company.com"
                            value={formData.contact_info}
                            onChange={handleInputChange}
                            disabled={formStatus.loading}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="product-quote-message">
                          Requirements / Quantity / Notes <span className="req">*</span>
                        </label>
                        <textarea
                          id="product-quote-message"
                          name="message"
                          rows="4"
                          required
                          value={formData.message}
                          onChange={handleInputChange}
                          disabled={formStatus.loading}
                        ></textarea>
                      </div>

                      <button
                        type="submit"
                        className="btn-primary btn-lg w-full"
                        disabled={formStatus.loading}
                      >
                        {formStatus.loading ? 'Transmitting Request...' : 'Submit Official Quote Request →'}
                      </button>
                    </form>
                  )}
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
                          <span className="related-card-action">View Specs &amp; Quote →</span>
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

      <SiteFooter />
    </div>
  )
}
