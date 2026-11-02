/**
 * ============================================================================
 * ARS Computers — Business Monthly Analytics & Performance Helper
 * ============================================================================
 * Accurate, audit-grade business calculation engine for monthly sales, revenue,
 * payments, product-wise gross profit, and category performance.
 *
 * Core Rules:
 * 1. Sales Revenue is derived strictly from completed, Head-approved orders
 *    (status = 'completed' AND completion_approved_at in target month).
 * 2. Amount Collected is derived strictly from payment ledger records
 *    (order_payments with received_at in target month), distinguishing
 *    current-month orders from historical-month orders.
 * 3. Actual Gross Profit = Net Sales - Verified Purchase Cost.
 *    If purchase cost is missing/null, it is NEVER invented or approximated.
 *    Cost displays as "Cost unavailable" and profit displays as "N/A".
 * 4. Revenue is never confused with profit or collected cash.
 * ============================================================================
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * Standard Indian Rupee (INR ₹) Currency Formatter
 */
export function formatINR(val) {
  const num = Number(val)
  if (val === null || val === undefined || Number.isNaN(num)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Percentage Formatter with explicit sign (+ / -)
 */
export function formatPercentage(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return 'N/A'
  const num = Number(val)
  const sign = num > 0 ? '+' : ''
  return `${sign}${num.toFixed(1)}%`
}

/**
 * Returns UTC/local date boundaries for a given month and year.
 * Prevents timezone off-by-one errors across month boundaries.
 */
export function getMonthDateRange(year, monthIndex) {
  const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0)
  const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    daysInMonth: endDate.getDate()
  }
}

/**
 * Fetches all necessary business datasets for target and previous months from Supabase.
 */
export async function fetchMonthlyBusinessData(year, monthIndex, supabaseClient) {
  if (!supabaseClient) throw new Error('Supabase client is not available.')

  const targetRange = getMonthDateRange(year, monthIndex)
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1
  const prevYear = monthIndex === 0 ? year - 1 : year
  const prevRange = getMonthDateRange(prevYear, prevMonthIndex)

  // 1. Fetch categories
  const { data: categories, error: catErr } = await supabaseClient
    .from('categories')
    .select('id, title, slug')

  if (catErr) console.warn('[BusinessAnalytics] Failed to fetch categories:', catErr.message)

  // 2. Fetch products with catalog cost_price
  const { data: products, error: prodErr } = await supabaseClient
    .from('products')
    .select('id, name, sku, brand, model, price, cost_price, category_id')

  if (prodErr) console.warn('[BusinessAnalytics] Failed to fetch products:', prodErr.message)

  // 3. Fetch target month orders (created in month OR completed in month)
  const { data: targetOrders, error: ordErr } = await supabaseClient
    .from('orders')
    .select('*, order_items(*)')
    .or(`created_at.gte.${targetRange.startISO},completion_approved_at.gte.${targetRange.startISO}`)
    .order('created_at', { ascending: false })

  if (ordErr) throw new Error(`Failed to fetch orders: ${ordErr.message}`)

  // Filter in memory to respect exact date bounds
  const ordersInMonth = (targetOrders || []).filter((o) => {
    if (!o.created_at) return false
    const d = new Date(o.created_at)
    return d >= targetRange.startDate && d <= targetRange.endDate
  })

  const completedSalesInMonth = (targetOrders || []).filter((o) => {
    if (o.status !== 'completed' || !o.completion_approved_at) return false
    const d = new Date(o.completion_approved_at)
    return d >= targetRange.startDate && d <= targetRange.endDate
  })

  // 4. Fetch target month payments (all collections in date range)
  const { data: targetPayments, error: payErr } = await supabaseClient
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, created_at, status)')
    .gte('received_at', targetRange.startISO)
    .lte('received_at', targetRange.endISO)
    .order('received_at', { ascending: false })

  if (payErr) throw new Error(`Failed to fetch payments: ${payErr.message}`)

  // 5. Fetch previous month completed sales & payments for comparative trend
  const { data: prevOrders, error: prevOrdErr } = await supabaseClient
    .from('orders')
    .select('id, total_amount, paid_amount, status, created_at, completion_approved_at, order_items(quantity, line_total)')
    .gte('completion_approved_at', prevRange.startISO)
    .lte('completion_approved_at', prevRange.endISO)
    .eq('status', 'completed')

  if (prevOrdErr) console.warn('[BusinessAnalytics] Prev orders warning:', prevOrdErr.message)

  const { data: prevOrdersCreated, error: prevCreatedErr } = await supabaseClient
    .from('orders')
    .select('id')
    .gte('created_at', prevRange.startISO)
    .lte('created_at', prevRange.endISO)

  if (prevCreatedErr) console.warn('[BusinessAnalytics] Prev created orders warning:', prevCreatedErr.message)

  const { data: prevPayments, error: prevPayErr } = await supabaseClient
    .from('order_payments')
    .select('amount_received')
    .gte('received_at', prevRange.startISO)
    .lte('received_at', prevRange.endISO)

  if (prevPayErr) console.warn('[BusinessAnalytics] Prev payments warning:', prevPayErr.message)

  return {
    year,
    monthIndex,
    targetRange,
    prevMonthIndex,
    prevYear,
    categories: categories || [],
    products: products || [],
    ordersInMonth,
    completedSalesInMonth,
    paymentsInMonth: targetPayments || [],
    prevData: {
      completedSales: prevOrders || [],
      ordersCreatedCount: prevOrdersCreated?.length || 0,
      totalCollected: (prevPayments || []).reduce((acc, p) => acc + Number(p.amount_received || 0), 0)
    }
  }
}

/**
 * Computes Executive Monthly Business Summary KPI Cards (10 Core Metrics).
 */
export function computeMonthlySummary({
  ordersInMonth = [],
  completedSales = [],
  paymentsInMonth = [],
  products = []
}) {
  // 1. Total Sales Revenue (from completed & approved orders)
  const salesRevenue = completedSales.reduce((acc, o) => acc + Number(o.total_amount || 0), 0)

  // 2. Total Orders Placed in Month
  const totalOrdersCount = ordersInMonth.length

  // 3. Completed Sales Count
  const completedSalesCount = completedSales.length

  // 4. Total Amount Collected (Actual Cash/Bank Received in payment ledger during this month)
  const totalCollected = paymentsInMonth.reduce((acc, p) => acc + Number(p.amount_received || 0), 0)

  // 5. Total Units Sold across completed orders
  let unitsSold = 0
  completedSales.forEach((order) => {
    ;(order.order_items || []).forEach((item) => {
      unitsSold += Number(item.quantity || 0)
    })
  })

  // 6. Outstanding Pending Customer Balance across orders created in month
  const pendingBalance = ordersInMonth
    .filter((o) => o.status !== 'cancelled' && !o.is_removed && !o.is_in_bin)
    .reduce((acc, o) => {
      const tot = Number(o.total_amount || 0)
      const pd = Number(o.paid_amount || 0)
      return acc + Math.max(0, tot - pd)
    }, 0)

  // 7. Discounts Given on orders created in month
  const discountsGiven = ordersInMonth.reduce((acc, o) => acc + Number(o.discount_amount || 0), 0)

  // 8. Refunds & Cancelled Orders
  const cancelledOrders = ordersInMonth.filter((o) => o.status === 'cancelled')
  const cancelledAmount = cancelledOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0)

  // 9. Average Order Value (AOV) on completed sales
  const averageOrderValue = completedSalesCount > 0 ? salesRevenue / completedSalesCount : 0

  // 10. Actual Gross Profit calculation
  // Build fast product lookup map
  const productMap = new Map()
  products.forEach((p) => {
    productMap.set(p.id, p)
  })

  let verifiedGrossProfit = 0
  let totalCostAvailable = 0
  let soldItemsWithCostCount = 0
  let soldItemsMissingCostCount = 0

  completedSales.forEach((order) => {
    ;(order.order_items || []).forEach((item) => {
      // Prioritize verified acquisition cost snapshotted at time of sale.
      // Strict Accounting Rule: If cost_price_snapshot is null or unrecorded,
      // never silently substitute today's live catalog cost. Cost displays as "Cost unavailable".
      const rawSnapshot = item.cost_price_snapshot !== null && item.cost_price_snapshot !== undefined
        ? item.cost_price_snapshot
        : null
      const costPrice = rawSnapshot !== null && !Number.isNaN(Number(rawSnapshot)) && Number(rawSnapshot) >= 0
        ? Number(rawSnapshot)
        : null

      if (costPrice !== null) {
        const itemCost = costPrice * Number(item.quantity || 0)
        totalCostAvailable += itemCost
        verifiedGrossProfit += Number(item.line_total || 0) - itemCost
        soldItemsWithCostCount++
      } else {
        soldItemsMissingCostCount++
      }
    })
  })

  const hasCompleteCostData = soldItemsWithCostCount > 0 && soldItemsMissingCostCount === 0
  const hasPartialCostData = soldItemsWithCostCount > 0 && soldItemsMissingCostCount > 0

  return {
    salesRevenue,
    totalOrdersCount,
    completedSalesCount,
    totalCollected,
    unitsSold,
    pendingBalance,
    discountsGiven,
    cancelledOrdersCount: cancelledOrders.length,
    cancelledAmount,
    averageOrderValue,
    verifiedGrossProfit,
    totalCostAvailable,
    soldItemsWithCostCount,
    soldItemsMissingCostCount,
    hasCompleteCostData,
    hasPartialCostData,
    netProfitStatus: 'Expense data unavailable' // Operating expense records not stored in system
  }
}

/**
 * Computes Product-wise Sales and Profit Analysis Table.
 */
export function computeProductWisePerformance({
  completedSales = [],
  products = [],
  categories = []
}) {
  const categoryMap = new Map()
  categories.forEach((c) => categoryMap.set(c.id, c.title))

  const productMap = new Map()
  products.forEach((p) => productMap.set(p.id, p))

  // Key: product_id or normalized product_name
  const map = new Map()

  completedSales.forEach((order) => {
    const orderRef = {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      date: order.completion_approved_at || order.created_at,
      paymentMethod: order.payment_method
    }

    ;(order.order_items || []).forEach((item) => {
      const key = item.product_id ? `id_${item.product_id}` : `name_${(item.product_name_snapshot || '').trim().toLowerCase()}`
      const catalogProd = item.product_id ? productMap.get(item.product_id) : null

      if (!map.has(key)) {
        const catName = catalogProd?.category_id ? categoryMap.get(catalogProd.category_id) : 'Hardware & Components'
        // Strict Accounting Rule: Use item.cost_price_snapshot.
        // Never silently substitute today's live catalog cost for historical sales.
        const rawSnapshot = item.cost_price_snapshot !== null && item.cost_price_snapshot !== undefined
          ? item.cost_price_snapshot
          : null
        const costPrice = rawSnapshot !== null && !Number.isNaN(Number(rawSnapshot)) && Number(rawSnapshot) >= 0
          ? Number(rawSnapshot)
          : null

        map.set(key, {
          productId: item.product_id,
          productName: item.product_name_snapshot || catalogProd?.name || 'Direct Order Item',
          sku: item.sku_snapshot || catalogProd?.sku || 'N/A',
          category: catName || 'Hardware & Components',
          quantitySold: 0,
          grossSales: 0,
          discountAmount: 0,
          refundAdjustment: 0,
          netSales: 0,
          unitCost: costPrice, // null if unavailable
          totalCost: 0,
          grossProfit: null,
          profitMargin: null,
          hasCost: costPrice !== null && !Number.isNaN(costPrice),
          orderTransactions: []
        })
      }

      const rec = map.get(key)
      const qty = Number(item.quantity || 0)
      const lineTotal = Number(item.line_total || 0)

      rec.quantitySold += qty
      rec.grossSales += lineTotal
      rec.netSales += lineTotal

      if (rec.hasCost) {
        rec.totalCost += rec.unitCost * qty
      }

      rec.orderTransactions.push({
        ...orderRef,
        quantity: qty,
        unitPrice: Number(item.unit_price || 0),
        lineTotal
      })
    })
  })

  // Finalize profits and margins
  const result = Array.from(map.values()).map((p) => {
    if (p.hasCost) {
      const profit = p.netSales - p.totalCost
      const margin = p.netSales > 0 ? (profit / p.netSales) * 100 : 0
      return {
        ...p,
        grossProfit: profit,
        profitMargin: Math.round(margin * 10) / 10
      }
    }
    return {
      ...p,
      grossProfit: null,
      profitMargin: null
    }
  })

  return result
}

/**
 * Computes Category-level sales and revenue distribution.
 */
export function computeCategoryPerformance(productSales = [], totalSalesRevenue = 0) {
  const catMap = new Map()

  productSales.forEach((p) => {
    const cat = p.category || 'Hardware & Components'
    if (!catMap.has(cat)) {
      catMap.set(cat, {
        categoryName: cat,
        unitsSold: 0,
        revenue: 0,
        verifiedProfit: 0,
        itemsWithCostCount: 0,
        itemsCount: 0
      })
    }
    const c = catMap.get(cat)
    c.unitsSold += p.quantitySold
    c.revenue += p.netSales
    c.itemsCount++
    if (p.hasCost && p.grossProfit !== null) {
      c.verifiedProfit += p.grossProfit
      c.itemsWithCostCount++
    }
  })

  return Array.from(catMap.values())
    .map((c) => {
      const share = totalSalesRevenue > 0 ? (c.revenue / totalSalesRevenue) * 100 : 0
      return {
        ...c,
        revenueShare: Math.round(share * 10) / 10,
        hasCostData: c.itemsWithCostCount > 0
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/**
 * Computes Daily Sales & Payment Collections Trend for selected month.
 */
export function computeDailyTrend(completedSales = [], paymentsInMonth = [], daysInMonth = 30) {
  const dailyMap = new Map()

  for (let day = 1; day <= daysInMonth; day++) {
    dailyMap.set(day, {
      day,
      revenue: 0,
      completedSalesCount: 0,
      collected: 0
    })
  }

  // Daily Completed Sales Revenue
  completedSales.forEach((o) => {
    const rawDate = o.completion_approved_at || o.created_at
    if (rawDate) {
      const day = new Date(rawDate).getDate()
      if (dailyMap.has(day)) {
        const d = dailyMap.get(day)
        d.revenue += Number(o.total_amount || 0)
        d.completedSalesCount++
      }
    }
  })

  // Daily Collections
  paymentsInMonth.forEach((p) => {
    if (p.received_at) {
      const day = new Date(p.received_at).getDate()
      if (dailyMap.has(day)) {
        const d = dailyMap.get(day)
        d.collected += Number(p.amount_received || 0)
      }
    }
  })

  return Array.from(dailyMap.values())
}

/**
 * Computes Dedicated Payments and Outstanding Balance Analysis.
 */
export function computePaymentAnalysis(paymentsInMonth = [], ordersInMonth = [], targetRange) {
  let totalReceived = 0
  let currentMonthOrdersPayment = 0
  let previousMonthsOrdersPayment = 0

  const methodBreakdown = {
    cash: { count: 0, total: 0, label: 'Cash' },
    upi: { count: 0, total: 0, label: 'UPI' },
    bank_transfer: { count: 0, total: 0, label: 'Bank Transfer / NEFT' },
    card: { count: 0, total: 0, label: 'Debit / Credit Card' },
    cheque: { count: 0, total: 0, label: 'Cheque' },
    other: { count: 0, total: 0, label: 'Other' }
  }

  paymentsInMonth.forEach((p) => {
    const amt = Number(p.amount_received || 0)
    totalReceived += amt

    // Method breakdown
    const m = (p.payment_method || 'cash').toLowerCase()
    if (methodBreakdown[m]) {
      methodBreakdown[m].count++
      methodBreakdown[m].total += amt
    } else {
      methodBreakdown.other.count++
      methodBreakdown.other.total += amt
    }

    // Historical month attribution check
    const orderCreatedAt = p.orders?.created_at ? new Date(p.orders.created_at) : null
    if (orderCreatedAt && orderCreatedAt < targetRange.startDate) {
      previousMonthsOrdersPayment += amt
    } else {
      currentMonthOrdersPayment += amt
    }
  })

  // Pending Balances on Orders
  const pendingOrders = ordersInMonth
    .filter((o) => o.status !== 'cancelled' && !o.is_removed && !o.is_in_bin && Number(o.total_amount || 0) > Number(o.paid_amount || 0))
    .map((o) => ({
      orderId: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      contactInfo: o.contact_info,
      createdAt: o.created_at,
      status: o.status,
      paymentStatus: o.payment_status,
      totalAmount: Number(o.total_amount || 0),
      paidAmount: Number(o.paid_amount || 0),
      balanceDue: Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0))
    }))
    .sort((a, b) => b.balanceDue - a.balanceDue)

  return {
    totalReceived,
    currentMonthOrdersPayment,
    previousMonthsOrdersPayment,
    methodBreakdown: Object.values(methodBreakdown).filter((m) => m.count > 0 || m.total > 0),
    pendingOrders
  }
}

/**
 * Computes Factual, Data-Driven Business Observations & Insights.
 */
export function computeBusinessInsights({
  summary,
  productSales = [],
  categorySales = [],
  paymentAnalysis,
  prevData,
  _monthIndex,
  year
}) {
  const insights = []

  // 1. Top Selling Product by Units
  const sortedByQty = [...productSales].sort((a, b) => b.quantitySold - a.quantitySold)
  if (sortedByQty.length > 0 && sortedByQty[0].quantitySold > 0) {
    insights.push({
      type: 'product',
      title: 'Top-Selling Product',
      badge: `${sortedByQty[0].quantitySold} Units Sold`,
      description: `${sortedByQty[0].productName} (${sortedByQty[0].category}) generated ${formatINR(sortedByQty[0].netSales)} in sales revenue.`
    })
  }

  // 2. Highest Revenue Category
  if (categorySales.length > 0 && categorySales[0].revenue > 0) {
    insights.push({
      type: 'category',
      title: 'Leading Category',
      badge: `${categorySales[0].revenueShare}% Revenue Share`,
      description: `${categorySales[0].categoryName} led sales with ${formatINR(categorySales[0].revenue)} (${categorySales[0].unitsSold} units).`
    })
  }

  // 3. Highest Gross Profit Product (only if cost verified)
  const productsWithCost = productSales.filter((p) => p.hasCost && p.grossProfit !== null).sort((a, b) => b.grossProfit - a.grossProfit)
  if (productsWithCost.length > 0 && productsWithCost[0].grossProfit > 0) {
    insights.push({
      type: 'profit',
      title: 'Top Gross-Profit Contributor',
      badge: `${productsWithCost[0].profitMargin}% Margin`,
      description: `${productsWithCost[0].productName} contributed ${formatINR(productsWithCost[0].grossProfit)} in verified gross profit.`
    })
  } else {
    insights.push({
      type: 'cost-warning',
      title: 'Catalog Purchase Cost Notice',
      badge: 'Cost Data Pending',
      description: 'Product purchase costs are not recorded in the catalog. Gross profit metrics will calculate automatically once costs are entered.'
    })
  }

  // 4. Highest Outstanding Customer Balance
  if (paymentAnalysis.pendingOrders.length > 0) {
    const topPending = paymentAnalysis.pendingOrders[0]
    insights.push({
      type: 'collection',
      title: 'Highest Pending Balance',
      badge: formatINR(topPending.balanceDue),
      description: `Order ${topPending.orderNumber} for ${topPending.customerName} has an outstanding balance of ${formatINR(topPending.balanceDue)}.`
    })
  }

  // 5. Month-over-Month Comparison
  const prevRevenue = prevData?.completedSales?.reduce((acc, o) => acc + Number(o.total_amount || 0), 0) || 0
  if (prevRevenue > 0) {
    const revDiff = summary.salesRevenue - prevRevenue
    const revPct = (revDiff / prevRevenue) * 100
    insights.push({
      type: 'growth',
      title: 'Month-over-Month Sales Trend',
      badge: formatPercentage(revPct),
      description: `${summary.salesRevenue >= prevRevenue ? 'Revenue grew by' : 'Revenue declined by'} ${formatINR(Math.abs(revDiff))} compared to ${MONTH_NAMES[prevData.prevMonthIndex || 0]} ${prevData.prevYear || year}.`
    })
  }

  // 6. Products with missing cost records
  const missingCostProducts = productSales.filter((p) => !p.hasCost)
  if (missingCostProducts.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Missing Purchase Costs',
      badge: `${missingCostProducts.length} Items`,
      description: `${missingCostProducts.length} products sold this month lack verified purchase cost records in the inventory catalog.`
    })
  }

  return insights
}
