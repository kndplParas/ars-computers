import { useState, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  SERVICE_CATEGORIES,
  CUSTOMER_TYPES,
  REQUEST_TYPES
} from '../data/mockServiceRequests'

export default function CustomerServiceRequestForm({ initialCategory = 'Desktop Computer', onCancel }) {
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    customer_name: '',
    mobile_number: '',
    email: '',
    customer_type: 'Individual',
    product_category: initialCategory,
    brand: '',
    model_number: '',
    serial_number: '',
    purchase_date: '',
    invoice_number: '',
    request_type: 'Repair/Fault Diagnosis',
    problem_description: '',
    service_location: 'On-site',
    site_address: '',
    preferred_visit_date: '',

    // CCTV Specifics
    cctv_camera_count: '',
    cctv_dvr_details: '',
    issue_camera_offline: false,
    issue_remote_viewing: false,
    issue_recording_playback: false,
    issue_cabling: false,
    issue_power: false,
    issue_network: false,

    // PC / Laptop Specifics
    issue_boot_failure: false,
    issue_display: false,
    issue_overheating: false,
    issue_slow_performance: false,
    issue_os_software: false,
    issue_data_recovery: false,
    issue_hardware_replacement: false,

    // Anti-spam honeypot
    website_hp: ''
  })

  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [copied, setCopied] = useState(false)

  const isCctvCategory = ['CCTV Camera', 'DVR/NVR', 'CCTV Complete System'].includes(formData.product_category)
  const isComputerCategory = ['Desktop Computer', 'Laptop'].includes(formData.product_category)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (errorMessage) setErrorMessage(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 5MB validation
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Attachment size exceeds 5 MB. Please choose a smaller file or photo.')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Invalid file format. Allowed formats: JPG, PNG, WEBP, or PDF.')
      return
    }

    setAttachmentFile(file)
    setErrorMessage(null)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setAttachmentPreview(reader.result)
      reader.readAsDataURL(file)
    } else {
      setAttachmentPreview(null)
    }
  }

  const handleRemoveFile = () => {
    setAttachmentFile(null)
    setAttachmentPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validations
    const cleanName = formData.customer_name.trim()
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).')
      return
    }

    const cleanMobile = formData.mobile_number.trim()
    const mobileDigits = cleanMobile.replace(/\D/g, '')
    if (mobileDigits.length < 10 || mobileDigits.length > 15) {
      setErrorMessage('Please enter a valid 10-digit mobile number (e.g. +91 9876543210).')
      return
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!emailRegex.test(formData.email.trim())) {
        setErrorMessage('Please enter a valid email address or leave it blank.')
        return
      }
    }

    const cleanDesc = formData.problem_description.trim()
    if (!cleanDesc || cleanDesc.length < 10) {
      setErrorMessage('Please describe the problem in at least 10 characters so our technicians can prepare spare parts.')
      return
    }

    if (formData.service_location === 'On-site' && (!formData.site_address || formData.site_address.trim().length < 5)) {
      setErrorMessage('Please provide your complete site address for on-site engineer visit.')
      return
    }

    // 1. Anti-spam honeypot detection: Silently discard automated bot submissions
    if (formData.website_hp) {
      setSubmittedTicket({
        ticket_number: `ARS-SR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-8888`,
        customer_name: cleanName,
        product_category: formData.product_category,
        service_location: formData.service_location,
        created_at: new Date().toISOString()
      })
      return
    }

    // 2. Client-side abuse throttling: 30-second cooldown per client session
    const lastSubmissionKey = 'ars_last_service_request_submitted_at'
    const lastSubmitted = Number(sessionStorage.getItem(lastSubmissionKey) || 0)
    const cooldownMs = 30000
    if (Date.now() - lastSubmitted < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (Date.now() - lastSubmitted)) / 1000)
      setErrorMessage(`Please wait ${waitSeconds}s before submitting another service request.`)
      return
    }

    setIsSubmitting(true)

    try {
      let attachmentUrl = null

      // Optional upload if live database & file selected
      if (attachmentFile && isSupabaseConfigured && supabase) {
        try {
          const fileExt = attachmentFile.name.split('.').pop()
          const fileName = `requests/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('service-attachments')
            .upload(fileName, attachmentFile, { cacheControl: '3600', upsert: false })

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('service-attachments')
              .getPublicUrl(uploadData.path)
            attachmentUrl = publicUrlData?.publicUrl || uploadData.path
          }
        } catch (uploadErr) {
          console.warn('Attachment upload skipped or failed:', uploadErr)
        }
      }

      // Prepare conditional device details
      const device_details = {}
      if (isCctvCategory) {
        device_details.camera_count = formData.cctv_camera_count || null
        device_details.dvr_nvr_details = formData.cctv_dvr_details || null
        device_details.issue_camera_offline = formData.issue_camera_offline
        device_details.issue_remote_viewing = formData.issue_remote_viewing
        device_details.issue_recording_playback = formData.issue_recording_playback
        device_details.issue_cabling = formData.issue_cabling
        device_details.issue_power = formData.issue_power
        device_details.issue_network = formData.issue_network
      } else if (isComputerCategory) {
        device_details.issue_boot_failure = formData.issue_boot_failure
        device_details.issue_display = formData.issue_display
        device_details.issue_overheating = formData.issue_overheating
        device_details.issue_slow_performance = formData.issue_slow_performance
        device_details.issue_os_software = formData.issue_os_software
        device_details.issue_data_recovery = formData.issue_data_recovery
        device_details.issue_hardware_replacement = formData.issue_hardware_replacement
      }

      const payload = {
        customer_name: cleanName,
        mobile_number: cleanMobile,
        email: formData.email ? formData.email.trim().toLowerCase() : null,
        customer_type: formData.customer_type,
        product_category: formData.product_category,
        brand: formData.brand.trim() || null,
        model_number: formData.model_number.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        purchase_date: formData.purchase_date || null,
        invoice_number: formData.invoice_number.trim() || null,
        request_type: formData.request_type,
        problem_description: cleanDesc,
        service_location: formData.service_location,
        site_address: formData.site_address.trim() || null,
        preferred_visit_date: formData.preferred_visit_date || null,
        attachment_url: attachmentUrl,
        device_details,
        status: 'new',
        priority: 'medium',
        warranty_status: 'pending_verification'
      }

      const diagnosticItems = []
      if (isCctvCategory) {
        if (formData.cctv_camera_count) diagnosticItems.push(`Cameras: ${formData.cctv_camera_count}`)
        if (formData.issue_camera_offline) diagnosticItems.push('Camera Offline')
        if (formData.issue_remote_viewing) diagnosticItems.push('Remote Viewing Issue')
        if (formData.issue_recording_playback) diagnosticItems.push('Recording/Playback Failure')
        if (formData.issue_cabling) diagnosticItems.push('Cabling / Connector Fault')
        if (formData.issue_power) diagnosticItems.push('Power / Adapter Failure')
        if (formData.issue_network) diagnosticItems.push('Network / Switch Fault')
      } else if (isComputerCategory) {
        if (formData.issue_boot_failure) diagnosticItems.push('Boot Failure / No Power')
        if (formData.issue_display) diagnosticItems.push('Display / Screen Artifacts')
        if (formData.issue_overheating) diagnosticItems.push('Overheating / Loud Fan')
        if (formData.issue_slow_performance) diagnosticItems.push('Slow Performance')
        if (formData.issue_os_software) diagnosticItems.push('OS / Software Crash')
        if (formData.issue_data_recovery) diagnosticItems.push('Data Recovery Needed')
        if (formData.issue_hardware_replacement) diagnosticItems.push('Hardware Replacement')
      }
      const diagnosticSummary = diagnosticItems.length > 0 ? diagnosticItems.join(', ') : 'General Inspection'

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const randId = Math.floor(1000 + Math.random() * 9000)
      const generatedTicketNumber = `ARS-SR-${todayStr}-${randId}`

      // Structured message format preserving 100% of service-specific data
      const formattedMessage = [
        '[SERVICE & REPAIR REQUEST]',
        `• Ticket Ref: ${generatedTicketNumber}`,
        `• Customer Type: ${formData.customer_type}`,
        `• Product: ${formData.product_category} (${formData.request_type})`,
        `• Brand / Model: ${formData.brand.trim() || 'N/A'}${formData.model_number.trim() ? ` / ${formData.model_number.trim()}` : ''}`,
        `• Serial No: ${formData.serial_number.trim() || 'N/A'}${formData.invoice_number.trim() ? ` | Invoice: ${formData.invoice_number.trim()}` : ''}`,
        `• Purchase Date: ${formData.purchase_date || 'N/A'}`,
        `• Location: ${formData.service_location}${formData.site_address.trim() ? ` (${formData.site_address.trim()})` : ''}`,
        `• Preferred Visit Date: ${formData.preferred_visit_date || 'N/A'}`,
        `• Diagnostics: ${diagnosticSummary}`,
        '• Problem Description:',
        cleanDesc,
        attachmentUrl ? `• Attachment: ${attachmentUrl}` : null
      ].filter(Boolean).join('\n')

      const contactInfo = formData.email?.trim()
        ? `${cleanMobile} | ${formData.email.trim().toLowerCase()}`
        : cleanMobile

      const enquiryPayload = {
        name: cleanName,
        contact_info: contactInfo,
        category_interest: `Service: ${formData.product_category}`.slice(0, 50),
        message: formattedMessage,
        status: 'new'
      }

      // Live Supabase submission targeting public.enquiries
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('enquiries')
          .insert([enquiryPayload])

        if (error) {
          throw new Error(error.message || 'Unable to register service enquiry in live database.')
        }

        try {
          sessionStorage.setItem('ars_last_service_request_submitted_at', String(Date.now()))
        } catch {}

        setSubmittedTicket({
          ...payload,
          ticket_number: generatedTicketNumber,
          created_at: new Date().toISOString()
        })
      } else {
        // Local Demo fallback targeting Admin Enquiries storage
        const demoEnquiry = {
          id: `enq-${Date.now()}`,
          name: cleanName,
          customer_name: cleanName,
          contact_info: contactInfo,
          phone: cleanMobile,
          email: formData.email ? formData.email.trim().toLowerCase() : null,
          category_interest: `Service: ${formData.product_category}`.slice(0, 50),
          category_label: `Service: ${formData.product_category}`,
          service_requested: `Service: ${formData.product_category} (${formData.request_type})`,
          message: formattedMessage,
          status: 'new',
          enquiry_type: 'service_request',
          service_details: {
            ...payload,
            ticket_number: generatedTicketNumber
          },
          created_at: new Date().toISOString(),
          is_archived: false,
          is_in_bin: false
        }

        try {
          sessionStorage.setItem('ars_last_service_request_submitted_at', String(Date.now()))
        } catch {}

        try {
          const raw = localStorage.getItem('ars_admin_demo_enquiries_v1')
          const existing = raw ? JSON.parse(raw) : []
          localStorage.setItem(
            'ars_admin_demo_enquiries_v1',
            JSON.stringify([demoEnquiry, ...existing])
          )
        } catch (e) {
          console.warn('Failed to save to demo enquiries storage:', e)
        }

        setSubmittedTicket({
          ...payload,
          ticket_number: generatedTicketNumber,
          created_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Service request submission error:', err)
      setErrorMessage(err.message || 'An unexpected error occurred while booking your service ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyTicket = () => {
    if (submittedTicket?.ticket_number) {
      navigator.clipboard.writeText(submittedTicket.ticket_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // --- Success State Card ---
  if (submittedTicket) {
    return (
      <div className="service-request-success-card">
        <div className="success-icon-badge">✅</div>
        <span className="success-tag">Ticket Registered Successfully</span>
        <h3 className="success-title">Service Request Confirmed</h3>
        <p className="success-subtitle">
          Your service ticket has been logged with the ARS Computers technical support desk. An engineer has been notified.
        </p>

        <div className="ticket-number-display-box">
          <span className="ticket-label">OFFICIAL SERVICE TICKET NUMBER</span>
          <div className="ticket-code-row">
            <span className="ticket-code">{submittedTicket.ticket_number}</span>
            <button
              type="button"
              className="copy-ticket-btn"
              onClick={handleCopyTicket}
              title="Copy Ticket Number to Clipboard"
            >
              {copied ? '✓ Copied' : '📋 Copy ID'}
            </button>
          </div>
          <p className="ticket-help-text">
            Keep this reference code handy for updates, warranty validation, and technician visit coordination.
          </p>
        </div>

        <div className="ticket-summary-grid">
          <div className="summary-item">
            <span className="summary-label">Customer Name</span>
            <span className="summary-val">{submittedTicket.customer_name}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Hardware Category</span>
            <span className="summary-val">{submittedTicket.product_category}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Request Type</span>
            <span className="summary-val">{submittedTicket.request_type}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Service Mode</span>
            <span className="summary-val">{submittedTicket.service_location}</span>
          </div>
        </div>

        <div className="service-next-steps-banner">
          <h4>⏱️ What Happens Next?</h4>
          <ul>
            <li>Our technical coordinator will review diagnosis details and verify warranty coverage.</li>
            <li>You will receive a confirmation call or WhatsApp message within <strong>2 to 4 business hours</strong>.</li>
            <li>For on-site requests, the field engineer will carry required components and tools.</li>
          </ul>
        </div>

        <div className="success-actions-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSubmittedTicket(null)
              setFormData((prev) => ({
                ...prev,
                problem_description: '',
                serial_number: '',
                invoice_number: ''
              }))
            }}
          >
            + Raise Another Request
          </button>
          {onCancel && (
            <button type="button" className="btn-outline" onClick={onCancel}>
              Back to Services
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- Form State ---
  return (
    <div className="service-request-form-container">
      {/* Form Card Header */}
      <div className="service-form-header-bar">
        <div className="service-form-header-title">
          <span className="service-form-badge">Official Repair &amp; Service Portal</span>
          <h3>Book Hardware Repair or On-Site Service</h3>
          <p className="service-form-header-desc">
            Submit your hardware diagnostic request directly to ARS Computers technical engineers for rapid in-shop repair or on-site field visits.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            className="service-form-back-btn"
            onClick={onCancel}
            title="Return to Services Overview"
          >
            ← View Service Capabilities
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="service-form-alert error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="service-ticket-form" noValidate>
        {/* Anti-spam Honeypot field */}
        <input
          type="text"
          name="website_hp"
          value={formData.website_hp}
          onChange={handleChange}
          tabIndex="-1"
          autoComplete="off"
          style={{ display: 'none', position: 'absolute', left: '-9999px' }}
          aria-hidden="true"
        />

        {/* 1. Customer & Contact Details */}
        <div className="service-form-section">
          <div className="service-section-header">
            <h4 className="service-form-section-title">
              <span className="section-num">1</span> Customer &amp; Contact Details
            </h4>
            <p className="service-section-subtitle">
              Provide your primary contact information for status updates and technician coordination.
            </p>
          </div>

          <div className="service-form-grid">
            <div className="service-field-group">
              <label htmlFor="sr-customer-name">
                Full Name <span className="required-star">*</span>
              </label>
              <input
                id="sr-customer-name"
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                placeholder="e.g. Rajesh Sharma"
                required
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-mobile-number">
                Mobile Number <span className="required-star">*</span>
              </label>
              <input
                id="sr-mobile-number"
                type="tel"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleChange}
                placeholder="e.g. +91 98765 43210"
                required
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-email">
                Email Address <span className="field-hint">(Optional)</span>
              </label>
              <input
                id="sr-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. rajesh@company.com"
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-customer-type">
                Customer Type <span className="required-star">*</span>
              </label>
              <select
                id="sr-customer-type"
                name="customer_type"
                value={formData.customer_type}
                onChange={handleChange}
              >
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Product & Hardware Details */}
        <div className="service-form-section">
          <div className="service-section-header">
            <h4 className="service-form-section-title">
              <span className="section-num">2</span> Product &amp; Hardware Details
            </h4>
            <p className="service-section-subtitle">
              Identify the hardware model, brand, and warranty information for accurate component sourcing.
            </p>
          </div>

          <div className="service-form-grid">
            <div className="service-field-group">
              <label htmlFor="sr-product-category">
                Product Category <span className="required-star">*</span>
              </label>
              <select
                id="sr-product-category"
                name="product_category"
                value={formData.product_category}
                onChange={handleChange}
                required
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-request-type">
                Request Type <span className="required-star">*</span>
              </label>
              <select
                id="sr-request-type"
                name="request_type"
                value={formData.request_type}
                onChange={handleChange}
              >
                {REQUEST_TYPES.map((req) => (
                  <option key={req} value={req}>
                    {req}
                  </option>
                ))}
              </select>
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-brand">
                Brand / Manufacturer
              </label>
              <input
                id="sr-brand"
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Dell, HP, Hikvision, CP Plus, Epson"
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-model-number">
                Model Number
              </label>
              <input
                id="sr-model-number"
                type="text"
                name="model_number"
                value={formData.model_number}
                onChange={handleChange}
                placeholder="e.g. Latitude 3440 / DS-2CD2047G2"
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-serial-number">
                Serial Number (S/N)
              </label>
              <input
                id="sr-serial-number"
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                placeholder="Found on device barcode label"
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-invoice-number">
                Invoice Reference <span className="field-hint">(If purchased from ARS)</span>
              </label>
              <input
                id="sr-invoice-number"
                type="text"
                name="invoice_number"
                value={formData.invoice_number}
                onChange={handleChange}
                placeholder="e.g. INV-2025-0842"
              />
            </div>

            <div className="service-field-group">
              <label htmlFor="sr-purchase-date">
                Estimated Purchase Date <span className="field-hint">(For warranty verification)</span>
              </label>
              <input
                id="sr-purchase-date"
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* 3. Problem & Diagnostics */}
        <div className="service-form-section">
          <div className="service-section-header">
            <h4 className="service-form-section-title">
              <span className="section-num">3</span> Problem &amp; Diagnostics
            </h4>
            <p className="service-section-subtitle">
              Detail the hardware fault symptoms observed to expedite component testing and repair.
            </p>
          </div>

          {/* Conditional CCTV Diagnostics */}
          {isCctvCategory && (
            <div className="conditional-diagnostic-panel">
              <div className="panel-badge-header">
                <span className="panel-icon">📹</span>
                <span className="panel-title">CCTV Surveillance Diagnostics</span>
              </div>

              <div className="service-form-grid" style={{ marginBottom: '18px' }}>
                <div className="service-field-group">
                  <label htmlFor="sr-camera-count">Number of Installed Cameras</label>
                  <input
                    id="sr-camera-count"
                    type="number"
                    name="cctv_camera_count"
                    value={formData.cctv_camera_count}
                    onChange={handleChange}
                    min="1"
                    max="128"
                    placeholder="e.g. 4, 8, 16"
                  />
                </div>

                <div className="service-field-group">
                  <label htmlFor="sr-dvr-details">DVR / NVR Model &amp; Channels</label>
                  <input
                    id="sr-dvr-details"
                    type="text"
                    name="cctv_dvr_details"
                    value={formData.cctv_dvr_details}
                    onChange={handleChange}
                    placeholder="e.g. 8-Channel NVR with 2TB HDD"
                  />
                </div>
              </div>

              <span className="checklist-subheading">Surveillance System Symptoms Observed:</span>
              <div className="checklist-cards-grid">
                <label className={`selectable-checkbox-card ${formData.issue_camera_offline ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_camera_offline"
                    checked={formData.issue_camera_offline}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Camera Offline / "No Video"</span>
                    <span className="checkbox-sub-label">One or more channels showing a black screen</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_remote_viewing ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_remote_viewing"
                    checked={formData.issue_remote_viewing}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Remote Mobile App Disconnected</span>
                    <span className="checkbox-sub-label">Unable to stream live feed via smartphone app</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_recording_playback ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_recording_playback"
                    checked={formData.issue_recording_playback}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Recording / Playback Error</span>
                    <span className="checkbox-sub-label">Hard drive not recording or footage playback fails</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_cabling ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_cabling"
                    checked={formData.issue_cabling}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Cabling / Connector Damage</span>
                    <span className="checkbox-sub-label">Cut wires, corroded BNC or weather-damaged conduits</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_power ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_power"
                    checked={formData.issue_power}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">SMPS Power Supply Failure</span>
                    <span className="checkbox-sub-label">Central power supply unit dead or LED indicators off</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_network ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_network"
                    checked={formData.issue_network}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">PoE Switch / IP Conflict</span>
                    <span className="checkbox-sub-label">PoE port faults, IP address conflicts, or router changes</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Conditional Computer / Laptop Diagnostics */}
          {isComputerCategory && (
            <div className="conditional-diagnostic-panel">
              <div className="panel-badge-header">
                <span className="panel-icon">💻</span>
                <span className="panel-title">Computer &amp; Laptop Diagnostic Indicators</span>
              </div>

              <span className="checklist-subheading">Hardware Symptoms &amp; Faults Observed:</span>
              <div className="checklist-cards-grid">
                <label className={`selectable-checkbox-card ${formData.issue_boot_failure ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_boot_failure"
                    checked={formData.issue_boot_failure}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Boot Failure / No Power</span>
                    <span className="checkbox-sub-label">Device does not turn on, no display, or no POST beeps</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_display ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_display"
                    checked={formData.issue_display}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Display Lines / Screen Artifacts</span>
                    <span className="checkbox-sub-label">Screen flickering, dead backlight, or distorted graphics</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_overheating ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_overheating"
                    checked={formData.issue_overheating}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Overheating / Loud Fan</span>
                    <span className="checkbox-sub-label">Severe thermal throttling, fan constantly at maximum speed</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_slow_performance ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_slow_performance"
                    checked={formData.issue_slow_performance}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Extreme Slowdown / Freezing</span>
                    <span className="checkbox-sub-label">100% disk usage, random system freezes under normal load</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_os_software ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_os_software"
                    checked={formData.issue_os_software}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Blue Screen (BSOD) / Boot Loop</span>
                    <span className="checkbox-sub-label">Windows crashes repeatedly, automatic repair loops</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_data_recovery ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_data_recovery"
                    checked={formData.issue_data_recovery}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Critical Data Recovery Needed</span>
                    <span className="checkbox-sub-label">Drive unreadable or files accidentally formatted</span>
                  </div>
                </label>

                <label className={`selectable-checkbox-card ${formData.issue_hardware_replacement ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    name="issue_hardware_replacement"
                    checked={formData.issue_hardware_replacement}
                    onChange={handleChange}
                  />
                  <div className="checkbox-text-content">
                    <span className="checkbox-main-label">Component Upgrade / Replacement</span>
                    <span className="checkbox-sub-label">NVMe SSD, RAM upgrade, replacement battery or keyboard</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Problem Description Field */}
          <div className="service-field-group full-width" style={{ marginTop: '16px' }}>
            <label htmlFor="sr-problem-desc">
              Detailed Problem Description <span className="required-star">*</span>
            </label>
            <textarea
              id="sr-problem-desc"
              name="problem_description"
              rows={5}
              value={formData.problem_description}
              onChange={handleChange}
              placeholder="Please explain what happened, when the issue started, and any error messages, unusual beeps, or symptoms observed..."
              required
            ></textarea>
            <span className="field-hint">Minimum 10 characters required for technical triage.</span>
          </div>
        </div>

        {/* 4. Service Location */}
        <div className="service-form-section">
          <div className="service-section-header">
            <h4 className="service-form-section-title">
              <span className="section-num">4</span> Service Location
            </h4>
            <p className="service-section-subtitle">
              Choose whether you prefer our field technician to visit your premises or if you will carry the device into our service center.
            </p>
          </div>

          <div className="service-location-options-grid">
            <label className={`location-option-card ${formData.service_location === 'On-site' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="service_location"
                value="On-site"
                checked={formData.service_location === 'On-site'}
                onChange={handleChange}
              />
              <div className="location-card-content">
                <span className="location-icon">🏠</span>
                <div>
                  <span className="location-title">On-Site Field Visit</span>
                  <span className="location-desc">Certified technician visits your home, office, school, or retail site</span>
                </div>
              </div>
            </label>

            <label className={`location-option-card ${formData.service_location === 'In-shop' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="service_location"
                value="In-shop"
                checked={formData.service_location === 'In-shop'}
                onChange={handleChange}
              />
              <div className="location-card-content">
                <span className="location-icon">🏢</span>
                <div>
                  <span className="location-title">In-Shop Carry-In</span>
                  <span className="location-desc">Deliver your equipment to ARS Computers service center bench</span>
                </div>
              </div>
            </label>
          </div>

          <div className="service-form-grid" style={{ marginTop: '18px' }}>
            <div className="service-field-group">
              <label htmlFor="sr-visit-date">
                Preferred Visit Date <span className="field-hint">(Optional)</span>
              </label>
              <input
                id="sr-visit-date"
                type="date"
                name="preferred_visit_date"
                value={formData.preferred_visit_date}
                onChange={handleChange}
              />
            </div>

            {formData.service_location === 'On-site' && (
              <div className="service-field-group full-width">
                <label htmlFor="sr-site-address">
                  On-Site Address / Office Location <span className="required-star">*</span>
                </label>
                <input
                  id="sr-site-address"
                  type="text"
                  name="site_address"
                  value={formData.site_address}
                  onChange={handleChange}
                  placeholder="House/Plot No., Building/Floor, Street, Landmark, Pin Code"
                  required={formData.service_location === 'On-site'}
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. Attachment & Submit */}
        <div className="service-form-section">
          <div className="service-section-header">
            <h4 className="service-form-section-title">
              <span className="section-num">5</span> Attachment &amp; Submit
            </h4>
            <p className="service-section-subtitle">
              Attach an image of the equipment, damaged cable, or on-screen error to help engineers arrive with the correct spare components.
            </p>
          </div>

          <div className="service-field-group full-width">
            <input
              id="sr-file-attachment"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
            />

            <div className="attachment-upload-box">
              {attachmentFile ? (
                <div className="attachment-preview-card">
                  {attachmentPreview ? (
                    <img src={attachmentPreview} alt="Selected file preview" className="file-thumb" />
                  ) : (
                    <div className="file-doc-icon">📄</div>
                  )}
                  <div className="file-meta-col">
                    <span className="file-name-text">{attachmentFile.name}</span>
                    <span className="file-size-text">
                      {(attachmentFile.size / (1024 * 1024)).toFixed(2)} MB • {attachmentFile.type || 'Document'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="attachment-remove-btn"
                    onClick={handleRemoveFile}
                    title="Remove attached file"
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div
                  className="attachment-dropzone-ui"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <div className="upload-icon-circle">📎</div>
                  <div className="upload-text-group">
                    <span className="upload-primary-text">Click to attach a hardware photo or screenshot</span>
                    <span className="upload-sub-text">Supported: JPEG, PNG, WEBP or PDF (Maximum 5 MB)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy & Security Note */}
          <div className="form-security-footer">
            <span className="security-icon">🔒</span>
            <span className="security-text">
              Encrypted &amp; Confidential: Your hardware information and contact details are used solely for service ticket fulfillment and engineer dispatch.
            </span>
          </div>

          {/* Final Submit Bar */}
          <div className="service-form-submit-bar">
            {onCancel && (
              <button
                type="button"
                className="btn-outline service-cancel-btn"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="btn-primary service-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering Ticket...' : 'Submit Service Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
