# Enquiry Email Notifications

ARS Computers sends server-side email notifications to staff registered in
`public.admin_users`. Recipients are resolved by the Cloudflare Worker at send
time; they are never hardcoded and never exposed to customer or admin clients.

## Recipient behaviour

| Event | Who receives the email |
| --- | --- |
| **New website enquiry** | Every active staff account with a valid registered email address, across all roles. |
| **New assignment** | The newly assigned active employee plus every active Superadmin. |
| **Reassignment** | The newly assigned active employee plus every active Superadmin. The previously assigned employee is excluded unless they are also the new assignee. |

Recipient rules:

- Only `is_active = true` accounts are considered.
- Missing, blank, malformed, or over-long email addresses are skipped.
- Addresses are deduplicated case-insensitively, so `Head@Example.com` and
  `head@example.com` receive one email, not two.
- Each recipient receives an individual email. Staff addresses are not shared
  with other recipients in `To`/`Cc` headers.
- The protected test route intentionally targets **one** primary administrator
  only, never all staff.

## Architecture

```text
Website enquiry INSERT ─┐
                       ├─ PostgreSQL trigger ─> public.notification_outbox
Head assign/reassign ──┘                              │
                                                      │ every minute (cron)
                                                      ▼
                                        Cloudflare Worker (scheduled)
                                                      │
                                    resolve recipients from admin_users
                                                      │
                                            one request per recipient
                                                      ▼
                                              Resend HTTPS API
```

- The trigger only queues a row. It is wrapped in an exception handler, so an
  email/queue failure can never block enquiry submission or assignment.
- The outbox has a unique `event_key`, which makes event creation idempotent.
- Assignment rows are only created when `assigned_employee_id` actually
  changes. Re-saving the same assignee does **not** create another email.
- The Worker uses a deterministic per-event, per-recipient Resend
  `Idempotency-Key`. Multiple recipients for one event therefore receive
  separate requests without provider-level deduplication conflicts.
- `notification_outbox.delivered_to` records normalized addresses that already
  received the event. A retry skips those addresses and only retries failures.
- The Worker claims each row with an optimistic `status`/`attempts` update
  before sending. Failed sends are retried up to 5 times.
- Rows older than 24 hours that could not be sent are marked `skipped` rather
  than delivered late.
- `public.notification_outbox` is accessible only to `service_role`. `anon` and
  `authenticated` have no access.
- No API key, SMTP password, or service-role key is present in frontend code.

## Production configuration

The Worker uses these existing secret names (values are never committed or
logged):

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side read access to `admin_users` and the outbox |
| `RESEND_API_KEY` | Resend API authentication |
| `EMAIL_FROM` | Verified sender, for example `ARS Computers <notifications@arscomputer.com>` |
| `APP_BASE_URL` | Admin deep-link base, normally `https://arscomputer.com` |
| `NOTIFICATION_PROCESS_TOKEN` | Protects manual process/test routes |

Optional tuning:

| Secret/Variable | Default | Purpose |
| --- | --- | --- |
| `NOTIFICATION_BATCH_LIMIT` | `10` | Outbox rows processed per cron run |
| `NOTIFICATION_MAX_AGE_HOURS` | `24` | Pending rows older than this are skipped |

`SUPABASE_URL` may also be supplied as `VITE_SUPABASE_URL`; the Worker accepts
either name. The code also supports an optional Cloudflare `NOTIFICATION_EMAIL`
`send_email` binding when `RESEND_API_KEY` is absent.

## Safe verification

Do **not** create a fake production enquiry or assign a real enquiry just to
test email. That would notify real staff and alter business records.

After deployment, send the single-recipient test email:

```powershell
$headers = @{
  "x-notification-token" = "<NOTIFICATION_PROCESS_TOKEN>"
}
Invoke-RestMethod -Method Post `
  -Uri "https://arscomputer.com/api/notifications/test" `
  -Headers $headers
```

The response contains the provider, a **masked** recipient, and a timestamp.
Confirm receipt in that primary administrator mailbox. This test never emails
all staff and never creates or modifies a business record.

To force an outbox run manually:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://arscomputer.com/api/notifications/process" `
  -Headers $headers
```

If `NOTIFICATION_PROCESS_TOKEN` is not set, both routes return `404`. If the
token is wrong, they return `401`. The routes never return secrets or full
recipient addresses.

For a real multi-recipient verification, wait for a genuine new enquiry (or a
genuine assignment in a controlled test enquiry if the business approves one),
then inspect the outbox row and `delivered_to` as shown below. Do not send bulk
test emails to all staff without explicit authorization.

## Failure behaviour

- If the provider is not configured, the Worker leaves outbox rows `pending`
  and logs a configuration warning. No email is claimed or marked failed.
- If the active-staff lookup fails, rows remain `pending` and no email is sent.
- If one recipient fails, other recipients still receive their email. The row
  is marked `failed` with a sanitized `last_error`, and `delivered_to` retains
  the successful addresses. The next cron run retries only the failures.
- If no active valid recipients exist, the row is marked `skipped` rather than
  retried forever.
- Email errors are logged without API keys, service-role credentials, or full
  recipient addresses.
- `last_error` is truncated to 1,000 characters.

## Operational queries

Run these in the Supabase SQL editor as an administrator:

```sql
-- Recent notification activity (no customer message contents)
select id, event_type, status, attempts, delivered_to, created_at, processed_at, last_error
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

## Related migrations

- `supabase/migrations/20261104000024_enquiry_email_notifications.sql`
  — outbox table, recipient event trigger, service-role-only access.
- `supabase/migrations/20261104000026_notification_outbox_delivered_recipients.sql`
  — additive `delivered_to` tracking for per-recipient retry safety.

Both migrations are additive. They do not modify existing enquiries,
assignments, permissions, RLS policies, approval workflows, or audit history.
