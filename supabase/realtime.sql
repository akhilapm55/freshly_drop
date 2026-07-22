-- ============================================================================
-- Freshly Drop — Enable real-time updates for the orders table
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (the DO block only adds the table if it isn't already there).
--
-- This lets the app receive live order-status changes over a WebSocket, so a
-- customer's tracker updates the instant the admin advances the status.
-- Row-level security still applies, so each customer only receives their own
-- orders' updates.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
