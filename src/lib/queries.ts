/**
 * Data access layer — all Supabase reads/writes live here so components stay
 * clean. Each function maps database rows (snake_case) to the app's existing
 * camelCase types (see src/types.ts), so the UI did not have to change shape.
 */
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Product, Order, CartItem, SavedAddress } from '../types';

// ---- Mappers ---------------------------------------------------------------

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    unit: row.unit,
    description: row.description,
    image: row.image,
    stock: Number(row.stock),
    rating: Number(row.rating),
    popular: Boolean(row.popular),
  };
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    items: row.items as CartItem[],
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    tax: Number(row.tax),
    total: Number(row.total),
    date: new Date(row.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    createdAt: row.created_at,
    status: row.status,
    address: row.address,
    deliveryETA: row.delivery_eta,
    orderNumber: row.order_number,
    deliveryLat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
    deliveryLng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
    deliveryDistanceKm: row.delivery_distance_km != null ? Number(row.delivery_distance_km) : null,
    // Defaults keep older rows (written before supabase/payments.sql) readable.
    paymentMethod: (row.payment_method ?? 'cod') as Order['paymentMethod'],
    paymentStatus: (row.payment_status ?? 'pending') as Order['paymentStatus'],
    paymentRef: row.payment_ref ?? null,
    paidAt: row.paid_at ?? null,
  };
}

// ---- Products --------------------------------------------------------------

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function updateProductStock(productId: string, newStock: number): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId);
  if (error) throw error;
}

/** Build the row payload shared by insert and update (admin-only via RLS). */
function productRow(p: Product) {
  return {
    name: p.name,
    category: p.category,
    price: p.price,
    unit: p.unit,
    description: p.description,
    image: p.image,
    stock: p.stock,
    rating: p.rating,
    popular: p.popular,
  };
}

export async function createProduct(product: Product): Promise<void> {
  const { error } = await supabase
    .from('products')
    .insert({ id: product.id, ...productRow(product) });
  if (error) throw error;
}

export async function updateProduct(product: Product): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update(productRow(product))
    .eq('id', product.id);
  if (error) throw error;
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

// ---- Staff / roles (admin-only via RLS) ------------------------------------

export type UserRole = 'customer' | 'admin' | 'delivery';

export interface StaffProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
}

/**
 * List only staff members (admins + delivery). This stays small no matter how
 * many customers sign up, so the admin Staff tab loads instantly. Admin-only via RLS.
 */
export async function fetchStaffMembers(): Promise<StaffProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .in('role', ['admin', 'delivery'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

/**
 * Search users by name or email (runs in the database, returns at most 25 rows)
 * so the admin can find a specific person to promote without loading everyone.
 */
export async function searchProfiles(term: string): Promise<StaffProfile[]> {
  // Strip characters that would break PostgREST's or() filter syntax.
  const clean = term.trim().replace(/[,()%]/g, ' ').trim();
  if (clean.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .or(`email.ilike.%${clean}%,full_name.ilike.%${clean}%`)
    .limit(25);
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

/**
 * Admin-provisions a staff account: create the auth user with email/password,
 * then set their role. Uses a throwaway Supabase client (persistSession: false)
 * so signing up the new user does NOT replace the admin's own session.
 *
 * Returns needsConfirmation=true when Supabase's "Confirm email" is on (the new
 * user must click an email link before they can sign in). Turn that setting off
 * in Supabase for instant staff access.
 */
export async function createStaffAccount(opts: {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ needsConfirmation: boolean }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const temp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await temp.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: { data: { full_name: opts.fullName } },
  });
  if (error) throw error;

  const newId = data.user?.id;
  if (!newId) throw new Error('Could not create the account — the email may already be registered.');

  // Assign their role using the admin's own session (RLS allows admins here).
  // .select() lets us detect a silently-blocked update (e.g. roles.sql not run).
  const { data: updated, error: roleErr } = await supabase
    .from('profiles')
    .update({ role: opts.role })
    .eq('id', newId)
    .select('id');
  if (roleErr) throw roleErr;
  if (!updated || updated.length === 0) {
    throw new Error(
      'Account created, but the delivery role could not be set — make sure you have run supabase/roles.sql in Supabase. You can also set the role from the "Promote an existing user" section.'
    );
  }

  return { needsConfirmation: !data.session };
}

// ---- Image upload (Supabase Storage) --------------------------------------

const PRODUCT_IMAGE_BUCKET = 'product-images';

/**
 * Upload an image file chosen from the device to Supabase Storage and return
 * its public URL (to be saved in products.image). Admin-only via storage RLS.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image is too large (max 5 MB).');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---- Orders ----------------------------------------------------------------

/** Admins receive every order; customers receive only their own (enforced by RLS). */
export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export interface NewOrderInput {
  userId: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  address: string;
  deliveryETA: string;
  orderNumber: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryDistanceKm?: number | null;
  paymentMethod?: Order['paymentMethod'];
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      items: input.items,
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee, // charge frozen at order time
      tax: input.tax,
      total: input.total,
      status: 'Order Placed',
      address: input.address,
      delivery_eta: input.deliveryETA,
      order_number: input.orderNumber,
      delivery_lat: input.deliveryLat ?? null,
      delivery_lng: input.deliveryLng ?? null,
      delivery_distance_km: input.deliveryDistanceKm ?? null,
      // Every order starts unpaid. UPI orders move to 'submitted' when the
      // customer supplies a reference, and only an admin can mark them 'paid'.
      payment_method: input.paymentMethod ?? 'cod',
      payment_status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return mapOrder(data);
}

// ---- Payments --------------------------------------------------------------

/**
 * Customer attaches the UPI reference (UTR) shown in their payment app.
 * Goes through a SECURITY DEFINER function rather than a direct update, so the
 * customer cannot write payment_status = 'paid' or touch any other column.
 * Returns false when the order was already verified or does not belong to them.
 */
export async function submitPaymentReference(orderId: string, reference: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('submit_payment_reference', {
    order_id: orderId,
    reference,
  });
  if (error) throw error;
  return data === true;
}

/**
 * Admin confirms the money actually arrived (or marks the claim failed).
 * Guarded by RLS — only an admin's update passes the orders_update_admin policy.
 */
export async function setPaymentStatus(
  orderId: string,
  status: Order['paymentStatus']
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', orderId);
  if (error) throw error;
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}

/** Move many orders to the same status at once (the batch pick/pack actions). */
export async function bulkUpdateOrderStatus(orderIds: string[], status: Order['status']): Promise<void> {
  if (orderIds.length === 0) return;
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .in('id', orderIds);
  if (error) throw error;
}

// ---- Saved addresses -------------------------------------------------------
// Requires supabase/saved-addresses.sql. RLS restricts every row to its owner,
// so these never need to filter by user_id explicitly on read.

function mapSavedAddress(row: any): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    landmark: row.landmark ?? null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
  };
}

export async function fetchSavedAddresses(): Promise<SavedAddress[]> {
  const { data, error } = await supabase
    .from('saved_addresses')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSavedAddress);
}

/**
 * Create or replace the address stored under `label` for the current user.
 * Saving "Home" twice updates the existing Home rather than adding a second one
 * (enforced by the unique index on user_id + lower(label)).
 */
export async function upsertSavedAddress(input: {
  label: string;
  address: string;
  landmark?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<SavedAddress> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Please sign in to save an address.');

  const label = input.label.trim();
  if (!label) throw new Error('Give this address a name, like Home or Office.');
  if (!input.address.trim()) throw new Error('The address cannot be empty.');

  // onConflict targets the unique index, so a repeat label overwrites in place.
  const { data, error } = await supabase
    .from('saved_addresses')
    .upsert(
      {
        user_id: userId,
        label,
        address: input.address.trim(),
        landmark: input.landmark?.trim() || null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      },
      { onConflict: 'user_id,label' }
    )
    .select()
    .single();
  if (error) throw error;
  return mapSavedAddress(data);
}

export async function deleteSavedAddress(id: string): Promise<void> {
  const { error } = await supabase.from('saved_addresses').delete().eq('id', id);
  if (error) throw error;
}
