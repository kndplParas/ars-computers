import { useState, useMemo, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import CreateOrderModal from '../../components/admin/CreateOrderModal.jsx'
import LiveOrdersRegisterModal from '../../components/admin/LiveOrdersRegisterModal.jsx'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'
import {
  downloadMonthlySalesExcel,
  filterOrdersByReportingMonth
} from '../../utils/salesReportGenerator.js'
import { MONTH_NAMES, formatDateTimeParts } from '../../utils/excelReportGenerator.js'

/**
 * ============================================================================
 * ARS Computers — Orders & Sales Management Console
 * ============================================================================
 * Clean, practical, high-efficiency sales operations for computer and CCTV retail.
 *
 * Core Workflow:
 * 1. Store Employee / Admin creates order (Customer + Products + Selling Price).
 * 2. Employee processes hardware and submits completion summary.
 * 3. Head / Superadmin conducts final review and approves order.
 * 4. Approved orders become permanently archived historical records.
 * ============================================================================
 */
export default function AdminOrdersPage() {
  const { adminUser } = useAdminAuth()
  const isSuperadmin = adminUser?.role === 'superadmin'
  const isInventoryStaff = adminUser?.role === 'inventory_staff'

  const {
    orders = [],
    loadAdminOrders,
    startSalesOrder,
    submitOrderCompletion,
    reviewOrderCompletion,
    cancelSalesOrder,
    isLoadingOrders,
    ordersError
  } = useAdminData()

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'pending' | 'completed' | 'cancelled' | 'all'
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isLiveRegisterOpen, setIsLiveRegisterOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Monthly Report Modal State
  const [exportMonthIndex, setExportMonthIndex] = useState(() => new Date().getMonth())
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear())
  const [isExporting, setIsExporting] = useState(false)

  // Action Dialogs State
  const [actionModal, setActionModal] = useState({
    type: null, // 'submit_completion' | 'approve' | 'cancel'
    order: null,
    notes: '',
    error: null,
    isSubmitting: false
  })

  // Toast Notification
  const [toast, setToast] = useState(null)
  const showToast = (text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Load orders on mount
  useEffect(() => {
    if (loadAdminOrders) {
      loadAdminOrders()
    }
  }, [loadAdminOrders])

  // Top Metrics
  const metrics = useMemo(() => {
    const active = orders.filter((o) => ['new', 'processing'].includes(o.status)).length
    const pending = orders.filter((o) => o.status === 'completion_requested').length
    const completedOrders = orders.filter((o) => o.status === 'completed')
    const completed = completedOrders.length
    const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    return { active, pending, completed, revenue }
  }, [orders])

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (activeTab === 'active' && !['new', 'processing'].includes(o.status)) return false
      if (activeTab === 'pending' && o.status !== 'completion_requested') return false
      if (activeTab === 'completed' && o.status !== 'completed') return false
      if (activeTab === 'cancelled' && o.status !== 'cancelled') return false

      // Payment filter
      if (paymentFilter !== 'all' && (o.payment_status || 'pending').toLowerCase() !== paymentFilter.toLowerCase()) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          (o.order_number && o.order_number.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.contact_info && o.contact_info.toLowerCase().includes(q)) ||
          (o.completed_by_name && o.completed_by_name.toLowerCase().includes(q))
        if (!match) return false
      }

      return true
    })
  }, [orders, activeTab, paymentFilter, searchQuery])

  // Monthly Report Count
  const eligibleExportCount = useMemo(
    () => filterOrdersByReportingMonth(orders, exportMonthIndex, exportYear).length,
    [orders, exportMonthIndex, exportYear]
  )

  const handleDownloadMonthlyReport = async () => {
    setIsExporting(true)
    try {
      const res = await downloadMonthlySalesExcel(orders, exportMonthIndex, exportYear)
      showToast(`Sales report generated: ${res.filename} (${res.count} records)`, 'success')
      setIsExportModalOpen(false)
    } catch (err) {
      showToast(`Failed to generate Excel report: ${err.message}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  // Workflow Handlers
  const handleStartOrder = async (orderId) => {
    try {
      await startSalesOrder(orderId)
      showToast('Order moved to processing status.')
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: 'processing' }))
      }
    } catch (err) {
      showToast(err.message || 'Failed to start processing order.', 'error')
    }
  }

  const handleOpenActionModal = (type, order) => {
    setActionModal({
      type,
      order,
      notes: '',
      error: null,
      isSubmitting: false
    })
  }

  const handleExecuteAction = async (e) => {
    e.preventDefault()
    const { type, order, notes } = actionModal
    setActionModal((prev) => ({ ...prev, isSubmitting: true, error: null }))

    try {
      if (type === 'submit_completion') {
        if (!notes.trim() || notes.trim().length < 5) {
          throw new Error('Please provide completion remarks (at least 5 characters).')
        }
        await submitOrderCompletion(order.id, notes.trim())
        showToast('Completion submitted for Head approval.')
      } else if (type === 'approve') {
        await reviewOrderCompletion(order.id, notes.trim())
        showToast('Order approved and permanently archived.')
      } else if (type === 'cancel') {
        if (!notes.trim() || notes.trim().length < 5) {
          throw new Error('A mandatory cancellation reason (at least 5 characters) is required.')
        }
        await cancelSalesOrder(order.id, notes.trim())
        showToast('Order cancelled and preserved in permanent archive.')
      }

      setActionModal({ type: null, order: null, notes: '', error: null, isSubmitting: false })
      setSelectedOrder(null)
    } catch (err) {
      setActionModal((prev) => ({ ...prev, isSubmitting: false, error: err.message }))
    }
  }

  return (
    <AdminLayout activeTab="orders">
      <div className="admin-dashboard-view">
        {/* Top Page Header */}
        <div className="admin-view-header">
          <div>
            <h1 className="admin-view-title">Orders &amp; Sales Management</h1>
            <p className="admin-view-subtitle">
              Record hardware sales, custom PC builds, CCTV installations, and workflow completions.
            </p>
          </div>

          <div className="admin-view-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!isInventoryStaff && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setIsCreateModalOpen(true)}
              >
                + Create Sales Order
              </button>
            )}

            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setIsLiveRegisterOpen(true)}
            >
              📋 Live Orders Register
            </button>

            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setIsExportModalOpen(true)}
            >
              📊 Monthly Sales Report
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div
            className={`admin-banner-disclaimer`}
            style={{
              borderColor: toast.type === 'error' ? '#ef4444' : '#10b981',
              background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: toast.type === 'error' ? '#b91c1c' : '#15803d',
              marginBottom: '16px'
            }}
          >
            {toast.text}
          </div>
        )}

        {/* Error Banner */}
        {ordersError && (
          <div className="admin-banner-disclaimer" style={{ borderColor: '#ef4444', color: '#b91c1c', marginBottom: '16px' }}>
            <strong>Database Error:</strong> {ordersError}
          </div>
        )}

        {/* Metrics Cards */}
        <div className="admin-summary-grid four-cards" style={{ marginBottom: '24px' }}>
          {/* Card 1: Active Orders */}
          <div className="admin-stat-card">
            <div className="stat-card-icon blue">🛒</div>
            <div className="stat-card-content">
              <span className="stat-label">Active Orders</span>
              <div className="stat-number-wrap">
                <span className="stat-number">{metrics.active}</span>
                <span className="stat-badge blue" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Live</span>
              </div>
              <span className="stat-subtext">New &amp; Processing</span>
            </div>
          </div>

          {/* Card 2: Pending Review */}
          <div className="admin-stat-card">
            <div className="stat-card-icon amber">⏳</div>
            <div className="stat-card-content">
              <span className="stat-label">Pending Review</span>
              <div className="stat-number-wrap">
                <span className="stat-number" style={{ color: metrics.pending > 0 ? '#b45309' : '#0f172a' }}>
                  {metrics.pending}
                </span>
                {metrics.pending > 0 && (
                  <span className="stat-badge amber" style={{ background: '#fffbeb', color: '#b45309' }}>
                    Action Required
                  </span>
                )}
              </div>
              <span className="stat-subtext">Awaiting Head Approval</span>
            </div>
          </div>

          {/* Card 3: Completed Sales */}
          <div className="admin-stat-card">
            <div className="stat-card-icon green">✓</div>
            <div className="stat-card-content">
              <span className="stat-label">Completed Sales</span>
              <div className="stat-number-wrap">
                <span className="stat-number" style={{ color: '#15803d' }}>
                  {metrics.completed}
                </span>
                <span className="stat-badge green" style={{ background: '#ecfdf5', color: '#059669' }}>
                  Archived
                </span>
              </div>
              <span className="stat-subtext">Permanently Archived</span>
            </div>
          </div>

          {/* Card 4: Total Completed Revenue */}
          <div className="admin-stat-card">
            <div className="stat-card-icon purple">₹</div>
            <div className="stat-card-content">
              <span className="stat-label">Total Completed Revenue</span>
              <div className="stat-number-wrap">
                <span className="stat-number" style={{ fontSize: '1.45rem', color: '#0f172a' }}>
                  ₹{metrics.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="stat-subtext">Finalized Sales</span>
            </div>
          </div>
        </div>

        {/* Workflow Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', gap: '8px' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'active' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'active' ? '2px solid #0284c7' : 'none'
            }}
          >
            Active Orders ({orders.filter((o) => ['new', 'processing'].includes(o.status)).length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'pending' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'pending' ? '2px solid #0284c7' : 'none'
            }}
          >
            Completion Pending ({orders.filter((o) => o.status === 'completion_requested').length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'completed' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'completed' ? '2px solid #0284c7' : 'none'
            }}
          >
            Completed History ({orders.filter((o) => o.status === 'completed').length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'cancelled' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'cancelled' ? '2px solid #0284c7' : 'none'
            }}
          >
            Cancelled ({orders.filter((o) => o.status === 'cancelled').length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'all' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'all' ? '2px solid #0284c7' : 'none'
            }}
          >
            All Orders ({orders.length})
          </button>
        </div>

        {/* Filters Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            style={{ maxWidth: '320px' }}
            placeholder="Search order ref, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="form-select"
            style={{ maxWidth: '180px' }}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* Orders Table Container */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Desktop Table View */}
          <div className="admin-orders-table-desktop" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '12px 14px' }}>Order Reference</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Customer</th>
                  <th style={{ padding: '12px 14px' }}>Contact</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Payment</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingOrders ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Loading sales orders from database...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      No sales orders found in this view.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const dateParts = formatDateTimeParts(o.created_at)
                    return (
                      <tr
                        key={o.id}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                        onClick={() => setSelectedOrder(o)}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0284c7' }}>
                          {o.order_number || o.id}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {dateParts.date}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 500, color: '#0f172a' }}>
                          {o.customer_name}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {o.contact_info}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                          ₹{Number(o.total_amount).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#15803d' }}>
                          ₹{Number(o.paid_amount).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: o.payment_status === 'paid' ? '#dcfce7' : o.payment_status === 'partial' ? '#fef3c7' : '#fee2e2',
                              color: o.payment_status === 'paid' ? '#166534' : o.payment_status === 'partial' ? '#92400e' : '#991b1b'
                            }}
                          >
                            {(o.payment_status || 'pending').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: o.status === 'completed' ? '#dcfce7' : o.status === 'cancelled' ? '#f1f5f9' : '#e0f2fe',
                              color: o.status === 'completed' ? '#166534' : o.status === 'cancelled' ? '#64748b' : '#0369a1'
                            }}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedOrder(o)
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Orders Cards View */}
          <div className="admin-orders-cards-mobile" style={{ padding: '12px' }}>
            {isLoadingOrders ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                Loading sales orders from database...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                No sales orders found in this view.
              </div>
            ) : (
              filteredOrders.map((o) => {
                const dateParts = formatDateTimeParts(o.created_at)
                return (
                  <div key={o.id} className="admin-order-card-mobile" onClick={() => setSelectedOrder(o)}>
                    <div className="admin-order-card-mobile-top">
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0284c7' }}>
                          {o.order_number || o.id}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {dateParts.date}
                        </span>
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: o.status === 'completed' ? '#dcfce7' : o.status === 'cancelled' ? '#f1f5f9' : '#e0f2fe',
                          color: o.status === 'completed' ? '#166534' : o.status === 'cancelled' ? '#64748b' : '#0369a1'
                        }}
                      >
                        {o.status}
                      </span>
                    </div>

                    <div className="admin-order-card-mobile-meta">
                      <div><strong>Customer:</strong> {o.customer_name}</div>
                      <div><strong>Contact:</strong> {o.contact_info}</div>
                    </div>

                    <div className="admin-order-card-mobile-finance">
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total</span>
                        <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>₹{Number(o.total_amount).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Paid</span>
                        <strong style={{ fontSize: '0.92rem', color: '#15803d' }}>₹{Number(o.paid_amount).toFixed(2)}</strong>
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: o.payment_status === 'paid' ? '#dcfce7' : o.payment_status === 'partial' ? '#fef3c7' : '#fee2e2',
                          color: o.payment_status === 'paid' ? '#166534' : o.payment_status === 'partial' ? '#92400e' : '#991b1b'
                        }}
                      >
                        {(o.payment_status || 'pending').toUpperCase()}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-outline"
                      style={{ width: '100%', minHeight: '44px', marginTop: '4px', fontSize: '13px', fontWeight: 600 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedOrder(o)
                      }}
                    >
                      View Order Details &amp; Actions
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div
            className="admin-modal-backdrop"
            onClick={() => setSelectedOrder(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
          >
            <div
              className="admin-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '820px',
                width: 'min(820px, calc(100vw - 20px))',
                maxHeight: 'min(92vh, calc(100dvh - 24px))',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div className="admin-modal-header">
                <div>
                  <h2 id="order-details-title" className="admin-modal-title">
                    Order {selectedOrder.order_number || selectedOrder.id}
                  </h2>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: selectedOrder.status === 'completed' ? '#dcfce7' : '#e0f2fe',
                      color: selectedOrder.status === 'completed' ? '#166534' : '#0369a1'
                    }}
                  >
                    STATUS: {selectedOrder.status.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="admin-modal-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px' }}>
                {/* Customer Info */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Customer Information</div>
                  <div><strong>Name:</strong> {selectedOrder.customer_name}</div>
                  <div><strong>Contact:</strong> {selectedOrder.contact_info}</div>
                </div>

                {/* Items Breakdown */}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>Line Items</div>
                  {/* Desktop Table View */}
                  <div className="order-details-table-desktop" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0 ? (
                          selectedOrder.order_items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px' }}>
                                {it.product_name_snapshot} {it.sku_snapshot ? `[${it.sku_snapshot}]` : ''}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>{it.quantity}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(it.unit_price).toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>₹{Number(it.line_total).toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
                              No line item details available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="order-details-cards-mobile">
                    {Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0 ? (
                      selectedOrder.order_items.map((it) => (
                        <div key={it.id} className="order-detail-card-mobile">
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {it.product_name_snapshot} {it.sku_snapshot ? `[${it.sku_snapshot}]` : ''}
                          </div>
                          <div className="order-detail-card-mobile-row">
                            <span style={{ color: '#64748b' }}>Qty: <strong>{it.quantity}</strong> × ₹{Number(it.unit_price).toFixed(2)}</span>
                            <strong style={{ color: '#0f172a' }}>₹{Number(it.line_total).toFixed(2)}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
                        No line item details available.
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px' }}>
                  <div>
                    <div><strong>Payment Method:</strong> {(selectedOrder.payment_method || 'cash').toUpperCase()}</div>
                    <div><strong>Payment Status:</strong> {(selectedOrder.payment_status || 'pending').toUpperCase()}</div>
                  </div>
                  <div>
                    <div><strong>Total Amount:</strong> ₹{Number(selectedOrder.total_amount).toFixed(2)}</div>
                    <div><strong>Amount Paid:</strong> ₹{Number(selectedOrder.paid_amount).toFixed(2)}</div>
                    <div style={{ color: Number(selectedOrder.total_amount) - Number(selectedOrder.paid_amount) > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                      Balance Due: ₹{Math.max(0, Number(selectedOrder.total_amount) - Number(selectedOrder.paid_amount)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Audit & Workflow Trail */}
                <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div><strong>Created By:</strong> {selectedOrder.created_by_name || 'Staff'} on {formatDateTimeParts(selectedOrder.created_at).date}</div>
                  {selectedOrder.completion_requested_at && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Completed By:</strong> {selectedOrder.completed_by_name} ({selectedOrder.completed_by_employee_code || '—'}) on {formatDateTimeParts(selectedOrder.completion_requested_at).date}
                      <br /><em>Remarks:</em> {selectedOrder.employee_remarks}
                    </div>
                  )}
                  {selectedOrder.completion_approved_at && (
                    <div style={{ marginTop: '4px', color: '#166534' }}>
                      <strong>Approved By:</strong> {selectedOrder.approved_by_name} on {formatDateTimeParts(selectedOrder.completion_approved_at).date}
                      {selectedOrder.head_remarks && <><br /><em>Head Remarks:</em> {selectedOrder.head_remarks}</>}
                    </div>
                  )}
                  {selectedOrder.cancelled_at && (
                    <div style={{ marginTop: '4px', color: '#b91c1c' }}>
                      <strong>Cancelled By:</strong> {selectedOrder.cancelled_by_name} on {formatDateTimeParts(selectedOrder.cancelled_at).date}
                      <br /><em>Reason:</em> {selectedOrder.cancellation_reason}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer Actions */}
              <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  {isSuperadmin && !['completed', 'cancelled'].includes(selectedOrder.status) && (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ color: '#ef4444', borderColor: '#ef4444', minHeight: '44px', padding: '8px 16px', fontWeight: 600 }}
                      onClick={() => handleOpenActionModal('cancel', selectedOrder)}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedOrder.status === 'new' && !isInventoryStaff && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                      onClick={() => handleStartOrder(selectedOrder.id)}
                    >
                      Start Processing
                    </button>
                  )}

                  {['new', 'processing'].includes(selectedOrder.status) && !isInventoryStaff && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                      onClick={() => handleOpenActionModal('submit_completion', selectedOrder)}
                    >
                      Submit Completion
                    </button>
                  )}

                  {selectedOrder.status === 'completion_requested' && isSuperadmin && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ background: '#16a34a', minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                      disabled={selectedOrder.completion_requested_by === adminUser?.id}
                      title={
                        selectedOrder.completion_requested_by === adminUser?.id
                          ? 'Self-approval is blocked: Another superadministrator must approve.'
                          : 'Approve completion'
                      }
                      onClick={() => handleOpenActionModal('approve', selectedOrder)}
                    >
                      ✓ Approve Completion
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-outline"
                    style={{ minHeight: '44px', padding: '8px 16px', fontWeight: 600 }}
                    onClick={() => setSelectedOrder(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Confirmation Modal */}
        {actionModal.type && (
          <div
            className="admin-modal-backdrop"
            onClick={() => setActionModal({ type: null, order: null, notes: '', error: null, isSubmitting: false })}
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-modal-title"
          >
            <div
              className="admin-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '520px',
                width: 'min(520px, calc(100vw - 20px))',
                maxHeight: 'min(92vh, calc(100dvh - 24px))',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div className="admin-modal-header">
                <h2 id="action-modal-title" className="admin-modal-title">
                  {actionModal.type === 'submit_completion'
                    ? 'Submit Order Completion'
                    : actionModal.type === 'approve'
                    ? 'Approve Order Completion'
                    : 'Cancel Sales Order'}
                </h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setActionModal({ type: null, order: null, notes: '', error: null, isSubmitting: false })}
                  aria-label="Close action modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteAction} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="admin-modal-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px' }}>
                  {actionModal.error && (
                    <div className="admin-banner-disclaimer" style={{ borderColor: '#ef4444', color: '#b91c1c', marginBottom: '12px' }}>
                      {actionModal.error}
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label">
                      {actionModal.type === 'submit_completion'
                        ? 'Employee Handover Remarks *'
                        : actionModal.type === 'approve'
                        ? 'Head Approval Remarks (Optional)'
                        : 'Cancellation Reason *'}
                    </label>
                    <textarea
                      className="form-input"
                      rows="4"
                      placeholder={
                        actionModal.type === 'submit_completion'
                          ? 'e.g. Hardware assembled, bench tested, and handed over to customer with GST invoice.'
                          : actionModal.type === 'approve'
                          ? 'e.g. Verified payments and hardware serials. Approved for permanent archive.'
                          : 'e.g. Customer cancelled requirement prior to assembly.'
                      }
                      value={actionModal.notes}
                      onChange={(e) => setActionModal((prev) => ({ ...prev, notes: e.target.value }))}
                      required={actionModal.type !== 'approve'}
                    ></textarea>
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setActionModal({ type: null, order: null, notes: '', error: null, isSubmitting: false })}
                    disabled={actionModal.isSubmitting}
                    style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className={actionModal.type === 'cancel' ? 'btn-outline' : 'btn-primary'}
                    style={actionModal.type === 'cancel' ? { color: '#ef4444', borderColor: '#ef4444', minHeight: '44px', padding: '8px 18px', fontWeight: 600 } : { minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                    disabled={actionModal.isSubmitting}
                  >
                    {actionModal.isSubmitting ? 'Processing...' : 'Confirm Action'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Monthly Sales Excel Modal */}
        {isExportModalOpen && (
          <div
            className="admin-modal-backdrop"
            onClick={() => setIsExportModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
          >
            <div
              className="admin-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '500px',
                width: 'min(500px, calc(100vw - 20px))',
                maxHeight: 'min(92vh, calc(100dvh - 24px))',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div className="admin-modal-header">
                <div>
                  <h2 id="export-modal-title" className="admin-modal-title">Monthly Sales Report</h2>
                  <span className="modal-subtitle-note">
                    Generates standardized XLSX report strictly based on approval date.
                  </span>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setIsExportModalOpen(false)}
                  aria-label="Close report modal"
                >
                  ✕
                </button>
              </div>

              <div className="admin-modal-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Select Month</label>
                  <select
                    className="form-select"
                    value={exportMonthIndex}
                    onChange={(e) => setExportMonthIndex(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Select Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={exportYear}
                    onChange={(e) => setExportYear(Number(e.target.value))}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <div><strong>Eligible Sales Orders:</strong> {eligibleExportCount}</div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                    Target filename: <code>ARS_Sales_{MONTH_NAMES[exportMonthIndex]}_{exportYear}.xlsx</code>
                  </div>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownloadMonthlyReport}
                  disabled={isExporting}
                  style={{ minHeight: '44px', padding: '8px 18px', fontWeight: 600 }}
                >
                  {isExporting ? 'Generating XLSX...' : 'Download Excel Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Order Modal */}
        <CreateOrderModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onOrderCreated={() => {
            showToast('Sales order created successfully.')
            if (loadAdminOrders) loadAdminOrders()
          }}
        />

        {/* Live Orders Register Modal */}
        <LiveOrdersRegisterModal
          isOpen={isLiveRegisterOpen}
          onClose={() => setIsLiveRegisterOpen(false)}
          orders={orders}
          onSelectOrder={(ord) => {
            setIsLiveRegisterOpen(false)
            setSelectedOrder(ord)
          }}
          onRefresh={loadAdminOrders}
          isLoading={isLoadingOrders}
        />
      </div>
    </AdminLayout>
  )
}
