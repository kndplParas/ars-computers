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
`supabase_realtime` publication. The repository does not apply this database
change automatically. Run the SQL below once in the Supabase SQL editor for the
target project, after reviewing it with the project owner.

> Do not run this against production without explicit approval. The dashboard
> still refreshes on navigation, successful actions, and window focus when
> Realtime is unavailable.

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
