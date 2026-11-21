/**
 * ARS Computers — Phase 3A Virtual CRM Aggregator & Identity Resolution Utilities
 * Aggregates denormalized customer touchpoints across live sales orders and service enquiries.
 *
 * Strict Principles:
 * - Deterministic Indian mobile normalization (10-digit primary identity)
 * - Lowercase trimmed email secondary identity
 * - Explicit identity conflict detection (no silent merges when different phones share an email)
 * - Zero fabrication of customer records, counts, or financial values
 * - Role-based permission enforcement for sensitive commercial and contact data
 */

import {
  resolveCustomerPhone,
  resolveCustomerEmail,
  resolveCustomerAddress,
  normalizeIndianPhoneForWhatsApp,
  formatINR
} from './customerDispatchFormatter.js'

/**
 * Strips formatting characters for telephone dialer links (e.g. "tel:+919876543210").
 *
 * @param {string} phone
 * @returns {string|null}
 */
export function cleanIndianPhoneForDialer(phone) {
  if (!phone) return null
  const cleaned = String(phone).replace(/[^+\d]/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

/**
 * Normalizes an Indian phone number to exactly 10 digits starting with 6, 7, 8, or 9.
 * Handles prefixes: +91, 91, 0, or clean 10 digits with spaces/hyphens/parentheses.
 * Rejects non-Indian, foreign, landline, or malformed strings safely (returns null).
 *
 * @param {string|number} rawPhone
 * @returns {string|null} 10-digit string or null
 */
export function normalizeIndianPhone10Digit(rawPhone) {
  if (rawPhone === null || rawPhone === undefined) return null
  const cleaned = String(rawPhone).trim().replace(/\D/g, '')
  if (!cleaned) return null

  // Case 1: Exactly 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned
  }

  // Case 2: 11 digits starting with 0 followed by 6-9 (e.g. 09876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(1)
  }

  // Case 3: 12 digits starting with 91 followed by 6-9 (e.g. 919876543210)
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(2)
  }

  // Case 4: 13 digits starting with 091 followed by 6-9
  if (/^091[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(3)
  }

  return null
}

/**
 * Formats a 10-digit Indian phone number for readable display (e.g. "+91 98765 43210").
 *
 * @param {string} tenDigitPhone
 * @returns {string}
 */
export function formatIndianPhoneDisplay(tenDigitPhone) {
  if (!tenDigitPhone) return 'Not Provided'
  const digits = String(tenDigitPhone).replace(/\D/g, '')
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return String(tenDigitPhone)
}

/**
 * Normalizes an email address to lowercase trimmed string, or null if invalid.
 *
 * @param {string} rawEmail
 * @returns {string|null}
 */
export function normalizeCustomerEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return null
  const trimmed = rawEmail.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(trimmed) ? trimmed : null
}

/**
 * Evaluates role-based CRM permissions according to the ARS Computers security hierarchy.
 *
 * Hierarchy:
 * - Superadmin / Admin / Account: Full financial LTV, commercial totals, full profile, direct contact.
 * - Technical / Engineer: Service and repair history, contact actions for job dispatch, financial totals masked.
 * - Inventory Staff / HR: Restricted read-only profile, no financial totals, no direct contact action.
 *
 * @param {string} role
 * @returns {Object} Permissions configuration
 */
export function getCrmRolePermissions(role) {
  const r = (role || '').toLowerCase()
  const isSuperadmin = r === 'superadmin'
  const isAdmin = r === 'admin'
  const isAccount = r === 'account' || r === 'accountant'
  const isTechnical = r === 'technical'
  const isEngineer = r === 'engineer'
  const isHr = r === 'hr'
  const isInventoryStaff = r === 'inventory_staff'

  const canViewFinancials = isSuperadmin || isAdmin || isAccount
  const canContactCustomer = isSuperadmin || isAdmin || isAccount || isTechnical || isEngineer
  const canViewServiceDetails = isSuperadmin || isAdmin || isAccount || isTechnical || isEngineer
  const canViewInternalNotes = isSuperadmin || isAdmin || isAccount || isTechnical || isEngineer
  const isRestrictedReadOnly = isInventoryStaff || isHr

  return {
    role: r,
    canViewFinancials,
    canContactCustomer,
    canViewServiceDetails,
    canViewInternalNotes,
    isRestrictedReadOnly
  }
}

/**
 * Aggregates enquiries and orders into deduplicated 360° customer profiles.
 *
 * Conflict Handling Invariant:
 * If a normalized email matches an existing customer profile but has a DIFFERENT
 * valid normalized phone number, they are NOT silently merged into one profile.
 * Instead, distinct profiles are preserved and both are flagged with `hasIdentityConflict: true`
 * and a clear `conflictReasons` explanation for admin review.
 *
 * @param {Object} params
 * @param {Array} [params.enquiries=[]]
 * @param {Array} [params.orders=[]]
 * @param {Array} [params.regularCustomers=[]]
 * @returns {Array<Object>} Aggregated customer list sorted by lastActive descending
 */
export function aggregateCustomers({ enquiries = [], orders = [], regularCustomers = [] }) {
  const safeEnquiries = Array.isArray(enquiries) ? enquiries : []
  const safeOrders = Array.isArray(orders) ? orders : []
  const safeRegular = Array.isArray(regularCustomers) ? regularCustomers : []

  // Map of customer ID -> Customer Entity
  const customerMap = new Map()
  // Index of 10-digit phone -> customer ID
  const phoneToId = new Map()
  // Index of normalized email -> customer ID
  const emailToId = new Map()

  /**
   * Helper to initialize a new blank customer profile
   */
  function createCustomerEntity(id, initialData = {}) {
    return {
      id,
      name: initialData.name || 'Valued Customer',
      company: initialData.company || null,
      normalizedPhone: initialData.normalizedPhone || null,
      formattedPhone: initialData.formattedPhone || (initialData.normalizedPhone ? formatIndianPhoneDisplay(initialData.normalizedPhone) : null),
      email: initialData.email || null,
      emails: initialData.email ? [initialData.email] : [],
      phones: initialData.normalizedPhone ? [initialData.normalizedPhone] : [],
      address: initialData.address || null,
      customerType: initialData.customer_type || initialData.customerType || 'Individual',
      gstNumber: initialData.gst_number || initialData.gstNumber || null,
      notes: initialData.notes || null,
      isRegularCustomer: Boolean(initialData.is_regular || initialData.isRegularCustomer),
      permanentCustomerId: initialData.permanentCustomerId || (initialData.is_regular ? initialData.id : null),
      orders: [],
      enquiries: [],
      totalOrders: 0,
      totalEnquiries: 0,
      openEnquiriesCount: 0,
      totalSpend: 0,
      paidSpend: 0,
      isRepeatCustomer: false,
      hasActiveEnquiry: false,
      isHighValue: false,
      hasIdentityConflict: false,
      conflictReasons: [],
      firstSeen: initialData.date || new Date().toISOString(),
      lastActive: initialData.date || new Date().toISOString()
    }
  }

  /**
   * Processes a single business record (Order or Enquiry)
   */
  function ingestRecord(record, recordType) {
    if (!record || typeof record !== 'object') return

    const rawPhone = resolveCustomerPhone(record)
    const normPhone = normalizeIndianPhone10Digit(rawPhone)
    const rawEmail = resolveCustomerEmail(record)
    const normEmail = normalizeCustomerEmail(rawEmail)
    const recordDate = record.created_at || record.updated_at || new Date().toISOString()

    // Determine Candidate Identity Target
    let targetId = null
    let hasConflict = false
    let conflictMsg = null

    if (normPhone) {
      if (phoneToId.has(normPhone)) {
        // Known phone
        targetId = phoneToId.get(normPhone)
        // Check if incoming email conflicts with another known customer
        if (normEmail && emailToId.has(normEmail)) {
          const emailOwnerId = emailToId.get(normEmail)
          if (emailOwnerId !== targetId) {
            hasConflict = true
            conflictMsg = `Email ${normEmail} is shared with a different customer account.`
            const conflictingCust = customerMap.get(emailOwnerId)
            if (conflictingCust) {
              conflictingCust.hasIdentityConflict = true
              if (!conflictingCust.conflictReasons.includes(`Email ${normEmail} is shared with phone +91 ${normPhone}.`)) {
                conflictingCust.conflictReasons.push(`Email ${normEmail} is shared with phone +91 ${normPhone}.`)
              }
            }
          }
        }
      } else {
        // Phone not yet seen. Check if email was seen.
        if (normEmail && emailToId.has(normEmail)) {
          const emailOwnerId = emailToId.get(normEmail)
          const existingCust = customerMap.get(emailOwnerId)

          if (existingCust && existingCust.normalizedPhone && existingCust.normalizedPhone !== normPhone) {
            // CONFLICT: Different phone number uses this same email. Do NOT silently merge!
            hasConflict = true
            conflictMsg = `Phone +91 ${normPhone} shares email ${normEmail} with customer ${existingCust.name} (+91 ${existingCust.normalizedPhone}).`
            existingCust.hasIdentityConflict = true
            if (!existingCust.conflictReasons.includes(`Shares email ${normEmail} with phone +91 ${normPhone}.`)) {
              existingCust.conflictReasons.push(`Shares email ${normEmail} with phone +91 ${normPhone}.`)
            }
            // Create a dedicated profile for this phone rather than merging
            targetId = `cust_phone_${normPhone}`
          } else if (existingCust && !existingCust.normalizedPhone) {
            // Existing customer had only an email; enrich with this newly seen phone
            targetId = emailOwnerId
            existingCust.normalizedPhone = normPhone
            existingCust.formattedPhone = formatIndianPhoneDisplay(normPhone)
            if (!existingCust.phones.includes(normPhone)) existingCust.phones.push(normPhone)
            phoneToId.set(normPhone, targetId)
          }
        }

        if (!targetId) {
          targetId = `cust_phone_${normPhone}`
          phoneToId.set(normPhone, targetId)
          if (normEmail && !emailToId.has(normEmail)) {
            emailToId.set(normEmail, targetId)
          }
        }
      }
    } else if (normEmail) {
      // No phone, but valid email
      if (emailToId.has(normEmail)) {
        targetId = emailToId.get(normEmail)
      } else {
        targetId = `cust_email_${encodeURIComponent(normEmail)}`
        emailToId.set(normEmail, targetId)
      }
    } else {
      // Neither valid phone nor valid email (e.g. walk-in retail or draft enquiry)
      const fallbackRef = record.id || record.order_number || record.enquiry_id || Math.random().toString(36).slice(2)
      targetId = `cust_ref_${fallbackRef}`
    }

    // Retrieve or instantiate customer entity
    let customer = customerMap.get(targetId)
    if (!customer) {
      customer = createCustomerEntity(targetId, {
        name: (record.customer_name || record.name || '').trim(),
        company: (record.company || '').trim(),
        normalizedPhone: normPhone,
        email: normEmail,
        address: resolveCustomerAddress(record, null),
        date: recordDate
      })
      customerMap.set(targetId, customer)
    }

    // Record conflict flags
    if (hasConflict && conflictMsg && !customer.conflictReasons.includes(conflictMsg)) {
      customer.hasIdentityConflict = true
      customer.conflictReasons.push(conflictMsg)
    }

    // Enrich contact fields if previously empty
    if ((!customer.name || customer.name === 'Valued Customer') && (record.customer_name || record.name)) {
      const candidateName = String(record.customer_name || record.name).trim()
      if (candidateName && candidateName.toLowerCase() !== 'customer') {
        customer.name = candidateName
      }
    }
    if (!customer.company && record.company) {
      customer.company = String(record.company).trim()
    }
    if (!customer.address) {
      const candAddr = resolveCustomerAddress(record, null)
      if (candAddr) customer.address = candAddr
    }
    if (normEmail && !customer.emails.includes(normEmail)) {
      customer.emails.push(normEmail)
      if (!customer.email) customer.email = normEmail
    }
    if (normPhone && !customer.phones.includes(normPhone)) {
      customer.phones.push(normPhone)
      if (!customer.normalizedPhone) {
        customer.normalizedPhone = normPhone
        customer.formattedPhone = formatIndianPhoneDisplay(normPhone)
      }
    }

    // Update timestamps
    if (new Date(recordDate) > new Date(customer.lastActive)) {
      customer.lastActive = recordDate
    }
    if (new Date(recordDate) < new Date(customer.firstSeen)) {
      customer.firstSeen = recordDate
    }

    // Associate record
    if (recordType === 'order') {
      customer.orders.push(record)
      customer.totalOrders += 1

      // Accumulate financial totals safely (exclude CANCELLED orders)
      const orderStatus = (record.order_status || '').toUpperCase()
      if (orderStatus !== 'CANCELLED') {
        const total = Number(record.total_amount)
        if (!isNaN(total) && total > 0) {
          customer.totalSpend += total
        }
        const paid = Number(record.paid_amount)
        if (!isNaN(paid) && paid > 0) {
          customer.paidSpend += paid
        }
      }
    } else if (recordType === 'enquiry') {
      customer.enquiries.push(record)
      customer.totalEnquiries += 1

      // Check active enquiry status
      const status = (record.workflow_tab || record.status || '').toLowerCase()
      const isTerminal = ['completed', 'closed', 'resolved', 'cancelled', 'rejected', 'bin', 'removed', 'archived'].includes(status)
      if (!isTerminal) {
        customer.openEnquiriesCount += 1
      }
    }
  }

  // Helper to ingest permanent regular customer records
  function ingestRegularCustomer(reg) {
    if (!reg || typeof reg !== 'object') return
    const rawPhone = reg.phone || reg.normalized_phone || reg.customer_phone
    const normPhone = normalizeIndianPhone10Digit(rawPhone)
    const rawEmail = reg.email || reg.normalized_email || reg.customer_email
    const normEmail = normalizeCustomerEmail(rawEmail)
    const regDate = reg.created_at || new Date().toISOString()

    let targetId = null
    if (normPhone) {
      if (phoneToId.has(normPhone)) {
        targetId = phoneToId.get(normPhone)
      } else {
        targetId = `cust_phone_${normPhone}`
        phoneToId.set(normPhone, targetId)
        if (normEmail && !emailToId.has(normEmail)) {
          emailToId.set(normEmail, targetId)
        }
      }
    } else if (normEmail) {
      if (emailToId.has(normEmail)) {
        targetId = emailToId.get(normEmail)
      } else {
        targetId = `cust_email_${encodeURIComponent(normEmail)}`
        emailToId.set(normEmail, targetId)
      }
    } else {
      targetId = `cust_reg_${reg.id || Math.random().toString(36).slice(2)}`
    }

    let customer = customerMap.get(targetId)
    if (!customer) {
      customer = createCustomerEntity(targetId, {
        name: (reg.name || reg.customer_name || '').trim(),
        company: (reg.company || '').trim(),
        normalizedPhone: normPhone,
        email: normEmail,
        address: (reg.address || '').trim() || null,
        date: regDate,
        is_regular: true,
        permanentCustomerId: reg.id || null,
        customer_type: reg.customer_type || 'Individual',
        gst_number: reg.gst_number || null,
        notes: reg.notes || null
      })
      customerMap.set(targetId, customer)
    } else {
      customer.isRegularCustomer = true
      if (reg.id) customer.permanentCustomerId = reg.id
      if (reg.customer_type) customer.customerType = reg.customer_type
      if (reg.gst_number) customer.gstNumber = reg.gst_number
      if (reg.notes && !customer.notes) customer.notes = reg.notes
      if (!customer.address && reg.address) customer.address = reg.address
      if ((!customer.name || customer.name === 'Valued Customer') && reg.name) customer.name = reg.name
      if (!customer.company && reg.company) customer.company = reg.company
    }
  }

  // 1. Ingest permanent regular customers first (canonical CRM identities)
  for (const reg of safeRegular) {
    ingestRegularCustomer(reg)
  }

  // 2. Ingest all orders (high commercial fidelity)
  for (const ord of safeOrders) {
    ingestRecord(ord, 'order')
  }

  // 3. Ingest all enquiries (leads and service tickets)
  for (const enq of safeEnquiries) {
    ingestRecord(enq, 'enquiry')
  }

  // Final summary pass
  const result = []
  for (const customer of customerMap.values()) {
    // Sort linked records descending by date
    customer.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    customer.enquiries.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

    // Derive calculated indicators
    customer.isRepeatCustomer = (customer.totalOrders + customer.totalEnquiries) >= 2
    customer.hasActiveEnquiry = customer.openEnquiriesCount > 0
    customer.isHighValue = customer.totalSpend >= 50000

    result.push(customer)
  }

  // Sort customer list: most recently active customers first
  result.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))

  return result
}

/**
 * Filters and searches customer profiles based on text query, category filter, and role permissions.
 *
 * @param {Array<Object>} customers
 * @param {Object} options
 * @param {string} [options.query='']
 * @param {string} [options.filter='all'] ('all' | 'repeat' | 'active_enquiry' | 'high_value')
 * @param {Object} [options.rolePermissions={}]
 * @returns {Array<Object>}
 */
export function filterCustomers(customers, { query = '', filter = 'all', rolePermissions = {} } = {}) {
  if (!Array.isArray(customers)) return []

  const q = String(query || '').trim().toLowerCase()
  const f = String(filter || 'all').toLowerCase()
  const canFinancials = Boolean(rolePermissions.canViewFinancials)

  return customers.filter((cust) => {
    // 1. Text Search matching across Name, Company, Phone, and Email
    if (q) {
      const matchName = cust.name && cust.name.toLowerCase().includes(q)
      const matchCompany = cust.company && cust.company.toLowerCase().includes(q)
      const matchEmail = cust.email && cust.email.toLowerCase().includes(q)
      const matchPhone = cust.normalizedPhone && cust.normalizedPhone.includes(q)
      const matchFormattedPhone = cust.formattedPhone && cust.formattedPhone.replace(/\s/g, '').includes(q)
      if (!matchName && !matchCompany && !matchEmail && !matchPhone && !matchFormattedPhone) {
        return false
      }
    }

    // 2. Category Filter
    if (f === 'repeat') {
      return cust.isRepeatCustomer
    }
    if (f === 'active_enquiry') {
      return cust.hasActiveEnquiry
    }
    if (f === 'regular') {
      return Boolean(cust.isRegularCustomer)
    }
    if (f === 'high_value') {
      // If role cannot view financials, high_value filter is excluded
      return canFinancials ? cust.isHighValue : false
    }

    return true
  })
}

/**
 * Detects potential duplicate customers from existing aggregated CRM profiles.
 * Used for instant duplicate suggestions in enquiry & order creation forms.
 *
 * Scored Matching Invariants:
 * - Exact 10-digit Indian mobile number: Confidence 100
 * - Exact normalized email address: Confidence 90
 * - Matching company name (>= 3 chars): Confidence 75
 * - Matching customer name (>= 3 chars, non-generic): Confidence 60
 *
 * @param {Object} candidate - Candidate customer details entered in form
 * @param {string} [candidate.name='']
 * @param {string} [candidate.phone='']
 * @param {string} [candidate.email='']
 * @param {string} [candidate.company='']
 * @param {Array<Object>} existingCustomers - Aggregated customer entities
 * @returns {Array<Object>} Matches sorted by confidence descending (max 5)
 */
export function detectDuplicateCustomers(candidate = {}, existingCustomers = []) {
  if (!candidate || typeof candidate !== 'object') return []
  if (!Array.isArray(existingCustomers) || existingCustomers.length === 0) return []

  const { name = '', phone = '', email = '', company = '' } = candidate
  const normPhone = normalizeIndianPhone10Digit(phone)
  const normEmail = normalizeCustomerEmail(email)
  const cleanName = String(name || '').trim().toLowerCase()
  const cleanComp = String(company || '').trim().toLowerCase()

  // If no substantial input, return empty matches
  if (!normPhone && !normEmail && cleanName.length < 3 && cleanComp.length < 3) {
    return []
  }

  const matches = []

  for (const cust of existingCustomers) {
    let confidence = 0
    const reasons = []

    // 1. Mobile Phone match (exact 10-digit Indian phone)
    if (normPhone && (cust.normalizedPhone === normPhone || (cust.phones && cust.phones.includes(normPhone)))) {
      confidence = Math.max(confidence, 100)
      reasons.push(`Matching Mobile Number (${formatIndianPhoneDisplay(normPhone)})`)
    }

    // 2. Email match
    if (normEmail && (cust.email === normEmail || (cust.emails && cust.emails.includes(normEmail)))) {
      confidence = Math.max(confidence, 90)
      reasons.push(`Matching Email Address (${normEmail})`)
    }

    // 3. Company match (exact or substring)
    if (cleanComp && cleanComp.length >= 3 && cust.company) {
      const custComp = cust.company.toLowerCase()
      if (custComp === cleanComp || (cleanComp.length >= 4 && (custComp.includes(cleanComp) || cleanComp.includes(custComp)))) {
        confidence = Math.max(confidence, 75)
        reasons.push(`Matching Company (${cust.company})`)
      }
    }

    // 4. Name match (non-generic)
    if (
      cleanName &&
      cleanName.length >= 3 &&
      cleanName !== 'customer' &&
      cleanName !== 'valued customer' &&
      cust.name &&
      cust.name.toLowerCase() === cleanName
    ) {
      confidence = Math.max(confidence, 60)
      reasons.push(`Identical Customer Name (${cust.name})`)
    }

    if (confidence > 0) {
      matches.push({
        customer: cust,
        confidence,
        score: confidence,
        reason: reasons.join(' & '),
        matchReasons: reasons,
        matchType: confidence >= 90 ? 'exact' : 'potential'
      })
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

/**
 * Builds a unified, chronological interaction timeline for a single customer 360° view.
 * Combines order events, enquiry events, and corresponding activity records.
 *
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Array} [params.enquiryActivities=[]]
 * @param {Array} [params.orderActivities=[]]
 * @returns {Array<Object>} Chronological events sorted descending
 */
export function buildCustomerTimeline({ customer, enquiryActivities = [], orderActivities = [] }) {
  if (!customer) return []

  const events = []

  // 1. Order Milestones
  for (const ord of customer.orders || []) {
    const orderRef = ord.order_number || ord.order_ref || ord.id
    events.push({
      id: `ord_${ord.id || orderRef}`,
      type: 'order_placed',
      title: `Order Placed (#${orderRef})`,
      timestamp: ord.created_at || new Date().toISOString(),
      actorName: ord.created_by_name || 'System / Sales',
      actorRole: 'sales',
      sourceType: 'order',
      amount: ord.total_amount,
      status: ord.order_status,
      summary: `Order created with ${ord.items_count || 1} item(s). Status: ${ord.order_status || 'CONFIRMED'}.`
    })

    if (ord.order_payments && Array.isArray(ord.order_payments)) {
      for (const p of ord.order_payments) {
        events.push({
          id: `pay_${p.id}`,
          type: 'payment_received',
          title: `Payment Received (#${orderRef})`,
          timestamp: p.received_at || p.created_at,
          actorName: p.received_by_name || 'Accounts',
          actorRole: 'account',
          sourceType: 'payment',
          amount: p.amount,
          summary: `Payment of ${formatINR(p.amount)} recorded via ${p.payment_method || 'Online / Cash'}. Reference: ${p.transaction_reference || 'N/A'}`
        })
      }
    }
  }

  // 2. Enquiry & Service Milestones
  for (const enq of customer.enquiries || []) {
    const enqRef = enq.enquiry_id || enq.id
    const isService = Boolean(enq.service_details || enq.is_service_request)
    events.push({
      id: `enq_${enq.id || enqRef}`,
      type: isService ? 'service_ticket_created' : 'enquiry_received',
      title: isService ? `Service Ticket Logged (#${enqRef})` : `Enquiry Received (#${enqRef})`,
      timestamp: enq.created_at || new Date().toISOString(),
      actorName: enq.assigned_employee_name || 'Customer Web Portal',
      actorRole: enq.assigned_to ? 'assigned_staff' : 'customer',
      sourceType: isService ? 'service' : 'enquiry',
      status: enq.workflow_tab || enq.status,
      summary: enq.requirement || enq.problem_description || 'Customer enquiry submitted.'
    })
  }

  // 3. Enquiry Activity Records
  for (const act of enquiryActivities || []) {
    events.push({
      id: `enq_act_${act.id}`,
      type: act.activity_type || 'enquiry_activity',
      title: `Enquiry Update: ${act.activity_type ? act.activity_type.replace(/_/g, ' ') : 'Note'}`,
      timestamp: act.created_at,
      actorName: act.actor_email || act.actor_role || 'Staff Member',
      actorRole: act.actor_role || 'staff',
      sourceType: 'activity',
      summary: act.content || act.message || JSON.stringify(act.metadata || '')
    })
  }

  // 4. Order Activity Records
  for (const act of orderActivities || []) {
    events.push({
      id: `ord_act_${act.id}`,
      type: act.activity_type || 'order_activity',
      title: `Order Update: ${act.activity_type ? act.activity_type.replace(/_/g, ' ') : 'Note'}`,
      timestamp: act.created_at,
      actorName: act.actor_name || act.actor_role || 'Staff Member',
      actorRole: act.actor_role || 'staff',
      sourceType: 'activity',
      summary: act.message || act.content || ''
    })
  }

  // Sort descending by timestamp
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  return events
}
