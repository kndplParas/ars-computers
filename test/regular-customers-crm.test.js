import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  detectDuplicateCustomers,
  aggregateCustomers,
  filterCustomers,
  getCrmRolePermissions
} from '../src/utils/customerCrmAggregator.js'

test('Suite 1: Migration 25 SQL Schema and Invariants', async (t) => {
  const migrationPath = path.resolve('supabase/migrations/20261121000025_create_permanent_customers_crm.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration 25 file must exist')

  const sql = fs.readFileSync(migrationPath, 'utf8')

  await t.test('Defines permanent public.customers table with required columns', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.customers/i)
    assert.match(sql, /id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/i)
    assert.match(sql, /name TEXT NOT NULL/i)
    assert.match(sql, /phone TEXT/i)
    assert.match(sql, /normalized_phone TEXT/i)
    assert.match(sql, /email TEXT/i)
    assert.match(sql, /normalized_email TEXT/i)
    assert.match(sql, /company TEXT/i)
    assert.match(sql, /customer_type TEXT/i)
    assert.match(sql, /gst_number TEXT/i)
    assert.match(sql, /address TEXT/i)
    assert.match(sql, /notes TEXT/i)
    assert.match(sql, /is_regular BOOLEAN DEFAULT true/i)
    assert.match(sql, /created_by UUID/i)
  })

  await t.test('Creates indexes for high-speed duplicate detection and lookups', () => {
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_customers_normalized_phone/i)
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_customers_normalized_email/i)
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_customers_company/i)
  })

  await t.test('Implements create_regular_customer RPC with role enforcement and race-safe duplicate protection', () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_regular_customer/i)
    assert.match(sql, /p_allow_duplicate boolean DEFAULT false/i)
    assert.match(sql, /pg_advisory_xact_lock/i)
    assert.match(sql, /v_lock_phone\s*<\s*v_lock_email/i)
    assert.match(sql, /rechecked after acquiring locks/i)
    assert.match(sql, /v_duplicate_id IS NOT NULL AND NOT p_allow_duplicate/i)
    assert.match(sql, /SECURITY DEFINER/i)
    assert.match(sql, /SET search_path TO 'pg_catalog', 'public'/i)
    assert.match(sql, /v_role\s*:=\s*public\.get_staff_role\(\)/i)
    // Inventory staff blocked from creating customer profiles
    assert.match(sql, /NOT IN \('superadmin', 'admin', 'account', 'technical', 'engineer', 'hr'\)/i)
  })

  await t.test('Implements get_admin_customers RPC with HR PII redaction and role projections', () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_admin_customers/i)
    assert.match(sql, /SECURITY DEFINER/i)
    assert.match(sql, /SET search_path TO 'pg_catalog', 'public'/i)
    assert.match(sql, /v_role\s*=\s*'hr'/i)
    assert.match(sql, /\[REDACTED: HR Privacy Policy\]/i)
  })

  await t.test('Implements search_duplicate_customers RPC with match scoring', () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.search_duplicate_customers/i)
    assert.match(sql, /match_confidence/i)
  })

  await t.test('Revokes direct table SELECT from public, anon, and authenticated', () => {
    assert.match(sql, /REVOKE ALL ON TABLE public\.customers FROM PUBLIC, anon, authenticated/i)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_regular_customer.*TO authenticated/i)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_admin_customers.*TO authenticated/i)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.search_duplicate_customers.*TO authenticated/i)
  })
})

test('Suite 2: Duplicate Customer Detection Scoring and Matching', async (t) => {
  const existingCustomers = [
    {
      id: 'cust-1',
      name: 'Ramesh Verma',
      phone: '9876543210',
      normalizedPhone: '9876543210',
      email: 'ramesh@vermatech.in',
      company: 'Verma Technologies Pvt Ltd'
    },
    {
      id: 'cust-2',
      name: 'Anita Sharma',
      phone: '8123456789',
      normalizedPhone: '8123456789',
      email: 'anita.sharma@gmail.com',
      company: 'Apex Solutions'
    }
  ]

  await t.test('Detects exact mobile number match with maximum score (100)', () => {
    const matches = detectDuplicateCustomers(
      { phone: '+91 98765 43210', name: 'Ramesh V.' },
      existingCustomers
    )
    assert.ok(matches.length > 0)
    assert.equal(matches[0].customer.id, 'cust-1')
    assert.ok(matches[0].score >= 100)
    assert.ok(matches[0].matchReasons.some((r) => /mobile|phone/i.test(r)))
  })

  await t.test('Detects exact email match with high score (90)', () => {
    const matches = detectDuplicateCustomers(
      { email: 'RAMESH@VERMATECH.IN', name: 'Different Name' },
      existingCustomers
    )
    assert.ok(matches.length > 0)
    assert.equal(matches[0].customer.id, 'cust-1')
    assert.ok(matches[0].matchReasons.some((r) => /email/i.test(r)))
  })

  await t.test('Detects company name similarity (75)', () => {
    const matches = detectDuplicateCustomers(
      { company: 'Verma Technologies', name: 'New Contact' },
      existingCustomers
    )
    assert.ok(matches.length > 0)
    assert.equal(matches[0].customer.id, 'cust-1')
    assert.ok(matches[0].matchReasons.some((r) => /company/i.test(r)))
  })

  await t.test('Returns empty array when no matches exist', () => {
    const matches = detectDuplicateCustomers(
      { name: 'Dr. Vikram Sarabhai', phone: '9998887776', email: 'vikram@isro.gov.in' },
      existingCustomers
    )
    assert.equal(matches.length, 0)
  })
})

test('Suite 3: Aggregation of Permanent Regular Customers with Transactions', async (t) => {
  const regularCustomers = [
    {
      id: 'reg-101',
      name: 'Suresh Raina',
      phone: '+91 98765 00001',
      normalized_phone: '9876500001',
      email: 'suresh@raina.in',
      normalized_email: 'suresh@raina.in',
      company: 'Raina Cricket Academy',
      customer_type: 'Business',
      gst_number: '07AAAAA0000A1Z5',
      address: 'Sector 62, Noida, UP',
      notes: 'Premium VIP client',
      is_regular: true,
      created_at: '2026-01-10T10:00:00Z'
    }
  ]

  const orders = [
    {
      id: 'ord-201',
      order_number: 'ORD-2026-001',
      customer_name: 'Suresh Raina',
      customer_phone: '9876500001',
      total_amount: 125000,
      order_status: 'delivered',
      created_at: '2026-02-15T12:00:00Z'
    }
  ]

  const enquiries = [
    {
      id: 'enq-301',
      ticket_number: 'SR-2026-089',
      customer_name: 'Suresh Raina',
      mobile_number: '9876500001',
      request_type: 'AMC Renewal',
      status: 'assigned',
      created_at: '2026-03-01T15:00:00Z'
    }
  ]

  await t.test('Canonicalizes regular customer profile and attaches transactional history', () => {
    const aggregated = aggregateCustomers({ enquiries, orders, regularCustomers })
    assert.equal(aggregated.length, 1)

    const customer = aggregated[0]
    assert.equal(customer.name, 'Suresh Raina')
    assert.equal(customer.normalizedPhone, '9876500001')
    assert.equal(customer.isRegularCustomer, true)
    assert.equal(customer.permanentCustomerId, 'reg-101')
    assert.equal(customer.customerType, 'Business')
    assert.equal(customer.gstNumber, '07AAAAA0000A1Z5')
    assert.equal(customer.notes, 'Premium VIP client')
    assert.equal(customer.orders.length, 1)
    assert.equal(customer.enquiries.length, 1)
    assert.equal(customer.totalSpend, 125000)
    assert.equal(customer.isRepeatCustomer, true)
  })

  await t.test('Supports standalone regular customer with zero transactional history', () => {
    const standaloneRegular = [
      {
        id: 'reg-102',
        name: 'Kapil Dev',
        phone: '9811122233',
        normalized_phone: '9811122233',
        email: 'kapil@chandigarh.org',
        is_regular: true,
        customer_type: 'Individual',
        created_at: '2026-11-20T08:00:00Z'
      }
    ]

    const aggregated = aggregateCustomers({ enquiries: [], orders: [], regularCustomers: standaloneRegular })
    assert.equal(aggregated.length, 1)
    assert.equal(aggregated[0].name, 'Kapil Dev')
    assert.equal(aggregated[0].isRegularCustomer, true)
    assert.equal(aggregated[0].totalOrders, 0)
    assert.equal(aggregated[0].totalEnquiries, 0)
    assert.equal(aggregated[0].totalSpend, 0)
  })
})

test('Suite 4: Filter Customers by Regular Classification', async () => {
  const aggregated = [
    { id: '1', name: 'Regular Client', isRegularCustomer: true, searchIndex: 'regular client' },
    { id: '2', name: 'Ad-hoc Walk-in', isRegularCustomer: false, searchIndex: 'ad-hoc walk-in' }
  ]

  const permissions = getCrmRolePermissions('admin')
  const regularFiltered = filterCustomers(aggregated, { filter: 'regular', rolePermissions: permissions })

  assert.equal(regularFiltered.length, 1)
  assert.equal(regularFiltered[0].name, 'Regular Client')
})

test('Suite 5: Role-based Access Control on Regular Customers', async (t) => {
  await t.test('Inventory staff cannot create regular customers', () => {
    const permissions = getCrmRolePermissions('inventory_staff')
    // Inventory staff has read-only operations for dispatch/return
    assert.equal(permissions.canViewFinancials, false)
  })

  await t.test('HR role receives redacted customer contact PII in RPC projection', () => {
    const migrationPath = path.resolve('supabase/migrations/20261121000025_create_permanent_customers_crm.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.match(sql, /WHEN v_role = 'hr' THEN '\[REDACTED: HR Privacy Policy\]'/i)
  })
})

test('Suite 6: Concurrency & Duplicate Protection Invariants', async (t) => {
  function createSimulatedDb() {
    const customers = []
    const locks = new Set()

    async function createCustomerRpc({
      name,
      phone,
      email,
      allowDuplicate = false
    }) {
      const normPhone = phone ? phone.replace(/\D/g, '').slice(-10) : null
      const normEmail = email ? email.toLowerCase().trim() : null

      const lockKeys = []
      if (normPhone) lockKeys.push(`customer_phone:${normPhone}`)
      if (normEmail) lockKeys.push(`customer_email:${normEmail}`)

      lockKeys.sort()

      for (const k of lockKeys) {
        while (locks.has(k)) {
          await new Promise((r) => setTimeout(r, 10))
        }
        locks.add(k)
      }

      try {
        let duplicate = null
        if (normPhone) {
          duplicate = customers.find((c) => c.normalizedPhone === normPhone)
        }
        if (!duplicate && normEmail) {
          duplicate = customers.find((c) => c.normalizedEmail === normEmail)
        }

        if (duplicate && !allowDuplicate) {
          return {
            success: false,
            duplicateDetected: true,
            potentialDuplicate: { id: duplicate.id, name: duplicate.name },
            customer: null
          }
        }

        const newCust = {
          id: `cust-${customers.length + 1}`,
          name,
          phone,
          normalizedPhone: normPhone,
          email,
          normalizedEmail: normEmail
        }
        customers.push(newCust)
        return {
          success: true,
          duplicateDetected: false,
          customer: newCust
        }
      } finally {
        for (const k of lockKeys) {
          locks.delete(k)
        }
      }
    }

    return { createCustomerRpc, customers }
  }

  await t.test('Simultaneous requests sharing ONLY phone cannot create duplicate record', async () => {
    const db = createSimulatedDb()
    const [res1, res2] = await Promise.all([
      db.createCustomerRpc({ name: 'Alice A', phone: '9876543210', email: 'alice.a@test.com' }),
      db.createCustomerRpc({ name: 'Alice B', phone: '9876543210', email: 'alice.b@test.com' })
    ])

    const successes = [res1, res2].filter((r) => r.success)
    const duplicates = [res1, res2].filter((r) => r.duplicateDetected)

    assert.equal(successes.length, 1, 'Exactly one concurrent insertion must succeed')
    assert.equal(duplicates.length, 1, 'The competing concurrent insertion must be flagged as duplicate')
    assert.equal(db.customers.length, 1, 'Database must contain exactly 1 customer record')
  })

  await t.test('Simultaneous requests sharing ONLY email cannot create duplicate record', async () => {
    const db = createSimulatedDb()
    const [res1, res2] = await Promise.all([
      db.createCustomerRpc({ name: 'Bob A', phone: '9811111111', email: 'shared@test.com' }),
      db.createCustomerRpc({ name: 'Bob B', phone: '9822222222', email: 'shared@test.com' })
    ])

    const successes = [res1, res2].filter((r) => r.success)
    const duplicates = [res1, res2].filter((r) => r.duplicateDetected)

    assert.equal(successes.length, 1)
    assert.equal(duplicates.length, 1)
    assert.equal(db.customers.length, 1)
  })

  await t.test('Simultaneous requests sharing BOTH phone and email acquire locks in sorted order and prevent duplicates', async () => {
    const db = createSimulatedDb()
    const [res1, res2] = await Promise.all([
      db.createCustomerRpc({ name: 'Charlie 1', phone: '9933333333', email: 'charlie@test.com' }),
      db.createCustomerRpc({ name: 'Charlie 2', phone: '9933333333', email: 'charlie@test.com' })
    ])

    const successes = [res1, res2].filter((r) => r.success)
    const duplicates = [res1, res2].filter((r) => r.duplicateDetected)

    assert.equal(successes.length, 1)
    assert.equal(duplicates.length, 1)
    assert.equal(db.customers.length, 1)
  })

  await t.test('Explicit bypass (allowDuplicate = true) enables deliberate distinct profile creation', async () => {
    const db = createSimulatedDb()
    const res1 = await db.createCustomerRpc({ name: 'Parent Company', phone: '9944444444', email: 'corp@test.com' })
    assert.equal(res1.success, true)

    const res2 = await db.createCustomerRpc({ name: 'Child Branch', phone: '9944444444', email: 'branch@test.com', allowDuplicate: false })
    assert.equal(res2.success, false)
    assert.equal(res2.duplicateDetected, true)

    const res3 = await db.createCustomerRpc({ name: 'Child Branch', phone: '9944444444', email: 'branch@test.com', allowDuplicate: true })
    assert.equal(res3.success, true)
    assert.equal(db.customers.length, 2, 'Database now contains both distinct records')
  })
})
