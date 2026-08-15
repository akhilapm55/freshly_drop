-- ============================================================================
-- Freshly Drop — Payment tracking on orders (UPI now, gateway later)
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. DELIVERY COLUMNS
-- These belong to supabase/delivery-location.sql. They are repeated here
-- because the app's createOrder() writes them on every order, and checkout
-- fails with "column does not exist" until they are present. Harmless to
-- re-run if delivery-location.sql was already applied.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists delivery_lat numeric;
alter table public.orders add column if not exists delivery_lng numeric;
alter table public.orders add column if not exists delivery_distance_km numeric;

-- ---------------------------------------------------------------------------
-- 2. PAYMENT COLUMNS
--
-- payment_method  how the customer chose to pay
--                   'cod'      — cash when the rider arrives
--                   'upi'      — UPI deep link / QR, confirmed by hand
--                   'gateway'  — reserved for Razorpay etc. (not used yet)
--
-- payment_status  where that payment has got to
--                   'pending'    — nothing paid yet (all COD orders sit here)
--                   'submitted'  — customer says they paid and gave a reference
--                   'paid'       — YOU verified it in your bank/GPay app
--                   'failed'     — verification failed / payment reversed
--
-- payment_ref     UPI reference (UTR) typed in by the customer, or later the
--                 gateway's payment id. Deliberately free text so the same
--                 column serves both.
--
-- IMPORTANT: 'submitted' is a CLAIM, not proof. A UPI deep link gives the
-- website no confirmation, so only mark an order 'paid' after seeing the money.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists payment_method text not null default 'cod';
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists payment_ref text;
alter table public.orders add column if not exists paid_at timestamptz;

-- Constraints added separately so re-running does not error on existing rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_check') then
    alter table public.orders add constraint orders_payment_method_check
      check (payment_method in ('cod', 'upi', 'gateway'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending', 'submitted', 'paid', 'failed'));
  end if;
end $$;

-- Admin "payments awaiting verification" view is the hot query.
create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

-- ---------------------------------------------------------------------------
-- 3. SECURITY
--
-- The existing "orders_update_own_or_admin" policy lets a customer UPDATE their
-- own order row. With money involved that is now too broad: a customer could
-- call the public API directly and set payment_status = 'paid', or edit total.
--
-- RLS cannot restrict WHICH COLUMNS an update touches, so a policy alone cannot
-- fix this. Instead: customers lose UPDATE entirely, and submit their payment
-- reference through a SECURITY DEFINER function that writes only the two
-- payment columns and can never write 'paid'.
-- ---------------------------------------------------------------------------
drop policy if exists "orders_update_own_or_admin" on public.orders;

-- Only admins may update order rows directly (status changes, marking paid).
create policy "orders_update_admin" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- Customer-facing: attach a UPI reference to your own unpaid order. Returns
-- true when it applied. Cannot set 'paid' — only an admin can, after checking
-- the money actually arrived.
create or replace function public.submit_payment_reference(order_id uuid, reference text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  updated integer;
begin
  if reference is null or length(btrim(reference)) < 4 then
    raise exception 'Enter the UPI reference number from your payment app.';
  end if;

  update public.orders
     set payment_ref = btrim(reference),
         payment_status = 'submitted'
   where id = order_id
     and user_id = auth.uid()            -- your own order only
     and payment_method = 'upi'
     and payment_status in ('pending', 'submitted');

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.submit_payment_reference(uuid, text) from public;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

-- ============================================================================
-- DONE.
-- ============================================================================
