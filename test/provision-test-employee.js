/**
 * ARS Computers — Local Test Employee Provisioning Script
 * Strictly targets local Supabase instance (http://127.0.0.1:54321).
 * Uses official Auth Admin API to provision employee.test@arscomputers.in with role 'admin'
 * and ankitbathla.ind@gmail.com with role 'superadmin'.
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY = process.env.LOCAL_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TEST_EMAIL = 'employee.test@arscomputers.in'
const TEST_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'ArsEmpTemp#2026!Oct'
const SUPERADMIN_EMAIL = 'ankitbathla.ind@gmail.com'
const SUPERADMIN_PASSWORD = process.env.TEST_SUPERADMIN_PASSWORD || 'ArsSuperTemp#2026!Oct'

async function run() {
  console.log('1. Connecting to local Supabase Admin API at:', LOCAL_SUPABASE_URL)
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Check if users exist in auth.users
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) {
    console.error('Failed to query local auth users:', listError.message)
    process.exit(1)
  }

  // 1. Employee
  let testUser = usersData.users.find((u) => u.email === TEST_EMAIL)
  if (!testUser) {
    console.log('2. Creating test user via auth.admin.createUser()...')
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Local Test Admin Employee' }
    })
    if (createError) {
      console.error('Failed to create auth user:', createError.message)
      process.exit(1)
    }
    testUser = createData.user
    console.log('   ✓ Auth user created successfully. User ID:', testUser.id)
  } else {
    console.log('2. Test auth user already exists. User ID:', testUser.id)
    await adminClient.auth.admin.updateUserById(testUser.id, {
      password: TEST_PASSWORD,
      email_confirm: true
    })
  }

  await adminClient.from('admin_users').upsert({
    id: testUser.id,
    email: TEST_EMAIL,
    role: 'admin',
    full_name: 'Local Test Admin Employee',
    employee_code: 'ARS-EMP-001',
    is_active: true
  })

  // 2. Superadmin
  let superUser = usersData.users.find((u) => u.email === SUPERADMIN_EMAIL)
  if (!superUser) {
    console.log('3. Creating superadmin via auth.admin.createUser()...')
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Ankit Bathla' }
    })
    if (createError) {
      console.error('Failed to create superadmin:', createError.message)
      process.exit(1)
    }
    superUser = createData.user
  } else {
    await adminClient.auth.admin.updateUserById(superUser.id, {
      password: SUPERADMIN_PASSWORD,
      email_confirm: true
    })
  }

  await adminClient.from('admin_users').upsert({
    id: superUser.id,
    email: SUPERADMIN_EMAIL,
    role: 'superadmin',
    full_name: 'Ankit Bathla',
    employee_code: 'ARS-HEAD-001',
    is_active: true
  })

  // Test sign in via anon client (simulating exact browser login)
  console.log('4. Verifying login via standard client (anon key)...')
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY)
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  })

  if (loginError) {
    console.error('Login verification failed:', loginError.message)
    process.exit(1)
  }

  console.log('   ✓ Login succeeded! Session token generated.')
  console.log('   ✓ Authenticated UID:', loginData.user.id)
  console.log('   ✓ Authenticated Email:', loginData.user.email)

  // Verify that the user can query their own admin_users profile
  const { data: verifiedProfile, error: profileError } = await client
    .from('admin_users')
    .select('id, email, role, is_active')
    .eq('id', loginData.user.id)
    .single()

  if (profileError) {
    console.error('Failed to fetch admin profile under authenticated session:', profileError.message)
    process.exit(1)
  }

  console.log('   ✓ Profile verified under authenticated session:', verifiedProfile)
  console.log('\n[SUCCESS] Local test employee and superadmin accounts are ready for browser & API verification.')
}

run().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
