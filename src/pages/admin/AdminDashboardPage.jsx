import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
 * - Fully clickable management module cards filtered by database role
 * - Fully clickable recent enquiry cards that deep-link to the enquiry modal
 * - Live Supabase database indicator + realtime/focus refresh reporting
 * ============================================================================
 */

const ENQUIRY_ROLES = ['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account']
const OPERATIONAL_ROLES = [...ENQUIRY_ROLES]
const ALL_STAFF_ROLES = [...OPERATIONAL_ROLES, 'inventory_staff']

const MODULE_DEFINITIONS = [
  {
    key: 'products',
    to: '/admin/products',
    icon: '📦',
    title: 'Product Management',
    roles: ALL_STAFF_ROLES
  },
  {
    key: 'inventory',
    to: '/admin/inventory',
    icon: '⚡',
    title: 'Inventory & Stock Levels',
    roles: ['superadmin', 'inventory_staff']
  },
  {
    key: 'enquiries',
    to: '/admin/enquiries',
    icon: '💬',
    title: 'Customer Enquiries',
    roles: ENQUIRY_ROLES
  },
  {
    key: 'categories',
    to: '/admin/categories',
    icon: '📁',
    title: 'Category Taxonomy',
    roles: ENQUIRY_ROLES
  },
  {
    key: 'orders',
    to: '/admin/orders',
    icon: '🛒',
    title: 'Orders & Sales',
    roles: ALL_STAFF_ROLES
  },
  {
    key: 'staff',
    to: '/admin/staff',
    icon: '👥',
    title: 'Staff Management',
    roles: ['superadmin']
  }
]

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

function formatCount(value, isLoading) {
  return isLoading ? '…' : value
}

function AdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')

  const { adminUser } = useAdminAuth()
  const {
    metrics,
    enquiries,
    categories,
    products,
    orders,
    staff,
    isLiveDatabase,
    isLoadingProducts,
    isLoadingCategories,
    isLoadingEnquiries,
    isLoadingOrders,
    isLoadingStaff,
    isLoadingServiceRequests,
    databaseError,
    enquiriesError,
    ordersError,
    staffError,
    serviceRequestsError,
    realtimeStatus,
    refreshDashboardData
  } = useAdminData()

  const userRole = adminUser?.role || 'inventory_staff'
  const isSuperadminOrAdmin = ENQUIRY_ROLES.includes(userRole)
  const isDashboardLoading =
    isLoadingProducts ||
    isLoadingCategories ||
    (isSuperadminOrAdmin && isLoadingEnquiries) ||
    isLoadingOrders ||
    (userRole === 'superadmin' && isLoadingStaff) ||
    isLoadingServiceRequests

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

  const recentEnquiries = isSuperadminOrAdmin
    ? enquiries.filter((enq) => !enq.is_removed).slice(0, 4)
    : []

  // Low stock items watchlist for inventory staff
  const lowStockProducts = products
    .filter((p) => p.is_active !== false && Number(p.stock_quantity) <= Number(p.min_stock_alert))
    .slice(0, 4)

  const visibleModules = MODULE_DEFINITIONS.filter((module) => module.roles.includes(userRole))

  const moduleDescriptions = {
    products: `Review ${formatCount(metrics.products.total, isLoadingProducts)} catalog items, hardware specs, and activation toggles`,
    inventory: `Audit unit availability (${formatCount(metrics.products.inStock, isLoadingProducts)} in stock, ${formatCount(metrics.products.lowStock, isLoadingProducts)} low stock warnings)`,
    enquiries: `Track ${formatCount(metrics.enquiries.total, isLoadingEnquiries)} inbound quote submissions (${formatCount(metrics.enquiries.newCount, isLoadingEnquiries)} awaiting review)`,
    categories: `Manage ${formatCount(categories.length, isLoadingCategories)} core hardware categories, taxonomy, and display order`,
    orders: `Review ${formatCount(orders.length, isLoadingOrders)} sales orders, payment records, and fulfilment status`,
    staff: `Manage ${formatCount(staff.length, isLoadingStaff)} staff accounts, roles, and approval permissions`
  }

  const dashboardError = [
    databaseError,
    isSuperadminOrAdmin ? enquiriesError : null,
    ordersError,
    userRole === 'superadmin' ? staffError : null,
    serviceRequestsError
  ].filter(Boolean)[0]

  const handleEnquiryCardClick = (event) => {
    // Never let an action control inside a card trigger card navigation.
    if (event.target.closest('button, input, select, textarea, [data-card-action]')) {
      event.preventDefault()
    }
  }

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
            ) : OPERATIONAL_ROLES.includes(userRole) ? (
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
              {' '}
              {realtimeStatus === 'connected'
                ? 'Live auto-refresh is connected.'
                : 'Dashboard data refreshes on navigation, successful actions, and window focus.'}
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

        {dashboardError && (
          <div
            className="admin-banner-disclaimer"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(254, 242, 242, 0.9)'
            }}
            role="alert"
          >
            <span className="banner-badge" style={{ background: '#dc2626', color: '#fff' }}>
              ⚠️ Data Sync Issue
            </span>
            <p>
              <strong>Some dashboard data could not be refreshed:</strong> {dashboardError}
              {' '}
              <button
                type="button"
                className="btn-text-action"
                onClick={() => refreshDashboardData?.({ force: true })}
              >
                Retry now
              </button>
            </p>
          </div>
        )}

        {/* Summary Metric Cards Grid */}
        <div className="admin-summary-grid">
          {/* Card 1: Total Catalog Products */}
          <div className="admin-stat-card" aria-busy={isLoadingProducts}>
            <div className="stat-card-icon blue">📦</div>
            <div className="stat-card-content">
              <span className="stat-label">Total Catalog Products</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{formatCount(metrics.products.total, isLoadingProducts)}</span>
                <span className="stat-badge">{isLiveDatabase ? 'Supabase' : 'Local Store'}</span>
              </div>
              <span className="stat-subtext">Across {formatCount(categories.length, isLoadingCategories)} hardware categories</span>
            </div>
          </div>

          {/* Card 2: Active on Website */}
          <div className="admin-stat-card" aria-busy={isLoadingProducts}>
            <div className="stat-card-icon green">✓</div>
            <div className="stat-card-content">
              <span className="stat-label">Active on Website</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{formatCount(metrics.products.active, isLoadingProducts)}</span>
                <span className="stat-badge green">
                  {isLoadingProducts
                    ? 'Loading'
                    : `${Math.round((metrics.products.active / (metrics.products.total || 1)) * 100)}% Live`}
                </span>
              </div>
              <span className="stat-subtext">Visible to public customer catalog</span>
            </div>
          </div>

          {/* Card 3: Low-Stock Alerts */}
          <div className="admin-stat-card" aria-busy={isLoadingProducts}>
            <div className="stat-card-icon amber">⚠️</div>
            <div className="stat-card-content">
              <span className="stat-label">Low-Stock Alerts</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{formatCount(metrics.products.lowStock, isLoadingProducts)}</span>
                <span className={`stat-badge ${metrics.products.lowStock > 0 ? 'amber' : 'green'}`}>
                  {isLoadingProducts ? 'Loading' : metrics.products.lowStock > 0 ? 'Restock Needed' : 'Healthy'}
                </span>
              </div>
              <span className="stat-subtext">
                {isLoadingProducts
                  ? 'Checking inventory thresholds…'
                  : metrics.products.lowStock > 0
                  ? `${metrics.products.lowStock} item(s) at or below alert threshold`
                  : 'No inventory critical warnings'}
              </span>
            </div>
          </div>

          {/* Card 4: Inbound Enquiries (Admin only) or Stock Health (Staff) */}
          {isSuperadminOrAdmin ? (
            <div className="admin-stat-card" aria-busy={isLoadingEnquiries}>
              <div className="stat-card-icon purple">💬</div>
              <div className="stat-card-content">
                <span className="stat-label">Inbound Enquiries</span>
                <div className="stat-number-wrap">
                  <span className="stat-number">{formatCount(metrics.enquiries.total, isLoadingEnquiries)}</span>
                  <span className="stat-badge purple">
                    {isLoadingEnquiries
                      ? 'Loading'
                      : `${metrics.enquiries.newCount} New / ${metrics.enquiries.inProgress} Active`}
                  </span>
                </div>
                <span className="stat-subtext">Customer quote and service requests</span>
              </div>
            </div>
          ) : (
            <div className="admin-stat-card" aria-busy={isLoadingProducts}>
              <div className="stat-card-icon purple">📊</div>
              <div className="stat-card-content">
                <span className="stat-label">In-Stock Catalog</span>
                <div className="stat-number-wrap">
                  <span className="stat-number">{formatCount(metrics.products.inStock, isLoadingProducts)}</span>
                  <span className="stat-badge purple">
                    {isLoadingProducts ? 'Loading' : `${metrics.products.outOfStock} Out of Stock`}
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
              <span className="panel-hint">Open any card</span>
            </div>

            <div className="admin-shortcut-list" aria-busy={isDashboardLoading}>
              {visibleModules.map((module) => (
                <Link
                  key={module.key}
                  to={module.to}
                  className="shortcut-item"
                  aria-label={`Open ${module.title}`}
                >
                  <span className="shortcut-icon" aria-hidden="true">{module.icon}</span>
                  <div className="shortcut-info">
                    <strong>{module.title}</strong>
                    <span>{moduleDescriptions[module.key]}</span>
                  </div>
                  <span className="shortcut-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
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
                  View All ({metrics.enquiries.total}) →
                </button>
              </div>

              <div className="recent-enquiries-list" aria-busy={isLoadingEnquiries}>
                {isLoadingEnquiries && recentEnquiries.length === 0 ? (
                  <div className="dashboard-loading-list" role="status">
                    <span className="dashboard-visually-hidden">Loading recent enquiries…</span>
                    {[1, 2].map((i) => (
                      <div key={i} className="recent-enquiry-row" aria-hidden="true">
                        <div className="skeleton-line" style={{ width: '45%', height: '14px', marginBottom: '10px' }} />
                        <div className="skeleton-line" style={{ width: '85%', height: '12px', marginBottom: '8px' }} />
                        <div className="skeleton-line" style={{ width: '60%', height: '12px' }} />
                      </div>
                    ))}
                  </div>
                ) : recentEnquiries.length === 0 ? (
                  <div className="empty-state-wrap" style={{ padding: '24px 0' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No inbound enquiries recorded yet.</p>
                  </div>
                ) : (
                  recentEnquiries.map((enq) => (
                    <Link
                      key={enq.id}
                      to={`/admin/enquiries?enquiry=${encodeURIComponent(enq.id)}`}
                      className="recent-enquiry-row recent-enquiry-row-link"
                      onClick={handleEnquiryCardClick}
                      aria-label={`Open enquiry from ${enq.customer_name || enq.name || 'Anonymous Client'}`}
                    >
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
                          <span className={`status-pill ${enq.status || 'new'}`}>
                            {(enq.status || 'new').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </Link>
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

              <div className="recent-enquiries-list" aria-busy={isLoadingProducts}>
                {isLoadingProducts && lowStockProducts.length === 0 ? (
                  <div className="dashboard-loading-list" role="status">
                    <span className="dashboard-visually-hidden">Loading low stock items…</span>
                    {[1, 2].map((i) => (
                      <div key={i} className="recent-enquiry-row" aria-hidden="true">
                        <div className="skeleton-line" style={{ width: '50%', height: '14px', marginBottom: '10px' }} />
                        <div className="skeleton-line" style={{ width: '80%', height: '12px' }} />
                      </div>
                    ))}
                  </div>
                ) : lowStockProducts.length === 0 ? (
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
                            {(prod.availability_status || 'unknown').replace(/_/g, ' ')}
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
