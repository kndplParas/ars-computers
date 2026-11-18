import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Pure helper logic under test replicated from AdminEnquiriesPage to test standalone algorithms
import { getISTCalendarDate, classifyEnquiry } from '../src/utils/enquiryClassification.js'

test('Suite 1: Enquiry ID & Search Normalization', async (t) => {
  const enquiries = [
    { id: 'uuid-1', enquiry_number: 'ARS-ENQ-01019', customer_name: 'Rajesh Sharma', phone: '+91 98765 43210', message: 'Laptop repair' },
    { id: 'uuid-2', enquiry_number: 'ARS-ENQ-01020', customer_name: 'Amit Patel', phone: '09876543211', message: 'CCTV setup' },
    { id: 'uuid-3', enquiry_number: 'ARS-ENQ-00999', customer_name: 'Priya Verma', phone: '9876543212', message: 'Printer AMC' }
  ]

  function searchFilter(list, query) {
    const q = query.trim().toLowerCase()
    const cleanQ = q.replace(/^#/, '').trim()
    const qDigits = q.replace(/\D/g, '')

    return list.filter((item) => {
      const customerName = item.customer_name || item.name || ''
      const enquiryNumber = item.enquiry_number || ''
      const rawPhone = item.phone || ''
      const rawContact = item.contact_info || ''
      const phoneDigits = rawPhone.replace(/\D/g, '')
      const contactDigits = rawContact.replace(/\D/g, '')

      const matchesEnquiryNumber =
        enquiryNumber &&
        (enquiryNumber.toLowerCase().includes(q) ||
         enquiryNumber.toLowerCase().includes(cleanQ) ||
         cleanQ.includes(enquiryNumber.toLowerCase()))

      const matchesPhoneDigits =
        qDigits.length >= 3 &&
        (phoneDigits.includes(qDigits) ||
         contactDigits.includes(qDigits) ||
         (qDigits.length === 10 && phoneDigits.endsWith(qDigits)) ||
         (phoneDigits.length === 10 && qDigits.endsWith(phoneDigits)))

      return (
        !q ||
        matchesEnquiryNumber ||
        item.id.toLowerCase().includes(cleanQ) ||
        customerName.toLowerCase().includes(q) ||
        matchesPhoneDigits ||
        (item.message && item.message.toLowerCase().includes(q))
      )
    })
  }

  await t.test('Matches exact enquiry number case-insensitively', () => {
    const res = searchFilter(enquiries, 'ars-enq-01019')
    assert.equal(res.length, 1)
    assert.equal(res[0].enquiry_number, 'ARS-ENQ-01019')
  })

  await t.test('Matches enquiry number with leading # prefix', () => {
    const res = searchFilter(enquiries, '#ARS-ENQ-01019')
    assert.equal(res.length, 1)
    assert.equal(res[0].enquiry_number, 'ARS-ENQ-01019')
  })

  await t.test('Matches numerical suffix only', () => {
    const res = searchFilter(enquiries, '01019')
    assert.equal(res.length, 1)
    assert.equal(res[0].enquiry_number, 'ARS-ENQ-01019')
  })

  await t.test('Matches normalized phone number regardless of formatting', () => {
    // Search with spaces and +91
    const res1 = searchFilter(enquiries, '9876543210')
    assert.equal(res1.length, 1)
    assert.equal(res1[0].customer_name, 'Rajesh Sharma')

    // Search with +91
    const res2 = searchFilter(enquiries, '+91-98765-43210')
    assert.equal(res2.length, 1)
    assert.equal(res2[0].customer_name, 'Rajesh Sharma')
  })
})

test('Suite 2: Date Presets & Employee Filter Logic', async (t) => {
  const now = new Date('2026-11-17T12:00:00+05:30')
  const todayIst = getISTCalendarDate(now)

  // Construct dates relative to IST today
  const [year, month, day] = todayIst.split('-').map(Number)
  const pad = (n) => String(n).padStart(2, '0')
  const yesterdayIst = `${year}-${pad(month)}-${pad(day - 1)}`
  const threeDaysAgoIst = `${year}-${pad(month)}-${pad(day - 3)}`
  const tenDaysAgoIst = `${year}-${pad(month)}-${pad(day - 10)}`

  const enquiries = [
    { id: '1', created_at: `${todayIst}T04:00:00Z`, assigned_employee_id: 'emp-1' },
    { id: '2', created_at: `${yesterdayIst}T06:00:00Z`, assigned_employee_id: 'emp-2' },
    { id: '3', created_at: `${threeDaysAgoIst}T08:00:00Z`, assigned_employee_id: null },
    { id: '4', created_at: `${tenDaysAgoIst}T10:00:00Z`, assigned_employee_id: 'emp-1' }
  ]

  function applyDateAndStaffFilter(list, datePreset, staffFilter) {
    return list.filter((item) => {
      // Staff filter
      if (staffFilter) {
        if (staffFilter === 'unassigned') {
          if (item.assigned_employee_id) return false
        } else if (item.assigned_employee_id !== staffFilter) {
          return false
        }
      }

      // Date filter
      if (datePreset === 'all') return true
      const itemIstDate = getISTCalendarDate(item.created_at)
      if (datePreset === 'today') {
        return itemIstDate === todayIst
      } else if (datePreset === 'yesterday') {
        return itemIstDate === yesterdayIst
      } else if (datePreset === 'last_7_days') {
        const itemTime = new Date(item.created_at).getTime()
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
        return itemTime >= sevenDaysAgo
      } else if (datePreset === 'last_30_days') {
        const itemTime = new Date(item.created_at).getTime()
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000
        return itemTime >= thirtyDaysAgo
      }
      return true
    })
  }

  await t.test('Filters correctly for "today"', () => {
    const res = applyDateAndStaffFilter(enquiries, 'today', '')
    assert.equal(res.length, 1)
    assert.equal(res[0].id, '1')
  })

  await t.test('Filters correctly for "yesterday"', () => {
    const res = applyDateAndStaffFilter(enquiries, 'yesterday', '')
    assert.equal(res.length, 1)
    assert.equal(res[0].id, '2')
  })

  await t.test('Filters correctly for "last_7_days"', () => {
    const res = applyDateAndStaffFilter(enquiries, 'last_7_days', '')
    assert.equal(res.length, 3) // 1, 2, 3
  })

  await t.test('Filters correctly for staff "unassigned"', () => {
    const res = applyDateAndStaffFilter(enquiries, 'all', 'unassigned')
    assert.equal(res.length, 1)
    assert.equal(res[0].id, '3')
  })

  await t.test('Filters correctly for specific staff ID', () => {
    const res = applyDateAndStaffFilter(enquiries, 'all', 'emp-1')
    assert.equal(res.length, 2)
    assert.deepEqual(res.map(r => r.id), ['1', '4'])
  })
})

test('Suite 3: Overdue and Expected Visit Date Indicators', async (t) => {
  const refTime = new Date('2026-11-17T12:00:00+05:30')

  const enqOnTime = {
    id: 'e-1',
    status: 'in_progress',
    expected_visit_at: '2026-11-18T10:00:00+05:30',
    visit_status: 'scheduled'
  }

  const enqOverdue = {
    id: 'e-2',
    status: 'in_progress',
    expected_visit_at: '2026-11-16T10:00:00+05:30',
    visit_status: 'scheduled'
  }

  const c1 = classifyEnquiry(enqOnTime, refTime)
  const c2 = classifyEnquiry(enqOverdue, refTime)

  assert.equal(c1.isOverdue, false, 'Future follow up must not be overdue')
  assert.equal(c2.isOverdue, true, 'Past follow up must be flagged overdue')
})

test('Suite 4: Unified Chronological Timeline Merging', async (t) => {
  const trackingHistory = [
    {
      id: 'trk-1',
      change_kind: 'status',
      previous_value: 'received',
      new_value: 'diagnosing',
      updated_by_name: 'Paras Kandpal',
      created_at: '2026-11-17T10:00:00Z'
    },
    {
      id: 'trk-2',
      change_kind: 'visit',
      previous_value: 'scheduled',
      new_value: 'arrived',
      updated_by_name: 'Engineer Amit',
      created_at: '2026-11-17T11:00:00Z'
    }
  ]

  const internalActivities = [
    {
      id: 'act-1',
      activity_type: 'assigned',
      actor_email: 'head@ars.com',
      actor_role: 'superadmin',
      content: 'Assigned to Engineer Amit',
      created_at: '2026-11-17T09:30:00Z'
    },
    {
      id: 'act-2',
      activity_type: 'note',
      actor_email: 'amit@ars.com',
      actor_role: 'engineer',
      content: 'Contacted customer, visiting in 30 mins',
      created_at: '2026-11-17T10:30:00Z'
    }
  ]

  function mergeUnifiedTimeline(tracking, internal) {
    const list = [
      ...tracking.map((trk) => ({
        id: `tracking-${trk.id}`,
        source: 'tracking',
        author: trk.updated_by_name,
        timestamp: trk.created_at
      })),
      ...internal.map((act) => ({
        id: `activity-${act.id}`,
        source: 'internal',
        author: act.actor_email,
        timestamp: act.created_at
      }))
    ]
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const merged = mergeUnifiedTimeline(trackingHistory, internalActivities)
  assert.equal(merged.length, 4)
  assert.equal(merged[0].id, 'tracking-trk-2', 'Most recent event (11:00) must appear first')
  assert.equal(merged[1].id, 'activity-act-2', 'Second event (10:30) must appear second')
  assert.equal(merged[2].id, 'tracking-trk-1', 'Third event (10:00) must appear third')
  assert.equal(merged[3].id, 'activity-act-1', 'Oldest event (09:30) must appear last')
})

test('Suite 5: Bulk Assignment Protection & Validation', async (t) => {
  const selectedEnquiries = [
    { id: '1', status: 'new', is_archived: false, is_in_bin: false, is_removed: false },
    { id: '2', status: 'in_progress', is_archived: false, is_in_bin: false, is_removed: false },
    { id: '3', status: 'completed', is_archived: false, is_in_bin: false, is_removed: false, completion_approved_at: '2026-11-17T00:00:00Z' },
    { id: '4', status: 'rejected', is_archived: false, is_in_bin: false, is_removed: false },
    { id: '5', status: 'in_progress', is_archived: true, is_in_bin: false, is_removed: false },
    { id: '6', status: 'new', is_archived: false, is_in_bin: true, is_removed: false },
    { id: '7', status: 'new', is_archived: false, is_in_bin: false, is_removed: true }
  ]

  function filterEligibleForBulkAssign(list) {
    return list.filter((item) => {
      const c = classifyEnquiry(item)
      return (
        !item.is_removed &&
        !c.isRemoved &&
        !item.is_archived &&
        !c.isCompleted &&
        !item.is_in_bin &&
        !c.isInBin &&
        ['new', 'in_progress', 'quoted', 'returned_for_rework'].includes(item.status) &&
        !item.completion_approved_at
      )
    })
  }

  const eligible = filterEligibleForBulkAssign(selectedEnquiries)
  assert.equal(eligible.length, 2, 'Only workable active non-archived non-bin non-removed non-completed records are eligible')
  assert.deepEqual(eligible.map(e => e.id), ['1', '2'])
})

test('Suite 6: Client-Side Pagination Slicing', async (t) => {
  const items = Array.from({ length: 65 }, (_, i) => ({ id: `enq-${i + 1}` }))

  function paginate(list, page, size) {
    if (size === 'all') return list
    const startIndex = (page - 1) * Number(size)
    return list.slice(startIndex, startIndex + Number(size))
  }

  const page1 = paginate(items, 1, 25)
  assert.equal(page1.length, 25)
  assert.equal(page1[0].id, 'enq-1')
  assert.equal(page1[24].id, 'enq-25')

  const page2 = paginate(items, 2, 25)
  assert.equal(page2.length, 25)
  assert.equal(page2[0].id, 'enq-26')
  assert.equal(page2[24].id, 'enq-50')

  const page3 = paginate(items, 3, 25)
  assert.equal(page3.length, 15)
  assert.equal(page3[0].id, 'enq-51')
  assert.equal(page3[14].id, 'enq-65')

  const allPage = paginate(items, 1, 'all')
  assert.equal(allPage.length, 65)
})

test('Suite 7: Direct Source & Permission Invariants on AdminEnquiriesPage.jsx', async (t) => {
  const pageSource = fs.readFileSync('src/pages/admin/AdminEnquiriesPage.jsx', 'utf8')

  await t.test('Bulk assignment is strictly Head/Superadmin-only', () => {
    // 1. handleOpenBulkAssignModal checks isSuperadmin
    assert.match(
      pageSource,
      /const\s+handleOpenBulkAssignModal\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!isSuperadmin/m,
      'handleOpenBulkAssignModal must abort immediately if caller is not superadmin'
    )

    // 2. handleExecuteBulkAssign checks isSuperadmin
    assert.match(
      pageSource,
      /const\s+handleExecuteBulkAssign\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!isSuperadmin\)\s*\{/m,
      'handleExecuteBulkAssign must reject execution if caller is not superadmin'
    )

    // 3. Bulk toolbar in JSX is gated by isSuperadmin
    assert.match(
      pageSource,
      /isSuperadmin\s*&&\s*activeWorkflowTab\s*!==\s*['"]removed['"]\s*&&\s*selectedEnquiryIds\.size\s*>\s*0/m,
      'Bulk toolbar must only render for superadmin'
    )

    // 4. Bulk modal JSX is guarded by isBulkAssignModalOpen && isSuperadmin
    assert.match(
      pageSource,
      /isBulkAssignModalOpen\s*&&\s*isSuperadmin/m,
      'Bulk assign modal must only render for superadmin'
    )

    // 5. Explicitly rejects removed enquiries in handleExecuteBulkAssign
    assert.match(
      pageSource,
      /if\s*\(\s*enq\.is_removed\s*\|\|\s*c\.isRemoved\s*\)/m,
      'handleExecuteBulkAssign must explicitly check enq.is_removed || c.isRemoved'
    )
  })

  await t.test('Employee self-assignment is restricted to operational employees', () => {
    // 1. handleSelfAssign guards on isOperationalUser
    assert.match(
      pageSource,
      /const\s+handleSelfAssign\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!target\s*\|\|\s*!isOperationalUser\)\s*return/m,
      'handleSelfAssign must abort if caller is not an operational user'
    )

    // 2. handleConfirmSelfAssign guards on isOperationalUser
    assert.match(
      pageSource,
      /const\s+handleConfirmSelfAssign\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!selectedEnquiry\s*\|\|\s*!isOperationalUser\)\s*return/m,
      'handleConfirmSelfAssign must abort if caller is not an operational user'
    )

    // 3. Desktop quick-self-assign-btn is gated by !isSuperadmin && isOperationalUser
    assert.match(
      pageSource,
      /!isSuperadmin\s*&&\s*isOperationalUser[\s\S]*?quick-self-assign-btn/m,
      'Desktop self-assignment button must be gated to operational non-superadmin users'
    )

    // 4. Mobile quick-self-assign-btn is gated by !isSuperadmin && isOperationalUser
    assert.match(
      pageSource,
      /!isSuperadmin\s*&&\s*isOperationalUser[\s\S]*?quick-self-assign-btn[\s\S]*?Self-Assign/m,
      'Mobile self-assignment button must be gated to operational non-superadmin users'
    )
  })

  await t.test('Employees cannot reassign another employee’s enquiry', () => {
    // 1. Quick reassign button in desktop table is strictly isSuperadmin
    assert.match(
      pageSource,
      /isSuperadmin\s*&&[\s\S]*?quick-reassign-btn[\s\S]*?Reassign/m,
      'Quick reassign button must be strictly reserved for superadmin'
    )

    // 2. Quick reassign button in mobile cards is strictly isSuperadmin
    assert.match(
      pageSource,
      /isSuperadmin\s*&&[\s\S]*?quick-assign-btn[\s\S]*?Reassign Engineer/m,
      'Mobile reassign button must be strictly reserved for superadmin'
    )

    // 3. Self-assign requires enquiry to be unassigned (!enq.assigned_employee_id)
    assert.match(
      pageSource,
      /!enq\.assigned_employee_id\s*&&[\s\S]*?quick-self-assign-btn/m,
      'Self-assign must only be offered when enquiry has no assigned employee'
    )

    // 4. Modal assignment open handler enforces isSuperadmin
    assert.match(
      pageSource,
      /const\s+handleOpenAssignModal\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!isSuperadmin/m,
      'handleOpenAssignModal must abort if caller is not superadmin'
    )
  })
})
