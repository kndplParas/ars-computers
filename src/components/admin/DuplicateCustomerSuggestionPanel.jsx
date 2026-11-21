import { useState, useMemo } from 'react'
import { detectDuplicateCustomers } from '../../utils/customerCrmAggregator'

/**
 * ============================================================================
 * ARS Computers — Duplicate Customer Suggestion Panel
 * ============================================================================
 * Surfaces matching existing CRM customer profiles during enquiry and order creation.
 *
 * Strict Principles:
 * 1. Explicit Selection Required: Never silently merges, overwrites, or links.
 * 2. Unobtrusive: Dismissible at any time without blocking form submission.
 * 3. Role-Safe: Displays only authorized preview data without leaking sensitive financials.
 * 4. High-Touch Accessibility: Minimum 44px touch targets for mobile/tablet staff.
 * ============================================================================
 */
export default function DuplicateCustomerSuggestionPanel({
  candidate = {},
  existingCustomers = [],
  onSelectCustomer,
  userRole = null,
  className = ''
}) {
  const [dismissedId, setDismissedId] = useState(null)

  // Compute potential matches against existing CRM directory
  const matches = useMemo(() => {
    const rawMatches = detectDuplicateCustomers(candidate, existingCustomers)
    if (!dismissedId) return rawMatches
    return rawMatches.filter((m) => m.customer.id !== dismissedId)
  }, [candidate, existingCustomers, dismissedId])

  if (!matches || matches.length === 0) {
    return null
  }

  const topMatch = matches[0]
  const cust = topMatch.customer

  // Role-based PII protection: HR role redacts customer contact PII
  const isHr = (userRole || '').toLowerCase() === 'hr'
  const displayPhone = isHr ? '[REDACTED: HR Privacy Policy]' : cust.formattedPhone
  const displayEmail = isHr ? '[REDACTED: HR Privacy Policy]' : cust.email
  const displayAddress = isHr ? '[REDACTED: HR Privacy Policy]' : cust.address

  return (
    <div
      className={`duplicate-customer-panel ${className}`}
      role="region"
      aria-label="Existing Customer Match Notification"
      style={{
        background: '#f0fdf4',
        border: '1.5px solid #86efac',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }} aria-hidden="true">💡</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534' }}>
            Existing Customer Found ({topMatch.reason})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissedId(cust.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '4px 8px',
            minHeight: '36px',
            minWidth: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          aria-label="Dismiss existing customer suggestion"
          title="Dismiss suggestion"
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: '8px', fontSize: '0.84rem', color: '#1f2937' }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
          {cust.name} {cust.company ? `(${cust.company})` : ''}
        </div>
        <div style={{ color: '#4b5563', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {displayPhone && (
            <span>📱 <strong>{displayPhone}</strong></span>
          )}
          {displayEmail && (
            <span>✉️ {displayEmail}</span>
          )}
          {displayAddress && (
            <span>📍 {displayAddress}</span>
          )}
        </div>

        {/* Existing Activity Tags */}
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {cust.isRegularCustomer && (
            <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🏷️ Regular Customer
            </span>
          )}
          {cust.isRepeatCustomer && (
            <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              ⭐ Repeat ({cust.totalOrders} orders, {cust.totalEnquiries} enquiries)
            </span>
          )}
          {cust.hasActiveEnquiry && (
            <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              ⚡ Active Service Ticket
            </span>
          )}
        </div>
      </div>

      {/* Explicit Actions (Requirement 7: Never silently merge) */}
      <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onSelectCustomer && onSelectCustomer(cust)}
          style={{
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)'
          }}
        >
          <span>✓</span>
          <span>Use Existing Customer Details</span>
        </button>

        <button
          type="button"
          onClick={() => setDismissedId(cust.id)}
          style={{
            background: '#ffffff',
            color: '#475569',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          Keep as Separate / New
        </button>
      </div>
    </div>
  )
}
