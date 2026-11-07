import { useCallback, useEffect, useRef, useState } from 'react'
import { ARS_SALES_DISPLAY_NUMBER, ARS_SALES_TEL_HREF } from '../lib/contact'

/**
 * ARS Computers — Customer enquiry tracking (Services page card)
 *
 * Flow: enter registered email OR mobile → OTP verification (code is sent to
 * the enquiry's registered email by the server Worker) → list of ALL enquiries
 * belonging to the verified customer → per-enquiry detail with the actual
 * live database status, assigned engineer's approved details and visit
 * schedule.
 *
 * Security:
 *  - No enquiry is ever shown without a server-verified session token.
 *  - The session token lives only in React state (memory) — never in browser
 *    web storage. A page refresh simply requires re-verification.
 *  - All statuses, engineer names and schedules come from the live database
 *    via the Worker → service-role RPC chain. Nothing is hardcoded here.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again or contact ARS Computers for help.'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Static instructional copy shown at the code-entry step. It describes how OTP
// verification works (email-based, never SMS) and does not claim that any
// specific delivery succeeded — the serverWorker keeps its generic response,
// so nothing here reveals whether a contact is registered.
const OTP_DELIVERY_EMAIL = 'Your verification code will be sent to your registered email address.'
const OTP_DELIVERY_MOBILE =
  'Your verification code will be sent to the email address registered with this mobile number. We do not currently send OTPs by SMS.'

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatVisitTime(value) {
  if (!value) return null
  // expected_arrival is a text field such as "11:00 AM" — display as-is.
  const text = String(value).trim()
  return text || null
}

const STATUS_CHIP_CLASS = {
  'Enquiry Received': 'received',
  'Under Review': 'received',
  'In Progress': 'in_progress',
  'Engineer Assigned': 'in_progress',
  'Visit Scheduled': 'in_progress',
  'Waiting for Customer': 'needs_info',
  'Service Completed': 'completed',
  'Closed': 'completed'
}

const STATUS_ICONS = {
  'Enquiry Received': '📥',
  'Under Review': '🔍',
  'In Progress': '🔧',
  'Engineer Assigned': '👷',
  'Visit Scheduled': '📅',
  'Waiting for Customer': '❓',
  'Service Completed': '✅',
  'Closed': '🔒'
}

const TRACK_EMPTY_ENGINEER =
  'Engineer not assigned yet. Our team will update you once an engineer is assigned.'
const TRACK_EMPTY_VISIT = 'Visit schedule is not available yet.'

const VISIT_STATUS_LABELS = {
  scheduled: 'Visit Scheduled',
  in_progress: 'Engineer Visit In Progress',
  completed: 'Visit Completed',
  cancelled: 'Visit Cancelled'
}

function TimelineEntry({ entry }) {
  const [open, setOpen] = useState(false)
  const kindIcon =
    entry.kind === 'engineer_contact'
      ? '📞'
      : entry.kind === 'visit'
        ? '📅'
        : entry.kind === 'note'
          ? '📝'
          : '📶'
  const mainText =
    entry.status && entry.status !== 'note'
      ? STATUS_ICONS[entry.status] ? `${STATUS_ICONS[entry.status]} ${entry.status}` : entry.status
      : null
  const hasValueChange =
    entry.kind && entry.kind !== 'status' &&
    (entry.previous_value !== undefined || entry.new_value !== undefined)

  return (
    <li className="tracking-timeline-item">
      <div className="tracking-timeline-main">
        <strong>{kindIcon} {entry.updated_by || 'ARS Team'}</strong>
        {mainText && <span className="tracking-timeline-status">{mainText}</span>}
        {hasValueChange && (
          <span className="tracking-timeline-change">
            {entry.previous_value ? String(entry.previous_value) : 'Not set'}
            {' → '}
            {entry.new_value ? String(entry.new_value) : 'Not set'}
          </span>
        )}
        <span className="tracking-timeline-date">{formatDateTime(entry.at) || '—'}</span>
        {!open && entry.kind === 'note' && entry.new_value && (
          <button type="button" className="tracking-timeline-toggle" onClick={() => setOpen(true)}>
            Show note
          </button>
        )}
        {open && entry.kind === 'note' && (
          <>
            <button type="button" className="tracking-timeline-toggle" onClick={() => setOpen(false)}>
              Hide note
            </button>
            <p className="tracking-timeline-note">{entry.new_value}</p>
          </>
        )}
      </div>
    </li>
  )
}

function EnquiryDetail({ enquiry, onBack }) {
  const statusLabel = enquiry.status_label || 'In Progress'
  const needsCustomer = statusLabel === 'Waiting for Customer'
  const engineer = enquiry.assigned_employee_name
    ? {
        name: enquiry.assigned_employee_name,
        contact: enquiry.engineer_contact_display
          ? String(enquiry.engineer_contact_display).trim() || null
          : null
      }
    : null
  const expectedVisit = formatDate(enquiry.expected_visit_at)
  const expectedArrival = formatVisitTime(enquiry.expected_arrival)
  const visitStatusLabel = enquiry.visit_status ? VISIT_STATUS_LABELS[enquiry.visit_status] || null : null
  const timeline = Array.isArray(enquiry.timeline) ? enquiry.timeline : []

  return (
    <div className="tracking-result-card">
      <button type="button" className="tracking-back-link" onClick={onBack}>
        ← Back to my enquiries
      </button>

      <div className="tracking-result-header">
        <span className="tracking-result-label">Current Status</span>
        <button type="button" className={`tracking-status-chip ${STATUS_CHIP_CLASS[statusLabel] || 'in_progress'}`}>
          {STATUS_ICONS[statusLabel] || '🔧'} {statusLabel}
        </button>
      </div>

      <div className="tracking-result-grid">
        <div>
          <span>Enquiry</span>
          <strong>#{enquiry.enquiry_number || '—'}</strong>
        </div>
        <div>
          <span>Submitted</span>
          <strong>{formatDate(enquiry.submitted_at) || '—'}</strong>
        </div>
        <div>
          <span>Last Updated</span>
          <strong>{formatDate(enquiry.updated_at) || '—'}</strong>
        </div>
      </div>

      <div className="tracking-desc">
        <strong>Description</strong>
        <p>{enquiry.description || enquiry.subject || '—'}</p>
      </div>

      <p className="tracking-status-explanation">{enquiry.status_explanation && <>{enquiry.status_explanation}</>}</p>

      {needsCustomer && (
        <div className="tracking-needs-info">
          <p>
            Please contact ARS Computers at{' '}
            <a href={ARS_SALES_TEL_HREF} className="tracking-contact-link">{ARS_SALES_DISPLAY_NUMBER}</a>{' '}
            so we can continue with your request.
          </p>
        </div>
      )}

      <div className="tracking-section">
        <strong>Assigned Engineer</strong>
        {engineer ? (
          <div className="tracking-engineer-box">
            <span>👤 <strong>{engineer.name}</strong></span>
            <span>
              {engineer.contact
                ? <>📞 <a href={`tel:${engineer.contact.replace(/[^0-9+]/g, '')}`} className="tracking-contact-link">{engineer.contact}</a></>
                : '📞 Contact number not yet available.'}
            </span>
          </div>
        ) : (
          <p className="tracking-fallback">{TRACK_EMPTY_ENGINEER}</p>
        )}
      </div>

      <div className="tracking-section">
        <strong>Expected Visit</strong>
        {expectedVisit || expectedArrival || visitStatusLabel ? (
          <div className="tracking-visit-box">
            {expectedVisit ? <span>📅 {expectedVisit}</span> : <span>{TRACK_EMPTY_VISIT}</span>}
            <span>
              {expectedArrival
                ? <>⏱️ Expected Arrival: {expectedArrival}</>
                : '⏱️ Expected arrival time will be confirmed.'}
            </span>
            {visitStatusLabel && <span>🛠️ {visitStatusLabel}</span>}
            {enquiry.service_completed_at && statusLabel === 'Service Completed' && (
              <span>✅ Completed on {formatDate(enquiry.service_completed_at)}</span>
            )}
            {enquiry.visit_progress_note && <span className="tracking-visit-note">📝 {enquiry.visit_progress_note}</span>}
          </div>
        ) : (
          <p className="tracking-fallback">{TRACK_EMPTY_VISIT}</p>
        )}
      </div>

      {timeline.length > 0 && (
        <div className="tracking-section">
          <strong>Recent Updates</strong>
          <ul className="tracking-timeline">
            {timeline.map((entry, index) => (
              <TimelineEntry key={`${entry.at || 'entry'}-${index}`} entry={entry} />
            ))}
          </ul>
          <p className="tracking-timeline-hint">Showing the latest updates. More history is kept by our team.</p>
        </div>
      )}
    </div>
  )
}

export default function EnquiryTrackingCard() {
  const [step, setStep] = useState('contact') // contact | otp | list | detail
  const [contact, setContact] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [sessionToken, setSessionToken] = useState(null)
  const [enquiries, setEnquiries] = useState([])
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [resendIn, setResendIn] = useState(0)
  const cooldownRef = useRef(null)

  const startCooldown = useCallback(() => {
    setResendIn(30)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current)
  }, [])

  const isEmail = EMAIL_PATTERN.test(contact.trim())
  const contactValid = isEmail || contact.replace(/[^0-9]/g, '').length >= 10

  const requestCode = async () => {
    if (!contactValid) return
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/tracking/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim() })
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.success) {
        setError(payload.error || GENERIC_ERROR)
        return
      }

      // The generic response reveals nothing about whether the contact is
      // registered — the verification inbox message carries the same wording.
      setStep('otp')
      setOtpCode('')
      setNotice(payload.message || GENERIC_ERROR)
      startCooldown()
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    const digits = otpCode.replace(/[^0-9]/g, '')
    if (digits.length < 4) {
      setError('Please enter the verification code from your email.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/tracking/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim(), code: digits })
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.success || !payload.sessionToken) {
        setError(payload.error || GENERIC_ERROR)
        return
      }

      setSessionToken(payload.sessionToken)
      setStep('list')
      setNotice(null)
      await loadEnquiries(payload.sessionToken)
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const loadEnquiries = async (token) => {
    const effectiveToken = token || sessionToken

    if (!effectiveToken) {
      setStep('contact')
      setSessionToken(null)
      setEnquiries([])
      return []
    }

    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/tracking/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: effectiveToken })
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.success) {
        // Session expired / revoked server-side — require verification again.
        setNotice(payload.error || null)
        setSessionToken(null)
        setEnquiries([])
        setStep('contact')
        return []
      }

      setEnquiries(Array.isArray(payload.enquiries) ? payload.enquiries : [])
      return payload.enquiries || []
    } catch {
      setError(GENERIC_ERROR)
      return []
    } finally {
      setBusy(false)
    }
  }

  const openDetail = (enquiry) => {
    setSelectedEnquiry(enquiry)
    setStep('detail')
  }

  const resetFlow = (options = {}) => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current)
      cooldownRef.current = null
    }
    setSessionToken(null)
    setEnquiries([])
    setSelectedEnquiry(null)
    setStep(options.backToContact === false ? 'otp' : 'contact')
    setOtpCode('')
    setNotice(null)
    setError(null)
    if (options.keepContact !== true) {
      setContact('')
    }
  }

  return (
    <section className="enquiry-tracking-card" aria-label="Track your enquiry">
      <div className="tracking-card-heading">
        <span className="tracking-icon" aria-hidden="true">🔎</span>
        <div>
          <h4>Track Your Enquiry</h4>
          <p>Verify your registered email or mobile number to view all your enquiries.</p>
        </div>
      </div>

      {error && <p className="tracking-error">⚠️ {error}</p>}

      {step === 'contact' && (
        <>
          <div className="enquiry-tracking-form">
            <label className="tracking-field-label" htmlFor="tracking-contact-input">
              Registered Email or Mobile Number
            </label>
            <input
              id="tracking-contact-input"
              type="text"
              className="tracking-input"
              placeholder="e.g. name@example.com or 98XXXXXXXX"
              value={contact}
              maxLength={254}
              onChange={(event) => setContact(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && contactValid && !busy) requestCode()
              }}
            />
            <button
              type="button"
              className="tracking-submit-btn"
              onClick={requestCode}
              disabled={busy || !contactValid}
            >
              {busy ? 'Requesting…' : 'Send Verification Code'}
            </button>
            <p className="tracking-help-text" style={{ fontWeight: 600, color: '#334155' }}>
              A one-time code will be sent to the registered email address on your enquiry.
            </p>
          </div>
          {notice && <p className="tracking-help-text">{notice}</p>}
        </>
      )}

      {step === 'otp' && (
        <div className="enquiry-tracking-form">
          <p className="tracking-help-text" style={{ marginTop: 0 }}>
            {EMAIL_PATTERN.test(contact.trim()) ? OTP_DELIVERY_EMAIL : OTP_DELIVERY_MOBILE}
          </p>
          <label className="tracking-field-label" htmlFor="tracking-otp-input">
            Verification Code
          </label>
          <input
            id="tracking-otp-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="tracking-input tracking-otp-input"
            placeholder="••••••"
            value={otpCode}
            maxLength={6}
            onChange={(event) => setOtpCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && otpCode.length >= 4 && !busy) verifyCode()
            }}
          />
          <button
            type="button"
            className="tracking-submit-btn"
            onClick={verifyCode}
            disabled={busy || otpCode.replace(/[^0-9]/g, '').length < 4}
          >
            {busy ? 'Verifying…' : 'Verify & View My Enquiries'}
          </button>
          <div className="tracking-otp-actions">
            <button
              type="button"
              className="tracking-link-btn"
              onClick={() => {
                resetFlow({ backToContact: false, keepContact: true })
                requestCode()
              }}
              disabled={busy || resendIn > 0}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
            <button type="button" className="tracking-link-btn" onClick={() => resetFlow({ keepContact: false })}>
              Change contact details
            </button>
          </div>
        </div>
      )}

      {step === 'list' && (
        <div className="tracking-enquiry-list">
          <div className="tracking-list-header">
            <strong>Your Enquiries ({enquiries.length})</strong>
            <button
              type="button"
              className="tracking-link-btn"
              onClick={() => {
                setStep('contact')
                setSessionToken(null)
                setEnquiries([])
                setNotice(null)
              }}
              disabled={busy}
            >
              Log out
            </button>
          </div>

          {enquiries.length === 0 ? (
            <p className="tracking-fallback">
              No enquiries were found for your verified contact details. If you have recently submitted a
              request, our team will register it shortly. You can also call{' '}
              <a href={ARS_SALES_TEL_HREF} className="tracking-contact-link">{ARS_SALES_DISPLAY_NUMBER}</a>.
            </p>
          ) : (
            enquiries.map((enquiry) => {
              const statusLabel = enquiry.status_label
              return (
                <button
                  key={enquiry.enquiry_id}
                  type="button"
                  className="tracking-enquiry-item"
                  onClick={() => openDetail(enquiry)}
                >
                  <div className="tracking-enquiry-item-top">
                    <strong>#{enquiry.enquiry_number || '—'}</strong>
                    <span className={`tracking-status-chip ${STATUS_CHIP_CLASS[statusLabel] || 'in_progress'}`}>
                      {STATUS_ICONS[statusLabel] || '🔧'} {statusLabel}
                    </span>
                  </div>
                  <span className="tracking-enquiry-subject">{enquiry.subject || 'General Enquiry'}</span>
                  <span className="tracking-enquiry-meta">
                    Submitted {formatDate(enquiry.submitted_at) || '—'} • Updated {formatDate(enquiry.updated_at) || '—'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}

      {step === 'detail' && selectedEnquiry && (
        <EnquiryDetail
          enquiry={selectedEnquiry}
          onBack={async () => {
            setSelectedEnquiry(null)
            setStep('list')
            await loadEnquiries()
          }}
        />
      )}
    </section>
  )
}
