-- ============================================================================
-- Freshly Drop — Supabase schema, security policies, and seed data
-- ----------------------------------------------------------------------------
-- HOW TO RUN:
--   1. Open your Supabase project  ->  SQL Editor  ->  New query
--   2. Paste this entire file and click "Run"
--   3. Re-running is safe (drops/recreates policies, upserts seed data)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES  (one row per authenticated user; holds the admin/customer role)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up (e.g. via Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the CURRENT user an admin? SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. PRODUCTS  (the catalogue; readable by all, editable only by admins)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  category    text not null,
  price       numeric not null,
  unit        text not null,
  description text not null,
  image       text not null,
  stock       integer not null default 0,
  rating      numeric not null default 0,
  popular     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. ORDERS  (one row per placed order; owned by the customer who placed it)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  items        jsonb not null,
  subtotal     numeric not null,
  delivery_fee numeric not null,
  tax          numeric not null,
  total        numeric not null,
  status       text not null default 'Order Placed',
  address      text not null,
  delivery_eta text not null,
  order_number text not null,
  created_at   timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);

-- When an order is placed, automatically deduct stock for each line item.
-- SECURITY DEFINER lets a customer's INSERT decrement product stock even though
-- the products table is otherwise admin-write-only.
create or replace function public.deduct_stock_on_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(new.items)
  loop
    update public.products
    set stock = greatest(0, stock - (item ->> 'quantity')::int)
    where id = (item -> 'product' ->> 'id');
  end loop;
  return new;
end;
$$;

drop trigger if exists on_order_created on public.orders;
create trigger on_order_created
  after insert on public.orders
  for each row execute function public.deduct_stock_on_order();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- PROFILES: users read/update their own row; admins can read everyone.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- PRODUCTS: anyone (even logged-out) can read; only admins can insert/update/delete.
drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ORDERS: a customer sees/creates only their own orders; admins see/update all.
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "orders_update_own_or_admin" on public.orders;
create policy "orders_update_own_or_admin" on public.orders
  for update using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. SEED PRODUCTS  (mirrors src/data.ts INITIAL_PRODUCTS)
-- ---------------------------------------------------------------------------
insert into public.products (id, name, category, price, unit, description, image, stock, rating, popular) values
  ('prod-1', 'Malabar Organic Coconut', 'Veggies & Fruits', 45, '1 pc', 'Traditionally harvested husked coconuts from the organic farms of Alappuzha. Loaded with rich sweet water and creamy pulp.', 'https://images.unsplash.com/photo-1525203135335-74d272fc8d9c?auto=format&fit=crop&q=80&w=400', 24, 4.9, true),
  ('prod-2', 'Nendran Banana Bundle', 'Veggies & Fruits', 75, '1 kg (approx 6-8 pcs)', 'Heritage Kerala Nendran bananas, highly nutritious, rich gold skins, perfect for steaming, baking, or enjoying ripe.', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=400', 32, 4.8, true),
  ('prod-3', 'Cold-Pressed Virgin Coconut Oil', 'Oils & Honey', 360, '500 ml', '100% natural wooden cold-pressed (Chekku) oil from organic sun-dried copra. Zero chemicals, premium aroma.', 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&q=80&w=400', 15, 5.0, true),
  ('prod-4', 'Organic Wayanad Black Pepper', 'Spices & Spreads', 190, '200g', 'Premium whole black pepper berries harvested and sun-dried in the humid valleys of Wayanad. Intensely pungent flavor profile.', 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400', 40, 4.7, false),
  ('prod-5', 'Hills-grown True Green Cardamom', 'Spices & Spreads', 240, '100g', 'Aromatic green cardamom pods harvested carefully at peak ripeness. Intense floral fragrance, perfect for Keralite payasams.', 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&q=80&w=400', 18, 4.9, true),
  ('prod-6', 'Organic Matta Red Rice', 'Kerala Staples', 85, '1 kg', 'Traditional parboiled red rice from Palakkad fields containing essential nutrients retained inside the reddish-brown husk.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400', 50, 4.6, false),
  ('prod-7', 'Ripe Honey Mangoes (Muvandan)', 'Veggies & Fruits', 140, '1 kg', 'Sweet, fibrous, native mangoes grown organically, carrying that authentic Kerala backyard summer flavor.', 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400', 12, 4.8, true),
  ('prod-8', 'Wayanad Raw Wild Honey', 'Oils & Honey', 290, '250g', 'Sourced from natural forest beehives of Wayanad. Unfiltered, unpasteurized, retaining trace pollens and organic nutrients.', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=400', 10, 4.9, false),
  ('prod-9', 'Organic Kasturi Turmeric Powder', 'Spices & Spreads', 110, '150g', 'Premium cosmetic and culinary fragrant wild turmeric powder. Purely organic and free of artificial yellow color additives.', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=400', 25, 4.7, false)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, price = excluded.price,
  unit = excluded.unit, description = excluded.description, image = excluded.image,
  stock = excluded.stock, rating = excluded.rating, popular = excluded.popular;

-- ============================================================================
-- DONE.  To make yourself an admin AFTER you have signed in once with Google:
--   update public.profiles set role = 'admin' where email = 'YOUR_EMAIL@gmail.com';
-- ============================================================================
