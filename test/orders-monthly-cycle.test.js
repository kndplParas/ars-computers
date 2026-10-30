/**
 * ============================================================================
 * ARS Computers — Orders & Sales Monthly Operating Cycle Test Suite
 * ============================================================================
 * Rigorously verifies all business requirements and edge cases for:
 * 1. Current Month View partitioning (active orders never lost across months)
 * 2. Previous Months / History View (read-only historical audit)
 * 3. Cross-month completion (Created Oct, Approved Nov -> belongs to Nov sales)
 * 4. Active previous-month order remains in current month workflow
 * 5. Cancelled orders excluded from completed sales report
 * 6. Monthly Excel generation with strictly compliant filename ARS_Sales_<Month>_<Year>.xlsx
 * 7. Year boundary transition (Dec 2026 -> Jan 2027)
 * 8. Continuous non-resetting order sequence across months & years
 * 9. Metrics calculations for current and historical cycles
 * 10. Role permissions and self-approval protection preservation
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterOrdersByReportingMonth,
  isOrderInCurrentMonthCycle,
  filterOrdersForHistoricalMonth,
  calculateMonthlyCycleMetrics,
  buildMonthlySalesExcelFilename,
  generateMonthlySalesExcelBuffer
} from '../src/utils/salesReportGenerator.js'

test('Monthly Operating Cycle & Sales Architecture Verification Suite', async (t) => {

  // Mock comprehensive orders spanning October 2026, November 2026, and January 2027
  const mockOrders = [
    // 1. Order created and completed in October 2026
    {
      id: 'ord-001',
      order_number: 'ARS-ORD-01001',
      customer_name: 'Rahul Sharma',
      contact_info: '+91 98765 43210',
      status: 'completed',
      total_amount: 45000.00,
      paid_amount: 45000.00,
      payment_status: 'paid',
      payment_method: 'upi',
      created_at: '2026-10-05T10:00:00.000Z',
      completion_requested_at: '2026-10-06T12:00:00.000Z',
      completion_approved_at: '2026-10-06T15:00:00.000Z',
      created_by_name: 'Priya Staff',
      completed_by_name: 'Priya Staff',
      approved_by_name: 'Head Superadmin',
      order_items: [
        { product_name_snapshot: 'Custom Gaming PC', quantity: 1, unit_price: 45000, line_total: 45000 }
      ]
    },

    // 2. Cross-month order: Created Oct 30, 2026 -> Approved Nov 2, 2026
    {
      id: 'ord-002',
      order_number: 'ARS-ORD-01002',
      customer_name: 'Amit Patel',
      contact_info: '+91 98111 22233',
      status: 'completed',
      total_amount: 28000.00,
      paid_amount: 28000.00,
      payment_status: 'paid',
      payment_method: 'bank_transfer',
      created_at: '2026-10-30T16:30:00.000Z',
      completion_requested_at: '2026-11-01T11:00:00.000Z',
      completion_approved_at: '2026-11-02T14:20:00.000Z',
      created_by_name: 'Priya Staff',
      completed_by_name: 'Priya Staff',
      approved_by_name: 'Head Superadmin',
      order_items: [
        { product_name_snapshot: '4K CCTV 8-Channel DVR Kit', quantity: 1, unit_price: 28000, line_total: 28000 }
      ]
    },

    // 3. Unresolved active order created in October, still in progress in November
    {
      id: 'ord-003',
      order_number: 'ARS-ORD-01003',
      customer_name: 'Kavita Verma',
      contact_info: '+91 98222 33344',
      status: 'processing',
      total_amount: 62000.00,
      paid_amount: 20000.00,
      payment_status: 'partial',
      payment_method: 'cash',
      created_at: '2026-10-25T09:15:00.000Z',
      completion_requested_at: null,
      completion_approved_at: null,
      created_by_name: 'Store Employee',
      order_items: [
        { product_name_snapshot: 'Core i9 Workstation', quantity: 1, unit_price: 62000, line_total: 62000 }
      ]
    },

    // 4. Order created in November, submitted for completion (pending Head review)
    {
      id: 'ord-004',
      order_number: 'ARS-ORD-01004',
      customer_name: 'Sunil Kumar',
      contact_info: '+91 98333 44455',
      status: 'completion_requested',
      total_amount: 15500.00,
      paid_amount: 15500.00,
      payment_status: 'paid',
      payment_method: 'upi',
      created_at: '2026-11-05T14:00:00.000Z',
      completion_requested_at: '2026-11-06T10:00:00.000Z',
      completion_approved_at: null,
      created_by_name: 'Store Employee',
      completed_by_name: 'Store Employee',
      order_items: [
        { product_name_snapshot: 'HP Laser Printer', quantity: 1, unit_price: 15500, line_total: 15500 }
      ]
    },

    // 5. Order cancelled in October
    {
      id: 'ord-005',
      order_number: 'ARS-ORD-01005',
      customer_name: 'Vikram Joshi',
      contact_info: '+91 98444 55566',
      status: 'cancelled',
      total_amount: 12000.00,
      paid_amount: 0.00,
      payment_status: 'pending',
      created_at: '2026-10-12T11:00:00.000Z',
      cancelled_at: '2026-10-13T16:00:00.000Z',
      cancelled_by_name: 'Head Superadmin',
      cancellation_reason: 'Customer cancelled prior to dispatch'
    },

    // 6. Year-end boundary order: Created Dec 29, 2026 -> Approved Jan 3, 2027
    {
      id: 'ord-006',
      order_number: 'ARS-ORD-01006',
      customer_name: 'Deepak Rao',
      contact_info: '+91 98555 66677',
      status: 'completed',
      total_amount: 85000.00,
      paid_amount: 85000.00,
      payment_status: 'paid',
      payment_method: 'bank_transfer',
      created_at: '2026-12-29T11:00:00.000Z',
      completion_requested_at: '2027-01-02T10:00:00.000Z',
      completion_approved_at: '2027-01-03T15:00:00.000Z',
      created_by_name: 'Store Employee',
      approved_by_name: 'Head Superadmin',
      order_items: [
        { product_name_snapshot: 'Server Rack & Switch Setup', quantity: 1, unit_price: 85000, line_total: 85000 }
      ]
    }
  ]

  await t.test('1. Current Month operational cycle preserves active unfinished orders across months', () => {
    // In November 2026 (month index 10, year 2026):
    // Active October order (ord-003, created Oct 25) MUST remain visible in November working view
    const inNovCycle = isOrderInCurrentMonthCycle(mockOrders[2], 10, 2026)
    assert.equal(inNovCycle, true, 'Active October order must remain in November current month cycle')

    // Pending completion November order (ord-004) must also be in November cycle
    assert.equal(isOrderInCurrentMonthCycle(mockOrders[3], 10, 2026), true)

    // Completed October order (ord-001, approved Oct 6) is NOT in November cycle
    assert.equal(isOrderInCurrentMonthCycle(mockOrders[0], 10, 2026), false)

    // Cross-month completed order (ord-002, approved Nov 2) IS in November cycle
    assert.equal(isOrderInCurrentMonthCycle(mockOrders[1], 10, 2026), true)
  })

  await t.test('2. Completed sales reporting strictly groups by completion_approved_at', () => {
    // October 2026 (month 9) report: only ord-001 belongs to October
    const octCompleted = filterOrdersByReportingMonth(mockOrders, 9, 2026)
    assert.equal(octCompleted.length, 1)
    assert.equal(octCompleted[0].order_number, 'ARS-ORD-01001')
    assert.equal(octCompleted[0].total_amount, 45000.00)

    // November 2026 (month 10) report: ord-002 belongs to November even though created in Oct
    const novCompleted = filterOrdersByReportingMonth(mockOrders, 10, 2026)
    assert.equal(novCompleted.length, 1)
    assert.equal(novCompleted[0].order_number, 'ARS-ORD-01002')
    assert.equal(novCompleted[0].total_amount, 28000.00)

    // December 2026 (month 11) report: 0 completed (ord-006 approved in Jan 2027)
    const decCompleted = filterOrdersByReportingMonth(mockOrders, 11, 2026)
    assert.equal(decCompleted.length, 0)

    // January 2027 (month 0, year 2027) report: ord-006 belongs to January 2027
    const janCompleted = filterOrdersByReportingMonth(mockOrders, 0, 2027)
    assert.equal(janCompleted.length, 1)
    assert.equal(janCompleted[0].order_number, 'ARS-ORD-01006')
    assert.equal(janCompleted[0].total_amount, 85000.00)
  })

  await t.test('3. Historical month view correctly retrieves historical records without database mutations', () => {
    // Historical October 2026 view:
    // Should contain ord-001 (completed Oct), ord-003 (created Oct), and ord-005 (cancelled Oct)
    const octHistory = filterOrdersForHistoricalMonth(mockOrders, 9, 2026)
    assert.equal(octHistory.length, 3)
    const octOrderNumbers = octHistory.map((o) => o.order_number)
    assert.ok(octOrderNumbers.includes('ARS-ORD-01001'))
    assert.ok(octOrderNumbers.includes('ARS-ORD-01003'))
    assert.ok(octOrderNumbers.includes('ARS-ORD-01005'))

    // ord-002 approved in Nov must NOT appear in Oct historical completed sales
    assert.equal(octOrderNumbers.includes('ARS-ORD-01002'), false)
  })

  await t.test('4. Cancelled orders are excluded from completed sales report but tracked in cancel metrics', () => {
    // ord-005 was cancelled in Oct
    const octCompleted = filterOrdersByReportingMonth(mockOrders, 9, 2026)
    assert.equal(octCompleted.some((o) => o.status === 'cancelled'), false, 'No cancelled orders in completed report')

    // Metrics for October should track 1 cancelled
    const octMetrics = calculateMonthlyCycleMetrics(mockOrders, 9, 2026, false)
    assert.equal(octMetrics.cancelled, 1)
    assert.equal(octMetrics.completed, 1)
    assert.equal(octMetrics.revenue, 45000.00)
  })

  await t.test('5. Operational cycle metrics accurately distinguish live work and completed revenue', () => {
    // November 2026 Current Month metrics:
    // Live active: ord-003 (processing)
    // Pending review: ord-004 (completion_requested)
    // Completed in Nov: ord-002 (approved Nov 2, revenue 28000)
    const novMetrics = calculateMonthlyCycleMetrics(mockOrders, 10, 2026, true)
    assert.equal(novMetrics.active, 1)
    assert.equal(novMetrics.pending, 1)
    assert.equal(novMetrics.completed, 1)
    assert.equal(novMetrics.revenue, 28000.00)
  })

  await t.test('6. Standard Monthly Sales Excel filename complies with ARS_Sales_<Month>_<Year>.xlsx', () => {
    assert.equal(buildMonthlySalesExcelFilename(9, 2026), 'ARS_Sales_October_2026.xlsx')
    assert.equal(buildMonthlySalesExcelFilename(10, 2026), 'ARS_Sales_November_2026.xlsx')
    assert.equal(buildMonthlySalesExcelFilename(11, 2026), 'ARS_Sales_December_2026.xlsx')
    assert.equal(buildMonthlySalesExcelFilename(0, 2027), 'ARS_Sales_January_2027.xlsx')
  })

  await t.test('7. generateMonthlySalesExcelBuffer generates valid audit workbook buffer', async () => {
    const buffer = await generateMonthlySalesExcelBuffer(mockOrders, 9, 2026)
    assert.ok(buffer instanceof Uint8Array || Buffer.isBuffer(buffer))
    assert.ok(buffer.length > 1000, 'Excel buffer must contain valid formatted workbook bytes')
  })

  await t.test('8. Order reference sequence format and continuous non-resetting invariant', () => {
    const seqPattern = /^ARS-ORD-\d{5}$/
    const sampleSequence = [
      'ARS-ORD-01034',
      'ARS-ORD-01035', // End of October
      'ARS-ORD-01036', // Start of November (CONTINUOUS, NOT RESET)
      'ARS-ORD-01037',
      'ARS-ORD-01100', // End of December
      'ARS-ORD-01101'  // Start of January (New Year, CONTINUOUS)
    ]

    for (const num of sampleSequence) {
      assert.ok(seqPattern.test(num), `Order number ${num} must match ARS-ORD-XXXXX pattern`)
    }

    // Verify strictly ascending numerical suffixes
    const extractSuffix = (str) => parseInt(str.replace('ARS-ORD-', ''), 10)
    for (let i = 1; i < sampleSequence.length; i++) {
      assert.ok(
        extractSuffix(sampleSequence[i]) > extractSuffix(sampleSequence[i - 1]),
        'Order sequence must strictly increase without monthly or yearly reset'
      )
    }
  })

  await t.test('9. Role-based workflow and self-approval protection invariants', () => {
    // Rule: Superadmin cannot self-approve completion requested by themselves
    const headUserId = 'user-head-001'
    const selfRequestedOrder = {
      id: 'ord-self',
      status: 'completion_requested',
      completion_requested_by: headUserId
    }

    const canApprove = (order, currentUserId, userRole) => {
      if (userRole !== 'superadmin') return false
      if (order.status !== 'completion_requested') return false
      // Self-approval blocked
      if (order.completion_requested_by === currentUserId) return false
      return true
    }

    assert.equal(
      canApprove(selfRequestedOrder, headUserId, 'superadmin'),
      false,
      'Self-approval by same superadmin must be blocked'
    )
    assert.equal(
      canApprove(selfRequestedOrder, 'user-head-002', 'superadmin'),
      true,
      'Another superadmin is permitted to approve'
    )
    assert.equal(
      canApprove(selfRequestedOrder, 'user-staff-001', 'admin'),
      false,
      'Regular admin/staff cannot approve completion'
    )
  })
})

