import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * ============================================================================
 * ARS Computers — Enquiry Creation with Optional Email Test Suite
 * ============================================================================
 * Validates that email is optional across:
 * 1. Admin CreateEnquiryModal.jsx
 * 2. Website CustomerHomePage.jsx contact form
 * 3. Website CustomerServiceRequestForm.jsx service form
 * 4. AdminDataProvider.jsx contact normalization
 * 5. Migration 20261123000027_make_enquiry_email_optional.sql logic & security
 * ============================================================================
 */

test('Enquiry Creation with Optional Email Suite', async (t) => {
  const root = process.cwd()

  const modalSrc = fs.readFileSync(path.join(root, 'src/components/admin/CreateEnquiryModal.jsx'), 'utf8')
  const homeSrc = fs.readFileSync(path.join(root, 'src/pages/CustomerHomePage.jsx'), 'utf8')
  const serviceSrc = fs.readFileSync(path.join(root, 'src/components/CustomerServiceRequestForm.jsx'), 'utf8')
  const providerSrc = fs.readFileSync(path.join(root, 'src/context/AdminDataProvider.jsx'), 'utf8')
  const migrationSrc = fs.readFileSync(path.join(root, 'supabase/migrations/20261123000027_make_enquiry_email_optional.sql'), 'utf8')

  await t.test('1. Admin CreateEnquiryModal renders email as optional without red asterisk', () => {
    // Label should not contain required star
    assert.ok(
      !modalSrc.includes("Email Address <span style={{ color: '#ef4444' }}>*</span>"),
      'CreateEnquiryModal must not display red asterisk for Email Address'
    )
    assert.ok(
      modalSrc.includes('Email Address <span style={{ fontSize: \'0.78rem\', color: \'#64748b\', fontWeight: 400 }}>(Optional)</span>'),
      'CreateEnquiryModal must display (Optional) tag for Email Address'
    )

    // Input should not be HTML required
    const emailInputMatch = modalSrc.match(/<input[^>]*id="enq-cust-email"[^>]*>/s)
    assert.ok(emailInputMatch, 'email input must exist')
    assert.ok(!emailInputMatch[0].includes('required'), 'email input must not have required attribute')

    // Validation permits cleanEmail to be empty
    assert.ok(
      modalSrc.includes('if (cleanEmail && !emailPattern.test(cleanEmail))'),
      'CreateEnquiryModal must only validate email pattern if email is non-empty'
    )

    // contactInfo formats cleanly without trailing pipe
    assert.ok(
      modalSrc.includes("cleanEmail ? `${normPhone} | ${cleanEmail}` : normPhone"),
      'CreateEnquiryModal must format contactInfo as normPhone when email is absent'
    )
  })

  await t.test('2. CustomerHomePage contact form renders email as optional', () => {
    // Label should not contain *
    assert.ok(
      !homeSrc.includes('<label htmlFor="email">Email Address *</label>'),
      'CustomerHomePage must not have asterisk in Email Address label'
    )
    assert.ok(
      homeSrc.includes('(Optional)'),
      'CustomerHomePage must mark email as Optional'
    )

    // Input must not have required
    const emailInputMatch = homeSrc.match(/<input[^>]*id="email"[^>]*>/s)
    assert.ok(emailInputMatch, 'email input must exist')
    assert.ok(!emailInputMatch[0].includes('required'), 'email input must not have required attribute')

    // Submit handler validates email only when provided
    assert.ok(
      homeSrc.includes('if (email && !emailPattern.test(email))'),
      'CustomerHomePage must only validate email when non-empty'
    )

    // Requires at least one contact channel
    assert.ok(
      homeSrc.includes('if (!contactInfo && !email)'),
      'CustomerHomePage must check that at least one of phone or email is provided'
    )

    // Formats p_contact_info properly
    assert.ok(
      homeSrc.includes('contactInfo && email ? `${contactInfo} | ${email}` : (contactInfo || email)'),
      'CustomerHomePage must set p_contact_info to contactInfo || email without trailing pipes'
    )
  })

  await t.test('3. CustomerServiceRequestForm renders email as optional', () => {
    assert.ok(
      !serviceSrc.includes('Email Address <span className="required-star">*</span>'),
      'CustomerServiceRequestForm must not have required-star on Email Address'
    )

    const emailInputMatch = serviceSrc.match(/<input[^>]*id="sr-email"[^>]*>/s)
    assert.ok(emailInputMatch, 'sr-email input must exist')
    assert.ok(!emailInputMatch[0].includes('required'), 'sr-email input must not have required attribute')

    assert.ok(
      serviceSrc.includes('if (cleanEmail && !emailPattern.test(cleanEmail))'),
      'CustomerServiceRequestForm must only validate email pattern when cleanEmail is present'
    )

    assert.ok(
      serviceSrc.includes('cleanEmail ? `${cleanMobile} | ${cleanEmail}` : cleanMobile'),
      'CustomerServiceRequestForm must format contactInfo as cleanMobile when cleanEmail is absent'
    )
  })

  await t.test('4. AdminDataProvider strips trailing pipe and handles phone-only contact info', () => {
    assert.ok(
      providerSrc.includes('.replace(/\\|\\s*$/, \'\').trim()'),
      'AdminDataProvider must strip trailing pipe from contact info'
    )
  })

  await t.test('5. Migration 20261123000027_make_enquiry_email_optional.sql logic & grants', () => {
    // Function definition
    assert.ok(
      migrationSrc.includes('CREATE OR REPLACE FUNCTION public.create_customer_enquiry('),
      'Migration must define create_customer_enquiry'
    )

    // Security Definer & empty search path
    assert.ok(migrationSrc.includes('SECURITY DEFINER'), 'create_customer_enquiry must be SECURITY DEFINER')
    assert.ok(migrationSrc.includes("SET search_path = ''"), 'create_customer_enquiry must set search_path to empty')

    // Accepts phone without requiring email
    assert.ok(
      migrationSrc.includes('IF v_phone IS NULL AND v_email IS NULL THEN'),
      'Migration must require that at least one of v_phone or v_email is present'
    )
    assert.ok(
      !migrationSrc.includes('IF v_email IS NULL THEN\n    RAISE EXCEPTION'),
      'Migration must not reject when v_email is null'
    )

    // Proper fallback in INSERT statement
    assert.ok(
      migrationSrc.includes('WHEN v_phone IS NOT NULL AND v_email IS NOT NULL THEN v_phone || \' | \' || v_email'),
      'Migration must combine both when present'
    )
    assert.ok(
      migrationSrc.includes('WHEN v_phone IS NOT NULL THEN v_phone'),
      'Migration must save phone when email is null'
    )

    // Grants
    assert.ok(migrationSrc.includes('REVOKE EXECUTE ON FUNCTION public.create_customer_enquiry(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;'))
    assert.ok(migrationSrc.includes('GRANT EXECUTE ON FUNCTION public.create_customer_enquiry(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;'))
  })
})
