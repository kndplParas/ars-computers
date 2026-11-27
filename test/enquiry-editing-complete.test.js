import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeIndianPhone10Digit } from '../src/utils/customerCrmAggregator.js'
import { parseServiceEnquiry } from '../src/utils/serviceEnquiryHelper.js'

/**
 * ============================================================================
 * ARS Computers — Complete Enquiry Editing Security & Invariant Test Suite
 * ============================================================================
 * NOTE: These are Node.js unit / behavioral simulation tests that verify the
 * algorithms, validation rules, delta tracking, and state-machine logic.
 * Real PostgreSQL integration testing requires an active PostgreSQL test instance.
 * ============================================================================
 */

// Simulated PostgreSQL Trigger: protect_enquiry_customer_and_archive_immutability()
// Mirrors the exact PL/pgSQL logic with private ledger-based authorization
function simulatePostgresImmutabilityTrigger(oldRow, newRow, privateLedger = [], currentUser = null) {
  // RULE 1: Core primary key and immutable provenance
  if (newRow.id !== oldRow.id) {
    throw new Error('Immutability violation: enquiry id cannot be modified.')
  }
  if (oldRow.enquiry_number && newRow.enquiry_number !== oldRow.enquiry_number) {
    throw new Error('Immutability violation: enquiry_number cannot be modified.')
  }
  if (newRow.created_at !== oldRow.created_at) {
    throw new Error('Immutability violation: original created_at timestamp cannot be modified.')
  }

  // RULE 2: Independent Transaction Ledger Verification
  // Atomically check and consume the single-use authorization token recorded by update_enquiry_details().
  let isAuthorizedEdit = false
  let isAuthorizedSuperadmin = false

  if (currentUser && currentUser.id) {
    const ledgerIndex = privateLedger.findIndex(
      (entry) => entry.enquiry_id === oldRow.id && entry.actor_id === currentUser.id
    )

    if (ledgerIndex !== -1) {
      // Consume the single-use token (DELETE ... RETURNING)
      privateLedger.splice(ledgerIndex, 1)
      isAuthorizedEdit = true

      if (currentUser.is_active !== false && currentUser.role === 'superadmin') {
        isAuthorizedSuperadmin = true
      }
    }
  }

  // RULE 3: Permanent archive protections once completion has been approved
  if (oldRow.completion_approved_at) {
    if (!isAuthorizedSuperadmin) {
      throw new Error('Permanent archive protection: Approved completed enquiries cannot be modified.')
    }

    // Provenance is strictly locked even for Superadmin:
    if (newRow.completion_approved_at !== oldRow.completion_approved_at) {
      throw new Error('Permanent archive protection: completion_approved_at timestamp cannot be modified.')
    }
    if (newRow.completion_approved_by !== oldRow.completion_approved_by) {
      throw new Error('Permanent archive protection: Head approval identity UUID cannot be modified.')
    }
    if (newRow.approved_by_name !== oldRow.approved_by_name) {
      throw new Error('Permanent archive protection: Head approval name snapshot cannot be modified.')
    }
    if (newRow.approved_by_employee_code !== oldRow.approved_by_employee_code) {
      throw new Error('Permanent archive protection: Head approval employee code snapshot cannot be modified.')
    }
    if (newRow.completed_by_name !== oldRow.completed_by_name) {
      throw new Error('Permanent archive protection: Employee completion name snapshot cannot be modified.')
    }
    if (newRow.completed_by_employee_code !== oldRow.completed_by_employee_code) {
      throw new Error('Permanent archive protection: Employee completion code snapshot cannot be modified.')
    }
    if (newRow.completion_requested_at !== oldRow.completion_requested_at) {
      throw new Error('Permanent archive protection: Completion timestamp cannot be modified.')
    }
    if (newRow.completion_summary !== oldRow.completion_summary) {
      throw new Error('Permanent archive protection: Completion summary cannot be modified.')
    }
    if (oldRow.is_archived === true && newRow.is_archived === false) {
      throw new Error('Permanent archive protection: Approved completed enquiries cannot be unarchived or reopened.')
    }
    if (oldRow.status === 'completed' && newRow.status !== 'completed') {
      throw new Error('Permanent archive protection: Approved completed enquiries cannot change status.')
    }
    if (newRow.is_in_bin === true || newRow.scheduled_deletion_at) {
      throw new Error('Permanent archive protection: Approved completed enquiries cannot enter Bin or have scheduled deletion.')
    }
    if (newRow.is_removed === true && !oldRow.is_removed) {
      throw new Error('Permanent record protection: Completed and approved enquiries cannot be removed.')
    }

    // Strict Assignment Immutability on Completed Records (from Phase 2 Hardening)
    if (newRow.assigned_employee_id !== oldRow.assigned_employee_id ||
        newRow.assigned_employee_name !== oldRow.assigned_employee_name ||
        newRow.assigned_employee_code !== oldRow.assigned_employee_code ||
        newRow.assigned_employee_phone !== oldRow.assigned_employee_phone ||
        newRow.assigned_engineer_aadhaar !== oldRow.assigned_engineer_aadhaar ||
        newRow.expected_visit_at !== oldRow.expected_visit_at ||
        newRow.assignment_visit_note !== oldRow.assignment_visit_note ||
        newRow.assigned_at !== oldRow.assigned_at ||
        newRow.assigned_by !== oldRow.assigned_by ||
        newRow.assigned_by_name !== oldRow.assigned_by_name ||
        newRow.assigned_by_employee_code !== oldRow.assigned_by_employee_code) {
      throw new Error('Permanent archive protection: Assignment attributes cannot be modified on approved completed enquiries.')
    }
  }

  // RULE 4: Direct unauthorized SQL modification of customer-submitted, service, and admin notes fields is strictly blocked
  if (!isAuthorizedEdit) {
    if (newRow.name !== oldRow.name ||
        newRow.customer_name !== oldRow.customer_name ||
        newRow.customer_phone !== oldRow.customer_phone ||
        newRow.customer_email !== oldRow.customer_email ||
        newRow.customer_address !== oldRow.customer_address ||
        newRow.company !== oldRow.company ||
        newRow.contact_info !== oldRow.contact_info ||
        newRow.message !== oldRow.message ||
        newRow.category_interest !== oldRow.category_interest ||
        newRow.enquiry_type !== oldRow.enquiry_type ||
        newRow.service_requested !== oldRow.service_requested ||
        JSON.stringify(newRow.service_details) !== JSON.stringify(oldRow.service_details) ||
        newRow.admin_notes !== oldRow.admin_notes) {
      throw new Error('Immutability violation: customer-submitted, service, and admin detail fields can only be modified through update_enquiry_details().')
    }
  }

  return newRow
}

// Simulated PostgreSQL RPC & Provider Handler
function createEnquiryEditHandler(enquiriesList, currentUser, options = {}) {
  let demoEnquiries = JSON.parse(JSON.stringify(enquiriesList))
  let recordedActivities = []
  let recordedAuditLogs = []
  let privateLedger = []

  const updateEnquiryDetails = async ({
    enquiryId,
    customer_name,
    customer_phone,
    customer_email,
    company,
    customer_address,
    category_interest,
    enquiry_type,
    service_requested,
    message,
    admin_notes,
    service_details,
    edit_summary,
    cleared_fields = []
  }) => {
    // Transaction snapshot for rollback simulation
    const initialEnquiriesSnapshot = JSON.parse(JSON.stringify(demoEnquiries))
    const initialActivitiesSnapshot = JSON.parse(JSON.stringify(recordedActivities))
    const initialAuditLogsSnapshot = JSON.parse(JSON.stringify(recordedAuditLogs))
    const initialLedgerSnapshot = JSON.parse(JSON.stringify(privateLedger))

    try {
      // 1. Authenticate caller & verify active status
      if (!currentUser || !currentUser.id) {
        throw new Error('Authentication required to edit enquiries.')
      }
      if (currentUser.is_active === false) {
        throw new Error('Access denied: Staff account is inactive.')
      }

      const role = (currentUser?.role || '').toLowerCase()
      const isSuperadmin = role === 'superadmin'
      const CAN_EDIT_ENQUIRY_ROLES = ['superadmin', 'admin', 'technical', 'engineer', 'hr', 'account']

      if (!CAN_EDIT_ENQUIRY_ROLES.includes(role)) {
        throw new Error('Access denied: Enquiry editing is restricted to authorized administrative staff.')
      }

      const target = demoEnquiries.find((e) => e.id === enquiryId)
      if (!target) throw new Error('Enquiry not found.')
      if (target.is_in_bin || target.status === 'in_bin') {
        throw new Error('Cannot edit an enquiry currently in the Bin.')
      }
      if (target.is_removed) {
        throw new Error('Cannot edit a removed enquiry record.')
      }
      const isApproved = Boolean(target.completion_approved_at || target.status === 'completed')
      if (isApproved && !isSuperadmin) {
        throw new Error('Enquiry completion has already been approved by Head Admin. Editing completed records is strictly restricted to Head-Person.')
      }
      if ((target.status === 'rejected' || target.status === 'closed') && !isSuperadmin) {
        throw new Error('Editing closed or rejected enquiries is restricted to Head-Person (Super Admin).')
      }

      // 2. Validate cleared fields: Mandatory fields can NEVER be cleared
      const effectiveCleared = Array.isArray(cleared_fields) ? [...cleared_fields] : []
      for (const field of effectiveCleared) {
        if (['customer_name', 'name', 'customer_phone', 'category_interest', 'enquiry_type', 'message'].includes(field)) {
          throw new Error(`Mandatory field "${field}" cannot be cleared.`)
        }
      }

      // 3. Process fields & detect deltas
      const changedFields = []
      const updatedFields = {}

      // Customer Name (Mandatory)
      if (customer_name !== undefined) {
        const cleanName = customer_name.trim()
        if (cleanName.length < 2) throw new Error('Customer Name must be at least 2 characters.')
        if (cleanName !== (target.customer_name || target.name)) {
          changedFields.push('customer_name')
          updatedFields.name = cleanName
          updatedFields.customer_name = cleanName
        }
      }

      // Customer Phone (Mandatory Indian 10-digit)
      if (customer_phone !== undefined) {
        const cleanPhone = normalizeIndianPhone10Digit(customer_phone)
        if (!cleanPhone) throw new Error('Customer Phone must be a valid 10-digit Indian mobile number.')
        if (cleanPhone !== target.customer_phone) {
          changedFields.push('customer_phone')
          updatedFields.customer_phone = cleanPhone
        }
      }

      // Customer Email (Optional: can be cleared)
      if (effectiveCleared.includes('customer_email') || customer_email === '') {
        if (target.customer_email !== null) {
          changedFields.push('customer_email')
          updatedFields.customer_email = null
        }
      } else if (customer_email !== undefined && customer_email !== target.customer_email) {
        const cleanEmail = customer_email.toLowerCase().trim()
        if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanEmail)) {
          throw new Error('Customer Email format is invalid.')
        }
        changedFields.push('customer_email')
        updatedFields.customer_email = cleanEmail
      }

      // Company (Optional: can be cleared)
      if (effectiveCleared.includes('company') || company === '') {
        if (target.company !== null) {
          changedFields.push('company')
          updatedFields.company = null
        }
      } else if (company !== undefined && company !== target.company) {
        changedFields.push('company')
        updatedFields.company = company.trim()
      }

      // Customer Address (Optional: can be cleared)
      if (effectiveCleared.includes('customer_address') || customer_address === '') {
        if (target.customer_address !== null) {
          changedFields.push('customer_address')
          updatedFields.customer_address = null
        }
      } else if (customer_address !== undefined && customer_address !== target.customer_address) {
        changedFields.push('customer_address')
        updatedFields.customer_address = customer_address.trim()
      }

      // Category Interest (Mandatory)
      if (category_interest !== undefined && category_interest !== target.category_interest) {
        const cleanCat = category_interest.trim()
        if (cleanCat.length < 2) throw new Error('Category interest must be at least 2 characters.')
        changedFields.push('category_interest')
        updatedFields.category_interest = cleanCat
      }

      // Enquiry Type (Mandatory enum)
      if (enquiry_type !== undefined && enquiry_type !== target.enquiry_type) {
        if (!['general', 'product', 'quotation', 'service_request'].includes(enquiry_type)) {
          throw new Error('Invalid enquiry type specified.')
        }
        changedFields.push('enquiry_type')
        updatedFields.enquiry_type = enquiry_type
      }

      // Service Requested (Optional: can be cleared)
      if (effectiveCleared.includes('service_requested') || service_requested === '') {
        if (target.service_requested !== null) {
          changedFields.push('service_requested')
          updatedFields.service_requested = null
        }
      } else if (service_requested !== undefined && service_requested !== target.service_requested) {
        changedFields.push('service_requested')
        updatedFields.service_requested = service_requested.trim()
      }

      // Message (Mandatory)
      if (message !== undefined && message !== target.message) {
        const cleanMsg = message.trim()
        if (cleanMsg.length < 3) throw new Error('Enquiry message must be at least 3 characters.')
        changedFields.push('message')
        updatedFields.message = cleanMsg
      }

      // Admin Notes (Optional: can be cleared)
      if (effectiveCleared.includes('admin_notes') || admin_notes === '') {
        if (target.admin_notes !== null) {
          changedFields.push('admin_notes')
          updatedFields.admin_notes = null
        }
      } else if (admin_notes !== undefined && admin_notes !== target.admin_notes) {
        changedFields.push('admin_notes')
        updatedFields.admin_notes = admin_notes.trim()
      }

      // Service Details JSONB
      if (service_details !== undefined) {
        const mergedSd = { ...(target.service_details || {}), ...service_details }
        if (JSON.stringify(mergedSd) !== JSON.stringify(target.service_details)) {
          changedFields.push('service_details')
          updatedFields.service_details = mergedSd
        }
      }

      if (changedFields.length === 0) {
        return { success: true, enquiry_id: enquiryId, changed_fields: [], message: 'No changes detected.' }
      }

      // Synchronize contact_info
      const finalPhone = updatedFields.customer_phone !== undefined ? updatedFields.customer_phone : target.customer_phone
      const finalEmail = updatedFields.customer_email !== undefined ? updatedFields.customer_email : target.customer_email
      if (finalPhone && finalEmail) {
        updatedFields.contact_info = `${finalPhone} | ${finalEmail}`
      } else if (finalPhone) {
        updatedFields.contact_info = finalPhone
      } else {
        updatedFields.contact_info = finalEmail || 'Not Provided'
      }

      updatedFields.updated_at = new Date().toISOString()

      // 4. Authorize in Private Ledger before updating
      privateLedger.push({
        enquiry_id: enquiryId,
        actor_id: currentUser.id,
        nonce: Math.random().toString(36).slice(2),
        authorized_at: new Date()
      })

      // 5. Trigger Check: Must pass independent ledger verification
      const candidateRow = { ...target, ...updatedFields }
      simulatePostgresImmutabilityTrigger(target, candidateRow, privateLedger, currentUser)

      // 6. Atomic Audit Logging Simulation
      if (options.simulateAuditFailure) {
        throw new Error('Database error: Failed to insert audit log entry (simulated disk/constraint failure).')
      }

      const auditLogEntry = {
        id: 'audit-' + Math.random().toString(36).slice(2),
        actor_id: currentUser.id,
        actor_email: currentUser.email || null,
        actor_role: currentUser.role,
        action: 'UPDATE',
        entity_type: 'enquiries',
        entity_id: enquiryId,
        old_values: Object.fromEntries(changedFields.map(k => [k, target[k]])),
        new_values: Object.fromEntries(changedFields.map(k => [k, updatedFields[k]])),
        created_at: new Date().toISOString()
      }
      recordedAuditLogs.push(auditLogEntry)

      let activitySummary
      if (edit_summary && edit_summary.trim() !== '') {
        activitySummary = edit_summary.trim().slice(0, 3000)
      } else {
        const generated = `Enquiry details updated (${changedFields.join(', ')})`
        if (generated.length > 3000) {
          activitySummary = generated.slice(0, 2997) + '...'
        } else {
          activitySummary = generated
        }
      }
      if (!activitySummary || activitySummary.trim() === '') {
        activitySummary = 'Enquiry details updated'
      }

      // Enforce DB constraint: char_length(trim(content)) >= 1 AND char_length(content) <= 3000
      if (activitySummary.trim().length < 1 || activitySummary.length > 3000) {
        throw new Error('Database constraint violation: enquiry_activities content must be between 1 and 3000 characters.')
      }

      const newActivity = {
        id: 'act-' + Math.random().toString(36).slice(2),
        enquiry_id: enquiryId,
        actor_id: currentUser?.id || null,
        actor_email: currentUser?.email || null,
        actor_role: currentUser?.role || 'staff',
        activity_type: 'note',
        content: activitySummary,
        metadata: {
          action: 'ENQUIRY_DETAILS_EDITED',
          changed_fields: changedFields,
          is_privileged_correction: (isApproved && isSuperadmin)
        },
        created_at: new Date().toISOString()
      }
      recordedActivities.push(newActivity)

      // Apply update to records
      demoEnquiries = demoEnquiries.map((e) => (e.id === enquiryId ? { ...e, ...updatedFields } : e))

      return {
        success: true,
        enquiry_id: enquiryId,
        changed_fields: changedFields,
        activity: newActivity,
        is_privileged_correction: (isApproved && isSuperadmin),
        message: isApproved && isSuperadmin
          ? 'Superadministrator privileged correction saved and recorded in audit log.'
          : 'Enquiry details updated successfully.'
      }
    } catch (err) {
      // Transaction Rollback: Any failure reverts enquiry, audit, and ledger state completely
      demoEnquiries = initialEnquiriesSnapshot
      recordedActivities = initialActivitiesSnapshot
      recordedAuditLogs = initialAuditLogsSnapshot
      privateLedger = initialLedgerSnapshot
      throw err
    }
  }

  return {
    getEnquiries: () => demoEnquiries,
    getActivities: () => recordedActivities,
    getAuditLogs: () => recordedAuditLogs,
    getLedger: () => privateLedger,
    updateEnquiryDetails
  }
}

// ----------------------------------------------------------------------------
// TEST CASES
// ----------------------------------------------------------------------------

test('1. Validation: Phone normalization and format enforcement', () => {
  assert.equal(normalizeIndianPhone10Digit('9876543210'), '9876543210')
  assert.equal(normalizeIndianPhone10Digit('+91 98765 43210'), '9876543210')
  assert.equal(normalizeIndianPhone10Digit('09876543210'), '9876543210')
  assert.equal(normalizeIndianPhone10Digit('919876543210'), '9876543210')

  assert.equal(normalizeIndianPhone10Digit('12345'), null)
  assert.equal(normalizeIndianPhone10Digit('5555555555'), null)
  assert.equal(normalizeIndianPhone10Digit(''), null)
})

test('2. Authorized RPC update: Atomic field update, ledger consumption, and dual audit creation', async () => {
  const initialEnquiry = {
    id: 'enq-101',
    customer_name: 'Rahul Sharma',
    customer_phone: '9876543210',
    customer_email: 'rahul@example.com',
    contact_info: '9876543210 | rahul@example.com',
    status: 'in_progress',
    service_requested: 'Laptop Screen Repair'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'usr-tech-1', role: 'technical', name: 'Tech Engineer' })

  const res = await handler.updateEnquiryDetails({
    enquiryId: 'enq-101',
    customer_name: 'Rahul V. Sharma'
  })

  assert.equal(res.success, true)
  assert.deepEqual(res.changed_fields, ['customer_name'])
  assert.equal(res.is_privileged_correction, false)

  const updated = handler.getEnquiries()[0]
  assert.equal(updated.customer_name, 'Rahul V. Sharma')
  assert.equal(updated.customer_phone, '9876543210') // Preserved

  // Ledger entry was consumed (deleted)
  assert.equal(handler.getLedger().length, 0)

  // Both audit_logs and enquiry_activities were created
  const auditLogs = handler.getAuditLogs()
  assert.equal(auditLogs.length, 1)
  assert.equal(auditLogs[0].action, 'UPDATE')
  assert.equal(auditLogs[0].old_values.customer_name, 'Rahul Sharma')
  assert.equal(auditLogs[0].new_values.customer_name, 'Rahul V. Sharma')

  const activities = handler.getActivities()
  assert.equal(activities.length, 1)
  assert.equal(activities[0].metadata.action, 'ENQUIRY_DETAILS_EDITED')
  assert.deepEqual(activities[0].metadata.changed_fields, ['customer_name'])
})

test('3. Multi-field update: Batch edits across all enquiry sections atomically', async () => {
  const initialEnquiry = {
    id: 'enq-102',
    customer_name: 'Amit Patel',
    customer_phone: '9876543211',
    customer_email: 'amit@patel.in',
    company: 'Patel Trading',
    customer_address: 'Alkapuri, Vadodara',
    category_interest: 'General / Other',
    enquiry_type: 'general',
    message: 'Need general assistance',
    status: 'new'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'usr-admin-1', role: 'admin', name: 'Admin Staff' })

  const res = await handler.updateEnquiryDetails({
    enquiryId: 'enq-102',
    customer_name: 'Amit B. Patel',
    customer_phone: '9876543299',
    customer_email: 'amit.patel@corporate.in',
    company: 'Patel Enterprises Ltd',
    customer_address: 'Race Course Road, Vadodara, Gujarat 390007',
    category_interest: 'Laptops & Computers',
    enquiry_type: 'quotation',
    service_requested: '5x Commercial Laptops for Office',
    message: 'Looking for bulk quotation on 5x Dell Latitude laptops with 3-year onsite warranty.',
    edit_summary: 'Updated to formal bulk quotation after phone call'
  })

  assert.equal(res.success, true)
  assert.equal(res.changed_fields.length, 9)

  const updated = handler.getEnquiries()[0]
  assert.equal(updated.customer_name, 'Amit B. Patel')
  assert.equal(updated.customer_phone, '9876543299')
  assert.equal(updated.contact_info, '9876543299 | amit.patel@corporate.in')
  assert.equal(updated.company, 'Patel Enterprises Ltd')
})

test('4. Service/Repair specifications: Deep JSONB merging preserves unedited specs', async () => {
  const initialEnquiry = {
    id: 'enq-103',
    customer_name: 'Deepak Joshi',
    enquiry_type: 'service_request',
    service_details: {
      ticket_number: 'ARS-SR-9988',
      customer_type: 'Individual',
      brand: 'HP',
      model_number: 'Pavilion 15',
      service_location: 'In-shop'
    },
    status: 'new'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'usr-eng-1', role: 'engineer', name: 'Hardware Engineer' })

  const res = await handler.updateEnquiryDetails({
    enquiryId: 'enq-103',
    service_details: {
      serial_number: 'HP-CND12345XYZ',
      invoice_number: 'INV-2026-908',
      purchase_date: '2025-08-15',
      diagnostics: 'Hard drive clicking sound, boot failure (SMART 301)'
    }
  })

  assert.equal(res.success, true)
  const updated = handler.getEnquiries()[0]

  assert.equal(updated.service_details.ticket_number, 'ARS-SR-9988')
  assert.equal(updated.service_details.brand, 'HP')
  assert.equal(updated.service_details.serial_number, 'HP-CND12345XYZ')
  assert.equal(updated.service_details.diagnostics, 'Hard drive clicking sound, boot failure (SMART 301)')

  const sm = parseServiceEnquiry(updated)
  assert.equal(sm.isService, true)
  assert.equal(sm.brandModel, 'HP / Pavilion 15')
})

test('5. Permissions: Inactive staff accounts are strictly rejected', async () => {
  const activeEnquiry = { id: 'enq-104', customer_name: 'Karan', status: 'new' }
  const inactiveHandler = createEnquiryEditHandler([activeEnquiry], { id: 'usr-inactive', role: 'technical', is_active: false })

  await assert.rejects(
    () => inactiveHandler.updateEnquiryDetails({ enquiryId: 'enq-104', customer_name: 'Should Fail' }),
    /Access denied: Staff account is inactive/
  )
})

test('6. Permissions: Authorized staff roles allowed, unauthorized role blocked', async () => {
  const activeEnquiry = { id: 'enq-105', customer_name: 'Karan', status: 'new' }

  for (const role of ['admin', 'technical', 'engineer', 'hr', 'account', 'superadmin']) {
    const handler = createEnquiryEditHandler([activeEnquiry], { id: 'usr-' + role, role, name: role, is_active: true })
    const res = await handler.updateEnquiryDetails({ enquiryId: 'enq-105', customer_name: 'Karan ' + role })
    assert.equal(res.success, true)
  }

  const inventoryHandler = createEnquiryEditHandler([activeEnquiry], { id: 'usr-inv', role: 'inventory_staff', is_active: true })
  await assert.rejects(
    () => inventoryHandler.updateEnquiryDetails({ enquiryId: 'enq-105', customer_name: 'Hacked' }),
    /Access denied: Enquiry editing is restricted to authorized administrative staff/
  )
})

test('7. Anti-Bypass Security: Attempts to bypass RPC via direct SQL or forged settings fail (Ledger is empty)', () => {
  const originalRow = {
    id: 'enq-201',
    enquiry_number: 'ARS-ENQ-2026-001',
    created_at: '2026-11-01T10:00:00Z',
    name: 'Original Customer',
    customer_name: 'Original Customer',
    customer_phone: '9876543210',
    contact_info: '9876543210',
    message: 'Original message',
    category_interest: 'Laptops'
  }

  const tamperedRow = {
    ...originalRow,
    name: 'Tampered Customer Name',
    customer_phone: '9999999999'
  }

  // Caller runs direct SQL in psql/editor (empty private ledger)
  // Even if they attempt custom GUCs or wrappers, the private ledger has no matching entry
  const emptyLedger = []
  const activeSuperadmin = { id: 'superadmin-uuid', role: 'superadmin', is_active: true }

  assert.throws(
    () => simulatePostgresImmutabilityTrigger(originalRow, tamperedRow, emptyLedger, activeSuperadmin),
    /Immutability violation: customer-submitted, service, and admin detail fields can only be modified through update_enquiry_details\(\)/
  )
})

test('8. Direct SQL Update Rejection: Direct table UPDATE blocked even for Superadmin', () => {
  const originalRow = {
    id: 'enq-202',
    name: 'Legit Customer',
    customer_name: 'Legit Customer',
    customer_phone: '9876543210',
    message: 'Legit requirement'
  }

  const directSqlRow = {
    ...originalRow,
    customer_phone: '9123456789'
  }

  // Direct SQL update attempt outside the RPC (no ledger token)
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(originalRow, directSqlRow, [], { id: 'superadmin-1', role: 'superadmin', is_active: true }),
    /Immutability violation: customer-submitted, service, and admin detail fields can only be modified through update_enquiry_details\(\)/
  )
})

test('9. Admin Notes Protection: Direct SQL attempting to modify admin_notes is blocked by trigger', () => {
  const originalRow = {
    id: 'enq-202b',
    name: 'Customer Notes Check',
    admin_notes: 'Initial legitimate note'
  }

  const tamperedNotesRow = {
    ...originalRow,
    admin_notes: 'Forged or tampered note without audit trail'
  }

  // Direct SQL update attempt modifying admin_notes outside the RPC
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(originalRow, tamperedNotesRow, [], { id: 'admin-1', role: 'admin', is_active: true }),
    /Immutability violation: customer-submitted, service, and admin detail fields can only be modified through update_enquiry_details\(\)/
  )
})

test('10. Existing Workflow Compatibility: Dedicated procedures (self_assign, status) are NOT blocked', () => {
  const originalRow = {
    id: 'enq-202c',
    name: 'Customer Assignment Check',
    customer_phone: '9876543210',
    status: 'new',
    assigned_employee_id: null,
    assigned_employee_name: null
  }

  // Procedure self_assign_enquiry updates assigned_* and status on an active enquiry
  const assignedRow = {
    ...originalRow,
    status: 'in_progress',
    assigned_employee_id: 'emp-uuid-1',
    assigned_employee_name: 'Assigned Tech Engineer',
    assigned_at: new Date().toISOString()
  }

  // None of the 13 protected customer/notes fields changed -> Trigger allows workflow!
  const res = simulatePostgresImmutabilityTrigger(originalRow, assignedRow, [], { id: 'emp-uuid-1', role: 'engineer', is_active: true })
  assert.equal(res.status, 'in_progress')
  assert.equal(res.assigned_employee_name, 'Assigned Tech Engineer')
})

test('11. Superadmin Privileged Correction: Completion approval provenance strictly locked', () => {
  const approvedRow = {
    id: 'enq-203',
    enquiry_number: 'ARS-ENQ-2026-003',
    created_at: '2026-11-01T10:00:00Z',
    status: 'completed',
    completion_approved_at: '2026-11-15T12:00:00Z',
    completion_approved_by: 'head-uuid-1',
    approved_by_name: 'Head Admin',
    approved_by_employee_code: 'ARS-HQ-001',
    completed_by_name: 'Tech Person',
    completed_by_employee_code: 'ARS-ENG-005',
    completion_requested_at: '2026-11-14T10:00:00Z',
    completion_summary: 'Repaired and verified',
    is_archived: true
  }

  const superadminUser = { id: 'superadmin-uuid', role: 'superadmin', is_active: true }
  const authorizedLedger = [{ enquiry_id: 'enq-203', actor_id: 'superadmin-uuid' }]

  // 1. Modifying approved_by_name -> MUST BE REJECTED
  const tamperedApproval = { ...approvedRow, approved_by_name: 'Forged Head Name' }
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(approvedRow, tamperedApproval, [...authorizedLedger], superadminUser),
    /Permanent archive protection: Head approval name snapshot cannot be modified/
  )

  // 2. Modifying completion_approved_at timestamp -> MUST BE REJECTED
  const tamperedTimestamp = { ...approvedRow, completion_approved_at: '2026-11-20T12:00:00Z' }
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(approvedRow, tamperedTimestamp, [...authorizedLedger], superadminUser),
    /Permanent archive protection: completion_approved_at timestamp cannot be modified/
  )

  // 3. Reopening completed record (unarchiving) -> MUST BE REJECTED
  const tamperedArchive = { ...approvedRow, is_archived: false }
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(approvedRow, tamperedArchive, [...authorizedLedger], superadminUser),
    /Permanent archive protection: Approved completed enquiries cannot be unarchived or reopened/
  )
})

test('12. Assignment Immutability: Assignment attributes immutable on completed records', () => {
  const approvedRow = {
    id: 'enq-204',
    status: 'completed',
    completion_approved_at: '2026-11-15T12:00:00Z',
    assigned_employee_id: 'emp-101',
    assigned_employee_name: 'Original Engineer',
    assigned_employee_code: 'ARS-ENG-010',
    assigned_engineer_aadhaar: 'XXXX-XXXX-1234',
    is_archived: true
  }

  const superadminUser = { id: 'superadmin-uuid', role: 'superadmin', is_active: true }
  const authorizedLedger = [{ enquiry_id: 'enq-204', actor_id: 'superadmin-uuid' }]

  // Attempting to alter assigned engineer on a completed enquiry -> MUST BE REJECTED
  const tamperedAssignment = { ...approvedRow, assigned_employee_name: 'New Engineer' }
  assert.throws(
    () => simulatePostgresImmutabilityTrigger(approvedRow, tamperedAssignment, [...authorizedLedger], superadminUser),
    /Permanent archive protection: Assignment attributes cannot be modified on approved completed enquiries/
  )
})

test('13. Clearing optional fields: Explicit clearing works while omitted fields are preserved', async () => {
  const initialEnquiry = {
    id: 'enq-205',
    customer_name: 'Priya Verma',
    customer_phone: '9876543210',
    customer_email: 'priya@verma.com',
    company: 'Verma Solutions',
    customer_address: '123 Station Road, Anand',
    category_interest: 'Laptops',
    enquiry_type: 'general',
    service_requested: 'RAM Upgrade',
    admin_notes: 'Urgent task',
    message: 'Need RAM upgrade to 32GB',
    status: 'new'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'admin-1', role: 'admin', is_active: true })

  // Case A: Omit company and address -> they MUST be preserved
  await handler.updateEnquiryDetails({
    enquiryId: 'enq-205',
    customer_name: 'Priya K. Verma'
    // company, customer_address, customer_email are OMITTED
  })

  let current = handler.getEnquiries()[0]
  assert.equal(current.customer_name, 'Priya K. Verma')
  assert.equal(current.company, 'Verma Solutions') // PRESERVED!
  assert.equal(current.customer_address, '123 Station Road, Anand') // PRESERVED!

  // Case B: Explicitly clear company and admin_notes
  await handler.updateEnquiryDetails({
    enquiryId: 'enq-205',
    cleared_fields: ['company', 'admin_notes']
  })

  current = handler.getEnquiries()[0]
  assert.equal(current.company, null) // CLEARED!
  assert.equal(current.admin_notes, null) // CLEARED!
  assert.equal(current.customer_address, '123 Station Road, Anand') // Still preserved!
})

test('14. Mandatory field clearing rejection: Core identification cannot be cleared', async () => {
  const initialEnquiry = {
    id: 'enq-206',
    customer_name: 'Priya Verma',
    customer_phone: '9876543210',
    category_interest: 'Laptops',
    enquiry_type: 'general',
    message: 'Need RAM upgrade to 32GB',
    status: 'new'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'admin-1', role: 'admin', is_active: true })

  // Attempting to clear customer_name -> MUST BE REJECTED
  await assert.rejects(
    () => handler.updateEnquiryDetails({ enquiryId: 'enq-206', cleared_fields: ['customer_name'] }),
    /Mandatory field "customer_name" cannot be cleared/
  )

  // Attempting to clear customer_phone -> MUST BE REJECTED
  await assert.rejects(
    () => handler.updateEnquiryDetails({ enquiryId: 'enq-206', cleared_fields: ['customer_phone'] }),
    /Mandatory field "customer_phone" cannot be cleared/
  )

  // Attempting to clear message -> MUST BE REJECTED
  await assert.rejects(
    () => handler.updateEnquiryDetails({ enquiryId: 'enq-206', cleared_fields: ['message'] }),
    /Mandatory field "message" cannot be cleared/
  )
})

test('15. Audit Tampering Rejection: Audit logs and activity histories are strictly append-only', () => {
  // Simulate prevent_audit_log_tampering() from 20261024000001
  function simulatePreventAuditLogTampering(op, tableName) {
    if (['UPDATE', 'DELETE', 'TRUNCATE'].includes(op)) {
      throw new Error(`Security violation: Audit logs and activity histories are strictly append-only and cannot be updated, deleted, or truncated. (${tableName})`)
    }
  }

  assert.throws(
    () => simulatePreventAuditLogTampering('UPDATE', 'audit_logs'),
    /strictly append-only/
  )

  assert.throws(
    () => simulatePreventAuditLogTampering('DELETE', 'enquiry_activities'),
    /strictly append-only/
  )
})

test('16. Audit Failure Atomicity: Failed audit log causes complete transaction rollback', async () => {
  const initialEnquiry = {
    id: 'enq-207',
    customer_name: 'Original Customer Name',
    customer_phone: '9876543210',
    status: 'new'
  }

  // Handler with simulated audit log failure (e.g. disk or constraint error on audit table)
  const failingHandler = createEnquiryEditHandler([initialEnquiry], { id: 'admin-1', role: 'admin', is_active: true }, {
    simulateAuditFailure: true
  })

  await assert.rejects(
    () => failingHandler.updateEnquiryDetails({
      enquiryId: 'enq-207',
      customer_name: 'Tampered Customer Name'
    }),
    /Failed to insert audit log entry/
  )

  // Verify full rollback: Enquiry record remains unchanged, no audit entries written
  const enquiries = failingHandler.getEnquiries()
  assert.equal(enquiries[0].customer_name, 'Original Customer Name')
  assert.equal(failingHandler.getAuditLogs().length, 0)
  assert.equal(failingHandler.getActivities().length, 0)
})

test('17. Bin and Removed Record Protection: Inactive lifecycle records cannot be edited', async () => {
  const binEnquiry = { id: 'enq-208', customer_name: 'Bin Record', is_in_bin: true }
  const removedEnquiry = { id: 'enq-209', customer_name: 'Removed Record', is_removed: true }

  const handler = createEnquiryEditHandler([binEnquiry, removedEnquiry], { id: 'head-1', role: 'superadmin', is_active: true })

  await assert.rejects(
    () => handler.updateEnquiryDetails({ enquiryId: 'enq-208', customer_name: 'New' }),
    /Cannot edit an enquiry currently in the Bin/
  )

  await assert.rejects(
    () => handler.updateEnquiryDetails({ enquiryId: 'enq-209', customer_name: 'New' }),
    /Cannot edit a removed enquiry record/
  )
})

test('18. Activity Content 3,000-character bounding: Overlong summaries or change lists are safely bounded', async () => {
  const initialEnquiry = {
    id: 'enq-210',
    customer_name: 'Length Test Customer',
    customer_phone: '9876543210',
    customer_email: 'test@example.com',
    message: 'Original Message'
  }

  const handler = createEnquiryEditHandler([initialEnquiry], { id: 'admin-1', role: 'admin', is_active: true })

  // Case A: 5,000-character edit summary supplied by user
  const hugeSummary = 'A'.repeat(5000)
  const resultA = await handler.updateEnquiryDetails({
    enquiryId: 'enq-210',
    customer_name: 'Updated Name A',
    edit_summary: hugeSummary
  })

  assert.equal(resultA.success, true)
  const activitiesA = handler.getActivities()
  assert.equal(activitiesA.length, 1)
  assert.equal(activitiesA[0].content.length, 3000)
  assert.equal(activitiesA[0].content, 'A'.repeat(3000))

  // Case B: Overlong generated summary when no edit_summary is provided
  // Simulated by verifying bounding produces valid string between 1 and 3000 chars
  const emptySummaryHandler = createEnquiryEditHandler([initialEnquiry], { id: 'admin-1', role: 'admin', is_active: true })
  const resultB = await emptySummaryHandler.updateEnquiryDetails({
    enquiryId: 'enq-210',
    customer_name: 'Updated Name B',
    edit_summary: '   ' // All whitespace should fall through to generated summary
  })

  assert.equal(resultB.success, true)
  const activitiesB = emptySummaryHandler.getActivities()
  assert.equal(activitiesB.length, 1)
  assert.ok(activitiesB[0].content.length >= 1 && activitiesB[0].content.length <= 3000)
  assert.ok(activitiesB[0].content.startsWith('Enquiry details updated'))
})
