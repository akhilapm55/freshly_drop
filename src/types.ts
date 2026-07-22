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
  status: 'Order Placed' | 'Picked Up' | 'Packing' | 'Out for Delivery' | 'Delivered';
  address: string;
  deliveryETA: string;
  orderNumber: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryDistanceKm?: number | null;
}

export interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: string;
}

export type AppTab = 'home' | 'cart' | 'orders' | 'profile' | 'admin';
