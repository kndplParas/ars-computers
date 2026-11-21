import { useState, useMemo, useCallback } from 'react'
import { useAdminData } from '../../context/adminDataContext'
import {
  normalizeIndianPhone10Digit,
  formatIndianPhoneDisplay,
  normalizeCustomerEmail,
  detectDuplicateCustomers
} from '../../utils/customerCrmAggregator'

/**
 * ============================================================================
 * ARS Computers — Create Regular Customer Modal
 * ============================================================================
 * Allows authorized staff to register permanent CRM customer profiles without
 * requiring a sales order, enquiry, or repair ticket.
 *
 * Invariants:
 * - Deterministic Indian mobile normalization (10-digit primary identity)
 * - Lowercase trimmed email normalization
 * - Realtime duplicate detection warning before saving
 * - Explicit confirmation: Never silently overwrites existing records
 * ============================================================================
 */
export default function CreateCustomerModal({ isOpen, onClose, onCustomerCreated, existingCustomers = [] }) {
  const { createRegularCustomer } = useAdminData()

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    customer_type: 'Individual',
    gst_number: '',
    address: '',
    notes: ''
  })

  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allowDuplicateBypass, setAllowDuplicateBypass] = useState(false)

  // Realtime candidate for duplicate checking
  const candidate = useMemo(() => ({
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    company: formData.company
  }), [formData.name, formData.phone, formData.email, formData.company])

  // Potential duplicate matches
  const duplicateMatches = useMemo(() => {
    return detectDuplicateCustomers(candidate, existingCustomers)
  }, [candidate, existingCustomers])

  const topDuplicate = duplicateMatches.length > 0 ? duplicateMatches[0] : null

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setFormError(null)
    setAllowDuplicateBypass(false)
  }, [])

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      company: '',
      customer_type: 'Individual',
      gst_number: '',
      address: '',
      notes: ''
    })
    setFormError(null)
    setIsSubmitting(false)
    setAllowDuplicateBypass(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      setFormError('Customer full name is mandatory.')
      return
    }

    const normPhone = formData.phone ? normalizeIndianPhone10Digit(formData.phone) : null
    if (formData.phone && !normPhone) {
      setFormError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).')
      return
    }

    const normEmail = formData.email ? normalizeCustomerEmail(formData.email) : null
    if (formData.email && !normEmail) {
      setFormError('Please enter a valid email address (e.g. customer@example.com).')
      return
    }

    // Require at least one contact channel (phone or email)
    if (!normPhone && !normEmail) {
      setFormError('Please provide at least a mobile number or email address for customer contact.')
      return
    }

    // Guard: Duplicate warning before saving (Requirement 7: Never silently merge or overwrite)
    if (topDuplicate && topDuplicate.confidence >= 90 && !allowDuplicateBypass) {
      setFormError(
        `A customer with ${topDuplicate.reason.toLowerCase()} is already registered: "${topDuplicate.customer.name}". If this is intentionally a separate account, click "Save As Distinct Customer" below.`
      )
      setAllowDuplicateBypass(true)
      return
    }

    setIsSubmitting(true)
    try {
      if (typeof createRegularCustomer !== 'function') {
        throw new Error('Customer creation service is not available.')
      }

      const result = await createRegularCustomer({
        name: trimmedName,
        phone: normPhone,
        email: normEmail,
        company: formData.company.trim(),
        customer_type: formData.customer_type,
        gst_number: formData.gst_number.trim(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        allow_duplicate: allowDuplicateBypass
      })

      if (onCustomerCreated) {
        onCustomerCreated(result)
      }

      handleClose()
    } catch (err) {
      if (err.isDuplicate) {
        setFormError(
          `A customer with matching contact details already exists: "${err.potentialDuplicate?.name}". If this is intentionally a separate account, click "Save As Distinct Customer" below.`
        )
        setAllowDuplicateBypass(true)
      } else {
        setFormError(err.message || 'Failed to save customer profile.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-customer-modal-title">
      <div className="admin-modal-container" style={{ maxWidth: '640px', width: '92%' }}>
        {/* Header */}
        <div className="admin-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <div>
            <h2 id="create-customer-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              👤 Register Regular Customer
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Create a permanent CRM customer record independently of transactions.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={handleClose}
            aria-label="Close customer registration dialog"
            style={{ minHeight: '44px', minWidth: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-modal-body" style={{ padding: '20px', maxHeight: '72vh', overflowY: 'auto' }}>
            {formError && (
              <div
                className="admin-error-banner"
                role="alert"
                style={{
                  background: '#fee2e2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.86rem',
                  marginBottom: '16px'
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            {/* Realtime Duplicate Notice */}
            {topDuplicate && !allowDuplicateBypass && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  color: '#1e40af'
                }}
              >
                💡 <strong>Existing Profile Detected:</strong> {topDuplicate.reason} ({topDuplicate.customer.name}
                {topDuplicate.customer.company ? ` • ${topDuplicate.customer.company}` : ''}).
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="reg-cust-name" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Customer Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="reg-cust-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Mobile Number */}
              <div className="form-group">
                <label htmlFor="reg-cust-phone" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mobile Number (10 Digits)
                </label>
                <input
                  id="reg-cust-phone"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                {formData.phone && (
                  <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Normalized: {normalizeIndianPhone10Digit(formData.phone) ? formatIndianPhoneDisplay(normalizeIndianPhone10Digit(formData.phone)) : '⚠️ Invalid Indian Mobile'}
                  </span>
                )}
              </div>

              {/* Email Address */}
              <div className="form-group">
                <label htmlFor="reg-cust-email" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  id="reg-cust-email"
                  name="email"
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Company / Business Name */}
              <div className="form-group">
                <label htmlFor="reg-cust-company" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Company / Organization Name
                </label>
                <input
                  id="reg-cust-company"
                  name="company"
                  type="text"
                  placeholder="e.g. Apex Technologies Pvt Ltd"
                  value={formData.company}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Customer Type */}
              <div className="form-group">
                <label htmlFor="reg-cust-type" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Customer Type
                </label>
                <select
                  id="reg-cust-type"
                  name="customer_type"
                  value={formData.customer_type}
                  onChange={handleChange}
                  className="form-select"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Individual">Individual / Retail</option>
                  <option value="Commercial">Commercial / Corporate</option>
                  <option value="Government">Government / Public Sector</option>
                  <option value="Dealer / Partner">Dealer / IT Partner</option>
                  <option value="Other">Other Category</option>
                </select>
              </div>

              {/* GST Number */}
              <div className="form-group">
                <label htmlFor="reg-cust-gst" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  GSTIN (If Commercial)
                </label>
                <input
                  id="reg-cust-gst"
                  name="gst_number"
                  type="text"
                  placeholder="e.g. 05AAAAA0000A1Z5"
                  value={formData.gst_number}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Address */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label htmlFor="reg-cust-address" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Premises / Office Address
              </label>
              <textarea
                id="reg-cust-address"
                name="address"
                rows="2"
                placeholder="Full delivery or site address..."
                value={formData.address}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
              />
            </div>

            {/* Internal Notes */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label htmlFor="reg-cust-notes" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Internal CRM Notes (Staff Only)
              </label>
              <textarea
                id="reg-cust-notes"
                name="notes"
                rows="2"
                placeholder="Special business requirements, discount arrangements, or relationship context..."
                value={formData.notes}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="admin-modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{ minHeight: '44px', padding: '8px 16px', borderRadius: '6px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ minHeight: '44px', padding: '8px 20px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <span>Registering...</span>
              ) : allowDuplicateBypass ? (
                <span>Save As Distinct Customer</span>
              ) : (
                <span>Save Regular Customer</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
