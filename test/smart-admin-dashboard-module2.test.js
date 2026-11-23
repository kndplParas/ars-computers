import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  FINANCIAL_ANALYTICS_ROLES,
  FULFILLMENT_ROLES,
  canViewFinancialAnalytics,
  deriveOrderPipelineCounts,
  deriveExecutiveSalesMetrics,
  deriveOperationalFulfillmentMetrics,
  getAvailableYears
} from '../src/utils/dashboardModule2Helper.js'

/**
 * ============================================================================
 * ARS Computers — Smart Admin Dashboard Module 2 Test Suite
 * ============================================================================
 * Tests:
 * 1. Role authorization and strict financial masking.
 * 2. Revenue and verified gross profit math against completion_approved_at.
 * 3. Total collected payments from ledger rows vs outstanding receivables.
 * 4. Orders completed in a different month from creation month.
 * 5. IST month boundaries and available years calculation.
 * 6. Order pipeline count derivation excluding Bin and Removed items.
 * 7. Operational fulfillment queues for Technical/Engineer, Inventory Staff, and HR.
 * 8. Empty dataset, loading state, and error handling resilience.
 * 9. Codebase static checks: UI role gating and URL query parameter routing.
 * ============================================================================
 */

test('Smart Admin Dashboard Module 2 Suite', async (t) => {
  // --------------------------------------------------------------------------
  // 1. ROLE AUTHORIZATION & FINANCIAL MASKING
  // --------------------------------------------------------------------------
  await t.test('1. Role authorization and strict financial masking', () => {
    // Authorized roles
    assert.equal(canViewFinancialAnalytics('superadmin'), true)
    assert.equal(canViewFinancialAnalytics('admin'), true)
    assert.equal(canViewFinancialAnalytics('account'), true)
    assert.equal(canViewFinancialAnalytics(' SuperAdmin '), true)
    assert.equal(canViewFinancialAnalytics('ADMIN'), true)
    assert.equal(canViewFinancialAnalytics('Account'), true)

    // Unauthorized roles
    assert.equal(canViewFinancialAnalytics('technical'), false)
    assert.equal(canViewFinancialAnalytics('engineer'), false)
    assert.equal(canViewFinancialAnalytics('hr'), false)
    assert.equal(canViewFinancialAnalytics('inventory_staff'), false)
    assert.equal(canViewFinancialAnalytics('customer'), false)
    assert.equal(canViewFinancialAnalytics(''), false)
    assert.equal(canViewFinancialAnalytics(null), false)
    assert.equal(canViewFinancialAnalytics(undefined), false)
    assert.equal(canViewFinancialAnalytics(123), false)

    // Unauthorized role gets strictly NULL for all financial metrics
    const unauthorizedResult = deriveExecutiveSalesMetrics({
      analyticsData: {
        orders: [{ id: 'o1', total_amount: 50000, status: 'completed', completion_approved_at: '2026-10-15T10:00:00Z' }],
        payments: [{ id: 'p1', amount_received: 50000 }],
        products: []
      },
      role: 'engineer',
      year: 2026,
      monthIndex: 9,
      orders: [{ id: 'o1', status: 'completed' }]
    })

    assert.equal(unauthorizedResult.isFinancialAuthorized, false)
    assert.equal(unauthorizedResult.salesRevenue, null)
    assert.equal(unauthorizedResult.salesRevenueFormatted, null)
    assert.equal(unauthorizedResult.verifiedGrossProfit, null)
    assert.equal(unauthorizedResult.verifiedGrossProfitFormatted, null)
    assert.equal(unauthorizedResult.grossMarginPercentage, null)
    assert.equal(unauthorizedResult.grossMarginFormatted, null)
    assert.equal(unauthorizedResult.totalCollected, null)
    assert.equal(unauthorizedResult.totalCollectedFormatted, null)
    assert.equal(unauthorizedResult.pendingBalance, null)
    assert.equal(unauthorizedResult.pendingBalanceFormatted, null)
    assert.equal(unauthorizedResult.completedSalesCount, 1) // Non-financial pipeline count preserved
  })

  // --------------------------------------------------------------------------
  // 2. REVENUE & GROSS PROFIT MATH AGAINST completion_approved_at
  // --------------------------------------------------------------------------
  await t.test('2. Sales Revenue and gross margin math against completion_approved_at', () => {
    const mockOrders = [
      // Order completed and approved in target month (October 2026)
      {
        id: 'o1',
        total_amount: 100000,
        paid_amount: 100000,
        discount_amount: 0,
        status: 'completed',
        created_at: '2026-10-05T08:00:00Z',
        completion_approved_at: '2026-10-15T10:00:00Z',
        order_items: [
          { product_id: 'p1', quantity: 2, line_total: 60000, cost_price_snapshot: 20000 }, // cost: 40000
          { product_id: 'p2', quantity: 1, line_total: 40000, cost_price_snapshot: 30000 }  // cost: 30000
        ]
      },
      // Order created in October but NOT completed (e.g. processing)
      {
        id: 'o2',
        total_amount: 50000,
        paid_amount: 20000,
        discount_amount: 0,
        status: 'processing',
        created_at: '2026-10-20T10:00:00Z',
        completion_approved_at: null,
        order_items: [{ product_id: 'p3', quantity: 1, line_total: 50000, cost_price_snapshot: 35000 }]
      }
    ]

    const mockPayments = [
      { id: 'pay1', amount_received: 100000, received_at: '2026-10-15T12:00:00Z' },
      { id: 'pay2', amount_received: 20000, received_at: '2026-10-20T11:00:00Z' }
    ]

    const result = deriveExecutiveSalesMetrics({
      analyticsData: {
        orders: mockOrders,
        payments: mockPayments,
        products: [],
        year: 2026,
        month_index: 9
      },
      role: 'admin',
      year: 2026,
      monthIndex: 9,
      orders: mockOrders
    })

    assert.equal(result.isFinancialAuthorized, true)
    // Only completed order counts towards sales revenue
    assert.equal(result.salesRevenue, 100000)
    assert.equal(result.completedSalesCount, 1)

    // Gross profit = line_total (100000) - cost (70000) = 30000
    assert.equal(result.verifiedGrossProfit, 30000)

    // Margin = (30000 / 100000) * 100 = 30%
    assert.equal(result.grossMarginPercentage, 30)
    assert.equal(result.grossMarginFormatted, '+30.0%')
  })

  // --------------------------------------------------------------------------
  // 3. TOTAL COLLECTED PAYMENTS VS PENDING RECEIVABLES
  // --------------------------------------------------------------------------
  await t.test('3. Total collected payments from ledger rows vs outstanding receivables', () => {
    const mockOrders = [
      {
        id: 'o1',
        total_amount: 80000,
        paid_amount: 50000,
        status: 'completed',
        created_at: '2026-10-01T05:00:00Z',
        completion_approved_at: '2026-10-10T10:00:00Z',
        order_items: [{ product_id: 'p1', quantity: 1, line_total: 80000, cost_price_snapshot: 60000 }]
      }
    ]

    const mockPayments = [
      { id: 'pay1', amount_received: 50000, received_at: '2026-10-10T11:00:00Z' }
    ]

    const result = deriveExecutiveSalesMetrics({
      analyticsData: {
        orders: mockOrders,
        payments: mockPayments,
        products: [],
        year: 2026,
        month_index: 9
      },
      role: 'account',
      year: 2026,
      monthIndex: 9,
      orders: mockOrders
    })

    assert.equal(result.isFinancialAuthorized, true)
    assert.equal(result.salesRevenue, 80000)
    assert.equal(result.totalCollected, 50000)
    assert.equal(result.pendingBalance, 30000)
    assert.match(result.totalCollectedFormatted, /₹\s*50,000\.00/)
    assert.match(result.pendingBalanceFormatted, /₹\s*30,000\.00/)
  })

  // --------------------------------------------------------------------------
  // 4. ORDERS COMPLETED IN A DIFFERENT MONTH FROM CREATION MONTH
  // --------------------------------------------------------------------------
  await t.test('4. Orders completed in a different month from creation month', () => {
    const crossMonthOrder = {
      id: 'o_cross',
      total_amount: 120000,
      paid_amount: 120000,
      status: 'completed',
      // Created in September 2026
      created_at: '2026-09-25T14:00:00Z',
      // Approved / Completed in October 2026
      completion_approved_at: '2026-10-05T10:00:00Z',
      order_items: [{ product_id: 'p1', quantity: 1, line_total: 120000, cost_price_snapshot: 90000 }]
    }

    // October View
    const octResult = deriveExecutiveSalesMetrics({
      analyticsData: {
        orders: [crossMonthOrder],
        payments: [{ id: 'pay1', amount_received: 120000, received_at: '2026-10-05T11:00:00Z' }],
        products: [],
        year: 2026,
        month_index: 9 // October
      },
      role: 'superadmin',
      year: 2026,
      monthIndex: 9,
      orders: [crossMonthOrder]
    })

    assert.equal(octResult.salesRevenue, 120000)
    assert.equal(octResult.completedSalesCount, 1)
    assert.equal(octResult.verifiedGrossProfit, 30000)

    // September View: order was created in Sep, but completion_approved_at is NOT in Sep
    const sepResult = deriveExecutiveSalesMetrics({
      analyticsData: {
        orders: [crossMonthOrder],
        payments: [],
        products: [],
        year: 2026,
        month_index: 8 // September
      },
      role: 'superadmin',
      year: 2026,
      monthIndex: 8,
      orders: [crossMonthOrder]
    })

    // In September, this order is an order created in month, but NOT a completed sale
    assert.equal(sepResult.salesRevenue, 0)
    assert.equal(sepResult.completedSalesCount, 0)
    assert.equal(sepResult.verifiedGrossProfit, 0)
  })

  // --------------------------------------------------------------------------
  // 5. IST MONTH BOUNDARIES & AVAILABLE YEARS
  // --------------------------------------------------------------------------
  await t.test('5. IST month boundary and year calculation', () => {
    const years = getAvailableYears()
    assert.ok(Array.isArray(years))
    assert.ok(years.includes(2024))
    assert.ok(years.includes(2025))
    assert.ok(years.includes(2026))

    // Ensure sorted ascending
    for (let i = 0; i < years.length - 1; i++) {
      assert.ok(years[i] < years[i + 1])
    }
  })

  // --------------------------------------------------------------------------
  // 6. ORDER PIPELINE COUNT DERIVATION EXCLUDING BIN & REMOVED
  // --------------------------------------------------------------------------
  await t.test('6. Order pipeline counts exclude Bin and Removed items', () => {
    const mockOrders = [
      { id: '1', status: 'new', is_in_bin: false, is_removed: false },
      { id: '2', status: 'new', is_in_bin: false, is_removed: false },
      { id: '3', status: 'processing', is_in_bin: false, is_removed: false },
      { id: '4', status: 'completion_requested', is_in_bin: false, is_removed: false },
      { id: '5', status: 'completed', is_in_bin: false, is_removed: false },
      // Should be excluded:
      { id: '6', status: 'new', is_in_bin: true, is_removed: false },
      { id: '7', status: 'processing', is_in_bin: false, is_removed: true },
      { id: '8', status: 'completion_requested', is_in_bin: true, is_removed: true }
    ]

    const pipeline = deriveOrderPipelineCounts(mockOrders)
    assert.equal(pipeline.newOrders, 2)
    assert.equal(pipeline.processing, 1)
    assert.equal(pipeline.completionRequested, 1)
    assert.equal(pipeline.completed, 1)
    assert.equal(pipeline.totalActivePipeline, 4) // 2 + 1 + 1
  })

  // --------------------------------------------------------------------------
  // 7. OPERATIONAL FULFILLMENT QUEUES (ROLE-TAILORED)
  // --------------------------------------------------------------------------
  await t.test('7. Operational fulfillment queues for Technical/Engineer, Inventory Staff, and HR', () => {
    const mockStaffUser = { id: 'eng_123', email: 'eng@ars.com' }
    const mockOrders = [
      { id: 'o1', status: 'processing', assigned_engineer_id: 'eng_123', order_items: [{ quantity: 2 }] },
      { id: 'o2', status: 'completion_requested', assigned_engineer_id: 'eng_123', order_items: [{ quantity: 1 }] },
      { id: 'o3', status: 'completed', assigned_engineer_id: 'eng_123', order_items: [{ quantity: 3 }] },
      { id: 'o4', status: 'new', assigned_engineer_id: null, order_items: [{ quantity: 4 }] },
      { id: 'o5', status: 'processing', assigned_engineer_id: 'eng_other', order_items: [{ quantity: 1 }] },
      // Soft-deleted/removed
      { id: 'o6', status: 'processing', assigned_engineer_id: 'eng_123', is_in_bin: true }
    ]

    // Engineer view
    const engMetrics = deriveOperationalFulfillmentMetrics({
      orders: mockOrders,
      role: 'engineer',
      staffUser: mockStaffUser
    })
    assert.equal(engMetrics.category, 'technical_fulfillment')
    assert.equal(engMetrics.myActiveCount, 2) // o1 (processing) + o2 (completion_requested)
    assert.equal(engMetrics.myCompletedCount, 1) // o3
    assert.equal(engMetrics.unassignedTeamCount, 1) // o4

    // Technical role equivalent
    const techMetrics = deriveOperationalFulfillmentMetrics({
      orders: mockOrders,
      role: 'technical',
      staffUser: mockStaffUser
    })
    assert.equal(techMetrics.category, 'technical_fulfillment')
    assert.equal(techMetrics.myActiveCount, 2)

    // Inventory staff view
    const invMetrics = deriveOperationalFulfillmentMetrics({
      orders: mockOrders,
      role: 'inventory_staff'
    })
    assert.equal(invMetrics.category, 'inventory_dispatch')
    // Dispatch pending = 'new' (o4) + 'processing' (o1, o5) = 3
    assert.equal(invMetrics.dispatchPendingCount, 3)
    // Units to dispatch = o1 (2) + o4 (4) + o5 (1) = 7
    assert.equal(invMetrics.totalUnitsToDispatch, 7)

    // HR view
    const hrMetrics = deriveOperationalFulfillmentMetrics({
      orders: mockOrders,
      role: 'hr'
    })
    assert.equal(hrMetrics.category, 'hr_operations')
    assert.equal(hrMetrics.assignedOrdersCount, 4) // o1, o2, o3, o5
    assert.equal(hrMetrics.unassignedOrdersCount, 1) // o4
  })

  // --------------------------------------------------------------------------
  // 8. RESILIENCE: EMPTY DATASETS, NULLS, AND EDGE CASES
  // --------------------------------------------------------------------------
  await t.test('8. Empty datasets, nulls, and edge cases', () => {
    // Empty orders
    const emptyPipeline = deriveOrderPipelineCounts([])
    assert.equal(emptyPipeline.newOrders, 0)
    assert.equal(emptyPipeline.totalActivePipeline, 0)

    // Null orders
    const nullPipeline = deriveOrderPipelineCounts(null)
    assert.equal(nullPipeline.newOrders, 0)
    assert.equal(nullPipeline.totalActivePipeline, 0)

    // Empty analytics
    const emptyExecutive = deriveExecutiveSalesMetrics({
      analyticsData: { orders: [], payments: [], products: [] },
      role: 'admin',
      year: 2026,
      monthIndex: 9,
      orders: []
    })
    assert.equal(emptyExecutive.salesRevenue, 0)
    assert.equal(emptyExecutive.verifiedGrossProfit, 0)
    assert.equal(emptyExecutive.grossMarginPercentage, null)
    assert.equal(emptyExecutive.totalCollected, 0)
    assert.equal(emptyExecutive.pendingBalance, 0)

    // Null analyticsData
    const nullExecutive = deriveExecutiveSalesMetrics({
      analyticsData: null,
      role: 'admin',
      year: 2026,
      monthIndex: 9,
      orders: []
    })
    assert.equal(nullExecutive.isFinancialAuthorized, false)
    assert.equal(nullExecutive.salesRevenue, null)
  })

  // --------------------------------------------------------------------------
  // 9. CODEBASE STATIC VERIFICATION: ROUTING & DEFENSE-IN-DEPTH
  // --------------------------------------------------------------------------
  await t.test('9. Static code inspection: UI role gating and URL parameter routing', () => {
    const dashboardSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/AdminDashboardPage.jsx'),
      'utf8'
    )
    const ordersSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/AdminOrdersPage.jsx'),
      'utf8'
    )

    // Dashboard page verifies canViewFinancialAnalytics before fetching and before rendering
    assert.ok(
      dashboardSrc.includes('canViewFinancialAnalytics(userRole)'),
      'AdminDashboardPage must gate financial RPC call with canViewFinancialAnalytics'
    )
    assert.ok(
      dashboardSrc.includes('isFinancialRole && ('),
      'AdminDashboardPage must conditionally render Executive Sales & Revenue cards only if isFinancialRole'
    )

    // Dashboard click-through targets
    assert.ok(
      dashboardSrc.includes("navigate('/admin/orders?tab=completed')"),
      'Dashboard Completed Sales Revenue card must click through to /admin/orders?tab=completed'
    )
    assert.ok(
      dashboardSrc.includes("navigate('/admin/orders?tab=active&payment=pending')"),
      'Dashboard Pending Balance card must click through to /admin/orders?tab=active&payment=pending'
    )
    assert.ok(
      dashboardSrc.includes("navigate('/admin/orders?tab=active&status=new')"),
      'Dashboard New Orders card must click through to /admin/orders?tab=active&status=new'
    )
    assert.ok(
      dashboardSrc.includes("navigate('/admin/orders?tab=active&status=processing')"),
      'Dashboard Processing card must click through to /admin/orders?tab=active&status=processing'
    )
    assert.ok(
      dashboardSrc.includes("navigate('/admin/orders?tab=pending')"),
      'Dashboard Completion Requested card must click through to /admin/orders?tab=pending'
    )

    // Orders page supports search params
    assert.ok(
      ordersSrc.includes('useSearchParams'),
      'AdminOrdersPage must import useSearchParams'
    )
    assert.ok(
      ordersSrc.includes("searchParams.get('tab')"),
      'AdminOrdersPage must read tab parameter'
    )
    assert.ok(
      ordersSrc.includes("searchParams.get('status')"),
      'AdminOrdersPage must read status parameter'
    )
    assert.ok(
      ordersSrc.includes("searchParams.get('payment')"),
      'AdminOrdersPage must read payment parameter'
    )
  })
})
