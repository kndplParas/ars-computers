import { useState, useEffect, useMemo } from 'react'
import { useAdminData } from '../../context/adminDataContext'

/**
 * ============================================================================
 * ARS Computers — Edit Sales Order Modal
 * ============================================================================
 * Fully functional order editing modal with atomic database persistence.
 *
 * Capabilities:
 * - Update customer details (Name, Contact Info, Email, Phone, Address)
 * - Dynamic line items: add, remove, change product, quantity, unit price
 * - Discount and Tax adjustments
 * - Engineer assignment and expected delivery date
 * - Employee remarks and status adjustments
 * - Strict financial consistency: prevents reducing total below already collected payment
 * ============================================================================
 */
export default function EditOrderModal({ isOpen, onClose, order, onOrderUpdated }) {
  const {
    products = [],
    staff = [],
    updateSalesOrder,
    loadAdminCatalog
  } = useAdminData()

  // Technical staff eligible for assignment
  const technicalStaff = useMemo(() => {
    return (staff || []).filter(
      (s) => s.is_active !== false && ['engineer', 'technical', 'admin', 'superadmin'].includes(s.role)
    )
  }, [staff])

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [items, setItems] = useState([])
  const [assignedEngineerId, setAssignedEngineerId] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [employeeRemarks, setEmployeeRemarks] = useState('')
  const [orderStatus, setOrderStatus] = useState('new')

  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill form when order opens
  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      if (isOpen && order) {
        setCustomerName(order.customer_name || '')
        setContactInfo(order.contact_info || '')
        setCustomerEmail(order.customer_email || '')
        setCustomerPhone(order.customer_phone || '')
        setCustomerAddress(order.customer_address || '')
        setAssignedEngineerId(order.assigned_engineer_id || '')
        setExpectedDeliveryDate(
          order.expected_delivery_date
            ? new Date(order.expected_delivery_date).toISOString().slice(0, 16)
            : ''
        )
        setDiscountAmount(Number(order.discount_amount) || 0)
        setTaxAmount(Number(order.tax_amount) || 0)
        setEmployeeRemarks(order.employee_remarks || '')
        setOrderStatus(order.status || 'new')

        // Populate line items
        const existingItems = Array.isArray(order.order_items) && order.order_items.length > 0
          ? order.order_items.map((it, idx) => ({
              id: it.id || idx + 1,
              product_id: it.product_id || '',
              product_name: it.product_name_snapshot || it.product_name || '',
              brand: it.brand_snapshot || it.brand || '',
              model: it.model_snapshot || it.model || '',
              sku: it.sku_snapshot || it.sku || '',
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0
            }))
          : [
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
            ]
        setItems(existingItems)
        setFormError(null)
      }
    })
    return () => {
      ignore = true
    }
  }, [isOpen, order])

  // Auto-fetch products if catalog is not loaded
  useEffect(() => {
    if (isOpen && products.length === 0 && loadAdminCatalog) {
      loadAdminCatalog()
    }
  }, [isOpen, products.length, loadAdminCatalog])

  if (!isOpen || !order) return null

  // Calculations
  const calculatedSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  )
  const numDiscount = Math.max(0, Number(discountAmount) || 0)
  const numTax = Math.max(0, Number(taxAmount) || 0)
  const calculatedTotal = Math.max(0, calculatedSubtotal - numDiscount + numTax)
  const paidAmount = Number(order.paid_amount) || 0
  const balance = Math.max(0, calculatedTotal - paidAmount)

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
          unit_price: Number(selected.selling_price) || 0
        }
      })
    )
  }

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it
        return { ...it, [field]: value }
      })
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
    if (items.length <= 1) {
      setFormError('Order must have at least one product.')
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
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

    // Financial check
    if (calculatedTotal < paidAmount) {
      setFormError(
        `Updated total (₹${calculatedTotal.toLocaleString('en-IN')}) cannot be less than already collected payment (₹${paidAmount.toLocaleString('en-IN')}).`
      )
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

      const result = await updateSalesOrder({
        order_id: order.id,
        customer_name: customerName.trim(),
        contact_info: contactInfo.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        assigned_engineer_id: assignedEngineerId || null,
        expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : null,
        employee_remarks: employeeRemarks.trim() || null,
        discount_amount: numDiscount,
        tax_amount: numTax,
        order_status: orderStatus,
        items: formattedItems
      })

      if (onOrderUpdated) {
        onOrderUpdated(result)
      }
      onClose()
    } catch (err) {
      console.error('[EditOrderModal] Failed to update order:', err)
      setFormError(err.message || 'Failed to update order in database.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      style={{ zIndex: 1150 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-order-title"
      onClick={onClose}
    >
      <div
        className="admin-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: 'min(920px, calc(100vw - 24px))',
          maxHeight: 'min(92vh, calc(100dvh - 24px))',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #1e293b'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-800">
          <div>
            <h2 id="edit-order-title" className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Edit Order</span>
              <span className="text-blue-400 font-mono text-sm">{order.order_number}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update customer details, line items, assigned engineer, and delivery schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-start space-x-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Customer Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <span>1. Customer & Contact Details</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Primary Contact Info <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Site / Delivery Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, locality, city, pincode"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Logistics & Assignment */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              2. Staff Assignment & Schedule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned Engineer / Technician
                </label>
                <select
                  value={assignedEngineerId}
                  onChange={(e) => setAssignedEngineerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {technicalStaff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name || st.email} ({st.employee_code || st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expected Delivery / Completion Date
                </label>
                <input
                  type="datetime-local"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Line Items */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                3. Order Items ({items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1"
              >
                <span>+ Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id || idx} className="p-3 bg-slate-850 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] text-slate-400 mb-1">Catalog Product (or Custom)</label>
                      <select
                        value={it.product_id || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 mb-1.5"
                      >
                        <option value="">— Select Catalog Item —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''} — ₹{Number(p.selling_price || 0).toLocaleString('en-IN')}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Product description / Custom name"
                        value={it.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Unit Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 text-right font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2 flex flex-col justify-end">
                      <label className="block text-[11px] text-slate-400 mb-1">Line Total</label>
                      <div className="px-2.5 py-1.5 bg-slate-800/60 border border-slate-750 rounded-lg text-xs text-slate-200 text-right font-mono font-medium">
                        ₹{((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Financial Adjustments & Summary */}
          <div className="p-4 bg-slate-850 border border-slate-800 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Discount Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tax Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-2">
              <div className="text-slate-400 text-xs">
                <span>Subtotal: ₹{calculatedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span className="mx-2">•</span>
                <span>Paid So Far: ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-slate-300 font-semibold">Total Order:</span>
                <span className="text-lg font-bold text-white font-mono">
                  ₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  (Bal: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Remarks & Operational Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Employee Remarks / Work Notes</label>
              <textarea
                rows="2"
                value={employeeRemarks}
                onChange={(e) => setEmployeeRemarks(e.target.value)}
                placeholder="Internal notes regarding hardware, customer instructions, or delivery..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Order Status</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="new">New</option>
                <option value="processing">Processing</option>
                <option value="completion_requested">Completion Requested</option>
                {order.status === 'completed' && <option value="completed">Completed (Locked)</option>}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
