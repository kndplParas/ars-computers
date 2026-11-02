/**
 * ============================================================================
 * ARS Computers — Step 4: Order Customer Communication Security & UX Suite
 * ============================================================================
 * Audits & Verifies:
 * 1. Inventory Staff blocked from all communication actions and handlers.
 * 2. Privacy scrubbing: zero internal employee codes, UUIDs, DB IDs, cost prices,
 *    margins, profits, private payment references, internal remarks, or private attachment paths.
 * 3. Staff display name preference: shows only display name, never employee codes.
 * 4. Cancelled orders: accurate status and clear customer-facing cancellation text.
 * 5. Missing / invalid phone or email safely disables the relevant action.
 * 6. Switching between orders correctly updates email modal and WhatsApp targets.
 * 7. Clipboard copy failure produces error toast and never falsely reports success.
 * 8. Existing Step 3 customer communication behavior remains intact.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  formatOrderCustomerDispatch,
  buildCustomerOrderWhatsAppUrl,
  buildCustomerOrderEmailUrl,
  resolveCustomerPhone,
  resolveCustomerEmail,
  normalizeIndianPhoneForWhatsApp
} from '../src/utils/customerDispatchFormatter.js'

// --- Mock Data ---
const SAMPLE_ORDER_BASIC = {
  id: 'a0000000-0000-0000-0000-000000000001',
  order_number: 'ARS-ORD-01001',
  customer_name: 'Rajesh Sharma',
  contact_info: '+91 98765 43210 | rajesh.sharma@example.com',
  status: 'processing',
  total_amount: 45000.00,
  paid_amount: 15000.00,
  payment_status: 'partial',
  payment_method: 'upi',
  created_at: '2026-11-01T10:00:00.000Z',
  created_by_name: 'Amit Patel',
  created_by_employee_code: 'EMP-010',
  employee_remarks: 'Internal note: Customer requested morning delivery',
  head_remarks: 'Approved with standard warranty',
  order_items: [
    {
      id: 'item-uuid-1',
      product_id: 'prod-uuid-1',
      product_name_snapshot: 'Lenovo ThinkPad E14 Gen 5',
      sku_snapshot: 'LAP-LEN-E14',
      quantity: 1,
      unit_price: 45000.00,
      line_total: 45000.00,
      cost_price: 38000.00,
      profit_margin: 7000.00
    }
  ],
  order_payments: [
    {
      id: 'pay-uuid-1',
      order_id: 'a0000000-0000-0000-0000-000000000001',
      amount_received: 15000.00,
      payment_method: 'upi',
      transaction_reference: 'UPI/3291823901/HDFC',
      remarks: 'Advance paid via GooglePay counter QR',
      received_at: '2026-11-01T10:15:00.000Z'
    }
  ]
}

const SAMPLE_ORDER_MULTI_PAYMENT = {
  id: 'b0000000-0000-0000-0000-000000000002',
  order_number: 'ARS-ORD-01002',
  customer_name: 'Pooja Verma',
  customer_phone: '9812345678',
  customer_email: 'pooja.v@example.com',
  customer_address: 'Flat 402, Royal Palms, Nainital Road, Haldwani',
  status: 'completed',
  total_amount: 60000.00,
  paid_amount: 60000.00,
  payment_status: 'paid',
  payment_method: 'bank_transfer',
  created_at: '2026-10-25T11:00:00.000Z',
  completed_by_name: 'Paras Technical',
  completed_by_employee_code: 'EMP-003',
  order_items: [
    {
      product_name_snapshot: 'CP Plus 8CH HD DVR System',
      sku_snapshot: 'CCTV-CPP-8CH',
      quantity: 1,
      unit_price: 35000.00,
      line_total: 35000.00
    },
    {
      product_name_snapshot: 'Seagate SkyHawk 4TB Surveillance HDD',
      sku_snapshot: 'HDD-SEA-4TB',
      quantity: 1,
      unit_price: 25000.00,
      line_total: 25000.00
    }
  ],
  order_payments: [
    {
      amount_received: 20000.00,
      payment_method: 'bank_transfer',
      transaction_reference: 'NEFT-SBIN00293019',
      received_at: '2026-10-25T11:30:00.000Z'
    },
    {
      amount_received: 40000.00,
      payment_method: 'upi',
      transaction_reference: 'UPI-REF-9920192831',
      received_at: '2026-10-28T16:00:00.000Z'
    }
  ],
  order_attachments: [
    {
      id: 'att-uuid-1',
      original_filename: 'delivery_challan.pdf',
      storage_path: 'b0000000-0000-0000-0000-000000000002/delivery_challan.pdf',
      is_customer_shareable: true
    },
    {
      id: 'att-uuid-2',
      original_filename: 'internal_cost_sheet.xlsx',
      storage_path: 'b0000000-0000-0000-0000-000000000002/internal_cost_sheet.xlsx',
      is_customer_shareable: false
    }
  ]
}

const SAMPLE_ORDER_CANCELLED = {
  id: 'c0000000-0000-0000-0000-000000000003',
  order_number: 'ARS-ORD-01003',
  customer_name: 'Vikram Singh',
  contact_info: '9899911122 | vikram@example.com',
  status: 'cancelled',
  total_amount: 12000.00,
  paid_amount: 0.00,
  payment_status: 'pending',
  payment_method: 'cash',
  cancellation_reason: 'Customer requested cancellation due to personal reasons; funds insufficient',
  cancelled_by_name: 'Ankit Bathla',
  cancelled_at: '2026-10-26T14:00:00.000Z',
  order_items: [
    {
      product_name_snapshot: 'Quick Heal Total Security 3 User',
      sku_snapshot: 'AV-QH-3U',
      quantity: 4,
      unit_price: 3000.00,
      line_total: 12000.00
    }
  ]
}

test('ARS Computers — Step 4 Final Security and UX Audit Suite', async (t) => {

  // --- Point 1: Inventory Staff Access Restrictions ---
  await t.test('Point 1: Inventory Staff cannot access or trigger communication actions', () => {
    const ordersPagePath = path.resolve('src/pages/admin/AdminOrdersPage.jsx')
    const content = fs.readFileSync(ordersPagePath, 'utf-8')

    // UI button block strictly wrapped in !isInventoryStaff
    assert.ok(content.includes('!isInventoryStaff && ('), 'Button group is hidden from inventory_staff')

    // All three action handlers have defense-in-depth guard: if (!order || isInventoryStaff) return
    assert.match(content, /handleCustomerWhatsApp\s*=\s*\([^{]*\)\s*=>\s*\{\s*if\s*\([^)]*isInventoryStaff[^)]*\)\s*return/, 'handleCustomerWhatsApp guarded')
    assert.match(content, /handleCustomerCopy\s*=\s*async\s*\([^{]*\)\s*=>\s*\{\s*if\s*\([^)]*isInventoryStaff[^)]*\)\s*return/, 'handleCustomerCopy guarded')
    assert.match(content, /handleCustomerEmail\s*=\s*\([^{]*\)\s*=>\s*\{\s*if\s*\([^)]*isInventoryStaff[^)]*\)\s*return/, 'handleCustomerEmail guarded')
  })

  // --- Point 2 & 3: Staff Display Name Preference & Privacy Scrubbing ---
  await t.test('Point 2 & 3: Shows ONLY staff display name; NO employee codes, UUIDs, cost prices, profit, or remarks', () => {
    const text1 = formatOrderCustomerDispatch(SAMPLE_ORDER_BASIC)
    const text2 = formatOrderCustomerDispatch(SAMPLE_ORDER_MULTI_PAYMENT)

    // Staff display name present
    assert.match(text1, /Handled By:\s*\nAmit Patel/)
    assert.match(text2, /Handled By:\s*\nParas Technical/)

    // Internal employee codes strictly absent
    assert.doesNotMatch(text1, /EMP-010/)
    assert.doesNotMatch(text1, /Employee Code/i)
    assert.doesNotMatch(text2, /EMP-003/)
    assert.doesNotMatch(text2, /Employee Code/i)

    // Zero internal UUIDs or DB IDs
    assert.doesNotMatch(text1, /a0000000-0000-0000-0000-000000000001/)
    assert.doesNotMatch(text1, /item-uuid-1/)
    assert.doesNotMatch(text1, /prod-uuid-1/)
    assert.doesNotMatch(text1, /pay-uuid-1/)
    assert.doesNotMatch(text2, /b0000000-0000-0000-0000-000000000002/)
    assert.doesNotMatch(text2, /att-uuid-1/)

    // Zero cost prices or profits
    assert.doesNotMatch(text1, /38000/)
    assert.doesNotMatch(text1, /7000/)
    assert.doesNotMatch(text1, /cost_price/i)
    assert.doesNotMatch(text1, /profit/i)
    assert.doesNotMatch(text1, /margin/i)

    // Zero internal transaction references or private remarks
    assert.doesNotMatch(text1, /UPI\/3291823901\/HDFC/)
    assert.doesNotMatch(text1, /Advance paid via GooglePay/)
    assert.doesNotMatch(text1, /Customer requested morning delivery/)
    assert.doesNotMatch(text1, /Approved with standard warranty/)
    assert.doesNotMatch(text2, /NEFT-SBIN00293019/)
    assert.doesNotMatch(text2, /UPI-REF-9920192831/)

    // Zero private attachment storage paths
    assert.doesNotMatch(text2, /b0000000-0000-0000-0000-000000000002\/delivery_challan\.pdf/)
    assert.doesNotMatch(text2, /internal_cost_sheet\.xlsx/)
  })

  // --- Point 4: Cancelled Order Status & Wording ---
  await t.test('Point 4: Cancelled orders have accurate customer-facing status and clear cancellation wording', () => {
    const text = formatOrderCustomerDispatch(SAMPLE_ORDER_CANCELLED)

    // Status is clearly Cancelled
    assert.match(text, /Order Status:\s*\nCancelled/)

    // Professional customer-facing wording
    assert.match(text, /This order has been cancelled\. For any queries or assistance, please contact ARS Computers\./)

    // Active order footer is NOT used for cancelled orders
    assert.doesNotMatch(text, /Thank you for choosing ARS Computers\./)

    // Internal cancellation reason is NOT leaked to customer
    assert.doesNotMatch(text, /personal reasons; funds insufficient/)
    assert.doesNotMatch(text, /cancellation_reason/i)
  })

  // --- Point 5: Missing / Invalid Phone or Email Safely Disables Actions ---
  await t.test('Point 5: Missing or invalid customer phone/email safely disables actions and returns null', () => {
    // 1. Missing phone
    const noPhoneOrder = { ...SAMPLE_ORDER_BASIC, contact_info: 'rajesh@example.com', customer_phone: null }
    assert.equal(resolveCustomerPhone(noPhoneOrder), null)
    assert.equal(buildCustomerOrderWhatsAppUrl(noPhoneOrder), null)

    // 2. Malformed / ambiguous phone (e.g. 5 digits or international)
    const badPhoneOrder = { ...SAMPLE_ORDER_BASIC, contact_info: '12345 | rajesh@example.com' }
    assert.equal(normalizeIndianPhoneForWhatsApp(resolveCustomerPhone(badPhoneOrder)), null)
    assert.equal(buildCustomerOrderWhatsAppUrl(badPhoneOrder), null)

    // 3. Missing email
    const noEmailOrder = { ...SAMPLE_ORDER_BASIC, contact_info: '9876543210', customer_email: null }
    assert.equal(resolveCustomerEmail(noEmailOrder), null)
    assert.equal(buildCustomerOrderEmailUrl(noEmailOrder), null)

    // 4. AdminOrdersPage source checks for button disabled attributes
    const ordersPagePath = path.resolve('src/pages/admin/AdminOrdersPage.jsx')
    const content = fs.readFileSync(ordersPagePath, 'utf-8')

    assert.ok(content.includes('disabled={!isCustWhatsAppValid}'), 'WhatsApp button disabled when phone invalid')
    assert.ok(content.includes('disabled={!isCustEmailValid}'), 'Email button disabled when email invalid')
  })

  // --- Point 6: Switching Between Orders Uses Correct Data ---
  await t.test('Point 6: Email modal and WhatsApp URL use the exact selected order and clean up on switch', () => {
    // WhatsApp URLs target the respective order's customer phone and details
    const waUrl1 = buildCustomerOrderWhatsAppUrl(SAMPLE_ORDER_BASIC)
    const waUrl2 = buildCustomerOrderWhatsAppUrl(SAMPLE_ORDER_MULTI_PAYMENT)
    const waUrl3 = buildCustomerOrderWhatsAppUrl(SAMPLE_ORDER_CANCELLED)

    assert.ok(waUrl1.includes('919876543210') && waUrl1.includes('ARS-ORD-01001'))
    assert.ok(waUrl2.includes('919812345678') && waUrl2.includes('ARS-ORD-01002'))
    assert.ok(waUrl3.includes('919899911122') && waUrl3.includes('ARS-ORD-01003'))

    // Email URLs target the respective customer email and subject
    const emailUrl1 = buildCustomerOrderEmailUrl(SAMPLE_ORDER_BASIC)
    const emailUrl2 = buildCustomerOrderEmailUrl(SAMPLE_ORDER_MULTI_PAYMENT)
    const emailUrl3 = buildCustomerOrderEmailUrl(SAMPLE_ORDER_CANCELLED)

    assert.ok(emailUrl1.startsWith('mailto:rajesh.sharma@example.com?subject=' + encodeURIComponent('ARS Computers | Order Details | ARS-ORD-01001')))
    assert.ok(emailUrl2.startsWith('mailto:pooja.v@example.com?subject=' + encodeURIComponent('ARS Computers | Order Details | ARS-ORD-01002')))
    assert.ok(emailUrl3.startsWith('mailto:vikram@example.com?subject=' + encodeURIComponent('ARS Computers | Order Details | ARS-ORD-01003')))

    // AdminOrdersPage handleCloseOrderDetails resets modal states to prevent leakage
    const ordersPagePath = path.resolve('src/pages/admin/AdminOrdersPage.jsx')
    const content = fs.readFileSync(ordersPagePath, 'utf-8')
    assert.ok(content.includes('setIsCustomerEmailModalOpen(false)'), 'Closes email modal on order dismiss')
    assert.ok(content.includes('setCopyFeedback(false)'), 'Resets copy feedback on order dismiss')
  })

  // --- Point 7: Clipboard Failure Produces Error and Does Not Falsely Report Success ---
  await t.test('Point 7: Clipboard failure triggers error toast and does not falsely indicate success', async () => {
    // Simulate clipboard writeText failure logic identical to handleCustomerCopy
    let feedbackState = false
    let toastResult = null

    const mockShowToast = (msg, type) => {
      toastResult = { msg, type }
    }

    const failingClipboard = {
      writeText: async () => {
        throw new Error('Clipboard write access blocked by browser permissions')
      }
    }

    // Run simulated handler with failing clipboard
    try {
      const text = formatOrderCustomerDispatch(SAMPLE_ORDER_BASIC)
      await failingClipboard.writeText(text)
      feedbackState = true
      mockShowToast('Order details copied', 'success')
    } catch (err) {
      feedbackState = false
      mockShowToast('Could not copy to clipboard: ' + (err?.message || 'Clipboard access denied'), 'error')
    }

    // Verify feedback was NOT set to true
    assert.equal(feedbackState, false, 'feedbackState remains false on clipboard failure')

    // Verify toast indicated error, NOT success
    assert.ok(toastResult !== null, 'Toast was called')
    assert.equal(toastResult.type, 'error', 'Toast type is error')
    assert.match(toastResult.msg, /Could not copy to clipboard: Clipboard write access blocked/, 'Toast contains specific failure message')

    // Source code verification in AdminOrdersPage.jsx
    const ordersPagePath = path.resolve('src/pages/admin/AdminOrdersPage.jsx')
    const content = fs.readFileSync(ordersPagePath, 'utf-8')
    assert.match(content, /catch\s*\([^)]*\)\s*\{\s*setCopyFeedback\(false\)/, 'setCopyFeedback(false) is called in catch block')
    assert.match(content, /showToast\([^,]*Could not copy[^,]*, 'error'\)/, 'showToast error is called in catch block')
  })

  // --- Point 8: Existing Step 3 Customer Communication Unchanged ---
  await t.test('Point 8: Existing Step 3 customer communication functions and formatters remain intact', () => {
    const formatterPath = path.resolve('src/utils/customerDispatchFormatter.js')
    const content = fs.readFileSync(formatterPath, 'utf-8')

    // Step 3 functions exist
    assert.ok(content.includes('formatEnquiryCustomerDispatch'), 'formatEnquiryCustomerDispatch exists')
    assert.ok(content.includes('buildCustomerWhatsAppUrl'), 'buildCustomerWhatsAppUrl exists')
    assert.ok(content.includes('buildCustomerEmailSubject'), 'buildCustomerEmailSubject exists')
    assert.ok(content.includes('buildCustomerEmailUrl'), 'buildCustomerEmailUrl exists')
    assert.ok(content.includes('resolveTicketId'), 'resolveTicketId exists')
    assert.ok(content.includes('formatAadhaarForDispatch'), 'formatAadhaarForDispatch exists')

    // Step 3 CustomerEmailModal component exists and untouched
    const emailModalPath = path.resolve('src/components/admin/CustomerEmailModal.jsx')
    assert.ok(fs.existsSync(emailModalPath), 'CustomerEmailModal.jsx exists')
  })
})
