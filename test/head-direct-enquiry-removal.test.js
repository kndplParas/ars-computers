import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('ARS Computers — Step 7: Head Direct & Bulk Current-Month Enquiry Removal Test Suite', async (t) => {
  const enquiriesPagePath = path.join(process.cwd(), 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
  const dataProviderPath = path.join(process.cwd(), 'src', 'context', 'AdminDataProvider.jsx')
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261031000013_head_only_current_month_enquiry_removal.sql'
  )

  const enquiriesPage = fs.readFileSync(enquiriesPagePath, 'utf8')
  const dataProvider = fs.readFileSync(dataProviderPath, 'utf8')
  const migration = fs.readFileSync(migrationPath, 'utf8')

  await t.test('1. Eligibility Helper (isEnquiryEligibleForRemoval) Unit Logic', () => {
    // Extract actual function implementations from AdminEnquiriesPage.jsx
    const monthMatch = enquiriesPage.match(/function isCurrentCalendarMonth\(isoDateString\) \{[\s\S]*?\n\}/)
    assert.ok(monthMatch, 'isCurrentCalendarMonth must be defined in AdminEnquiriesPage.jsx')
    const eligibleMatch = enquiriesPage.match(/function isEnquiryEligibleForRemoval\(enquiry\) \{[\s\S]*?\n\}/)
    assert.ok(eligibleMatch, 'isEnquiryEligibleForRemoval must be defined in AdminEnquiriesPage.jsx')

    const isCurrentCalendarMonth = new Function('isoDateString', `${monthMatch[0]}; return isCurrentCalendarMonth(isoDateString);`)
    const isEnquiryEligibleForRemoval = new Function(
      'enquiry',
      'isCurrentCalendarMonth',
      `${eligibleMatch[0]}; return isEnquiryEligibleForRemoval(enquiry);`
    )

    const checkEligible = (enq) => isEnquiryEligibleForRemoval(enq, isCurrentCalendarMonth)

    const now = new Date()
    const currentMonthIso = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0).toISOString()
    const prevMonthIso = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0).toISOString()

    // 1. Eligible current-month active enquiry
    const eligibleEnquiry = {
      id: 'enq-001',
      created_at: currentMonthIso,
      status: 'new',
      is_removed: false,
      completion_approved_at: null
    }
    assert.equal(checkEligible(eligibleEnquiry), true, 'Active current-month enquiry must be eligible')

    // 2. Completed status enquiry (permanently protected)
    const completedEnquiry = {
      id: 'enq-002',
      created_at: currentMonthIso,
      status: 'completed',
      is_removed: false,
      completion_approved_at: null
    }
    assert.equal(checkEligible(completedEnquiry), false, 'Completed enquiry must be ineligible')

    // 3. Completion approved enquiry (permanently protected)
    const approvedEnquiry = {
      id: 'enq-003',
      created_at: currentMonthIso,
      status: 'in_bin',
      is_removed: false,
      completion_approved_at: new Date().toISOString()
    }
    assert.equal(checkEligible(approvedEnquiry), false, 'Completion-approved enquiry must be ineligible')

    // 4. Historical month enquiry (historical lock)
    const historicalEnquiry = {
      id: 'enq-004',
      created_at: prevMonthIso,
      status: 'new',
      is_removed: false,
      completion_approved_at: null
    }
    assert.equal(checkEligible(historicalEnquiry), false, 'Historical month enquiry must be ineligible')

    // 5. Already removed enquiry
    const alreadyRemovedEnquiry = {
      id: 'enq-005',
      created_at: currentMonthIso,
      status: 'new',
      is_removed: true,
      completion_approved_at: null
    }
    assert.equal(checkEligible(alreadyRemovedEnquiry), false, 'Already removed enquiry must be ineligible')

    // 6. Null or malformed enquiry
    assert.equal(checkEligible(null), false, 'Null enquiry must be ineligible')
    assert.equal(checkEligible({}), false, 'Empty enquiry must be ineligible')
  })

  await t.test('2. Row-Level Direct Remove Action on Active Enquiries', () => {
    // Row-level Remove button in desktop table
    assert.match(
      enquiriesPage,
      /isSuperadmin && activeWorkflowTab !== 'removed' && isEnquiryEligibleForRemoval\(enq\)/,
      'Desktop row-level Remove button must strictly require Superadmin, active tab (not removed), and eligibility'
    )
    assert.match(
      enquiriesPage,
      /className="btn-action-icon remove-enquiry-row-btn"/,
      'Desktop row must render remove-enquiry-row-btn'
    )
    assert.match(
      enquiriesPage,
      /title=\{`Soft-remove enquiry \$\{enq\.enquiry_number \|\| enq\.id\}`\}/,
      'Desktop row button must provide accessible tooltip with enquiry number'
    )

    // Direct trigger sets removal target without opening details modal
    assert.match(
      enquiriesPage,
      /setRemovalTargets\(\[enq\]\)/,
      'Clicking row-level remove must set removal targets directly'
    )

    // Mobile card direct remove button
    assert.match(
      enquiriesPage,
      /className="btn-outline btn-block remove-enquiry-mobile-btn"/,
      'Mobile card must render remove-enquiry-mobile-btn'
    )

    // Blocked on removed tab
    assert.match(
      enquiriesPage,
      /activeWorkflowTab !== 'removed'/,
      'Removal action must never appear in the removed tab'
    )
  })

  await t.test('3. Multiple Enquiry Selection and Bulk Removal Toolbar', () => {
    // Selected IDs state
    assert.match(
      enquiriesPage,
      /const \[selectedEnquiryIds, setSelectedEnquiryIds\] = useState\(\(\) => new Set\(\)\)/,
      'Component must manage selectedEnquiryIds as a Set'
    )

    // Selection reset on tab change
    assert.match(
      enquiriesPage,
      /handleWorkflowTabChange = \(tab\) => \{\s*setActiveWorkflowTab\(tab\)\s*setSelectedEnquiryIds\(new Set\(\)\)/,
      'Selection must automatically clear on workflow tab change'
    )

    // Header Select-All Checkbox
    assert.match(
      enquiriesPage,
      /id="select-all-eligible-enquiries-checkbox"/,
      'Table header must render select-all checkbox for eligible enquiries'
    )
    assert.match(
      enquiriesPage,
      /eligibleEnquiriesInView\.every\(\(e\) => selectedEnquiryIds\.has\(e\.id\)\)/,
      'Header checkbox checked state must check eligible enquiries in view'
    )

    // Row-level Checkbox
    assert.match(
      enquiriesPage,
      /className="enquiry-select-checkbox"/,
      'Eligible desktop rows must render selection checkbox'
    )
    assert.match(
      enquiriesPage,
      /className="enquiry-select-checkbox-mobile"/,
      'Eligible mobile cards must render selection checkbox'
    )

    // Ineligible enquiries show placeholder instead of checkbox
    assert.match(
      enquiriesPage,
      /isEnquiryEligibleForRemoval\(enq\)\s*\?[\s\S]*?className="enquiry-select-checkbox"[\s\S]*?:[\s\S]*?title=\{[\s\S]*?Completed\/approved enquiries are permanently protected/,
      'Ineligible enquiries must not render a selectable checkbox'
    )

    // Bulk Removal Toolbar
    assert.match(
      enquiriesPage,
      /isSuperadmin && activeWorkflowTab !== 'removed' && selectedEnquiryIds\.size > 0/,
      'Bulk removal toolbar must only appear for Superadmin when eligible items are selected'
    )
    assert.match(
      enquiriesPage,
      /className="bulk-removal-toolbar"/,
      'Bulk removal toolbar element must be rendered'
    )
    assert.match(
      enquiriesPage,
      /className="btn-outline btn-sm clear-selection-btn"/,
      'Toolbar must provide Clear Selection button'
    )
    assert.match(
      enquiriesPage,
      /id="bulk-remove-selected-btn"/,
      'Toolbar must provide Remove Selected button'
    )
  })

  await t.test('4. Mandatory Removal Confirmation Modal & Multi-Target Support', () => {
    // Modal opens for single target or multiple targets
    assert.match(
      enquiriesPage,
      /\(removalTarget \|\| \(removalTargets && removalTargets\.length > 0\)\) && isSuperadmin/,
      'Removal modal must open when targets are present and user is Superadmin'
    )

    // Modal title reflects single vs bulk count
    assert.match(
      enquiriesPage,
      /removalTargets\.length > 1[\s\S]*?`Soft-Remove \$\{removalTargets\.length\} Current-Month Enquiries`[\s\S]*?: 'Soft-Remove Current-Month Enquiry'/,
      'Modal title must dynamically show target count for bulk removal'
    )

    // Lists all enquiry numbers/IDs being removed
    assert.match(
      enquiriesPage,
      /removalTargets\.map\(\(t\) => \([\s\S]*?<strong[\s\S]*?\{t\.enquiry_number \|\| t\.id\}<\/strong>/,
      'Modal must list all enquiry numbers/IDs when removing multiple enquiries'
    )

    // Categories
    assert.match(enquiriesPage, /<option value="spam">Spam<\/option>/, 'Category: Spam')
    assert.match(enquiriesPage, /<option value="fake_enquiry">Fake enquiry<\/option>/, 'Category: Fake enquiry')
    assert.match(enquiriesPage, /<option value="duplicate">Duplicate enquiry<\/option>/, 'Category: Duplicate enquiry')
    assert.match(enquiriesPage, /<option value="invalid_contact">Invalid contact details<\/option>/, 'Category: Invalid contact details')
    assert.match(enquiriesPage, /<option value="test_enquiry">Test enquiry<\/option>/, 'Category: Test enquiry')
    assert.match(enquiriesPage, /<option value="other">Other \(with explanation\)<\/option>/, 'Category: Other')

    // Explanation requirement
    assert.match(
      enquiriesPage,
      /if \(!cleanReason \|\| cleanReason\.length < 3\)/,
      'Reason must require at least 3 characters'
    )
    assert.match(
      enquiriesPage,
      /if \(removalCategory === 'other' && cleanReason\.length < 5\)/,
      'Reason must require at least 5 characters for Other category'
    )

    // Multi-target execution in handleConfirmRemoval
    assert.match(
      enquiriesPage,
      /for \(const target of removalTargets\) \{[\s\S]*?await removeCurrentMonthEnquiry\(target\.id, removalCategory, cleanReason\)/,
      'handleConfirmRemoval must sequentially execute removeCurrentMonthEnquiry for all targets'
    )

    // Confirm button ID preserved
    assert.match(
      enquiriesPage,
      /id="confirm-soft-removal-btn"/,
      'Modal confirm button must retain id="confirm-soft-removal-btn"'
    )
  })

  await t.test('5. Direct Restore Action in Removed Tab', () => {
    // Restore button in desktop table
    assert.match(
      enquiriesPage,
      /activeWorkflowTab === 'removed' && isSuperadmin[\s\S]*?className="btn-action-icon restore-removed-action-btn"/,
      'Desktop row in removed tab must render restore-removed-action-btn'
    )

    // Restore button in mobile card
    assert.match(
      enquiriesPage,
      /activeWorkflowTab === 'removed' && isSuperadmin[\s\S]*?className="btn-outline btn-block restore-removed-action-btn"/,
      'Mobile card in removed tab must render restore-removed-action-btn'
    )

    // Calls handleRestoreRemoved
    assert.match(
      enquiriesPage,
      /handleRestoreRemoved\(enq\)/,
      'Restore button must call handleRestoreRemoved'
    )
  })

  await t.test('6. Security Invariants: Superadmin Only & Non-Superadmin Blocking', () => {
    // UI gating: all removal controls check isSuperadmin
    assert.match(
      enquiriesPage,
      /const isSuperadmin = adminUser\?\.role === 'superadmin'/,
      'isSuperadmin must be derived strictly from adminUser?.role === superadmin'
    )

    // AdminDataProvider throws for non-superadmin
    assert.match(
      dataProvider,
      /if \(adminUser\?\.role !== 'superadmin'\) \{\s*throw new Error\('Access denied: Only Superadministrator can remove fake or spam enquiries\.'\)/,
      'AdminDataProvider must enforce role check'
    )

    // Database migration enforces superadmin in PostgreSQL RPC
    assert.match(
      migration,
      /v_actor_role != 'superadmin' THEN[\s\S]*?RAISE EXCEPTION 'Access denied: Only Superadministrator can remove/,
      'PostgreSQL RPC must enforce superadmin role check'
    )
  })
})
