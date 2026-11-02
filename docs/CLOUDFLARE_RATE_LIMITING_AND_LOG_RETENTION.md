# ARS Computers — Step 5: Cloudflare Distributed Rate Limiting & Log Retention Architecture

This document details the production security configuration for Customer-Shareable Order Attachments on Cloudflare Pages and Supabase.
**DO NOT DEPLOY THIS CONFIGURATION TO PRODUCTION YET.** This document serves as the formal architectural reference for release staging.

---

## 1. Priority 3: Distributed Rate Limiting at the Cloudflare Edge

### A. Architectural Context
In local development, the Node server / local Pages Function uses an in-memory sliding window map (`ipRequestCounts` and `ipFailedAttempts`).
However, in production on **Cloudflare Pages / Workers**:
- Code executes across hundreds of distributed points of presence (PoPs) globally.
- Isolate instances are ephemeral and do not share heap memory across regions or even across concurrent requests within the same region.
- An attacker could distribute invalid token brute-force attempts across different edge nodes, bypassing any single-isolate in-memory counter.

### B. Production Distributed Control: Cloudflare WAF Rate Limiting
Distributed rate limiting must be enforced at the **Cloudflare Edge** before requests hit the Pages Function or Supabase backend.

#### Cloudflare WAF Rate Limiting Rule Specification:
1. **Rule Name:** `ARS Attachment Token Download Rate Limiting`
2. **Traffic Filter Expression:**
   ```text
   (http.request.method eq "GET" and http.request.uri.path matches "^/api/share/attachment/[0-9a-f]{64}$")
   ```
3. **Rate Limits & Characteristics:**
   - **Counting Characteristic:** IP Address (`cf.unique_ip`)
   - **Threshold:** 30 requests
   - **Period:** 1 minute (60 seconds)
4. **Action:**
   - **Mitigation Action:** Block (HTTP 429 Too Many Requests)
   - **Duration:** 900 seconds (15 minutes)
   - **Response Format:** JSON
   - **Response Body:**
     ```json
     {
       "success": false,
       "error": "Too many download requests from this IP. Please wait 15 minutes before trying again."
     }
     ```
   - **Response Headers:**
     ```http
     Retry-After: 900
     Cache-Control: no-store, private
     ```

#### Deployment Prerequisites for Production Cloudflare:
1. Log in to Cloudflare Dashboard -> Select `arscomputer.com` zone.
2. Navigate to **Security** -> **WAF** -> **Rate limiting rules**.
3. Create a new custom rule with the expression and parameters above.
4. Position the rule above general web application rules so brute-force traffic is dropped at the edge without incurring server execution costs.

---

## 2. Priority 5: 90-Day Access Log Retention Cleanup

### A. Database Mechanism
The database migration `20261101000017_remediate_order_attachment_sharing_security.sql` provides the automated cleanup procedure:
```sql
public.cleanup_expired_order_attachment_access_logs() RETURNS JSONB
```
- Deletes records from `public.order_attachment_access_logs` where `retention_until < clock_timestamp()`.
- Access logs default `retention_until` to `now() + interval '90 days'`.
- Execution is strictly restricted to `service_role` and Head Superadmin (`superadmin`).
- Revoked from `PUBLIC`, `anon`, and ordinary employee roles.

### B. Production Automation Options

#### Option A: Supabase `pg_cron` (Recommended for pure database automation)
If the production Supabase project has the `pg_cron` extension enabled:
```sql
-- Run daily at 03:00 UTC (08:30 AM IST)
SELECT cron.schedule(
  'cleanup-order-attachment-access-logs',
  '0 3 * * *',
  'SELECT public.cleanup_expired_order_attachment_access_logs();'
);
```

#### Option B: Cloudflare Scheduled Worker (Cron Trigger)
If `pg_cron` is not enabled on the project tier, configure a daily Cloudflare Scheduled Worker:
1. **Cron Expression:** `0 3 * * *` (Daily at 03:00 UTC)
2. **Worker Code:**
   ```javascript
   export default {
     async scheduled(event, env, ctx) {
       const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/cleanup_expired_order_attachment_access_logs`, {
         method: 'POST',
         headers: {
           'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
           'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
           'Content-Type': 'application/json'
         }
       });
       const data = await res.json();
       console.log('Log retention cleanup executed:', data);
     }
   };
   ```

---

## 3. Priority 5: Access Log Privacy and Data Masking

### A. IP Address Masking
- The `public.mask_ip_address(TEXT)` helper masks IPv4 (`192.168.1.50` -> `192.168.1.xxx`) and IPv6 (`2001:db8:85a3::7334` -> `2001:db8:85a3::xxxx`).
- Both raw `ip_address` (for internal abuse investigation by Head Superadmin) and `masked_ip` are stored securely server-side.
- Front-end views display only `masked_ip` to store staff.

### B. Access Restrictions & RLS Policies
- `order_attachment_shares` and `order_attachment_access_logs` are restricted by RLS:
  ```sql
  USING (public.get_staff_role() IN ('superadmin', 'admin'))
  ```
- Technical, Engineer, HR, Accounts, and Inventory Staff receive **0 rows** (HTTP 200 with empty array via PostgREST).
- Anonymous clients have zero access.
- All client roles have **0 write privileges** (INSERT, UPDATE, DELETE, TRUNCATE revoked).

