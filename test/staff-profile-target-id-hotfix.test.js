import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Staff Profile Target ID Hotfix & Security Invariants', async (t) => {
  const projectRoot = process.cwd()

  await t.test('1. AdminStaffPage passes selected staff id to updateStaffProfile', () => {
    const staffPageCode = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'admin', 'AdminStaffPage.jsx'), 'utf8')
    assert.match(staffPageCode, /profileModalTarget\.id/, 'AdminStaffPage must use profileModalTarget.id')
    assert.match(staffPageCode, /updateStaffProfile\(\s*\{[\s\S]*?(staffId|id):\s*profileModalTarget\.id/, 'updateStaffProfile call must receive profileModalTarget.id')
  })

  await t.test('2. AdminStaffPage does NOT contain an editable Staff ID input field', () => {
    const staffPageCode = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'admin', 'AdminStaffPage.jsx'), 'utf8')
    // Ensure no <input id="profile-staff-id" or similar user-editable target UUID field was added
    assert.doesNotMatch(staffPageCode, /id="profile-staff-id"/, 'No user-editable staff id input in modal')
    assert.doesNotMatch(staffPageCode, /name="targetStaffId"/, 'No targetStaffId form field')
  })

  await t.test('3. AdminDataProvider updateStaffProfile accepts id and staffId', () => {
    const providerCode = fs.readFileSync(path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx'), 'utf8')
    assert.match(providerCode, /const targetStaffId\s*=\s*staffId\s*\|\|\s*id/, 'AdminDataProvider must resolve targetStaffId from staffId or id')
  })

  await t.test('4. AdminDataProvider updateStaffProfile still rejects missing target ID', () => {
    const providerCode = fs.readFileSync(path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx'), 'utf8')
    assert.match(providerCode, /if\s*\(!targetStaffId\)\s*\{\s*throw new Error\('Validation error: Target staff ID is required\.'\)/, 'Must reject missing target ID')
  })

  await t.test('5. AdminDataProvider passes exact SQL RPC parameter p_user_id', () => {
    const providerCode = fs.readFileSync(path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx'), 'utf8')
    assert.match(providerCode, /supabase\.rpc\('update_staff_profile',\s*\{[\s\S]*?p_user_id:\s*targetStaffId/, 'Must send p_user_id matching PostgreSQL function signature')
  })

  await t.test('6. SQL RPC update_staff_profile signature in migrations expects p_user_id', () => {
    const mig00002 = fs.readFileSync(path.join(projectRoot, 'supabase', 'migrations', '20261031000002_staff_profile_aadhaar_and_visit_timeline.sql'), 'utf8')
    assert.match(mig00002, /CREATE OR REPLACE FUNCTION public\.update_staff_profile\(\s*p_user_id UUID,/, 'Migration 00002 must define p_user_id UUID')
  })

  await t.test('7. Superadmin and HR check preserved on updateStaffProfile', () => {
    const providerCode = fs.readFileSync(path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx'), 'utf8')
    assert.match(providerCode, /adminUser\?\.role !== 'superadmin' && adminUser\?\.role !== 'hr'/, 'Only superadmin and hr allowed')
  })

  await t.test('8. Demo fallback updates record matching targetStaffId', () => {
    const providerCode = fs.readFileSync(path.join(projectRoot, 'src', 'context', 'AdminDataProvider.jsx'), 'utf8')
    assert.match(providerCode, /if\s*\(s\.id === targetStaffId\)/, 'Demo fallback must match targetStaffId')
  })
})

