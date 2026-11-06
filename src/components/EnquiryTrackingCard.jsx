import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ARS_SALES_DISPLAY_NUMBER, ARS_SALES_TEL_HREF } from '../lib/contact'

const TRACKING_STAGES = [
  { key: 'received', label: 'RECEIVED', icon: '📥', className: 'received' },
  { key: 'in_progress', label: 'IN PROGRESS', icon: '🔧', className: 'in_progress' },
  { key: 'needs_info', label: 'NEED MORE INFO', icon: '❓', className: 'needs_info' },
  { key: 'completed', label: 'COMPLETED', icon: '✓', className: 'completed' }
]

const STATUS_ORDER = {
  received: 0,
  in_progress: 1,
  needs_info: 2,
  completed: 3
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default function EnquiryTrackingCard() {
  const [enquiryId, setEnquiryId] = useState('')
  const [mobile, setMobile] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isLoading) return

    const cleanId = enquiryId.trim().toUpperCase()
    const cleanMobile = mobile.trim()

    if (!cleanId || !cleanMobile) {
      setError('Please enter both your Enquiry ID and registered mobile number.')
      setResult(null)
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Enquiry tracking is temporarily unavailable. Please contact ARS Computers and share your Enquiry ID.')
      setResult(null)
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: lookupError } = await supabase.rpc('track_enquiry', {
        p_enquiry_id: cleanId,
        p_registered_mobile: cleanMobile
      })

      if (lookupError) {
        setError('Invalid enquiry ID or registered mobile number.')
        return
      }

      const payload = Array.isArray(data) ? data[0] : data
      if (!payload || !payload.enquiry_number) {
        setError('Invalid enquiry ID or registered mobile number.')
        return
      }

      setResult(payload)
    } catch (lookupError) {
      console.warn('Enquiry tracking lookup failed:', lookupError)
      setError('Invalid enquiry ID or registered mobile number.')
    } finally {
      setIsLoading(false)
    }
  }

  const activeStage = result ? STATUS_ORDER[result.tracking_status] ?? 0 : -1

  return (
    <aside className="enquiry-tracking-card" aria-labelledby="track-enquiry-title">
      <div className="tracking-card-heading">
        <div className="tracking-icon" aria-hidden="true">🔎</div>
        <div>
          <h4 id="track-enquiry-title">Track Your Enquiry</h4>
          <p>Check the latest progress of your enquiry or service request.</p>
        </div>
      </div>

      <form className="enquiry-tracking-form" onSubmit={handleSubmit}>
        <label className="tracking-field-label" htmlFor="tracking-enquiry-id">
          Enquiry ID
        </label>
        <input
          id="tracking-enquiry-id"
          name="enquiry_id"
          className="tracking-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          placeholder="ARS-ENQ-00000"
          value={enquiryId}
          onChange={(event) => setEnquiryId(event.target.value.toUpperCase())}
          aria-describedby="tracking-help"
          required
        />

        <label className="tracking-field-label" htmlFor="tracking-mobile-number">
          Registered Mobile Number
        </label>
        <input
          id="tracking-mobile-number"
          name="registered_mobile"
          className="tracking-input tracking-phone-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={18}
          placeholder="98765 43210"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          aria-describedby="tracking-help"
          required
        />

        <button
          type="submit"
          className="tracking-submit-btn"
          disabled={isLoading || !enquiryId.trim() || !mobile.trim()}
        >
          {isLoading ? 'Checking…' : 'Track Status'}
        </button>

        <span id="tracking-help" className="tracking-help-text">
          Only an Enquiry ID and the mobile number used for the enquiry will be accepted.
        </span>

        {error && (
          <p className="tracking-error" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="tracking-result-card" aria-live="polite">
          <div className="tracking-result-header">
            <div>
              <span className="tracking-result-label">Enquiry ID</span>
              <strong className="tracking-result-id">{result.enquiry_number}</strong>
            </div>
            <span className={`tracking-status-chip ${TRACKING_STAGES[activeStage]?.className || 'received'}`}>
              {TRACKING_STAGES[activeStage]?.icon} {TRACKING_STAGES[activeStage]?.label || 'RECEIVED'}
            </span>
          </div>

          <div className="tracking-result-grid">
            <div>
              <span>Subject / Service</span>
              <strong>{result.subject || 'Sales Enquiry'}</strong>
            </div>
            <div>
              <span>Submitted On</span>
              <strong>{formatDateTime(result.submitted_at)}</strong>
            </div>
            <div>
              <span>Last Updated</span>
              <strong>{formatDateTime(result.last_updated_at)}</strong>
            </div>
          </div>

          <ol className="tracking-stage-progress" aria-label="Enquiry progress">
            {TRACKING_STAGES.map((stage, index) => {
              const state = index < activeStage ? 'complete' : index === activeStage ? 'active' : 'pending'
              return (
                <li
                  key={stage.key}
                  className={`tracking-stage ${stage.className} ${state}`}
                  aria-current={index === activeStage ? 'step' : undefined}
                >
                  <span className="tracking-stage-icon" aria-hidden="true">
                    {index < activeStage ? '✓' : stage.icon}
                  </span>
                  <span className="tracking-stage-label">{stage.label}</span>
                </li>
              )
            })}
          </ol>

          <p className="tracking-status-explanation">{result.status_explanation}</p>

          {result.tracking_status === 'needs_info' && (
            <div className="tracking-needs-info" role="status">
              <strong>We need a little more detail.</strong>
              <p>
                Please contact ARS Computers by phone or through your existing enquiry channel and quote{' '}
                <strong>{result.enquiry_number}</strong>.
              </p>
              <a className="tracking-contact-link" href={ARS_SALES_TEL_HREF}>
                📞 Call {ARS_SALES_DISPLAY_NUMBER}
              </a>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
