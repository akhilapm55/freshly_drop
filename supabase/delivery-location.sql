-- ============================================================================
-- Freshly Drop — Store delivery location & distance with each order
-- ----------------------------------------------------------------------------
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- The delivery CHARGE is already stored in orders.delivery_fee (so past orders
-- keep their price even if slabs change later). These columns additionally save
-- WHERE the order went and HOW FAR, for records and delivery routing.
-- ============================================================================

alter table public.orders add column if not exists delivery_lat numeric;
alter table public.orders add column if not exists delivery_lng numeric;
alter table public.orders add column if not exists delivery_distance_km numeric;
