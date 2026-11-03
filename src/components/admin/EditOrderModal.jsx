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
 * - Sticky/Fixed modal footer with prominent Save Changes and Cancel buttons
 * ============================================================================
 */
export default function EditOrderModal({ isOpen, onClose, order, onOrderUpdated }) {
  const {
    products = [],
    staff = [],
    updateSalesOrder,
    loadAdminCatalog,
    adminUser,
    isSuperadmin
  } = useAdminData()

  // Technical staff eligible for assignment
  const technicalStaff = useMemo(() => {
    return (staff || []).filter(
      (s) => s.is_active !== false && ['engineer', 'technical', 'admin', 'superadmin'].includes(s.role)
    )
  }, [staff])

  // Permission & Approval Invariant Resolution
  const userRole = (adminUser?.role || '').toLowerCase()
  const isAuthorizedRole = ['superadmin', 'hr', 'account', 'accountant', 'technical'].includes(userRole)
  const isApproved = Boolean(order?.completion_approved_at || order?.status === 'completed')
  const canUserEdit = isSuperadmin || (!isApproved && isAuthorizedRole)

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
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState('pending')
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
        setPaymentMethod(order.payment_method || 'cash')
        setPaidAmount(Number(order.paid_amount) || 0)
        setPaymentStatus(order.payment_status || 'pending')
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
  const numPaid = Math.max(0, Number(paidAmount) || 0)
  const balance = Math.max(0, calculatedTotal - numPaid)

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

    // Strict Role and Super Admin Approval Invariant
    if (!canUserEdit) {
      if (isApproved) {
        setFormError('Order has been approved by Super Admin. Editing is restricted to Superadministrators.')
      } else {
        setFormError('Access denied: Order editing is restricted to HR, Accountant, and Technical roles.')
      }
      return
    }

    // Flexible Payment Editing: Allow adjusting payment forward or backward freely up to order total
    let finalPaid = Math.max(0, Number(paidAmount) || 0)
    if (finalPaid > calculatedTotal) {
      finalPaid = calculatedTotal
      setPaidAmount(calculatedTotal)
    }

    let finalPaymentStatus = paymentStatus
    if (calculatedTotal === 0) {
      finalPaymentStatus = 'paid'
    } else if (finalPaid === 0) {
      finalPaymentStatus = 'pending'
    } else if (finalPaid >= calculatedTotal) {
      finalPaymentStatus = 'paid'
    } else {
      finalPaymentStatus = 'partial'
    }

    setIsSubmitting(true)
    try {
      const formattedItems = items.map((it) => ({
        product_id: it.product_id || null,
        product_name: it.product_name.trim(),
        brand: it.brand || '',
        model: it.model || '',
        sku: it.sku || '',
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
        payment_method: paymentMethod,
        paid_amount: finalPaid,
        payment_status: finalPaymentStatus,
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
          width: 'min(920px, calc(100vw - 20px))',
          maxHeight: 'min(92vh, calc(100dvh - 24px))',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          className="admin-modal-header"
          style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div>
            <h2 id="edit-order-title" className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '1.2rem', margin: 0 }}>
              <span>Edit Order</span>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  border: '1px solid #bfdbfe'
                }}
              >
                {order.order_number}
              </span>
              {isApproved && isSuperadmin && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                  ⚠️ Super Admin Correction
                </span>
              )}
              {isApproved && !isSuperadmin && (
                <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                  🔒 Approved — Editing Restricted
                </span>
              )}
              {!isApproved && (
                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                  ⏳ Awaiting Super Admin Approval
                </span>
              )}
            </h2>
            <span className="modal-subtitle-note" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Update customer details, line items, assigned engineer, and delivery schedule.
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close edit order modal"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Container with strict flex column layout */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
            margin: 0
          }}
        >
          {/* Scrollable Form Body */}
          <div
            className="admin-modal-body"
            style={{
              overflowY: 'auto',
              flex: '1 1 auto',
              minHeight: 0,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              background: '#ffffff'
            }}
          >
            {/* Permission Restriction Warning Banner */}
            {!canUserEdit && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: isApproved ? '#f8fafc' : '#fef2f2',
                  border: isApproved ? '1px solid #cbd5e1' : '1px solid #fecaca',
                  borderRadius: '8px',
                  color: isApproved ? '#475569' : '#b91c1c',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{isApproved ? '🔒' : '🚫'}</span>
                <div>
                  <strong>{isApproved ? 'Approved — Editing Restricted:' : 'Read-Only Access:'}</strong>{' '}
                  {isApproved
                    ? 'This order has been explicitly approved by the Super Admin. Core workflow and financial records are locked against ordinary edits.'
                    : 'Order editing prior to Super Admin approval is permitted exclusively for HR, Accountant, and Technical roles.'}
                </div>
              </div>
            )}

            {formError && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Customer & Contact Details */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <h3
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#475569',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>1. Customer & Contact Details</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer or Business Name"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Primary Contact Info <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Phone number or primary email"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Site / Delivery Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Building, street, locality, city, pincode"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Logistics & Assignment */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <h3
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#475569',
                  marginBottom: '12px'
                }}
              >
                2. Staff Assignment & Schedule
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Assigned Engineer / Technician
                  </label>
                  <select
                    value={assignedEngineerId}
                    onChange={(e) => setAssignedEngineerId(e.target.value)}
                    className="form-select"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Expected Delivery / Completion Date
                  </label>
                  <input
                    type="datetime-local"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Order Items */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#475569',
                    margin: 0
                  }}
                >
                  3. Order Items ({items.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn-outline btn-sm"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#2563eb',
                    borderColor: '#bfdbfe',
                    background: '#eff6ff',
                    cursor: 'pointer',
                    borderRadius: '6px'
                  }}
                >
                  + Add Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Item #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '3px' }}>
                          Select Catalog Product
                        </label>
                        <select
                          value={it.product_id || ''}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '6px', background: '#f8fafc' }}
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
                          placeholder="Product description / Custom hardware name"
                          value={it.product_name}
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '3px' }}>
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '3px' }}>
                          Unit Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginBottom: '3px' }}>
                          Line Total
                        </label>
                        <div
                          style={{
                            padding: '6px 10px',
                            background: '#f1f5f9',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.8rem',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#1e293b'
                          }}
                        >
                          ₹{((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Financial Adjustments & Summary */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Discount Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Tax Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Subtotal: ₹{calculatedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span style={{ margin: '0 8px' }}>•</span>
                  <span>Received So Far: ₹{numPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Order Total:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                    ₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: balance > 0 ? '#b45309' : '#15803d',
                      background: balance > 0 ? '#fef3c7' : '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    Bal: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5: Payment Details & Settlement */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                5. PAYMENT DETAILS & SETTLEMENT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={!canUserEdit || isSubmitting}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                    <option value="card">Card Payment</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other / Store Credit</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                      Amount Received (₹) *
                    </label>
                    {canUserEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaidAmount(calculatedTotal)
                          setPaymentStatus('paid')
                        }}
                        style={{ fontSize: '0.75rem', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        Received in Full
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={calculatedTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      setPaidAmount(val)
                      const num = Math.max(0, Number(val) || 0)
                      if (num === 0) setPaymentStatus('pending')
                      else if (num >= calculatedTotal) setPaymentStatus('paid')
                      else setPaymentStatus('partial')
                    }}
                    disabled={!canUserEdit || isSubmitting}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    disabled={!canUserEdit || isSubmitting}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Received</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 6: Remarks & Operational Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Employee Remarks / Internal Work Notes
                </label>
                <textarea
                  rows="2"
                  value={employeeRemarks}
                  onChange={(e) => setEmployeeRemarks(e.target.value)}
                  placeholder="Internal notes regarding hardware specs, customer instructions, or delivery..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Order Status
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                >
                  <option value="new">New</option>
                  <option value="processing">Processing</option>
                  <option value="completion_requested">Completion Requested</option>
                  {order.status === 'completed' && <option value="completed">Completed (Locked)</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Sticky/Fixed Modal Footer — ALWAYS visible at the bottom of the dialog */}
          <div
            className="admin-modal-footer"
            style={{
              flexShrink: 0,
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#f8fafc',
              position: 'relative',
              zIndex: 10
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-outline"
              style={{
                minHeight: '40px',
                padding: '8px 18px',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canUserEdit || isSubmitting}
              className="btn-primary"
              style={{
                minHeight: '40px',
                minWidth: '140px',
                padding: '8px 22px',
                fontSize: '0.875rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                background: !canUserEdit ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                boxShadow: !canUserEdit ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                cursor: !canUserEdit || isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isSubmitting ? 0.7 : 1
              }}
              title={
                !canUserEdit
                  ? (isApproved ? 'Approved — Editing Restricted' : 'Read-Only: Restricted to HR, Accountant, and Technical roles')
                  : 'Save all changes to this order'
              }
            >
              {isSubmitting ? (
                <>
                  <svg
                    style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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
