import { useState, useEffect, useMemo } from 'react'
import { useAdminAuth } from '../../context/adminAuthContext'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  MONTH_NAMES,
  formatINR,
  formatPercentage,
  fetchMonthlyBusinessData,
  computeMonthlySummary,
  computeProductWisePerformance,
  computeCategoryPerformance,
  computeDailyTrend,
  computePaymentAnalysis,
  computeBusinessInsights
} from '../../utils/businessAnalyticsHelper'

// Static calendar defaults outside render function to maintain purity
const CURRENT_REAL_YEAR = new Date().getFullYear()
const CURRENT_REAL_MONTH = new Date().getMonth()

/**
 * ============================================================================
 * ARS Computers — Monthly Business Analytics & Performance Overlay
 * ============================================================================
 * Executive-grade monthly business intelligence report modal.
 * Sits full-screen above the current page, preserving application state.
 *
 * Core Access Rules:
 * - Gated to: superadmin, admin, account, technical, engineer, hr.
 * - Inventory staff is strictly excluded.
 * - Confidential financial columns (Purchase Cost, Gross Profit, Profit Margin)
 *   are visible exclusively to Management & Accounts (superadmin, admin, account).
 *   For operational roles (technical, engineer, hr), these are masked with
 *   "🔒 Restricted to Management / Accounts".
 * ============================================================================
 */
export default function BusinessAnalyticsOverlay({ isOpen, onClose }) {
  const { adminUser } = useAdminAuth()

  const [selectedYear, setSelectedYear] = useState(CURRENT_REAL_YEAR)
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_REAL_MONTH)

  // Data Loading & State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rawData, setRawData] = useState(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  // Filters & Sorting for Product Table
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [productSortField, setProductSortField] = useState('netSales') // 'netSales' | 'quantitySold' | 'grossProfit' | 'profitMargin'
  const [productSortOrder, setProductSortOrder] = useState('desc') // 'asc' | 'desc'
  const [expandedProductKeys, setExpandedProductKeys] = useState(new Set())

  // Role permissions
  const role = adminUser?.role || 'inventory_staff'
  const canViewFinancials = ['superadmin', 'admin', 'account'].includes(role)
  const isAuthorized = ['superadmin', 'admin', 'account', 'technical', 'engineer', 'hr'].includes(role)

  // Fetch data whenever month, year, or reload trigger changes
  useEffect(() => {
    if (!isOpen || !isAuthorized) return

    let isMounted = true

    async function loadData() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error('Supabase client is not configured.')
        }

        const data = await fetchMonthlyBusinessData(selectedYear, selectedMonth, supabase)
        if (isMounted) {
          setRawData(data)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('[BusinessAnalytics] Data load error:', err)
          setError(err.message || 'Failed to load business analytics data.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [isOpen, isAuthorized, selectedYear, selectedMonth, reloadTrigger])

  const handleRetry = () => {
    setLoading(true)
    setReloadTrigger((prev) => prev + 1)
  }

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Month navigation handlers
  const handlePrevMonth = () => {
    setLoading(true)
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear((prev) => prev - 1)
    } else {
      setSelectedMonth((prev) => prev - 1)
    }
  }

  const isCurrentMonthSelected = selectedYear === CURRENT_REAL_YEAR && selectedMonth === CURRENT_REAL_MONTH
  const isFutureMonth = selectedYear > CURRENT_REAL_YEAR || (selectedYear === CURRENT_REAL_YEAR && selectedMonth >= CURRENT_REAL_MONTH)

  const handleNextMonth = () => {
    if (isFutureMonth) return
    setLoading(true)
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear((prev) => prev + 1)
    } else {
      setSelectedMonth((prev) => prev + 1)
    }
  }

  const handleCurrentMonth = () => {
    setLoading(true)
    setSelectedYear(CURRENT_REAL_YEAR)
    setSelectedMonth(CURRENT_REAL_MONTH)
  }

  // Compute derived datasets
  const summary = useMemo(() => {
    if (!rawData) return null
    return computeMonthlySummary({
      ordersInMonth: rawData.ordersInMonth,
      completedSales: rawData.completedSalesInMonth,
      paymentsInMonth: rawData.paymentsInMonth,
      products: rawData.products
    })
  }, [rawData])

  const productSales = useMemo(() => {
    if (!rawData) return []
    return computeProductWisePerformance({
      completedSales: rawData.completedSalesInMonth,
      products: rawData.products,
      categories: rawData.categories
    })
  }, [rawData])

  const categorySales = useMemo(() => {
    if (!summary) return []
    return computeCategoryPerformance(productSales, summary.salesRevenue)
  }, [productSales, summary])

  const dailyTrend = useMemo(() => {
    if (!rawData) return []
    return computeDailyTrend(
      rawData.completedSalesInMonth,
      rawData.paymentsInMonth,
      rawData.targetRange.daysInMonth
    )
  }, [rawData])

  const paymentAnalysis = useMemo(() => {
    if (!rawData) return null
    return computePaymentAnalysis(
      rawData.paymentsInMonth,
      rawData.ordersInMonth,
      rawData.targetRange
    )
  }, [rawData])

  const insights = useMemo(() => {
    if (!summary || !paymentAnalysis || !rawData) return []
    return computeBusinessInsights({
      summary,
      productSales,
      categorySales,
      paymentAnalysis,
      prevData: {
        ...rawData.prevData,
        prevMonthIndex: rawData.prevMonthIndex,
        prevYear: rawData.prevYear
      },
      monthIndex: selectedMonth,
      year: selectedYear
    })
  }, [summary, productSales, categorySales, paymentAnalysis, rawData, selectedMonth, selectedYear])

  // Filtered and sorted product sales list
  const filteredProductSales = useMemo(() => {
    let list = [...productSales]

    // Category filter
    if (productCategoryFilter !== 'all') {
      list = list.filter((p) => p.category === productCategoryFilter)
    }

    // Search query
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[productSortField]
      let valB = b[productSortField]

      if (valA === null || valA === undefined) valA = -Infinity
      if (valB === null || valB === undefined) valB = -Infinity

      if (productSortOrder === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0
    })

    return list
  }, [productSales, productCategoryFilter, productSearchQuery, productSortField, productSortOrder])

  const toggleExpandProduct = (key) => {
    setExpandedProductKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Previous Month Comparison Calculations
  const momComparison = useMemo(() => {
    if (!summary || !rawData?.prevData) return null
    const prevRev = (rawData.prevData.completedSales || []).reduce(
      (acc, o) => acc + Number(o.total_amount || 0),
      0
    )
    const prevOrdersCount = rawData.prevData.ordersCreatedCount || 0
    const prevCompletedCount = rawData.prevData.completedSales.length || 0
    const prevCollected = rawData.prevData.totalCollected || 0

    let prevUnits = 0
    ;(rawData.prevData.completedSales || []).forEach((order) => {
      ;(order.order_items || []).forEach((item) => {
        prevUnits += Number(item.quantity || 0)
      })
    })

    const revDiff = summary.salesRevenue - prevRev
    const revPct = prevRev > 0 ? (revDiff / prevRev) * 100 : null

    const ordersDiff = summary.totalOrdersCount - prevOrdersCount
    const ordersPct = prevOrdersCount > 0 ? (ordersDiff / prevOrdersCount) * 100 : null

    const unitsDiff = summary.unitsSold - prevUnits
    const unitsPct = prevUnits > 0 ? (unitsDiff / prevUnits) * 100 : null

    const collDiff = summary.totalCollected - prevCollected
    const collPct = prevCollected > 0 ? (collDiff / prevCollected) * 100 : null

    return {
      prevMonthName: `${MONTH_NAMES[rawData.prevMonthIndex]} ${rawData.prevYear}`,
      prevRev,
      revDiff,
      revPct,
      prevOrdersCount,
      ordersDiff,
      ordersPct,
      prevUnits,
      unitsDiff,
      unitsPct,
      prevCollected,
      collDiff,
      collPct,
      prevCompletedCount
    }
  }, [summary, rawData])

  if (!isOpen) return null

  // If role is completely unauthorized (e.g. inventory_staff)
  if (!isAuthorized) {
    return (
      <div className="business-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="business-report-title">
        <div className="business-overlay-container">
          <div className="business-modal-header">
            <h2 id="business-report-title">Access Restricted</h2>
            <button type="button" className="business-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
          </div>
          <div className="business-empty-state" style={{ padding: '40px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔒</span>
            <h3>Access Denied</h3>
            <p>Your current role does not have permission to view Business Analytics reports.</p>
          </div>
        </div>
      </div>
    )
  }

  // Year options: past 3 years + current year
  const yearOptions = [CURRENT_REAL_YEAR - 2, CURRENT_REAL_YEAR - 1, CURRENT_REAL_YEAR]

  return (
    <div
      className="business-overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-report-title"
    >
      <div className="business-overlay-container">
        {/* Top Header Bar */}
        <header className="business-overlay-header">
          <div className="business-header-left">
            <div className="business-header-title-row">
              <span className="business-header-icon" aria-hidden="true">📈</span>
              <div>
                <h1 id="business-report-title" className="business-title">
                  Business Monthly Analytics
                </h1>
                <p className="business-subtitle">
                  Audited sales performance, revenue, collections, and catalog product margins
                </p>
              </div>
            </div>
          </div>

          <div className="business-header-center">
            {/* Month & Year Selection Bar */}
            <div className="business-month-selector">
              <button
                type="button"
                className="btn-month-nav"
                onClick={handlePrevMonth}
                title="View previous month"
              >
                ◀ Prev
              </button>

              <select
                className="business-select business-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                aria-label="Select report month"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="business-select business-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Select report year"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-month-nav"
                onClick={handleNextMonth}
                disabled={isFutureMonth}
                title={isFutureMonth ? 'Future months cannot be selected' : 'View next month'}
              >
                Next ▶
              </button>

              <button
                type="button"
                className={`btn-current-month ${isCurrentMonthSelected ? 'active' : ''}`}
                onClick={handleCurrentMonth}
                title="Jump to current active month"
              >
                Current Month
              </button>
            </div>
          </div>

          <div className="business-header-right">
            <div className="business-period-badge">
              <span className="period-dot" />
              <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>
            </div>

            <button
              type="button"
              className="business-close-btn"
              onClick={onClose}
              title="Close report (Esc)"
              aria-label="Close monthly business analytics"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Modal Main Scrollable Content */}
        <div className="business-overlay-body">
          {loading ? (
            <div className="business-loading-state">
              <div className="business-spinner" aria-hidden="true" />
              <p>Loading {MONTH_NAMES[selectedMonth]} {selectedYear} Business Records...</p>
            </div>
          ) : error ? (
            <div className="business-error-state">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <h3>Unable to load business report</h3>
              <p>{error}</p>
              <button type="button" className="btn-primary btn-sm" onClick={handleRetry}>
                Retry
              </button>
            </div>
          ) : summary ? (
            <>
              {/* Distinct Definition Banner */}
              <div className="business-definitions-banner">
                <div className="definition-item">
                  <span className="def-pill def-revenue">Total Sales Revenue</span>
                  <span className="def-text">Invoice value of orders completed &amp; Head-approved in {MONTH_NAMES[selectedMonth]}.</span>
                </div>
                <div className="definition-item">
                  <span className="def-pill def-collected">Amount Collected</span>
                  <span className="def-text">Actual cash/UPI/bank deposits recorded in ledger during this month.</span>
                </div>
                <div className="definition-item">
                  <span className="def-pill def-profit">Actual Gross Profit</span>
                  <span className="def-text">Net Sales minus verified Catalog Purchase Cost (cost must be recorded in inventory).</span>
                </div>
              </div>

              {/* 1. Main Executive Summary KPI Cards (10 Core Metrics) */}
              <section className="business-section" aria-labelledby="section-kpis">
                <div className="business-section-header">
                  <h2 id="section-kpis" className="business-section-title">
                    Executive Performance Summary — {MONTH_NAMES[selectedMonth]} {selectedYear}
                  </h2>
                  <span className="section-note">Figures updated from verified order and payment ledgers</span>
                </div>

                <div className="business-kpi-grid">
                  {/* Card 1: Total Sales Revenue */}
                  <div className="business-kpi-card kpi-highlight-primary">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total Sales Revenue</span>
                      <span className="kpi-icon" aria-hidden="true">💰</span>
                    </div>
                    <div className="kpi-value">{formatINR(summary.salesRevenue)}</div>
                    <div className="kpi-meta">
                      From {summary.completedSalesCount} completed &amp; approved orders
                    </div>
                  </div>

                  {/* Card 2: Actual Gross Profit */}
                  <div className="business-kpi-card kpi-highlight-success">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Actual Gross Profit</span>
                      <span className="kpi-icon" aria-hidden="true">📊</span>
                    </div>
                    <div className="kpi-value">
                      {!canViewFinancials ? (
                        <span className="restricted-badge">🔒 Restricted</span>
                      ) : summary.hasCompleteCostData ? (
                        formatINR(summary.verifiedGrossProfit)
                      ) : summary.hasPartialCostData ? (
                        <span>
                          {formatINR(summary.verifiedGrossProfit)}
                          <span className="kpi-badge-warn">Partial</span>
                        </span>
                      ) : (
                        <span className="kpi-na-text">Cost unavailable</span>
                      )}
                    </div>
                    <div className="kpi-meta">
                      {!canViewFinancials ? (
                        'Restricted to Management / Accounts'
                      ) : summary.hasCompleteCostData ? (
                        `Total verified cost: ${formatINR(summary.totalCostAvailable)}`
                      ) : summary.hasPartialCostData ? (
                        `${summary.soldItemsMissingCostCount} items lack catalog cost`
                      ) : (
                        'Catalog costs not recorded. Profit shown as N/A.'
                      )}
                    </div>
                  </div>

                  {/* Card 3: Total Orders */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total Orders Placed</span>
                      <span className="kpi-icon" aria-hidden="true">🛒</span>
                    </div>
                    <div className="kpi-value">{summary.totalOrdersCount}</div>
                    <div className="kpi-meta">
                      Orders placed in {MONTH_NAMES[selectedMonth]}
                    </div>
                  </div>

                  {/* Card 4: Completed Sales */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Completed Sales</span>
                      <span className="kpi-icon" aria-hidden="true">✅</span>
                    </div>
                    <div className="kpi-value">{summary.completedSalesCount}</div>
                    <div className="kpi-meta">
                      Full orders fulfilled and approved
                    </div>
                  </div>

                  {/* Card 5: Units Sold */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total Units Sold</span>
                      <span className="kpi-icon" aria-hidden="true">📦</span>
                    </div>
                    <div className="kpi-value">{summary.unitsSold}</div>
                    <div className="kpi-meta">
                      Individual product items delivered
                    </div>
                  </div>

                  {/* Card 6: Total Amount Collected */}
                  <div className="business-kpi-card kpi-highlight-accent">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total Amount Collected</span>
                      <span className="kpi-icon" aria-hidden="true">🏦</span>
                    </div>
                    <div className="kpi-value">{formatINR(summary.totalCollected)}</div>
                    <div className="kpi-meta">
                      Real payments received in payment ledger
                    </div>
                  </div>

                  {/* Card 7: Pending Payment Balance */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Pending Payment Balance</span>
                      <span className="kpi-icon" aria-hidden="true">⏳</span>
                    </div>
                    <div className="kpi-value">{formatINR(summary.pendingBalance)}</div>
                    <div className="kpi-meta">
                      Outstanding balance on active monthly orders
                    </div>
                  </div>

                  {/* Card 8: Discounts Given */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Discounts Given</span>
                      <span className="kpi-icon" aria-hidden="true">🏷️</span>
                    </div>
                    <div className="kpi-value">{formatINR(summary.discountsGiven)}</div>
                    <div className="kpi-meta">
                      Concessions deducted on monthly orders
                    </div>
                  </div>

                  {/* Card 9: Refunds / Cancelled */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Cancelled Orders</span>
                      <span className="kpi-icon" aria-hidden="true">🚫</span>
                    </div>
                    <div className="kpi-value">{summary.cancelledOrdersCount}</div>
                    <div className="kpi-meta">
                      Total cancelled volume: {formatINR(summary.cancelledAmount)}
                    </div>
                  </div>

                  {/* Card 10: Average Order Value */}
                  <div className="business-kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Average Order Value (AOV)</span>
                      <span className="kpi-icon" aria-hidden="true">🎯</span>
                    </div>
                    <div className="kpi-value">{formatINR(summary.averageOrderValue)}</div>
                    <div className="kpi-meta">
                      Sales Revenue ÷ Completed Sales
                    </div>
                  </div>
                </div>

                {/* Net Profit Clarification Notice */}
                <div className="net-profit-notice">
                  <span className="info-icon" aria-hidden="true">ℹ️</span>
                  <span>
                    <strong>Net Profit Status:</strong> {summary.netProfitStatus}.
                    ARS Computers tracks direct gross sales, catalog product costs, and payment receipts.
                    Store rent, technician salaries, utility bills, and other overhead expenses are not stored in this database.
                  </span>
                </div>
              </section>

              {/* 2. Top Business Insights */}
              <section className="business-section" aria-labelledby="section-insights">
                <div className="business-section-header">
                  <h2 id="section-insights" className="business-section-title">
                    Key Performance Insights &amp; Operational Highlights
                  </h2>
                  <span className="section-note">Factual findings derived directly from monthly transactions</span>
                </div>

                <div className="insights-grid">
                  {insights.map((ins, i) => (
                    <div key={i} className={`insight-card insight-${ins.type}`}>
                      <div className="insight-card-header">
                        <span className="insight-title">{ins.title}</span>
                        <span className="insight-badge">{ins.badge}</span>
                      </div>
                      <p className="insight-desc">{ins.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Monthly Sales Trend & Previous Month Comparison */}
              <section className="business-section" aria-labelledby="section-comparison">
                <div className="business-section-header">
                  <h2 id="section-comparison" className="business-section-title">
                    Month-over-Month Comparison &amp; Daily Trend
                  </h2>
                  <span className="section-note">
                    Benchmarking {MONTH_NAMES[selectedMonth]} {selectedYear} against {momComparison?.prevMonthName}
                  </span>
                </div>

                {momComparison && (
                  <div className="comparison-cards-grid">
                    <div className="comparison-card">
                      <span className="comp-label">Sales Revenue MoM</span>
                      <div className="comp-figures">
                        <span className="comp-current">{formatINR(summary.salesRevenue)}</span>
                        <span className={`comp-pct ${momComparison.revPct >= 0 ? 'pct-up' : 'pct-down'}`}>
                          {formatPercentage(momComparison.revPct)}
                        </span>
                      </div>
                      <span className="comp-prev">Previous: {formatINR(momComparison.prevRev)}</span>
                    </div>

                    <div className="comparison-card">
                      <span className="comp-label">Orders Placed MoM</span>
                      <div className="comp-figures">
                        <span className="comp-current">{summary.totalOrdersCount} orders</span>
                        <span className={`comp-pct ${momComparison.ordersPct >= 0 ? 'pct-up' : 'pct-down'}`}>
                          {formatPercentage(momComparison.ordersPct)}
                        </span>
                      </div>
                      <span className="comp-prev">Previous: {momComparison.prevOrdersCount} orders</span>
                    </div>

                    <div className="comparison-card">
                      <span className="comp-label">Units Delivered MoM</span>
                      <div className="comp-figures">
                        <span className="comp-current">{summary.unitsSold} units</span>
                        <span className={`comp-pct ${momComparison.unitsPct >= 0 ? 'pct-up' : 'pct-down'}`}>
                          {formatPercentage(momComparison.unitsPct)}
                        </span>
                      </div>
                      <span className="comp-prev">Previous: {momComparison.prevUnits} units</span>
                    </div>

                    <div className="comparison-card">
                      <span className="comp-label">Payment Collections MoM</span>
                      <div className="comp-figures">
                        <span className="comp-current">{formatINR(summary.totalCollected)}</span>
                        <span className={`comp-pct ${momComparison.collPct >= 0 ? 'pct-up' : 'pct-down'}`}>
                          {formatPercentage(momComparison.collPct)}
                        </span>
                      </div>
                      <span className="comp-prev">Previous: {formatINR(momComparison.prevCollected)}</span>
                    </div>
                  </div>
                )}

                {/* Daily Distribution Table / Compact View */}
                <div className="daily-trend-container">
                  <h3 className="sub-section-title">Daily Sales &amp; Payment Ledger Distribution</h3>
                  <div className="daily-table-wrapper">
                    <table className="daily-trend-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Completed Sales</th>
                          <th>Sales Revenue</th>
                          <th>Amount Collected</th>
                          <th>Activity Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyTrend.map((d) => {
                          const maxMetric = Math.max(
                            ...dailyTrend.map((t) => Math.max(t.revenue, t.collected))
                          ) || 1
                          const revBarPct = Math.min(100, (d.revenue / maxMetric) * 100)
                          const collBarPct = Math.min(100, (d.collected / maxMetric) * 100)

                          return (
                            <tr key={d.day} className={d.revenue > 0 || d.collected > 0 ? 'has-activity' : 'no-activity'}>
                              <td className="day-cell">
                                <strong>Day {d.day}</strong>
                              </td>
                              <td>{d.completedSalesCount > 0 ? `${d.completedSalesCount} order(s)` : '—'}</td>
                              <td className="amount-cell">{d.revenue > 0 ? formatINR(d.revenue) : '—'}</td>
                              <td className="amount-cell">{d.collected > 0 ? formatINR(d.collected) : '—'}</td>
                              <td className="bar-cell">
                                <div className="dual-bar-container">
                                  {d.revenue > 0 && (
                                    <div
                                      className="bar-fill bar-revenue"
                                      style={{ width: `${revBarPct}%` }}
                                      title={`Revenue: ${formatINR(d.revenue)}`}
                                    />
                                  )}
                                  {d.collected > 0 && (
                                    <div
                                      className="bar-fill bar-collected"
                                      style={{ width: `${collBarPct}%` }}
                                      title={`Collected: ${formatINR(d.collected)}`}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* 4. Product-Wise Sales & Profit Analysis */}
              <section className="business-section" aria-labelledby="section-products">
                <div className="business-section-header">
                  <div>
                    <h2 id="section-products" className="business-section-title">
                      Product-Wise Sales &amp; Profit Analysis
                    </h2>
                    <span className="section-note">
                      Showing sales volume, realized revenue, and catalog margin integrity
                    </span>
                  </div>

                  {/* Controls: Search, Category Filter, Sort */}
                  <div className="product-table-controls">
                    <input
                      type="text"
                      className="business-input product-search-input"
                      placeholder="Search product or SKU..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      aria-label="Filter products"
                    />

                    <select
                      className="business-select"
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      aria-label="Filter by category"
                    >
                      <option value="all">All Categories ({rawData.categories.length})</option>
                      {rawData.categories.map((c) => (
                        <option key={c.id} value={c.title}>
                          {c.title}
                        </option>
                      ))}
                    </select>

                    <select
                      className="business-select"
                      value={`${productSortField}-${productSortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-')
                        setProductSortField(field)
                        setProductSortOrder(order)
                      }}
                      aria-label="Sort product table"
                    >
                      <option value="netSales-desc">Highest Revenue</option>
                      <option value="netSales-asc">Lowest Revenue</option>
                      <option value="quantitySold-desc">Highest Units Sold</option>
                      <option value="quantitySold-asc">Lowest Units Sold</option>
                      {canViewFinancials && (
                        <>
                          <option value="grossProfit-desc">Highest Gross Profit</option>
                          <option value="profitMargin-desc">Highest Margin %</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {filteredProductSales.length === 0 ? (
                  <div className="business-empty-table">
                    <p>No product sales recorded matching your search / filter criteria.</p>
                  </div>
                ) : (
                  <div className="business-table-wrapper">
                    <table className="business-data-table">
                      <thead>
                        <tr>
                          <th>Product Name &amp; SKU</th>
                          <th>Category</th>
                          <th className="text-right">Qty Sold</th>
                          <th className="text-right">Gross Sales</th>
                          <th className="text-right">Net Sales</th>
                          <th className="text-right">Purchase Cost</th>
                          <th className="text-right">Gross Profit</th>
                          <th className="text-right">Margin %</th>
                          <th className="text-center">Transactions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProductSales.map((prod, idx) => {
                          const rowKey = prod.productId || `prod_${idx}`
                          const isExpanded = expandedProductKeys.has(rowKey)

                          return (
                            <tr key={rowKey} className={isExpanded ? 'row-expanded' : ''}>
                              <td className="product-title-cell">
                                <span className="product-cell-name">{prod.productName}</span>
                                <span className="product-cell-sku">SKU: {prod.sku}</span>
                              </td>
                              <td>
                                <span className="category-pill">{prod.category}</span>
                              </td>
                              <td className="text-right font-medium">{prod.quantitySold}</td>
                              <td className="text-right">{formatINR(prod.grossSales)}</td>
                              <td className="text-right font-semibold text-primary">{formatINR(prod.netSales)}</td>

                              {/* Purchase Cost (Restricted/Strict Validation) */}
                              <td className="text-right">
                                {!canViewFinancials ? (
                                  <span className="restricted-badge" title="Restricted to Management / Accounts">
                                    🔒 Restricted
                                  </span>
                                ) : prod.hasCost ? (
                                  <span>{formatINR(prod.unitCost)} / unit</span>
                                ) : (
                                  <span className="cost-missing-badge" title="Cost not recorded in catalog">
                                    Cost unavailable
                                  </span>
                                )}
                              </td>

                              {/* Gross Profit */}
                              <td className="text-right">
                                {!canViewFinancials ? (
                                  <span className="restricted-badge" title="Restricted to Management / Accounts">
                                    🔒 Restricted
                                  </span>
                                ) : prod.hasCost && prod.grossProfit !== null ? (
                                  <span className={prod.grossProfit >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                                    {formatINR(prod.grossProfit)}
                                  </span>
                                ) : (
                                  <span className="na-badge">N/A</span>
                                )}
                              </td>

                              {/* Margin % */}
                              <td className="text-right">
                                {!canViewFinancials ? (
                                  <span className="restricted-badge">🔒 Restricted</span>
                                ) : prod.hasCost && prod.profitMargin !== null ? (
                                  <span className="margin-pill">{prod.profitMargin}%</span>
                                ) : (
                                  <span className="na-badge">N/A</span>
                                )}
                              </td>

                              {/* Expand Action */}
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn-expand-tx"
                                  onClick={() => toggleExpandProduct(rowKey)}
                                  title="View individual customer order transactions"
                                >
                                  {isExpanded ? '▲ Hide' : `▼ Orders (${prod.orderTransactions.length})`}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Expandable Transaction Details Overlay Rows */}
                    {filteredProductSales.map((prod, idx) => {
                      const rowKey = prod.productId || `prod_${idx}`
                      if (!expandedProductKeys.has(rowKey)) return null

                      return (
                        <div key={`tx_${rowKey}`} className="product-tx-drawer">
                          <div className="tx-drawer-header">
                            <strong>{prod.productName}</strong> — Monthly Order Transactions ({prod.orderTransactions.length})
                          </div>
                          <table className="tx-drawer-table">
                            <thead>
                              <tr>
                                <th>Order #</th>
                                <th>Date</th>
                                <th>Customer Name</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                                <th>Payment Method</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prod.orderTransactions.map((tx, txIdx) => (
                                <tr key={txIdx}>
                                  <td><strong>{tx.orderNumber}</strong></td>
                                  <td>{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                                  <td>{tx.customerName}</td>
                                  <td>{tx.quantity}</td>
                                  <td>{formatINR(tx.unitPrice)}</td>
                                  <td className="font-semibold">{formatINR(tx.lineTotal)}</td>
                                  <td>
                                    <span className="method-pill">{tx.paymentMethod?.toUpperCase() || 'CASH'}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* 5. Category-Wise Performance */}
              <section className="business-section" aria-labelledby="section-categories">
                <div className="business-section-header">
                  <h2 id="section-categories" className="business-section-title">
                    Category-Wise Revenue Distribution &amp; Share
                  </h2>
                  <span className="section-note">
                    Aggregated product performance mapped to store inventory categories
                  </span>
                </div>

                <div className="category-performance-container">
                  {/* Category Revenue Distribution Visual Bar */}
                  <div className="category-bar-wrapper">
                    <div className="category-distribution-bar">
                      {categorySales.map((c, i) => (
                        <div
                          key={c.categoryName}
                          className={`cat-bar-segment cat-color-${i % 6}`}
                          style={{ width: `${Math.max(2, c.revenueShare)}%` }}
                          title={`${c.categoryName}: ${c.revenueShare}% (${formatINR(c.revenue)})`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="business-table-wrapper">
                    <table className="business-data-table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th className="text-right">Units Sold</th>
                          <th className="text-right">Sales Revenue</th>
                          <th className="text-right">Revenue Share</th>
                          <th className="text-right">Verified Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categorySales.map((c) => (
                          <tr key={c.categoryName}>
                            <td className="font-semibold">{c.categoryName}</td>
                            <td className="text-right">{c.unitsSold}</td>
                            <td className="text-right font-medium text-primary">{formatINR(c.revenue)}</td>
                            <td className="text-right">
                              <span className="share-pill">{c.revenueShare}%</span>
                            </td>
                            <td className="text-right">
                              {!canViewFinancials ? (
                                <span className="restricted-badge">🔒 Restricted</span>
                              ) : c.hasCostData ? (
                                <span className="text-success font-semibold">{formatINR(c.verifiedProfit)}</span>
                              ) : (
                                <span className="na-badge">Cost unavailable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* 6. Dedicated Payments & Outstanding Balances */}
              <section className="business-section" aria-labelledby="section-payments">
                <div className="business-section-header">
                  <h2 id="section-payments" className="business-section-title">
                    Payments, Collections &amp; Outstanding Customer Balances
                  </h2>
                  <span className="section-note">
                    Reconciliation of cash inflows against current and previous month invoices
                  </span>
                </div>

                <div className="payment-reconciliation-grid">
                  {/* Inflow Attribution Card */}
                  <div className="reconciliation-card">
                    <h3 className="sub-section-title">Collections Attribution</h3>
                    <div className="reconciliation-row">
                      <span>Total Collections Received ({MONTH_NAMES[selectedMonth]}):</span>
                      <strong>{formatINR(paymentAnalysis.totalReceived)}</strong>
                    </div>
                    <div className="reconciliation-row indent">
                      <span>• For orders placed in {MONTH_NAMES[selectedMonth]} {selectedYear}:</span>
                      <strong className="text-success">{formatINR(paymentAnalysis.currentMonthOrdersPayment)}</strong>
                    </div>
                    <div className="reconciliation-row indent">
                      <span>• Collections for previous months&apos; orders (Recoveries):</span>
                      <strong className="text-accent">{formatINR(paymentAnalysis.previousMonthsOrdersPayment)}</strong>
                    </div>
                  </div>

                  {/* Payment Methods Breakdown Card */}
                  <div className="reconciliation-card">
                    <h3 className="sub-section-title">Payment Method Breakdown</h3>
                    <div className="method-breakdown-list">
                      {paymentAnalysis.methodBreakdown.map((m) => (
                        <div key={m.label} className="method-breakdown-item">
                          <div className="method-item-header">
                            <span className="method-name">{m.label}</span>
                            <span className="method-count">({m.count} txns)</span>
                          </div>
                          <span className="method-amt">{formatINR(m.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Outstanding Pending Balance Orders Table */}
                <div className="pending-orders-container">
                  <h3 className="sub-section-title">
                    Active Orders with Outstanding Balances ({paymentAnalysis.pendingOrders.length})
                  </h3>
                  {paymentAnalysis.pendingOrders.length === 0 ? (
                    <div className="business-empty-table">
                      <p>All active orders for this month are fully paid. No pending balances.</p>
                    </div>
                  ) : (
                    <div className="business-table-wrapper">
                      <table className="business-data-table">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>Customer Name</th>
                            <th>Contact Info</th>
                            <th>Order Date</th>
                            <th>Status</th>
                            <th className="text-right">Total Amount</th>
                            <th className="text-right">Received Amount</th>
                            <th className="text-right">Balance Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentAnalysis.pendingOrders.map((ord) => (
                            <tr key={ord.orderId}>
                              <td><strong>{ord.orderNumber}</strong></td>
                              <td>{ord.customerName}</td>
                              <td>{ord.contactInfo}</td>
                              <td>{new Date(ord.createdAt).toLocaleDateString('en-IN')}</td>
                              <td>
                                <span className={`order-status-chip status-${ord.status}`}>
                                  {ord.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="text-right">{formatINR(ord.totalAmount)}</td>
                              <td className="text-right text-success">{formatINR(ord.paidAmount)}</td>
                              <td className="text-right font-bold text-danger">{formatINR(ord.balanceDue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
