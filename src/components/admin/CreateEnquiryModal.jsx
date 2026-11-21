import { useState, useMemo, useCallback } from 'react'
import { useAdminData } from '../../context/adminDataContext'
import { useAdminAuth } from '../../context/adminAuthContext'
import DuplicateCustomerSuggestionPanel from './DuplicateCustomerSuggestionPanel'
import { aggregateCustomers, normalizeIndianPhone10Digit, normalizeCustomerEmail } from '../../utils/customerCrmAggregator'
import { SERVICE_CATEGORY_GROUPS } from '../../data/mockServiceRequests'

const CUSTOMER_TYPES = ['Individual', 'Commercial', 'Government', 'Dealer / Partner', 'Other']

/**
 * ============================================================================
 * ARS Computers — Create Customer Enquiry Modal (Admin Console)
 * ============================================================================
 * Allows authorized staff (Superadmin, Admin, Account, Technical, Engineer, HR)
 * to manually log new customer enquiries and service leads (e.g. walk-ins, phone calls).
 *
 * Invariants:
 * 1. Role-Enforced: Inventory staff cannot create enquiries.
 * 2. Duplicate Detection: Integrates DuplicateCustomerSuggestionPanel without secondary matching systems.
 * 3. Anti-Silent Merge: Never silently overwrites or blocks enquiry creation.
 * 4. PII Protection: Respects caller role; HR role redacts customer contact info in suggestions.
 * ============================================================================
 */
export default function CreateEnquiryModal({ isOpen, onClose, onEnquiryCreated }) {
  const { adminUser } = useAdminAuth()
  const {
    enquiries = [],
    orders = [],
    regularCustomers = [],
    createAdminEnquiry,
    loadAdminEnquiries
  } = useAdminData()

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [customerType, setCustomerType] = useState('Individual')
  const [categoryInterest, setCategoryInterest] = useState('Desktop Computer')
  const [serviceLocation, setServiceLocation] = useState('In-shop')
  const [siteAddress, setSiteAddress] = useState('')
  const [message, setMessage] = useState('')
  const [preferredVisitDate, setPreferredVisitDate] = useState('')

  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Aggregate existing customers for duplicate suggestions
  const existingCustomers = useMemo(() => {
    return aggregateCustomers({ enquiries, orders, regularCustomers })
  }, [enquiries, orders, regularCustomers])

  // Candidate customer details for duplicate matching
  const candidate = useMemo(() => ({
    name: customerName,
    phone: mobileNumber,
    email: email,
    company: company
  }), [customerName, mobileNumber, email, company])

  const resetForm = useCallback(() => {
    setCustomerName('')
    setMobileNumber('')
    setEmail('')
    setCompany('')
    setCustomerType('Individual')
    setCategoryInterest('Desktop Computer')
    setServiceLocation('In-shop')
    setSiteAddress('')
    setMessage('')
    setPreferredVisitDate('')
    setFormError(null)
    setIsSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  if (!isOpen) return null

  const isInventoryStaff = adminUser?.role === 'inventory_staff'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (isInventoryStaff) {
      setFormError('Access Denied: Inventory Staff is restricted from creating customer enquiries.')
      return
    }

    const cleanName = customerName.trim()
    if (!cleanName || cleanName.length < 2) {
      setFormError('Please enter a valid customer full name (minimum 2 characters).')
      return
    }

    const normPhone = normalizeIndianPhone10Digit(mobileNumber)
    if (!normPhone) {
      setFormError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).')
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!cleanEmail || !emailPattern.test(cleanEmail)) {
      setFormError('Valid email address is required. Verification codes and tracking updates are sent to this address.')
      return
    }

    const cleanMessage = message.trim()
    if (!cleanMessage || cleanMessage.length < 5) {
      setFormError('Please provide details of the customer enquiry or hardware requirement (minimum 5 characters).')
      return
    }

    if (serviceLocation === 'On-site' && (!siteAddress || siteAddress.trim().length < 5)) {
      setFormError('Please enter a complete on-site address for technician dispatch.')
      return
    }

    setIsSubmitting(true)
    try {
      const contactInfo = `${normPhone} | ${cleanEmail}`
      const formattedMessage = [
        `Customer Type: ${customerType}`,
        company.trim() ? `Company: ${company.trim()}` : null,
        `Service Mode: ${serviceLocation}`,
        siteAddress.trim() ? `Site Address: ${siteAddress.trim()}` : null,
        preferredVisitDate ? `Preferred Visit Date: ${preferredVisitDate}` : null,
        '',
        '--- Requirement / Symptoms ---',
        cleanMessage
      ].filter(Boolean).join('\n')

      if (typeof createAdminEnquiry === 'function') {
        const result = await createAdminEnquiry({
          customer_name: cleanName,
          contact_info: contactInfo,
          category_interest: categoryInterest,
          message: formattedMessage,
          phone: normPhone,
          email: cleanEmail,
          company: company.trim() || null,
          address: siteAddress.trim() || null,
          service_location: serviceLocation
        })

        if (typeof onEnquiryCreated === 'function') {
          onEnquiryCreated(result)
        }
      } else if (typeof loadAdminEnquiries === 'function') {
        await loadAdminEnquiries()
      }

      handleClose()
    } catch (err) {
      console.error('Failed to create enquiry:', err)
      setFormError(err.message || 'An error occurred while logging the enquiry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-enquiry-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
    >
      <div
        className="admin-modal-dialog"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          className="admin-modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div>
            <h2 id="create-enquiry-modal-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
              ➕ Log New Customer Enquiry
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Record in-shop walk-ins, phone inquiries, and technical repair requests.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            className="admin-modal-body"
            style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1
            }}
          >
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {isInventoryStaff && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: '#92400e'
                }}
              >
                🔒 Inventory Staff accounts have restricted read-only permissions and cannot create customer enquiries.
              </div>
            )}

            {/* 1. Customer Details */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👤 Customer &amp; Contact Details
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '10px' }}>
                <div>
                  <label htmlFor="enq-cust-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="enq-cust-name"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Rajesh Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="enq-cust-phone" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    10-Digit Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="enq-cust-phone"
                    type="tel"
                    className="admin-input"
                    placeholder="e.g. 9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="enq-cust-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="enq-cust-email"
                    type="email"
                    className="admin-input"
                    placeholder="e.g. rajesh@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="enq-cust-company" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Company / Organization
                  </label>
                  <input
                    id="enq-cust-company"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Sharma Enterprises"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="enq-cust-type" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Customer Type
                  </label>
                  <select
                    id="enq-cust-type"
                    className="admin-select"
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  >
                    {CUSTOMER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Duplicate Customer Suggestion Panel (Anti-Silent Merge) */}
            <DuplicateCustomerSuggestionPanel
              candidate={candidate}
              existingCustomers={existingCustomers}
              userRole={adminUser?.role}
              onSelectCustomer={(cust) => {
                if (cust.name) setCustomerName(cust.name)
                if (cust.normalizedPhone) setMobileNumber(cust.normalizedPhone)
                if (cust.email) setEmail(cust.email)
                if (cust.company) setCompany(cust.company)
                if (cust.address) setSiteAddress(cust.address)
                if (cust.customerType) setCustomerType(cust.customerType)
              }}
            />

            {/* 2. Service & Hardware Requirement */}
            <div style={{ marginBottom: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚙️ Hardware Category &amp; Requirement
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '10px' }}>
                <div>
                  <label htmlFor="enq-hardware-cat" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Hardware Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="enq-hardware-cat"
                    className="admin-select"
                    value={categoryInterest}
                    onChange={(e) => setCategoryInterest(e.target.value)}
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  >
                    {SERVICE_CATEGORY_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="enq-service-loc" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Service Mode <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="enq-service-loc"
                    className="admin-select"
                    value={serviceLocation}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  >
                    <option value="In-shop">🏢 In-Shop Carry-In</option>
                    <option value="On-site">🏠 On-Site Field Visit</option>
                  </select>
                </div>

                {serviceLocation === 'On-site' && (
                  <div>
                    <label htmlFor="enq-visit-date" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Preferred Visit Date
                    </label>
                    <input
                      id="enq-visit-date"
                      type="date"
                      className="admin-input"
                      value={preferredVisitDate}
                      onChange={(e) => setPreferredVisitDate(e.target.value)}
                      disabled={isSubmitting || isInventoryStaff}
                      style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                    />
                  </div>
                )}
              </div>

              {serviceLocation === 'On-site' && (
                <div style={{ marginTop: '12px' }}>
                  <label htmlFor="enq-site-address" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    On-Site Visit Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="enq-site-address"
                    type="text"
                    className="admin-input"
                    placeholder="Building, street, landmark, pincode"
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    required={serviceLocation === 'On-site'}
                    disabled={isSubmitting || isInventoryStaff}
                    style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                  />
                </div>
              )}

              <div style={{ marginTop: '12px' }}>
                <label htmlFor="enq-requirement-desc" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Requirement / Fault Symptoms <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  id="enq-requirement-desc"
                  className="admin-input"
                  rows={3}
                  placeholder="Describe customer requirement or hardware problem symptoms observed..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={isSubmitting || isInventoryStaff}
                  style={{ width: '100%', fontSize: '0.86rem', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="admin-modal-footer"
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc'
            }}
          >
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={isSubmitting || isInventoryStaff}
              style={{
                padding: '6px 18px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: '#0284c7',
                borderColor: '#0284c7',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSubmitting ? (
                <>
                  <span>⏳</span>
                  <span>Logging Enquiry…</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Log Customer Enquiry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
