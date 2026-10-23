/**
 * ARS Computers — Service Enquiry Parser & Helper
 * Maps service/repair inquiries submitted via customer service request form
 * and presents structured service specifications inside Admin Enquiries.
 */

export function parseServiceEnquiry(enquiry) {
  if (!enquiry) return { isService: false }

  const isTypeService = enquiry.enquiry_type === 'service_request'
  const isCategoryService = Boolean(enquiry.category_interest && enquiry.category_interest.toLowerCase().startsWith('service'))
  const isReqService = Boolean(enquiry.service_requested && enquiry.service_requested.toLowerCase().startsWith('service'))
  const hasServiceHeader = Boolean(enquiry.message && enquiry.message.includes('[SERVICE & REPAIR REQUEST]'))
  const hasServiceDetails = Boolean(enquiry.service_details)

  const isService = isTypeService || isCategoryService || isReqService || hasServiceHeader || hasServiceDetails
  if (!isService) {
    return { isService: false }
  }

  if (enquiry.service_details) {
    const sd = enquiry.service_details
    return {
      isService: true,
      ticketNumber: sd.ticket_number,
      customerType: sd.customer_type,
      productCategory: sd.product_category,
      requestType: sd.request_type,
      brandModel: `${sd.brand || 'N/A'}${sd.model_number ? ` / ${sd.model_number}` : ''}`,
      serialInvoice: `${sd.serial_number || 'N/A'}${sd.invoice_number ? ` | Invoice: ${sd.invoice_number}` : ''}`,
      purchaseDate: sd.purchase_date,
      serviceLocation: `${sd.service_location || 'On-site'}${sd.site_address ? ` (${sd.site_address})` : ''}`,
      preferredVisitDate: sd.preferred_visit_date,
      diagnosticsSummary: typeof sd.device_details === 'object' && sd.device_details ? Object.keys(sd.device_details).filter(k => sd.device_details[k] === true).map(k => k.replace(/^issue_/, '').replace(/_/g, ' ')).join(', ') : null,
      attachmentUrl: sd.attachment_url,
      problemDescription: sd.problem_description
    }
  }

  const msg = enquiry.message || ''
  const getLineVal = (prefix) => {
    const match = msg.match(new RegExp(`•\\s*${prefix}:?\\s*([^\\n]+)`, 'i'))
    return match ? match[1].trim() : null
  }

  const ticketMatch = msg.match(/Ticket Ref:\s*(ARS-SR-[\w-]+)/i)
  const ticketNumber = ticketMatch ? ticketMatch[1] : null

  const customerType = getLineVal('Customer Type')
  const productLine = getLineVal('Product')
  const brandModel = getLineVal('Brand / Model')
  const serialInvoice = getLineVal('Serial No')
  const purchaseDate = getLineVal('Purchase Date')
  const locationLine = getLineVal('Location')
  const preferredVisitDate = getLineVal('Preferred Visit Date')
  const diagnosticsSummary = getLineVal('Diagnostics')
  const attachmentUrl = getLineVal('Attachment')

  let problemDescription = null
  const problemIdx = msg.indexOf('• Problem Description:')
  if (problemIdx !== -1) {
    const afterProblem = msg.substring(problemIdx + '• Problem Description:'.length)
    const nextBulletIdx = afterProblem.indexOf('\n• ')
    problemDescription = (nextBulletIdx !== -1 ? afterProblem.substring(0, nextBulletIdx) : afterProblem).trim()
  }

  return {
    isService: true,
    ticketNumber,
    customerType,
    productCategory: productLine || (enquiry.category_interest ? enquiry.category_interest.replace(/^service:\s*/i, '') : null),
    requestType: productLine ? (productLine.match(/\((.*?)\)/)?.[1] || null) : null,
    brandModel,
    serialInvoice,
    purchaseDate: purchaseDate !== 'N/A' ? purchaseDate : null,
    serviceLocation: locationLine,
    preferredVisitDate: preferredVisitDate !== 'N/A' ? preferredVisitDate : null,
    diagnosticsSummary,
    attachmentUrl: (attachmentUrl && attachmentUrl !== 'None') ? attachmentUrl : null,
    problemDescription: problemDescription || msg
  }
}
