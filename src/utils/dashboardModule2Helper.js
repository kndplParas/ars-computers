/**
 * ============================================================================
 * ARS Computers — Smart Admin Dashboard Module 2 Helper
 * ============================================================================
 * Sales, Revenue & Order Pipeline Performance Analytics Engine.
 *
 * Core Principles:
 * 1. Strict Role-Based Financial Masking:
 *    - Only 'superadmin', 'admin', and 'account' may receive financial figures
 *      (Revenue, Gross Profit, Gross Margin, Amount Collected, Receivables).
 *    - For 'technical', 'engineer', 'hr', and 'inventory_staff', all financial
 *      attributes are strictly NULL / undefined in returned objects.
 * 2. Revenue Accounting:
 *    - Sales Revenue is derived strictly from completed orders approved in the
 *      target operating month (status = 'completed' AND completion_approved_at in month).
 * 3. Verified Gross Profit:
 *    - Based exclusively on cost_price_snapshot on order items.
 * 4. Order Pipeline Funnel:
 *    - New, Processing, Completion Requested, Completed counts derived cleanly
 *      excluding Bin and Removed items.
 * ============================================================================
 */

import {
  formatINR,
  formatPercentage,
  getMonthDateRange,
  computeMonthlySummary,
  MONTH_NAMES
} from './businessAnalyticsHelper.js'
import { getISTCalendarDate } from './enquiryClassification.js'

export const FINANCIAL_ANALYTICS_ROLES = ['superadmin', 'admin', 'account']
export const FULFILLMENT_ROLES = ['superadmin', 'admin', 'account', 'technical', 'engineer', 'hr', 'inventory_staff']

/**
 * Checks whether the given staff role is authorized to view financial analytics.
 */
export function canViewFinancialAnalytics(role) {
  if (!role || typeof role !== 'string') return false
  return FINANCIAL_ANALYTICS_ROLES.includes(role.toLowerCase().trim())
}

/**
 * Derives the active order pipeline counts from the current orders dataset.
 * Excludes soft-deleted Bin items and Head-removed orders.
 */
export function deriveOrderPipelineCounts(orders = []) {
  if (!Array.isArray(orders)) {
    return {
      newOrders: 0,
      processing: 0,
      completionRequested: 0,
      completed: 0,
      totalActivePipeline: 0
    }
  }

  const validOrders = orders.filter((o) => o && !o.is_in_bin && !o.is_removed)

  let newOrders = 0
  let processing = 0
  let completionRequested = 0
  let completed = 0

  for (const o of validOrders) {
    if (o.status === 'new') {
      newOrders++
    } else if (o.status === 'processing') {
      processing++
    } else if (o.status === 'completion_requested') {
      completionRequested++
    } else if (o.status === 'completed') {
      completed++
    }
  }

  return {
    newOrders,
    processing,
    completionRequested,
    completed,
    totalActivePipeline: newOrders + processing + completionRequested
  }
}

/**
 * Derives Executive Sales & Financial Metrics for a specific month.
 * Strictly checks caller role — unauthorized roles receive null financials.
 */
export function deriveExecutiveSalesMetrics({
  analyticsData = null,
  role = 'inventory_staff',
  year = null,
  monthIndex = null,
  orders = []
}) {
  const isAuthorized = canViewFinancialAnalytics(role)
  const pipeline = deriveOrderPipelineCounts(orders)

  // Non-financial roles: return fulfillment metrics only, financials strictly null
  if (!isAuthorized || !analyticsData) {
    return {
      isFinancialAuthorized: false,
      year: year ?? new Date().getFullYear(),
      monthIndex: monthIndex ?? new Date().getMonth(),
      monthName: MONTH_NAMES[monthIndex ?? new Date().getMonth()] || '',
      salesRevenue: null,
      salesRevenueFormatted: null,
      completedSalesCount: pipeline.completed,
      verifiedGrossProfit: null,
      verifiedGrossProfitFormatted: null,
      grossMarginPercentage: null,
      grossMarginFormatted: null,
      totalCollected: null,
      totalCollectedFormatted: null,
      pendingBalance: null,
      pendingBalanceFormatted: null,
      pipeline
    }
  }

  // Authorized Management & Accounts
  const rawOrders = analyticsData.orders || []
  const paymentsInMonth = analyticsData.payments || []
  const products = analyticsData.products || []

  const targetRange = getMonthDateRange(
    analyticsData.year ?? year ?? new Date().getFullYear(),
    analyticsData.month_index ?? monthIndex ?? new Date().getMonth()
  )

  // Orders created in target month
  const ordersInMonth = rawOrders.filter((o) => {
    if (!o.created_at) return false
    const d = new Date(o.created_at)
    return d >= targetRange.startDate && d <= targetRange.endDate
  })

  // Sales completed and approved in target month
  const completedSales = rawOrders.filter((o) => {
    if (o.status !== 'completed' || !o.completion_approved_at) return false
    const d = new Date(o.completion_approved_at)
    return d >= targetRange.startDate && d <= targetRange.endDate
  })

  const summary = computeMonthlySummary({
    ordersInMonth,
    completedSales,
    paymentsInMonth,
    products
  })

  const marginPct = summary.salesRevenue > 0
    ? (summary.verifiedGrossProfit / summary.salesRevenue) * 100
    : null

  return {
    isFinancialAuthorized: true,
    year: targetRange.startDate.getFullYear(),
    monthIndex: targetRange.startDate.getMonth(),
    monthName: MONTH_NAMES[targetRange.startDate.getMonth()] || '',
    salesRevenue: summary.salesRevenue,
    salesRevenueFormatted: formatINR(summary.salesRevenue),
    completedSalesCount: summary.completedSalesCount,
    verifiedGrossProfit: summary.verifiedGrossProfit,
    verifiedGrossProfitFormatted: formatINR(summary.verifiedGrossProfit),
    grossMarginPercentage: marginPct,
    grossMarginFormatted: formatPercentage(marginPct),
    totalCollected: summary.totalCollected,
    totalCollectedFormatted: formatINR(summary.totalCollected),
    pendingBalance: summary.pendingBalance,
    pendingBalanceFormatted: formatINR(summary.pendingBalance),
    hasCompleteCostData: summary.hasCompleteCostData,
    hasPartialCostData: summary.hasPartialCostData,
    pipeline
  }
}

/**
 * Derives operational fulfillment metrics tailored to technical/engineer, HR,
 * and inventory staff roles (zero financial leakage).
 */
export function deriveOperationalFulfillmentMetrics({
  orders = [],
  role = 'inventory_staff',
  staffUser = null
}) {
  const normRole = (role || 'inventory_staff').toLowerCase().trim()
  const validOrders = orders.filter((o) => o && !o.is_in_bin && !o.is_removed)

  if (normRole === 'engineer' || normRole === 'technical') {
    const myId = staffUser?.id
    const myAssignedOrders = validOrders.filter((o) => o.assigned_engineer_id === myId)
    const myActiveOrders = myAssignedOrders.filter((o) => ['new', 'processing', 'completion_requested'].includes(o.status))
    const myCompletedOrders = myAssignedOrders.filter((o) => o.status === 'completed')

    // Team unassigned orders ready for pickup
    const unassignedOrders = validOrders.filter((o) => !o.assigned_engineer_id && ['new', 'processing'].includes(o.status))

    return {
      category: 'technical_fulfillment',
      myActiveCount: myActiveOrders.length,
      myCompletedCount: myCompletedOrders.length,
      unassignedTeamCount: unassignedOrders.length,
      totalTrackedOrders: validOrders.length
    }
  }

  if (normRole === 'inventory_staff') {
    // Orders in 'new' or 'processing' requiring packing/dispatch
    const dispatchPending = validOrders.filter((o) => ['new', 'processing'].includes(o.status))
    const totalUnitsToDispatch = dispatchPending.reduce((acc, o) => {
      const items = Array.isArray(o.order_items) ? o.order_items : []
      return acc + items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
    }, 0)

    return {
      category: 'inventory_dispatch',
      dispatchPendingCount: dispatchPending.length,
      totalUnitsToDispatch,
      totalTrackedOrders: validOrders.length
    }
  }

  if (normRole === 'hr') {
    const assignedOrdersCount = validOrders.filter((o) => o.assigned_engineer_id).length
    const unassignedOrdersCount = validOrders.filter((o) => !o.assigned_engineer_id && ['new', 'processing'].includes(o.status)).length

    return {
      category: 'hr_operations',
      assignedOrdersCount,
      unassignedOrdersCount,
      totalTrackedOrders: validOrders.length
    }
  }

  return {
    category: 'general_operations',
    totalTrackedOrders: validOrders.length
  }
}

/**
 * Returns the year and zero-based monthIndex for a given date in IST (Asia/Kolkata).
 */
export function getISTOperatingMonth(dateInput = new Date()) {
  const istStr = getISTCalendarDate(dateInput)
  if (istStr && typeof istStr === 'string' && istStr.includes('-')) {
    const [yearStr, monthStr] = istStr.split('-')
    return {
      year: parseInt(yearStr, 10),
      monthIndex: parseInt(monthStr, 10) - 1
    }
  }
  const now = new Date()
  return {
    year: now.getFullYear(),
    monthIndex: now.getMonth()
  }
}

/**
 * Returns available year options for the month selector.
 * Established IST timeline starting from 2024 up to current year + 1.
 */
export function getAvailableYears() {
  const { year: currentYear } = getISTOperatingMonth(new Date())
  const years = []
  for (let y = 2024; y <= currentYear + 1; y++) {
    years.push(y)
  }
  return years
}
