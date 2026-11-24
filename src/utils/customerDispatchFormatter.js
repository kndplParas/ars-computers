/**
 * ARS Computers — Customer Service & Order Dispatch Formatter & Communication Utilities
 * Formats authoritative service visit details and retail/sales order summaries for customer communication via:
 * 1. WhatsApp (pre-filled wa.me URL for customer)
 * 2. Copy / Notepad (authoritative clipboard plain text)
 * 3. Email (pre-filled mailto URL with subject & body)
 *
 * Strict Privacy & Security Invariants:
 * - NO internal UUIDs, DB IDs, or Auth IDs
 * - NO private storage paths or signed URLs
 * - NO cost_price, purchase costs, internal margin, or profit figures
 * - Sourced strictly from the authorized record snapshots
 * - Dedicated Indian phone normalization (rejects ambiguous/malformed numbers)
 * - Masked Aadhaar representation formatted as 'XXXX XXXX 1234' (first 8 digits strictly masked, or 'Not Provided')
 */

import { parseServiceEnquiry } from './serviceEnquiryHelper.js'
import { formatAadhaarMasked } from './aadhaarFormatter.js'

/**
 * Formats a numeric value into standard Indian Currency representation (e.g. ₹74,000.00).
 * Gracefully handles null, undefined, strings, and avoids NaN or undefined output.
 */
export function formatINR(val) {
  const num = Number(val)
  if (isNaN(num)) return '₹0.00'
  if (num < 0) {
    return `-₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Normalizes an Indian phone number for WhatsApp wa.me URL.
 * Accepts:
 * - 10 digits starting with 6, 7, 8, 9 (e.g. 9876543210 -> 919876543210)
 * - +91 followed by 10 digits (e.g. +919876543210 -> 919876543210)
 * - 91 followed by 10 digits (e.g. 91 98765 43210 -> 919876543210)
 * - 0 followed by 10 digits (e.g. 09876543210 -> 919876543210)
 * Rejects ambiguous, foreign, or malformed values safely (returns null).
 */
export function normalizeIndianPhoneForWhatsApp(phone) {
  if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) return null
  const cleaned = String(phone).trim().replace(/[\s\-().]/g, '')
  if (!cleaned) return null

  // Case 1: Standard 10-digit Indian mobile starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `91${cleaned}`
  }

  // Case 2: +91 or 91 prefix followed by 10 digits starting with 6-9
  const withPrefix = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned
  if (/^91[6-9]\d{9}$/.test(withPrefix)) {
    return withPrefix
  }

  // Case 3: Leading 0 followed by 10 digits starting with 6-9
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `91${cleaned.slice(1)}`
  }

  return null
}

/**
 * Resolves customer's registered phone number from enquiry or order.
 * Priority:
 * 1. record.customer_phone
 * 2. record.service_details?.mobile_number
 * 3. record.contact_info (if contains valid phone)
 */
export function resolveCustomerPhone(record) {
  if (!record) return null
  if (record.customer_phone && String(record.customer_phone).trim()) {
    return String(record.customer_phone).trim()
  }
  if (record.phone && String(record.phone).trim()) {
    return String(record.phone).trim()
  }
  if (record.mobile_number && String(record.mobile_number).trim()) {
    return String(record.mobile_number).trim()
  }
  if (record.service_details?.mobile_number) {
    return String(record.service_details.mobile_number).trim()
  }
  if (record.contact_info) {
    const raw = String(record.contact_info).trim()
    // Handle "mobile | email" format
    if (raw.includes('|')) {
      const parts = raw.split('|').map(p => p.trim())
      for (const p of parts) {
        if (!p.includes('@') && p.replace(/\D/g, '').length >= 10) {
          return p
        }
      }
    }
    // Handle pure phone or text containing phone
    if (!raw.includes('@') && raw.replace(/\D/g, '').length >= 10) {
      return raw
    }
  }
  return null
}

/**
 * Resolves customer's registered email address from enquiry or order.
 * Priority:
 * 1. record.customer_email
 * 2. record.service_details?.email
 * 3. record.contact_info (if contains an email address)
 * Returns lowercase trimmed email or null. Does NOT guess.
 */
export function resolveCustomerEmail(record) {
  if (!record) return null
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (record.customer_email && emailRegex.test(record.customer_email.trim())) {
    return record.customer_email.trim().toLowerCase()
  }
  if (record.email && emailRegex.test(record.email.trim())) {
    return record.email.trim().toLowerCase()
  }
  if (record.service_details?.email && emailRegex.test(record.service_details.email.trim())) {
    return record.service_details.email.trim().toLowerCase()
  }
  if (record.contact_info) {
    const raw = String(record.contact_info).trim()
    if (raw.includes('|')) {
      const parts = raw.split('|').map(p => p.trim())
      for (const p of parts) {
        if (emailRegex.test(p)) return p.toLowerCase()
      }
    }
    if (emailRegex.test(raw)) {
      return raw.toLowerCase()
    }
  }
  return null
}

/**
 * Resolves customer's site address.
 */
export function resolveCustomerAddress(enquiry, service) {
  if (!enquiry) return null
  if (enquiry.customer_address && enquiry.customer_address.trim()) {
    return enquiry.customer_address.trim()
  }
  if (service?.serviceLocation && service.serviceLocation !== 'On-site' && service.serviceLocation !== 'N/A') {
    return service.serviceLocation
  }
  if (enquiry.service_details?.site_address && enquiry.service_details.site_address.trim()) {
    return enquiry.service_details.site_address.trim()
  }
  if (enquiry.address && enquiry.address.trim()) {
    return enquiry.address.trim()
  }
  return null
}

/**
 * Formats a customer-facing human readable status for an enquiry.
 */
export function formatCustomerFacingStatus(enquiry) {
  if (!enquiry) return 'In Progress'
  const status = enquiry.status || 'new'

  switch (status) {
    case 'new':
      return 'New'
    case 'in_progress':
      return enquiry.assigned_employee_id ? 'Engineer Assigned' : 'In Progress'
    case 'completion_requested':
      return 'Completion Under Review'
    case 'completed':
      return 'Completed'
    case 'returned_for_rework':
      return 'Returned for Additional Work'
    case 'rejection_requested':
      return 'Under Review'
    case 'rejected':
      return 'Closed'
    case 'quoted':
      return 'Quotation Sent'
    case 'converted':
      return 'Converted'
    default:
      return 'In Progress'
  }
}

/**
 * Formats a 12-digit Aadhaar number into standard 'XXXX XXXX XXXX' format.
 * Returns 'Not Provided' if missing.
 */
export function formatAadhaarForDispatch(aadhaar) {
  if (!aadhaar) return 'Not Provided'
  return formatAadhaarMasked(aadhaar, 'Not Provided')
}

/**
 * Resolves a clean customer-facing Ticket ID / Reference.
 */
export function resolveTicketId(enquiry, service) {
  if (service?.isService && service.ticketNumber) {
    return service.ticketNumber
  }
  if (enquiry.enquiry_number) {
    return `ARS-ENQ-${String(enquiry.enquiry_number).padStart(5, '0')}`
  }
  if (enquiry.id) {
    return `ARS-ENQ-${String(enquiry.id).replace(/\D/g, '').slice(0, 5) || '01001'}`
  }
  return 'ARS-ENQ'
}

/**
 * Formats an expected visit date/time for customer dispatch.
 */
export function formatExpectedVisitDateTime(isoString) {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return null
  }
}

/**
 * Formats an ISO date-time into standard Indian representation (e.g. 21 Nov 2026, 06:30 PM).
 */
export function formatDateTime(isoString) {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return null
  }
}

/**
 * Maps raw workflow status into human-readable label.
 */
export function formatWorkflowStatus(status) {
  if (!status) return 'New'
  switch (String(status).toLowerCase().trim()) {
    case 'new':
      return 'New'
    case 'in_progress':
      return 'In Progress'
    case 'quoted':
      return 'Quotation Sent'
    case 'completion_requested':
      return 'Completion Under Review'
    case 'completed':
      return 'Completed'
    case 'returned_for_rework':
      return 'Returned for Additional Work'
    case 'rejection_requested':
      return 'Under Review (Rejection Requested)'
    case 'rejected':
      return 'Closed (Rejected)'
    case 'closed':
      return 'Closed'
    case 'converted':
      return 'Converted'
    default:
      return String(status).charAt(0).toUpperCase() + String(status).slice(1)
  }
}

/**
 * Maps customer tracking status into human-readable label.
 */
export function formatCustomerTrackingStatus(status) {
  if (!status) return null
  switch (String(status).toLowerCase().trim()) {
    case 'received':
      return 'Received'
    case 'in_progress':
      return 'In Progress'
    case 'needs_info':
      return 'Need More Info'
    case 'scheduled':
      return 'Scheduled'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return String(status).charAt(0).toUpperCase() + String(status).slice(1)
  }
}

/**
 * Maps customer visit tracking status into human-readable label.
 */
export function formatVisitStatusLabel(status) {
  if (!status) return null
  switch (String(status).toLowerCase().trim()) {
    case 'scheduled':
      return 'Visit Scheduled'
    case 'in_progress':
      return 'Visit In Progress'
    case 'on_way':
      return 'Engineer On The Way'
    case 'completed':
      return 'Visit Completed'
    case 'rescheduled':
      return 'Visit Rescheduled'
    case 'cancelled':
      return 'Visit Cancelled'
    default:
      return String(status).charAt(0).toUpperCase() + String(status).slice(1)
  }
}

/**
 * Extracts a bullet field value from message text formatted like: "• Brand: Lenovo"
 */
function extractBulletField(message, fieldName) {
  if (!message || typeof message !== 'string') return null
  const regex = new RegExp(`•\\s*${fieldName}:?\\s*([^\\n]+)`, 'i')
  const match = message.match(regex)
  if (match && match[1]) {
    const val = match[1].trim()
    if (val && !['n/a', 'none', '-', 'not specified'].includes(val.toLowerCase())) {
      return val
    }
  }
  return null
}

/**
 * Builds a unified chronological timeline from customer tracking history and internal enquiry activities.
 * Standardizes category, author, role, content description, and sort order.
 */
export function buildUnifiedTimeline(customerTrackingHistory = [], enquiryActivities = []) {
  const historyList = Array.isArray(customerTrackingHistory) ? customerTrackingHistory : []
  const activityList = Array.isArray(enquiryActivities) ? enquiryActivities : []

  const kindLabels = {
    status: { icon: '📶', label: 'Tracking Status' },
    engineer_contact: { icon: '📞', label: 'Customer Contact' },
    visit: { icon: '📅', label: 'Visit Schedule' },
    note: { icon: '📝', label: 'Customer Note' }
  }

  const trackingEvents = historyList.map((entry) => {
    const kind = kindLabels[entry.change_kind] || { icon: '📶', label: 'Tracking Event' }
    let description = ''
    if (entry.change_kind === 'status') {
      const prevOpt = formatCustomerTrackingStatus(entry.previous_value || entry.previous_status) || entry.previous_value || 'Initial'
      const newOpt = formatCustomerTrackingStatus(entry.new_value || entry.tracking_status) || entry.tracking_status
      description = `${prevOpt} → ${newOpt}`
    } else if (entry.change_kind === 'visit') {
      const prevVisit = formatVisitStatusLabel(entry.previous_value) || entry.previous_value || '—'
      const newVisit = formatVisitStatusLabel(entry.new_value) || entry.new_value || '—'
      description = `${prevVisit} → ${newVisit}`
    } else if (entry.new_value) {
      description = String(entry.new_value)
    }
    return {
      id: `tracking-${entry.id}`,
      source: 'tracking',
      icon: kind.icon,
      category: kind.label,
      badgeColor: '#1d4ed8',
      badgeBg: '#eff6ff',
      author: entry.updated_by_name || 'Staff',
      role: entry.updated_by_employee_code ? `[${entry.updated_by_employee_code}]` : '',
      content: description,
      timestamp: entry.created_at
    }
  })

  const internalActivities = activityList.map((act) => {
    const isSystem = act.activity_type === 'system_event'
    const isStatus = act.activity_type === 'status_change'
    const isRejectionReq = act.activity_type === 'rejection_requested'
    const isRejectionRev = act.activity_type === 'rejection_reviewed'
    const isCompletionReq = act.activity_type === 'completion_requested'
    const isCompletionRev = act.activity_type === 'completion_reviewed'
    const isBinEntered = act.activity_type === 'bin_entered'
    const isBinRestored = act.activity_type === 'bin_restored'
    const isBinPurged = act.activity_type === 'bin_purged'
    const isArchive = act.activity_type === 'archived' || act.activity_type === 'restored'
    const isAssign = act.activity_type === 'assigned' || act.activity_type === 'reassigned' || act.activity_type === 'unassigned'

    let icon = '📝'
    let badgeColor = '#475569'
    let badgeBg = '#f1f5f9'

    if (isSystem) { icon = '🌐'; badgeColor = '#0284c7'; badgeBg = '#e0f2fe' }
    else if (isStatus) { icon = '🔄'; badgeColor = '#16a34a'; badgeBg = '#dcfce7' }
    else if (isAssign) { icon = '👤'; badgeColor = '#2563eb'; badgeBg = '#dbeafe' }
    else if (isRejectionReq) { icon = '⚠️'; badgeColor = '#d97706'; badgeBg = '#fef3c7' }
    else if (isRejectionRev) { icon = '⚖️'; badgeColor = '#9333ea'; badgeBg = '#f3e8ff' }
    else if (isCompletionReq) { icon = '⏳'; badgeColor = '#2563eb'; badgeBg = '#dbeafe' }
    else if (isCompletionRev) { icon = '✅'; badgeColor = '#059669'; badgeBg = '#d1fae5' }
    else if (isBinEntered) { icon = '🗑️'; badgeColor = '#dc2626'; badgeBg = '#fee2e2' }
    else if (isBinRestored) { icon = '♻️'; badgeColor = '#0d9488'; badgeBg = '#ccfbf1' }
    else if (isBinPurged) { icon = '🧹'; badgeColor = '#475569'; badgeBg = '#f1f5f9' }
    else if (isArchive) { icon = '📦'; badgeColor = '#64748b'; badgeBg = '#f1f5f9' }

    return {
      id: `activity-${act.id}`,
      source: 'internal',
      icon,
      category: (act.activity_type || 'note').replace(/_/g, ' '),
      badgeColor,
      badgeBg,
      author: act.actor_email || (isSystem ? 'Customer Submission' : 'System'),
      role: act.actor_role ? `(${act.actor_role})` : '',
      content: act.content,
      timestamp: act.created_at
    }
  })

  return [...trackingEvents, ...internalActivities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Comprehensive customer-facing pure formatter: builds complete enquiry details text for copying to clipboard.
 * Includes every customer-facing field for both General and Service/Repair enquiries.
 * 
 * Strict Privacy & Security Invariants:
 * - NO internal admin notes (admin_notes)
 * - NO employee codes or internal IDs (ARS-EMP-*, UUIDs)
 * - NO staff Aadhaar numbers (even masked)
 * - NO assignment, rejection, rework, or completion audit actors/reasons
 * - NO archive or bin lifecycle details
 * - NO private storage paths, tokens, signed URLs, passwords, or secrets
 * - Engineer contact ONLY from approved customer-visible contact (engineer_contact_display)
 * - Complete, untruncated customer message & problem description
 * - Clear headings and consistent fallback 'Not Provided' for missing fields
 */
export function formatEnquiryDetailsForCopy(enquiry, options = {}) {
  if (!enquiry) return ''

  const service = parseServiceEnquiry(enquiry)
  const isService = Boolean(service?.isService)

  // Safe parse of nested JSONB objects
  let sd = enquiry.service_details
  if (typeof sd === 'string') {
    try { sd = JSON.parse(sd) } catch { sd = {} }
  } else if (!sd || typeof sd !== 'object') {
    sd = {}
  }

  let pd = enquiry.product_details
  if (typeof pd === 'string') {
    try { pd = JSON.parse(pd) } catch { pd = {} }
  } else if (!pd || typeof pd !== 'object') {
    pd = {}
  }

  const lines = []

  // 1. Header & Enquiry Identification
  lines.push('ARS COMPUTERS')
  if (isService) {
    lines.push('SERVICE & REPAIR ENQUIRY DETAILS')
  } else {
    lines.push('GENERAL ENQUIRY DETAILS')
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Service Ticket ID (if service enquiry)
  const serviceTicket = service.ticketNumber || sd.ticket_number || (enquiry.ticket_number ? String(enquiry.ticket_number) : null)
  if (isService && serviceTicket) {
    lines.push(`Service Ticket ID: ${serviceTicket}`)
  }

  // Enquiry ID / Reference
  if (enquiry.enquiry_number) {
    const rawNum = String(enquiry.enquiry_number).trim()
    const formattedId = rawNum.startsWith('ARS-ENQ-')
      ? rawNum
      : `ARS-ENQ-${rawNum.padStart(5, '0')}`
    lines.push(`Enquiry ID: ${formattedId}`)
  } else if (!isService || !serviceTicket) {
    lines.push(`Enquiry ID: ${resolveTicketId(enquiry, service)}`)
  }

  // Submission Date & Time
  const submissionTimestamp = enquiry.created_at || enquiry.submitted_at || enquiry.date || null
  const submissionFormatted = formatDateTime(submissionTimestamp)
  lines.push(`Submission Date & Time: ${submissionFormatted || 'Not Provided'}`)

  // Status & Requirement
  const statusLabel = formatWorkflowStatus(enquiry.status)
  lines.push(`Enquiry Status: ${statusLabel}`)

  const requirement = enquiry.service_requested || enquiry.category_label || enquiry.category_interest || (isService ? 'Hardware Service & Repair' : 'General Enquiry')
  lines.push(`Requirement: ${requirement}`)

  const enquiryTypeLabel = enquiry.enquiry_type
    ? (enquiry.enquiry_type === 'service_request' ? 'Service / Repair' : enquiry.enquiry_type.charAt(0).toUpperCase() + enquiry.enquiry_type.slice(1))
    : (isService ? 'Service / Repair' : 'General')
  lines.push(`Enquiry Type: ${enquiryTypeLabel}`)
  lines.push('')

  // 2. Customer Details
  lines.push('CUSTOMER DETAILS')
  lines.push('────────────────────────────')
  const customerName = enquiry.customer_name || enquiry.name || sd.customer_name || 'Valued Customer'
  lines.push(`Name: ${customerName}`)

  const customerType = service.customerType || sd.customer_type || enquiry.customer_type || null
  if (customerType) {
    lines.push(`Customer Type: ${customerType}`)
  }

  const company = enquiry.company || enquiry.company_name || sd.company_name || extractBulletField(enquiry.message, 'Company') || null
  lines.push(`Company: ${company && !['n/a', 'none', '-', 'not specified'].includes(company.toLowerCase()) ? company : 'Not Provided'}`)

  const customerPhone = resolveCustomerPhone(enquiry)
  lines.push(`Phone: ${customerPhone || 'Not Provided'}`)

  const customerEmail = resolveCustomerEmail(enquiry)
  lines.push(`Email: ${customerEmail || 'Not Provided'}`)

  const customerAddress = resolveCustomerAddress(enquiry, service)
  lines.push(`Address: ${customerAddress || 'Not Provided'}`)
  lines.push('')

  // 3. Product / Service Specifications
  if (isService) {
    lines.push('SERVICE / REPAIR SPECIFICATIONS')
    lines.push('────────────────────────────')

    const productCategory = service.productCategory || sd.product_category || (enquiry.category_interest ? enquiry.category_interest.replace(/^service:\s*/i, '') : null)
    lines.push(`Product Category: ${productCategory || 'Not Provided'}`)

    const requestType = service.requestType || sd.request_type || extractBulletField(enquiry.message, 'Request Type') || null
    lines.push(`Request Type: ${requestType || 'Not Provided'}`)

    const brandModel = (service.brandModel && service.brandModel !== 'N/A')
      ? service.brandModel
      : (sd.brand || sd.model_number ? `${sd.brand || 'Not Provided'}${sd.model_number ? ` / ${sd.model_number}` : ''}` : null)
    lines.push(`Brand & Model: ${brandModel || 'Not Provided'}`)

    const serialInvoice = (service.serialInvoice && service.serialInvoice !== 'N/A')
      ? service.serialInvoice
      : (sd.serial_number || sd.invoice_number ? `${sd.serial_number || 'Not Provided'}${sd.invoice_number ? ` | Invoice: ${sd.invoice_number}` : ''}` : null)
    lines.push(`Serial Number / Invoice: ${serialInvoice || 'Not Provided'}`)

    const purchaseDate = (service.purchaseDate && service.purchaseDate !== 'N/A') ? service.purchaseDate : (sd.purchase_date || null)
    lines.push(`Purchase Date: ${purchaseDate || 'Not Provided'}`)

    const serviceLocation = (service.serviceLocation && service.serviceLocation !== 'N/A')
      ? service.serviceLocation
      : (sd.service_location || customerAddress || 'On-site')
    lines.push(`Service Location: ${serviceLocation || 'On-site'}`)

    const preferredVisitDate = (service.preferredVisitDate && service.preferredVisitDate !== 'N/A') ? service.preferredVisitDate : (sd.preferred_visit_date || null)
    lines.push(`Preferred Visit Date: ${preferredVisitDate || 'Not Provided'}`)

    const diagnostics = service.diagnosticsSummary || sd.diagnostics || (typeof sd.device_details === 'object' && sd.device_details ? Object.keys(sd.device_details).filter(k => sd.device_details[k] === true).map(k => k.replace(/^issue_/, '').replace(/_/g, ' ')).join(', ') : null)
    lines.push(`Diagnostic Symptoms: ${diagnostics || 'Not Provided'}`)

    if (sd.warranty_status) {
      lines.push(`Warranty Status: ${sd.warranty_status}`)
    }
    if (sd.accessories_received) {
      lines.push(`Accessories Received: ${sd.accessories_received}`)
    }
    if (sd.device_condition) {
      lines.push(`Device Physical Condition: ${sd.device_condition}`)
    }
    if (service.attachmentUrl || sd.attachment_url) {
      lines.push('Attachment: Uploaded Document / Photo Available')
    } else {
      lines.push('Attachment: None')
    }
  } else {
    lines.push('PRODUCT & REQUIREMENT SPECIFICATIONS')
    lines.push('────────────────────────────')

    const categoryInterest = enquiry.category_interest || enquiry.category_label || enquiry.product_category || pd.category || null
    lines.push(`Category / Interest: ${categoryInterest || 'Not Provided'}`)

    const brand = enquiry.brand || enquiry.product_brand || pd.brand || extractBulletField(enquiry.message, 'Brand') || null
    lines.push(`Brand: ${brand || 'Not Provided'}`)

    const model = enquiry.model || enquiry.model_number || enquiry.product_model || pd.model || extractBulletField(enquiry.message, 'Model') || null
    lines.push(`Model: ${model || 'Not Provided'}`)

    const specs = enquiry.specifications || enquiry.spec_summary || pd.specifications || extractBulletField(enquiry.message, 'Specifications') || extractBulletField(enquiry.message, 'Specs') || null
    lines.push(`Specifications: ${specs || 'Not Provided'}`)

    const budget = enquiry.budget || enquiry.estimated_budget || pd.budget || extractBulletField(enquiry.message, 'Budget') || null
    if (budget) {
      lines.push(`Estimated Budget: ${budget}`)
    }

    const quantity = enquiry.quantity || enquiry.required_quantity || pd.quantity || extractBulletField(enquiry.message, 'Quantity') || null
    if (quantity) {
      lines.push(`Quantity: ${quantity}`)
    }
  }
  lines.push('')

  // 4. Problem Description / Customer Notes (Full customer-submitted text; zero internal admin notes)
  lines.push('PROBLEM DESCRIPTION & CUSTOMER NOTES')
  lines.push('────────────────────────────')
  const problemDesc = (isService && service.problemDescription)
    ? service.problemDescription
    : (enquiry.message || enquiry.problem_description || 'Not Provided')
  lines.push('Customer Description:')
  lines.push(problemDesc)
  lines.push('')

  // 5. Assigned Engineer (Customer-Visible details only; zero employee IDs, zero Aadhaar, zero internal contacts)
  lines.push('ASSIGNED ENGINEER')
  lines.push('────────────────────────────')
  if (enquiry.assigned_employee_name || enquiry.assigned_employee_id || enquiry.assigned_to) {
    lines.push('Status: Assigned')
    lines.push(`Engineer: ${enquiry.assigned_employee_name || 'Staff Member'}`)

    // Engineer contact ONLY if approved customer-visible contact from customer tracking is available
    const isContactHidden = Boolean(enquiry.engineer_contact_hidden)
    const rawCustomerContact = enquiry.engineer_contact_display || enquiry.customer_engineer_contact_display
    const customerVisibleContact = (!isContactHidden && rawCustomerContact) ? String(rawCustomerContact).trim() : null
    if (customerVisibleContact) {
      lines.push(`Engineer Contact: ${customerVisibleContact}`)
    } else {
      lines.push('Engineer Contact: Contact number not yet available')
    }
  } else {
    lines.push('Status: Not Assigned')
  }
  lines.push('')

  // 6. Visit & Dispatch Schedule (Customer-Visible)
  lines.push('VISIT & DISPATCH SCHEDULE')
  lines.push('────────────────────────────')
  const expectedVisitFormatted = formatExpectedVisitDateTime(enquiry.expected_visit_at)
  const arrivalDuration = enquiry.expected_arrival
  const arrivalDate = enquiry.expected_arrival_date

  if (expectedVisitFormatted && arrivalDuration) {
    lines.push(`Expected Visit: ${expectedVisitFormatted} (${arrivalDuration})`)
  } else if (expectedVisitFormatted) {
    lines.push(`Expected Visit: ${expectedVisitFormatted}`)
  } else if (arrivalDate && arrivalDuration) {
    lines.push(`Expected Visit: ${arrivalDate} (${arrivalDuration})`)
  } else if (arrivalDuration) {
    lines.push(`Expected Arrival: ${arrivalDuration}`)
  } else {
    lines.push('Expected Visit: Not Scheduled')
  }

  // Customer tracking visit details if present
  const rawVisitStatus = enquiry.visit_status || enquiry.customer_visit_status
  const visitStatusLabel = formatVisitStatusLabel(rawVisitStatus)
  if (visitStatusLabel) {
    lines.push(`Visit Status: ${visitStatusLabel}`)
  }

  const customerVisitNote = enquiry.visit_progress_note || enquiry.customer_visit_note
  if (customerVisitNote && typeof customerVisitNote === 'string' && customerVisitNote.trim()) {
    lines.push(`Visit Note: ${customerVisitNote.trim()}`)
  }
  lines.push('')

  // 7. Workflow Status & Customer Tracking (Zero internal audit actors/reasons)
  lines.push('STATUS & TRACKING')
  lines.push('────────────────────────────')
  lines.push(`Current Status: ${statusLabel}`)

  const trackingStatusLabel = formatCustomerTrackingStatus(enquiry.customer_tracking_status)
  if (trackingStatusLabel) {
    lines.push(`Customer Tracking Status: ${trackingStatusLabel}`)
  }

  if (submissionFormatted) {
    lines.push(`Submitted: ${submissionFormatted}`)
  }
  if (enquiry.updated_at) {
    const updatedFormatted = formatDateTime(enquiry.updated_at)
    if (updatedFormatted) {
      lines.push(`Last Updated: ${updatedFormatted}`)
    }
  }
  lines.push('')

  // 8. Activity & Tracking Timeline (when present or provided in options)
  let timeline = null
  if (options && Array.isArray(options.timeline)) {
    timeline = options.timeline
  } else if (Array.isArray(enquiry?.timeline)) {
    timeline = enquiry.timeline
  } else if ((options && (options.activities || options.customerTrackingHistory)) || enquiry?.activities || enquiry?.customerTrackingHistory) {
    const trackingHistory = (options && options.customerTrackingHistory) || enquiry?.customerTrackingHistory || []
    const activities = (options && options.activities) || enquiry?.activities || []
    timeline = buildUnifiedTimeline(trackingHistory, activities)
  }

  if (timeline) {
    lines.push('ACTIVITY & TRACKING TIMELINE')
    lines.push('────────────────────────────')
    if (timeline.length === 0) {
      lines.push('No activity or tracking records logged yet.')
    } else {
      timeline.forEach((ev, idx) => {
        const dateStr = formatDateTime(ev.timestamp) || 'Date Not Specified'
        const categoryStr = (ev.category || 'EVENT').toUpperCase()
        const authorRoleParts = []
        if (ev.author) authorRoleParts.push(ev.author)
        if (ev.role) authorRoleParts.push(ev.role)
        const authorRoleStr = authorRoleParts.join(' ')

        let headerLine = `• ${dateStr} | ${categoryStr}`
        if (authorRoleStr) {
          headerLine += ` | ${authorRoleStr}`
        }
        lines.push(headerLine)

        if (ev.content && typeof ev.content === 'string' && ev.content.trim()) {
          const contentLines = ev.content.trim().split('\n')
          contentLines.forEach((cl) => {
            lines.push(`  ${cl}`)
          })
        }
        if (idx < timeline.length - 1) {
          lines.push('')
        }
      })
    }
    lines.push('')
  }

  // Standalone / legacy admin notes if explicitly requested via options
  const standaloneAdminNote = (options && typeof options.adminNotes === 'string' && options.adminNotes.trim())
    ? options.adminNotes.trim()
    : null
  if (standaloneAdminNote) {
    const alreadyInTimeline = timeline && timeline.some(ev => ev.content && ev.content.includes(standaloneAdminNote))
    if (!alreadyInTimeline) {
      lines.push('ADMIN FOLLOW-UP NOTE')
      lines.push('────────────────────────────')
      lines.push(standaloneAdminNote)
      lines.push('')
    }
  }

  // 9. Footer
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('ARS Computers — Service Desk & Customer Records')

  return lines.join('\n')
}

/**
 * Alias for formatEnquiryDetailsForCopy.
 */
export function formatCompleteEnquiryDetails(enquiry, options = {}) {
  return formatEnquiryDetailsForCopy(enquiry, options)
}

/**
 * Primary pure formatter: produces the single authoritative customer-facing dispatch for enquiries.
 * Used identically across WhatsApp, Copy to Notepad, and Email.
 */
export function formatEnquiryCustomerDispatch(enquiry, options = {}) {
  if (options && options.complete) {
    return formatEnquiryDetailsForCopy(enquiry, options)
  }
  if (!enquiry) return ''

  const service = parseServiceEnquiry(enquiry)
  const ticketId = resolveTicketId(enquiry, service)
  const customerName = enquiry.customer_name || enquiry.name || 'Valued Customer'
  const customerPhone = resolveCustomerPhone(enquiry)
  const customerEmail = resolveCustomerEmail(enquiry)
  const customerAddress = resolveCustomerAddress(enquiry, service)

  const createdDate = enquiry.created_at
    ? new Date(enquiry.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })

  const category = (service.isService && service.productCategory)
    ? service.productCategory
    : (enquiry.category_interest ? enquiry.category_interest.replace(/^service:\s*/i, '') : 'General Enquiry')

  const problem = (service.isService && service.problemDescription)
    ? service.problemDescription
    : (enquiry.message || 'Service inspection requested.')

  const statusLabel = formatCustomerFacingStatus(enquiry)

  const lines = []

  // Header
  lines.push('ARS COMPUTERS')
  lines.push('SERVICE VISIT DETAILS')
  lines.push(`Ticket ID: ${ticketId}`)
  lines.push(`Date: ${createdDate}`)
  lines.push('')

  // Customer Details
  lines.push('CUSTOMER DETAILS')
  lines.push(`Name: ${customerName}`)
  if (customerPhone) {
    lines.push(`Phone: ${customerPhone}`)
  }
  if (customerEmail) {
    lines.push(`Email: ${customerEmail}`)
  }
  if (customerAddress) {
    lines.push(`Address: ${customerAddress}`)
  }
  lines.push('')

  // Service Request
  lines.push('SERVICE REQUEST')
  lines.push(`Category: ${category}`)
  lines.push('Problem:')
  lines.push(problem)
  lines.push('')

  // Assigned Engineer
  lines.push('ASSIGNED ENGINEER')
  if (enquiry.assigned_employee_name) {
    lines.push(`Name: ${enquiry.assigned_employee_name}`)
    if (enquiry.assigned_employee_code) {
      lines.push(`Employee ID: ${enquiry.assigned_employee_code}`)
    }
    if (enquiry.assigned_employee_phone) {
      lines.push(`Phone: ${enquiry.assigned_employee_phone}`)
    }
    const fullAadhaar = formatAadhaarForDispatch(enquiry.assigned_employee_aadhaar || enquiry.assigned_engineer_aadhaar)
    lines.push(`Aadhaar Number: ${fullAadhaar}`)
  } else {
    lines.push('Not Assigned')
  }
  lines.push('')

  // Expected Visit / Arrival Duration (if configured)
  const visitFormatted = formatExpectedVisitDateTime(enquiry.expected_visit_at)
  const arrivalDuration = enquiry.expected_arrival
  const arrivalDate = enquiry.expected_arrival_date

  if (arrivalDuration || arrivalDate || visitFormatted) {
    lines.push('EXPECTED VISIT')
    if (arrivalDate && arrivalDuration) {
      lines.push(`Arrival: ${arrivalDate} (${arrivalDuration})`)
    } else if (arrivalDuration) {
      lines.push(`Arrival: ${arrivalDuration}`)
    } else if (arrivalDate) {
      lines.push(`Date: ${arrivalDate}`)
    } else if (visitFormatted) {
      lines.push(visitFormatted)
    }
    if (enquiry.assignment_visit_note && enquiry.assignment_visit_note.trim()) {
      lines.push('Visit Note:')
      lines.push(enquiry.assignment_visit_note.trim())
    }
    lines.push('')
  }

  // Ticket Status
  lines.push('Ticket Status:')
  lines.push(statusLabel)
  lines.push('')

  // Footer
  lines.push('Please keep your Ticket ID for future reference.')
  lines.push('ARS Computers')

  return lines.join('\n')
}

/**
 * Maps raw internal order status to customer-friendly presentation labels.
 */
export function formatOrderCustomerStatus(status) {
  switch (status) {
    case 'new':
      return 'New'
    case 'processing':
      return 'Processing'
    case 'completion_requested':
      return 'Completion Under Review'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : 'Processing'
  }
}

/**
 * Maps raw payment status to customer-friendly presentation labels.
 */
export function formatOrderPaymentStatus(status) {
  switch (status) {
    case 'paid':
      return 'Fully Paid'
    case 'partial':
      return 'Partially Paid'
    case 'refunded':
      return 'Refunded'
    case 'pending':
    default:
      return 'Payment Pending'
  }
}

/**
 * Formats a payment method code into clean capitalized display text.
 */
export function formatPaymentMethodLabel(method) {
  if (!method) return 'Cash'
  const m = String(method).toLowerCase().trim()
  switch (m) {
    case 'cash':
      return 'Cash'
    case 'upi':
      return 'UPI'
    case 'bank_transfer':
      return 'Bank Transfer'
    case 'card':
      return 'Card'
    case 'cheque':
      return 'Cheque'
    case 'other':
      return 'Other'
    default:
      return method.toUpperCase()
  }
}

/**
 * Formats authoritative customer-facing Order / Sales summary for WhatsApp, Copy, and Email.
 *
 * Invariants:
 * - NO cost_price, purchase costs, internal margin, or profit figures
 * - NO internal UUIDs or database IDs
 * - Accurately represents multiple incremental payments if recorded in order_payments
 * - Formats Indian currency (₹) consistently without NaN/undefined
 */
export function formatOrderCustomerDispatch(order) {
  if (!order) return ''

  const orderNumber = order.order_number || 'Order'
  const customerName = order.customer_name || 'Valued Customer'
  const customerPhone = resolveCustomerPhone(order)
  const customerEmail = resolveCustomerEmail(order)
  const customerAddress = order.customer_address || order.address || null

  let orderDate = ''
  if (order.created_at) {
    try {
      const d = new Date(order.created_at)
      if (!isNaN(d.getTime())) {
        orderDate = d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      }
    } catch {
      orderDate = ''
    }
  }
  if (!orderDate) {
    orderDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const lines = []

  // Header
  lines.push('ARS COMPUTERS')
  lines.push('ORDER DETAILS')
  lines.push(`Order Number: ${orderNumber}`)
  lines.push(`Order Date: ${orderDate}`)
  lines.push('')

  // Customer Details
  lines.push('CUSTOMER DETAILS')
  lines.push(`Name: ${customerName}`)
  if (customerPhone) {
    lines.push(`Phone: ${customerPhone}`)
  }
  if (customerEmail) {
    lines.push(`Email: ${customerEmail}`)
  }
  if (customerAddress) {
    lines.push(`Address: ${customerAddress}`)
  }
  lines.push('')

  // Order Items
  lines.push('ORDER ITEMS')
  const items = Array.isArray(order.order_items) ? order.order_items : []
  if (items.length > 0) {
    items.forEach((it, idx) => {
      const name = it.product_name_snapshot || it.product_name || `Item #${idx + 1}`
      const sku = it.sku_snapshot ? ` [${it.sku_snapshot}]` : ''
      lines.push(`${name}${sku}`)
      lines.push(`Qty: ${it.quantity || 1}`)
      lines.push(`Unit Price: ${formatINR(it.unit_price)}`)
      lines.push(`Amount: ${formatINR(it.line_total != null ? it.line_total : (it.quantity || 1) * (it.unit_price || 0))}`)
      if (idx < items.length - 1) {
        lines.push('')
      }
    })
  } else {
    lines.push('No line items recorded.')
  }
  lines.push('')

  // Payment Breakdown & Summary
  const payments = Array.isArray(order.order_payments) ? order.order_payments : []
  const totalAmount = Number(order.total_amount) || 0
  const paidAmount = Number(order.paid_amount) || 0
  const balance = Math.max(0, totalAmount - paidAmount)
  const paymentStatus = formatOrderPaymentStatus(order.payment_status)

  if (payments.length > 1) {
    lines.push('PAYMENTS')
    payments.forEach((p) => {
      let pDate = 'Payment'
      const rawDate = p.received_at || p.created_at
      if (rawDate) {
        try {
          const d = new Date(rawDate)
          if (!isNaN(d.getTime())) {
            pDate = d.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          }
        } catch {
          pDate = 'Payment'
        }
      }
      const isAdjustment = p.entry_type === 'adjustment' || p.entry_type === 'reversal' || p.entry_type === 'refund' || Number(p.amount_received) < 0
      const typeLabel = isAdjustment ? 'Adjustment' : 'Payment'
      const pAmt = formatINR(p.amount_received)
      const pMethod = formatPaymentMethodLabel(p.payment_method)
      lines.push(`${pDate} (${typeLabel}) — ${pAmt} — ${pMethod}`)
    })
    lines.push('')

    lines.push('PAYMENT SUMMARY')
    lines.push(`Order Total: ${formatINR(totalAmount)}`)
    lines.push(`Total Received: ${formatINR(paidAmount)}`)
    lines.push(`Balance: ${formatINR(balance)}`)
    lines.push(`Payment Status: ${paymentStatus}`)
  } else {
    lines.push('PAYMENT SUMMARY')
    lines.push(`Order Total: ${formatINR(totalAmount)}`)
    lines.push(`Received: ${formatINR(paidAmount)}`)
    lines.push(`Balance: ${formatINR(balance)}`)
    lines.push(`Payment Status: ${paymentStatus}`)
    const singleMethod = payments.length === 1 ? payments[0].payment_method : order.payment_method
    lines.push(`Payment Method: ${formatPaymentMethodLabel(singleMethod)}`)
  }
  lines.push('')

  // Order Status
  lines.push('Order Status:')
  lines.push(formatOrderCustomerStatus(order.status))
  lines.push('')

  // Handled By (Staff display name only, zero employee codes, zero internal UUIDs)
  const handlerName = order.completed_by_name || order.created_by_name
  if (handlerName) {
    lines.push('Handled By:')
    lines.push(handlerName)
    lines.push('')
  }

  // Assigned Engineer
  if (order.assigned_engineer_name) {
    lines.push('Assigned Engineer:')
    lines.push(order.assigned_engineer_name)
    if (order.assigned_engineer_phone) {
      lines.push(`Engineer Phone: ${order.assigned_engineer_phone}`)
    }
    lines.push('')
  }

  // Expected Delivery Date
  if (order.expected_delivery_date) {
    const formattedDelivery = formatExpectedVisitDateTime(order.expected_delivery_date)
    if (formattedDelivery) {
      lines.push('Expected Delivery:')
      lines.push(formattedDelivery)
      lines.push('')
    }
  }

  // Footer
  if (order.status === 'cancelled') {
    lines.push('This order has been cancelled. For any queries or assistance, please contact ARS Computers.')
  } else {
    lines.push('Thank you for choosing ARS Computers.')
  }

  return lines.join('\n')
}

/**
 * Produces a concise, single-line text summary of an order for fast clipboard copying.
 */
export function formatOrderSummaryCompact(order) {
  if (!order) return ''
  const orderNumber = order.order_number || 'Order'
  const customerName = order.customer_name || 'Customer'
  const total = formatINR(order.total_amount)
  const paid = formatINR(order.paid_amount)
  const balance = formatINR(Math.max(0, (Number(order.total_amount) || 0) - (Number(order.paid_amount) || 0)))
  const status = formatOrderCustomerStatus(order.status)
  const eng = order.assigned_engineer_name ? ` | Eng: ${order.assigned_engineer_name}` : ''
  return `${orderNumber} — ${customerName} | Total: ${total} | Paid: ${paid} | Balance: ${balance} | Status: ${status}${eng}`
}

/**
 * Builds the WhatsApp wa.me URL for an order customer.
 */
export function buildCustomerOrderWhatsAppUrl(order) {
  if (!order) return null
  const rawPhone = resolveCustomerPhone(order)
  if (!rawPhone) return null
  const normalized = normalizeIndianPhoneForWhatsApp(rawPhone)
  if (!normalized) return null

  const dispatchText = formatOrderCustomerDispatch(order)
  return `https://wa.me/${normalized}?text=${encodeURIComponent(dispatchText)}`
}

/**
 * Builds the mailto URL for an order customer email.
 */
export function buildCustomerOrderEmailUrl(order) {
  if (!order) return null
  const email = resolveCustomerEmail(order)
  if (!email) return null

  const orderNumber = order.order_number || 'Order'
  const subject = `ARS Computers | Order Details | ${orderNumber}`
  const body = formatOrderCustomerDispatch(order)

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Generic helper for building a mailto URL draft.
 */
export function buildCustomerEmailDraft(email, subject, body) {
  if (!email) return null
  return `mailto:${email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`
}

/**
 * Builds the WhatsApp wa.me URL for the customer (Polymorphic: Enquiry or Order).
 * Destination: Customer's registered WhatsApp/contact number.
 */
export function buildCustomerWhatsAppUrl(record, optionalCustomText) {
  if (!record) return null
  const rawPhone = typeof record === 'string' ? record : resolveCustomerPhone(record)
  if (!rawPhone) return null
  const normalized = normalizeIndianPhoneForWhatsApp(rawPhone)
  if (!normalized) return null

  const dispatchText = optionalCustomText || (record?.order_number ? formatOrderCustomerDispatch(record) : formatEnquiryCustomerDispatch(record))
  return `https://wa.me/${normalized}?text=${encodeURIComponent(dispatchText)}`
}

/**
 * Resolves standard customer email subject line:
 * - Orders: "ARS Computers | Order Details | <Order Number>"
 * - Service Enquiries: "ARS Computers | Service Visit | <Ticket ID>"
 */
export function buildCustomerEmailSubject(record) {
  if (!record) return 'ARS Computers'
  if (record.order_number) {
    return `ARS Computers | Order Details | ${record.order_number}`
  }
  const service = parseServiceEnquiry(record)
  const ticketId = resolveTicketId(record, service)
  return `ARS Computers | Service Visit | ${ticketId}`
}

/**
 * Builds the mailto URL for customer email (Polymorphic: Enquiry or Order).
 * Destination: Customer's registered email.
 */
export function buildCustomerEmailUrl(record, optionalSubject, optionalBody) {
  if (!record) return null
  const email = typeof record === 'string' ? record : resolveCustomerEmail(record)
  if (!email) return null

  const subject = optionalSubject || buildCustomerEmailSubject(record)
  const body =
    optionalBody ||
    (record.order_number ? formatOrderCustomerDispatch(record) : formatEnquiryCustomerDispatch(record))

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
