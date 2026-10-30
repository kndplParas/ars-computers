import { useState, useMemo, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Category Management Console (Step 4D / 4G)
 * ============================================================================
 * Features:
 * 1. Category Dashboard: dynamic counts (Total, Active, Inactive, Associated Products).
 * 2. Search & Active/Inactive filter with quick clear action.
 * 3. Responsive Data Table (desktop) & Mobile Card List (phone/tablet).
 * 4. Add Category Modal with required Name & Slug, format validation, and
 *    duplicate slug detection.
 * 5. Edit Category Modal prefilled with category attributes and uniqueness check.
 * 6. Soft Deactivation / Reactivation flow with accessible confirmation dialog.
 * 7. Shared admin data context persisted in localStorage.
 * ============================================================================
 */

function generateUniqueId() {
  return 'cat-' + Math.random().toString(36).substr(2, 9)
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

export default function AdminCategoriesPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'

  const { categories, setCategories, products, loadAdminCategories } = useAdminData()

  useEffect(() => {
    if (loadAdminCategories) {
      loadAdminCategories()
    }
  }, [loadAdminCategories])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active_only', 'inactive_only'

  // Notification Toast
  const [notification, setNotification] = useState(null)

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReadOnlyView, setIsReadOnlyView] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null) // null = Add, object = Edit
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    tagline: '',
    description: '',
    icon: '📁',
    is_active: true
  })
  const [formErrors, setFormErrors] = useState({})
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

  // Deactivate Confirmation Modal State
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // --- Dynamic Associated Product Counts ---
  const productCountMap = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const cat = p.category_id
      if (cat) {
        map[cat] = (map[cat] || 0) + 1
      }
    })
    return map
  }, [products])

  const getProductCount = (catId, catSlug) => {
    return (productCountMap[catId] || 0) + (catSlug && catSlug !== catId ? (productCountMap[catSlug] || 0) : 0)
  }

  // --- Dynamic Dashboard Metrics ---
  const metrics = useMemo(() => {
    const total = categories.length
    const active = categories.filter((c) => c.is_active).length
    const inactive = categories.filter((c) => !c.is_active).length
    const totalProducts = products.length

    return { total, active, inactive, totalProducts }
  }, [categories, products])

  // --- Filtered Categories ---
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.slug && c.slug.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.tagline && c.tagline.toLowerCase().includes(q))

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active_only' && c.is_active) ||
        (statusFilter === 'inactive_only' && !c.is_active)

      return matchesSearch && matchesStatus
    })
  }, [categories, searchQuery, statusFilter])

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all'

  // --- Form Handlers ---
  const handleOpenAddModal = () => {
    if (!isSuperadmin) {
      showNotification('Access denied: Category creation requires superadministrator privileges.', 'warning')
      return
    }
    setIsReadOnlyView(false)
    setEditingCategory(null)
    setFormData({
      title: '',
      slug: '',
      tagline: '',
      description: '',
      icon: '📁',
      is_active: true
    })
    setFormErrors({})
    setIsSlugManuallyEdited(false)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (category) => {
    if (!isSuperadmin) {
      handleOpenViewModal(category)
      return
    }
    setIsReadOnlyView(false)
    setEditingCategory(category)
    setFormData({
      title: category.title || '',
      slug: category.slug || '',
      tagline: category.tagline || '',
      description: category.description || '',
      icon: category.icon || '📁',
      is_active: category.is_active ?? true
    })
    setFormErrors({})
    setIsSlugManuallyEdited(true)
    setIsModalOpen(true)
  }

  const handleOpenViewModal = (category) => {
    setIsReadOnlyView(true)
    setEditingCategory(category)
    setFormData({
      title: category.title || '',
      slug: category.slug || '',
      tagline: category.tagline || '',
      description: category.description || '',
      icon: category.icon || '📁',
      is_active: category.is_active ?? true
    })
    setFormErrors({})
    setIsSlugManuallyEdited(true)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormErrors({})
  }

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      // Auto-generate slug if adding and user has not manually modified slug
      slug: !isSlugManuallyEdited && !editingCategory ? slugify(newTitle) : prev.slug
    }))
    if (formErrors.title) {
      setFormErrors((prev) => ({ ...prev, title: null }))
    }
  }

  const handleSlugChange = (e) => {
    setIsSlugManuallyEdited(true)
    setFormData((prev) => ({ ...prev, slug: e.target.value }))
    if (formErrors.slug) {
      setFormErrors((prev) => ({ ...prev, slug: null }))
    }
  }

  // --- Validation ---
  const validateCategoryForm = () => {
    const errors = {}
    const trimmedTitle = formData.title.trim()
    const trimmedSlug = formData.slug.trim().toLowerCase()

    if (!trimmedTitle || trimmedTitle.length < 2) {
      errors.title = 'Category name is required (minimum 2 characters).'
    }

    if (!trimmedSlug) {
      errors.slug = 'Slug is required.'
    } else {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugRegex.test(trimmedSlug)) {
        errors.slug =
          'Slug must contain only lowercase alphanumeric characters and hyphens (e.g. networking-switches).'
      } else {
        // Duplicate slug check: cannot conflict with another category
        const isDuplicate = categories.some((c) => {
          if (editingCategory && c.id === editingCategory.id) {
            return false
          }
          return c.slug.toLowerCase() === trimmedSlug
        })

        if (isDuplicate) {
          errors.slug = `The slug "${trimmedSlug}" is already taken by another category. Please choose a unique slug.`
        }
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveCategory = (e) => {
    e.preventDefault()

    if (!isSuperadmin) {
      showNotification('Access denied: Modifying categories requires superadministrator privileges.', 'warning')
      handleCloseModal()
      return
    }

    if (!validateCategoryForm()) return

    const normalizedSlug = formData.slug.trim().toLowerCase()
    const trimmedTitle = formData.title.trim()

    if (editingCategory) {
      // Edit existing
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === editingCategory.id) {
            return {
              ...c,
              title: trimmedTitle,
              shortTitle: trimmedTitle,
              slug: normalizedSlug,
              tagline: formData.tagline.trim(),
              description: formData.description.trim(),
              icon: formData.icon.trim() || '📁',
              is_active: formData.is_active
            }
          }
          return c
        })
      )
      showNotification(`Category "${trimmedTitle}" updated (saved in this browser).`)
    } else {
      // Add new category
      const newCategory = {
        id: normalizedSlug || generateUniqueId(),
        slug: normalizedSlug,
        title: trimmedTitle,
        shortTitle: trimmedTitle,
        tagline: formData.tagline.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim() || '📁',
        badge: 'Custom',
        is_active: formData.is_active,
        products: []
      }
      setCategories((prev) => [newCategory, ...prev])
      showNotification(`Category "${trimmedTitle}" added (saved in this browser).`)
    }

    handleCloseModal()
  }

  // --- Soft Deactivate / Reactivate ---
  const handleOpenDeactivateModal = (category) => {
    if (!isSuperadmin) {
      showNotification('Access denied: Category deactivation requires superadministrator privileges.', 'warning')
      return
    }
    setDeactivateTarget(category)
  }

  const handleCloseDeactivateModal = () => {
    setDeactivateTarget(null)
  }

  const handleConfirmDeactivate = () => {
    if (!isSuperadmin) {
      showNotification('Access denied: Category deactivation requires superadministrator privileges.', 'warning')
      handleCloseDeactivateModal()
      return
    }
    if (!deactivateTarget) return

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === deactivateTarget.id) {
          return { ...c, is_active: false }
        }
        return c
      })
    )

    showNotification(`Category "${deactivateTarget.title}" soft-deactivated (saved in this browser).`)
    handleCloseDeactivateModal()
  }

  const handleReactivate = (category) => {
    if (!isSuperadmin) {
      showNotification('Access denied: Category reactivation requires superadministrator privileges.', 'warning')
      return
    }
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === category.id) {
          return { ...c, is_active: true }
        }
        return c
      })
    )
    showNotification(`Category "${category.title}" reactivated (saved in this browser).`)
  }

  return (
    <AdminLayout activeTab="categories">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-action-toast ${notification.type}`} role="alert">
          <span>{notification.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{notification.text}</span>
        </div>
      )}

      <div className="admin-products-view-container categories-page-container">
        {/* Top Page Header */}
        <div className="admin-view-header">
          <div>
            <div className="admin-page-title-wrap">
              <h1 className="admin-view-title">Categories</h1>
              <span className="demo-badge-pill" title="Local mock state only">
                Demo UI
              </span>
            </div>
            <p className="admin-view-subtitle">
              Organize hardware catalog departments, configure URL routing slugs, and monitor product volume per group.
            </p>
          </div>

          <div className="admin-view-actions">
            {isSuperadmin ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenAddModal}
                id="add-category-btn"
              >
                <span className="btn-plus-icon">+</span>
                <span>Add Category</span>
              </button>
            ) : (
              <span
                className="read-only-role-badge"
                title="Admin employees have read-only access. Category additions require superadministrator privileges."
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.88rem',
                  color: '#475569',
                  fontWeight: 600
                }}
              >
                🔒 Read-Only (Admin Employee)
              </span>
            )}
          </div>
        </div>

        {/* 1. Category Dashboard Summary Cards */}
        <div className="products-stats-row category-stats-row">
          <div className="product-stat-card">
            <span className="stat-label">Total Categories</span>
            <span className="stat-number">{metrics.total}</span>
            <span className="stat-subtext">Catalog Departments</span>
          </div>

          <div className="product-stat-card active-card">
            <span className="stat-label">Active Groups</span>
            <span className="stat-number text-success">{metrics.active}</span>
            <span className="stat-subtext">Visible on Storefront</span>
          </div>

          <div className="product-stat-card inactive-card">
            <span className="stat-label">Inactive / Draft</span>
            <span className="stat-number text-muted">{metrics.inactive}</span>
            <span className="stat-subtext">Soft-Deactivated</span>
          </div>

          <div className="product-stat-card info-card">
            <span className="stat-label">Catalog Products</span>
            <span className="stat-number text-info">{metrics.totalProducts}</span>
            <span className="stat-subtext">Total Linked SKUs</span>
          </div>
        </div>

        {/* 2. Filter & Search Toolbar */}
        <div className="admin-product-toolbar">
          <div className="toolbar-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              id="category-search-input"
              type="text"
              className="admin-search-input"
              placeholder="Search by category name, slug, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search categories by name, slug, or description"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          <div className="toolbar-filters-group">
            <div className="filter-select-wrap">
              <label htmlFor="cat-status-filter" className="filter-label-inline">
                Status:
              </label>
              <select
                id="cat-status-filter"
                className="admin-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All (Active &amp; Inactive)</option>
                <option value="active_only">Active Only</option>
                <option value="inactive_only">Inactive Only</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
                title="Reset active search and filters"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Bar */}
        <div className="product-results-summary-bar">
          <div>
            Showing <strong>{filteredCategories.length}</strong> of <strong>{categories.length}</strong> categories
            {hasActiveFilters && <span className="filtered-indicator"> (Filtered)</span>}
          </div>
          <div className="demo-notice-tag">
            <span>ℹ️ Demo Mode — Changes saved in this browser only</span>
          </div>
        </div>

        {/* 3. Desktop Category Data Table (contained horizontal scrolling) */}
        <div className="admin-table-container products-table-wrap category-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>Category Name</th>
                <th style={{ minWidth: '160px' }}>URL Slug</th>
                <th style={{ minWidth: '280px' }}>Description &amp; Tagline</th>
                <th style={{ minWidth: '130px', textAlign: 'center' }}>Linked Products</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '150px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-empty-cell">
                    <div className="empty-state-wrap">
                      <span className="empty-icon">📁</span>
                      <h3>No Categories Found</h3>
                      <p>No categories match your search or status filter.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={handleClearFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, index) => {
                  const productCount = getProductCount(cat.id, cat.slug)

                  return (
                    <tr
                      key={cat.id}
                      className={`product-table-row ${!cat.is_active ? 'row-inactive' : ''}`}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                        {index + 1}
                      </td>

                      {/* Name & Icon */}
                      <td>
                        <div className="category-title-cell">
                          <span className="category-icon-box">{cat.icon || '📁'}</span>
                          <div>
                            <strong className="category-name-text">{cat.title}</strong>
                            {cat.badge && (
                              <span className="category-badge-chip">{cat.badge}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td>
                        <code className="sku-badge slug-code">/category/{cat.slug}</code>
                      </td>

                      {/* Description & Tagline */}
                      <td>
                        <div className="category-desc-cell">
                          {cat.tagline && <span className="cat-tagline-text">{cat.tagline}</span>}
                          <p className="cat-desc-text">{cat.description || 'No description provided.'}</p>
                        </div>
                      </td>

                      {/* Linked Products Count */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="category-count-pill" title={`${productCount} products assigned to this category`}>
                          📦 {productCount} {productCount === 1 ? 'Product' : 'Products'}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill ${cat.is_active ? 'availability-in_stock' : 'availability-discontinued'}`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-actions-group">
                          {isSuperadmin ? (
                            <>
                              <button
                                type="button"
                                className="btn-action-icon edit"
                                onClick={() => handleOpenEditModal(cat)}
                                title={`Edit ${cat.title}`}
                              >
                                ✏️ Edit
                              </button>

                              {cat.is_active ? (
                                <button
                                  type="button"
                                  className="btn-action-icon deactivate"
                                  onClick={() => handleOpenDeactivateModal(cat)}
                                  title={`Deactivate ${cat.title}`}
                                >
                                  ✕ Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-action-icon reactivate"
                                  onClick={() => handleReactivate(cat)}
                                  title={`Reactivate ${cat.title}`}
                                >
                                  ✓ Reactivate
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn-action-icon view"
                              onClick={() => handleOpenViewModal(cat)}
                              title={`View ${cat.title} details (Read-Only)`}
                              style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
                            >
                              👁️ View Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Mobile Category Cards (< 900px) */}
        <div className="mobile-products-cards-list mobile-category-cards">
          {filteredCategories.length === 0 ? (
            <div className="empty-state-wrap mobile-empty-box">
              <span className="empty-icon">📁</span>
              <h3>No Categories Found</h3>
              <p>Adjust your search criteria or clear filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const productCount = getProductCount(cat.id, cat.slug)

              return (
                <div
                  key={cat.id}
                  className={`mobile-product-card ${!cat.is_active ? 'card-inactive' : ''}`}
                >
                  <div className="mobile-category-row">
                    <span className="category-title-icon-wrap">
                      <span className="cat-icon-inline">{cat.icon || '📁'}</span>
                      <strong className="mobile-card-title">{cat.title}</strong>
                    </span>
                    <span className={`status-pill ${cat.is_active ? 'availability-in_stock' : 'availability-discontinued'}`}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <code className="sku-badge slug-code">/category/{cat.slug}</code>

                  {cat.tagline && <span className="cat-tagline-text">{cat.tagline}</span>}
                  <p className="mobile-specs-snippet">{cat.description || 'No description provided.'}</p>

                  <div className="mobile-card-stats-grid">
                    <div>
                      <span className="stats-label">Linked Catalog:</span>
                      <strong>{productCount} items</strong>
                    </div>
                    <div>
                      <span className="stats-label">Identifier:</span>
                      <span>{cat.id}</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    {isSuperadmin ? (
                      <>
                        <button
                          type="button"
                          className="btn-outline btn-block"
                          onClick={() => handleOpenEditModal(cat)}
                        >
                          ✏️ Edit
                        </button>
                        {cat.is_active ? (
                          <button
                            type="button"
                            className="btn-danger-outline btn-block"
                            onClick={() => handleOpenDeactivateModal(cat)}
                          >
                            ✕ Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-success-outline btn-block"
                            onClick={() => handleReactivate(cat)}
                          >
                            ✓ Reactivate
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline btn-block"
                        onClick={() => handleOpenViewModal(cat)}
                      >
                        👁️ View Details
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 5. Add / Edit Category Modal */}
      {isModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
        >
          <div
            className="admin-modal-dialog category-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="category-modal-title" className="admin-modal-title">
                  {isReadOnlyView
                    ? `Category Details: ${editingCategory?.title}`
                    : editingCategory
                    ? `Edit Category: ${editingCategory.title}`
                    : 'Add New Category'}
                </h2>
                <span className="modal-subtitle-note">
                  {isReadOnlyView
                    ? 'Category specification and configuration details (Read-Only).'
                    : editingCategory
                    ? 'Update department attributes and display details.'
                    : 'Create a new hardware department for your store catalog.'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="admin-modal-body" noValidate>
              <fieldset disabled={isReadOnlyView || !isSuperadmin} style={{ border: 'none', margin: 0, padding: 0 }}>
                {/* Form Row: Name and Icon */}
                <div className="form-row-2col">
                  <div className="modal-field-group">
                    <label htmlFor="cat-name-input" className="modal-label">
                      Category Name <span className="required-star">*</span>
                    </label>
                    <input
                      id="cat-name-input"
                      type="text"
                      className={`modal-input ${formErrors.title ? 'input-error' : ''}`}
                      placeholder="e.g. Network Switches &amp; Routers"
                      value={formData.title}
                      onChange={handleTitleChange}
                      required
                    />
                    {formErrors.title && (
                      <span className="field-error-text">{formErrors.title}</span>
                    )}
                  </div>

                  <div className="modal-field-group">
                    <label htmlFor="cat-icon-input" className="modal-label">
                      Category Icon (Emoji)
                    </label>
                    <input
                      id="cat-icon-input"
                      type="text"
                      className="modal-input"
                      placeholder="e.g. 🌐, 💻, 📹"
                      value={formData.icon}
                      onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
                    />
                    <span className="modal-field-hint">Single emoji or character symbol.</span>
                  </div>
                </div>

                {/* URL Slug Field */}
                <div className="modal-field-group">
                  <label htmlFor="cat-slug-input" className="modal-label">
                    URL Slug <span className="required-star">*</span>
                  </label>
                  <input
                    id="cat-slug-input"
                    type="text"
                    className={`modal-input ${formErrors.slug ? 'input-error' : ''}`}
                    placeholder="e.g. network-switches-routers"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    required
                  />
                  {formErrors.slug ? (
                    <span className="field-error-text">{formErrors.slug}</span>
                  ) : (
                    <span className="modal-field-hint">
                      Used in web URL: <code>/category/{formData.slug || 'your-slug'}</code>. Must be unique.
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <div className="modal-field-group">
                  <label htmlFor="cat-tagline-input" className="modal-label">
                    Tagline (Optional)
                  </label>
                  <input
                    id="cat-tagline-input"
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Enterprise Gigabit Switches &amp; Rackmount Hardware"
                    value={formData.tagline}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                  />
                </div>

                {/* Description */}
                <div className="modal-field-group">
                  <label htmlFor="cat-desc-input" className="modal-label">
                    Description
                  </label>
                  <textarea
                    id="cat-desc-input"
                    rows="3"
                    className="modal-textarea"
                    placeholder="Provide an overview of the hardware types and solution offerings in this category..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Active Toggle */}
                <div className="modal-field-group checkbox-group">
                  <label className="checkbox-label-wrap">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                    />
                    <span>Active Category (Visible on Customer Storefront)</span>
                  </label>
                </div>
              </fieldset>

              {/* Modal Footer */}
              <div className="admin-modal-footer">
                {isReadOnlyView ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleCloseModal}
                  >
                    Close
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" id="save-category-submit-btn">
                      {editingCategory ? '✓ Save Changes' : '+ Create Category'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Soft Deactivation Confirmation Modal */}
      {deactivateTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={handleCloseDeactivateModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-cat-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2 id="deactivate-cat-title" className="admin-modal-title">
                Deactivate Category?
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseDeactivateModal}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p>
                Are you sure you want to deactivate <strong>"{deactivateTarget.title}"</strong> (<code>{deactivateTarget.slug}</code>)?
              </p>
              <div className="deactivate-warning-box">
                <p>
                  ⚠️ <strong>Notice:</strong> This category will be hidden from customer navigation menus. Associated product records ({getProductCount(deactivateTarget.id, deactivateTarget.slug)} items) will NOT be deleted, and you can reactivate this category at any time.
                </p>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={handleCloseDeactivateModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                id="confirm-deactivate-btn"
                onClick={handleConfirmDeactivate}
              >
                Deactivate Category
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
