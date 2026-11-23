import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  fetchProductBySlug,
  fetchCategoryBySlug,
  getInstantProductBySlug
} from '../lib/catalog'
import { PRODUCT_IMAGE_CAPTIONS } from '../data/productImages'
import { getSpecTable } from '../data/specSchemas'
import { getProductRichDetails } from '../data/productRichData'
import ProductTechnicalDiagram from '../components/ProductTechnicalDiagram'
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
  const [selectedVariantId, setSelectedVariantId] = useState(() => {
    return initialData?.product?.defaultVariantId || initialData?.product?.variants?.[0]?.id || null
  })
  const [activeImageIndex, setActiveImageIndex] = useState(() => {
    const defaultVarId = initialData?.product?.defaultVariantId
    if (defaultVarId && Array.isArray(initialData?.product?.variants)) {
      const v = initialData.product.variants.find((item) => item.id === defaultVarId)
      if (typeof v?.imageIndex === 'number') return v.imageIndex
    }
    return 0
  })
  const [prevSlug, setPrevSlug] = useState(slug)
  const [isOpenZoomModal, setIsOpenZoomModal] = useState(false)
  const [modalZoom, setModalZoom] = useState(1)
  const [activeTab, setActiveTab] = useState('specs')
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const touchStartRef = useRef(null)

  const { selected, isSelected, toggle, clear, isFull, maxSelection } = useProductSelection()

  // Reset gallery and variant selection when navigating to a new product
  if (prevSlug !== slug) {
    setPrevSlug(slug)
    const defaultVarId = initialData?.product?.defaultVariantId
    let initialImgIdx = 0
    if (defaultVarId && Array.isArray(initialData?.product?.variants)) {
      const v = initialData.product.variants.find((item) => item.id === defaultVarId)
      if (typeof v?.imageIndex === 'number') initialImgIdx = v.imageIndex
    }
    setActiveImageIndex(initialImgIdx)
    setSelectedVariantId(defaultVarId || initialData?.product?.variants?.[0]?.id || null)
    setActiveTab('specs')
    setIsOpenZoomModal(false)
    setModalZoom(1)
  }

  // Synchronize variant when product data changes or receives defaultVariantId
  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      const targetVarId = product.defaultVariantId || selectedVariantId || product.variants[0].id
      setSelectedVariantId(targetVarId)
      const targetVar = product.variants.find((v) => v.id === targetVarId) || product.variants[0]
      if (typeof targetVar?.imageIndex === 'number' && product?.images?.[targetVar.imageIndex]) {
        setActiveImageIndex(targetVar.imageIndex)
      }
    } else {
      setSelectedVariantId(null)
    }
  }, [product?.slug, product?.defaultVariantId, product?.variants])

  // Lock body scroll when zoom modal is open
  useEffect(() => {
    if (isOpenZoomModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpenZoomModal])

  // Keyboard navigation for image gallery and ESC for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpenZoomModal) {
        setIsOpenZoomModal(false)
        setModalZoom(1)
      } else if (e.key === 'ArrowLeft' && product?.images?.length > 1) {
        handlePrevImage()
      } else if (e.key === 'ArrowRight' && product?.images?.length > 1) {
        handleNextImage()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpenZoomModal, product?.images?.length])

  const activeVariant =
    product?.variants?.find((v) => v.id === selectedVariantId) ||
    product?.variants?.[0] ||
    null

  const handleSelectVariant = (variant) => {
    setSelectedVariantId(variant.id)
    if (typeof variant.imageIndex === 'number' && product?.images?.[variant.imageIndex]) {
      setActiveImageIndex(variant.imageIndex)
    } else if (variant.image && Array.isArray(product?.images)) {
      const idx = product.images.findIndex((img) => img === variant.image)
      if (idx !== -1) setActiveImageIndex(idx)
    }
  }

  const currentSpec = activeVariant?.spec || product?.spec
  if (product && activeVariant) {
    product.selectedVariant = activeVariant
    product.currentSpec = currentSpec
  }

  const handlePrevImage = () => {
    if (!product?.images || product.images.length <= 1) return
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : product.images.length - 1))
  }

  const handleNextImage = () => {
    if (!product?.images || product.images.length <= 1) return
    setActiveImageIndex((prev) => (prev < product.images.length - 1 ? prev + 1 : 0))
  }

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartRef.current = e.touches[0].clientX
    }
  }

  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null) return
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = touchStartRef.current - e.changedTouches[0].clientX
      if (Math.abs(deltaX) > 40 && product?.images?.length > 1) {
        if (deltaX > 0) {
          handleNextImage()
        } else {
          handlePrevImage()
        }
      }
    }
    touchStartRef.current = null
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

  const richDetails = product ? getProductRichDetails(product, category) : null

  const currentCaption =
    (product?.slug && PRODUCT_IMAGE_CAPTIONS[product.slug]?.[activeImageIndex]) ||
    (product?.images && product.images.length > 1
      ? `${product.name} — Hardware View ${activeImageIndex + 1}`
      : `${product.name} — Certified Hardware Supply`)

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

        {/* 1. Skeleton Loading */}
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
          /* 3. Fully Rendered Product Page */
          product && (
            <div className="product-details-wrapper">
              {/* Primary Product Showcase Grid */}
              <section className="product-showcase-grid">
                {/* Left Column: Advanced Visual Hardware Gallery */}
                <div className="product-visual-column">
                  <div
                    className="product-image-frame"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Zoom / Lightbox Trigger Button */}
                    <button
                      type="button"
                      className="gallery-zoom-trigger"
                      onClick={() => setIsOpenZoomModal(true)}
                      title="Click to view enlarged photo"
                      aria-label="Zoom or enlarge image"
                    >
                      <span className="zoom-icon" aria-hidden="true">🔍</span>
                      <span>Enlarge View</span>
                    </button>

                    {/* Main Active Hardware Image */}
                    {product.images && product.images.length > 0 && (product.images[activeImageIndex] || product.images[0]) ? (
                      <img
                        src={product.images[activeImageIndex] || product.images[0]}
                        alt={`${product.name} view`}
                        className="product-main-img zoomable-cursor"
                        loading="lazy"
                        onClick={() => setIsOpenZoomModal(true)}
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

                    {/* Prev / Next Chevrons for multi-image products */}
                    {product.images && product.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="gallery-nav-arrow gallery-nav-prev"
                          onClick={handlePrevImage}
                          aria-label="Previous photo"
                          title="View previous photo (or Left Arrow)"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="gallery-nav-arrow gallery-nav-next"
                          onClick={handleNextImage}
                          aria-label="Next photo"
                          title="View next photo (or Right Arrow)"
                        >
                          ›
                        </button>
                      </>
                    )}

                    {/* Image Status Badges */}
                    <div className="product-visual-badges">
                      <span className="visual-badge-oem">{product.isGeneric ? 'Custom Solution' : 'Hardware Supply'}</span>
                      {product.images && product.images.length > 1 ? (
                        <span className="visual-badge-warranty">📷 {activeImageIndex + 1} of {product.images.length} Photos</span>
                      ) : (
                        <span className="visual-badge-warranty">{product.isGeneric ? 'Solution Group' : 'Certified Hardware'}</span>
                      )}
                    </div>
                  </div>

                  {/* Informative Hardware Photo Caption */}
                  <div className="product-image-caption" aria-label="Photo description">
                    <span className="caption-tag">Hardware View</span>
                    <span className="caption-text">{currentCaption}</span>
                  </div>

                  {/* Thumbnail Strip Selector */}
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

                  {/* Trust Highlights */}
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
                        <strong>GST Tax Invoice</strong>
                        <span>Full B2B input tax credit</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Key Details & Purchasing Actions */}
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

                  {/* Official Pricing */}
                  {typeof product.price === 'number' && product.price > 0 && (
                    <div className="product-pricing-card price-only">
                      <div className="pricing-col">
                        <span className="pricing-label">Official Pricing</span>
                        <div className="pricing-value-wrap">
                          <span className="pricing-main-val">
                            ₹{Number(product.price).toLocaleString('en-IN')}
                          </span>
                          <span className="pricing-tax-note">+ GST (Input Credit Available)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Short Product Description */}
                  <div className="short-description-card">
                    <span className="short-description-label">Product Summary</span>
                    <p className="short-description-text">
                      {product.shortDescription || product.description || 'Product-specific summary is verified by ARS Computers.'}
                    </p>
                  </div>

                  {/* Variant Selector */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="product-variant-selector-card">
                      <div className="variant-selector-header">
                        <span className="variant-selector-label">
                          {product.variantSelectorLabel || 'Select Option'}:
                        </span>
                        <span className="variant-active-badge">
                          {activeVariant?.label}
                        </span>
                      </div>
                      <div
                        className="variant-options-grid"
                        role="radiogroup"
                        aria-label={product.variantSelectorLabel || 'Product Options'}
                      >
                        {product.variants.map((v) => {
                          const isSelectedOption = v.id === activeVariant?.id
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={`variant-option-chip ${isSelectedOption ? 'active' : ''}`}
                              onClick={() => handleSelectVariant(v)}
                              role="radio"
                              aria-checked={isSelectedOption}
                            >
                              {v.label}
                            </button>
                          )
                        })}
                      </div>
                      {activeVariant?.spec && (
                        <p className="variant-active-spec-hint">
                          <strong>Selected variant:</strong> {activeVariant.spec}
                        </p>
                      )}
                    </div>
                  )}

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

                  {/* Highlights Bullet List */}
                  {Array.isArray(product.keyFeatures) && product.keyFeatures.length > 0 && (
                    <div className="product-key-features">
                      <h3 className="specs-section-title">Key Hardware Highlights</h3>
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
                </div>
              </section>

              {/* Comprehensive Product Information Hub (Tabs Navigation) */}
              <section className="product-info-tabs-section">
                <div className="info-tabs-bar" role="tablist" aria-label="Product Information Categories">
                  <button
                    type="button"
                    role="tab"
                    id="tab-specs"
                    aria-selected={activeTab === 'specs'}
                    aria-controls="panel-specs"
                    className={`info-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('specs')}
                  >
                    <span className="tab-icon">📑</span>
                    <span>Technical Specifications</span>
                    {specTable.sections.length > 0 && (
                      <span className="info-tab-badge">{specTable.sections.length}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    id="tab-ports"
                    aria-selected={activeTab === 'ports'}
                    aria-controls="panel-ports"
                    className={`info-tab-btn ${activeTab === 'ports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ports')}
                  >
                    <span className="tab-icon">🔌</span>
                    <span>Ports &amp; Interfaces</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    id="tab-applications"
                    aria-selected={activeTab === 'applications'}
                    aria-controls="panel-applications"
                    className={`info-tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('applications')}
                  >
                    <span className="tab-icon">💼</span>
                    <span>Applications &amp; Setup</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    id="tab-support"
                    aria-selected={activeTab === 'support'}
                    aria-controls="panel-support"
                    className={`info-tab-btn ${activeTab === 'support' ? 'active' : ''}`}
                    onClick={() => setActiveTab('support')}
                  >
                    <span className="tab-icon">🛡️</span>
                    <span>Box Contents &amp; Warranty</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    id="tab-faqs"
                    aria-selected={activeTab === 'faqs'}
                    aria-controls="panel-faqs"
                    className={`info-tab-btn ${activeTab === 'faqs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('faqs')}
                  >
                    <span className="tab-icon">❓</span>
                    <span>Frequently Asked Questions</span>
                    {richDetails?.faqs?.length > 0 && (
                      <span className="info-tab-badge">{richDetails.faqs.length}</span>
                    )}
                  </button>
                </div>

                <div className="info-tab-content-wrapper">
                  {/* TAB 1: Technical Specifications */}
                  {activeTab === 'specs' && (
                    <div
                      id="panel-specs"
                      role="tabpanel"
                      aria-labelledby="tab-specs"
                      className="tab-panel-container"
                    >
                      <div className="panel-header-row">
                        <div>
                          <h3 className="tab-panel-heading">{specTable.label}</h3>
                          <p className="tab-panel-subheading">
                            Certified hardware parameters and standard configuration parameters.
                          </p>
                        </div>
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

                      {product.description && (
                        <div className="tab-overview-box">
                          <h4>Product Overview</h4>
                          <p>{product.description}</p>
                          {currentSpec && (
                            <div className="config-summary-callout">
                              <span className="config-summary-label">Active Configuration Summary:</span>
                              <p>{currentSpec}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {specTable.sections.map((section) => (
                        <div className="spec-group-box" key={section.title}>
                          <h4 className="spec-group-title">{section.title}</h4>
                          <div className="spec-table-container">
                            <table className="spec-table">
                              <thead>
                                <tr>
                                  <th className="spec-th-label">Specification Parameter</th>
                                  <th className="spec-th-value">Hardware Standard / Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.rows.map((row) => (
                                  <tr key={row.key} className="spec-tr">
                                    <td className="spec-td-label">{row.label}</td>
                                    <td className="spec-td-value">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {product.specSource && (
                        <p className="spec-source-note">
                          <strong>Verification source:</strong> {product.specSource}
                        </p>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Ports & Connectivity */}
                  {activeTab === 'ports' && (
                    <div
                      id="panel-ports"
                      role="tabpanel"
                      aria-labelledby="tab-ports"
                      className="tab-panel-container"
                    >
                      <div className="panel-header-row">
                        <div>
                          <h3 className="tab-panel-heading">Ports, Connectivity &amp; Hardware Layout</h3>
                          <p className="tab-panel-subheading">
                            Verified interface standards, expansion slots, and display connectivity.
                          </p>
                        </div>
                      </div>

                      {/* Technical Architecture Diagram */}
                      {richDetails && (
                        <ProductTechnicalDiagram
                          diagramType={richDetails.diagramType}
                          productName={product.name}
                        />
                      )}

                      {/* Itemized Ports & Connectivity Grid */}
                      {richDetails?.ports && richDetails.ports.length > 0 && (
                        <div className="ports-section-wrap">
                          <h4 className="sub-section-title">Verified Hardware Interface Summary</h4>
                          <div className="ports-grid">
                            {richDetails.ports.map((port, idx) => (
                              <div className="port-card" key={idx}>
                                <div className="port-card-header">
                                  <span className="port-card-icon" aria-hidden="true">{port.icon}</span>
                                  <span className="port-card-name">{port.name}</span>
                                </div>
                                <p className="port-card-detail">{port.spec}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Standards & Compliance */}
                      {richDetails?.standards && (
                        <div className="standards-section-wrap">
                          <h4 className="sub-section-title">Supported Industry Standards &amp; Compliance</h4>
                          <div className="standards-grid">
                            {richDetails.standards.map((std, idx) => (
                              <div className="standard-item" key={idx}>
                                <span className="standard-name">{std.name}</span>
                                <span className="standard-desc">{std.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Applications & Setup Guide */}
                  {activeTab === 'applications' && (
                    <div
                      id="panel-applications"
                      role="tabpanel"
                      aria-labelledby="tab-applications"
                      className="tab-panel-container"
                    >
                      <div className="panel-header-row">
                        <div>
                          <h3 className="tab-panel-heading">Typical Applications &amp; Deployment Guide</h3>
                          <p className="tab-panel-subheading">
                            Practical commercial use cases and standard hardware setup procedure.
                          </p>
                        </div>
                      </div>

                      {/* Real-World Application Cards */}
                      {richDetails?.applications && (
                        <div className="applications-section-wrap">
                          <h4 className="sub-section-title">Recommended Real-World Use Cases</h4>
                          <div className="applications-grid">
                            {richDetails.applications.map((app, idx) => (
                              <div className="app-card" key={idx}>
                                <span className="app-icon" aria-hidden="true">{app.icon}</span>
                                <h5 className="app-title">{app.title}</h5>
                                <p className="app-desc">{app.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Step-by-Step Installation Checklist */}
                      {richDetails?.setupGuide && (
                        <div className="setup-guide-wrap">
                          <h4 className="sub-section-title">Step-by-Step Installation Checklist</h4>
                          <div className="setup-timeline">
                            {richDetails.setupGuide.map((item) => (
                              <div className="setup-step-item" key={item.step}>
                                <div className="step-badge">Step {item.step}</div>
                                <div className="step-body">
                                  <h5 className="step-title">{item.title}</h5>
                                  <p className="step-desc">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Physical & Environmental Requirements */}
                      {richDetails?.physicalSpecs && (
                        <div className="env-specs-box">
                          <h4 className="sub-section-title">Physical &amp; Operating Environment Standards</h4>
                          <div className="env-specs-grid">
                            <div className="env-spec-item">
                              <span className="env-label">Power Specification</span>
                              <span className="env-val">{richDetails.physicalSpecs.power}</span>
                            </div>
                            <div className="env-spec-item">
                              <span className="env-label">Dimensions / Form Factor</span>
                              <span className="env-val">{richDetails.physicalSpecs.dimensions}</span>
                            </div>
                            <div className="env-spec-item">
                              <span className="env-label">Operating Temperature</span>
                              <span className="env-val">{richDetails.physicalSpecs.operatingTemp}</span>
                            </div>
                            <div className="env-spec-item">
                              <span className="env-label">Unit Weight</span>
                              <span className="env-val">{richDetails.physicalSpecs.weight}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: Box Contents & Warranty */}
                  {activeTab === 'support' && (
                    <div
                      id="panel-support"
                      role="tabpanel"
                      aria-labelledby="tab-support"
                      className="tab-panel-container"
                    >
                      <div className="panel-header-row">
                        <div>
                          <h3 className="tab-panel-heading">Warranty, Box Contents &amp; Taxation</h3>
                          <p className="tab-panel-subheading">
                            Clear, authentic package details and enterprise tax documentation.
                          </p>
                        </div>
                      </div>

                      <div className="support-overview-grid">
                        <div className="support-box-card">
                          <div className="support-card-header">
                            <span className="support-header-icon" aria-hidden="true">📦</span>
                            <h4>What&apos;s in the Box</h4>
                          </div>
                          <p className="support-card-body">
                            {product.boxContents || 'Standard original manufacturer package containing the primary hardware unit, essential interface/power cabling, and user guide. Exact bundled accessories are confirmed prior to order.'}
                          </p>
                        </div>

                        <div className="support-box-card">
                          <div className="support-card-header">
                            <span className="support-header-icon" aria-hidden="true">🛡️</span>
                            <h4>Warranty &amp; Service Coverage</h4>
                          </div>
                          <p className="support-card-body">
                            {product.warrantyText || 'Genuine authorized manufacturer warranty across all authorized service centers in India, backed by ARS Computers local support desk in Haldwani / Uttarakhand.'}
                          </p>
                        </div>

                        <div className="support-box-card">
                          <div className="support-card-header">
                            <span className="support-header-icon" aria-hidden="true">📜</span>
                            <h4>B2B GST Tax Invoice</h4>
                          </div>
                          <p className="support-card-body">
                            Every purchase is accompanied by a 100% genuine tax invoice mentioning your company GSTIN, enabling full Input Tax Credit (ITC) eligibility under Indian GST laws.
                          </p>
                          {product.hsnCode && (
                            <div className="hsn-pill">HSN Code: <strong>{product.hsnCode}</strong></div>
                          )}
                        </div>

                        <div className="support-box-card">
                          <div className="support-card-header">
                            <span className="support-header-icon" aria-hidden="true">🤝</span>
                            <h4>ARS Computers Support Commitment</h4>
                          </div>
                          <p className="support-card-body">
                            Serving Haldwani, Nainital, and the Kumaon region for over 15 years with dedicated post-sales technical assistance, hardware upgrades, and enterprise deployment.
                          </p>
                        </div>
                      </div>

                      {product.compatibility && (
                        <div className="compatibility-callout">
                          <h4>Compatibility &amp; System Interoperability</h4>
                          <p>{product.compatibility}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: Frequently Asked Questions (FAQs) */}
                  {activeTab === 'faqs' && (
                    <div
                      id="panel-faqs"
                      role="tabpanel"
                      aria-labelledby="tab-faqs"
                      className="tab-panel-container"
                    >
                      <div className="panel-header-row">
                        <div>
                          <h3 className="tab-panel-heading">Frequently Asked Questions</h3>
                          <p className="tab-panel-subheading">
                            Direct answers to common customer questions about purchasing, installation, and support.
                          </p>
                        </div>
                      </div>

                      {richDetails?.faqs && (
                        <div className="faq-accordion">
                          {richDetails.faqs.map((faq, idx) => {
                            const isOpen = openFaqIndex === idx
                            return (
                              <div className={`faq-item ${isOpen ? 'open' : ''}`} key={idx}>
                                <button
                                  type="button"
                                  className="faq-question-btn"
                                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                  aria-expanded={isOpen}
                                >
                                  <span className="faq-q-text">{faq.q}</span>
                                  <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                                </button>
                                {isOpen && (
                                  <div className="faq-answer-panel">
                                    <p>{faq.a}</p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
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
                        <div className="related-card-img-wrap">
                          {item.images && item.images.length > 0 && item.images[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="related-card-img"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <span className="related-card-icon">{category?.icon || '💻'}</span>
                          )}
                        </div>
                        <div className="related-card-top">
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

              {/* Fullscreen Zoom & Lightbox Modal */}
              {isOpenZoomModal && (
                <div
                  className="gallery-lightbox-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Enlarged Product Gallery"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsOpenZoomModal(false)
                      setModalZoom(1)
                    }
                  }}
                >
                  <div className="lightbox-modal">
                    <div className="lightbox-header">
                      <div className="lightbox-title-info">
                        <span className="lightbox-product-title">{product.name}</span>
                        {product.images && product.images.length > 1 && (
                          <span className="lightbox-counter">
                            Photo {activeImageIndex + 1} of {product.images.length}
                          </span>
                        )}
                      </div>
                      <div className="lightbox-controls">
                        <button
                          type="button"
                          className="lightbox-zoom-toggle-btn"
                          onClick={() => setModalZoom((prev) => (prev === 1 ? 1.8 : prev === 1.8 ? 2.5 : 1))}
                          title={`Toggle zoom magnification (Current: ${modalZoom}x)`}
                        >
                          🔍 {modalZoom}x Zoom
                        </button>
                        <button
                          type="button"
                          className="lightbox-close-btn"
                          onClick={() => {
                            setIsOpenZoomModal(false)
                            setModalZoom(1)
                          }}
                          aria-label="Close enlarged photo"
                          title="Close (or press ESC)"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="lightbox-body">
                      {product.images && product.images.length > 1 && (
                        <button
                          type="button"
                          className="lightbox-nav-btn lightbox-nav-prev"
                          onClick={handlePrevImage}
                          aria-label="Previous photo"
                          title="Previous photo (or Left Arrow)"
                        >
                          ‹
                        </button>
                      )}

                      <div className="lightbox-img-viewport">
                        <img
                          src={product.images[activeImageIndex] || product.images[0]}
                          alt={`${product.name} enlarged view`}
                          className="lightbox-zoomed-img"
                          style={{ transform: `scale(${modalZoom})` }}
                        />
                      </div>

                      {product.images && product.images.length > 1 && (
                        <button
                          type="button"
                          className="lightbox-nav-btn lightbox-nav-next"
                          onClick={handleNextImage}
                          aria-label="Next photo"
                          title="Next photo (or Right Arrow)"
                        >
                          ›
                        </button>
                      )}
                    </div>

                    <div className="lightbox-footer">
                      <span className="lightbox-caption-tag">Hardware View</span>
                      <span className="lightbox-caption-text">{currentCaption}</span>
                    </div>
                  </div>
                </div>
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
