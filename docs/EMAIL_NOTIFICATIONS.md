# Enquiry Email Notifications

ARS Computers sends two server-side email notifications to the **existing
registered main/admin email address** stored in `public.admin_users`:

1. **New enquiry requires review** — every public website enquiry.
2. **New assignment / employee reassignment** — whenever the Head/Superadmin
   assigns or changes the engineer/employee on an enquiry.

The recipient is never hardcoded. The Cloudflare Worker resolves the oldest
active `superadmin` account at send time, then falls back to the oldest active
`admin` account if no superadmin exists. Emails are never sent from the browser.

## Architecture

```text
Website enquiry INSERT ─┐
                       ├─ PostgreSQL trigger ─> public.notification_outbox
Head assign/reassign ──┘                              │
                                                      │ every minute (cron)
                                                      ▼
                                        Cloudflare Worker (scheduled)
                                                      │
                                          resolve recipient from admin_users
                                                      │
                                                      ▼
                                              Resend HTTPS API
```

- `the trigger` only queues a row. It is wrapped in an exception handler, so an
  email/queue failure can never block enquiry submission or assignment.
- The outbox has a unique `event_key`, which makes event creation idempotent.
- Assignment rows are only created when `assigned_employee_id` actually
  changes. Re-saving the same assignee does **not** create another email.
- The Worker uses the outbox `event_key` as the Resend `Idempotency-Key`, so a
  retry after a successful send cannot duplicate an email.
- The Worker claims each row with an optimistic `status`/`attempts` update
  before sending. Failed sends are retried up to 5 times.
- Rows older than 24 hours that could not be sent are marked `skipped` rather
  than delivered late.
- `public.notification_outbox` is accessible only to `service_role`. `anon` and
  `authenticated` have no access.
- No API key, SMTP password, or service-role key is present in frontend code.

## Required production configuration

The code is deployed, but **email delivery is not active until the Worker
secrets below are configured**. At the time this feature was added, the Worker
had no `RESEND_API_KEY` or `EMAIL_FROM` secret and Supabase had no notification
provider configured, so no delivery could be verified.

### 1. Create/verify an email sender

Use an existing provider account where possible. This implementation supports:

- **Resend** (recommended): create an API key and verify the sending domain
  (for example `arscomputer.com`) in the Resend dashboard.
- **Cloudflare `send_email` binding** (alternative): configure a
  `NOTIFICATION_EMAIL` send_email binding in `wrangler.jsonc`. The destination
  address must be verified in Cloudflare Email Routing. The existing code will
  use the binding automatically when `RESEND_API_KEY` is absent.

Do not use a personal email address as the `from` sender. Use a domain you
control, for example `notifications@arscomputer.com`.

### 2. Set Cloudflare Worker secrets

Run these from `C:\ARS Computers` (never commit the values):

```powershell
npx wrangler secret put SUPABASE_URL
# https://pthxyolerxlktkrbzkms.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Supabase Dashboard -> Project Settings -> API -> service_role key

npx wrangler secret put RESEND_API_KEY
# Resend dashboard -> API Keys

npx wrangler secret put EMAIL_FROM
# Example: ARS Computers <notifications@arscomputer.com>

npx wrangler secret put APP_BASE_URL
# https://arscomputer.com

npx wrangler secret put NOTIFICATION_PROCESS_TOKEN
# A long random value; only used for the protected manual test/process routes
```

Optional tuning:

| Secret/Variable | Default | Purpose |
| --- | --- | --- |
| `NOTIFICATION_BATCH_LIMIT` | `10` | Outbox rows processed per cron run |
| `NOTIFICATION_MAX_AGE_HOURS` | `24` | Pending rows older than this are skipped |

`SUPABASE_URL` may also be supplied as `VITE_SUPABASE_URL`; the Worker accepts
either name.

### 3. Deploy and verify

```powershell
npm run check:deploy
npx wrangler deploy
```

Send a safe test email (does not create or modify any business record):

```powershell
$headers = @{
  "x-notification-token" = "<NOTIFICATION_PROCESS_TOKEN>"
}
Invoke-RestMethod -Method Post `
  -Uri "https://ars-computers.ankitbathla-ind.workers.dev/api/notifications/test" `
  -Headers $headers
```

The response contains the provider and a **masked** recipient. Confirm actual
delivery in the registered admin mailbox before declaring email notifications
operational.

To force an outbox run manually:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://ars-computers.ankitbathla-ind.workers.dev/api/notifications/process" `
  -Headers $headers
```

If `NOTIFICATION_PROCESS_TOKEN` is not set, both routes return `404`. If the
token is wrong, they return `401`. The routes never return secrets or the full
recipient address.

## Failure behavior

- If the provider is not configured, the Worker leaves outbox rows `pending`
  and logs a configuration warning. No email is claimed or marked failed.
- If recipient lookup fails, rows remain `pending`.
- If Resend/Cloudflare returns an error, the row is marked `failed` with a
  sanitized `last_error`, and the business operation has already completed.
- Email errors are logged without API keys or service-role credentials.
- `last_error` is truncated to 1,000 characters.

## Operational queries

Run these in the Supabase SQL editor as an administrator:

```sql
-- Recent notification activity (no customer message contents)
select id, event_type, status, attempts, created_at, processed_at, last_error
from public.notification_outbox
order by created_at desc
limit 50;

-- Backlog
select status, count(*)
from public.notification_outbox
group by status;
```

Do not delete or edit outbox rows to work around a delivery problem; configure
the provider, inspect `last_error`, and retry with the protected process route.

## Related migration

- `supabase/migrations/20261104000024_enquiry_email_notifications.sql`

The migration is additive and was reviewed before applying. It does not modify
existing enquiries, assignments, permissions, RLS policies, or audit history.
