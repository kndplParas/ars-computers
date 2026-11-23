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
import { formatSpecLabel } from '../data/specSchemas'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import WhatsAppButton from '../components/WhatsAppButton'
import WhatsAppSelectionBar from '../components/WhatsAppSelectionBar'
import { useProductSelection } from '../lib/useProductSelection'
import '../App.css'


const CATEGORY_SUBFILTERS = {
  'computer-laptop': [
    { id: 'all', label: 'All Models' },
    { id: 'laptops', label: 'Business Laptops', match: (p) => (p.slug || '').includes('laptop') || (p.slug || '').includes('notebook') },
    { id: 'aio-desktops', label: 'All-in-Ones & Desktops', match: (p) => (p.slug || '').includes('all-in-one') || (p.slug || '').includes('desktop') },
    { id: 'gaming-workstations', label: 'Gaming & Workstations', match: (p) => (p.slug || '').includes('gaming') || (p.slug || '').includes('workstation') || (p.slug || '').includes('rig') }
  ],
  cctv: [
    { id: 'all', label: 'All CCTV' },
    { id: 'dome', label: 'Dome Cameras', match: (p) => (p.slug || '').includes('dome') },
    { id: 'bullet-ptz', label: 'Bullet & PTZ Cameras', match: (p) => (p.slug || '').includes('bullet') || (p.slug || '').includes('ptz') },
    { id: 'recorders', label: 'DVR & NVR Recorders', match: (p) => (p.slug || '').includes('dvr') || (p.slug || '').includes('recorder') }
  ],
  printer: [
    { id: 'all', label: 'All Printers' },
    { id: 'ink-tank', label: 'Ink Tank Printers', match: (p) => (p.slug || '').includes('ink-tank') || (p.slug || '').includes('ecotank') || (p.slug || '').includes('pixma') },
    { id: 'laser', label: 'Monochrome Laser', match: (p) => (p.slug || '').includes('laser') && !(p.slug || '').includes('copier') && !(p.slug || '').includes('thermal') },
    { id: 'copiers', label: 'Color Laser Copiers', match: (p) => (p.slug || '').includes('copier') || (p.slug || '').includes('color-laserjet') },
    { id: 'pos', label: 'POS & Thermal', match: (p) => (p.slug || '').includes('thermal') || (p.slug || '').includes('barcode') || (p.slug || '').includes('receipt') }
  ],
  'biometric-machine': [
    { id: 'all', label: 'All Biometric & Access' },
    { id: 'face', label: 'Face Recognition', match: (p) => (p.slug || '').includes('face') },
    { id: 'fingerprint-rfid', label: 'Fingerprint & RFID', match: (p) => (p.slug || '').includes('fingerprint') || (p.slug || '').includes('rfid') },
    { id: 'door-lock', label: 'Access Hardware & Locks', match: (p) => (p.slug || '').includes('door') || (p.slug || '').includes('lock') || (p.slug || '').includes('access') }
  ],
  accessories: [
    { id: 'all', label: 'All Accessories' },
    { id: 'ram-ssd-storage', label: 'RAM & SSD' },
    { id: 'pc-components-cooling', label: 'Components & Cooling' },
    { id: 'keyboards-mice-mats', label: 'Keyboards & Mice' },
    { id: 'cables-interconnects', label: 'Cables & Power' },
    { id: 'adapters-converters-hubs', label: 'Adapters & Hubs' },
    { id: 'networking-cctv-accessories', label: 'Networking & CCTV' },
    { id: 'mounting-tools-maintenance', label: 'Mounts & Tools' },
    { id: 'desk-peripherals-cleaning', label: 'Peripherals' }
  ]
}

function getCardKeySpecs(item) {
  const specs = []
  const attrs = item.specAttributes || {}
  
  const priorityKeys = [
    'processor', 'ram', 'storage', 'display', 'gpu', 'os', 'form_factor',
    'resolution', 'night_vision', 'ir_range', 'lens', 'sensor', 'camera_type', 'channels',
    'printer_type', 'technology', 'print_speed', 'print_resolution', 'paper_size', 'duplex',
    'auth_methods', 'user_capacity', 'face_capacity', 'fingerprint_capacity', 'sensor_type', 'holding_force', 'door_type',
    'product_type', 'capacity', 'interface', 'speed', 'wattage', 'length', 'connector_type', 'data_transfer_rate', 'power_rating'
  ]

  for (const k of priorityKeys) {
    if (attrs[k] && String(attrs[k]).trim().length > 0) {
      specs.push({
        label: formatSpecLabel(k),
        value: String(attrs[k])
      })
      if (specs.length >= 4) break
    }
  }

  if (specs.length < 3) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v && String(v).trim().length > 0 && !specs.some((s) => s.label === formatSpecLabel(k))) {
        specs.push({
          label: formatSpecLabel(k),
          value: String(v)
        })
        if (specs.length >= 4) break
      }
    }
  }

  if (specs.length < 3 && item.spec) {
    const rawParts = item.spec.split(/[,;|]/).map((s) => s.trim()).filter((s) => s && !s.toLowerCase().includes('contact us'))
    for (const part of rawParts) {
      if (!specs.some((s) => s.value === part)) {
        specs.push({
          label: 'Specification',
          value: part
        })
        if (specs.length >= 4) break
      }
    }
  }

  return specs.slice(0, 4)
}

function getCardKeyFeatures(item) {
  if (Array.isArray(item.keyFeatures) && item.keyFeatures.length > 0) {
    return item.keyFeatures.slice(0, 2)
  }
  return []
}

function ProductCard({ item, category, navigate }) {
  const keySpecs = getCardKeySpecs(item)
  const keyFeatures = getCardKeyFeatures(item)
  const shortDescription = item.shortDescription || item.description || ''

  return (
    <article
      key={item.slug || item.id}
      className="category-product-card"
      onClick={() => navigate(`/products/${item.slug}`)}
    >
      {/* Visual hardware preview */}
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

        {item.images && item.images.length > 1 && (
          <span style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            fontSize: '10.5px',
            fontWeight: 600,
            background: 'rgba(15, 23, 42, 0.75)',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: '12px',
            backdropFilter: 'blur(4px)'
          }}>
            📷 {item.images.length} Photos
          </span>
        )}
      </div>

      {/* Product Info Body */}
      <div className="product-card-body">
        <div className="product-card-header">
          <span className="product-category-label">{category.title}</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {item.brand ? (
              <span className="product-brand-tag">{item.brand}</span>
            ) : item.isGeneric ? (
              <span className="product-brand-tag generic-tag">Hardware Solution</span>
            ) : null}
            {item.model && (
              <span className="product-model-tag">{item.model}</span>
            )}
          </div>
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

        {/* Short, useful product description */}
        {shortDescription && (
          <p className="product-card-desc">
            {shortDescription}
          </p>
        )}

        {/* 3 to 5 important technical specifications */}
        {keySpecs.length > 0 && (
          <div className="product-card-specs-list" aria-label="Technical Specifications">
            {keySpecs.map((s, idx) => (
              <span key={idx} className="product-card-spec-pill" title={`${s.label}: ${s.value}`}>
                <strong className="spec-pill-label">{s.label}:</strong>
                <span className="spec-pill-val">{s.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Key features or intended usage */}
        {keyFeatures.length > 0 && (
          <ul className="product-card-features-list" aria-label="Key Features & Intended Usage">
            {keyFeatures.map((f, idx) => (
              <li key={idx} className="product-card-feature-item">
                <span className="feature-item-icon" aria-hidden="true">✓</span>
                <span className="feature-item-text">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {item.variants && item.variants.length > 0 && (
          <div className="product-card-variants-badge" style={{ marginBottom: '12px' }}>
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
  const [activeSubfilter, setActiveSubfilter] = useState('all')
  const [allCategories, setAllCategories] = useState(() => initialCatalog?.categories || [])
  const [isLoading, setIsLoading] = useState(() => !initialData?.category)
  const [error, setError] = useState(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const { selected, clear } = useProductSelection()

  const isAccessories = category?.id === 'accessories' || normalizedSlug === 'accessories'
  const categoryKey = normalizedSlug || category?.id || slug
  const currentSubfilters = CATEGORY_SUBFILTERS[categoryKey] || null

  const groupedAccessories = useMemo(() => {
    if (!isAccessories) return []
    const allGroups = groupAccessories(products)
    if (activeSubfilter === 'all') return allGroups
    return allGroups.filter((grp) => grp.id === activeSubfilter)
  }, [isAccessories, products, activeSubfilter])

  const filteredProducts = useMemo(() => {
    if (isAccessories) return products
    if (activeSubfilter === 'all') return products
    const subfilterDef = currentSubfilters?.find((sf) => sf.id === activeSubfilter)
    if (subfilterDef?.match) {
      return products.filter(subfilterDef.match)
    }
    return products
  }, [isAccessories, products, activeSubfilter, currentSubfilters])

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
    setActiveSubfilter('all')
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

                  {/* Category-Specific Quick Filters */}
                  {currentSubfilters && currentSubfilters.length > 1 && (
                    <div className="category-subfilter-wrapper" aria-label="Filter models by type">
                      <div className="subfilter-header">
                        <span className="subfilter-label">
                          <span>⚡ Filter {category.title}:</span>
                        </span>
                        <span className="subfilter-active-count">
                          Showing {isAccessories ? (activeSubfilter === 'all' ? products.length : (groupedAccessories[0]?.products?.length || 0)) : filteredProducts.length} of {products.length} Models
                        </span>
                      </div>
                      <div className="subfilter-pills" role="tablist">
                        {currentSubfilters.map((sf) => {
                          const isActive = activeSubfilter === sf.id
                          let count = products.length
                          if (sf.id !== 'all') {
                            if (isAccessories) {
                              const g = groupAccessories(products).find((grp) => grp.id === sf.id)
                              count = g ? g.products.length : 0
                            } else if (sf.match) {
                              count = products.filter(sf.match).length
                            }
                          }
                          return (
                            <button
                              key={sf.id}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              className={`subfilter-btn ${isActive ? 'active' : ''}`}
                              onClick={() => setActiveSubfilter(sf.id)}
                            >
                              <span>{sf.label}</span>
                              <span className="btn-badge-count">({count})</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {products.length === 0 ? (
                    <div className="category-empty-state">
                      <p>No product models are currently cataloged under this category.</p>
                      <Link to="/#products" className="btn-primary">
                        View Other Categories
                      </Link>
                    </div>
                  ) : isAccessories ? (
                    groupedAccessories.length === 0 ? (
                      <div className="category-empty-state" style={{ padding: '32px 20px', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: '16px' }}>
                          No models found matching the selected filter.
                        </p>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setActiveSubfilter('all')}
                        >
                          Show All {category.title} Models
                        </button>
                      </div>
                    ) : (
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
                    )
                  ) : (
                    filteredProducts.length === 0 ? (
                      <div className="category-empty-state" style={{ padding: '32px 20px', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: '16px' }}>
                          No models found matching the selected filter.
                        </p>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setActiveSubfilter('all')}
                        >
                          Show All {category.title} Models
                        </button>
                      </div>
                    ) : (
                      <div className="category-product-cards-grid">
                        {filteredProducts.map((item) => (
                          <ProductCard
                            key={item.slug || item.id}
                            item={item}
                            category={category}
                            navigate={navigate}
                          />
                        ))}
                      </div>
                    )
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
