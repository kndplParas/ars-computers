import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'
import {
  downloadMonthlySalesExcel,
  filterOrdersByReportingMonth,
  isOrderInCurrentMonthCycle,
  filterOrdersForHistoricalMonth,
  calculateMonthlyCycleMetrics
} from '../../utils/salesReportGenerator.js'
import { MONTH_NAMES, formatDateTimeParts } from '../../utils/excelReportGenerator.js'

const CreateOrderModal = lazy(() => import('../../components/admin/CreateOrderModal.jsx'))
const LiveOrdersRegisterModal = lazy(() => import('../../components/admin/LiveOrdersRegisterModal.jsx'))

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
    recordOrderPayment,
    getOrderAttachmentDownloadUrl,
    loadOrderDetails,
    isLoadingOrders,
    ordersError
  } = useAdminData()

  // Monthly Operating Cycle State
  const [currentCalendarDate] = useState(() => new Date())
  const currentCalendarMonth = currentCalendarDate.getMonth() // 0-indexed (0 = Jan, 11 = Dec)
  const currentCalendarYear = currentCalendarDate.getFullYear()

  // Operating Cycle mode: 'current' (default) | 'history'
  const [cycleMode, setCycleMode] = useState('current')

  // History selector: default to previous calendar month
  const [historyMonth, setHistoryMonth] = useState(() => (currentCalendarMonth === 0 ? 11 : currentCalendarMonth - 1))
  const [historyYear, setHistoryYear] = useState(() => (currentCalendarMonth === 0 ? currentCalendarYear - 1 : currentCalendarYear))

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

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    order: null,
    amountReceived: '',
    paymentMethod: 'cash',
    transactionReference: '',
    remarks: '',
    error: null,
    isSubmitting: false
  })

  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null)

  // Format File Size Helper
  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Payment Modal Handlers
  const handleOpenPaymentModal = (order) => {
    const currentBalance = Math.max(0, Number(order.total_amount) - Number(order.paid_amount))
    setPaymentModal({
      isOpen: true,
      order,
      amountReceived: currentBalance > 0 ? currentBalance.toString() : '',
      paymentMethod: 'cash',
      transactionReference: '',
      remarks: '',
      error: null,
      isSubmitting: false
    })
  }

  const handleClosePaymentModal = () => {
    setPaymentModal({
      isOpen: false,
      order: null,
      amountReceived: '',
      paymentMethod: 'cash',
      transactionReference: '',
      remarks: '',
      error: null,
      isSubmitting: false
    })
  }

  const handleConfirmPayment = async (e) => {
    e.preventDefault()
    if (!paymentModal.order) return

    const numAmount = Number(paymentModal.amountReceived)
    const currentBalance = Math.max(0, Number(paymentModal.order.total_amount) - Number(paymentModal.order.paid_amount))

    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentModal((prev) => ({ ...prev, error: 'Payment amount must be greater than zero.' }))
      return
    }

    if (numAmount > currentBalance) {
      setPaymentModal((prev) => ({
        ...prev,
        error: `Payment amount (₹${numAmount.toFixed(2)}) cannot exceed remaining balance (₹${currentBalance.toFixed(2)}).`
      }))
      return
    }

    setPaymentModal((prev) => ({ ...prev, isSubmitting: true, error: null }))

    try {
      await recordOrderPayment({
        orderId: paymentModal.order.id,
        amountReceived: numAmount,
        paymentMethod: paymentModal.paymentMethod,
        transactionReference: paymentModal.transactionReference.trim() || null,
        remarks: paymentModal.remarks.trim() || null
      })

      showToast(`Payment of ₹${numAmount.toFixed(2)} recorded successfully!`)
      if (loadOrderDetails) {
        await loadOrderDetails(paymentModal.order.id)
      }
      handleClosePaymentModal()
    } catch (err) {
      console.error('Failed to record payment:', err)
      setPaymentModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Failed to record payment. Please try again.'
      }))
    }
  }

  // Attachment Download Handler
  const handleDownloadAttachment = async (attachment) => {
    if (!attachment?.storage_path) return
    setDownloadingAttachmentId(attachment.id)
    try {
      const url = await getOrderAttachmentDownloadUrl(attachment.storage_path, attachment.original_filename)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        showToast('Unable to generate download URL for this file.', 'error')
      }
    } catch (err) {
      console.error('Failed to get download URL:', err)
      showToast(err.message || 'Failed to open attachment.', 'error')
    } finally {
      setDownloadingAttachmentId(null)
    }
  }

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

  // In-flight deduplication ref for lazy-loading order details
  const loadingDetailsRef = useRef(new Set())

  // Lazy-load order details (Payments & Attachments) when modal opens
  useEffect(() => {
    if (selectedOrder?.id && loadOrderDetails) {
      if (!loadingDetailsRef.current.has(selectedOrder.id)) {
        loadingDetailsRef.current.add(selectedOrder.id)
        loadOrderDetails(selectedOrder.id).finally(() => {
          loadingDetailsRef.current.delete(selectedOrder.id)
        })
      }
    }
  }, [selectedOrder?.id, loadOrderDetails])

  // Extract available years for history selector
  const availableYears = useMemo(() => {
    const yearsSet = new Set([currentCalendarYear, currentCalendarYear - 1])
    orders.forEach((o) => {
      if (o.created_at) {
        const y = new Date(o.created_at).getFullYear()
        if (!Number.isNaN(y)) yearsSet.add(y)
      }
      if (o.completion_approved_at) {
        const y = new Date(o.completion_approved_at).getFullYear()
        if (!Number.isNaN(y)) yearsSet.add(y)
      }
    })
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [orders, currentCalendarYear])

  // Orders partitioned by active operating cycle
  const cycleOrders = useMemo(() => {
    if (cycleMode === 'current') {
      return orders.filter((o) => isOrderInCurrentMonthCycle(o, currentCalendarMonth, currentCalendarYear))
    } else {
      return filterOrdersForHistoricalMonth(orders, historyMonth, historyYear)
    }
  }, [orders, cycleMode, currentCalendarMonth, currentCalendarYear, historyMonth, historyYear])

  // Active target parameters for metrics
  const activeTargetMonth = cycleMode === 'current' ? currentCalendarMonth : historyMonth
  const activeTargetYear = cycleMode === 'current' ? currentCalendarYear : historyYear
  const isCurrentCycle = cycleMode === 'current'

  // Top Metrics based on operating cycle
  const metrics = useMemo(() => {
    return calculateMonthlyCycleMetrics(orders, activeTargetMonth, activeTargetYear, isCurrentCycle)
  }, [orders, activeTargetMonth, activeTargetYear, isCurrentCycle])

  // Filtered Orders within active cycle
  const filteredOrders = useMemo(() => {
    return cycleOrders.filter((o) => {
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
  }, [cycleOrders, activeTab, paymentFilter, searchQuery])

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

  // 1-Click Monthly Excel download for active or historical cycle
  const handleDownloadCycleExcel = async (targetMonth, targetYear) => {
    setIsExporting(true)
    try {
      const res = await downloadMonthlySalesExcel(orders, targetMonth, targetYear)
      showToast(`Sales report generated: ${res.filename} (${res.count} records)`, 'success')
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

        {/* Monthly Operating Cycle Control Bar */}
        <div
          className="admin-cycle-control-bar"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Left: Operating Cycle Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operating Cycle:
            </span>

            <button
              type="button"
              className={`btn-sm ${cycleMode === 'current' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCycleMode('current')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <span>📅</span>
              <span>Current Month — {MONTH_NAMES[currentCalendarMonth]} {currentCalendarYear}</span>
            </button>

            <button
              type="button"
              className={`btn-sm ${cycleMode === 'history' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCycleMode('history')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <span>📜</span>
              <span>Monthly History</span>
            </button>
          </div>

          {/* Right: Contextual Controls & Quick Excel Download */}
          {cycleMode === 'current' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid #a7f3d0'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Live Working Month
              </span>

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => handleDownloadCycleExcel(currentCalendarMonth, currentCalendarYear)}
                disabled={isExporting}
                title={`Download standard Excel report for ${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <span>📥</span>
                <span>Download Current Month Excel</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Month:</label>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '130px', padding: '5px 10px', fontSize: '13px' }}
                value={historyMonth}
                onChange={(e) => setHistoryMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Year:</label>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '95px', padding: '5px 10px', fontSize: '13px' }}
                value={historyYear}
                onChange={(e) => setHistoryYear(Number(e.target.value))}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => handleDownloadCycleExcel(historyMonth, historyYear)}
                disabled={isExporting}
                title={`Download standard Excel report for ${MONTH_NAMES[historyMonth]} ${historyYear}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <span>📥</span>
                <span>Download {MONTH_NAMES[historyMonth]} Excel</span>
              </button>
            </div>
          )}
        </div>

        {/* Historical Archive Notice Banner */}
        {cycleMode === 'history' && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #94a3b8',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div>
              <span>📜 <strong>Viewing Historical Archive:</strong> {MONTH_NAMES[historyMonth]} {historyYear} (Read-Only Inspection).</span>
              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                All database records remain permanently preserved in Supabase. Unfinished active jobs remain in Current Month.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCycleMode('current')}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                textDecoration: 'underline'
              }}
            >
              Return to Current Month ({MONTH_NAMES[currentCalendarMonth]} {currentCalendarYear}) →
            </button>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="admin-summary-grid four-cards" style={{ marginBottom: '24px' }}>
          {/* Card 1: Active Orders */}
          <div className="admin-stat-card">
            <div className="stat-card-icon blue">🛒</div>
            <div className="stat-card-content">
              <span className="stat-label">
                {cycleMode === 'current' ? 'Active Orders' : 'Historical Active'}
              </span>
              <div className="stat-number-wrap">
                <span className="stat-number">{metrics.active}</span>
                <span className="stat-badge blue" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  {cycleMode === 'current' ? 'Live' : 'Archive'}
                </span>
              </div>
              <span className="stat-subtext">
                {cycleMode === 'current' ? 'New & Processing (All Live Work)' : `Created in ${MONTH_NAMES[historyMonth]}`}
              </span>
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
              <span className="stat-subtext">
                {cycleMode === 'current' ? 'Awaiting Head Approval' : 'Historical Pending'}
              </span>
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
              <span className="stat-subtext">
                Approved in {MONTH_NAMES[activeTargetMonth]} {activeTargetYear}
              </span>
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
              <span className="stat-subtext">
                Finalized Sales in {MONTH_NAMES[activeTargetMonth]} {activeTargetYear}
              </span>
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
            Active Orders ({cycleOrders.filter((o) => ['new', 'processing'].includes(o.status)).length})
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
            Completion Pending ({cycleOrders.filter((o) => o.status === 'completion_requested').length})
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
            Completed History ({cycleOrders.filter((o) => o.status === 'completed').length})
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
            Cancelled ({cycleOrders.filter((o) => o.status === 'cancelled').length})
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
            All Cycle Orders ({cycleOrders.length})
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
                          <div>{dateParts.date}</div>
                          {o.completion_approved_at && (
                            <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px', fontWeight: 500 }}>
                              Approved: {formatDateTimeParts(o.completion_approved_at).date}
                            </div>
                          )}
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
                          Created: {dateParts.date}
                        </span>
                        {o.completion_approved_at && (
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#166534', marginTop: '1px', fontWeight: 500 }}>
                            Approved: {formatDateTimeParts(o.completion_approved_at).date}
                          </span>
                        )}
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
        {selectedOrder && (() => {
          const displayOrder = orders.find((o) => o.id === selectedOrder.id) || selectedOrder
          const currentBal = Math.max(0, Number(displayOrder.total_amount) - Number(displayOrder.paid_amount))
          return (
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', alignItems: 'center' }}>
                  <div>
                    <div><strong>Payment Method:</strong> {(displayOrder.payment_method || 'cash').toUpperCase()}</div>
                    <div><strong>Payment Status:</strong> {(displayOrder.payment_status || 'pending').toUpperCase()}</div>
                  </div>
                  <div>
                    <div><strong>Total Amount:</strong> ₹{Number(displayOrder.total_amount).toFixed(2)}</div>
                    <div><strong>Amount Paid:</strong> ₹{Number(displayOrder.paid_amount).toFixed(2)}</div>
                    <div style={{ color: currentBal > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                      Balance Due: ₹{currentBal.toFixed(2)}
                    </div>
                  </div>
                  {/* Update Payment Button */}
                  {currentBal > 0 && displayOrder.status !== 'cancelled' && !isInventoryStaff && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onClick={() => handleOpenPaymentModal(displayOrder)}
                      >
                        💳 Update Payment
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
                    Payment History
                  </div>
                  {Array.isArray(displayOrder.order_payments) && displayOrder.order_payments.length > 0 ? (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date & Time</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>Method</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Reference</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Received By</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...displayOrder.order_payments]
                            .sort((a, b) => new Date(a.received_at || a.created_at) - new Date(b.received_at || b.created_at))
                            .map((pay) => (
                              <tr key={pay.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', color: '#475569' }}>
                                  {formatDateTimeParts(pay.received_at || pay.created_at).date}{' '}
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {formatDateTimeParts(pay.received_at || pay.created_at).time}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                                  ₹{Number(pay.amount_received).toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: '#f1f5f9',
                                      color: '#334155'
                                    }}
                                  >
                                    {(pay.payment_method || 'cash').toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '12px' }}>
                                  {pay.transaction_reference || '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#334155' }}>
                                  {pay.received_by_name || 'Staff'}{' '}
                                  {pay.received_by_employee_code ? (
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      ({pay.received_by_employee_code})
                                    </span>
                                  ) : null}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '12px' }}>
                                  {pay.remarks || '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#64748b', fontStyle: 'italic', border: '1px solid #e2e8f0' }}>
                      No payment transaction history recorded.
                    </div>
                  )}
                </div>

                {/* Supporting Documents (Order Attachments) */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
                    Supporting Documents
                  </div>
                  {Array.isArray(displayOrder.order_attachments) && displayOrder.order_attachments.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                      {displayOrder.order_attachments.map((att) => {
                        const ext = (att.original_filename || '').split('.').pop().toUpperCase()
                        const isPdf = ext === 'PDF' || att.mime_type === 'application/pdf'
                        const isDownloading = downloadingAttachmentId === att.id
                        return (
                          <div
                            key={att.id}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: isPdf ? '#fee2e2' : '#e0f2fe',
                                  color: isPdf ? '#991b1b' : '#0369a1',
                                  flexShrink: 0
                                }}
                              >
                                {ext || 'FILE'}
                              </span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: '#0f172a',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={att.original_filename}
                                >
                                  {att.original_filename}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  {formatFileSize(att.file_size)} • {formatDateTimeParts(att.uploaded_at || att.created_at).date}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                disabled={isDownloading}
                                onClick={() => handleDownloadAttachment(att)}
                              >
                                {isDownloading ? 'Opening...' : '📥 View / Download'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#64748b', fontStyle: 'italic', border: '1px solid #e2e8f0' }}>
                      No supporting documents attached to this order.
                    </div>
                  )}
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
        ); })()}

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
        {isCreateModalOpen && (
          <Suspense fallback={null}>
            <CreateOrderModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onOrderCreated={(createdOrder, attachmentFailures) => {
                if (attachmentFailures > 0) {
                  showToast(
                    `Sales order ${createdOrder?.order_number || ''} created successfully, but some supporting documents could not be uploaded. You can retry from Order Details.`,
                    'warning'
                  )
                } else {
                  showToast('Sales order created successfully.')
                }
                if (loadAdminOrders) loadAdminOrders()
              }}
            />
          </Suspense>
        )}

        {/* Live Orders Register Modal */}
        {isLiveRegisterOpen && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}
        {/* Update Payment Modal */}
        {paymentModal.isOpen && paymentModal.order && (
          <div
            className="admin-modal-backdrop"
            onClick={handleClosePaymentModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            style={{ zIndex: 1200 }}
          >
            <div
              className="admin-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '480px', width: 'min(480px, calc(100vw - 24px))' }}
            >
              <div className="admin-modal-header">
                <h3 id="payment-modal-title" className="admin-modal-title">
                  Record Payment — {paymentModal.order.order_number || paymentModal.order.id}
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={handleClosePaymentModal}
                  disabled={paymentModal.isSubmitting}
                  aria-label="Close payment modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmPayment}>
                <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
                  {paymentModal.error && (
                    <div
                      style={{
                        background: '#fee2e2',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '13px',
                        color: '#991b1b'
                      }}
                    >
                      {paymentModal.error}
                    </div>
                  )}

                  {/* Balance context info */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Order Total:</span>
                      <strong>₹{Number(paymentModal.order.total_amount).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Already Paid:</span>
                      <strong>₹{Number(paymentModal.order.paid_amount).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>Remaining Balance Due:</span>
                      <strong style={{ color: '#b91c1c' }}>
                        ₹{Math.max(0, Number(paymentModal.order.total_amount) - Number(paymentModal.order.paid_amount)).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* Amount Received Input */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="pay-amount-input" className="form-label" style={{ fontWeight: 600 }}>
                      Amount Received (₹) *
                    </label>
                    <input
                      id="pay-amount-input"
                      type="number"
                      min="0.01"
                      max={Math.max(0, Number(paymentModal.order.total_amount) - Number(paymentModal.order.paid_amount))}
                      step="0.01"
                      className="form-input"
                      value={paymentModal.amountReceived}
                      onChange={(e) => setPaymentModal((prev) => ({ ...prev, amountReceived: e.target.value }))}
                      disabled={paymentModal.isSubmitting}
                      required
                      placeholder="Enter amount received"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="pay-method-select" className="form-label" style={{ fontWeight: 600 }}>
                      Payment Method *
                    </label>
                    <select
                      id="pay-method-select"
                      className="form-select"
                      value={paymentModal.paymentMethod}
                      onChange={(e) => setPaymentModal((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                      disabled={paymentModal.isSubmitting}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                      <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                      <option value="card">Card Payment</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other / Store Credit</option>
                    </select>
                  </div>

                  {/* Transaction Reference */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="pay-ref-input" className="form-label">
                      Transaction / Reference Number (Optional)
                    </label>
                    <input
                      id="pay-ref-input"
                      type="text"
                      className="form-input"
                      value={paymentModal.transactionReference}
                      onChange={(e) => setPaymentModal((prev) => ({ ...prev, transactionReference: e.target.value }))}
                      disabled={paymentModal.isSubmitting}
                      placeholder="e.g. UPI Ref: 3291823901, Cheque #0045"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="pay-remarks-input" className="form-label">
                      Remarks / Notes (Optional)
                    </label>
                    <textarea
                      id="pay-remarks-input"
                      className="form-input"
                      rows="2"
                      value={paymentModal.remarks}
                      onChange={(e) => setPaymentModal((prev) => ({ ...prev, remarks: e.target.value }))}
                      disabled={paymentModal.isSubmitting}
                      placeholder="e.g. Second milestone payment received at counter"
                    />
                  </div>
                </div>

                <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handleClosePaymentModal}
                    disabled={paymentModal.isSubmitting}
                    style={{ minHeight: '40px', padding: '8px 16px', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={paymentModal.isSubmitting}
                    style={{ minHeight: '40px', padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}
                  >
                    {paymentModal.isSubmitting ? 'Recording...' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
