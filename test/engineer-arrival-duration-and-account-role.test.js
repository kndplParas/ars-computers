import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { formatJobDispatchText, buildWhatsAppDispatchUrl } from '../src/utils/jobDispatchFormatter.js'

test('Expected Engineer Arrival Duration & Account Role Regression Suite', async (t) => {
  const enquiriesPagePath = path.resolve('src/pages/admin/AdminEnquiriesPage.jsx')
  const enquiriesPageCode = fs.readFileSync(enquiriesPagePath, 'utf8')

  const dataProviderPath = path.resolve('src/context/AdminDataProvider.jsx')
  const dataProviderCode = fs.readFileSync(dataProviderPath, 'utf8')

  const authProviderPath = path.resolve('src/context/AdminAuthProvider.jsx')
  const authProviderCode = fs.readFileSync(authProviderPath, 'utf8')

  const staffPagePath = path.resolve('src/pages/admin/AdminStaffPage.jsx')
  const staffPageCode = fs.readFileSync(staffPagePath, 'utf8')

  const layoutPath = path.resolve('src/components/admin/AdminLayout.jsx')
  const layoutCode = fs.readFileSync(layoutPath, 'utf8')

  const migrationPath = path.resolve('supabase/migrations/20261031000011_add_account_role_and_arrival_duration.sql')
  const migrationCode = fs.readFileSync(migrationPath, 'utf8')

  const EXPECTED_OPTIONS = [
    'Within 1 hour',
    'Within 2 hours',
    'Within 4 hours',
    'Within 6 hours',
    'Within 12 hours',
    'Within 24 hours',
    'Tomorrow',
    'To be confirmed'
  ]

  await t.test('1. Assign Enquiry Engineer modal removes exact date and time inputs', () => {
    assert.doesNotMatch(
      enquiriesPageCode,
      /id="assign-visit-date"/,
      'Assign modal must not contain assign-visit-date input'
    )
    assert.doesNotMatch(
      enquiriesPageCode,
      /id="assign-visit-time"/,
      'Assign modal must not contain assign-visit-time input'
    )
  })

  await t.test('2. Assign Enquiry Engineer modal has Expected Engineer Arrival dropdown with all 8 options', () => {
    assert.match(enquiriesPageCode, /id="assign-expected-arrival"/, 'Must have assign-expected-arrival select element')
    assert.match(enquiriesPageCode, /Expected Engineer Arrival/, 'Must label as Expected Engineer Arrival')

    for (const opt of EXPECTED_OPTIONS) {
      assert.ok(
        enquiriesPageCode.includes(`<option value="${opt}">${opt}</option>`),
        `Assign modal select must include option: "${opt}"`
      )
    }
  })

  await t.test('3. Self-assign modal has Expected Engineer Arrival dropdown with all 8 options', () => {
    assert.match(enquiriesPageCode, /id="self-expected-arrival"/, 'Must have self-expected-arrival select element')
    assert.doesNotMatch(enquiriesPageCode, /id="self-visit-date"/, 'Self-assign must not contain self-visit-date input')
    assert.doesNotMatch(enquiriesPageCode, /id="self-visit-time"/, 'Self-assign must not contain self-visit-time input')

    for (const opt of EXPECTED_OPTIONS) {
      assert.ok(
        enquiriesPageCode.includes(`<option value="${opt}">${opt}</option>`),
        `Self-assign modal select must include option: "${opt}"`
      )
    }
  })

  await t.test('4. Visit Note and Assignment Reason fields are preserved in Assign modal', () => {
    assert.match(enquiriesPageCode, /id="assign-visit-note"/, 'Must preserve assign-visit-note field')
    assert.match(enquiriesPageCode, /id="assign-reason-input"/, 'Must preserve assign-reason-input field')
  })

  await t.test('5. Assignment details display shows expected_arrival duration when present', () => {
    assert.match(
      enquiriesPageCode,
      /selectedEnquiry\.expected_arrival/,
      'Enquiry details must check selectedEnquiry.expected_arrival'
    )
    assert.match(
      enquiriesPageCode,
      /⏱️ \{selectedEnquiry\.expected_arrival\}/,
      'Enquiry details must display selected duration'
    )
  })

  await t.test('6. Historical records with expected_visit_at remain readable in UI', () => {
    assert.match(
      enquiriesPageCode,
      /selectedEnquiry\.expected_visit_at \? \([\s\S]*?📅 \{formatDateTime\(selectedEnquiry\.expected_visit_at\)\}/,
      'Enquiry details must fall back to formatDateTime for historical expected_visit_at'
    )
  })

  await t.test('7. jobDispatchFormatter includes expected arrival duration in plain text dispatch', () => {
    const enquiryWithDuration = {
      enquiry_number: 'ENQ-2026-001',
      name: 'Ramesh Sharma',
      contact_info: '9876543210',
      assigned_employee_name: 'Divyanshu Prasad',
      assigned_employee_phone: '7900639360',
      expected_arrival: 'Within 2 hours',
      assignment_visit_note: 'Bring thermal paste and multimeter'
    }

    const text = formatJobDispatchText(enquiryWithDuration)
    assert.match(text, /\*Expected Arrival:\* Within 2 hours/, 'Dispatch text must contain Expected Arrival')
    assert.match(text, /\*Visit Note:\* Bring thermal paste and multimeter/, 'Dispatch text must contain Visit Note')
  })

  await t.test('8. jobDispatchFormatter preserves historical expected_visit_at in plain text dispatch', () => {
    const historicalEnquiry = {
      enquiry_number: 'ENQ-2026-002',
      name: 'Priya Verma',
      contact_info: '9876543211',
      assigned_employee_name: 'Amit Kumar',
      assigned_employee_phone: '9876543210',
      expected_visit_at: '2026-11-01T10:30:00.000Z'
    }

    const text = formatJobDispatchText(historicalEnquiry)
    assert.match(text, /\*Expected Visit:\*/, 'Dispatch text must contain formatted Expected Visit for historical records')
  })

  await t.test('9. buildWhatsAppDispatchUrl encodes expected arrival duration', () => {
    const enquiry = {
      assigned_employee_name: 'Divyanshu Prasad',
      assigned_employee_phone: '7900639360',
      expected_arrival: 'Tomorrow'
    }

    const url = buildWhatsAppDispatchUrl(enquiry)
    assert.ok(url.startsWith('https://wa.me/917900639360?text='), 'Must target engineer WhatsApp')
    assert.ok(url.includes(encodeURIComponent('*Expected Arrival:* Tomorrow')), 'URL must encode expected arrival')
  })

  await t.test('10. AdminDataProvider passes p_expected_arrival to RPC and updates state', () => {
    assert.match(
      dataProviderCode,
      /p_expected_arrival:\s*expectedArrival\s*\|\|\s*null/,
      'assignEnquiryEmployee must pass p_expected_arrival to RPC'
    )
    assert.match(
      dataProviderCode,
      /expected_arrival:\s*expectedArrival\s*\|\|\s*null/,
      'assignEnquiryEmployee demo fallback must store expected_arrival'
    )
  })

  await t.test('11. Account role is added to AdminAuthProvider validRoles', () => {
    assert.match(
      authProviderCode,
      /'account'/,
      'AdminAuthProvider must recognize account role'
    )
  })

  await t.test('12. Account role is added to AdminDataProvider PERMITTED_ROLES and helper', () => {
    assert.match(
      dataProviderCode,
      /const PERMITTED_ROLES = \['admin', 'engineer', 'inventory_staff', 'hr', 'technical', 'account'\]/,
      'AdminDataProvider must allow account in PERMITTED_ROLES'
    )
    assert.match(
      dataProviderCode,
      /isAccount:\s*adminUser\?\.role === 'account'/,
      'AdminDataProvider must export isAccount helper'
    )
  })

  await t.test('13. AdminStaffPage supports Account role in UI (badge, filter, invite, change role)', () => {
    assert.match(staffPageCode, /Account \/ Finance/, 'AdminStaffPage must include Account metric')
    assert.match(staffPageCode, /<option value="account">📊 Account \/ Finance<\/option>/, 'Must include account filter')
    assert.match(staffPageCode, /member\.role === 'account'/, 'Must have account role badge')
    assert.match(staffPageCode, /value="account"[\s\S]*?📊 Account \(Finance & Billing\)/, 'Invite modal must have account radio')
    assert.match(staffPageCode, /value="account"[\s\S]*?📊 Account \(account\)/, 'Change role modal must have account radio')
  })

  await t.test('14. AdminLayout supports Account role badge and nav items', () => {
    assert.match(layoutCode, /adminUser\?\.role === 'account'[\s\S]*?'📊 Account'/, 'Layout must display Account chip')
    assert.match(layoutCode, /id: 'orders'[\s\S]*?'account'/, 'Orders nav must allow account')
    assert.match(layoutCode, /id: 'enquiries'[\s\S]*?'account'/, 'Enquiries nav must allow account')
  })

  await t.test('15. Database migration defines expected_arrival constraint and account role', () => {
    assert.match(
      migrationCode,
      /ALTER TABLE public\.admin_users ADD CONSTRAINT admin_users_role_check[\s\S]*?'account'/,
      'Migration must add account to admin_users_role_check'
    )
    assert.match(
      migrationCode,
      /ALTER TABLE public\.enquiries[\s\S]*?ADD COLUMN IF NOT EXISTS expected_arrival TEXT NULL/,
      'Migration must add expected_arrival column'
    )
    for (const opt of EXPECTED_OPTIONS) {
      assert.ok(
        migrationCode.includes(`'${opt}'`),
        `Migration check constraint must include "${opt}"`
      )
    }
  })
})
