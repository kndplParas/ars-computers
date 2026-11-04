# Supabase Realtime for the Admin Dashboard

The admin dashboard subscribes to changes on these public tables:

- `products`
- `categories`
- `enquiries`
- `admin_users`
- `service_requests`
- `orders`
- `order_items`
- `order_payments`

Supabase only broadcasts change events for tables that belong to the
`supabase_realtime` publication. This is applied by the additive migration
`supabase/migrations/20261104000025_enable_dashboard_realtime.sql`.

The SQL below is the same idempotent change, provided for reference or for a
manual re-check. The dashboard still refreshes on navigation, successful
actions, and window focus if Realtime is unavailable.

```sql
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'products',
    'categories',
    'enquiries',
    'admin_users',
    'service_requests',
    'orders',
    'order_items',
    'order_payments'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end
$$;
```

Verify the publication:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

Realtime also respects Row Level Security. Signed-in staff only receive events
for rows their role is allowed to read; the dashboard suppresses unauthorised
datasets client-side as well.
