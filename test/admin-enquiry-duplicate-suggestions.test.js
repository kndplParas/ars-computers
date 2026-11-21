import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  detectDuplicateCustomers,
  aggregateCustomers
} from '../src/utils/customerCrmAggregator.js'

test('Suite 1: Admin Enquiry Duplicate Customer Detection Engine', async (t) => {
  const existingDirectory = [
    {
      id: 'cust-101',
      name: 'Rajesh Sharma',
      phone: '9876543210',
      normalizedPhone: '9876543210',
      formattedPhone: '+91 98765 43210',
      email: 'rajesh@sharmatech.in',
      company: 'Sharma Tech Solutions',
      address: 'Shop 4, Civil Lines, Bareilly',
      customerType: 'Commercial',
      totalOrders: 3,
      totalEnquiries: 2,
      isRegularCustomer: true
    },
    {
      id: 'cust-102',
      name: 'Pooja Bisht',
      phone: '8123456789',
      normalizedPhone: '8123456789',
      formattedPhone: '+91 81234 56789',
      email: 'pooja.bisht@gmail.com',
      company: 'Kumaon Traders',
      address: 'Mall Road, Almora',
      customerType: 'Individual',
      totalOrders: 1,
      totalEnquiries: 1,
      isRegularCustomer: false
    }
  ]

  await t.test('Exact mobile match triggers suggestion with maximum confidence (100)', () => {
    const candidate = {
      name: 'R. Sharma',
      phone: '+91 98765-43210',
      email: ''
    }
    const matches = detectDuplicateCustomers(candidate, existingDirectory)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].customer.id, 'cust-101')
    assert.equal(matches[0].confidence, 100)
    assert.ok(matches[0].matchReasons.some((r) => /mobile|phone/i.test(r)))
  })

  await t.test('Exact email match triggers suggestion with high confidence (90)', () => {
    const candidate = {
      name: 'Pooja B.',
      phone: '',
      email: 'POOJA.BISHT@GMAIL.COM'
    }
    const matches = detectDuplicateCustomers(candidate, existingDirectory)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].customer.id, 'cust-102')
    assert.equal(matches[0].confidence, 90)
    assert.ok(matches[0].matchReasons.some((r) => /email/i.test(r)))
  })

  await t.test('Insufficient input (<3 chars name, no valid phone/email) does not trigger suggestions', () => {
    assert.equal(detectDuplicateCustomers({ name: 'R', phone: '123' }, existingDirectory).length, 0)
    assert.equal(detectDuplicateCustomers({ name: '', phone: '' }, existingDirectory).length, 0)
    assert.equal(detectDuplicateCustomers(null, existingDirectory).length, 0)
  })
})

test('Suite 2: Anti-Silent Merge and Identity Conflict Invariants', async (t) => {
  const regularCustomers = [
    {
      id: 'reg-1',
      name: 'Amit Patel',
      phone: '9876500001',
      email: 'shared@apexgroup.in',
      company: 'Apex Group'
    }
  ]
  const orders = [
    {
      id: 'ord-1',
      customer_name: 'Sunil Kumar',
      customer_phone: '9876500002', // Different phone sharing the same email
      customer_email: 'shared@apexgroup.in',
      total_amount: 45000
    }
  ]

  await t.test('Preserves distinct customer profiles when email is shared across different phones', () => {
    const aggregated = aggregateCustomers({ enquiries: [], orders, regularCustomers })
    assert.equal(aggregated.length, 2, 'Must NOT silently merge accounts with different phone numbers')

    const amit = aggregated.find((c) => c.name === 'Amit Patel')
    const sunil = aggregated.find((c) => c.name === 'Sunil Kumar')

    assert.ok(amit, 'Amit profile must exist independently')
    assert.ok(sunil, 'Sunil profile must exist independently')
    assert.ok(amit.hasIdentityConflict, 'Amit must be flagged with identity conflict')
    assert.ok(sunil.hasIdentityConflict, 'Sunil must be flagged with identity conflict')
  })
})

test('Suite 3: Role-based PII Redaction and Protection in Suggestions', async (t) => {
  const panelPath = path.resolve('src/components/admin/DuplicateCustomerSuggestionPanel.jsx')
  const code = fs.readFileSync(panelPath, 'utf8')

  await t.test('DuplicateCustomerSuggestionPanel masks PII for HR role', () => {
    assert.match(code, /isHr\s*=\s*\(userRole\s*\|\|\s*''\)\.toLowerCase\(\)\s*===\s*'hr'/i)
    assert.match(code, /\[REDACTED: HR Privacy Policy\]/i)
  })

  await t.test('DuplicateCustomerSuggestionPanel never displays financial totals or LTV', () => {
    // Assert no financial properties are referenced in the rendered panel
    assert.doesNotMatch(code, /totalSpend/i)
    assert.doesNotMatch(code, /paidSpend/i)
    assert.doesNotMatch(code, /formatINR/i)
    assert.doesNotMatch(code, /cost_price/i)
    assert.doesNotMatch(code, /profit_margin/i)
  })
})

test('Suite 4: Dismissal and Explicit Selection Workflow Invariants', async (t) => {
  const panelPath = path.resolve('src/components/admin/DuplicateCustomerSuggestionPanel.jsx')
  const code = fs.readFileSync(panelPath, 'utf8')

  await t.test('Provides an explicit dismiss action that does not block the employee', () => {
    assert.match(code, /setDismissedId/i)
    assert.match(code, /Dismiss suggestion/i)
    assert.match(code, /Keep as Separate \/ New/i)
  })

  await t.test('Requires explicit employee action (button click) to link customer details', () => {
    assert.match(code, /Use Existing Customer Details/i)
    assert.match(code, /onSelectCustomer\s*&&\s*onSelectCustomer/i)
  })
})

test('Suite 5: Admin Enquiry Creation Modal Architecture & Role Authorization', async (t) => {
  const modalPath = path.resolve('src/components/admin/CreateEnquiryModal.jsx')
  assert.ok(fs.existsSync(modalPath), 'CreateEnquiryModal.jsx must exist')

  const code = fs.readFileSync(modalPath, 'utf8')

  await t.test('Blocks Inventory Staff from creating customer enquiries', () => {
    assert.match(code, /adminUser\?\.role\s*===\s*'inventory_staff'/i)
    assert.match(code, /Inventory Staff is restricted from creating customer enquiries/i)
  })

  await t.test('Integrates DuplicateCustomerSuggestionPanel with candidate details', () => {
    assert.match(code, /<DuplicateCustomerSuggestionPanel/i)
    assert.match(code, /candidate=\{candidate\}/i)
    assert.match(code, /existingCustomers=\{existingCustomers\}/i)
    assert.match(code, /userRole=\{adminUser\?\.role\}/i)
  })

  await t.test('Enforces strict customer form validation before submission', () => {
    // Name min 2 chars
    assert.match(code, /cleanName\.length\s*<\s*2/i)
    // 10-digit Indian phone
    assert.match(code, /normalizeIndianPhone10Digit/i)
    // Email pattern
    assert.match(code, /emailPattern/i)
    // Message min 5 chars
    assert.match(code, /cleanMessage\.length\s*<\s*5/i)
  })

  await t.test('Provides all hardware and PC component categories via SERVICE_CATEGORY_GROUPS', () => {
    assert.match(code, /SERVICE_CATEGORY_GROUPS/i)
    assert.match(code, /optgroup/i)
  })
})

test('Suite 6: Integration into AdminEnquiriesPage Header Actions', async (t) => {
  const pagePath = path.resolve('src/pages/admin/AdminEnquiriesPage.jsx')
  const pageCode = fs.readFileSync(pagePath, 'utf8')

  await t.test('AdminEnquiriesPage imports and renders CreateEnquiryModal', () => {
    assert.match(pageCode, /import CreateEnquiryModal from '\.\.\/\.\.\/components\/admin\/CreateEnquiryModal'/i)
    assert.match(pageCode, /<CreateEnquiryModal/i)
  })

  await t.test('AdminEnquiriesPage includes Log New Enquiry button for authorized staff', () => {
    assert.match(pageCode, /id="open-create-enquiry-modal-btn"/i)
    assert.match(pageCode, /Log New Enquiry/i)
    assert.match(pageCode, /adminUser\?\.role\s*!==\s*'inventory_staff'/i)
  })
})
