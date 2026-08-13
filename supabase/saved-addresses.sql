-- ============================================================================
-- Freshly Drop — Saved delivery addresses (Home / Office / custom)
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Lets a signed-in customer keep several labelled addresses and pick one at
-- checkout instead of retyping. Coordinates are stored alongside the text so
-- the delivery charge can be recalculated without geocoding again.
-- ============================================================================

create table if not exists public.saved_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  address    text not null,
  landmark   text,
  lat        numeric,
  lng        numeric,
  created_at timestamptz not null default now()
);

create index if not exists saved_addresses_user_id_idx
  on public.saved_addresses (user_id);

-- One entry per label per user, so "save as Home" overwrites the old Home
-- rather than piling up duplicates (see upsertSavedAddress in src/lib/queries.ts).
-- Plain columns, not lower(label): ON CONFLICT in the client upsert targets
-- (user_id, label) and cannot reference an expression index.
create unique index if not exists saved_addresses_user_label_idx
  on public.saved_addresses (user_id, label);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — an address is private to the customer who saved it.
-- Admins deliberately get no access here; the address of an actual order is
-- already stored on public.orders, which admins can read.
-- ---------------------------------------------------------------------------
alter table public.saved_addresses enable row level security;

drop policy if exists "saved_addresses_select_own" on public.saved_addresses;
create policy "saved_addresses_select_own" on public.saved_addresses
  for select using (auth.uid() = user_id);

drop policy if exists "saved_addresses_insert_own" on public.saved_addresses;
create policy "saved_addresses_insert_own" on public.saved_addresses
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_addresses_update_own" on public.saved_addresses;
create policy "saved_addresses_update_own" on public.saved_addresses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_addresses_delete_own" on public.saved_addresses;
create policy "saved_addresses_delete_own" on public.saved_addresses
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- DONE.
-- ============================================================================
