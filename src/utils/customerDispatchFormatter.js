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
  if (record.service_details?.mobile_number) {
    return String(record.service_details.mobile_number).trim()
  }
  if (record.contact_info) {
    const raw = String(record.contact_info).trim()
    // Handle "mobile | email" format
    if (raw.includes('|')) {
      const parts = raw.split('|').map(p => p.trim())
      for (const p of parts) {
        if (!p.includes('@') && /\d{10}/.test(p)) {
          return p
        }
      }
    }
    // Handle pure phone or text containing phone
    if (!raw.includes('@') && /\d{10}/.test(raw)) {
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
 * Primary pure formatter: produces the single authoritative customer-facing dispatch for enquiries.
 * Used identically across WhatsApp, Copy to Notepad, and Email.
 */
export function formatEnquiryCustomerDispatch(enquiry) {
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

  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })

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
      const pDate = p.received_at || p.created_at
        ? new Date(p.received_at || p.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        : 'Payment'
      const pAmt = formatINR(p.amount_received)
      const pMethod = formatPaymentMethodLabel(p.payment_method)
      lines.push(`${pDate} — ${pAmt} — ${pMethod}`)
    })
    lines.push('')

    lines.push('PAYMENT SUMMARY')
    lines.push(`Order Total: ${formatINR(totalAmount)}`)
    lines.push(`Total Paid: ${formatINR(paidAmount)}`)
    lines.push(`Balance: ${formatINR(balance)}`)
    lines.push(`Payment Status: ${paymentStatus}`)
  } else {
    lines.push('PAYMENT SUMMARY')
    lines.push(`Order Total: ${formatINR(totalAmount)}`)
    lines.push(`Paid: ${formatINR(paidAmount)}`)
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

  // Handled By (Staff snapshot, zero internal UUIDs)
  const handlerName = order.completed_by_name || order.created_by_name
  const handlerCode = order.completed_by_employee_code || order.created_by_employee_code
  if (handlerName) {
    lines.push('Handled By:')
    lines.push(handlerName)
    if (handlerCode) {
      lines.push(`Employee Code: ${handlerCode}`)
    }
    lines.push('')
  }

  // Footer
  lines.push('Thank you for choosing ARS Computers.')

  return lines.join('\n')
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
