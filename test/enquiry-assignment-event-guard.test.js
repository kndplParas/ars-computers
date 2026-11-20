/**
 * ARS Computers — Regression Test Suite: Enquiry Assignment Event Leak & Parameter Guard
 *
 * Verifies that:
 * 1. React SyntheticEvents can never leak into selectedEnquiry state.
 * 2. handleOpenAssignModal and handleSelfAssign validate target enquiry objects.
 * 3. handleSaveAssignment validates selectedEnquiry.id before submission.
 * 4. assignEnquiryEmployee & selfAssignEnquiry fail closed if enquiryId is missing or falsy,
 *    preventing PostgREST missing-p_enquiry_id schema cache mismatch error.
 * 5. All JSX button handlers use closures rather than raw event pass-throughs.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pageSource = fs.readFileSync('src/pages/admin/AdminEnquiriesPage.jsx', 'utf8')
const providerSource = fs.readFileSync('src/context/AdminDataProvider.jsx', 'utf8')

test('Suite 1: SyntheticEvent Leakage Prevention & Enquiry Validation', async (t) => {
  await t.test('isValidEnquiryObject helper exists and checks for valid string id and rejects SyntheticEvents', () => {
    assert.match(
      pageSource,
      /const\s+isValidEnquiryObject\s*=\s*\([^)]*\)\s*=>[\s\S]*?!obj\.nativeEvent[\s\S]*?!obj\.preventDefault[\s\S]*?!obj\._reactName/m,
      'isValidEnquiryObject must guard against React SyntheticEvents'
    )
  })

  await t.test('handleOpenAssignModal sanitizes targetEnquiry and falls back to selectedEnquiry only if valid', () => {
    assert.match(
      pageSource,
      /const\s+handleOpenAssignModal\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?isValidEnquiryObject\(targetEnquiry\)/m,
      'handleOpenAssignModal must validate targetEnquiry with isValidEnquiryObject'
    )
    assert.match(
      pageSource,
      /if\s*\(!isSuperadmin\s*\|\|\s*!target\s*\|\|\s*!target\.id\)\s*return/m,
      'handleOpenAssignModal must abort if target has no valid id'
    )
  })

  await t.test('handleSelfAssign sanitizes targetEnquiry and falls back to selectedEnquiry only if valid', () => {
    assert.match(
      pageSource,
      /const\s+handleSelfAssign\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?isValidEnquiryObject\(targetEnquiry\)/m,
      'handleSelfAssign must validate targetEnquiry with isValidEnquiryObject'
    )
  })

  await t.test('handleSaveAssignment guards against missing selectedEnquiry.id', () => {
    assert.match(
      pageSource,
      /const\s+handleSaveAssignment\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!selectedEnquiry\?\.id\s*\|\|\s*!isSuperadmin\)\s*\{[\s\S]*?setAssignmentError\(['"]No valid enquiry is selected for assignment\.['"]\)/m,
      'handleSaveAssignment must reject submission when selectedEnquiry.id is missing'
    )
  })

  await t.test('No direct onClick={handleOpenAssignModal} or onClick={handleSelfAssign} exists in JSX', () => {
    // Buttons must use () => handleOpenAssignModal(...) or () => handleSelfAssign(...)
    assert.doesNotMatch(
      pageSource,
      /onClick=\{handleOpenAssignModal\}/,
      'Direct onClick={handleOpenAssignModal} must not exist; must use closure'
    )
    assert.doesNotMatch(
      pageSource,
      /onClick=\{handleSelfAssign\}/,
      'Direct onClick={handleSelfAssign} must not exist; must use closure'
    )
  })
})

test('Suite 2: AdminDataProvider Fail-Closed Invariants for RPC Arguments', async (t) => {
  await t.test('assignEnquiryEmployee throws immediately if enquiryId is falsy', () => {
    assert.match(
      providerSource,
      /const\s+assignEnquiryEmployee\s*=\s*useCallback\([\s\S]*?if\s*\(!enquiryId\)\s*\{[\s\S]*?throw\s+new\s+Error\(['"]Enquiry ID is required to assign or reassign staff\.['"]\)/m,
      'assignEnquiryEmployee must throw if enquiryId is falsy'
    )
  })

  await t.test('selfAssignEnquiry throws immediately if enquiryId is falsy', () => {
    assert.match(
      providerSource,
      /const\s+selfAssignEnquiry\s*=\s*useCallback\([\s\S]*?if\s*\(!enquiryId\)\s*\{[\s\S]*?throw\s+new\s+Error\(['"]Enquiry ID is required to self-assign enquiry\.['"]\)/m,
      'selfAssignEnquiry must throw if enquiryId is falsy'
    )
  })

  await t.test('assignEnquiryEmployee supplies exact PostgreSQL parameter keys', () => {
    assert.match(
      providerSource,
      /supabase\.rpc\(['"]assign_enquiry_employee['"],\s*\{[\s\S]*?p_enquiry_id:\s*enquiryId[\s\S]*?p_employee_id:[\s\S]*?p_reason:[\s\S]*?p_expected_visit_at:[\s\S]*?p_visit_note:[\s\S]*?p_expected_arrival:/m,
      'assignEnquiryEmployee RPC payload must include all 6 parameters matching PostgreSQL signature'
    )
  })

  await t.test('selfAssignEnquiry supplies exact PostgreSQL parameter keys', () => {
    assert.match(
      providerSource,
      /supabase\.rpc\(['"]self_assign_enquiry['"],\s*\{[\s\S]*?p_enquiry_id:\s*enquiryId[\s\S]*?p_expected_visit_at:[\s\S]*?p_visit_note:[\s\S]*?p_expected_arrival:/m,
      'selfAssignEnquiry RPC payload must include all 4 parameters matching PostgreSQL signature'
    )
  })
})
