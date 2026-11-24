/**
 * ============================================================================
 * ARS Computers — Complete Enquiry Details Copy & Formatter Test Suite
 * ============================================================================
 * Verifies:
 * 1. Service enquiries copy every available customer-facing service field.
 * 2. General enquiries copy all applicable product and customer fields.
 * 3. Assigned and unassigned engineer cases work cleanly.
 * 4. Long customer notes and descriptions are not truncated.
 * 5. Copy output contains correct ticket/enquiry ID.
 * 6. Internal database UUIDs, passwords, and secrets are strictly excluded.
 * 7. Negative assertions: confidential admin notes, employee codes, Aadhaar,
 *    assignors, internal audit actors, rejection/rework reasons, and archive/bin
 *    lifecycle states are NEVER exposed.
 * 8. Engineer contact is included ONLY if approved customer-visible contact from
 *    tracking is available; never substitutes internal staff phone.
 * 9. Missing fields use clean fallbacks ("Not Provided", "Not Assigned", "Not Scheduled").
 * 10. Clipboard success and failure handling behavior.
 * ============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  formatEnquiryDetailsForCopy,
  formatCompleteEnquiryDetails,
  formatEnquiryCustomerDispatch,
  buildUnifiedTimeline,
  formatDateTime,
  formatWorkflowStatus,
  formatCustomerTrackingStatus,
  formatVisitStatusLabel,
  resolveTicketId,
  resolveCustomerPhone,
  resolveCustomerEmail,
  resolveCustomerAddress
} from '../src/utils/customerDispatchFormatter.js'

test('Scenario 1: Service enquiry copies all available customer-facing service fields', () => {
  const serviceEnquiry = {
    enquiry_number: 1042,
    enquiry_type: 'service_request',
    created_at: '2026-11-21T10:30:00.000Z',
    status: 'in_progress',
    customer_name: 'Vikram Malhotra',
    company: 'Tech Solutions India',
    customer_phone: '+919876543210',
    customer_email: 'vikram@techsolutions.in',
    customer_address: 'Plot 42, Sector 5, Rudrapur, UK',
    service_details: {
      ticket_number: 'ARS-SR-20261121-1042',
      customer_type: 'Corporate',
      product_category: 'Laptop',
      request_type: 'Motherboard Repair',
      brand: 'Dell',
      model_number: 'Latitude 5420',
      serial_number: 'SN-DELL-88992',
      invoice_number: 'INV-2025-001',
      purchase_date: '15 Jan 2025',
      service_location: 'Client Premises (Sector 5)',
      preferred_visit_date: '22 Nov 2026',
      diagnostics: 'Device not turning on, charging LED blinking amber',
      warranty_status: 'Out of Warranty',
      accessories_received: 'Power Adapter 65W',
      device_condition: 'Minor scratches on top lid',
      attachment_url: 'https://example.com/proof.jpg'
    },
    admin_notes: 'Do not share with customer: internal margin estimate ₹4,500',
    assigned_employee_name: 'Rohan Sharma',
    assigned_employee_code: 'ARS-EMP-003',
    assigned_employee_phone: '+919876543299',
    assigned_employee_role: 'engineer',
    assigned_employee_aadhaar: '123456789012',
    assigned_at: '2026-11-21T11:00:00.000Z',
    assigned_by_name: 'Ankit Bathla',
    assigned_by_employee_code: 'EMP-HEAD-001',
    expected_visit_at: '2026-11-22T14:30:00.000Z',
    expected_arrival: 'Tomorrow afternoon',
    assignment_visit_note: 'Bring multi-meter and spare charging jack',
    customer_tracking_status: 'scheduled',
    customer_visit_status: 'scheduled',
    customer_visit_note: 'Engineer Rohan scheduled to visit',
    customer_engineer_contact_display: '+919876543299',
    message: 'Laptop shut down abruptly while in use and does not turn on. Charger was tested with another device and works.'
  }

  const output = formatEnquiryDetailsForCopy(serviceEnquiry)

  // Header & Identification
  assert.ok(output.includes('ARS COMPUTERS'))
  assert.ok(output.includes('SERVICE & REPAIR ENQUIRY DETAILS'))
  assert.ok(output.includes('Service Ticket ID: ARS-SR-20261121-1042'))
  assert.ok(output.includes('Enquiry ID: ARS-ENQ-01042'))
  assert.ok(output.includes('Submission Date & Time:'))
  assert.ok(output.includes('Enquiry Status: In Progress'))
  assert.ok(output.includes('Enquiry Type: Service / Repair'))

  // Customer Details
  assert.ok(output.includes('CUSTOMER DETAILS'))
  assert.ok(output.includes('Name: Vikram Malhotra'))
  assert.ok(output.includes('Customer Type: Corporate'))
  assert.ok(output.includes('Company: Tech Solutions India'))
  assert.ok(output.includes('Phone: +919876543210'))
  assert.ok(output.includes('Email: vikram@techsolutions.in'))
  assert.ok(output.includes('Address: Plot 42, Sector 5, Rudrapur, UK'))

  // Service / Device Specifications
  assert.ok(output.includes('SERVICE / REPAIR SPECIFICATIONS'))
  assert.ok(output.includes('Product Category: Laptop'))
  assert.ok(output.includes('Request Type: Motherboard Repair'))
  assert.ok(output.includes('Brand & Model: Dell / Latitude 5420'))
  assert.ok(output.includes('Serial Number / Invoice: SN-DELL-88992 | Invoice: INV-2025-001'))
  assert.ok(output.includes('Purchase Date: 15 Jan 2025'))
  assert.ok(output.includes('Service Location: Client Premises (Sector 5)'))
  assert.ok(output.includes('Preferred Visit Date: 22 Nov 2026'))
  assert.ok(output.includes('Diagnostic Symptoms: Device not turning on, charging LED blinking amber'))
  assert.ok(output.includes('Warranty Status: Out of Warranty'))
  assert.ok(output.includes('Accessories Received: Power Adapter 65W'))
  assert.ok(output.includes('Device Physical Condition: Minor scratches on top lid'))
  assert.ok(output.includes('Attachment: Uploaded Document / Photo Available'))

  // Problem Description
  assert.ok(output.includes('PROBLEM DESCRIPTION & CUSTOMER NOTES'))
  assert.ok(output.includes('Laptop shut down abruptly while in use and does not turn on. Charger was tested with another device and works.'))

  // Assigned Engineer Details (Public display name & customer-visible contact only)
  assert.ok(output.includes('ASSIGNED ENGINEER'))
  assert.ok(output.includes('Status: Assigned'))
  assert.ok(output.includes('Engineer: Rohan Sharma'))
  assert.ok(output.includes('Engineer Contact: +919876543299'))

  // Negative Assertions: Confidential internal data strictly absent
  assert.ok(!output.includes('ARS-EMP-003'), 'Employee code must not be exposed')
  assert.ok(!output.includes('EMP-HEAD-001'), 'Assignor employee code must not be exposed')
  assert.ok(!output.includes('Ankit Bathla'), 'Assignor name must not be exposed')
  assert.ok(!output.includes('Aadhaar'), 'Aadhaar label must not be exposed')
  assert.ok(!output.includes('123456789012'), 'Aadhaar raw digits must not be exposed')
  assert.ok(!output.includes('XXXX'), 'Masked Aadhaar must not be exposed')
  assert.ok(!output.includes('Do not share with customer'), 'Internal admin notes must not be exposed')
  assert.ok(!output.includes('Bring multi-meter'), 'Internal assignment visit note must not be exposed')

  // Visit & Dispatch Schedule (Customer-Visible)
  assert.ok(output.includes('VISIT & DISPATCH SCHEDULE'))
  assert.ok(output.includes('Tomorrow afternoon'))
  assert.ok(output.includes('Visit Status: Visit Scheduled'))
  assert.ok(output.includes('Visit Note: Engineer Rohan scheduled to visit'))

  // Status & Tracking
  assert.ok(output.includes('STATUS & TRACKING'))
  assert.ok(output.includes('Current Status: In Progress'))
  assert.ok(output.includes('Customer Tracking Status: Scheduled'))
})

test('Scenario 2: General enquiry copies all applicable product and customer fields', () => {
  const generalEnquiry = {
    enquiry_number: 1055,
    enquiry_type: 'product',
    status: 'new',
    created_at: '2026-11-21T09:15:00.000Z',
    customer_name: 'Sunita Verma',
    customer_phone: '9876543211',
    customer_email: 'sunita@example.com',
    customer_address: 'Civil Lines, Rudrapur',
    category_interest: 'Custom Desktop PC',
    brand: 'Asus / Intel',
    model: 'ROG Gaming Rig',
    specifications: 'Core i7 14700K, 32GB DDR5 RAM, 1TB Gen4 NVMe, RTX 4070 12GB',
    budget: '₹1,50,000',
    quantity: '2 units',
    message: 'Looking for 2 high-performance video editing and 3D rendering workstations with dual monitors. Need official GST invoice and onsite delivery.'
  }

  const output = formatEnquiryDetailsForCopy(generalEnquiry)

  assert.ok(output.includes('ARS COMPUTERS'))
  assert.ok(output.includes('GENERAL ENQUIRY DETAILS'))
  assert.ok(output.includes('Enquiry ID: ARS-ENQ-01055'))
  assert.ok(output.includes('Enquiry Status: New'))
  assert.ok(output.includes('Enquiry Type: Product'))
  assert.ok(output.includes('Requirement: Custom Desktop PC'))

  // Customer Details
  assert.ok(output.includes('CUSTOMER DETAILS'))
  assert.ok(output.includes('Name: Sunita Verma'))
  assert.ok(output.includes('Phone: 9876543211'))
  assert.ok(output.includes('Email: sunita@example.com'))
  assert.ok(output.includes('Address: Civil Lines, Rudrapur'))

  // Product Specifications
  assert.ok(output.includes('PRODUCT & REQUIREMENT SPECIFICATIONS'))
  assert.ok(output.includes('Category / Interest: Custom Desktop PC'))
  assert.ok(output.includes('Brand: Asus / Intel'))
  assert.ok(output.includes('Model: ROG Gaming Rig'))
  assert.ok(output.includes('Specifications: Core i7 14700K, 32GB DDR5 RAM, 1TB Gen4 NVMe, RTX 4070 12GB'))
  assert.ok(output.includes('Estimated Budget: ₹1,50,000'))
  assert.ok(output.includes('Quantity: 2 units'))

  // Message
  assert.ok(output.includes('Looking for 2 high-performance video editing and 3D rendering workstations with dual monitors.'))

  // Unassigned Engineer
  assert.ok(output.includes('ASSIGNED ENGINEER'))
  assert.ok(output.includes('Status: Not Assigned'))
})

test('Scenario 3: Unassigned and assigned engineer cases format properly without leaking private contact or employee codes', () => {
  const unassigned = {
    enquiry_number: 101,
    name: 'Test Customer',
    assigned_employee_id: null,
    assigned_employee_name: null
  }
  const textUnassigned = formatEnquiryDetailsForCopy(unassigned)
  assert.ok(textUnassigned.includes('ASSIGNED ENGINEER\n────────────────────────────\nStatus: Not Assigned'))
  assert.ok(!textUnassigned.includes('Employee ID:'))

  // Case B: Assigned with approved customer-visible contact
  const assignedWithVisibleContact = {
    enquiry_number: 102,
    name: 'Test Customer',
    assigned_employee_name: 'Karan Mehra',
    assigned_employee_code: 'ARS-EMP-007',
    assigned_employee_phone: '+919988776655', // Private staff phone
    engineer_contact_display: '+919876500000', // Approved customer-visible contact
    engineer_contact_hidden: false
  }
  const textAssigned = formatEnquiryDetailsForCopy(assignedWithVisibleContact)
  assert.ok(textAssigned.includes('Status: Assigned'))
  assert.ok(textAssigned.includes('Engineer: Karan Mehra'))
  assert.ok(textAssigned.includes('Engineer Contact: +919876500000'))
  assert.ok(!textAssigned.includes('+919988776655'), 'Private staff phone must never be substituted')
  assert.ok(!textAssigned.includes('ARS-EMP-007'), 'Employee ID must never be in customer copy')
  assert.ok(!textAssigned.includes('Aadhaar'))

  // Case C: Assigned with customer contact hidden
  const assignedWithHiddenContact = {
    enquiry_number: 103,
    name: 'Test Customer',
    assigned_employee_name: 'Karan Mehra',
    assigned_employee_phone: '+919988776655',
    engineer_contact_display: '+919876500000',
    engineer_contact_hidden: true // Contact is hidden
  }
  const textHidden = formatEnquiryDetailsForCopy(assignedWithHiddenContact)
  assert.ok(textHidden.includes('Engineer: Karan Mehra'))
  assert.ok(textHidden.includes('Engineer Contact: Contact number not yet available'))
  assert.ok(!textHidden.includes('+919876500000'), 'Hidden contact must not be displayed')
  assert.ok(!textHidden.includes('+919988776655'), 'Staff phone must not be substituted')
})

test('Scenario 4: Long customer notes and descriptions are not truncated', () => {
  const longNote = 'A'.repeat(1200) + ' [MIDDLE CHECKPOINT] ' + 'B'.repeat(1200)
  const enq = {
    enquiry_number: 303,
    name: 'Deepak Joshi',
    message: longNote
  }

  const output = formatEnquiryDetailsForCopy(enq)
  assert.ok(output.includes(longNote), 'The entire 2400+ character customer note must be preserved without truncation')
  assert.ok(output.includes('[MIDDLE CHECKPOINT]'))
})

test('Scenario 5: Copy output contains correct ticket/enquiry ID', () => {
  // Case A: Service enquiry with custom ticket number
  const serviceEnq = {
    service_details: { ticket_number: 'ARS-SR-20261101-7788' }
  }
  const out1 = formatEnquiryDetailsForCopy(serviceEnq)
  assert.ok(out1.includes('Service Ticket ID: ARS-SR-20261101-7788'))

  // Case B: General enquiry with enquiry_number
  const generalEnq = {
    enquiry_number: 45
  }
  const out2 = formatEnquiryDetailsForCopy(generalEnq)
  assert.ok(out2.includes('Enquiry ID: ARS-ENQ-00045'))
})

test('Scenario 6: Missing values fall back cleanly to "Not Provided" or appropriate default', () => {
  const minimalEnq = {
    name: 'Minimal Enquiry'
  }
  const output = formatEnquiryDetailsForCopy(minimalEnq)

  assert.ok(!output.includes('undefined'))
  assert.ok(!output.includes('null'))
  assert.ok(!output.includes('NaN'))
  assert.ok(!output.includes('[object Object]'))

  assert.ok(output.includes('Company: Not Provided'))
  assert.ok(output.includes('Phone: Not Provided'))
  assert.ok(output.includes('Email: Not Provided'))
  assert.ok(output.includes('Address: Not Provided'))
  assert.ok(output.includes('Category / Interest: Not Provided'))
  assert.ok(output.includes('Brand: Not Provided'))
  assert.ok(output.includes('Model: Not Provided'))
  assert.ok(output.includes('Specifications: Not Provided'))
  assert.ok(output.includes('Expected Visit: Not Scheduled'))
})

test('Scenario 7: Zero internal database UUIDs, passwords, or secrets are exposed', () => {
  const internalUuid = crypto.randomUUID()
  const employeeUuid = crypto.randomUUID()
  const assignedByUuid = crypto.randomUUID()

  const enq = {
    id: internalUuid,
    assigned_employee_id: employeeUuid,
    assigned_by: assignedByUuid,
    enquiry_number: 550,
    name: 'Security Test Customer',
    customer_phone: '9876543210',
    jwt_token: 'secret-jwt-token-12345',
    storage_path: 'private/enquiry-service-proofs/file.pdf'
  }

  const output = formatEnquiryDetailsForCopy(enq)

  // Verify no UUIDs appear anywhere in the output
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  assert.ok(!uuidRegex.test(output), `Output must not contain raw UUIDs: ${output}`)
  assert.ok(!output.includes('secret-jwt-token'))
  assert.ok(!output.includes('enquiry-service-proofs'))
})

test('Scenario 8: Negative test — internal administrative notes, audit actors, rework reasons, and archive/bin details are strictly excluded', () => {
  const internalAuditEnquiry = {
    enquiry_number: 601,
    status: 'completion_requested',
    admin_notes: 'CONFIDENTIAL: Customer called twice angry about pricing. Internal discount offered.',
    completion_summary: 'Replaced thermal paste and cooling fan.',
    completion_requested_at: '2026-11-21T16:00:00.000Z',
    completion_requested_by: crypto.randomUUID(),
    completion_requested_by_name: 'Pooja Rawat',
    completion_approved_by: crypto.randomUUID(),
    completion_approved_by_name: 'Ankit Bathla',
    completion_rework_reason: 'INTERNAL ONLY: Fan curve not tested under full thermal stress.',
    rejection_reason: 'INTERNAL ONLY: Low margin request.',
    rejection_requested_at: '2026-11-20T12:00:00.000Z',
    rejection_requested_by: crypto.randomUUID(),
    rejection_requested_by_name: 'Rohan Staff',
    customer_tracking_status: 'scheduled',
    customer_tracking_updated_by_name: 'Admin Supervisor',
    is_archived: true,
    archived_at: '2026-11-21T17:00:00.000Z',
    is_in_bin: true,
    bin_entered_at: '2026-11-21T17:30:00.000Z'
  }

  const output = formatEnquiryDetailsForCopy(internalAuditEnquiry)

  // Negative Assertions: NONE of these internal values must leak into copied text
  assert.ok(!output.includes('CONFIDENTIAL'), 'admin_notes must not be in copy output')
  assert.ok(!output.includes('Customer called twice angry'), 'admin_notes must not be in copy output')
  assert.ok(!output.includes('Pooja Rawat'), 'Requester staff name must not be in copy output')
  assert.ok(!output.includes('Ankit Bathla'), 'Approver staff name must not be in copy output')
  assert.ok(!output.includes('Rohan Staff'), 'Rejection staff name must not be in copy output')
  assert.ok(!output.includes('Admin Supervisor'), 'Tracking updater staff name must not be in copy output')
  assert.ok(!output.includes('Fan curve not tested'), 'Rework reason must not be in copy output')
  assert.ok(!output.includes('Low margin request'), 'Rejection reason must not be in copy output')
  assert.ok(!output.includes('Archive Status'), 'Archive lifecycle state must not be in copy output')
  assert.ok(!output.includes('Bin Status'), 'Bin lifecycle state must not be in copy output')

  // Positive Assertions: Status and tracking are cleanly present
  assert.ok(output.includes('Current Status: Completion Under Review'))
  assert.ok(output.includes('Customer Tracking Status: Scheduled'))
})

test('Scenario 9: formatCompleteEnquiryDetails is an alias of formatEnquiryDetailsForCopy', () => {
  const enq = { enquiry_number: 777, name: 'Alias Test' }
  assert.equal(formatCompleteEnquiryDetails(enq), formatEnquiryDetailsForCopy(enq))
})

test('Scenario 10: formatEnquiryCustomerDispatch({ complete: true }) returns complete details', () => {
  const enq = { enquiry_number: 888, name: 'Complete Option Test' }
  const completeOutput = formatEnquiryCustomerDispatch(enq, { complete: true })
  assert.equal(completeOutput, formatEnquiryDetailsForCopy(enq))
})

test('Scenario 11: Clipboard error handling catches failures gracefully without throwing unhandled rejection', async () => {
  // Simulate clipboard write failure
  const mockClipboardError = new Error('NotAllowedError: Document is not focused.')
  let notificationMessage = ''
  let notificationType = ''
  let copyFeedback = false

  const showNotification = (msg, type) => {
    notificationMessage = msg
    notificationType = type
  }

  // Simulate handleCustomerCopy logic
  const simulateCopy = async (selectedEnquiry, mockClipboard) => {
    if (!selectedEnquiry) return
    try {
      const text = formatEnquiryDetailsForCopy(selectedEnquiry)
      await mockClipboard.writeText(text)
      copyFeedback = true
      showNotification('Enquiry details copied to clipboard', 'success')
    } catch (err) {
      copyFeedback = false
      showNotification('Could not copy to clipboard: ' + (err?.message || 'Permission denied'), 'error')
    }
  }

  // Test failing clipboard
  const mockFailingClipboard = {
    writeText: async () => {
      throw mockClipboardError
    }
  }

  await simulateCopy({ enquiry_number: 999, name: 'Test' }, mockFailingClipboard)

  assert.equal(copyFeedback, false, 'copyFeedback must be false on failure')
  assert.ok(notificationMessage.includes('Could not copy to clipboard: NotAllowedError'))
  assert.equal(notificationType, 'error')

  // Test succeeding clipboard
  let copiedText = ''
  const mockSucceedingClipboard = {
    writeText: async (t) => {
      copiedText = t
    }
  }

  await simulateCopy({ enquiry_number: 999, name: 'Test' }, mockSucceedingClipboard)

  assert.equal(copyFeedback, true, 'copyFeedback must be true on success')
  assert.ok(copiedText.includes('ARS-ENQ-00999'))
  assert.equal(notificationMessage, 'Enquiry details copied to clipboard')
  assert.equal(notificationType, 'success')
})

test('Scenario 12: buildUnifiedTimeline merges tracking events and internal activities chronologically', () => {
  const trackingHistory = [
    {
      id: 101,
      change_kind: 'status',
      previous_status: 'received',
      tracking_status: 'in_progress',
      updated_by_name: 'Ankit Bathla',
      updated_by_employee_code: 'EMP-001',
      created_at: '2026-11-24T10:00:00.000Z'
    },
    {
      id: 102,
      change_kind: 'visit',
      previous_value: '',
      new_value: 'scheduled',
      updated_by_name: 'Ankit Bathla',
      updated_by_employee_code: 'EMP-001',
      created_at: '2026-11-24T11:00:00.000Z'
    }
  ]

  const enquiryActivities = [
    {
      id: 201,
      activity_type: 'assigned',
      actor_email: 'ankitbathla.ind@gmail.com',
      actor_role: 'superadmin',
      content: 'Enquiry assigned to Divyanshu Prasad by Ankit Bathla',
      created_at: '2026-11-24T11:56:00.000Z'
    },
    {
      id: 202,
      activity_type: 'note',
      actor_email: 'ankitbathla.ind@gmail.com',
      actor_role: 'superadmin',
      content: 'We have received the laptop from Goodware. We will recover the data from the existing SSD.',
      created_at: '2026-11-24T11:54:00.000Z'
    },
    {
      id: 203,
      activity_type: 'system_event',
      actor_email: 'ankitbathla.ind@gmail.com',
      actor_role: 'superadmin',
      content: 'Customer enquiry submitted through website',
      created_at: '2026-11-21T08:46:00.000Z'
    }
  ]

  const timeline = buildUnifiedTimeline(trackingHistory, enquiryActivities)
  assert.equal(timeline.length, 5)

  // Verify descending chronological order
  assert.equal(timeline[0].id, 'activity-201')
  assert.equal(timeline[0].category, 'assigned')
  assert.equal(timeline[0].author, 'ankitbathla.ind@gmail.com')
  assert.equal(timeline[0].role, '(superadmin)')
  assert.equal(timeline[0].content, 'Enquiry assigned to Divyanshu Prasad by Ankit Bathla')

  assert.equal(timeline[1].id, 'activity-202')
  assert.equal(timeline[1].category, 'note')

  assert.equal(timeline[2].id, 'tracking-102')
  assert.equal(timeline[2].category, 'Visit Schedule')
  assert.ok(timeline[2].content.includes('Visit Scheduled'))

  assert.equal(timeline[3].id, 'tracking-101')
  assert.equal(timeline[3].category, 'Tracking Status')
  assert.ok(timeline[3].content.includes('Received → In Progress'))

  assert.equal(timeline[4].id, 'activity-203')
  assert.equal(timeline[4].category, 'system event')
})

test('Scenario 13: formatEnquiryDetailsForCopy includes ACTIVITY & TRACKING TIMELINE when timeline is provided', () => {
  const enq = {
    enquiry_number: 1023,
    enquiry_type: 'service_request',
    customer_name: 'Rahul Sharma',
    phone: '+919876543210',
    status: 'in_progress',
    service_details: {
      product_category: 'Laptop',
      brand: 'Dell',
      model_number: 'Inspiron 15'
    },
    message: 'Screen flickering issue'
  }

  const timeline = [
    {
      id: 'activity-1',
      category: 'ENQUIRY ASSIGNED',
      author: 'ankitbathla.ind@gmail.com',
      role: '(superadmin)',
      content: 'Enquiry assigned to Divyanshu Prasad by Ankit Bathla',
      timestamp: '2026-11-24T17:26:00.000Z'
    },
    {
      id: 'activity-2',
      category: 'NOTE',
      author: 'ankitbathla.ind@gmail.com',
      role: '(superadmin)',
      content: 'We have received the laptop from Goodware. We will recover the data from the existing SSD and provide a temporary SSD for use in the meantime.',
      timestamp: '2026-11-24T17:24:00.000Z'
    },
    {
      id: 'activity-3',
      category: 'SYSTEM EVENT',
      author: 'ankitbathla.ind@gmail.com',
      role: '(superadmin)',
      content: 'Customer enquiry submitted through website',
      timestamp: '2026-11-21T14:16:00.000Z'
    }
  ]

  const output = formatEnquiryDetailsForCopy(enq, { timeline })

  // Verify basic enquiry details still present
  assert.ok(output.includes('Enquiry ID: ARS-ENQ-01023'))
  assert.ok(output.includes('CUSTOMER DETAILS'))
  assert.ok(output.includes('Rahul Sharma'))

  // Verify ACTIVITY & TRACKING TIMELINE section is present
  assert.ok(output.includes('ACTIVITY & TRACKING TIMELINE'))
  assert.ok(output.includes('────────────────────────────'))

  // Verify all timeline events are included with their authors, roles, and contents
  assert.ok(output.includes('ENQUIRY ASSIGNED | ankitbathla.ind@gmail.com (superadmin)'))
  assert.ok(output.includes('Enquiry assigned to Divyanshu Prasad by Ankit Bathla'))
  assert.ok(output.includes('NOTE | ankitbathla.ind@gmail.com (superadmin)'))
  assert.ok(output.includes('We have received the laptop from Goodware.'))
  assert.ok(output.includes('SYSTEM EVENT | ankitbathla.ind@gmail.com (superadmin)'))
  assert.ok(output.includes('Customer enquiry submitted through website'))

  // Verify footer comes after timeline
  const timelineIdx = output.indexOf('ACTIVITY & TRACKING TIMELINE')
  const footerIdx = output.indexOf('ARS Computers — Service Desk & Customer Records')
  assert.ok(timelineIdx !== -1 && footerIdx !== -1 && footerIdx > timelineIdx)
})

test('Scenario 14: formatEnquiryDetailsForCopy handles empty timeline with friendly message', () => {
  const enq = {
    enquiry_number: 1024,
    customer_name: 'Amit Verma'
  }

  const output = formatEnquiryDetailsForCopy(enq, { timeline: [] })
  assert.ok(output.includes('ACTIVITY & TRACKING TIMELINE'))
  assert.ok(output.includes('No activity or tracking records logged yet.'))
})

test('Scenario 15: formatEnquiryDetailsForCopy builds timeline from activities and customerTrackingHistory options', () => {
  const enq = {
    enquiry_number: 1025,
    customer_name: 'Pooja Rawat'
  }

  const activities = [
    {
      id: 301,
      activity_type: 'note',
      actor_email: 'admin@arscomputer.com',
      actor_role: 'admin',
      content: 'Customer confirmed pickup time tomorrow 11 AM',
      created_at: '2026-11-24T12:00:00.000Z'
    }
  ]

  const output = formatEnquiryDetailsForCopy(enq, { activities })
  assert.ok(output.includes('ACTIVITY & TRACKING TIMELINE'))
  assert.ok(output.includes('NOTE | admin@arscomputer.com (admin)'))
  assert.ok(output.includes('Customer confirmed pickup time tomorrow 11 AM'))
})

test('Scenario 16: formatEnquiryDetailsForCopy does not duplicate ARS-ENQ- prefix when enquiry_number already contains it', () => {
  const enq = {
    enquiry_number: 'ARS-ENQ-01023',
    customer_name: 'Goodwear Fashion Unit'
  }

  const output = formatEnquiryDetailsForCopy(enq)
  assert.ok(output.includes('Enquiry ID: ARS-ENQ-01023'))
  assert.ok(!output.includes('ARS-ENQ-ARS-ENQ-01023'))
})

test('Scenario 17: formatEnquiryDetailsForCopy includes standalone adminNotes when requested and not already in timeline', () => {
  const enq = {
    enquiry_number: 1026,
    customer_name: 'Goodwear Fashion Unit',
    admin_notes: 'Initial quotation sent via phone: ₹3,500'
  }

  const output = formatEnquiryDetailsForCopy(enq, { adminNotes: enq.admin_notes })
  assert.ok(output.includes('ADMIN FOLLOW-UP NOTE'))
  assert.ok(output.includes('Initial quotation sent via phone: ₹3,500'))
})
