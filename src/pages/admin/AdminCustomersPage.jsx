import { useState, useMemo, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'
import CreateCustomerModal from '../../components/admin/CreateCustomerModal'
import {
  aggregateCustomers,
  filterCustomers,
  getCrmRolePermissions,
  cleanIndianPhoneForDialer,
  buildCustomerTimeline
} from '../../utils/customerCrmAggregator'
import { formatINR, normalizeIndianPhoneForWhatsApp } from '../../utils/customerDispatchFormatter'

/**
 * ============================================================================
 * ARS Computers — Phase 3A Virtual Customer Management (CRM) Module
 * ============================================================================
 * Aggregates live sales orders and service enquiries into unified 360° customer profiles.
 *
 * Core Capabilities:
 * - Deterministic Indian mobile normalization (10-digit primary identity)
 * - Anti-silent-merge conflict detection for shared contact details
 * - Dynamic aggregation of Orders, Enquiries, and Activities
 * - Role-enforced visibility (Commercial financials restricted from unauthorized roles)
 * - Mobile responsive 320px-430px card layouts with >= 44px touch targets
 * ============================================================================
 */
export default function AdminCustomersPage() {
  const { adminUser } = useAdminAuth()
  const { enquiries = [], orders = [], regularCustomers = [], fetchEnquiryActivities } = useAdminData()

  // Permissions based on authenticated user's role
  const rolePermissions = useMemo(() => {
    return getCrmRolePermissions(adminUser?.role)
  }, [adminUser?.role])

  // Aggregate live business touchpoints into deduplicated customer entities
  const aggregatedCustomers = useMemo(() => {
    return aggregateCustomers({ enquiries, orders, regularCustomers })
  }, [enquiries, orders, regularCustomers])

  // UI Filter & Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'repeat' | 'active_enquiry' | 'high_value' | 'regular'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [activeDrawerTab, setActiveDrawerTab] = useState('overview') // 'overview' | 'orders' | 'enquiries' | 'timeline'
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Activity timeline state for the currently inspected customer
  const [customerActivities, setCustomerActivities] = useState([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return filterCustomers(aggregatedCustomers, {
      query: searchQuery,
      filter: activeFilter,
      rolePermissions
    })
  }, [aggregatedCustomers, searchQuery, activeFilter, rolePermissions])

  // Selected customer object for 360° Drawer
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return aggregatedCustomers.find((c) => c.id === selectedCustomerId) || null
  }, [aggregatedCustomers, selectedCustomerId])

  // Overall metric counts
  const metrics = useMemo(() => {
    const total = aggregatedCustomers.length
    const repeatCount = aggregatedCustomers.filter((c) => c.isRepeatCustomer).length
    const activeEnquiriesCount = aggregatedCustomers.filter((c) => c.hasActiveEnquiry).length
    const highValueCount = aggregatedCustomers.filter((c) => c.isHighValue).length
    const totalLtv = aggregatedCustomers.reduce((acc, c) => acc + (c.totalSpend || 0), 0)
    const regularCount = aggregatedCustomers.filter((c) => c.isRegularCustomer).length

    return {
      total,
      repeatCount,
      activeEnquiriesCount,
      highValueCount,
      totalLtv,
      regularCount
    }
  }, [aggregatedCustomers])

  // Fetch activities when selected customer changes
  useEffect(() => {
    let isMounted = true

    async function loadActivities() {
      if (!selectedCustomer) {
        setCustomerActivities([])
        return
      }

      setIsLoadingActivities(true)
      try {
        const enqActivities = []
        if (typeof fetchEnquiryActivities === 'function' && selectedCustomer.enquiries.length > 0) {
          // Limit concurrent fetches to first 5 enquiries
          const targetEnqs = selectedCustomer.enquiries.slice(0, 5)
          const results = await Promise.allSettled(
            targetEnqs.map((e) => fetchEnquiryActivities(e.id))
          )
          for (const res of results) {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
              enqActivities.push(...res.value)
            }
          }
        }

        if (isMounted) {
          const timeline = buildCustomerTimeline({
            customer: selectedCustomer,
            enquiryActivities: enqActivities,
            orderActivities: []
          })
          setCustomerActivities(timeline)
        }
      } catch (err) {
        console.warn('[AdminCustomersPage] Could not load customer activity timeline:', err)
        if (isMounted) {
          const fallbackTimeline = buildCustomerTimeline({
            customer: selectedCustomer,
            enquiryActivities: [],
            orderActivities: []
          })
          setCustomerActivities(fallbackTimeline)
        }
      } finally {
        if (isMounted) {
          setIsLoadingActivities(false)
        }
      }
    }

    loadActivities()

    return () => {
      isMounted = false
    }
  }, [selectedCustomer, fetchEnquiryActivities])

  const handleOpenCustomer = useCallback((customer) => {
    setSelectedCustomerId(customer.id)
    setActiveDrawerTab('overview')
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedCustomerId(null)
  }, [])

  return (
    <AdminLayout activeTab="customers">
      <div className="admin-page-container crm-page-wrapper">
        {/* Module Header */}
        <div className="admin-page-header crm-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="admin-page-title">
              <span className="page-icon" aria-hidden="true">👤</span>
              Customer Directory (CRM)
            </h1>
            <p className="admin-page-subtitle">
              Unified 360° customer profiles aggregated from live sales orders and service enquiries.
            </p>
          </div>
          {adminUser?.role !== 'inventory_staff' && (
            <button
              type="button"
              className="crm-action-btn crm-primary-btn"
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: '#0284c7',
                color: '#fff',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ➕ Add Regular Customer
            </button>
          )}
        </div>

        {/* CRM Metric Badges */}
        <div className="crm-metrics-grid">
          <div className="crm-metric-card">
            <span className="crm-metric-label">Total Customers</span>
            <span className="crm-metric-val">{metrics.total}</span>
            <span className="crm-metric-sub">Unique accounts</span>
          </div>
          <div className="crm-metric-card highlight-repeat">
            <span className="crm-metric-label">Repeat Customers</span>
            <span className="crm-metric-val">⭐ {metrics.repeatCount}</span>
            <span className="crm-metric-sub">Multi-order / service</span>
          </div>
          <div className="crm-metric-card highlight-active">
            <span className="crm-metric-label">Active Enquiries</span>
            <span className="crm-metric-val">⚡ {metrics.activeEnquiriesCount}</span>
            <span className="crm-metric-sub">Open tickets</span>
          </div>
          {rolePermissions.canViewFinancials && (
            <div className="crm-metric-card highlight-ltv">
              <span className="crm-metric-label">Total Customer LTV</span>
              <span className="crm-metric-val">{formatINR(metrics.totalLtv)}</span>
              <span className="crm-metric-sub">{metrics.highValueCount} High Value (&gt; ₹50k)</span>
            </div>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="crm-search-filter-bar">
          <div className="crm-search-input-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="crm-search-input"
              placeholder="Search by customer name, phone, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search customers"
            />
            {searchQuery && (
              <button
                type="button"
                className="crm-search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="crm-filter-tabs-group" role="tablist" aria-label="Customer filter categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'all'}
              className={`crm-filter-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({metrics.total})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'repeat'}
              className={`crm-filter-tab-btn ${activeFilter === 'repeat' ? 'active' : ''}`}
              onClick={() => setActiveFilter('repeat')}
            >
              ⭐ Repeat ({metrics.repeatCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'active_enquiry'}
              className={`crm-filter-tab-btn ${activeFilter === 'active_enquiry' ? 'active' : ''}`}
              onClick={() => setActiveFilter('active_enquiry')}
            >
              ⚡ Active Service ({metrics.activeEnquiriesCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'regular'}
              className={`crm-filter-tab-btn ${activeFilter === 'regular' ? 'active' : ''}`}
              onClick={() => setActiveFilter('regular')}
            >
              🏷️ Regular ({metrics.regularCount})
            </button>
            {rolePermissions.canViewFinancials && (
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'high_value'}
                className={`crm-filter-tab-btn ${activeFilter === 'high_value' ? 'active' : ''}`}
                onClick={() => setActiveFilter('high_value')}
              >
                💎 High Value ({metrics.highValueCount})
              </button>
            )}
          </div>
        </div>

        {/* Customer Directory List */}
        {filteredCustomers.length === 0 ? (
          <div className="crm-empty-state">
            <span className="empty-icon" aria-hidden="true">📇</span>
            <h3>No Customers Found</h3>
            <p>
              {searchQuery || activeFilter !== 'all'
                ? 'Try adjusting your search query or switching filters.'
                : 'No customer touchpoints have been recorded in orders or enquiries yet.'}
            </p>
          </div>
        ) : (
          <div className="crm-directory-layout">
            {/* Desktop Table View */}
            <div className="crm-desktop-table-container">
              <table className="crm-data-table">
                <thead>
                  <tr>
                    <th>Customer / Company</th>
                    <th>Contact</th>
                    <th>Orders</th>
                    <th>Enquiries</th>
                    {rolePermissions.canViewFinancials && <th>Lifetime Spend</th>}
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => {
                    const dialerHref = cleanIndianPhoneForDialer(cust.normalizedPhone || cust.formattedPhone)
                    const waNorm = normalizeIndianPhoneForWhatsApp(cust.normalizedPhone || cust.formattedPhone)
                    const waHref = waNorm ? `https://wa.me/${waNorm}?text=${encodeURIComponent('Hello, this is ARS Computers.')}` : null

                    return (
                      <tr key={cust.id} className="crm-table-row" onClick={() => handleOpenCustomer(cust)}>
                        <td>
                          <div className="crm-cust-name-cell">
                            <span className="cust-full-name">{cust.name}</span>
                            {cust.company && (
                              <span className="cust-company-tag">{cust.company}</span>
                            )}
                            <div className="crm-badges-row">
                              {cust.isRepeatCustomer && (
                                <span className="crm-badge repeat-badge">⭐ Repeat</span>
                              )}
                              {cust.hasActiveEnquiry && (
                                <span className="crm-badge active-enq-badge">⚡ Active Ticket</span>
                              )}
                              {cust.hasIdentityConflict && (
                                <span className="crm-badge conflict-badge" title={cust.conflictReasons.join(' | ')}>
                                  ⚠️ Shared Contact
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="crm-contact-cell">
                            {cust.formattedPhone ? (
                              <span className="crm-contact-phone">{cust.formattedPhone}</span>
                            ) : (
                              <span className="crm-contact-empty">No phone</span>
                            )}
                            {cust.email && (
                              <span className="crm-contact-email">{cust.email}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="crm-count-pill">{cust.totalOrders} order{cust.totalOrders !== 1 ? 's' : ''}</span>
                        </td>
                        <td>
                          <span className="crm-count-pill">{cust.totalEnquiries} lead{cust.totalEnquiries !== 1 ? 's' : ''}</span>
                        </td>
                        {rolePermissions.canViewFinancials && (
                          <td>
                            <span className="crm-spend-amount">
                              {cust.totalSpend > 0 ? formatINR(cust.totalSpend) : '—'}
                            </span>
                          </td>
                        )}
                        <td>
                          <span className="crm-date-text">
                            {cust.lastActive ? new Date(cust.lastActive).toLocaleDateString('en-IN') : 'Recent'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div className="crm-actions-cell">
                            {rolePermissions.canContactCustomer && dialerHref && (
                              <a
                                href={dialerHref}
                                className="crm-btn-contact-action crm-btn-call"
                                title={`Call ${cust.name}`}
                                aria-label={`Call ${cust.name}`}
                              >
                                📞 Call
                              </a>
                            )}
                            {rolePermissions.canContactCustomer && waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="crm-btn-contact-action crm-btn-wa"
                                title={`WhatsApp ${cust.name}`}
                                aria-label={`WhatsApp ${cust.name}`}
                              >
                                💬 WhatsApp
                              </a>
                            )}
                            <button
                              type="button"
                              className="crm-btn-view-profile"
                              onClick={() => handleOpenCustomer(cust)}
                              aria-label={`View 360 profile for ${cust.name}`}
                            >
                              View 360°
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (320px - 768px) */}
            <div className="crm-mobile-cards-container">
              {filteredCustomers.map((cust) => {
                const dialerHref = cleanIndianPhoneForDialer(cust.normalizedPhone || cust.formattedPhone)
                const waNorm = normalizeIndianPhoneForWhatsApp(cust.normalizedPhone || cust.formattedPhone)
                const waHref = waNorm ? `https://wa.me/${waNorm}?text=${encodeURIComponent('Hello, this is ARS Computers.')}` : null

                return (
                  <article key={cust.id} className="crm-mobile-card" onClick={() => handleOpenCustomer(cust)}>
                    {/* Card Header */}
                    <div className="crm-card-header">
                      <div className="crm-card-title-group">
                        <h3 className="crm-card-name">{cust.name}</h3>
                        {cust.company && <span className="crm-card-company">{cust.company}</span>}
                      </div>
                      <div className="crm-card-badges">
                        {cust.isRepeatCustomer && (
                          <span className="crm-badge repeat-badge">⭐ Repeat</span>
                        )}
                        {cust.hasActiveEnquiry && (
                          <span className="crm-badge active-enq-badge">⚡ Active</span>
                        )}
                        {cust.hasIdentityConflict && (
                          <span className="crm-badge conflict-badge">⚠️ Notice</span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="crm-card-body">
                      <div className="crm-card-contact-row">
                        <span className="crm-contact-icon" aria-hidden="true">📞</span>
                        <span className="crm-contact-val">{cust.formattedPhone || 'No phone recorded'}</span>
                      </div>
                      {cust.email && (
                        <div className="crm-card-contact-row">
                          <span className="crm-contact-icon" aria-hidden="true">✉️</span>
                          <span className="crm-contact-val">{cust.email}</span>
                        </div>
                      )}

                      <div className="crm-card-stats-row">
                        <div className="crm-card-stat-item">
                          <span className="stat-label">Orders</span>
                          <span className="stat-val">{cust.totalOrders}</span>
                        </div>
                        <div className="crm-card-stat-item">
                          <span className="stat-label">Enquiries</span>
                          <span className="stat-val">{cust.totalEnquiries}</span>
                        </div>
                        {rolePermissions.canViewFinancials && (
                          <div className="crm-card-stat-item">
                            <span className="stat-label">Spend</span>
                            <span className="stat-val highlight">{cust.totalSpend > 0 ? formatINR(cust.totalSpend) : '₹0'}</span>
                          </div>
                        )}
                      </div>

                      {cust.hasIdentityConflict && cust.conflictReasons.length > 0 && (
                        <div className="crm-card-conflict-notice">
                          <span aria-hidden="true">⚠️</span> {cust.conflictReasons[0]}
                        </div>
                      )}
                    </div>

                    {/* Card Actions (>= 44px height touch targets) */}
                    <div className="crm-card-actions-row" onClick={(e) => e.stopPropagation()}>
                      {rolePermissions.canContactCustomer && dialerHref && (
                        <a
                          href={dialerHref}
                          className="crm-touch-action-btn crm-touch-call"
                          aria-label={`Call ${cust.name}`}
                        >
                          📞 Call
                        </a>
                      )}
                      {rolePermissions.canContactCustomer && waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="crm-touch-action-btn crm-touch-wa"
                          aria-label={`WhatsApp ${cust.name}`}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        className="crm-touch-action-btn crm-touch-view"
                        onClick={() => handleOpenCustomer(cust)}
                        aria-label={`View full details for ${cust.name}`}
                      >
                        View 360° Profile
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {/* 360° Customer Profile Slide-over Drawer */}
        {selectedCustomer && (
          <div className="crm-drawer-backdrop" onClick={handleCloseDrawer} role="dialog" aria-modal="true" aria-labelledby="crm-drawer-title">
            <div className="crm-drawer-panel" onClick={(e) => e.stopPropagation()}>
              {/* Drawer Header */}
              <div className="crm-drawer-header">
                <div className="crm-drawer-title-group">
                  <div className="crm-drawer-name-row">
                    <h2 id="crm-drawer-title" className="crm-drawer-title">{selectedCustomer.name}</h2>
                    {selectedCustomer.isRepeatCustomer && (
                      <span className="crm-badge repeat-badge">⭐ Repeat Customer</span>
                    )}
                    {selectedCustomer.hasIdentityConflict && (
                      <span className="crm-badge conflict-badge">⚠️ Notice</span>
                    )}
                  </div>
                  {selectedCustomer.company && (
                    <span className="crm-drawer-company">{selectedCustomer.company}</span>
                  )}
                </div>

                <button
                  type="button"
                  className="crm-drawer-close-btn"
                  onClick={handleCloseDrawer}
                  aria-label="Close 360 profile drawer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Communication Bar */}
              {rolePermissions.canContactCustomer && (
                <div className="crm-drawer-quick-actions">
                  {cleanIndianPhoneForDialer(selectedCustomer.normalizedPhone || selectedCustomer.formattedPhone) && (
                    <a
                      href={cleanIndianPhoneForDialer(selectedCustomer.normalizedPhone || selectedCustomer.formattedPhone)}
                      className="crm-quick-action-link call"
                    >
                      📞 Call Direct
                    </a>
                  )}
                  {normalizeIndianPhoneForWhatsApp(selectedCustomer.normalizedPhone || selectedCustomer.formattedPhone) && (
                    <a
                      href={`https://wa.me/${normalizeIndianPhoneForWhatsApp(selectedCustomer.normalizedPhone || selectedCustomer.formattedPhone)}?text=${encodeURIComponent('Hello, this is ARS Computers regarding your service/order.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crm-quick-action-link whatsapp"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  {selectedCustomer.email && (
                    <a
                      href={`mailto:${selectedCustomer.email}?subject=${encodeURIComponent('ARS Computers | Customer Support')}`}
                      className="crm-quick-action-link email"
                    >
                      ✉️ Send Email
                    </a>
                  )}
                </div>
              )}

              {/* Drawer Tabs */}
              <div className="crm-drawer-tabs-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDrawerTab === 'overview'}
                  className={`crm-drawer-tab ${activeDrawerTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveDrawerTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDrawerTab === 'orders'}
                  className={`crm-drawer-tab ${activeDrawerTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setActiveDrawerTab('orders')}
                >
                  Orders ({selectedCustomer.orders.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDrawerTab === 'enquiries'}
                  className={`crm-drawer-tab ${activeDrawerTab === 'enquiries' ? 'active' : ''}`}
                  onClick={() => setActiveDrawerTab('enquiries')}
                >
                  Enquiries ({selectedCustomer.enquiries.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDrawerTab === 'timeline'}
                  className={`crm-drawer-tab ${activeDrawerTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setActiveDrawerTab('timeline')}
                >
                  Timeline ({customerActivities.length})
                </button>
              </div>

              {/* Drawer Content Body */}
              <div className="crm-drawer-body">
                {/* TAB 1: OVERVIEW */}
                {activeDrawerTab === 'overview' && (
                  <div className="crm-tab-pane">
                    {/* Identity Conflict Warning if applicable */}
                    {selectedCustomer.hasIdentityConflict && selectedCustomer.conflictReasons.length > 0 && (
                      <div className="crm-conflict-alert-box">
                        <div className="alert-header">
                          <span className="alert-icon" aria-hidden="true">⚠️</span>
                          <strong>Identity Conflict Detected</strong>
                        </div>
                        <ul className="conflict-reasons-list">
                          {selectedCustomer.conflictReasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                        <p className="alert-footer">
                          These records were not merged to prevent accidental data leakage across separate accounts.
                        </p>
                      </div>
                    )}

                    {/* Summary KPI Cards */}
                    <div className="crm-drawer-summary-cards">
                      <div className="crm-summary-card">
                        <span className="label">Total Orders</span>
                        <span className="value">{selectedCustomer.totalOrders}</span>
                      </div>
                      <div className="crm-summary-card">
                        <span className="label">Total Enquiries</span>
                        <span className="value">{selectedCustomer.totalEnquiries}</span>
                      </div>
                      {rolePermissions.canViewFinancials && (
                        <div className="crm-summary-card spend">
                          <span className="label">Lifetime Value (LTV)</span>
                          <span className="value">{formatINR(selectedCustomer.totalSpend)}</span>
                        </div>
                      )}
                      <div className="crm-summary-card">
                        <span className="label">Open Action Items</span>
                        <span className="value">{selectedCustomer.openEnquiriesCount}</span>
                      </div>
                    </div>

                    {/* Detailed Info Card */}
                    <div className="crm-drawer-details-card">
                      <h4 className="card-section-title">Contact & Company Information</h4>
                      <dl className="crm-details-dl">
                        <div className="dl-row">
                          <dt>Primary Mobile:</dt>
                          <dd>{selectedCustomer.formattedPhone || 'Not Provided'}</dd>
                        </div>
                        <div className="dl-row">
                          <dt>Registered Email:</dt>
                          <dd>{selectedCustomer.email || 'Not Provided'}</dd>
                        </div>
                        <div className="dl-row">
                          <dt>Company / Organization:</dt>
                          <dd>{selectedCustomer.company || 'Not Provided'}</dd>
                        </div>
                        <div className="dl-row">
                          <dt>Service / Billing Address:</dt>
                          <dd>{selectedCustomer.address || 'Not Provided'}</dd>
                        </div>
                        {selectedCustomer.isRegularCustomer && (
                          <div className="dl-row">
                            <dt>Account Classification:</dt>
                            <dd>
                              <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                                ⭐ Permanent Regular Customer ({selectedCustomer.customerType || 'Individual'})
                              </span>
                            </dd>
                          </div>
                        )}
                        {selectedCustomer.gstNumber && (
                          <div className="dl-row">
                            <dt>GST Number:</dt>
                            <dd><code>{selectedCustomer.gstNumber}</code></dd>
                          </div>
                        )}
                        {selectedCustomer.notes && (
                          <div className="dl-row">
                            <dt>Permanent Notes:</dt>
                            <dd>{selectedCustomer.notes}</dd>
                          </div>
                        )}
                        <div className="dl-row">
                          <dt>First Contact Recorded:</dt>
                          <dd>{new Date(selectedCustomer.firstSeen).toLocaleDateString('en-IN')}</dd>
                        </div>
                        <div className="dl-row">
                          <dt>Last Interaction:</dt>
                          <dd>{new Date(selectedCustomer.lastActive).toLocaleDateString('en-IN')}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* TAB 2: ORDERS & SALES */}
                {activeDrawerTab === 'orders' && (
                  <div className="crm-tab-pane">
                    {selectedCustomer.orders.length === 0 ? (
                      <div className="crm-tab-empty">
                        <span>🛒</span>
                        <p>No orders recorded for this customer yet.</p>
                      </div>
                    ) : (
                      <div className="crm-records-list">
                        {selectedCustomer.orders.map((ord) => {
                          const orderRef = ord.order_number || ord.order_ref || ord.id
                          return (
                            <div key={ord.id} className="crm-record-item-card">
                              <div className="crm-record-header">
                                <div className="crm-record-ref-group">
                                  <span className="record-ref">#{orderRef}</span>
                                  <span className="record-date">
                                    {ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN') : 'Recent'}
                                  </span>
                                </div>
                                <span className={`record-status-chip ${String(ord.order_status || '').toLowerCase()}`}>
                                  {ord.order_status || 'CONFIRMED'}
                                </span>
                              </div>

                              <div className="crm-record-body">
                                <p className="record-desc">
                                  {ord.items_count || 1} item(s) ordered
                                  {ord.notes ? ` • Note: ${ord.notes}` : ''}
                                </p>

                                {rolePermissions.canViewFinancials && (
                                  <div className="record-financials-row">
                                    <span className="amount-label">Total Amount:</span>
                                    <span className="amount-val">{formatINR(ord.total_amount)}</span>
                                    {ord.payment_status && (
                                      <span className={`payment-pill ${String(ord.payment_status).toLowerCase()}`}>
                                        {ord.payment_status}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ENQUIRIES & SERVICE */}
                {activeDrawerTab === 'enquiries' && (
                  <div className="crm-tab-pane">
                    {selectedCustomer.enquiries.length === 0 ? (
                      <div className="crm-tab-empty">
                        <span>💬</span>
                        <p>No service enquiries or leads recorded for this customer.</p>
                      </div>
                    ) : (
                      <div className="crm-records-list">
                        {selectedCustomer.enquiries.map((enq) => {
                          const enqRef = enq.enquiry_id || enq.id
                          const isService = Boolean(enq.service_details || enq.is_service_request)

                          return (
                            <div key={enq.id} className="crm-record-item-card">
                              <div className="crm-record-header">
                                <div className="crm-record-ref-group">
                                  <span className="record-ref">#{enqRef}</span>
                                  {isService && <span className="service-tag">⚡ Service &amp; Repair</span>}
                                  <span className="record-date">
                                    {enq.created_at ? new Date(enq.created_at).toLocaleDateString('en-IN') : 'Recent'}
                                  </span>
                                </div>
                                <span className={`record-status-chip ${String(enq.workflow_tab || enq.status || '').toLowerCase()}`}>
                                  {enq.workflow_tab || enq.status || 'NEW'}
                                </span>
                              </div>

                              <div className="crm-record-body">
                                <p className="record-desc">
                                  <strong>Requirement:</strong> {enq.requirement || enq.problem_description || 'General Enquiry'}
                                </p>
                                {enq.assigned_employee_name && (
                                  <p className="record-assignee">
                                    <strong>Assigned To:</strong> {enq.assigned_employee_name}
                                  </p>
                                )}
                                {enq.service_details?.preferred_date && (
                                  <p className="record-visit">
                                    <strong>Scheduled Visit:</strong> {enq.service_details.preferred_date} ({enq.service_details.preferred_time || 'Anytime'})
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: UNIFIED INTERACTION TIMELINE */}
                {activeDrawerTab === 'timeline' && (
                  <div className="crm-tab-pane">
                    {isLoadingActivities ? (
                      <div className="crm-timeline-loading">
                        <div className="crm-spinner" aria-hidden="true"></div>
                        <p>Aggregating timeline milestones and activity logs...</p>
                      </div>
                    ) : customerActivities.length === 0 ? (
                      <div className="crm-tab-empty">
                        <span>⏳</span>
                        <p>No interaction events logged for this customer.</p>
                      </div>
                    ) : (
                      <div className="crm-timeline-feed">
                        {customerActivities.map((event) => (
                          <div key={event.id} className={`crm-timeline-event ${event.sourceType}`}>
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <h5 className="timeline-title">{event.title}</h5>
                                <span className="timeline-date">
                                  {event.timestamp ? new Date(event.timestamp).toLocaleString('en-IN') : ''}
                                </span>
                              </div>
                              <p className="timeline-summary">{event.summary}</p>
                              {event.actorName && (
                                <span className="timeline-actor">Logged by: {event.actorName}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Create Regular Customer Modal */}
        <CreateCustomerModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          existingCustomers={aggregatedCustomers}
        />
      </div>
    </AdminLayout>
  )
}
