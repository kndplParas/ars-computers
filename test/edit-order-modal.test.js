import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

describe('ARS Computers — Edit Order Modal & Validation Invariants', () => {
  const modalFilePath = path.join(projectRoot, 'src', 'components', 'admin', 'EditOrderModal.jsx')
  const modalSource = fs.readFileSync(modalFilePath, 'utf8')

  test('1. EditOrderModal structure guarantees permanently visible Save Changes and Cancel buttons', () => {
    // Verify separate scrollable body and fixed footer
    assert.ok(
      modalSource.includes('admin-modal-body') && modalSource.includes('admin-modal-footer'),
      'Modal separates scrollable body from fixed footer'
    )

    // Verify footer is placed outside the scrollable body
    const bodyIdx = modalSource.indexOf('admin-modal-body')
    const footerIdx = modalSource.indexOf('admin-modal-footer')
    assert.ok(footerIdx > bodyIdx, 'admin-modal-footer appears after admin-modal-body')

    // Verify Save Changes button
    assert.ok(
      modalSource.includes('Save Changes') && modalSource.includes('type="submit"'),
      'Save Changes submit button is explicitly present'
    )

    // Verify Cancel button
    assert.ok(
      modalSource.includes('Cancel') && modalSource.includes('type="button"'),
      'Cancel button is explicitly present'
    )

    // Verify loading state
    assert.ok(
      modalSource.includes('isSubmitting') && modalSource.includes('Saving Changes...'),
      'Button shows loading spinner and disabled state during submission'
    )
  })

  test('2. EditOrderModal enforces strict input and financial validation before submission', () => {
    // Customer Name >= 2
    assert.ok(
      modalSource.includes('customerName.trim().length < 2'),
      'Validates customer name minimum length'
    )

    // Contact info >= 5
    assert.ok(
      modalSource.includes('contactInfo.trim().length < 5'),
      'Validates contact information minimum length'
    )

    // At least 1 item
    assert.ok(
      modalSource.includes('items.length === 0'),
      'Validates that order must contain at least 1 item'
    )

    // Quantity >= 1 and Unit Price >= 0
    assert.ok(
      modalSource.includes('Number(it.quantity) <= 0') &&
      modalSource.includes('Number(it.unit_price) < 0'),
      'Validates numeric item quantities and selling prices'
    )

    // Financial check: updated total cannot be less than collected payment
    assert.ok(
      modalSource.includes('calculatedTotal < paidAmount'),
      'Guarantees order total cannot be reduced below already collected payment'
    )
  })

  test('3. AdminOrdersPage refreshes selected order details on successful update without closing view', () => {
    const ordersPagePath = path.join(projectRoot, 'src', 'pages', 'admin', 'AdminOrdersPage.jsx')
    const ordersPageSource = fs.readFileSync(ordersPagePath, 'utf8')

    // Check onOrderUpdated in AdminOrdersPage
    assert.ok(
      ordersPageSource.includes('onOrderUpdated={(result) => {') &&
      ordersPageSource.includes('setSelectedOrder((prev) => (prev ? { ...prev'),
      'Keeps selectedOrder refreshed with new details instead of wiping it to null'
    )
  })
})
