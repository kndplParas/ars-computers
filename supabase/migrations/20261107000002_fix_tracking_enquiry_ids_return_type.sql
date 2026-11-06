-- ============================================================================
-- ARS Computers — Fix tracking enquiry-id helper return type
-- Migration: 20261107000002_fix_tracking_enquiry_ids_return_type.sql
-- ============================================================================
-- ROOT CAUSE (production OTP failure, SQLSTATE 42703):
--   The helper `tracking_enquiry_ids_for_identifier(TEXT, TEXT)` was declared
--   `RETURNS SETOF UUID`. `SETOF UUID` produces an UNNAMED (anonymous) output
--   column, so callers cannot reference `id`:
--     * `list_customer_enquiries` line ~732-734:
--         `SELECT id FROM public.tracking_enquiry_ids_for_identifier(...)`
--       -> 42703 "column id does not exist"
--     * `start_tracking_otp` mobile branch line ~304-307:
--         `... ids WHERE ids.id = e.id`
--       -> 42703 "column ids.id does not exist"
--   Result: every mobile-channel OTP request and every enquiry listing for a
--   verified session failed with a generic error. Email-channel requests kept
--   working only because that branch uses `count(*)`.
--
-- FIX:
--   Recreate the helper with `RETURNS TABLE (id UUID)` — a named output column
--   — so both call sites resolve `id` normally.
--
-- WHY DROP + CREATE (not CREATE OR REPLACE):
--   `CREATE OR REPLACE FUNCTION` cannot change the return type. `uuid` (single
--   value) and `record` (named table column) differ at the catalog level
--   (pg_proc.prorettype), so PostgreSQL rejects the replace with
--   "cannot change return type of existing function". The only safe change is
--   DROP (no CASCADE) followed by CREATE with the identical signature.
--
-- SAFETY:
--   * No data is touched: no tables, rows, RLS policies, permissions outside
--     this one function's own grants, OTP rows, sessions or Auth users change.
--   * The function body, LANGUAGE sql, STABLE, SECURITY DEFINER and empty
--     `search_path` are preserved byte-for-byte from the applied migration
--     20261107000001 (lines 177-201).
--   * The exact same REVOKE/GRANT statements are re-issued because DROP
--     removes the function's privileges: service_role keeps sole EXECUTE;
--     PUBLIC/anon/authenticated stay locked out. No permission is weakened.
--   * DROP is issued WITHOUT CASCADE. If any un-foreseen hard dependency
--     existed, the migration would fail loudly instead of dropping dependents.
--     (The two known callers reference this function inside other functions'
--     bodies as SQL text, which does not create a hard catalog dependency.)
-- ============================================================================

DROP FUNCTION public.tracking_enquiry_ids_for_identifier(TEXT, TEXT);

CREATE FUNCTION public.tracking_enquiry_ids_for_identifier(
  p_channel TEXT,
  p_identifier TEXT
)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- p_identifier: normalized lowercase email (channel 'email') or bare digits
  -- (channel 'mobile'). Contact info may hold "phone | email" segments.
  SELECT e.id
  FROM public.enquiries e,
       unnest(string_to_array(COALESCE(e.contact_info, ''), '|')) AS seg(part)
  WHERE CASE
    WHEN p_channel = 'email' AND p_identifier <> '' THEN
      lower(btrim(seg.part)) = p_identifier
    WHEN p_channel = 'mobile' AND p_identifier <> '' THEN
      char_length(regexp_replace(seg.part, '[^0-9]', '', 'g')) >= 10
      AND right(regexp_replace(seg.part, '[^0-9]', '', 'g'), 10) = right(p_identifier, 10)
    ELSE false
  END
  GROUP BY e.id;
$$;

REVOKE EXECUTE ON FUNCTION public.tracking_enquiry_ids_for_identifier(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_enquiry_ids_for_identifier(TEXT, TEXT)
  TO service_role;
