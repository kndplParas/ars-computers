import { useState, useMemo, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'

/**
 * ============================================================================
 * ARS Computers — Inventory Management Console (Step 4C / 4G)
 * ============================================================================
 * Features:
 * 1. Inventory Dashboard: dynamically calculated metric cards (Total, In Stock,
 *    Low Stock, Out of Stock, On Demand) from shared admin data.
 * 2. Search & Multi-Filters: search by Name, SKU, Brand, Model + Category
 *    dropdown + Availability dropdown + Low-Stock Quick Filter + Clear Filters.
 * 3. Inventory Data Table (desktop) & Mobile Card List (tablet/phone) with
 *    contained internal horizontal scrolling and zero page-level blowout.
 * 4. Update Stock Modal: update quantity, alert threshold, availability status,
 *    and change reason with validation, review & confirmation step, and toast.
 * 5. Shared React demo state persisted in localStorage.
 * ============================================================================
 */

const AVAILABILITY_OPTIONS = [
  { id: 'all', label: 'All Availability Statuses' },
  { id: 'in_stock', label: 'In Stock' },
  { id: 'out_of_stock', label: 'Out of Stock' },
  { id: 'on_demand', label: 'On Demand (Custom Quote)' },
  { id: 'discontinued', label: 'Discontinued' }
]

const STOCK_CHANGE_REASONS = [
  'Supplier Restock / GRN Receipt',
  'Routine Physical Count Audit',
  'Damaged / Defective Write-off',
  'Reserved for Enterprise Order',
  'Customer Return / RMA Restock',
  'Initial Baseline Setup',
  'Other Inventory Adjustment'
]

function getCurrentTimestampIso() {
  return new Date().toISOString()
}

export default function AdminInventoryPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'
  const isInventoryStaff = adminUser?.role === 'inventory_staff'
  const canUpdateStock = isSuperadmin || isInventoryStaff

  const { products, setProducts, categories, updateProductStock, loadAdminCatalog } = useAdminData()

  useEffect(() => {
    if (loadAdminCatalog) {
      loadAdminCatalog()
    }
  }, [loadAdminCatalog])

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  // Notification Toast
  const [notification, setNotification] = useState(null)

  // Update Stock Modal State
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isReadOnlyStockView, setIsReadOnlyStockView] = useState(false)
  const [stockFormData, setStockFormData] = useState({
    stock_quantity: 0,
    min_stock_alert: 0,
    availability_status: 'in_stock',
    change_reason: STOCK_CHANGE_REASONS[0],
    notes: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [isConfirmingSave, setIsConfirmingSave] = useState(false)

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // --- Dynamic Dashboard Metrics ---
  const metrics = useMemo(() => {
    const total = products.length
    const inStock = products.filter((p) => p.availability_status === 'in_stock').length
    // Low stock: quantity <= min alert threshold AND active AND physical stock item (not discontinued or on-demand)
    const lowStock = products.filter(
      (p) =>
        p.is_active !== false &&
        p.availability_status !== 'discontinued' &&
        p.availability_status !== 'on_demand' &&
        Number(p.stock_quantity) <= Number(p.min_stock_alert)
    ).length
    const outOfStock = products.filter(
      (p) => p.availability_status === 'out_of_stock' || (p.availability_status !== 'on_demand' && Number(p.stock_quantity) === 0)
    ).length
    const onDemand = products.filter((p) => p.availability_status === 'on_demand').length

    return { total, inStock, lowStock, outOfStock, onDemand }
  }, [products])

  // --- Filtered Inventory Records ---
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search match
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))

      // Category match
      const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter

      // Availability match
      const matchesAvailability =
        availabilityFilter === 'all' || p.availability_status === availabilityFilter

      // Low Stock Only toggle
      const isLowStock =
        p.is_active !== false &&
        p.availability_status !== 'discontinued' &&
        p.availability_status !== 'on_demand' &&
        Number(p.stock_quantity) <= Number(p.min_stock_alert)
      const matchesLowStock = !lowStockOnly || isLowStock

      return matchesSearch && matchesCategory && matchesAvailability && matchesLowStock
    })
  }, [products, searchQuery, categoryFilter, availabilityFilter, lowStockOnly])

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setAvailabilityFilter('all')
    setLowStockOnly(false)
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    availabilityFilter !== 'all' ||
    lowStockOnly

  // Open Update Stock Modal (or View Stock Modal for read-only staff)
  const handleOpenUpdateModal = (product, readOnly = false) => {
    setSelectedProduct(product)
    setIsReadOnlyStockView(readOnly || !canUpdateStock)
    setStockFormData({
      stock_quantity: product.stock_quantity ?? 0,
      min_stock_alert: product.min_stock_alert ?? 2,
      availability_status: product.availability_status || 'in_stock',
      change_reason: STOCK_CHANGE_REASONS[0],
      notes: ''
    })
    setFormErrors({})
    setIsConfirmingSave(false)
  }

  const handleCloseUpdateModal = () => {
    setSelectedProduct(null)
    setIsReadOnlyStockView(false)
    setFormErrors({})
    setIsConfirmingSave(false)
  }

  // Validate Update Stock Form
  const validateStockForm = () => {
    const errors = {}
    const qty = Number(stockFormData.stock_quantity)
    const alertLvl = Number(stockFormData.min_stock_alert)

    if (
      stockFormData.stock_quantity === '' ||
      isNaN(qty) ||
      qty < 0 ||
      !Number.isInteger(qty)
    ) {
      errors.stock_quantity = 'Stock quantity must be a non-negative whole number (0 or higher).'
    }

    if (
      stockFormData.min_stock_alert === '' ||
      isNaN(alertLvl) ||
      alertLvl < 0 ||
      !Number.isInteger(alertLvl)
    ) {
      errors.min_stock_alert = 'Minimum stock alert level must be 0 or higher.'
    }

    if (!stockFormData.availability_status) {
      errors.availability_status = 'Please choose an availability status.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle proceed to confirmation step
  const handleProceedToConfirm = (e) => {
    e.preventDefault()
    if (validateStockForm()) {
      setIsConfirmingSave(true)
    }
  }

  // Final Save Stock Handler
  const handleSaveStock = async () => {
    if (!selectedProduct) return
    if (!canUpdateStock) {
      showNotification('Read-only: Admin employees cannot modify inventory stock.', 'error')
      return
    }

    const newQty = Number(stockFormData.stock_quantity)
    const newAlert = Number(stockFormData.min_stock_alert)
    const newStatus = stockFormData.availability_status
    const nowIso = getCurrentTimestampIso()

    try {
      if (updateProductStock) {
        await updateProductStock(selectedProduct.id, {
          stock_quantity: newQty,
          min_stock_alert: newAlert,
          availability_status: newStatus
        })
      } else {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === selectedProduct.id) {
              return {
                ...p,
                stock_quantity: newQty,
                min_stock_alert: newAlert,
                availability_status: newStatus,
                last_updated_at: nowIso,
                last_change_reason: stockFormData.change_reason + (stockFormData.notes ? ` (${stockFormData.notes})` : '')
              }
            }
            return p
          })
        )
      }

      showNotification(
        `Inventory updated for ${selectedProduct.name}: ${newQty} units [${formatStatusLabel(newStatus)}]`
      )
      handleCloseUpdateModal()
    } catch (err) {
      showNotification(err?.message || 'Failed to update stock in database.', 'error')
    }
  }

  // Helper formatters
  const formatStatusLabel = (status) => {
    switch (status) {
      case 'in_stock':
        return 'In Stock'
      case 'out_of_stock':
        return 'Out of Stock'
      case 'on_demand':
        return 'On Demand'
      case 'discontinued':
        return 'Discontinued'
      default:
        return status
    }
  }

  const formatTimestamp = (isoString) => {
    if (!isoString) return 'Not recorded'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return isoString
    }
  }

  return (
    <AdminLayout activeTab="inventory">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-action-toast ${notification.type}`} role="alert">
          <span>{notification.type === 'success' ? '✓' : 'ℹ️'}</span>
          <span>{notification.text}</span>
        </div>
      )}

      <div className="admin-products-view-container inventory-page-container">
        {/* Page Top Header */}
        <div className="admin-view-header">
          <div>
            <div className="admin-page-title-wrap">
              <h1 className="admin-view-title">Inventory Management</h1>
              <span className="demo-badge-pill" title="Local mock state only">
                Demo UI
              </span>
              {!canUpdateStock && (
                <span
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}
                  title="Admin Employee has read-only access to inventory"
                >
                  🔒 Read-Only (Admin Employee)
                </span>
              )}
            </div>
            <p className="admin-view-subtitle">
              Monitor unit quantities, configure low-stock reorder thresholds, update availability statuses, and review stock adjustments.
            </p>
          </div>

          <div className="admin-view-actions">
            <button
              type="button"
              className={`btn-outline ${lowStockOnly ? 'btn-active-filter' : ''}`}
              onClick={() => setLowStockOnly(!lowStockOnly)}
              title="Filter items at or below minimum threshold"
            >
              <span>⚠️</span>
              <span>{lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock'}</span>
              {metrics.lowStock > 0 && (
                <span className="badge-alert-count">{metrics.lowStock}</span>
              )}
            </button>
          </div>
        </div>

        {/* 1. Dynamic Inventory Dashboard Summary Cards */}
        <div className="inventory-stats-row">
          <div className="product-stat-card">
            <span className="stat-label">Total SKUs</span>
            <span className="stat-number">{metrics.total}</span>
            <span className="stat-subtext">Active &amp; Archived Catalog</span>
          </div>

          <div className="product-stat-card active-card">
            <span className="stat-label">In Stock</span>
            <span className="stat-number text-success">{metrics.inStock}</span>
            <span className="stat-subtext">Immediate Delivery</span>
          </div>

          <div className="product-stat-card warning-card">
            <span className="stat-label">Low Stock Alerts</span>
            <div className="stat-number-wrap">
              <span className="stat-number text-warning">{metrics.lowStock}</span>
              {metrics.lowStock > 0 && (
                <span className="stat-badge amber">Reorder Warning</span>
              )}
            </div>
            <span className="stat-subtext">At / Below Min Threshold</span>
          </div>

          <div className="product-stat-card danger-card">
            <span className="stat-label">Out of Stock</span>
            <span className="stat-number text-danger">{metrics.outOfStock}</span>
            <span className="stat-subtext">Zero Quantity / Backorder</span>
          </div>

          <div className="product-stat-card info-card">
            <span className="stat-label">On Demand</span>
            <span className="stat-number text-info">{metrics.onDemand}</span>
            <span className="stat-subtext">Custom Quote / Sourced</span>
          </div>
        </div>

        {/* 2. Filter & Search Toolbar */}
        <div className="admin-product-toolbar">
          <div className="toolbar-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search by Product Name, SKU, Brand, or Model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search inventory by product name, SKU, brand, or model"
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
            {/* Category Filter */}
            <div className="filter-select-wrap">
              <label htmlFor="inventory-cat-filter" className="filter-label-inline">
                Category:
              </label>
              <select
                id="inventory-cat-filter"
                className="admin-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories ({categories.length} Groups)</option>
                {categories.map((cat) => (
                  <option key={cat.slug || cat.id} value={cat.slug || cat.id}>
                    {cat.title || cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="filter-select-wrap">
              <label htmlFor="inventory-avail-filter" className="filter-label-inline">
                Status:
              </label>
              <select
                id="inventory-avail-filter"
                className="admin-select"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Action */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-clear-filters"
                onClick={handleClearFilters}
                title="Reset all search queries and active filters"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Bar */}
        <div className="product-results-summary-bar">
          <div>
            Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> inventory records
            {hasActiveFilters && <span className="filtered-indicator"> (Filtered)</span>}
          </div>
          <div className="demo-notice-tag">
            <span>ℹ️ Demo Mode — Changes saved in this browser only</span>
          </div>
        </div>

        {/* 3. Desktop Inventory Data Table (contained horizontal scrolling) */}
        <div className="admin-table-container products-table-wrap inventory-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '240px' }}>Product &amp; SKU</th>
                <th style={{ minWidth: '140px' }}>Category</th>
                <th style={{ minWidth: '130px' }}>Brand &amp; Model</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>Stock Qty</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>Min Alert</th>
                <th style={{ minWidth: '130px', textAlign: 'center' }}>Availability</th>
                <th style={{ minWidth: '140px' }}>Last Updated</th>
                <th style={{ minWidth: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="admin-empty-cell">
                    <div className="empty-state-wrap">
                      <span className="empty-icon">📦</span>
                      <h3>No Inventory Items Found</h3>
                      <p>
                        No products match your current search query or filter selection.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={handleClearFilters}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, index) => {
                  const isLow =
                    p.is_active &&
                    p.availability_status !== 'discontinued' &&
                    Number(p.stock_quantity) <= Number(p.min_stock_alert)
                  const isZero = Number(p.stock_quantity) === 0

                  return (
                    <tr
                      key={p.id}
                      className={`product-table-row ${isLow ? 'row-low-stock' : ''} ${!p.is_active ? 'row-inactive' : ''}`}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                        {index + 1}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="product-name-column">
                        <div className="name-cell-content">
                          <span className="product-grid-title">{p.name}</span>
                          <div className="product-tags-subline">
                            <span className="sku-badge">{p.sku || 'NO-SKU'}</span>
                            {p.is_generic ? (
                              <span className="type-chip generic-type">Custom Package</span>
                            ) : (
                              <span className="type-chip oem-type">OEM Hardware</span>
                            )}
                            {!p.is_active && (
                              <span className="type-chip inactive-badge">Archived</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="category-text-cell">{p.categoryTitle}</span>
                      </td>

                      {/* Brand & Model */}
                      <td>
                        <div className="brand-model-cell">
                          <strong>{p.brand || 'ARS Solution'}</strong>
                          <span className="model-subline">{p.model || 'Configured'}</span>
                        </div>
                      </td>

                      {/* Stock Quantity */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="stock-level-wrap">
                          <span
                            className={`stock-count-number ${
                              isZero ? 'stock-zero text-danger' : isLow ? 'stock-low text-warning' : ''
                            }`}
                          >
                            {p.stock_quantity}
                          </span>
                          {isZero ? (
                            <span className="zero-stock-pill">Out of Stock</span>
                          ) : isLow ? (
                            <span className="low-stock-alert-pill">⚠️ Low Stock</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Min Alert Threshold */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="threshold-pill" title={`Alert triggered when stock ≤ ${p.min_stock_alert}`}>
                          ≤ {p.min_stock_alert}
                        </span>
                      </td>

                      {/* Availability Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill availability-${p.availability_status}`}>
                          {formatStatusLabel(p.availability_status)}
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td>
                        <div className="last-updated-cell">
                          <span className="update-time">{formatTimestamp(p.last_updated_at)}</span>
                          {p.last_change_reason && (
                            <span className="reason-subtext" title={p.last_change_reason}>
                              {p.last_change_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        {canUpdateStock ? (
                          <button
                            type="button"
                            className="btn-action-icon update-stock-btn"
                            onClick={() => handleOpenUpdateModal(p)}
                            title={`Update inventory stock for ${p.name}`}
                          >
                            ⚡ Update Stock
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-action-icon view-details-btn"
                            onClick={() => handleOpenUpdateModal(p, true)}
                            title={`View inventory stock details for ${p.name}`}
                          >
                            👁️ View Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Mobile Inventory Cards (Viewport < 900px) */}
        <div className="mobile-products-cards-list mobile-inventory-cards">
          {filteredProducts.length === 0 ? (
            <div className="empty-state-wrap mobile-empty-box">
              <span className="empty-icon">📦</span>
              <h3>No Inventory Items Found</h3>
              <p>Adjust your search criteria or clear filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleClearFilters}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isLow =
                p.is_active &&
                p.availability_status !== 'discontinued' &&
                Number(p.stock_quantity) <= Number(p.min_stock_alert)
              const isZero = Number(p.stock_quantity) === 0

              return (
                <div
                  key={p.id}
                  className={`mobile-product-card ${isLow ? 'card-low-stock' : ''}`}
                >
                  <div className="mobile-category-row">
                    <span className="category-pill-sm">{p.categoryTitle}</span>
                    <span className={`status-pill availability-${p.availability_status}`}>
                      {formatStatusLabel(p.availability_status)}
                    </span>
                  </div>

                  <h3 className="mobile-card-title">{p.name}</h3>

                  <div className="mobile-brand-model">
                    <span>{p.brand ? `${p.brand} ${p.model || ''}` : 'ARS Custom Solution'}</span>
                    <span className="sku-badge">{p.sku}</span>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="mobile-stock-metrics-bar">
                    <div className="stock-metric-col">
                      <span className="stats-label">Current Stock:</span>
                      <strong className={`stock-val ${isZero ? 'text-danger' : isLow ? 'text-warning' : ''}`}>
                        {p.stock_quantity} units
                      </strong>
                    </div>
                    <div className="stock-metric-col">
                      <span className="stats-label">Min Alert:</span>
                      <strong className="threshold-val">≤ {p.min_stock_alert} units</strong>
                    </div>
                  </div>

                  {isLow && (
                    <div className="mobile-low-stock-warning">
                      ⚠️ Low Stock Alert: Unit quantity is at or below minimum threshold!
                    </div>
                  )}

                  <div className="mobile-last-updated">
                    <span>Updated: {formatTimestamp(p.last_updated_at)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    {canUpdateStock ? (
                      <button
                        type="button"
                        className="btn-primary btn-block"
                        onClick={() => handleOpenUpdateModal(p)}
                      >
                        ⚡ Update Stock
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline btn-block"
                        onClick={() => handleOpenUpdateModal(p, true)}
                      >
                        👁️ View Stock
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 5. Update Stock Modal (with validation & confirmation step) */}
      {selectedProduct && (
        <div
          className="admin-modal-backdrop"
          onClick={handleCloseUpdateModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-modal-title"
        >
          <div
            className="admin-modal-dialog stock-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="admin-modal-header">
              <div>
                <h2 id="stock-modal-title" className="admin-modal-title">
                  {isReadOnlyStockView
                    ? 'Inventory Details (Read-Only)'
                    : isConfirmingSave
                    ? 'Confirm Stock Adjustment'
                    : 'Update Stock & Availability'}
                </h2>
                <span className="modal-subtitle-note">
                  {selectedProduct.name} ({selectedProduct.sku || 'No SKU'})
                  {isReadOnlyStockView && ' — Read-Only Mode'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseUpdateModal}
                aria-label="Close stock update modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Step 1 (Edit Inputs) vs Step 2 (Confirmation) */}
            {!isConfirmingSave ? (
              <form onSubmit={handleProceedToConfirm} className="admin-modal-body" noValidate>
                <fieldset disabled={isReadOnlyStockView} style={{ border: 'none', margin: 0, padding: 0 }}>
                {/* Product Summary Reference Card */}
                <div className="stock-reference-card">
                  <div className="reference-item">
                    <span className="ref-label">Current Quantity:</span>
                    <strong className="ref-val highlight">
                      {selectedProduct.stock_quantity} units
                    </strong>
                  </div>
                  <div className="reference-item">
                    <span className="ref-label">Current Status:</span>
                    <span className={`status-pill availability-${selectedProduct.availability_status}`}>
                      {formatStatusLabel(selectedProduct.availability_status)}
                    </span>
                  </div>
                  <div className="reference-item">
                    <span className="ref-label">Category:</span>
                    <span className="ref-val">{selectedProduct.categoryTitle}</span>
                  </div>
                </div>

                {/* Form Row: New Stock Qty & Alert Level */}
                <div className="form-row-2col">
                  <div className="modal-field-group">
                    <label htmlFor="new-stock-input" className="modal-label">
                      New Stock Quantity <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-stock-input"
                      type="number"
                      min="0"
                      step="1"
                      className={`modal-input ${formErrors.stock_quantity ? 'input-error' : ''}`}
                      value={stockFormData.stock_quantity}
                      onChange={(e) =>
                        setStockFormData({ ...stockFormData, stock_quantity: e.target.value })
                      }
                      placeholder="e.g. 10"
                      required
                    />
                    {formErrors.stock_quantity ? (
                      <span className="field-error-text">{formErrors.stock_quantity}</span>
                    ) : (
                      <span className="modal-field-hint">
                        Whole number ≥ 0. Zero is permitted for out-of-stock items.
                      </span>
                    )}
                  </div>

                  <div className="modal-field-group">
                    <label htmlFor="min-alert-input" className="modal-label">
                      Minimum Stock Alert Threshold <span className="required-star">*</span>
                    </label>
                    <input
                      id="min-alert-input"
                      type="number"
                      min="0"
                      step="1"
                      className={`modal-input ${formErrors.min_stock_alert ? 'input-error' : ''}`}
                      value={stockFormData.min_stock_alert}
                      onChange={(e) =>
                        setStockFormData({ ...stockFormData, min_stock_alert: e.target.value })
                      }
                      placeholder="e.g. 3"
                      required
                    />
                    {formErrors.min_stock_alert ? (
                      <span className="field-error-text">{formErrors.min_stock_alert}</span>
                    ) : (
                      <span className="modal-field-hint">
                        Alerts will flag when stock is less than or equal to this number.
                      </span>
                    )}
                  </div>
                </div>

                {/* Availability Status Dropdown */}
                <div className="modal-field-group">
                  <label htmlFor="avail-status-input" className="modal-label">
                    Availability Status <span className="required-star">*</span>
                  </label>
                  <select
                    id="avail-status-input"
                    className="modal-select"
                    value={stockFormData.availability_status}
                    onChange={(e) =>
                      setStockFormData({
                        ...stockFormData,
                        availability_status: e.target.value
                      })
                    }
                  >
                    <option value="in_stock">In Stock (Available for order &amp; dispatch)</option>
                    <option value="out_of_stock">Out of Stock (Currently zero units available)</option>
                    <option value="on_demand">On Demand (Sourced or custom quoted upon request)</option>
                    <option value="discontinued">Discontinued (No longer supplied or restocked)</option>
                  </select>
                  <span className="modal-field-hint">
                    Explicitly select status. Discontinued items will not be automatically reactivated without conscious choice.
                  </span>
                </div>

                {/* Change Reason & Optional Notes */}
                <div className="modal-field-group">
                  <label htmlFor="change-reason-input" className="modal-label">
                    Adjustment Reason
                  </label>
                  <select
                    id="change-reason-input"
                    className="modal-select"
                    value={stockFormData.change_reason}
                    onChange={(e) =>
                      setStockFormData({ ...stockFormData, change_reason: e.target.value })
                    }
                  >
                    {STOCK_CHANGE_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-field-group">
                  <label htmlFor="stock-notes-input" className="modal-label">
                    Audit Notes / Reference (Optional)
                  </label>
                  <input
                    id="stock-notes-input"
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Invoice #PO-9843 or Rack A-12 verification"
                    value={stockFormData.notes}
                    onChange={(e) =>
                      setStockFormData({ ...stockFormData, notes: e.target.value })
                    }
                  />
                </div>
                </fieldset>

                {/* Modal Footer (Edit Step) */}
                <div className="admin-modal-footer">
                  {isReadOnlyStockView ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCloseUpdateModal}
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={handleCloseUpdateModal}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Review &amp; Confirm →
                      </button>
                    </>
                  )}
                </div>
              </form>
            ) : (
              /* Step 2: Confirmation Step */
              <div className="admin-modal-body confirmation-step-body">
                <div className="confirmation-summary-box">
                  <h3 className="confirm-summary-heading">Please confirm the following inventory changes:</h3>

                  <div className="confirm-comparison-grid">
                    <div className="comparison-row">
                      <span className="comp-label">Stock Quantity:</span>
                      <div className="comp-values">
                        <span className="old-val">{selectedProduct.stock_quantity} units</span>
                        <span className="comp-arrow">→</span>
                        <strong className="new-val">{stockFormData.stock_quantity} units</strong>
                        {Number(stockFormData.stock_quantity) !== Number(selectedProduct.stock_quantity) && (
                          <span
                            className={`diff-badge ${
                              Number(stockFormData.stock_quantity) > Number(selectedProduct.stock_quantity)
                                ? 'diff-plus'
                                : 'diff-minus'
                            }`}
                          >
                            {Number(stockFormData.stock_quantity) > Number(selectedProduct.stock_quantity)
                              ? `+${Number(stockFormData.stock_quantity) - Number(selectedProduct.stock_quantity)}`
                              : `${Number(stockFormData.stock_quantity) - Number(selectedProduct.stock_quantity)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="comparison-row">
                      <span className="comp-label">Availability Status:</span>
                      <div className="comp-values">
                        <span className="old-val">{formatStatusLabel(selectedProduct.availability_status)}</span>
                        <span className="comp-arrow">→</span>
                        <strong className="new-val">{formatStatusLabel(stockFormData.availability_status)}</strong>
                      </div>
                    </div>

                    <div className="comparison-row">
                      <span className="comp-label">Min Alert Level:</span>
                      <div className="comp-values">
                        <span className="old-val">≤ {selectedProduct.min_stock_alert}</span>
                        <span className="comp-arrow">→</span>
                        <strong className="new-val">≤ {stockFormData.min_stock_alert}</strong>
                      </div>
                    </div>

                    <div className="comparison-row">
                      <span className="comp-label">Audit Reason:</span>
                      <div className="comp-values">
                        <span className="new-val">
                          {stockFormData.change_reason}
                          {stockFormData.notes ? ` (${stockFormData.notes})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="confirm-notice-text">
                    ⚠️ These modifications will be saved to your browser session storage. They will immediately reflect across the Products catalog, Inventory table, and Dashboard.
                  </p>
                </div>

                {/* Modal Footer (Confirmation Step) */}
                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setIsConfirmingSave(false)}
                  >
                    ← Back to Edit
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveStock}
                  >
                    ✓ Confirm &amp; Save Stock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
