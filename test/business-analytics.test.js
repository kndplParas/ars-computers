import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  MONTH_NAMES,
  SHORT_MONTH_NAMES,
  formatINR,
  formatPercentage,
  getMonthDateRange,
  computeMonthlySummary,
  computeProductWisePerformance,
  computeCategoryPerformance,
  computeDailyTrend,
  computePaymentAnalysis,
  computeBusinessInsights
} from '../src/utils/businessAnalyticsHelper.js'

/**
 * ============================================================================
 * ARS Computers — Business Monthly Analytics Test Suite
 * ============================================================================
 * Validates calculation integrity, zero-division guards, missing cost handling,
 * role-based financial masking, and UI accessibility.
 * ============================================================================
 */

test('Business Monthly Analytics Suite', async (t) => {
  // --------------------------------------------------------------------------
  // 1. DATE BOUNDARIES & FORMATTERS
  // --------------------------------------------------------------------------
  await t.test('1. Date boundaries and INR / percentage formatters', () => {
    assert.equal(MONTH_NAMES.length, 12)
    assert.equal(SHORT_MONTH_NAMES.length, 12)

    // Month date range check for October 2026 (month index 9)
    const rangeOct = getMonthDateRange(2026, 9)
    assert.equal(rangeOct.startDate.getFullYear(), 2026)
    assert.equal(rangeOct.startDate.getMonth(), 9)
    assert.equal(rangeOct.startDate.getDate(), 1)
    assert.equal(rangeOct.endDate.getDate(), 31)
    assert.equal(rangeOct.daysInMonth, 31)

    // Month date range check for February in leap year vs non-leap year
    const rangeFeb2024 = getMonthDateRange(2024, 1)
    assert.equal(rangeFeb2024.daysInMonth, 29)
    const rangeFeb2025 = getMonthDateRange(2025, 1)
    assert.equal(rangeFeb2025.daysInMonth, 28)

    // Formatter tests
    assert.equal(formatINR(0), '₹0.00')
    assert.equal(formatINR(null), '₹0.00')
    assert.equal(formatINR(undefined), '₹0.00')
    assert.match(formatINR(1500), /₹\s*1,500\.00/)

    assert.equal(formatPercentage(null), 'N/A')
    assert.equal(formatPercentage(15.42), '+15.4%')
    assert.equal(formatPercentage(-8.2), '-8.2%')
    assert.equal(formatPercentage(0), '0.0%')
  })

  // --------------------------------------------------------------------------
  // 2. EXECUTIVE MONTHLY SUMMARY & REVENUE / CASH / PROFIT SEPARATION
  // --------------------------------------------------------------------------
  await t.test('2. Executive Summary strictly distinguishes Revenue vs Cash vs Profit', () => {
    const mockOrdersInMonth = [
      {
        id: 'o1',
        total_amount: 50000,
        paid_amount: 30000,
        discount_amount: 1000,
        status: 'completed',
        completion_approved_at: '2026-10-15T10:00:00Z',
        order_items: [{ product_id: 'p1', quantity: 2, line_total: 50000, cost_price_snapshot: 20000 }]
      },
      {
        id: 'o2',
        total_amount: 25000,
        paid_amount: 0,
        discount_amount: 500,
        status: 'confirmed',
        completion_approved_at: null,
        order_items: [{ product_id: 'p2', quantity: 1, line_total: 25000 }]
      },
      {
        id: 'o3',
        total_amount: 10000,
        paid_amount: 0,
        discount_amount: 0,
        status: 'cancelled',
        completion_approved_at: null,
        order_items: []
      }
    ]

    const completedSales = [mockOrdersInMonth[0]]

    const mockPayments = [
      { id: 'pay1', amount_received: 30000, payment_method: 'upi', received_at: '2026-10-15T12:00:00Z' },
      { id: 'pay2', amount_received: 15000, payment_method: 'cash', received_at: '2026-10-20T14:00:00Z' }
    ]

    const mockProductsWithCost = [
      { id: 'p1', cost_price: 20000 } // unit cost = 20000, qty = 2 -> total cost = 40000
    ]

    const summary = computeMonthlySummary({
      ordersInMonth: mockOrdersInMonth,
      completedSales,
      paymentsInMonth: mockPayments,
      products: mockProductsWithCost
    })

    // 1. Sales revenue is solely from completed sales (50,000)
    assert.equal(summary.salesRevenue, 50000)
    assert.equal(summary.completedSalesCount, 1)

    // 2. Total orders placed in month = 3
    assert.equal(summary.totalOrdersCount, 3)

    // 3. Amount collected in payment ledger = 45,000 (30,000 + 15,000)
    assert.equal(summary.totalCollected, 45000)

    // 4. Units sold = 2
    assert.equal(summary.unitsSold, 2)

    // 5. Outstanding pending balance = (50000 - 30000) + (25000 - 0) = 45,000 (cancelled o3 excluded)
    assert.equal(summary.pendingBalance, 45000)

    // 6. Discounts given = 1000 + 500 = 1500
    assert.equal(summary.discountsGiven, 1500)

    // 7. Cancelled orders count = 1, amount = 10000
    assert.equal(summary.cancelledOrdersCount, 1)
    assert.equal(summary.cancelledAmount, 10000)

    // 8. Average Order Value = 50,000 / 1 = 50,000
    assert.equal(summary.averageOrderValue, 50000)

    // 9. Actual Gross Profit = 50,000 - (20,000 * 2) = 10,000
    assert.equal(summary.verifiedGrossProfit, 10000)
    assert.equal(summary.hasCompleteCostData, true)

    // 10. Net profit status
    assert.equal(summary.netProfitStatus, 'Expense data unavailable')
  })

  // --------------------------------------------------------------------------
  // 3. MISSING COST PRICE INTEGRITY (SECTION 6 STRICT RULES)
  // --------------------------------------------------------------------------
  await t.test('3. Missing purchase cost is NEVER invented or approximated', () => {
    const completedSales = [
      {
        id: 'o_no_cost',
        total_amount: 80000,
        order_items: [
          { product_id: 'p_null', quantity: 2, line_total: 80000, product_name_snapshot: 'Custom Server', cost_price_snapshot: null }
        ]
      }
    ]

    // Even if catalog now has cost_price, historical order with NULL snapshot never silently substitutes it
    const products = [
      { id: 'p_null', name: 'Custom Server', cost_price: 35000, price: 40000 }
    ]

    const summary = computeMonthlySummary({
      ordersInMonth: completedSales,
      completedSales,
      paymentsInMonth: [],
      products
    })

    assert.equal(summary.hasCompleteCostData, false)
    assert.equal(summary.soldItemsMissingCostCount, 1)
    assert.equal(summary.verifiedGrossProfit, 0)

    // Product-wise table computation
    const productResults = computeProductWisePerformance({
      completedSales,
      products,
      categories: []
    })

    assert.equal(productResults.length, 1)
    const prod = productResults[0]
    assert.equal(prod.hasCost, false)
    assert.equal(prod.unitCost, null)
    assert.equal(prod.grossProfit, null)
    assert.equal(prod.profitMargin, null)
    assert.equal(prod.netSales, 80000)

    // Top business insights reflects cost warning
    const insights = computeBusinessInsights({
      summary,
      productSales: productResults,
      categorySales: [],
      paymentAnalysis: { pendingOrders: [] },
      prevData: { completedSales: [] },
      monthIndex: 9,
      year: 2026
    })

    const costWarning = insights.find((i) => i.type === 'cost-warning')
    assert.ok(costWarning, 'Must produce a Catalog Purchase Cost Notice')
    assert.match(costWarning.description, /Product purchase costs are not recorded/i)
  })

  // --------------------------------------------------------------------------
  // 4. CATEGORY PERFORMANCE & REVENUE SHARE
  // --------------------------------------------------------------------------
  await t.test('4. Category performance aggregates revenue and calculates exact share %', () => {
    const productSales = [
      { category: 'CCTV & Security', quantitySold: 5, netSales: 50000, hasCost: false, grossProfit: null },
      { category: 'CCTV & Security', quantitySold: 3, netSales: 30000, hasCost: false, grossProfit: null },
      { category: 'Laptops & Computers', quantitySold: 2, netSales: 120000, hasCost: false, grossProfit: null }
    ]

    const categories = computeCategoryPerformance(productSales, 200000)

    assert.equal(categories.length, 2)
    // Sorted by revenue descending
    assert.equal(categories[0].categoryName, 'Laptops & Computers')
    assert.equal(categories[0].revenue, 120000)
    assert.equal(categories[0].revenueShare, 60.0)
    assert.equal(categories[0].unitsSold, 2)

    assert.equal(categories[1].categoryName, 'CCTV & Security')
    assert.equal(categories[1].revenue, 80000)
    assert.equal(categories[1].revenueShare, 40.0)
    assert.equal(categories[1].unitsSold, 8)
  })

  // --------------------------------------------------------------------------
  // 5. DAILY TREND DISTRIBUTION
  // --------------------------------------------------------------------------
  await t.test('5. Daily trend distribution correctly maps by day number', () => {
    const completedSales = [
      { completion_approved_at: '2026-10-05T10:00:00Z', total_amount: 15000 },
      { completion_approved_at: '2026-10-05T15:00:00Z', total_amount: 25000 },
      { completion_approved_at: '2026-10-18T12:00:00Z', total_amount: 40000 }
    ]

    const payments = [
      { received_at: '2026-10-05T11:00:00Z', amount_received: 10000 },
      { received_at: '2026-10-25T09:00:00Z', amount_received: 35000 }
    ]

    const trend = computeDailyTrend(completedSales, payments, 31)

    assert.equal(trend.length, 31)

    const day5 = trend.find((d) => d.day === 5)
    assert.equal(day5.completedSalesCount, 2)
    assert.equal(day5.revenue, 40000)
    assert.equal(day5.collected, 10000)

    const day18 = trend.find((d) => d.day === 18)
    assert.equal(day18.completedSalesCount, 1)
    assert.equal(day18.revenue, 40000)
    assert.equal(day18.collected, 0)

    const day25 = trend.find((d) => d.day === 25)
    assert.equal(day25.completedSalesCount, 0)
    assert.equal(day25.revenue, 0)
    assert.equal(day25.collected, 35000)
  })

  // --------------------------------------------------------------------------
  // 6. PAYMENT ANALYSIS & HISTORICAL COLLECTIONS ATTRIBUTION
  // --------------------------------------------------------------------------
  await t.test('6. Payment analysis distinguishes current vs previous month collections', () => {
    const targetRange = getMonthDateRange(2026, 10) // November 2026

    const paymentsInMonth = [
      {
        id: 'p1',
        amount_received: 50000,
        payment_method: 'upi',
        orders: { created_at: '2026-11-02T10:00:00Z' } // Current month order
      },
      {
        id: 'p2',
        amount_received: 20000,
        payment_method: 'cash',
        orders: { created_at: '2026-10-15T10:00:00Z' } // Previous month order (Recovery)
      }
    ]

    const ordersInMonth = [
      {
        id: 'o_nov',
        order_number: 'ORD-202611-001',
        customer_name: 'Amit Sharma',
        contact_info: '9876543210',
        created_at: '2026-11-02T10:00:00Z',
        status: 'confirmed',
        payment_status: 'partial',
        total_amount: 100000,
        paid_amount: 50000
      }
    ]

    const result = computePaymentAnalysis(paymentsInMonth, ordersInMonth, targetRange)

    assert.equal(result.totalReceived, 70000)
    assert.equal(result.currentMonthOrdersPayment, 50000)
    assert.equal(result.previousMonthsOrdersPayment, 20000)

    assert.equal(result.pendingOrders.length, 1)
    assert.equal(result.pendingOrders[0].orderNumber, 'ORD-202611-001')
    assert.equal(result.pendingOrders[0].balanceDue, 50000)
  })

  // --------------------------------------------------------------------------
  // 7. ROLE GATING & DEFENSE-IN-DEPTH CHECKS
  // --------------------------------------------------------------------------
  await t.test('7. AdminLayout and BusinessAnalyticsOverlay enforce strict role defense-in-depth', () => {
    const layoutPath = path.resolve('src/components/admin/AdminLayout.jsx')
    const layoutCode = fs.readFileSync(layoutPath, 'utf8')

    // 1. Business button removed from main layout navbar, placed strictly inside Orders & Sales
    assert.doesNotMatch(
      layoutCode,
      /admin-business-btn/,
      'Business button must NOT be present in AdminLayout topbar'
    )
    assert.doesNotMatch(
      layoutCode,
      /allNavItems[\s\S]*?'business'/,
      'Business must NOT be added to sidebar allNavItems'
    )

    const ordersPath = path.resolve('src/pages/admin/AdminOrdersPage.jsx')
    const ordersCode = fs.readFileSync(ordersPath, 'utf8')
    assert.match(
      ordersCode,
      /\['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account'\]\.includes\(adminUser\?\.role\)/,
      'AdminOrdersPage must display Business button for the 6 authorized roles'
    )

    // 2. BusinessAnalyticsOverlay component code check
    const overlayPath = path.resolve('src/components/admin/BusinessAnalyticsOverlay.jsx')
    const overlayCode = fs.readFileSync(overlayPath, 'utf8')

    // Mask confidential columns
    assert.match(
      overlayCode,
      /const canViewFinancials = \['superadmin', 'admin', 'account'\]\.includes\(role\)/,
      'canViewFinancials must be restricted to superadmin, admin, and account'
    )
    assert.match(
      overlayCode,
      /🔒 Restricted/,
      'Financial columns must render restricted lock badge for operational roles'
    )

    // Escape key listener present
    assert.match(overlayCode, /e\.key === 'Escape'/)

    // 10 summary KPI cards present
    assert.match(overlayCode, /Total Sales Revenue/)
    assert.match(overlayCode, /Actual Gross Profit/)
    assert.match(overlayCode, /Total Orders Placed/)
    assert.match(overlayCode, /Completed Sales/)
    assert.match(overlayCode, /Total Units Sold/)
    assert.match(overlayCode, /Total Amount Collected/)
    assert.match(overlayCode, /Pending Payment Balance/)
    assert.match(overlayCode, /Discounts Given/)
    assert.match(overlayCode, /Cancelled Orders/)
    assert.match(overlayCode, /Average Order Value/)
  })
})

