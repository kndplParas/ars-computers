import { useState, useId, useEffect, useRef } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAdminData } from '../../context/adminDataContext'
import { supabase } from '../../lib/supabase'
import { VALID_AVAILABILITY_STATUSES } from '../../data/productTemplate'

/**
 * ============================================================================
 * ARS Computers — Product Management Console (Step 4A / 4G)
 * ============================================================================
 * Features:
 * 1. Filterable, searchable, responsive product catalog table and mobile cards
 * 2. Full Add Product modal with validation and local image preview
 * 3. Edit Product modal with pre-filled state and non-destructive save
 * 4. Soft-delete (deactivate) & reactivate flow with confirmation dialog
 * 5. Shared admin data context persisted in localStorage
 * ============================================================================
 */

export default function AdminProductsPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'

  const {
    products,
    setProducts,
    categories,
    isLiveDatabase,
    isLoadingProducts,
    databaseError,
    isPermissionDenied,
    pagination,
    loadAdminCatalog,
    findCategory,
    addProduct,
    updateProduct,
    softDeleteProduct,
    reactivateProduct
  } = useAdminData()

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [activeStatusFilter, setActiveStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isReadOnlyView, setIsReadOnlyView] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null) // null for 'add', object for 'edit'
  const [formData, setFormData] = useState(getEmptyFormData())
  const [formErrors, setFormErrors] = useState({})

  // Soft-deactivation confirmation modal state
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  // Success / notification banner
  const [notification, setNotification] = useState(null)

  // Track created Object URLs to revoke them and prevent memory leaks
  const createdObjectUrlsRef = useRef(new Set())

  const showNotification = (msg, type = 'success') => {
    setNotification({ text: msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Trigger paginated database query when filters or page changes in live database mode
  useEffect(() => {
    if (isLiveDatabase && loadAdminCatalog) {
      loadAdminCatalog({
        categoryId: categoryFilter === 'all' ? null : categoryFilter,
        page: currentPage,
        limit: pageSize
      })
    }
  }, [isLiveDatabase, categoryFilter, currentPage, pageSize, loadAdminCatalog])

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urlsRef = createdObjectUrlsRef.current
    return () => {
      urlsRef.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore cleanup errors
        }
      })
      urlsRef.clear()
    }
  }, [])

  function getEmptyFormData() {
    return {
      name: '',
      category_id: 'computer-laptop',
      sku: '',
      brand: '',
      model: '',
      is_generic: false,
      spec_summary: '',
      spec_attributes_text: '',
      price: '',
      cost_price: '',
      stock_quantity: 0,
      min_stock_alert: 2,
      availability_status: 'in_stock',
      warranty_text: '',
      hsn_code: '',
      is_featured: false,
      is_active: true,
      images: []
    }
  }

  // Helper to dynamically resolve category title across UUID and slug
  const getProductCategoryTitle = (product) => {
    return product.categoryTitle || findCategory(product.category_id)?.title || 'Hardware'
  }

  // Compute metrics
  const totalCount = products.length
  const activeCount = products.filter((p) => p.is_active).length
  const inactiveCount = products.filter((p) => !p.is_active).length
  const lowStockCount = products.filter(
    (p) => p.is_active && p.stock_quantity <= (p.min_stock_alert || 2)
  ).length

  // Filter products based on search, category, availability, and active status
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.spec_summary && p.spec_summary.toLowerCase().includes(q))

    const matchesCategory =
      categoryFilter === 'all' ||
      p.category_id === categoryFilter ||
      findCategory(p.category_id)?.id === categoryFilter ||
      findCategory(p.category_id)?.slug === categoryFilter

    const matchesAvailability =
      availabilityFilter === 'all' || p.availability_status === availabilityFilter

    const matchesActiveStatus =
      activeStatusFilter === 'all'
        ? true
        : activeStatusFilter === 'active'
        ? p.is_active === true
        : p.is_active === false

    return matchesSearch && matchesCategory && matchesAvailability && matchesActiveStatus
  })

  const hasActiveFilters =
    searchQuery !== '' ||
    categoryFilter !== 'all' ||
    availabilityFilter !== 'all' ||
    activeStatusFilter !== 'all'

  const handleClearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setAvailabilityFilter('all')
    setActiveStatusFilter('all')
    setCurrentPage(1)
  }

  // Open Add Product Modal (Superadmin Only)
  const handleOpenAddModal = () => {
    if (!isSuperadmin) {
      showNotification('Access denied: Product creation requires superadministrator privileges.', 'warning')
      return
    }
    setIsReadOnlyView(false)
    setEditingProduct(null)
    setFormData(getEmptyFormData())
    setFormErrors({})
    setIsFormModalOpen(true)
  }

  // Open Edit Product Modal (Superadmin Only; delegates to View for read-only staff)
  const handleOpenEditModal = (product) => {
    if (!isSuperadmin) {
      handleOpenViewModal(product)
      return
    }
    setIsReadOnlyView(false)
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      category_id: product.category_id || 'computer-laptop',
      sku: product.sku || '',
      brand: product.brand || '',
      model: product.model || '',
      is_generic: Boolean(product.is_generic),
      spec_summary: product.spec_summary || '',
      spec_attributes_text:
        typeof product.spec_attributes === 'object' && product.spec_attributes !== null
          ? Object.entries(product.spec_attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')
          : '',
      price: product.price !== null && product.price !== undefined ? product.price : '',
      cost_price:
        product.cost_price !== null && product.cost_price !== undefined
          ? product.cost_price
          : '',
      stock_quantity: product.stock_quantity ?? 0,
      min_stock_alert: product.min_stock_alert ?? 2,
      availability_status: product.availability_status || 'in_stock',
      warranty_text: product.warranty_text || '',
      hsn_code: product.hsn_code || '',
      is_featured: Boolean(product.is_featured),
      is_active: product.is_active !== false,
      images: Array.isArray(product.images) ? [...product.images] : []
    })
    setFormErrors({})
    setIsFormModalOpen(true)
  }

  // Open View Details Modal (Read-Only for Admin Employee)
  const handleOpenViewModal = (product) => {
    setIsReadOnlyView(true)
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      category_id: product.category_id || 'computer-laptop',
      sku: product.sku || '',
      brand: product.brand || '',
      model: product.model || '',
      is_generic: Boolean(product.is_generic),
      spec_summary: product.spec_summary || '',
      spec_attributes_text:
        typeof product.spec_attributes === 'object' && product.spec_attributes !== null
          ? Object.entries(product.spec_attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')
          : '',
      price: product.price !== null && product.price !== undefined ? product.price : '',
      cost_price:
        product.cost_price !== null && product.cost_price !== undefined
          ? product.cost_price
          : '',
      stock_quantity: product.stock_quantity ?? 0,
      min_stock_alert: product.min_stock_alert ?? 2,
      availability_status: product.availability_status || 'in_stock',
      warranty_text: product.warranty_text || '',
      hsn_code: product.hsn_code || '',
      is_featured: Boolean(product.is_featured),
      is_active: product.is_active !== false,
      images: Array.isArray(product.images) ? [...product.images] : []
    })
    setFormErrors({})
    setIsFormModalOpen(true)
  }

  // Allowed MIME types and max size matching storage security policies
  const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

  // Handle Image Upload / Preview Selection with Storage Policy Validations
  const handleImageFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validUrls = []
    const rejectedMessages = []

    for (const file of files) {
      // 1. File size check (5 MB limit)
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        rejectedMessages.push(`"${file.name}" exceeds the 5 MB file size limit`)
        continue
      }
      // 2. MIME type check (JPEG, PNG, WebP, AVIF only)
      if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
        rejectedMessages.push(`"${file.name}" has an unsupported format (${file.type || 'unknown'}). Only JPEG, PNG, WebP, and AVIF are allowed`)
        continue
      }

      // If Supabase is live: upload directly to permanent Supabase Storage
      if (isLiveDatabase && supabase) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const storagePath = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            console.error('Storage upload error:', uploadError)
            rejectedMessages.push(`Upload failed for "${file.name}": ${uploadError.message}`)
            continue
          }

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(storagePath)

          validUrls.push(publicUrl)
        } catch (uploadErr) {
          console.error('Upload exception:', uploadErr)
          rejectedMessages.push(`Upload error for "${file.name}": ${uploadErr.message}`)
        }
      } else {
        const url = URL.createObjectURL(file)
        createdObjectUrlsRef.current.add(url)
        validUrls.push(url)
      }
    }

    if (rejectedMessages.length > 0) {
      showNotification(`Image validation notice: ${rejectedMessages.join('; ')}`, 'warning')
    }

    if (validUrls.length > 0) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...validUrls]
      }))
      showNotification(`Uploaded ${validUrls.length} image(s) to permanent storage.`, 'success')
    }

    // Reset input value so same file can be re-selected if removed
    e.target.value = ''
  }

  const handleRemoveImage = (indexToRemove) => {
    setFormData((prev) => {
      const targetUrl = prev.images[indexToRemove]
      if (targetUrl && createdObjectUrlsRef.current.has(targetUrl)) {
        try {
          URL.revokeObjectURL(targetUrl)
          createdObjectUrlsRef.current.delete(targetUrl)
        } catch {
          // ignore
        }
      }
      return {
        ...prev,
        images: prev.images.filter((_, idx) => idx !== indexToRemove)
      }
    })
  }

  // Form Validation
  const validateForm = () => {
    const errors = {}

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      errors.name = 'Product name is required (minimum 3 characters).'
    }

    if (!formData.category_id) {
      errors.category_id = 'Please select a valid category.'
    }

    if (!formData.is_generic) {
      if (!formData.brand.trim()) {
        errors.brand = 'Brand is required for physical OEM products (or select Solution Package).'
      }
      if (!formData.model.trim()) {
        errors.model = 'Model/series number is required for physical OEM products.'
      }
    }

    // Number validations
    if (formData.price !== '' && formData.price !== null) {
      const p = Number(formData.price)
      if (isNaN(p) || p < 0) {
        errors.price = 'Selling price must be a non-negative number.'
      }
    }

    if (formData.cost_price !== '' && formData.cost_price !== null) {
      const c = Number(formData.cost_price)
      if (isNaN(c) || c < 0) {
        errors.cost_price = 'Purchase cost must be a non-negative number.'
      }
    }

    if (formData.stock_quantity !== '' && formData.stock_quantity !== null) {
      const s = Number(formData.stock_quantity)
      if (isNaN(s) || s < 0 || !Number.isInteger(s)) {
        errors.stock_quantity = 'Stock quantity must be a non-negative integer.'
      }
    }

    if (formData.min_stock_alert !== '' && formData.min_stock_alert !== null) {
      const m = Number(formData.min_stock_alert)
      if (isNaN(m) || m < 0 || !Number.isInteger(m)) {
        errors.min_stock_alert = 'Minimum stock alert must be a non-negative integer.'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Form Submit (Add or Edit)
  const handleSaveProduct = async (e) => {
    e.preventDefault()

    if (!isSuperadmin) {
      showNotification('Access denied: Product modifications require superadministrator privileges.', 'warning')
      setIsFormModalOpen(false)
      return
    }

    if (!validateForm()) {
      return
    }

    // Parse attributes text into JSON object
    const specAttributes = {}
    if (formData.spec_attributes_text.trim()) {
      const lines = formData.spec_attributes_text.split('\n')
      lines.forEach((line) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim()
          const val = line.slice(colonIdx + 1).trim()
          if (key && val) {
            specAttributes[key] = val
          }
        }
      })
    }

    const matchedCategory = categories.find(
      (c) => c.slug === formData.category_id || c.id === formData.category_id || c.dbId === formData.category_id
    )
    const categoryTitle = matchedCategory ? (matchedCategory.title || matchedCategory.name) : 'Hardware'
    const resolvedCategoryId = matchedCategory?.dbId || matchedCategory?.id || formData.category_id

    const processedPayload = {
      name: formData.name.trim(),
      category_id: resolvedCategoryId,
      sku: formData.sku.trim() || null,
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      is_generic: Boolean(formData.is_generic),
      spec_summary: formData.spec_summary.trim() || null,
      spec_attributes: specAttributes,
      price:
        formData.price !== '' && formData.price !== null && !isNaN(Number(formData.price))
          ? Number(formData.price)
          : null,
      cost_price:
        formData.cost_price !== '' && formData.cost_price !== null && !isNaN(Number(formData.cost_price))
          ? Number(formData.cost_price)
          : null,
      stock_quantity: Number(formData.stock_quantity) || 0,
      min_stock_alert: Number(formData.min_stock_alert) || 2,
      availability_status: formData.availability_status || 'in_stock',
      warranty_text: formData.warranty_text.trim() || null,
      hsn_code: formData.hsn_code.trim() || null,
      is_featured: Boolean(formData.is_featured),
      is_active: Boolean(formData.is_active),
      images: formData.images
    }

    try {
      if (editingProduct) {
        if (updateProduct) {
          await updateProduct(editingProduct.id, processedPayload)
        } else {
          setProducts((prev) =>
            prev.map((item) =>
              item.id === editingProduct.id
                ? {
                    ...item,
                    ...processedPayload,
                    categoryTitle,
                    id: editingProduct.id,
                    slug: editingProduct.slug
                  }
                : item
            )
          )
        }
        showNotification(`Product "${processedPayload.name}" successfully updated.`)
      } else {
        const baseSlug = processedPayload.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        const newSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`

        const newRecord = {
          ...processedPayload,
          slug: newSlug
        }

        if (addProduct) {
          await addProduct(newRecord)
        } else {
          setProducts((prev) => [{ ...newRecord, categoryTitle, id: `prod-${Date.now()}` }, ...prev])
        }
        showNotification(`Product "${newRecord.name}" successfully added to catalogue.`)
      }

      setIsFormModalOpen(false)
    } catch (err) {
      console.error('Failed to save product:', err)
      showNotification(`Save failed: ${err.message}`, 'error')
    }
  }

  // Soft Deactivate / Reactivate Handlers
  const handlePromptDeactivate = (product) => {
    if (!isSuperadmin) {
      showNotification('Access denied: Product deactivation or reactivation requires superadministrator privileges.', 'warning')
      return
    }
    setDeactivateTarget(product)
  }

  const handleConfirmDeactivation = async () => {
    if (!deactivateTarget) return

    const targetId = deactivateTarget.id
    const targetName = deactivateTarget.name
    const isCurrentlyActive = deactivateTarget.is_active

    try {
      if (isCurrentlyActive) {
        if (softDeleteProduct) {
          await softDeleteProduct(targetId)
        } else {
          setProducts((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, is_active: false } : item
            )
          )
        }
        showNotification(
          `Product "${targetName}" soft-deactivated via soft_delete_product RPC. Hidden from customer website, preserved in admin under Inactive filter.`
        )
      } else {
        if (reactivateProduct) {
          await reactivateProduct(targetId)
        } else {
          setProducts((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, is_active: true } : item
            )
          )
        }
        showNotification(
          `Product "${targetName}" reactivated. Now visible in active customer catalogue.`
        )
      }
    } catch (err) {
      showNotification(`Deactivation/Reactivation failed: ${err.message}`, 'error')
    } finally {
      setDeactivateTarget(null)
    }
  }

  const categoryFilterId = useId()
  const availabilityFilterId = useId()
  const activeStatusFilterId = useId()

  return (
    <AdminLayout activeTab="products">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-action-toast ${notification.type}`}>
          <span className="toast-icon">
            {notification.type === 'success' ? '✓' : 'ℹ️'}
          </span>
          <span className="toast-message">{notification.text}</span>
        </div>
      )}

      <div className="admin-products-view-container">
        {/* Page Header */}
        <div className="admin-view-header">
          <div>
            <div className="admin-page-title-wrap">
              <h1 className="admin-view-title">Products</h1>
              {isLiveDatabase ? (
                <span className="live-db-pill" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem' }} title="Connected to Supabase PostgreSQL database">
                  🟢 Supabase Live
                </span>
              ) : (
                <span className="demo-badge-pill" title="Local mock state only">
                  🟡 Demo UI
                </span>
              )}
            </div>
            <p className="admin-view-subtitle">
              Manage physical OEM hardware SKUs, solution packages, pricing, stock levels, and active catalogue states.
            </p>
          </div>

          <div className="admin-view-actions">
            {isSuperadmin ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenAddModal}
                id="add-product-btn"
              >
                <span className="btn-plus-icon">+</span>
                <span>Add Product</span>
              </button>
            ) : (
              <span
                className="read-only-role-badge"
                title="Admin employees have read-only access. Product additions require superadministrator privileges."
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

        {/* Counts & Status Metric Cards */}
        <div className="products-stats-row">
          <div className="product-stat-card">
            <span className="stat-label">Total Products</span>
            <span className="stat-number">{totalCount}</span>
            <span className="stat-subtext">Catalog Records</span>
          </div>

          <div className="product-stat-card active-card">
            <span className="stat-label">Active Listed</span>
            <span className="stat-number text-success">{activeCount}</span>
            <span className="stat-subtext">Customer Visible</span>
          </div>

          <div className="product-stat-card inactive-card">
            <span className="stat-label">Inactive / Draft</span>
            <span className="stat-number text-muted">{inactiveCount}</span>
            <span className="stat-subtext">Soft-Deactivated</span>
          </div>

          <div className="product-stat-card warning-card">
            <span className="stat-label">Low Stock Items</span>
            <span className="stat-number text-warning">{lowStockCount}</span>
            <span className="stat-subtext">At / Below Threshold</span>
          </div>
        </div>

        {/* Toolbar: Search & Multi-Filters */}
        <div className="admin-product-toolbar">
          <div className="toolbar-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search by product name, brand, model, SKU, specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>

          <div className="toolbar-filters-group">
            {/* Category Filter */}
            <div className="filter-select-wrap">
              <label htmlFor={categoryFilterId} className="filter-label-inline">
                Category:
              </label>
              <select
                id={categoryFilterId}
                className="admin-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="all">All Categories ({products.length})</option>
                {categories.map((cat) => {
                  const cVal = cat.id || cat.slug
                  const countInCat = products.filter(
                    (p) => p.category_id === cat.id || p.category_id === cat.slug
                  ).length
                  return (
                    <option key={cVal} value={cVal}>
                      {cat.title || cat.name} {countInCat > 0 ? `(${countInCat})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="filter-select-wrap">
              <label htmlFor={availabilityFilterId} className="filter-label-inline">
                Availability:
              </label>
              <select
                id={availabilityFilterId}
                className="admin-select"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="all">All Availability States</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="on_demand">On Demand / Custom</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>

            {/* Active Status Filter */}
            <div className="filter-select-wrap">
              <label htmlFor={activeStatusFilterId} className="filter-label-inline">
                Status:
              </label>
              <select
                id={activeStatusFilterId}
                className="admin-select"
                value={activeStatusFilter}
                onChange={(e) => setActiveStatusFilter(e.target.value)}
              >
                <option value="all">All Records ({totalCount})</option>
                <option value="active">Active Only ({activeCount})</option>
                <option value="inactive">Inactive Only ({inactiveCount})</option>
              </select>
            </div>

            {/* Clear Filters Action */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
                title="Reset all filters and search query"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Counter & Data Source Indicator */}
        <div className="product-results-summary-bar">
          <span className="results-count-text">
            Showing <strong>{filteredProducts.length}</strong> of {totalCount} products
            {hasActiveFilters && ' (filtered)'}
          </span>
          {isLiveDatabase ? (
            <span className="live-notice-tag" style={{ color: '#047857', fontWeight: 600 }}>
              🟢 Database Mode — Commercial Records loaded via get_admin_products (Read-Only)
            </span>
          ) : (
            <span className="demo-notice-tag">
              ℹ️ Demo Mode — Changes saved in this browser only
            </span>
          )}
        </div>

        {/* Permission Denied / Database Error Alert */}
        {databaseError && (
          <div className="admin-login-alert error" role="alert" style={{ marginBottom: '20px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span className="alert-icon" style={{ fontSize: '1.4rem' }}>
              {isPermissionDenied ? '🔒' : '⚠️'}
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '1rem' }}>
                {isPermissionDenied ? 'Access Restricted: Store Administrator Privileges Required' : 'Database Connection / Query Error'}
              </strong>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.4' }}>
                {isPermissionDenied
                  ? 'Your authenticated staff role does not hold permissions to view commercial product catalog with confidential cost pricing. Contact a Superadministrator to adjust permissions.'
                  : databaseError}
              </p>
              <button
                type="button"
                className="btn-outline btn-sm"
                style={{ marginTop: '10px' }}
                onClick={() =>
                  loadAdminCatalog({
                    categoryId: categoryFilter === 'all' ? null : categoryFilter,
                    page: currentPage,
                    limit: pageSize
                  })
                }
              >
                🔄 Retry Database Query
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {isLoadingProducts && (
          <div className="admin-loading-card" style={{ margin: '30px auto', textAlign: 'center', padding: '32px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div className="loading-spinner"></div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>Loading Commercial Catalog...</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Querying active products and commercial data via get_admin_products RPC.
            </p>
          </div>
        )}

        {/* Desktop & Tablet Table View */}
        <div className="admin-table-container products-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Image</th>
                <th style={{ minWidth: '220px' }}>Product Name</th>
                <th>Category</th>
                <th>Brand &amp; Model</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Availability</th>
                <th>Active</th>
                <th className="text-right" style={{ minWidth: '150px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="admin-empty-cell">
                    <div className="empty-state-wrap">
                      <span className="empty-icon" aria-hidden="true">📦</span>
                      <h3>No products match your criteria</h3>
                      <p>Try searching for a different keyword or resetting filters.</p>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        style={{ marginTop: '12px' }}
                        onClick={handleClearFilters}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const hasImage = Array.isArray(p.images) && p.images.length > 0
                  const isLowStock = p.is_active && p.stock_quantity <= (p.min_stock_alert || 2)

                  return (
                    <tr
                      key={p.id}
                      className={`product-table-row ${!p.is_active ? 'row-inactive' : ''}`}
                    >
                      {/* Thumbnail Column */}
                      <td className="product-thumb-cell">
                        <div className="table-thumbnail-box">
                          {hasImage ? (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="table-img-preview"
                              loading="lazy"
                            />
                          ) : (
                            <span className="placeholder-device-icon" aria-hidden="true">
                              {p.is_generic ? '📦' : '💻'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name & Type */}
                      <td className="product-name-column">
                        <div className="name-cell-content">
                          <span className="product-grid-title" title={p.name}>
                            {p.name}
                          </span>
                          <div className="product-tags-subline">
                            {p.sku && (
                              <span className="sku-badge" title="Stock Keeping Unit">
                                SKU: {p.sku}
                              </span>
                            )}
                            <span
                              className={`type-chip ${p.is_generic ? 'generic-type' : 'oem-type'}`}
                            >
                              {p.is_generic ? 'Solution Package' : 'Physical OEM'}
                            </span>
                            {p.is_featured && (
                              <span className="featured-star-pill" title="Featured product">
                                ★ Featured
                              </span>
                            )}
                          </div>
                          {p.spec_summary && (
                            <span className="spec-inline-muted" title={p.spec_summary}>
                              {p.spec_summary}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="table-chip category">{getProductCategoryTitle(p)}</span>
                      </td>

                      {/* Brand & Model */}
                      <td>
                        {p.brand || p.model ? (
                          <div className="brand-model-cell">
                            <strong>{p.brand || '—'}</strong>
                            <span className="model-subline">{p.model || '—'}</span>
                          </div>
                        ) : (
                          <span className="text-light-muted">Multi-Brand Package</span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td>
                        {p.price !== null && p.price !== undefined && p.price > 0 ? (
                          <div className="price-display-wrap">
                            <span className="selling-price-val">
                              ₹{Number(p.price).toLocaleString('en-IN')}
                            </span>
                            {p.cost_price ? (
                              <span
                                className="cost-confidential-tag"
                                title="Cost Price is strictly confidential and never displayed on customer-facing website"
                              >
                                Cost: ₹{Number(p.cost_price).toLocaleString('en-IN')}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="price-not-set-badge" title="No verified commercial price set">
                            Not set (Custom Quote)
                          </span>
                        )}
                      </td>

                      {/* Stock Quantity */}
                      <td>
                        <div className="stock-level-wrap">
                          <span className={`stock-count-number ${isLowStock ? 'stock-low' : ''}`}>
                            {p.stock_quantity}
                          </span>
                          {isLowStock && p.stock_quantity > 0 && (
                            <span className="low-stock-alert-pill" title="Stock is below threshold">
                              Low Stock (≤{p.min_stock_alert})
                            </span>
                          )}
                          {p.stock_quantity === 0 && (
                            <span className="zero-stock-pill">Zero Stock</span>
                          )}
                        </div>
                      </td>

                      {/* Availability */}
                      <td>
                        <span className={`status-pill availability-${p.availability_status}`}>
                          {p.availability_status === 'in_stock'
                            ? 'In Stock'
                            : p.availability_status === 'out_of_stock'
                            ? 'Out of Stock'
                            : p.availability_status === 'on_demand'
                            ? 'On Demand'
                            : 'Discontinued'}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td>
                        <span
                          className={`status-pill ${p.is_active ? 'active' : 'inactive'}`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="table-actions-group">
                          {isSuperadmin ? (
                            <>
                              <button
                                type="button"
                                className="btn-action-icon edit"
                                onClick={() => handleOpenEditModal(p)}
                                title="Edit product information"
                              >
                                ✏️ Edit
                              </button>

                              <button
                                type="button"
                                className={`btn-action-icon ${p.is_active ? 'deactivate' : 'reactivate'}`}
                                onClick={() => handlePromptDeactivate(p)}
                                title={p.is_active ? 'Soft-deactivate product' : 'Reactivate product'}
                              >
                                {p.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn-action-icon view"
                              onClick={() => handleOpenViewModal(p)}
                              title="View product details (Read-Only)"
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

        {/* Mobile Product Cards View (Shown on screens <= 768px) */}
        <div className="mobile-products-cards-list">
          {filteredProducts.map((p) => {
            const hasImage = Array.isArray(p.images) && p.images.length > 0
            return (
              <div
                key={p.id}
                className={`mobile-product-card ${!p.is_active ? 'card-inactive' : ''}`}
              >
                <div className="card-top-row">
                  <div className="mobile-thumb">
                    {hasImage ? (
                      <img src={p.images[0]} alt={p.name} loading="lazy" />
                    ) : (
                      <span>{p.is_generic ? '📦' : '💻'}</span>
                    )}
                  </div>
                  <div className="mobile-card-meta">
                    <div className="mobile-category-row">
                      <span className="table-chip category">{getProductCategoryTitle(p)}</span>
                      <span className={`status-pill ${p.is_active ? 'active' : 'inactive'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="mobile-card-title">{p.name}</h3>
                    {(p.brand || p.model) && (
                      <span className="mobile-brand-model">
                        {p.brand} {p.model ? `• ${p.model}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mobile-specs-snippet">
                  {p.spec_summary || 'No specification summary provided.'}
                </div>

                <div className="mobile-card-stats-grid">
                  <div>
                    <span className="stats-label">Price:</span>
                    <strong>
                      {p.price ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Not set'}
                    </strong>
                  </div>
                  <div>
                    <span className="stats-label">Stock:</span>
                    <strong className={p.stock_quantity <= p.min_stock_alert ? 'text-warning' : ''}>
                      {p.stock_quantity} units
                    </strong>
                  </div>
                  <div>
                    <span className="stats-label">Status:</span>
                    <span className={`status-pill availability-${p.availability_status}`}>
                      {p.availability_status.replace('_', ' ')}
                    </span>
                  </div>
                  {p.sku && (
                    <div>
                      <span className="stats-label">SKU:</span>
                      <span className="sku-badge">{p.sku}</span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  {isSuperadmin ? (
                    <>
                      <button
                        type="button"
                        className="btn-outline btn-sm btn-block"
                        onClick={() => handleOpenEditModal(p)}
                      >
                        ✏️ Edit Product
                      </button>
                      <button
                        type="button"
                        className={`btn-sm btn-block ${
                          p.is_active ? 'btn-danger-outline' : 'btn-success-outline'
                        }`}
                        onClick={() => handlePromptDeactivate(p)}
                      >
                        {p.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-outline btn-sm btn-block"
                      onClick={() => handleOpenViewModal(p)}
                    >
                      👁️ View Details
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bounded Pagination Controls Bar */}
        <div className="admin-pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '16px' }}>
          <div className="pagination-info" style={{ fontSize: '0.88rem', color: '#64748b' }}>
            <span>
              Page <strong>{currentPage}</strong>{' '}
              {isLiveDatabase
                ? pagination?.totalLoaded !== undefined
                  ? `(${pagination.totalLoaded} items loaded on this page)`
                  : ''
                : `(${products.length} local demo items)`}
            </span>
          </div>

          <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={currentPage <= 1 || isLoadingProducts}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, padding: '0 8px' }}>
              Page {currentPage}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!pagination?.hasMore || isLoadingProducts}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next →
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
              <label htmlFor="admin-page-size-select" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Per page:
              </label>
              <select
                id="admin-page-size-select"
                className="admin-select"
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ADD / EDIT PRODUCT MODAL FORM
          ====================================================================== */}
      {isFormModalOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsFormModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-title"
        >
          <div
            className="admin-modal-dialog product-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="product-form-title" className="admin-modal-title">
                  {isReadOnlyView
                    ? 'Product Details (Read-Only)'
                    : editingProduct
                    ? 'Edit Product'
                    : 'Add New Hardware Product'}
                </h2>
                <span className="modal-subtitle-note">
                  {isReadOnlyView
                    ? 'Full product technical specifications and commercial parameters'
                    : editingProduct
                    ? `Updating ID: ${editingProduct.id} (Local Demo State)`
                    : 'Configure commercial and technical specifications'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsFormModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="admin-modal-body">
              <fieldset
                disabled={isReadOnlyView || !isSuperadmin}
                style={{ border: 'none', margin: 0, padding: 0 }}
              >
                {/* Product Type Selector */}
                <div className="form-group product-type-group">
                <span className="form-label">Product Architecture Type *</span>
                <div className="product-type-radio-grid">
                  <label
                    className={`type-radio-card ${!formData.is_generic ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="is_generic"
                      checked={!formData.is_generic}
                      onChange={() => setFormData({ ...formData, is_generic: false })}
                    />
                    <div className="radio-content">
                      <strong>Physical OEM Hardware Item</strong>
                      <span>Verified part with manufacturer Brand, Model number &amp; OEM warranty</span>
                    </div>
                  </label>

                  <label
                    className={`type-radio-card ${formData.is_generic ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="is_generic"
                      checked={formData.is_generic}
                      onChange={() => setFormData({ ...formData, is_generic: true })}
                    />
                    <div className="radio-content">
                      <strong>Solution Package / Generic Offering</strong>
                      <span>Assembled system, multi-brand installation package, or turnkey solution</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Basic Details: Name & Category */}
              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="form-prod-name" className="form-label">
                    Product Title *
                  </label>
                  <input
                    id="form-prod-name"
                    type="text"
                    className={`form-input ${formErrors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Dell Latitude 3440 Laptop or 4K ColorVu Dome Camera"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  {formErrors.name && (
                    <span className="form-field-error">{formErrors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-cat" className="form-label">
                    Category *
                  </label>
                  <select
                    id="form-prod-cat"
                    className={`form-select ${formErrors.category_id ? 'input-error' : ''}`}
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <option key={cat.slug || cat.id} value={cat.slug || cat.id}>
                        {cat.title || cat.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.category_id && (
                    <span className="form-field-error">{formErrors.category_id}</span>
                  )}
                </div>
              </div>

              {/* Brand, Model, SKU */}
              <div className="form-row-3col">
                <div className="form-group">
                  <label htmlFor="form-prod-brand" className="form-label">
                    Brand {!formData.is_generic && '*'}
                  </label>
                  <input
                    id="form-prod-brand"
                    type="text"
                    className={`form-input ${formErrors.brand ? 'input-error' : ''}`}
                    placeholder="e.g. Dell, HP, Hikvision"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                  {formErrors.brand && (
                    <span className="form-field-error">{formErrors.brand}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-model" className="form-label">
                    Model Number {!formData.is_generic && '*'}
                  </label>
                  <input
                    id="form-prod-model"
                    type="text"
                    className={`form-input ${formErrors.model ? 'input-error' : ''}`}
                    placeholder="e.g. Latitude 3440"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                  {formErrors.model && (
                    <span className="form-field-error">{formErrors.model}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-sku" className="form-label">
                    SKU Code (Optional)
                  </label>
                  <input
                    id="form-prod-sku"
                    type="text"
                    className="form-input"
                    placeholder="e.g. DEL-LAT-3440"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>

              {/* Commercial Pricing & Confidential Cost */}
              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="form-prod-price" className="form-label">
                    Selling Price (₹ INR)
                  </label>
                  <input
                    id="form-prod-price"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-input ${formErrors.price ? 'input-error' : ''}`}
                    placeholder="e.g. 54500 (leave empty for custom quote)"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                  <span className="form-field-hint">
                    Public customer price. Leave blank or 0 to display &ldquo;Not set (Custom Quote)&rdquo;.
                  </span>
                  {formErrors.price && (
                    <span className="form-field-error">{formErrors.price}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-cost" className="form-label">
                    Purchase Cost (₹ INR) <span className="confidential-badge">🔒 Admin Only</span>
                  </label>
                  <input
                    id="form-prod-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-input ${formErrors.cost_price ? 'input-error' : ''}`}
                    placeholder="e.g. 46200"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                  <span className="form-field-hint">
                    Strictly confidential. Never returned to customer-facing APIs or browsers.
                  </span>
                  {formErrors.cost_price && (
                    <span className="form-field-error">{formErrors.cost_price}</span>
                  )}
                </div>
              </div>

              {/* Inventory & Availability */}
              <div className="form-row-3col">
                <div className="form-group">
                  <label htmlFor="form-prod-stock" className="form-label">
                    Stock Quantity *
                  </label>
                  <input
                    id="form-prod-stock"
                    type="number"
                    min="0"
                    step="1"
                    className={`form-input ${formErrors.stock_quantity ? 'input-error' : ''}`}
                    value={formData.stock_quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, stock_quantity: e.target.value })
                    }
                  />
                  {formErrors.stock_quantity && (
                    <span className="form-field-error">{formErrors.stock_quantity}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-alert" className="form-label">
                    Min Stock Alert
                  </label>
                  <input
                    id="form-prod-alert"
                    type="number"
                    min="0"
                    step="1"
                    className={`form-input ${formErrors.min_stock_alert ? 'input-error' : ''}`}
                    value={formData.min_stock_alert}
                    onChange={(e) =>
                      setFormData({ ...formData, min_stock_alert: e.target.value })
                    }
                  />
                  {formErrors.min_stock_alert && (
                    <span className="form-field-error">{formErrors.min_stock_alert}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-avail" className="form-label">
                    Availability Status *
                  </label>
                  <select
                    id="form-prod-avail"
                    className="form-select"
                    value={formData.availability_status}
                    onChange={(e) =>
                      setFormData({ ...formData, availability_status: e.target.value })
                    }
                  >
                    {VALID_AVAILABILITY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status === 'in_stock'
                          ? 'In Stock'
                          : status === 'out_of_stock'
                          ? 'Out of Stock'
                          : status === 'on_demand'
                          ? 'On Demand / Custom Order'
                          : 'Discontinued'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specifications */}
              <div className="form-group">
                <label htmlFor="form-prod-summary" className="form-label">
                  Short Specification Summary
                </label>
                <input
                  id="form-prod-summary"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Intel Core i5-1335U, 16GB DDR4, 512GB NVMe SSD, 14'' FHD Anti-Glare"
                  value={formData.spec_summary}
                  onChange={(e) => setFormData({ ...formData, spec_summary: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="form-prod-detailed-specs" className="form-label">
                  Detailed Specifications (Key: Value format, one per line)
                </label>
                <textarea
                  id="form-prod-detailed-specs"
                  rows="3"
                  className="form-textarea"
                  placeholder="Processor: Intel Core i5 13th Gen&#10;RAM: 16GB DDR4&#10;Display: 14-inch Full HD Anti-Glare"
                  value={formData.spec_attributes_text}
                  onChange={(e) =>
                    setFormData({ ...formData, spec_attributes_text: e.target.value })
                  }
                ></textarea>
              </div>

              {/* Warranty & HSN Code */}
              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="form-prod-warranty" className="form-label">
                    Warranty Terms
                  </label>
                  <input
                    id="form-prod-warranty"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 3 Years Comprehensive On-site OEM Warranty"
                    value={formData.warranty_text}
                    onChange={(e) => setFormData({ ...formData, warranty_text: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="form-prod-hsn" className="form-label">
                    GST HSN Code
                  </label>
                  <input
                    id="form-prod-hsn"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 84713010 for computers, 852580 for CCTV"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  />
                </div>
              </div>

              {/* Images Preview & Selection */}
              <div className="form-group">
                <label htmlFor="form-prod-images-input" className="form-label">
                  Product Images (Local File Selection &amp; Preview)
                </label>
                <input
                  id="form-prod-images-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="form-file-input"
                  onChange={handleImageFileChange}
                />
                <span className="form-field-hint">
                  Allowed formats: JPEG, PNG, WebP, AVIF (Max 5 MB per image). Automatically validates against storage security policies.
                </span>

                {formData.images.length > 0 && (
                  <div className="form-image-preview-strip">
                    {formData.images.map((imgUrl, idx) => (
                      <div key={idx} className="preview-thumb-item">
                        <img src={imgUrl} alt={`Product attachment ${idx + 1}`} />
                        <button
                          type="button"
                          className="remove-img-btn"
                          onClick={() => handleRemoveImage(idx)}
                          title="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggles: Featured & Active */}
              <div className="form-row-2col toggles-row">
                <label className="checkbox-toggle-card">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                  <div className="checkbox-text">
                    <strong>★ Feature on Homepage</strong>
                    <span>Highlight in top recommendation carousels</span>
                  </div>
                </label>

                <label className="checkbox-toggle-card">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <div className="checkbox-text">
                    <strong>Active Catalogue Status</strong>
                    <span>Uncheck to draft or soft-deactivate from customer store</span>
                  </div>
                </label>
              </div>
              </fieldset>

              {/* Modal Action Footer */}
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className={isReadOnlyView || !isSuperadmin ? 'btn-primary' : 'btn-outline'}
                  onClick={() => setIsFormModalOpen(false)}
                >
                  {isReadOnlyView || !isSuperadmin ? 'Close' : 'Cancel'}
                </button>
                {!isReadOnlyView && isSuperadmin && (
                  <button type="submit" className="btn-primary">
                    {editingProduct ? 'Save Changes' : 'Create Product'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          SOFT-DELETE / DEACTIVATE CONFIRMATION DIALOG
          ====================================================================== */}
      {deactivateTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setDeactivateTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-deactivate-title"
        >
          <div
            className="admin-modal-dialog confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header-warning">
              <span className="dialog-warn-icon" aria-hidden="true">
                {deactivateTarget.is_active ? '⚠️' : '🔄'}
              </span>
              <h3 id="confirm-deactivate-title">
                {deactivateTarget.is_active ? 'Deactivate Product?' : 'Reactivate Product?'}
              </h3>
            </div>

            <div className="dialog-body-text">
              <p>
                Are you sure you want to {deactivateTarget.is_active ? 'deactivate' : 'reactivate'}{' '}
                <strong>&ldquo;{deactivateTarget.name}&rdquo;</strong>?
              </p>
              {deactivateTarget.is_active ? (
                <div className="deactivate-policy-alert">
                  <strong>Soft-Delete Policy:</strong>
                  <p>
                    This will set <code>is_active = false</code>. The item will be instantly hidden from customer-facing category listings and direct product routes. It remains safely preserved in the database and accessible via the <em>Inactive</em> filter.
                  </p>
                </div>
              ) : (
                <div className="reactivate-policy-alert">
                  <strong>Reactivation:</strong>
                  <p>
                    This will set <code>is_active = true</code>. The product will immediately become visible to website visitors.
                  </p>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setDeactivateTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={deactivateTarget.is_active ? 'btn-danger' : 'btn-success'}
                onClick={handleConfirmDeactivation}
              >
                {deactivateTarget.is_active ? 'Confirm Deactivation' : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
