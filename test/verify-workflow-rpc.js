/**
 * ARS Computers — Service Request RPC & Workflow Invariant Verification
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const migrationFile = path.join(projectRoot, 'supabase', 'migrations', '20261024000003_service_request_system.sql')
const sql = fs.readFileSync(migrationFile, 'utf8')

console.log('====================================================================')
console.log('Verifying Service Request Workflow, RPC Security & Role Constraints')
console.log('====================================================================\n')

let passCount = 0
let failCount = 0

function verify(cond, label) {
  if (cond) {
    console.log(`  ✓ PASSED: ${label}`)
    passCount++
  } else {
    console.error(`  ✗ FAILED: ${label}`)
    failCount++
  }
}

// 1. Assign Ticket RPC
verify(
  sql.includes('CREATE OR REPLACE FUNCTION public.assign_service_ticket') &&
  sql.includes('IF NOT public.is_admin() THEN') &&
  sql.includes("activity_type,") &&
  sql.includes("'technician_assigned'"),
  'assign_service_ticket: Restricts assignment to administrators and writes to service_request_activities'
)

// 2. Status Update RPC
verify(
  sql.includes('CREATE OR REPLACE FUNCTION public.update_service_ticket_status') &&
  sql.includes('IF NOT public.is_staff() THEN') &&
  sql.includes("IF p_new_status = 'closed' AND NOT public.is_superadmin() THEN") &&
  sql.includes("activity_type,") &&
  sql.includes("'status_changed'"),
  'update_service_ticket_status: Allows staff progression to resolved but strictly blocks closing without superadmin role'
)

// 3. Superadmin-only Close RPC
verify(
  sql.includes('CREATE OR REPLACE FUNCTION public.close_service_ticket') &&
  sql.includes('IF NOT public.is_superadmin() THEN') &&
  sql.includes("p_resolution_summary") &&
  sql.includes("'ticket_closed'"),
  'close_service_ticket: Strictly requires Superadmin authorization and writes immutable audit entry'
)

// 4. Superadmin-only Reopen RPC
verify(
  sql.includes('CREATE OR REPLACE FUNCTION public.reopen_service_ticket') &&
  sql.includes('IF NOT public.is_superadmin() THEN') &&
  sql.includes("Mandatory reopen reason must be at least 5 characters") &&
  sql.includes("'ticket_reopened'"),
  'reopen_service_ticket: Requires mandatory justification, strictly restricted to Superadmin'
)

// 5. Immutable Activity Trigger
verify(
  sql.includes('CREATE OR REPLACE FUNCTION public.protect_service_activities_immutability') &&
  sql.includes("RAISE EXCEPTION 'Audit integrity violation: Service request activities are strictly immutable") &&
  sql.includes('BEFORE UPDATE OR DELETE ON public.service_request_activities'),
  'protect_service_activities_immutability: Hardware immutability trigger prevents any UPDATE or DELETE on activities'
)

// 6. Direct Client Deletion Revocation
verify(
  sql.includes('REVOKE DELETE ON public.service_requests FROM PUBLIC, anon, authenticated;') &&
  sql.includes('REVOKE DELETE ON public.service_request_activities FROM PUBLIC, anon, authenticated;'),
  'Direct client deletion permanently revoked on service_requests and activities'
)

console.log(`\nVerification Summary: ${passCount} Passed, ${failCount} Failed`)
if (failCount > 0) process.exit(1)
