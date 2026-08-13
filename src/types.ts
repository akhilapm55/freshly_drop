export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  description: string;
  image: string;
  stock: number;
  rating: number;
  popular?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  date: string;
  /** Raw ISO timestamp — `date` is display-formatted and cannot be grouped by. */
  createdAt: string;
  status: 'Order Placed' | 'Picked Up' | 'Packing' | 'Out for Delivery' | 'Delivered';
  address: string;
  deliveryETA: string;
  orderNumber: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryDistanceKm?: number | null;
}

/** A delivery address a customer has saved for reuse (Home, Office, …). */
export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  landmark?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: string;
}

export type AppTab = 'home' | 'cart' | 'orders' | 'profile' | 'admin';
