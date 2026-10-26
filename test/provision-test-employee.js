/**
 * ARS Computers — Local Test Employee Provisioning Script
 * Strictly targets local Supabase instance (http://127.0.0.1:54321).
 * Uses official Auth Admin API to provision employee.test@arscomputers.in with role 'admin'.
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY = process.env.LOCAL_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TEST_EMAIL = 'employee.test@arscomputers.in'
const TEST_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || 'TestEmployee@123'

async function run() {
  console.log('1. Connecting to local Supabase Admin API at:', LOCAL_SUPABASE_URL)
  const adminClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Check if test user exists in auth.users
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) {
    console.error('Failed to query local auth users:', listError.message)
    process.exit(1)
  }

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
    // Ensure password and confirmation are up to date
    await adminClient.auth.admin.updateUserById(testUser.id, {
      password: TEST_PASSWORD,
      email_confirm: true
    })
  }

  // Ensure public.admin_users has matching record
  console.log('3. Registering/verifying profile in public.admin_users...')
  const { data: existingProfile, error: queryError } = await adminClient
    .from('admin_users')
    .select('id, email, role, is_active')
    .eq('id', testUser.id)
    .maybeSingle()

  if (queryError) {
    console.error('Failed to query public.admin_users:', queryError.message)
    process.exit(1)
  }

  if (!existingProfile) {
    const { error: insertError } = await adminClient.from('admin_users').insert({
      id: testUser.id,
      email: TEST_EMAIL,
      full_name: 'Local Test Admin Employee',
      role: 'admin',
      is_active: true
    })

    if (insertError) {
      console.error('Failed to insert into public.admin_users:', insertError.message)
      process.exit(1)
    }
    console.log('   ✓ Profile created in public.admin_users with role: admin, is_active: true')
  } else {
    const { error: updateError } = await adminClient
      .from('admin_users')
      .update({ role: 'admin', is_active: true, full_name: 'Local Test Admin Employee' })
      .eq('id', testUser.id)

    if (updateError) {
      console.error('Failed to update public.admin_users:', updateError.message)
      process.exit(1)
    }
    console.log('   ✓ Profile in public.admin_users updated: role=admin, is_active=true')
  }

  // Test sign in via anon client (simulating exact browser login)
  console.log('4. Verifying login via standard client (anon key)...')
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY)
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  })

  if (loginError) {
    console.error('Login simulation failed:', loginError.message)
    process.exit(1)
  }

  console.log('   ✓ Login succeeded! Session token generated.')
  console.log('   ✓ Authenticated UID:', loginData.user.id)
  console.log('   ✓ Authenticated Email:', loginData.user.email)

  // Verify profile read under authenticated user
  const { data: profileCheck, error: profileError } = await client
    .from('admin_users')
    .select('id, email, role, is_active')
    .eq('id', loginData.user.id)
    .single()

  if (profileError) {
    console.error('Profile read failed under authenticated user:', profileError.message)
    process.exit(1)
  }

  console.log('   ✓ Profile verified under authenticated session:', profileCheck)
  console.log('\n[SUCCESS] Local test employee account is ready for browser & API verification.')
}

run().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
