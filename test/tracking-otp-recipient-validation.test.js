/**
 * ARS Computers — Tracking OTP Recipient Validation & Error Handling Test Suite
 *
 * Verifies the requirements:
 * 1. Explicit recipient-related HTTP 422 -> handled safely, logs sanitized warning category/status, returns generic HTTP 200 (anti-enumeration).
 * 2. Unrelated HTTP 422 (e.g. sender validation, payload constraints) -> surfaces generic HTTP 503 and logs error.
 * 3. Recipient-related HTTP 400 (e.g. invalid recipient address format) -> handled safely as recipient rejection, returns generic HTTP 200.
 * 4. Unrelated HTTP 400 (e.g. malformed JSON, missing body fields) -> surfaces generic HTTP 503 and logs error.
 * 5. Successful OTP delivery -> returns generic HTTP 200, sends email with proper idempotency key.
 * 6. Provider HTTP 5xx outage -> caught as error, surfaces generic HTTP 503.
 * 7. Provider authentication failure (HTTP 401/403) -> caught as error, surfaces generic HTTP 503.
 * 8. Unmatched enquiry (delivered: false) -> returns generic HTTP 200 without attempting email send.
 * 9. Rate limiting (database 429) -> surfaces generic HTTP 429 without sending email.
 * 10. Sanitized logging -> logs sanitized category and HTTP status only, zero raw provider details, no OTP, no unmasked emails.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  handleTrackingOtpRequest
} from '../src/server/trackingOtpService.js'
import {
  NotificationRecipientRejectedError,
  sendNotificationEmail,
  getNotificationConfig
} from '../src/server/notificationService.js'

const MOCK_HMAC_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const BASE_ENV = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  RESEND_API_KEY: 're_test_key_valid',
  EMAIL_FROM: 'ARS Computers <notifications@arscomputer.com>',
  APP_BASE_URL: 'https://arscomputer.com',
  TRACKING_OTP_HMAC_SECRET: MOCK_HMAC_SECRET
}

function createRequest(body, ip = '1.2.3.4') {
  return new Request('https://arscomputer.com/api/tracking/otp/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip
    },
    body: JSON.stringify(body)
  })
}

describe('Tracking OTP Email Recipient Validation & Resend Integration', () => {
  describe('NotificationRecipientRejectedError classification in sendNotificationEmail', () => {
    test('Explicit recipient-related HTTP 422: throws NotificationRecipientRejectedError', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 422,
            message: "Invalid `to` field customer@example.com. Please use our testing email address instead of domains like `example.com`."
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@example.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-1'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(err instanceof NotificationRecipientRejectedError)
          assert.equal(err.statusCode, 422)
          assert.equal(err.provider, 'resend')
          assert.match(err.message, /HTTP 422/)
          assert.match(err.message, /c\*\*\*r@example\.com/)
          return true
        }
      )
    })

    test('Unrelated HTTP 422 (e.g. sender verification failure): throws standard Error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 422,
            message: "The `from` email address is not verified for this domain."
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@example.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-from-err'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError), 'Should NOT be classified as recipient error')
          assert.match(err.message, /HTTP 422/)
          assert.match(err.message, /`from` email address is not verified/)
          return true
        }
      )
    })

    test('Recipient-related HTTP 400 (e.g. invalid recipient address): throws NotificationRecipientRejectedError', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 400,
            message: "Invalid recipient email address format provided."
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'bad-email@example.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-bad-email'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(err instanceof NotificationRecipientRejectedError)
          assert.equal(err.statusCode, 400)
          assert.match(err.message, /HTTP 400/)
          return true
        }
      )
    })

    test('Unrelated HTTP 400 (e.g. malformed JSON payload): throws standard Error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 400,
            message: "Malformed request payload: syntax error."
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-malformed'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError))
          assert.match(err.message, /HTTP 400/)
          assert.match(err.message, /Malformed request payload/)
          return true
        }
      )
    })

    test('Negative test: HTTP 400 with "Failed to parse request" (standalone "to"): throws standard Error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 400,
            message: "Failed to parse request."
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-parse-err'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError), 'Must NOT classify "Failed to parse request" as recipient error')
          assert.match(err.message, /HTTP 400/)
          return true
        }
      )
    })

    test('Negative test: HTTP 422 with "Unable to validate payload" (standalone "to"): throws standard Error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 422,
            message: "Unable to validate payload against schema."
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-validate-err'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError), 'Must NOT classify "Unable to validate payload" as recipient error')
          assert.match(err.message, /HTTP 422/)
          return true
        }
      )
    })

    test('Negative test: HTTP 422 with "Invalid subject or HTML content": throws standard Error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            statusCode: 422,
            message: "Invalid subject or HTML content."
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-content-err'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError), 'Must NOT classify content error as recipient error')
          assert.match(err.message, /HTTP 422/)
          return true
        }
      )
    })

    test('sendNotificationEmail throws standard Error on Resend HTTP 500 server error', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({ message: 'Internal server error at provider' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-2'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError))
          assert.match(err.message, /HTTP 500/)
          return true
        }
      )
    })

    test('sendNotificationEmail throws standard Error on Resend HTTP 401 unauthorized', async () => {
      const config = getNotificationConfig(BASE_ENV)
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({ message: 'API key is invalid' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      await assert.rejects(
        async () => {
          await sendNotificationEmail(
            config,
            {
              to: 'customer@arscomputer.com',
              subject: 'Test OTP',
              text: 'Code: 123456',
              html: '<p>Code: 123456</p>',
              idempotencyKey: 'idemp-3'
            },
            mockFetch
          )
        },
        (err) => {
          assert.ok(!(err instanceof NotificationRecipientRejectedError))
          assert.match(err.message, /HTTP 401/)
          return true
        }
      )
    })
  })

  describe('handleTrackingOtpRequest end-to-end scenarios', () => {
    test('1. Explicit recipient-related HTTP 422: anti-enumeration generic 200, logs sanitized warning', async () => {
      const originalFetch = globalThis.fetch
      const originalWarn = console.warn
      let warnLogged = null

      console.warn = (...args) => {
        warnLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '456789',
                delivery_email: 'placeholder@example.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({
                statusCode: 422,
                message: "Invalid `to` field customer@example.com. Please use our testing email address instead of domains like `example.com`."
              }),
              { status: 422, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 200, 'Must return HTTP 200 to preserve anti-enumeration')
        const body = await res.json()
        assert.equal(body.success, true)
        assert.match(body.message, /If a matching enquiry is registered/)

        assert.ok(warnLogged, 'Warning must be logged internally')
        assert.equal(
          warnLogged,
          '[tracking-otp] Email delivery rejected: recipient deliverability validation failure (HTTP 422).'
        )
        // Check zero customer or raw email or OTP details leaked in warning log
        assert.ok(!warnLogged.includes('example.com'))
        assert.ok(!warnLogged.includes('456789'))
        assert.ok(!warnLogged.includes('9876543210'))
      } finally {
        globalThis.fetch = originalFetch
        console.warn = originalWarn
      }
    })

    test('2. Unrelated HTTP 422 (e.g. unverified sender): surfaces generic HTTP 503 and logs error', async () => {
      const originalFetch = globalThis.fetch
      const originalError = console.error
      let errorLogged = null

      console.error = (...args) => {
        errorLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '456789',
                delivery_email: 'customer@example.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({
                statusCode: 422,
                message: "The `from` address is not verified."
              }),
              { status: 422, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 503, 'Unrelated 422 must surface generic 503')
        const body = await res.json()
        assert.equal(body.success, false)
        assert.equal(body.error, 'Verification failed. Please try again or contact ARS Computers for help.')

        assert.ok(errorLogged)
        assert.match(errorLogged, /\[tracking-otp\] OTP request failed:/)
        assert.match(errorLogged, /HTTP 422/)
      } finally {
        globalThis.fetch = originalFetch
        console.error = originalError
      }
    })

    test('3. Recipient-related HTTP 400: anti-enumeration generic 200, logs sanitized warning', async () => {
      const originalFetch = globalThis.fetch
      const originalWarn = console.warn
      let warnLogged = null

      console.warn = (...args) => {
        warnLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '456789',
                delivery_email: 'bad.recipient@example.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({
                statusCode: 400,
                message: "Invalid recipient email address format."
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 200, 'Must return HTTP 200 to preserve anti-enumeration')
        const body = await res.json()
        assert.equal(body.success, true)
        assert.match(body.message, /If a matching enquiry is registered/)

        assert.ok(warnLogged)
        assert.equal(
          warnLogged,
          '[tracking-otp] Email delivery rejected: recipient deliverability validation failure (HTTP 400).'
        )
      } finally {
        globalThis.fetch = originalFetch
        console.warn = originalWarn
      }
    })

    test('4. Unrelated HTTP 400: surfaces generic HTTP 503 and logs error', async () => {
      const originalFetch = globalThis.fetch
      const originalError = console.error
      let errorLogged = null

      console.error = (...args) => {
        errorLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '456789',
                delivery_email: 'customer@example.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({
                statusCode: 400,
                message: "Malformed request payload."
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 503)
        const body = await res.json()
        assert.equal(body.success, false)
        assert.equal(body.error, 'Verification failed. Please try again or contact ARS Computers for help.')

        assert.ok(errorLogged)
        assert.match(errorLogged, /HTTP 400/)
      } finally {
        globalThis.fetch = originalFetch
        console.error = originalError
      }
    })

    test('5. Successful OTP delivery: returns HTTP 200 and dispatches email', async () => {
      const originalFetch = globalThis.fetch
      let emailDispatched = false
      let sealedCalled = false

      try {
        globalThis.fetch = async (url, options) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '123456',
                delivery_email: 'verified.user@arscomputer.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            sealedCalled = true
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            emailDispatched = true
            assert.equal(options.method, 'POST')
            const parsed = JSON.parse(options.body)
            assert.deepEqual(parsed.to, ['verified.user@arscomputer.com'])
            assert.ok(options.headers['Idempotency-Key'])
            return new Response(JSON.stringify({ id: 'msg_12345' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 200)
        const body = await res.json()
        assert.equal(body.success, true)
        assert.match(body.message, /If a matching enquiry is registered/)
        assert.equal(sealedCalled, true, 'Challenge must be sealed before send')
        assert.equal(emailDispatched, true, 'Email must be sent')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('6. Provider HTTP 5xx: surfaces generic HTTP 503 and logs error', async () => {
      const originalFetch = globalThis.fetch
      const originalError = console.error
      let errorLogged = null

      console.error = (...args) => {
        errorLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '123456',
                delivery_email: 'user@arscomputer.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({ message: 'Resend service temporarily unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 503, 'Must surface generic 503 on provider outage')
        const body = await res.json()
        assert.equal(body.success, false)
        assert.equal(body.error, 'Verification failed. Please try again or contact ARS Computers for help.')

        assert.ok(errorLogged)
        assert.match(errorLogged, /\[tracking-otp\] OTP request failed:/)
        assert.match(errorLogged, /HTTP 503/)
      } finally {
        globalThis.fetch = originalFetch
        console.error = originalError
      }
    })

    test('7. Provider authentication failure (HTTP 401): surfaces generic HTTP 503 and logs error', async () => {
      const originalFetch = globalThis.fetch
      const originalError = console.error
      let errorLogged = null

      console.error = (...args) => {
        errorLogged = args.join(' ')
      }

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({
                delivered: true,
                identifier: '9876543210',
                otp_code: '123456',
                delivery_email: 'user@arscomputer.com',
                expires_in_minutes: 10
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('/rest/v1/rpc/seal_tracking_otp')) {
            return new Response(JSON.stringify({ sealed: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          if (urlStr.includes('api.resend.com/emails')) {
            return new Response(
              JSON.stringify({ message: 'Invalid API Key' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 503)
        const body = await res.json()
        assert.equal(body.success, false)
        assert.equal(body.error, 'Verification failed. Please try again or contact ARS Computers for help.')

        assert.ok(errorLogged)
        assert.match(errorLogged, /HTTP 401/)
      } finally {
        globalThis.fetch = originalFetch
        console.error = originalError
      }
    })

    test('8. Unmatched enquiry (delivered: false): returns generic HTTP 200 without email call', async () => {
      const originalFetch = globalThis.fetch
      let emailAttempted = false

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({ delivered: false }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (urlStr.includes('api.resend.com/emails')) {
            emailAttempted = true
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919999999999' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 200)
        const body = await res.json()
        assert.equal(body.success, true)
        assert.match(body.message, /If a matching enquiry is registered/)
        assert.equal(emailAttempted, false, 'No email should be dispatched for unmatched enquiry')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('9. Rate limiting (database returns 429): surfaces generic HTTP 429', async () => {
      const originalFetch = globalThis.fetch

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url)
          if (urlStr.includes('/rest/v1/rpc/start_tracking_otp')) {
            return new Response(
              JSON.stringify({ message: 'Too many verification requests. Please try again later.' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`Unexpected fetch URL: ${urlStr}`)
        }

        const req = createRequest({ contact: '+919876543210' })
        const res = await handleTrackingOtpRequest(req, BASE_ENV)

        assert.equal(res.status, 429)
        const body = await res.json()
        assert.equal(body.success, false)
        assert.equal(body.error, 'Verification failed. Please try again or contact ARS Computers for help.')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
