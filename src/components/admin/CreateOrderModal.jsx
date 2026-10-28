import { useState, useEffect } from 'react'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Create Sales Order Modal
 * ============================================================================
 * Allows Store Employees and Superadmins to record retail and custom sales orders.
 *
 * Rules:
 * - Server validates line items, quantities, and prices atomically.
 * - Selling price pre-fills from catalog when available; staff specifies if null.
 * - Private cost_price is never shown or touched.
 * - Balance and Payment Status derive automatically.
 * - Mandatory customer details and non-empty line items.
 * ============================================================================
 */
export default function CreateOrderModal({ isOpen, onClose, onOrderCreated }) {
  const { products = [], createSalesOrder, loadAdminCatalog } = useAdminData()

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [items, setItems] = useState([
    {
      id: 1,
      product_id: '',
      product_name: '',
      brand: '',
      model: '',
      sku: '',
      quantity: 1,
      unit_price: 0
    }
  ])
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [employeeRemarks, setEmployeeRemarks] = useState('')

  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-fetch products if catalog is not yet loaded in admin data
  useEffect(() => {
    if (isOpen && products.length === 0 && loadAdminCatalog) {
      loadAdminCatalog()
    }
  }, [isOpen, products.length, loadAdminCatalog])

  // Reset form helper
  const resetForm = () => {
    setCustomerName('')
    setContactInfo('')
    setItems([
      {
        id: Date.now(),
        product_id: '',
        product_name: '',
        brand: '',
        model: '',
        sku: '',
        quantity: 1,
        unit_price: 0
      }
    ])
    setPaidAmount(0)
    setPaymentMethod('cash')
    setEmployeeRemarks('')
    setFormError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  // Calculate Order Total
  const calculatedTotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  )

  const numPaid = Math.max(0, Number(paidAmount) || 0)
  const balance = Math.max(0, calculatedTotal - numPaid)
  const derivedPaymentStatus = numPaid === 0 ? 'PENDING' : numPaid >= calculatedTotal ? 'PAID' : 'PARTIAL'

  // Item Handlers
  const handleProductSelect = (index, productId) => {
    const selected = products.find((p) => p.id === productId)
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it
        if (!selected) {
          return {
            ...it,
            product_id: '',
            product_name: '',
            brand: '',
            model: '',
            sku: '',
            unit_price: 0
          }
        }
        return {
          ...it,
          product_id: selected.id,
          product_name: selected.name,
          brand: selected.brand || '',
          model: selected.model || '',
          sku: selected.sku || '',
          unit_price: selected.price ? Number(selected.price) : 0
        }
      })
    )
  }

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    )
  }

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        product_id: '',
        product_name: '',
        brand: '',
        model: '',
        sku: '',
        quantity: 1,
        unit_price: 0
      }
    ])
  }

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePayInFull = () => {
    setPaidAmount(calculatedTotal)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (customerName.trim().length < 2) {
      setFormError('Customer Name must be at least 2 characters.')
      return
    }

    if (contactInfo.trim().length < 5) {
      setFormError('Contact Information must be at least 5 characters (Phone or Email).')
      return
    }

    if (items.length === 0) {
      setFormError('Order must contain at least one product.')
      return
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.product_name.trim() && !it.product_id) {
        setFormError(`Item #${i + 1} requires a product selection or custom name.`)
        return
      }
      if (Number(it.quantity) <= 0) {
        setFormError(`Item #${i + 1} quantity must be at least 1.`)
        return
      }
      if (Number(it.unit_price) < 0) {
        setFormError(`Item #${i + 1} selling price cannot be negative.`)
        return
      }
    }

    if (numPaid > calculatedTotal) {
      setFormError('Paid amount cannot exceed the order total.')
      return
    }

    setIsSubmitting(true)
    try {
      const formattedItems = items.map((it) => ({
        product_id: it.product_id || null,
        product_name: it.product_name,
        brand: it.brand,
        model: it.model,
        sku: it.sku,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price)
      }))

      const result = await createSalesOrder({
        customer_name: customerName.trim(),
        contact_info: contactInfo.trim(),
        items: formattedItems,
        paid_amount: numPaid,
        payment_method: paymentMethod,
        employee_remarks: employeeRemarks.trim() || null
      })

      if (onOrderCreated) {
        onOrderCreated(result)
      }
      handleClose()
    } catch (err) {
      console.error('Failed to create sales order:', err)
      setFormError(err.message || 'Failed to create sales order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-order-modal-title"
    >
      <div
        className="admin-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: 'min(900px, calc(100vw - 20px))',
          maxHeight: 'min(92vh, calc(100dvh - 24px))',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div className="admin-modal-header">
          <div>
            <h2 id="create-order-modal-title" className="admin-modal-title">
              Create Sales Order
            </h2>
            <span className="modal-subtitle-note">
              Record hardware sales, custom PC builds, and customer transactions.
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close create order modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="admin-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
            {formError && (
              <div
                className="admin-banner-disclaimer"
                style={{ borderColor: '#ef4444', color: '#b91c1c', background: '#fee2e2', marginBottom: '16px' }}
              >
                <strong>Error:</strong> {formError}
              </div>
            )}

            {/* Customer Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label htmlFor="order-cust-name" className="form-label">
                  Customer Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="order-cust-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Verma or ABC Enterprises"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="order-cust-contact" className="form-label">
                  Contact Information <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="order-cust-contact"
                  type="text"
                  className="form-input"
                  placeholder="e.g. +91 9876543210 or customer@domain.com"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Order Items Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#1e293b' }}>
                  Order Items ({items.length})
                </h3>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleAddItem}
                  disabled={isSubmitting}
                  style={{ minHeight: '38px', padding: '6px 14px' }}
                >
                  + Add Another Product
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="order-items-table-desktop" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '42%' }}>Product Selection</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '15%' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: '20%' }}>Selling Price (₹)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: '18%' }}>Line Total (₹)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
                      return (
                        <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              className="form-select"
                              style={{ width: '100%', marginBottom: '4px' }}
                              value={it.product_id}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              disabled={isSubmitting}
                            >
                              <option value="">-- Select Catalog Product or Custom Item --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.sku ? `[${p.sku}]` : ''} — {p.price ? `₹${p.price}` : 'Manual Quote'}
                                </option>
                              ))}
                            </select>
                            {!it.product_id && (
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Enter custom item name / specifications..."
                                value={it.product_name}
                                onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                                disabled={isSubmitting}
                                style={{ fontSize: '12px', padding: '6px 8px' }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              className="form-input"
                              style={{ width: '70px', textAlign: 'center' }}
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              disabled={isSubmitting}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-input"
                              style={{ width: '100px', textAlign: 'right' }}
                              value={it.unit_price}
                              onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                              disabled={isSubmitting}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            ₹{lineTotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                                title="Remove line"
                                aria-label={`Remove Item ${idx + 1}`}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards View */}
              <div className="order-items-cards-mobile">
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
                  return (
                    <div key={it.id || idx} className="order-item-card-mobile">
                      <div className="order-item-card-mobile-header">
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                          Item #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              color: '#b91c1c',
                              borderRadius: '6px',
                              width: '44px',
                              height: '44px',
                              minWidth: '44px',
                              minHeight: '44px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              fontWeight: 700
                            }}
                            title="Remove line"
                            aria-label={`Remove Item ${idx + 1}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                          Product Selection
                        </label>
                        <select
                          className="form-select"
                          style={{ width: '100%', marginBottom: '6px' }}
                          value={it.product_id}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          disabled={isSubmitting}
                        >
                          <option value="">-- Select Catalog Product or Custom Item --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `[${p.sku}]` : ''} — {p.price ? `₹${p.price}` : 'Manual Quote'}
                            </option>
                          ))}
                        </select>
                        {!it.product_id && (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter custom item name / specifications..."
                            value={it.product_name}
                            onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                            disabled={isSubmitting}
                            style={{ fontSize: '13px' }}
                          />
                        )}
                      </div>

                      <div className="order-item-card-mobile-grid">
                        <div>
                          <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="form-input"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            disabled={isSubmitting}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                            Selling Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={it.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                            disabled={isSubmitting}
                            required
                          />
                        </div>
                      </div>

                      <div className="order-item-card-mobile-total">
                        <span>Line Total:</span>
                        <span>₹{lineTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Payment & Totals Section */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'center' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '4px' }}>Payment Method</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                    <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                    <option value="card">Card Payment</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other / Store Credit</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Amount Paid (₹)</label>
                    <button
                      type="button"
                      onClick={handlePayInFull}
                      style={{ fontSize: '12px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', textDecoration: 'underline', padding: '4px' }}
                    >
                      Paid in Full
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={calculatedTotal}
                    step="0.01"
                    className="form-input"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Order Total:</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    ₹{calculatedTotal.toFixed(2)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Balance Due:</div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: balance > 0 ? '#b91c1c' : '#15803d' }}>
                    ₹{balance.toFixed(2)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Payment Status:</div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: derivedPaymentStatus === 'PAID' ? '#dcfce7' : derivedPaymentStatus === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
                      color: derivedPaymentStatus === 'PAID' ? '#166534' : derivedPaymentStatus === 'PARTIAL' ? '#92400e' : '#991b1b'
                    }}
                  >
                    {derivedPaymentStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Employee Remarks */}
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label htmlFor="order-remarks" className="form-label">
                Employee Remarks / Deal Notes (Optional)
              </label>
              <textarea
                id="order-remarks"
                className="form-input"
                rows="2"
                placeholder="e.g. Quoted via WhatsApp; customer pickup scheduled for tomorrow afternoon."
                value={employeeRemarks}
                onChange={(e) => setEmployeeRemarks(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="btn-outline"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{ minHeight: '44px', padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ minHeight: '44px', padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
            >
              {isSubmitting ? 'Creating Order...' : 'Create Sales Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
