-- ============================================================================
-- Freshly Drop — Add the "delivery" staff role
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Adds a third role, 'delivery', for delivery staff. Delivery + admin together
-- are "staff": they can see and update every order (to move it through the
-- pick -> pack -> out-for-delivery -> delivered stages), but only ADMINS can
-- edit products, see revenue, or change people's roles.
-- ============================================================================

-- 1. Allow 'delivery' as a valid role value.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('customer', 'admin', 'delivery'));

-- 2. Helper: is the current user staff (admin OR delivery)?
create or replace function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'delivery')
  );
$$;

-- 3. Orders: staff (admin + delivery) can see and update ALL orders.
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists "orders_update_own_or_admin" on public.orders;
create policy "orders_update_own_or_admin" on public.orders
  for update using (auth.uid() = user_id or public.is_staff());

-- 4. Profiles: admins can update ANY profile (needed to assign roles from the
--    admin "Staff" tab). Customers/delivery can still only update their own.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- DONE. You can promote someone to delivery from the admin "Staff" tab, or via:
--   update public.profiles set role = 'delivery' where email = 'them@gmail.com';
-- ============================================================================
