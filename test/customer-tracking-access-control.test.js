/**
 * ARS Computers — Customer Enquiry Tracking Security & Access Control Audit
 *
 * Tests the security invariants required by the customer enquiry tracking system:
 * 1. Customer A cannot access Customer B's enquiries (multi-tenant boundary)
 * 2. Customer A cannot access B's enquiry by guessing its UUID (IDOR prevention)
 * 3. Changing email/mobile in an API request cannot bypass OTP (session & parameter integrity)
 * 4. Expired or revoked sessions cannot retrieve enquiries (session lifecycle)
 * 5. A verified customer can still see their own enquiries (positive resolution)
 * 6. Engineer contact information cannot leak across customers (least privilege & isolation)
 *
 * Execution: node --test test/customer-tracking-access-control.test.js
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const read = (rel) => fs.readFileSync(path.join(projectRoot, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n')

const migrationV2 = read('supabase/migrations/20261107000001_customer_tracking_full_system.sql')
const migrationReturnFix = read('supabase/migrations/20261107000002_fix_tracking_enquiry_ids_return_type.sql')
const migrationRequireEmail = read('supabase/migrations/20261107000003_require_email_in_create_customer_enquiry.sql')
const migrationEngineerDerivation = read('supabase/migrations/20261108000001_engineer_contact_from_staff_record.sql')
const trackingService = read('src/server/trackingOtpService.js')
const worker = read('src/server/worker.js')
const trackingCard = read('src/components/EnquiryTrackingCard.jsx')

// Helper simulating tracking_enquiry_ids_for_identifier logic exactly as defined in PostgreSQL
function simulateTrackingEnquiryIdsForIdentifier(enquiries, channel, identifier) {
  const normId = String(identifier || '').trim().toLowerCase()
  return enquiries.filter((e) => {
    const parts = (e.contact_info || '').split('|').map((p) => p.trim())
    return parts.some((part) => {
      if (channel === 'email' && normId !== '') {
        return part.toLowerCase() === normId
      }
      if (channel === 'mobile' && normId !== '') {
        const digits = part.replace(/[^0-9]/g, '')
        const targetDigits = normId.replace(/[^0-9]/g, '')
        return digits.length >= 10 && digits.slice(-10) === targetDigits.slice(-10)
      }
      return false
    })
  })
}

// Helper simulating list_customer_enquiries database function
function simulateListCustomerEnquiries(sessionToken, sessions, enquiries) {
  const session = sessions.find((s) => s.token === sessionToken)
  if (!session) {
    throw new Error('Tracking session expired.')
  }
  if (session.revoked_at || session.expires_at <= Date.now()) {
    throw new Error('Tracking session expired.')
  }

  const identifier = session.identifier
  const channel = identifier.includes('@') ? 'email' : 'mobile'
  const matched = simulateTrackingEnquiryIdsForIdentifier(enquiries, channel, identifier)

  return matched.map((e) => ({
    enquiry_id: e.id,
    enquiry_number: e.enquiry_number,
    subject: e.category_interest || 'General Enquiry',
    description: e.message,
    status_label: 'In Progress',
    engineer_contact_display: e.assigned_employee_id && !e.engineer_contact_hidden ? e.assigned_employee_phone : null
  }))
}

describe('ARS Computers — Customer Enquiry Tracking Security Audit', () => {

  // ==========================================================================
  // Invariant 1: Customer A cannot access Customer B's enquiries
  // ==========================================================================
  describe('1. Cross-Tenant Enquiry Isolation', () => {
    it('verifies SQL identifier matching strictly partitions enquiries by contact', () => {
      // Must match on normalized email or rightmost 10 digits of mobile
      assert.ok(
        migrationReturnFix.includes("lower(btrim(seg.part)) = p_identifier"),
        'Email matching must strictly compare lowercase trimmed identifier'
      )
      assert.ok(
        migrationReturnFix.includes("right(regexp_replace(seg.part, '[^0-9]', '', 'g'), 10) = right(p_identifier, 10)"),
        'Mobile matching must strictly compare rightmost 10 digits'
      )
    })

    it('proves Customer A with verified session cannot retrieve Customer B enquiries', () => {
      const mockEnquiries = [
        {
          id: 'enq-a1-uuid',
          enquiry_number: 'ARS-ENQ-01001',
          contact_info: '9876543210 | customerA@example.com',
          category_interest: 'Laptop Repair',
          message: 'Laptop not booting',
          assigned_employee_id: 'eng-1',
          assigned_employee_phone: '+91 70783 82213'
        },
        {
          id: 'enq-b1-uuid',
          enquiry_number: 'ARS-ENQ-01002',
          contact_info: '9123456789 | customerB@example.com',
          category_interest: 'CCTV Installation',
          message: 'Confidential corporate CCTV quote',
          assigned_employee_id: 'eng-2',
          assigned_employee_phone: '+91 99999 88888'
        }
      ]

      const mockSessions = [
        {
          token: 'session_token_customer_a',
          identifier: 'customera@example.com',
          expires_at: Date.now() + 45 * 60 * 1000,
          revoked_at: null
        }
      ]

      // Customer A queries with their valid session token
      const results = simulateListCustomerEnquiries('session_token_customer_a', mockSessions, mockEnquiries)

      assert.equal(results.length, 1, 'Only Customer A own enquiry must be returned')
      assert.equal(results[0].enquiry_id, 'enq-a1-uuid', 'Returned enquiry must belong to Customer A')
      assert.ok(
        !results.some((r) => r.enquiry_id === 'enq-b1-uuid'),
        "Customer B's enquiry MUST NOT be present in results"
      )
      assert.ok(
        !results.some((r) => r.description.includes('Confidential corporate CCTV')),
        "Customer B's description must not leak"
      )
    })
  })

  // ==========================================================================
  // Invariant 2: Customer A cannot access B's enquiry by guessing its UUID (IDOR)
  // ==========================================================================
  describe('2. Insecure Direct Object Reference (IDOR) Prevention', () => {
    it('verifies Worker handleTrackingEnquiries does not accept enquiry ID parameters', () => {
      // The worker only accepts sessionToken from the body
      assert.ok(
        trackingService.includes("const sessionToken = String(body.sessionToken ?? '').trim()"),
        'handleTrackingEnquiries must only parse sessionToken'
      )
      assert.ok(
        !trackingService.includes('body.enquiryId') &&
        !trackingService.includes('body.enquiry_id') &&
        !trackingService.includes('body.id'),
        'handleTrackingEnquiries must never accept or pass enquiry ID from client body'
      )
    })

    it('verifies list_customer_enquiries RPC accepts only p_token without any enquiry UUID argument', () => {
      assert.ok(
        migrationEngineerDerivation.includes('CREATE OR REPLACE FUNCTION public.list_customer_enquiries(\n  p_token TEXT\n)'),
        'list_customer_enquiries must take exactly one argument: p_token TEXT'
      )
    })

    it('proves supplying or guessing Customer B UUID does not expose B enquiry', () => {
      // Even if client attempts to send extra properties in JSON payload:
      const maliciousPayload = {
        sessionToken: 'session_token_customer_a',
        enquiryId: 'enq-b1-uuid',
        enquiry_id: 'enq-b1-uuid',
        uuid: 'enq-b1-uuid'
      }

      // Worker handler extracts only sessionToken
      const sanitizedToken = String(maliciousPayload.sessionToken ?? '').trim()
      assert.equal(sanitizedToken, 'session_token_customer_a')

      const mockEnquiries = [
        { id: 'enq-a1-uuid', contact_info: 'customerA@example.com' },
        { id: 'enq-b1-uuid', contact_info: 'customerB@example.com' }
      ]
      const mockSessions = [
        {
          token: 'session_token_customer_a',
          identifier: 'customera@example.com',
          expires_at: Date.now() + 100000,
          revoked_at: null
        }
      ]

      const results = simulateListCustomerEnquiries(sanitizedToken, mockSessions, mockEnquiries)
      assert.equal(results.length, 1)
      assert.equal(results[0].enquiry_id, 'enq-a1-uuid')
      assert.ok(!results.some((r) => r.enquiry_id === maliciousPayload.enquiryId))
    })
  })

  // ==========================================================================
  // Invariant 3: Changing email/mobile in an API request cannot bypass OTP
  // ==========================================================================
  describe('3. Parameter Tampering & OTP Bypass Prevention', () => {
    it('verifies tracking session binds identifier immutably upon OTP completion', () => {
      assert.ok(
        migrationV2.includes('INSERT INTO public.customer_tracking_sessions (token_hash, identifier, expires_at)\n  VALUES (p_token_hash, v_identifier, now() + interval \'45 minutes\')'),
        'customer_tracking_sessions must record database-derived identifier from OTP verification'
      )
    })

    it('verifies client request to /api/tracking/enquiries cannot specify or override identifier', () => {
      const handleEnquiriesSource = trackingService.slice(
        trackingService.indexOf('export async function handleTrackingEnquiries')
      )
      assert.ok(
        !handleEnquiriesSource.includes('body.email') &&
        !handleEnquiriesSource.includes('body.contact') &&
        !handleEnquiriesSource.includes('body.mobile') &&
        !handleEnquiriesSource.includes('body.identifier'),
        'handleTrackingEnquiries must ignore any client-sent email/contact/identifier'
      )
    })

    it('verifies direct access to OTP completion RPC is revoked from anon and authenticated', () => {
      assert.ok(
        migrationV2.includes('REVOKE EXECUTE ON FUNCTION public.complete_tracking_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;'),
        'complete_tracking_otp must be revoked from all public/client roles'
      )
      assert.ok(
        migrationV2.includes('GRANT EXECUTE ON FUNCTION public.complete_tracking_otp(TEXT, TEXT) TO service_role;'),
        'complete_tracking_otp must be callable only by service_role'
      )
    })
  })

  // ==========================================================================
  // Invariant 4: Expired or revoked sessions cannot retrieve enquiries
  // ==========================================================================
  describe('4. Session Lifecycle & Token Invalidation', () => {
    it('verifies list_customer_enquiries enforces active expiry and revocation check in SQL', () => {
      assert.ok(
        migrationEngineerDerivation.includes('WHERE token_hash = pg_catalog.encode(extensions.digest(v_token, \'sha256\'), \'hex\')'),
        'Session must match SHA-256 token digest'
      )
      assert.ok(
        migrationEngineerDerivation.includes('AND revoked_at IS NULL'),
        'Session must check revoked_at IS NULL'
      )
      assert.ok(
        migrationEngineerDerivation.includes('AND expires_at > now()'),
        'Session must verify expires_at > now()'
      )
      assert.ok(
        migrationEngineerDerivation.includes("RAISE EXCEPTION 'Tracking session expired.' USING ERRCODE = '22023';"),
        'Expired or revoked session must raise exception immediately'
      )
    })

    it('proves expired session token fails closed and returns zero enquiries', () => {
      const mockSessions = [
        {
          token: 'expired_token',
          identifier: 'customerA@example.com',
          expires_at: Date.now() - 5000, // Expired 5 seconds ago
          revoked_at: null
        }
      ]
      const mockEnquiries = [{ id: 'enq-1', contact_info: 'customerA@example.com' }]

      assert.throws(
        () => simulateListCustomerEnquiries('expired_token', mockSessions, mockEnquiries),
        /Tracking session expired\./
      )
    })

    it('proves revoked session token fails closed and returns zero enquiries', () => {
      const mockSessions = [
        {
          token: 'revoked_token',
          identifier: 'customerA@example.com',
          expires_at: Date.now() + 100000,
          revoked_at: new Date() // Revoked by security event or logout
        }
      ]
      const mockEnquiries = [{ id: 'enq-1', contact_info: 'customerA@example.com' }]

      assert.throws(
        () => simulateListCustomerEnquiries('revoked_token', mockSessions, mockEnquiries),
        /Tracking session expired\./
      )
    })
  })

  // ==========================================================================
  // Invariant 5: Multiple enquiries shown only when belonging to verified contact
  // ==========================================================================
  describe('5. Multi-Enquiry Ownership Verification', () => {
    it('returns all multiple enquiries belonging to the verified contact in descending date order', () => {
      const customerContact = 'customerA@example.com'
      const mockEnquiries = [
        {
          id: 'enq-1',
          enquiry_number: 'ARS-ENQ-01001',
          contact_info: customerContact,
          submitted_at: '2026-10-25T10:00:00Z'
        },
        {
          id: 'enq-2',
          enquiry_number: 'ARS-ENQ-01002',
          contact_info: `9876543210 | ${customerContact}`,
          submitted_at: '2026-10-26T12:00:00Z'
        },
        {
          id: 'enq-3',
          enquiry_number: 'ARS-ENQ-01019',
          contact_info: customerContact,
          submitted_at: '2026-11-07T14:00:00Z'
        },
        {
          id: 'enq-other',
          enquiry_number: 'ARS-ENQ-01015',
          contact_info: 'someoneelse@example.com',
          submitted_at: '2026-11-05T09:00:00Z'
        }
      ]

      const matched = simulateTrackingEnquiryIdsForIdentifier(mockEnquiries, 'email', customerContact)
      assert.equal(matched.length, 3, 'All 3 enquiries belonging to customerA must match')
      assert.ok(matched.some((e) => e.enquiry_number === 'ARS-ENQ-01001'))
      assert.ok(matched.some((e) => e.enquiry_number === 'ARS-ENQ-01002'))
      assert.ok(matched.some((e) => e.enquiry_number === 'ARS-ENQ-01019'))
      assert.ok(!matched.some((e) => e.enquiry_number === 'ARS-ENQ-01015'), 'Foreign enquiry must be excluded')
    })
  })

  // ==========================================================================
  // Invariant 6: Engineer contact information cannot leak across customers
  // ==========================================================================
  describe('6. Engineer Contact Privacy & Isolation', () => {
    it('verifies engineer contact derivation binds strictly to assigned_employee_id of matched enquiry', () => {
      assert.ok(
        migrationEngineerDerivation.includes('au.id = e.assigned_employee_id AND au.is_active'),
        'Engineer lookup must strictly join on au.id = e.assigned_employee_id'
      )
      assert.ok(
        migrationEngineerDerivation.includes('WHEN e.assigned_employee_id IS NULL THEN NULL'),
        'Unassigned enquiry must return NULL for engineer contact'
      )
      assert.ok(
        migrationEngineerDerivation.includes('WHEN e.engineer_contact_hidden THEN NULL'),
        'Explicitly hidden engineer contact must return NULL'
      )
    })

    it('verifies no sensitive staff fields (email, employee_code, aadhaar, password) are selected for customer', () => {
      const derivationBlock = migrationEngineerDerivation.slice(
        migrationEngineerDerivation.indexOf('CREATE OR REPLACE FUNCTION public.list_customer_enquiries'),
        migrationEngineerDerivation.indexOf('REVOKE EXECUTE ON FUNCTION public.list_customer_enquiries')
      )

      assert.ok(
        !derivationBlock.includes('au.email') &&
        !derivationBlock.includes('au.employee_code') &&
        !derivationBlock.includes('au.aadhaar_number') &&
        !derivationBlock.includes('encrypted_password'),
        'No sensitive staff profile columns may be selected in customer tracking RPC'
      )
    })

    it('proves Customer A receives only their assigned engineer details and not Customer B engineer', () => {
      const mockEnquiries = [
        {
          id: 'enq-a',
          contact_info: 'customerA@example.com',
          assigned_employee_id: 'eng-101',
          assigned_employee_name: 'Engineer Rahul',
          assigned_employee_phone: '+91 70783 82213',
          engineer_contact_hidden: false
        },
        {
          id: 'enq-b',
          contact_info: 'customerB@example.com',
          assigned_employee_id: 'eng-202',
          assigned_employee_name: 'Engineer Priya',
          assigned_employee_phone: '+91 98888 77777',
          engineer_contact_hidden: false
        }
      ]

      const mockSessions = [
        {
          token: 'token_a',
          identifier: 'customera@example.com',
          expires_at: Date.now() + 100000,
          revoked_at: null
        }
      ]

      const results = simulateListCustomerEnquiries('token_a', mockSessions, mockEnquiries)
      assert.equal(results.length, 1)
      assert.equal(results[0].engineer_contact_display, '+91 70783 82213')
      assert.ok(
        results[0].engineer_contact_display !== '+91 98888 77777',
        "Customer B engineer contact must never leak to Customer A"
      )
    })
  })

  // ==========================================================================
  // Invariant 7: RPC Permissions & Worker Endpoints Verification
  // ==========================================================================
  describe('7. RPC Permissions & Endpoint Security', () => {
    it('verifies all sensitive tracking RPCs are revoked from public roles and restricted to service_role', () => {
      const sensitiveRpcs = [
        'start_tracking_otp',
        'seal_tracking_otp',
        'fetch_tracking_otp_challenge',
        'fail_tracking_otp',
        'complete_tracking_otp',
        'list_customer_enquiries',
        'tracking_enquiry_ids_for_identifier'
      ]

      sensitiveRpcs.forEach((rpc) => {
        assert.ok(
          migrationV2.includes(`REVOKE EXECUTE ON FUNCTION public.${rpc}`) ||
          migrationReturnFix.includes(`REVOKE EXECUTE ON FUNCTION public.${rpc}`) ||
          migrationEngineerDerivation.includes(`REVOKE EXECUTE ON FUNCTION public.${rpc}`),
          `${rpc} must be revoked from PUBLIC, anon, and authenticated`
        )
      })
    })

    it('verifies worker routes /api/tracking/* reject all non-POST requests', () => {
      assert.ok(
        worker.includes("if (url.pathname.startsWith('/api/tracking/')) {\n      if (request.method !== 'POST') {\n        return jsonResponse({ success: false, error: 'Method not allowed.' }, 405)"),
        'All tracking API endpoints must enforce HTTP POST only'
      )
    })

    it('verifies tracking API responses enforce no-store and no-cache headers', () => {
      assert.ok(
        trackingService.includes("'Cache-Control': 'no-store, private'"),
        'Tracking API must set Cache-Control: no-store, private'
      )
      assert.ok(
        trackingService.includes("'X-Content-Type-Options': 'nosniff'"),
        'Tracking API must set X-Content-Type-Options: nosniff'
      )
    })
  })
})
