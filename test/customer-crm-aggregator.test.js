import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeIndianPhone10Digit,
  formatIndianPhoneDisplay,
  normalizeCustomerEmail,
  getCrmRolePermissions,
  aggregateCustomers,
  filterCustomers,
  buildCustomerTimeline
} from '../src/utils/customerCrmAggregator.js'

test('Suite 1: Indian Phone Number Normalization', async (t) => {
  await t.test('normalizes 10-digit Indian numbers starting with 6-9', () => {
    assert.equal(normalizeIndianPhone10Digit('9876543210'), '9876543210')
    assert.equal(normalizeIndianPhone10Digit('8123456789'), '8123456789')
    assert.equal(normalizeIndianPhone10Digit('7000000001'), '7000000001')
    assert.equal(normalizeIndianPhone10Digit('6234567890'), '6234567890')
  })

  await t.test('normalizes phone numbers with +91, 91, or 0 prefixes', () => {
    assert.equal(normalizeIndianPhone10Digit('+91 98765 43210'), '9876543210')
    assert.equal(normalizeIndianPhone10Digit('+91-9876543210'), '9876543210')
    assert.equal(normalizeIndianPhone10Digit('919876543210'), '9876543210')
    assert.equal(normalizeIndianPhone10Digit('09876543210'), '9876543210')
    assert.equal(normalizeIndianPhone10Digit('091 98765 43210'), '9876543210')
  })

  await t.test('safely rejects non-Indian, foreign, or invalid phone numbers', () => {
    assert.equal(normalizeIndianPhone10Digit(null), null)
    assert.equal(normalizeIndianPhone10Digit(undefined), null)
    assert.equal(normalizeIndianPhone10Digit(''), null)
    assert.equal(normalizeIndianPhone10Digit('12345'), null) // Too short
    assert.equal(normalizeIndianPhone10Digit('1234567890'), null) // Starts with 1 (not 6-9)
    assert.equal(normalizeIndianPhone10Digit('011-23456789'), null) // Delhi landline
    assert.equal(normalizeIndianPhone10Digit('+1 555-019-2834'), null) // US number
  })

  await t.test('formats 10-digit phone for readable display', () => {
    assert.equal(formatIndianPhoneDisplay('9876543210'), '+91 98765 43210')
    assert.equal(formatIndianPhoneDisplay(null), 'Not Provided')
  })
})

test('Suite 2: Customer Email Normalization', async (t) => {
  await t.test('normalizes and lowercases valid email addresses', () => {
    assert.equal(normalizeCustomerEmail('  Rahul.Sharma@Apex.COM  '), 'rahul.sharma@apex.com')
    assert.equal(normalizeCustomerEmail('info@arscomputer.com'), 'info@arscomputer.com')
  })

  await t.test('rejects malformed or invalid emails', () => {
    assert.equal(normalizeCustomerEmail(null), null)
    assert.equal(normalizeCustomerEmail(''), null)
    assert.equal(normalizeCustomerEmail('not-an-email'), null)
    assert.equal(normalizeCustomerEmail('user@domain'), null) // missing TLD
  })
})

test('Suite 3: Role-based CRM Permissions', async (t) => {
  await t.test('Superadmin, Admin, and Account have full financial visibility and actions', () => {
    for (const role of ['superadmin', 'admin', 'account', 'accountant']) {
      const perms = getCrmRolePermissions(role)
      assert.equal(perms.canViewFinancials, true, `Role ${role} should view financials`)
      assert.equal(perms.canContactCustomer, true, `Role ${role} should contact customer`)
      assert.equal(perms.canViewServiceDetails, true, `Role ${role} should view service details`)
      assert.equal(perms.isRestrictedReadOnly, false, `Role ${role} is not restricted read-only`)
    }
  })

  await t.test('Engineer and Technical roles can contact customer but commercial financials are hidden', () => {
    for (const role of ['engineer', 'technical']) {
      const perms = getCrmRolePermissions(role)
      assert.equal(perms.canViewFinancials, false, `Role ${role} must NOT view commercial financials`)
      assert.equal(perms.canContactCustomer, true, `Role ${role} can contact customer for dispatch`)
      assert.equal(perms.canViewServiceDetails, true, `Role ${role} can view service details`)
      assert.equal(perms.isRestrictedReadOnly, false)
    }
  })

  await t.test('Inventory Staff and HR have restricted read-only overview without contact or financials', () => {
    for (const role of ['inventory_staff', 'hr']) {
      const perms = getCrmRolePermissions(role)
      assert.equal(perms.canViewFinancials, false, `Role ${role} must NOT view financials`)
      assert.equal(perms.canContactCustomer, false, `Role ${role} must NOT contact customer`)
      assert.equal(perms.isRestrictedReadOnly, true, `Role ${role} is restricted read-only`)
    }
  })
})

test('Suite 4: Customer Touchpoint Aggregation and Deduplication', async (t) => {
  const mockOrders = [
    {
      id: 'ord-1',
      order_number: 'ORD-2026-001',
      customer_name: 'Rahul Sharma',
      customer_phone: '+91 98765 43210',
      customer_email: 'rahul@apex.in',
      company: 'Apex Technologies',
      total_amount: 35000,
      paid_amount: 35000,
      order_status: 'DELIVERED',
      created_at: '2026-11-01T10:00:00Z'
    },
    {
      id: 'ord-2',
      order_number: 'ORD-2026-002',
      customer_name: 'Rahul Sharma',
      customer_phone: '9876543210',
      customer_email: 'rahul@apex.in',
      total_amount: 25000,
      paid_amount: 25000,
      order_status: 'DELIVERED',
      created_at: '2026-11-10T12:00:00Z'
    }
  ]

  const mockEnquiries = [
    {
      id: 'enq-1',
      enquiry_id: 'ENQ-2026-001',
      name: 'Rahul Sharma',
      phone: '09876543210', // Same customer via 0-prefix
      email: 'rahul@apex.in',
      requirement: 'Require RAM upgrade for 5 Dell Optiplex workstations',
      status: 'pending',
      created_at: '2026-11-15T15:00:00Z'
    },
    {
      id: 'enq-2',
      enquiry_id: 'ENQ-2026-002',
      name: 'Priya Verma',
      phone: '918765432109',
      email: 'priya@infotech.com',
      company: 'Infotech Solutions',
      requirement: 'CCTV Camera repair',
      status: 'completed',
      created_at: '2026-11-12T09:00:00Z'
    }
  ]

  const aggregated = aggregateCustomers({ enquiries: mockEnquiries, orders: mockOrders })

  await t.test('deduplicates touchpoints across orders and enquiries by normalized phone', () => {
    // Should produce 2 customers: Rahul Sharma (2 orders + 1 enquiry) and Priya Verma (1 enquiry)
    assert.equal(aggregated.length, 2)

    const rahul = aggregated.find((c) => c.normalizedPhone === '9876543210')
    assert.ok(rahul, 'Rahul Sharma profile must be present')
    assert.equal(rahul.name, 'Rahul Sharma')
    assert.equal(rahul.company, 'Apex Technologies')
    assert.equal(rahul.totalOrders, 2)
    assert.equal(rahul.totalEnquiries, 1)
    assert.equal(rahul.openEnquiriesCount, 1)
    assert.equal(rahul.totalSpend, 60000) // 35000 + 25000
    assert.equal(rahul.isRepeatCustomer, true, 'Customer with 3 total touchpoints is Repeat')
    assert.equal(rahul.isHighValue, true, 'Spend of 60k is High Value (> 50k)')
    assert.equal(rahul.hasActiveEnquiry, true)
    assert.equal(rahul.hasIdentityConflict, false)
  })

  await t.test('identifies non-repeat customers accurately', () => {
    const priya = aggregated.find((c) => c.normalizedPhone === '8765432109')
    assert.ok(priya, 'Priya Verma profile must be present')
    assert.equal(priya.totalOrders, 0)
    assert.equal(priya.totalEnquiries, 1)
    assert.equal(priya.openEnquiriesCount, 0) // status completed
    assert.equal(priya.isRepeatCustomer, false)
    assert.equal(priya.hasActiveEnquiry, false)
    assert.equal(priya.totalSpend, 0)
  })
})

test('Suite 5: Identity Conflict Detection (Anti-Silent Merge)', async (t) => {
  // Two different customers having different phone numbers but sharing the same company email
  const conflictingOrders = [
    {
      id: 'ord-a',
      order_number: 'ORD-101',
      customer_name: 'Manager A',
      customer_phone: '9811111111',
      customer_email: 'accounts@sharedcompany.com',
      total_amount: 10000,
      created_at: '2026-11-01T10:00:00Z'
    },
    {
      id: 'ord-b',
      order_number: 'ORD-102',
      customer_name: 'Engineer B',
      customer_phone: '9822222222', // DIFFERENT phone
      customer_email: 'accounts@sharedcompany.com', // SAME email
      total_amount: 15000,
      created_at: '2026-11-02T10:00:00Z'
    }
  ]

  const aggregated = aggregateCustomers({ orders: conflictingOrders })

  await t.test('preserves two separate customer records instead of silently merging', () => {
    assert.equal(aggregated.length, 2, 'Must not silently merge different phone numbers')
  })

  await t.test('flags both profiles with hasIdentityConflict and clear conflict reason', () => {
    const custA = aggregated.find((c) => c.normalizedPhone === '9811111111')
    const custB = aggregated.find((c) => c.normalizedPhone === '9822222222')

    assert.ok(custA)
    assert.ok(custB)
    assert.equal(custA.hasIdentityConflict, true)
    assert.equal(custB.hasIdentityConflict, true)
    assert.ok(custA.conflictReasons.length > 0)
    assert.ok(custB.conflictReasons.length > 0)
  })
})

test('Suite 6: Customer Search and Filtering', async (t) => {
  const sampleCustomers = [
    {
      id: '1',
      name: 'Amit Patel',
      company: 'Patel Electronics',
      normalizedPhone: '9988776655',
      formattedPhone: '+91 99887 76655',
      email: 'amit@patelelec.com',
      totalSpend: 75000,
      isRepeatCustomer: true,
      hasActiveEnquiry: true,
      isHighValue: true
    },
    {
      id: '2',
      name: 'Suresh Kumar',
      company: 'Retail Store',
      normalizedPhone: '9877665544',
      formattedPhone: '+91 98776 65544',
      email: 'suresh@retail.in',
      totalSpend: 12000,
      isRepeatCustomer: false,
      hasActiveEnquiry: false,
      isHighValue: false
    }
  ]

  const adminPerms = getCrmRolePermissions('admin')
  const engineerPerms = getCrmRolePermissions('engineer')

  await t.test('filters by text query matching name, company, phone, and email', () => {
    assert.equal(filterCustomers(sampleCustomers, { query: 'Patel', rolePermissions: adminPerms }).length, 1)
    assert.equal(filterCustomers(sampleCustomers, { query: '9877665544', rolePermissions: adminPerms }).length, 1)
    assert.equal(filterCustomers(sampleCustomers, { query: 'retail.in', rolePermissions: adminPerms }).length, 1)
    assert.equal(filterCustomers(sampleCustomers, { query: 'xyz', rolePermissions: adminPerms }).length, 0)
  })

  await t.test('filters by Repeat Customers and Active Enquiries', () => {
    assert.equal(filterCustomers(sampleCustomers, { filter: 'repeat', rolePermissions: adminPerms }).length, 1)
    assert.equal(filterCustomers(sampleCustomers, { filter: 'active_enquiry', rolePermissions: adminPerms }).length, 1)
  })

  await t.test('High Value filter is accessible to Admin but restricted for Engineer', () => {
    const adminHighVal = filterCustomers(sampleCustomers, { filter: 'high_value', rolePermissions: adminPerms })
    assert.equal(adminHighVal.length, 1, 'Admin can filter by high value')

    const engHighVal = filterCustomers(sampleCustomers, { filter: 'high_value', rolePermissions: engineerPerms })
    assert.equal(engHighVal.length, 0, 'Engineer cannot access high value filter')
  })
})

test('Suite 7: Unified Customer Interaction Timeline Builder', async (t) => {
  const customer = {
    id: 'cust-1',
    orders: [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        order_status: 'CONFIRMED',
        total_amount: 12000,
        created_at: '2026-11-05T10:00:00Z',
        order_payments: [
          {
            id: 'pay-1',
            amount: 12000,
            payment_method: 'UPI',
            received_at: '2026-11-05T11:00:00Z'
          }
        ]
      }
    ],
    enquiries: [
      {
        id: 'enq-201',
        enquiry_id: 'ENQ-201',
        requirement: 'Keyboard not working',
        workflow_tab: 'completed',
        created_at: '2026-11-01T09:00:00Z'
      }
    ]
  }

  const mockEnquiryActs = [
    {
      id: 'act-1',
      activity_type: 'technician_assigned',
      content: 'Assigned to Ramesh (Technician)',
      actor_role: 'superadmin',
      created_at: '2026-11-02T10:00:00Z'
    }
  ]

  const timeline = buildCustomerTimeline({
    customer,
    enquiryActivities: mockEnquiryActs,
    orderActivities: []
  })

  await t.test('merges orders, payments, enquiries, and activities in descending order', () => {
    assert.equal(timeline.length, 4) // 1 enquiry created, 1 activity, 1 order created, 1 payment
    // Latest should be payment on 2026-11-05T11:00:00Z
    assert.equal(timeline[0].type, 'payment_received')
    assert.equal(timeline[1].type, 'order_placed')
    assert.equal(timeline[2].type, 'technician_assigned')
    assert.equal(timeline[3].type, 'enquiry_received')
  })
})
