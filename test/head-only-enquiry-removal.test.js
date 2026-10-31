import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { filterEnquiriesByReportingMonth } from '../src/utils/excelReportGenerator.js'

test('ARS Computers — Step 7: Head-Only Current-Month Fake/Spam Enquiry Removal Test Suite', async (t) => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261031000013_head_only_current_month_enquiry_removal.sql'
  )
  const dataProviderPath = path.join(process.cwd(), 'src', 'context', 'AdminDataProvider.jsx')
  const enquiriesPagePath = path.join(process.cwd(), 'src', 'pages', 'admin', 'AdminEnquiriesPage.jsx')
  const excelGenPath = path.join(process.cwd(), 'src', 'utils', 'excelReportGenerator.js')

  const migration = fs.readFileSync(migrationPath, 'utf8')
  const dataProvider = fs.readFileSync(dataProviderPath, 'utf8')
  const enquiriesPage = fs.readFileSync(enquiriesPagePath, 'utf8')
  const excelGen = fs.readFileSync(excelGenPath, 'utf8')

  await t.test('1. Database Migration: RPC security, current-month check, and RLS enforcement', () => {
    // Check RPC definition
    assert.match(
      migration,
      /CREATE OR REPLACE FUNCTION public\.remove_current_month_enquiry/,
      'Migration must define remove_current_month_enquiry RPC'
    )

    // Strictly check for Superadmin role
    assert.match(
      migration,
      /v_actor_role != 'superadmin'/,
      'RPC must strictly check for Superadmin role'
    )

    // Current month check
    assert.match(
      migration,
      /date_trunc\('month',\s*v_now/,
      'RPC must truncate current timestamp to month'
    )
    assert.match(
      migration,
      /date_trunc\('month',\s*v_enquiry\.created_at/,
      'RPC must truncate enquiry creation date to month'
    )
    assert.match(
      migration,
      /Historical lock violation/,
      'RPC must raise Historical lock violation when created outside current calendar month'
    )

    // Completed & approved enquiry protection
    assert.match(
      migration,
      /v_enquiry\.completion_approved_at IS NOT NULL OR v_enquiry\.status = 'completed'/,
      'RPC must protect approved completed enquiries from removal'
    )

    // Mandatory categories
    assert.match(
      migration,
      /'spam'[\s\S]*?'fake_enquiry'[\s\S]*?'duplicate'[\s\S]*?'invalid_contact'[\s\S]*?'test_enquiry'[\s\S]*?'other'/,
      'RPC must support the 6 mandatory removal categories'
    )

    // Future-dated enquiry guard
    assert.match(
      migration,
      /v_enquiry\.created_at > v_now[\s\S]*?Future-dated enquiries cannot be processed/,
      'RPC must block future-dated enquiries'
    )

    // Detailed explanation requirement for "Other" category
    assert.match(
      migration,
      /v_clean_category = 'other' AND \(LENGTH\(v_clean_reason\) < 5/,
      'RPC must require detailed explanation (minimum 5 chars) for Other category'
    )

    // Soft-removal invariant (UPDATE is_removed = true, never DELETE)
    assert.match(
      migration,
      /UPDATE public\.enquiries[\s\S]*?is_removed\s*=\s*true/,
      'RPC must set is_removed = true'
    )
    assert.doesNotMatch(
      migration,
      /DELETE FROM public\.enquiries/,
      'RPC must NEVER physically delete enquiries'
    )

    // RLS Policy restricting non-superadmin from viewing soft-removed records
    assert.match(
      migration,
      /CREATE POLICY "Admins can view enquiries"[\s\S]*?public\.is_superadmin\(\)\s*OR\s*\(public\.is_admin\(\)\s*AND\s*\(is_removed IS FALSE OR is_removed IS NULL\)\)/,
      'RLS policy must hide soft-removed records from non-superadmin roles'
    )

    // Grants & Revocations
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION public\.remove_current_month_enquiry\(UUID,\s*TEXT,\s*TEXT\)\s*FROM PUBLIC,\s*anon;/,
      'RPC execution must be revoked from public and anon'
    )
  })

  await t.test('2. AdminDataProvider: Head-only authorization and validation logic', () => {
    // Non-superadmin check
    assert.match(
      dataProvider,
      /if \(adminUser\?\.role !== 'superadmin'\) \{\s*throw new Error\('Access denied: Only Superadministrator can remove fake or spam enquiries\.'\)/,
      'AdminDataProvider must restrict removeCurrentMonthEnquiry to superadmin'
    )

    // Category and reason validation
    assert.match(
      dataProvider,
      /const allowedCategories = \['spam', 'fake_enquiry', 'duplicate', 'invalid_contact', 'test_enquiry', 'other'\]/,
      'AdminDataProvider must validate permitted categories'
    )
    assert.match(
      dataProvider,
      /if \(cleanReason\.length < 3\)/,
      'AdminDataProvider must enforce minimum reason length'
    )
    assert.match(
      dataProvider,
      /cleanCategory === 'other' && \(cleanReason\.length < 5/,
      'AdminDataProvider must enforce explanation for Other category'
    )

    // Historical month and completed protection in demo mode
    assert.match(
      dataProvider,
      /if \(enqDate > now\) \{\s*throw new Error\('Validation error: Future-dated enquiries cannot be processed\.'\)/,
      'AdminDataProvider must block future-dated enquiries'
    )
    assert.match(
      dataProvider,
      /if \(target\.completion_approved_at \|\| target\.status === 'completed'\)/,
      'AdminDataProvider must protect approved/completed records'
    )
    assert.match(
      dataProvider,
      /if \(enqDate\.getFullYear\(\) !== now\.getFullYear\(\) \|\| enqDate\.getMonth\(\) !== now\.getMonth\(\)\)/,
      'AdminDataProvider must enforce current calendar month check in demo mode'
    )

    // Inactive/archived/removed counts in metrics
    assert.match(
      dataProvider,
      /const activeEnquiries = enquiries\.filter\(\(e\) => !e\.is_archived && !e\.is_removed\)/,
      'AdminDataProvider metrics must exclude is_removed from active enquiries'
    )
    assert.match(
      dataProvider,
      /removedCount:\s*enquiries\.filter\(\(e\) => e\.is_removed\)\.length/,
      'AdminDataProvider metrics must track removedCount'
    )
  })

  await t.test('3. AdminEnquiriesPage: Tab isolation, modal triggers, and UI gating', () => {
    // Non-superadmin restriction from removed tab
    assert.match(
      enquiriesPage,
      /\(!isSuperadmin && \(activeWorkflowTab === 'bin' \|\| activeWorkflowTab === 'removed'\)\) \? 'all_active' : activeWorkflowTab/,
      'Non-superadmin must be strictly redirected away from removed tab'
    )

    // Tab button rendered only for Superadmin
    assert.match(
      enquiriesPage,
      /\{isSuperadmin && \(\s*<button[\s\S]*?id="tab-removed"/,
      'Removed tab button must only be rendered for Superadmin'
    )

    // Active metrics exclude is_removed
    assert.match(
      enquiriesPage,
      /const active = enquiries\.filter\(\(e\) => !e\.is_archived && !e\.is_in_bin && e\.status !== 'in_bin' && !e\.is_removed\)/,
      'AdminEnquiriesPage active metrics must exclude is_removed'
    )

    // Filtered enquiries tab isolation
    assert.match(
      enquiriesPage,
      /if \(effectiveWorkflowTab === 'removed'\) \{\s*if \(!isRemoved\) return false/,
      'Removed tab must only show is_removed === true records'
    )
    assert.match(
      enquiriesPage,
      /else \{\s*if \(isRemoved\) return false/,
      'Standard workflow tabs must never show is_removed === true records'
    )

    // Removal button condition: superadmin, not removed, not approved/completed, current calendar month
    assert.match(
      enquiriesPage,
      /isSuperadmin && !selectedEnquiry\.is_removed && !selectedEnquiry\.completion_approved_at && selectedEnquiry\.status !== 'completed' && isCurrentCalendarMonth\(selectedEnquiry\.created_at\)/,
      'Removal button must strictly require Superadmin, unremoved, unapproved, and current calendar month'
    )

    // Confirmation modal contains required categories and reason
    assert.match(
      enquiriesPage,
      /<option value="spam">Spam<\/option>/,
      'Removal modal must contain Spam option'
    )
    assert.match(
      enquiriesPage,
      /<option value="fake_enquiry">Fake enquiry<\/option>/,
      'Removal modal must contain Fake enquiry option'
    )
    assert.match(
      enquiriesPage,
      /<option value="duplicate">Duplicate enquiry<\/option>/,
      'Removal modal must contain Duplicate option'
    )
    assert.match(
      enquiriesPage,
      /<option value="invalid_contact">Invalid contact details<\/option>/,
      'Removal modal must contain Invalid contact option'
    )
    assert.match(
      enquiriesPage,
      /<option value="test_enquiry">Test enquiry<\/option>/,
      'Removal modal must contain Test enquiry option'
    )
    assert.match(
      enquiriesPage,
      /<option value="other">Other \(with explanation\)<\/option>/,
      'Removal modal must contain Other option'
    )
  })

  await t.test('4. Dashboard & Reports: Strict exclusion of soft-removed records', () => {
    // AdminDashboardPage uses metrics.enquiries which excludes is_removed
    assert.match(
      dataProvider,
      /const activeEnquiries = enquiries\.filter\(\(e\) => !e\.is_archived && !e\.is_removed\)/,
      'AdminDataProvider metrics must exclude is_removed from active enquiries'
    )

    // excelReportGenerator filterEnquiriesByReportingMonth excludes is_removed
    assert.match(
      excelGen,
      /if \(item\.is_removed\) return false/,
      'filterEnquiriesByReportingMonth must exclude is_removed'
    )

    // Test with actual data filtering
    const now = new Date()
    const targetMonth = now.getMonth()
    const targetYear = now.getFullYear()

    const mockEnquiries = [
      {
        id: 'ENQ-GENUINE-1',
        is_removed: false,
        completion_approved_at: now.toISOString(),
        status: 'completed'
      },
      {
        id: 'ENQ-REMOVED-SPAM',
        is_removed: true,
        completion_approved_at: now.toISOString(),
        status: 'completed',
        removal_category: 'spam',
        removal_reason: 'Automated SEO spam submission'
      }
    ]

    const filtered = filterEnquiriesByReportingMonth(mockEnquiries, targetMonth, targetYear)
    assert.equal(filtered.length, 1, 'Only genuine enquiry should be included in monthly report')
    assert.equal(filtered[0].id, 'ENQ-GENUINE-1', 'Genuine enquiry is preserved')
  })
})
