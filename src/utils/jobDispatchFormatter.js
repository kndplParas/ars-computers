import { parseServiceEnquiry } from './serviceEnquiryHelper.js'

/**
 * Normalizes a phone number for wa.me URL (digits only, prepends 91 if 10-digit Indian number)
 */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null
  const cleaned = phone.toString().replace(/\D/g, '')
  if (!cleaned) return null
  if (cleaned.length === 10) {
    return `91${cleaned}`
  }
  return cleaned
}

/**
 * Pure function to format an enquiry into clean plain text for engineer job dispatch
 */
export function formatJobDispatchText(enquiry) {
  if (!enquiry) return ''

  const service = parseServiceEnquiry(enquiry)
  const lines = []

  lines.push('*ARS COMPUTERS — SERVICE JOB DISPATCH*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (enquiry.enquiry_number) {
    lines.push(`*Enquiry No:* ${enquiry.enquiry_number}`)
  }
  if (service.isService && service.ticketNumber) {
    lines.push(`*Ticket Ref:* ${service.ticketNumber}`)
  }

  const createdDate = enquiry.created_at ? new Date(enquiry.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : null
  if (createdDate) {
    lines.push(`*Date:* ${createdDate}`)
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('*CUSTOMER DETAILS*')
  if (enquiry.name) {
    lines.push(`*Name:* ${enquiry.name}`)
  }
  if (enquiry.contact_info) {
    lines.push(`*Contact:* ${enquiry.contact_info}`)
  }

  if (service.isService && service.serviceLocation) {
    lines.push(`*Service Location:* ${service.serviceLocation}`)
  } else if (enquiry.address) {
    lines.push(`*Address:* ${enquiry.address}`)
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('*SERVICE / DEVICE DETAILS*')

  if (service.isService && service.productCategory) {
    lines.push(`*Product Category:* ${service.productCategory}`)
  } else if (enquiry.category_interest) {
    lines.push(`*Category Interest:* ${enquiry.category_interest}`)
  }

  if (service.isService && service.brandModel && service.brandModel !== 'N/A') {
    lines.push(`*Brand / Model:* ${service.brandModel}`)
  }

  if (service.isService && service.serialInvoice && service.serialInvoice !== 'N/A') {
    lines.push(`*Serial / Invoice:* ${service.serialInvoice}`)
  }

  if (service.isService && service.preferredVisitDate) {
    lines.push(`*Preferred Visit:* ${service.preferredVisitDate}`)
  }

  if (service.isService && service.diagnosticsSummary) {
    lines.push(`*Reported Issues:* ${service.diagnosticsSummary}`)
  }

  const problem = (service.isService && service.problemDescription) ? service.problemDescription : (enquiry.message || 'N/A')
  if (problem) {
    lines.push(`*Problem Description:*\n${problem}`)
  }

  if (enquiry.assigned_employee_name) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('*ASSIGNED ENGINEER*')
    let engInfo = enquiry.assigned_employee_name
    if (enquiry.assigned_employee_code) {
      engInfo += ` [${enquiry.assigned_employee_code}]`
    }
    lines.push(`*Engineer:* ${engInfo}`)
    if (enquiry.assigned_employee_phone) {
      lines.push(`*Phone:* ${enquiry.assigned_employee_phone}`)
    }
    if (enquiry.expected_arrival) {
      lines.push(`*Expected Arrival:* ${enquiry.expected_arrival}`)
    } else if (enquiry.expected_visit_at) {
      const visitStr = new Date(enquiry.expected_visit_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      lines.push(`*Expected Visit:* ${visitStr}`)
    }
    if (enquiry.assignment_visit_note) {
      lines.push(`*Visit Note:* ${enquiry.assignment_visit_note}`)
    }
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('_Dispatched via ARS Service Desk_')

  return lines.join('\n')
}

/**
 * Builds the wa.me URL for the assigned engineer
 */
export function buildWhatsAppDispatchUrl(enquiry) {
  if (!enquiry || !enquiry.assigned_employee_phone) return null
  const phone = normalizePhoneForWhatsApp(enquiry.assigned_employee_phone)
  if (!phone) return null
  const text = formatJobDispatchText(enquiry)
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
