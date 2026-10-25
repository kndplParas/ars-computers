import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminAuth } from '../../context/adminAuthContext'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Operational Dashboard (Step 4G)
 * ============================================================================
 * Features:
 * - Dynamic Summary cards derived from unified shared admin state:
 *   Total Products, Active Products, Low-Stock Alerts, Inbound Enquiries
 * - Role-aware gating: confidential customer enquiries are hidden from
 *   inventory_staff, replaced by inventory fulfillment metrics and watchlist
 * - Quick Action management shortcuts filtered by user's database role
 * - Live Supabase database indicator
 * ============================================================================
 */

function formatEnquiryDate(isoString) {
  if (!isoString) return 'Recent'
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Recent'
  }
}

function AdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')

  const { adminUser } = useAdminAuth()
  const { metrics, enquiries, categories, products, isLiveDatabase } = useAdminData()

  const userRole = adminUser?.role || 'inventory_staff'
  const isSuperadminOrAdmin = userRole === 'superadmin' || userRole === 'admin'

  // Gracefully handle legacy query-parameter links by redirecting to dedicated routes
  useEffect(() => {
    if (tabParam === 'products') {
      if (isSuperadminOrAdmin) navigate('/admin/products', { replace: true })
      else navigate('/admin/inventory', { replace: true })
    } else if (tabParam === 'inventory') {
      navigate('/admin/inventory', { replace: true })
    } else if (tabParam === 'categories') {
      if (isSuperadminOrAdmin) navigate('/admin/categories', { replace: true })
      else navigate('/admin/inventory', { replace: true })
    } else if (tabParam === 'enquiries') {
      if (isSuperadminOrAdmin) navigate('/admin/enquiries', { replace: true })
      else navigate('/admin/inventory', { replace: true })
    }
  }, [tabParam, navigate, isSuperadminOrAdmin])

  const recentEnquiries = isSuperadminOrAdmin ? enquiries.slice(0, 4) : []

  // Low stock items watchlist for inventory staff
  const lowStockProducts = products
    .filter((p) => p.is_active !== false && Number(p.stock_quantity) <= Number(p.min_stock_alert))
    .slice(0, 4)

  return (
    <AdminLayout activeTab="dashboard">
      <div className="admin-dashboard-view">
        {/* Top Page Header */}
        <div className="admin-view-header">
          <div>
            <h1 className="admin-view-title">Operational Dashboard</h1>
            <p className="admin-view-subtitle">
              Overview of hardware catalog, stock counts, and system operations.
            </p>
          </div>

          <div className="admin-view-actions">
            {userRole === 'superadmin' ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => navigate('/admin/products')}
              >
                + Manage Products
              </button>
            ) : userRole === 'admin' ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => navigate('/admin/products')}
              >
                📦 View Products
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => navigate('/admin/inventory')}
              >
                📦 Manage Inventory
              </button>
            )}
          </div>
        </div>

        {/* Database Status Banner */}
        {isLiveDatabase ? (
          <div
            className="admin-banner-disclaimer"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)'
            }}
          >
            <span className="banner-badge" style={{ background: '#10b981', color: '#fff' }}>
              🟢 Supabase Live
            </span>
            <p>
              <strong>PostgreSQL Database Connected:</strong> Real-time product inventory, catalog data, and authenticated role policies are active.
            </p>
          </div>
        ) : (
          <div className="admin-banner-disclaimer">
            <span className="banner-badge">Demo Mode</span>
            <p>
              <strong>Demo Mode — Changes saved in this browser only:</strong> All metrics, product counts, stock adjustments, and enquiry notes reflect your unified browser session storage.
            </p>
          </div>
        )}

        {/* Summary Metric Cards Grid */}
        <div className="admin-summary-grid">
          {/* Card 1: Total Catalog Products */}
          <div className="admin-stat-card">
            <div className="stat-card-icon blue">📦</div>
            <div className="stat-card-content">
              <span className="stat-label">Total Catalog Products</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{metrics.products.total}</span>
                <span className="stat-badge">{isLiveDatabase ? 'Supabase' : 'Local Store'}</span>
              </div>
              <span className="stat-subtext">Across {categories.length} hardware categories</span>
            </div>
          </div>

          {/* Card 2: Active on Website */}
          <div className="admin-stat-card">
            <div className="stat-card-icon green">✓</div>
            <div className="stat-card-content">
              <span className="stat-label">Active on Website</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{metrics.products.active}</span>
                <span className="stat-badge green">
                  {Math.round((metrics.products.active / (metrics.products.total || 1)) * 100)}% Live
                </span>
              </div>
              <span className="stat-subtext">Visible to public customer catalog</span>
            </div>
          </div>

          {/* Card 3: Low-Stock Alerts */}
          <div className="admin-stat-card">
            <div className="stat-card-icon amber">⚠️</div>
            <div className="stat-card-content">
              <span className="stat-label">Low-Stock Alerts</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{metrics.products.lowStock}</span>
                <span className={`stat-badge ${metrics.products.lowStock > 0 ? 'amber' : 'green'}`}>
                  {metrics.products.lowStock > 0 ? 'Restock Needed' : 'Healthy'}
                </span>
              </div>
              <span className="stat-subtext">
                {metrics.products.lowStock > 0
                  ? `${metrics.products.lowStock} item(s) at or below alert threshold`
                  : 'No inventory critical warnings'}
              </span>
            </div>
          </div>

          {/* Card 4: Inbound Enquiries (Admin only) or Stock Health (Staff) */}
          {isSuperadminOrAdmin ? (
            <div className="admin-stat-card">
              <div className="stat-card-icon purple">💬</div>
              <div className="stat-card-content">
                <span className="stat-label">Inbound Enquiries</span>
                <div className="stat-number-wrap">
                  <span className="stat-number">{metrics.enquiries.total}</span>
                  <span className="stat-badge purple">
                    {metrics.enquiries.newCount} New / {metrics.enquiries.inProgress} Active
                  </span>
                </div>
                <span className="stat-subtext">Customer quote and service requests</span>
              </div>
            </div>
          ) : (
            <div className="admin-stat-card">
              <div className="stat-card-icon purple">📊</div>
              <div className="stat-card-content">
                <span className="stat-label">In-Stock Catalog</span>
                <div className="stat-number-wrap">
                  <span className="stat-number">{metrics.products.inStock}</span>
                  <span className="stat-badge purple">
                    {metrics.products.outOfStock} Out of Stock
                  </span>
                </div>
                <span className="stat-subtext">Units available for customer fulfillment</span>
              </div>
            </div>
          )}
        </div>

        {/* Dual Panel Section: Quick Actions + Role-Gated Panel */}
        <div className="admin-dashboard-split">
          {/* Left: Quick Actions & Management Shortcuts */}
          <div className="admin-panel-card">
            <div className="panel-card-header">
              <h3>Management Modules</h3>
              <span className="panel-hint">Quick Navigation</span>
            </div>

            <div className="admin-shortcut-list">
              {isSuperadminOrAdmin && (
                <button
                  type="button"
                  className="shortcut-item"
                  onClick={() => navigate('/admin/products')}
                >
                  <span className="shortcut-icon">📦</span>
                  <div className="shortcut-info">
                    <strong>Product Management</strong>
                    <span>Review {metrics.products.total} catalog items, hardware specs, and activation toggles</span>
                  </div>
                  <span className="shortcut-arrow">→</span>
                </button>
              )}

              <button
                type="button"
                className="shortcut-item"
                onClick={() => navigate('/admin/inventory')}
              >
                <span className="shortcut-icon">⚡</span>
                <div className="shortcut-info">
                  <strong>Inventory &amp; Stock Levels</strong>
                  <span>Audit unit availability ({metrics.products.inStock} in stock, {metrics.products.lowStock} low stock warnings)</span>
                </div>
                <span className="shortcut-arrow">→</span>
              </button>

              {isSuperadminOrAdmin && (
                <>
                  <button
                    type="button"
                    className="shortcut-item"
                    onClick={() => navigate('/admin/enquiries')}
                  >
                    <span className="shortcut-icon">💬</span>
                    <div className="shortcut-info">
                      <strong>Customer Enquiries</strong>
                      <span>Track {metrics.enquiries.total} inbound quote submissions ({metrics.enquiries.newCount} awaiting review)</span>
                    </div>
                    <span className="shortcut-arrow">→</span>
                  </button>

                  <button
                    type="button"
                    className="shortcut-item"
                    onClick={() => navigate('/admin/categories')}
                  >
                    <span className="shortcut-icon">📁</span>
                    <div className="shortcut-info">
                      <strong>Category Taxonomy</strong>
                      <span>Manage {categories.length} core hardware categories, taxonomy, and display order</span>
                    </div>
                    <span className="shortcut-arrow">→</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Recent Inbound Enquiries Preview (Admin) OR Low Stock Watchlist (Staff) */}
          {isSuperadminOrAdmin ? (
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <h3>Recent Enquiries</h3>
                <button
                  type="button"
                  className="btn-text-action"
                  onClick={() => navigate('/admin/enquiries')}
                >
                  View All ({enquiries.length}) →
                </button>
              </div>

              <div className="recent-enquiries-list">
                {recentEnquiries.length === 0 ? (
                  <div className="empty-state-wrap" style={{ padding: '24px 0' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No inbound enquiries recorded yet.</p>
                  </div>
                ) : (
                  recentEnquiries.map((enq) => (
                    <div key={enq.id} className="recent-enquiry-row">
                      <div className="enquiry-main-info">
                        <div className="enquiry-sender">
                          <strong>{enq.customer_name || enq.name || 'Anonymous Client'}</strong>
                          <span className="enquiry-date">{formatEnquiryDate(enq.created_at)}</span>
                        </div>
                        <span
                          className="enquiry-company-line"
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            display: 'block',
                            marginBottom: '4px'
                          }}
                        >
                          {enq.company || enq.contact_info || 'Individual Client'}
                        </span>
                        <p className="enquiry-snippet">{enq.message}</p>
                        <div className="enquiry-tags">
                          <span className="category-tag-chip">
                            {enq.category_label || enq.category_interest || enq.service_requested || 'General'}
                          </span>
                          <span className={`status-pill ${enq.status}`}>
                            {enq.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <h3>Low Stock Watchlist</h3>
                <button
                  type="button"
                  className="btn-text-action"
                  onClick={() => navigate('/admin/inventory')}
                >
                  View Full Inventory →
                </button>
              </div>

              <div className="recent-enquiries-list">
                {lowStockProducts.length === 0 ? (
                  <div className="empty-state-wrap" style={{ padding: '24px 0' }}>
                    <p style={{ color: 'var(--text-muted)' }}>All catalog stock levels are healthy.</p>
                  </div>
                ) : (
                  lowStockProducts.map((prod) => (
                    <div key={prod.id} className="recent-enquiry-row">
                      <div className="enquiry-main-info">
                        <div className="enquiry-sender">
                          <strong>{prod.name}</strong>
                          <span className="stat-badge amber">Stock: {prod.stock_quantity}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            display: 'block',
                            marginBottom: '4px'
                          }}
                        >
                          Threshold: {prod.min_stock_alert} units | SKU: {prod.sku || 'N/A'}
                        </span>
                        <div className="enquiry-tags">
                          <span className={`status-pill ${prod.availability_status}`}>
                            {(prod.availability_status || 'unknown').replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboardPage

