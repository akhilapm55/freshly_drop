/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home as HomeIcon,
  ShoppingCart,
  Package,
  User,
  Search,
  MapPin,
  Tag,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Filter,
  ShieldCheck,
  Smartphone,
  Maximize2,
  Minimize2,
  Trash2,
  ArrowLeft,
  Settings,
  Heart,
  ChevronRight,
  MapPinned,
  Plus,
  LogOut,
  Briefcase
} from 'lucide-react';

import { createShopifyCart } from './lib/shopify';
import SplashScreen from './components/SplashScreen';
import Logo from './components/Logo';
import ProductCard from './components/ProductCard';
import AdminDashboard from './components/AdminDashboard';
import { Product, CartItem, Order, AppTab, SavedAddress } from './types';
import { CATEGORIES, INSTANT_OFFERS } from './data';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { calculateDelivery } from './lib/delivery';
import { geocodeAddress, geocodeStructured, formatAddressParts } from './lib/geocode';
import { MAX_DELIVERY_KM, STORE_LOCATION, DELIVERY_ETA_TEXT } from './config/delivery';
import { isUpiEnabled, UPI } from './config/payment';
import { buildUpiUri, buildUpiQrDataUrl, isPlausibleUpiReference } from './lib/upi';
import AddressAutocomplete, { SelectedPlace } from './components/AddressAutocomplete';
import {
  fetchProducts,
  fetchOrders,
  createOrder,
  updateProductStock,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchSavedAddresses,
  upsertSavedAddress,
  deleteSavedAddress,
  submitPaymentReference,
  setPaymentStatus,
} from './lib/queries';

export default function App() {
  // Auth (user, role, sign-out) from the Supabase-backed context
  const { user, profile, isAdmin, isDelivery, isStaff, signOut } = useAuth();

  // Application Modes
  const [isSplashActive, setIsSplashActive] = useState(true);
  const [displayMode, setDisplayMode] = useState<'mobile' | 'full'>('mobile');
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  // Shared Core States (loaded from Supabase)
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Custom interactive user settings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [activePromoDiscount, setActivePromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccessMessage, setPromoSuccessMessage] = useState('');

  // Distance-based delivery charge (from the store location)
  const [landmark, setLandmark] = useState('');
  // Structured manual address (used when the customer types instead of searching)
  const [houseInput, setHouseInput] = useState('');
  const [streetInput, setStreetInput] = useState('');
  const [townInput, setTownInput] = useState('');
  const [locatedVia, setLocatedVia] = useState<'address' | 'landmark' | 'town' | ''>('');
  const [locatedPrecision, setLocatedPrecision] = useState<'exact' | 'approximate' | ''>('');
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'driving' | 'straight-line' | ''>('');
  const [calcLoading, setCalcLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Payment: how the customer chose to pay, and the UPI follow-up state
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [upiUri, setUpiUri] = useState('');
  const [upiQr, setUpiQr] = useState('');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [paymentRefDone, setPaymentRefDone] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Saved delivery addresses (Home / Office / custom) for the signed-in customer
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [saveLabel, setSaveLabel] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressBookError, setAddressBookError] = useState('');

  // Load products and the signed-in user's orders from Supabase.
  // Re-runs when the user changes (e.g. an admin signs in and should see all orders).
  const reloadData = async () => {
    setDataError('');
    try {
      const [prods, ords] = await Promise.all([fetchProducts(), fetchOrders()]);
      setProducts(prods);
      setOrders(ords);
    } catch (e: any) {
      setDataError(e?.message || 'Failed to load data from the server.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    setDataLoading(true);
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  // Saved addresses are per-user and only readable when signed in.
  useEffect(() => {
    if (!user?.id) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    fetchSavedAddresses()
      .then((rows) => {
        if (!cancelled) setSavedAddresses(rows);
      })
      .catch(() => {
        // Non-fatal: the customer can still type an address as before. This also
        // covers the case where supabase/saved-addresses.sql has not been run.
        if (!cancelled) setSavedAddresses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Lightweight orders-only refresh (used by the real-time subscription).
  const reloadOrders = async () => {
    try {
      setOrders(await fetchOrders());
    } catch {
      /* a transient refresh failure is non-fatal; next event will retry */
    }
  };

  // REAL-TIME ORDER TRACKING.
  // Subscribe to changes on the orders table so a status update made by the
  // admin appears on the customer's tracker instantly — no refresh needed.
  // Row-level security means each customer only receives their own orders.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => reloadOrders()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(product.stock, item.quantity + 1) }
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (!existing) return prevCart;
      if (existing.quantity === 1) {
        return prevCart.filter((item) => item.product.id !== product.id);
      }
      return prevCart.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Admin and Inventory Synchronizer Actions (persist to Supabase, admin-only via RLS)
  const handleUpdateStock = async (productId: string, newStock: number) => {
    // Optimistic local update for snappy UI
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    );
    // Sync quantities in current cart if stock falls below cart quantity
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.min(newStock, item.quantity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    try {
      await updateProductStock(productId, newStock);
    } catch (e: any) {
      setDataError(e?.message || 'Could not update stock. Reverting…');
      reloadData(); // Re-sync from server to undo the optimistic change
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
    try {
      await updateOrderStatus(orderId, status);
    } catch (e: any) {
      setDataError(e?.message || 'Could not update order status. Reverting…');
      reloadData();
    }
  };

  // Batch action: move a whole group of orders to the same status (pick/pack).
  const handleBulkUpdateStatus = async (orderIds: string[], status: Order['status']) => {
    if (orderIds.length === 0) return;
    const idSet = new Set(orderIds);
    setOrders((prev) => prev.map((o) => (idSet.has(o.id) ? { ...o, status } : o)));
    try {
      await bulkUpdateOrderStatus(orderIds, status);
    } catch (e: any) {
      setDataError(e?.message || 'Could not update the batch. Reverting…');
      reloadData();
    }
  };

  // "Reset" now re-syncs all data fresh from the server (non-destructive).
  const handleResetDatabase = () => {
    setCart([]);
    handleRemovePromo();
    setDataLoading(true);
    reloadData();
  };

  // Product catalogue management (admin-only via RLS). Add/edit await the DB
  // then re-sync; errors are re-thrown so the modal can show them inline.
  const handleAddProduct = async (product: Product) => {
    await createProduct(product);
    await reloadData();
  };

  const handleEditProduct = async (product: Product) => {
    await updateProduct(product);
    await reloadData();
  };

  const handleDeleteProduct = async (productId: string) => {
    // Optimistic removal + drop it from any cart it sits in
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    try {
      await deleteProduct(productId);
    } catch (e: any) {
      setDataError(e?.message || 'Could not delete product. Reverting…');
      reloadData();
    }
  };

  // Cart Totals calculation
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  // Delivery charge comes from the distance calculation (config-driven slabs).
  const hasDeliveryZone = deliveryAvailable && deliveryCharge != null;
  const deliveryFee = hasDeliveryZone ? (deliveryCharge as number) : 0;

  /**
   * The customer's delivery address for display purposes — the one being used
   * for this order, else their first saved address. Null when they have not
   * given one yet, so callers hide the row instead of showing a placeholder.
   */
  const displayAddress = useMemo(() => {
    const typed = addressInput.trim();
    if (typed) return typed;
    return savedAddresses[0]?.address?.trim() || null;
  }, [addressInput, savedAddresses]);

  // Typing a new address invalidates the previously computed location/charge.
  const handleAddressTextChange = (text: string) => {
    setAddressInput(text);
    setDeliveryLocation(null);
    setDeliveryAvailable(false);
    setDeliveryCharge(null);
    setDeliveryDistanceKm(null);
    setDeliveryMethod('');
    setDeliveryError('');
  };

  // Shared: given coordinates, compute distance + charge and update state.
  // `located` describes how those coordinates were obtained; it is cleared for
  // GPS / autocomplete / saved addresses, which are precise by construction.
  const computeDeliveryForCoords = async (
    lat: number,
    lng: number,
    located: { via: 'address' | 'landmark' | 'town' | ''; precision: 'exact' | 'approximate' | '' } = {
      via: '',
      precision: '',
    }
  ) => {
    setDeliveryLocation({ lat, lng });
    setLocatedVia(located.via);
    setLocatedPrecision(located.precision);
    setDeliveryError('');
    setCalcLoading(true);
    try {
      const result = await calculateDelivery({ lat, lng });
      setDeliveryDistanceKm(result.distanceKm);
      setDeliveryCharge(result.charge);
      setDeliveryAvailable(result.available);
      setDeliveryMethod(result.method);
      if (!result.available) {
        setDeliveryError(
          `Sorry, this location is about ${result.distanceKm} km away — outside our ${MAX_DELIVERY_KM} km delivery range.`
        );
      }
    } catch (e: any) {
      setDeliveryAvailable(false);
      setDeliveryCharge(null);
      setDeliveryDistanceKm(null);
      setDeliveryError(e?.message || 'Could not calculate delivery for this address.');
    } finally {
      setCalcLoading(false);
    }
  };

  // Customer selects an address suggestion → coordinates already known.
  const handleSelectAddress = async (place: SelectedPlace) => {
    setAddressInput(place.address);
    await computeDeliveryForCoords(place.lat, place.lng);
  };

  // Tapping a saved address fills the form and re-prices it. Coordinates are
  // stored with the address, so this skips geocoding entirely when present.
  const handleUseSavedAddress = async (saved: SavedAddress) => {
    setAddressInput(saved.address);
    setLandmark(saved.landmark || '');
    setAddressBookError('');
    if (saved.lat != null && saved.lng != null) {
      await computeDeliveryForCoords(saved.lat, saved.lng);
      return;
    }
    // Saved before coordinates were captured — fall back to geocoding the text.
    setCalcLoading(true);
    try {
      const { lat, lng } = await geocodeAddress(saved.address);
      await computeDeliveryForCoords(lat, lng);
    } catch (e: any) {
      setDeliveryError(e?.message || 'Could not locate that saved address.');
      setCalcLoading(false);
    }
  };

  // Store the currently-calculated address under a label (Home, Office, …).
  const handleSaveAddress = async () => {
    setAddressBookError('');
    setSavingAddress(true);
    try {
      const saved = await upsertSavedAddress({
        label: saveLabel,
        address: addressInput,
        landmark,
        lat: deliveryLocation?.lat ?? null,
        lng: deliveryLocation?.lng ?? null,
      });
      // Replace the same label in place; otherwise append.
      setSavedAddresses((prev) => {
        const rest = prev.filter((a) => a.id !== saved.id && a.label !== saved.label);
        return [...rest, saved];
      });
      setSaveLabel('');
    } catch (e: any) {
      setAddressBookError(e?.message || 'Could not save this address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteSavedAddress = async (id: string) => {
    setAddressBookError('');
    const previous = savedAddresses;
    setSavedAddresses((prev) => prev.filter((a) => a.id !== id)); // optimistic
    try {
      await deleteSavedAddress(id);
    } catch (e: any) {
      setSavedAddresses(previous); // roll back so the list matches the server
      setAddressBookError(e?.message || 'Could not remove that address.');
    }
  };

  // Use the device's GPS (asks for location permission).
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setDeliveryError('Location is not supported on this device. Enter your address instead.');
      return;
    }
    setDeliveryError('');
    setCalcLoading(true);
    // navigator.geolocation.getCurrentPosition(
    //   (pos) => {
    //     computeDeliveryForCoords(pos.coords.latitude, pos.coords.longitude);
    //   },
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('GPS coordinates:', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });

        computeDeliveryForCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setCalcLoading(false);
        setDeliveryError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please enter your address instead.'
            : 'Could not get your location. Please enter your address.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Editing any manual field invalidates a previously calculated charge.
  const handleManualFieldChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setDeliveryLocation(null);
    setDeliveryAvailable(false);
    setDeliveryCharge(null);
    setDeliveryDistanceKm(null);
    setDeliveryMethod('');
    setLocatedVia('');
    setLocatedPrecision('');
    setDeliveryError('');
  };

  // Customer filled in the manual address fields and pressed Calculate.
  const handleGeocodeTyped = async () => {
    if (!townInput.trim()) {
      setDeliveryError('Enter your town or city so we can locate you.');
      return;
    }
    if (!streetInput.trim() && !houseInput.trim() && !landmark.trim()) {
      setDeliveryError('Add a street address or a nearby landmark.');
      return;
    }
    setDeliveryError('');
    setCalcLoading(true);
    try {
      const located = await geocodeStructured({
        house: houseInput,
        street: streetInput,
        town: townInput,
        landmark,
      });
      // Store the address as the customer wrote it (the geocoder's formatted
      // string is often less useful to a delivery rider than the real details).
      const typed = formatAddressParts({ house: houseInput, street: streetInput, town: townInput });
      setAddressInput(landmark.trim() ? `${typed} (near ${landmark.trim()})` : typed);
      await computeDeliveryForCoords(located.lat, located.lng, {
        via: located.matchedOn,
        precision: located.precision,
      });
    } catch (e: any) {
      setDeliveryAvailable(false);
      setDeliveryCharge(null);
      setDeliveryDistanceKm(null);
      setDeliveryError(e?.message || 'Could not locate that address.');
      setCalcLoading(false);
    }
  };

  const tax = useMemo(() => {
    return Math.round(subtotal * 0.05); // 5% GST on organic food items
  }, [subtotal]);

  const discountAmount = useMemo(() => {
    return Math.round(subtotal * (activePromoDiscount / 100));
  }, [subtotal, activePromoDiscount]);

  const grandTotal = useMemo(() => {
    if (subtotal === 0) return 0;
    return Math.max(0, subtotal + deliveryFee + tax - discountAmount);
  }, [subtotal, deliveryFee, tax, discountAmount]);

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase().trim();
    if (code === 'FRESHRAIN') {
      if (subtotal < 249) {
        setPromoError('FRESHRAIN applies on cart value of ₹249 or more.');
        setPromoSuccessMessage('');
      } else {
        setActivePromoDiscount(20);
        setPromoSuccessMessage('Monsoon Farm Offer Applied! 20% Discount saved.');
        setPromoError('');
      }
    } else if (code === 'FIRSTDROP') {
      if (subtotal === 0) {
        setPromoError('Add items to your basket before applying this coupon.');
        setPromoSuccessMessage('');
      } else if (orders.length > 0) {
        // The customer already has past orders, so this is not their first purchase.
        setPromoError('FIRSTDROP is valid only on your very first order.');
        setPromoSuccessMessage('');
      } else {
        setActivePromoDiscount(10);
        setPromoSuccessMessage('Welcome! 10% first-order discount applied. 🌱');
        setPromoError('');
      }
    } else {
      setPromoError('Invalid coupon. Try using FRESHRAIN or FIRSTDROP.');
      setPromoSuccessMessage('');
    }
  };

  // Remove / clear an applied promo so the total reverts to the original amount
  const handleRemovePromo = () => {
    setActivePromoDiscount(0);
    setPromoCode('');
    setPromoError('');
    setPromoSuccessMessage('');
  };

  // Re-validate an applied coupon whenever the cart total changes. If items are
  // removed so the cart no longer meets the coupon's condition (e.g. FRESHRAIN's
  // ₹249 minimum, or the cart is emptied), the coupon is pulled automatically.
  useEffect(() => {
    if (activePromoDiscount <= 0) return;
    const code = promoCode.toUpperCase().trim();
    const stillValid = code === 'FRESHRAIN' ? subtotal >= 249 : subtotal > 0;
    if (!stillValid) {
      setActivePromoDiscount(0);
      setPromoCode('');
      setPromoSuccessMessage('');
      setPromoError(
        code === 'FRESHRAIN'
          ? 'FRESHRAIN removed — cart dropped below the ₹249 minimum.'
          : 'Coupon removed.'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  /** Admin confirms (or rejects) a payment after checking their bank/GPay app. */
  const handleSetPaymentStatus = async (orderId: string, status: Order['paymentStatus']) => {
    try {
      await setPaymentStatus(orderId, status);
      await reloadOrders();
    } catch (e: any) {
      setDataError(e?.message || 'Could not update the payment status.');
    }
  };

  /**
   * Customer reports the UPI reference (UTR) from their payment app.
   * This only records a CLAIM — the order stays unverified until an admin has
   * seen the money arrive, because a UPI deep link gives the site no callback.
   */
  const handleSubmitPaymentRef = async () => {
    if (!placedOrder) return;
    const ref = paymentRefInput.trim();
    if (!isPlausibleUpiReference(ref)) {
      setPaymentError('Enter the reference / UTR number shown in your payment app.');
      return;
    }
    setPaymentError('');
    setSubmittingRef(true);
    try {
      const applied = await submitPaymentReference(placedOrder.id, ref);
      if (!applied) {
        setPaymentError('This order has already been verified, or is no longer awaiting payment.');
        return;
      }
      setPaymentRefDone(true);
      await reloadOrders();
    } catch (e: any) {
      setPaymentError(e?.message || 'Could not save that reference. Please try again.');
    } finally {
      setSubmittingRef(false);
    }
  };

const handleShopifyCheckout = async () => {
  if (cart.length === 0 || isPlacingOrder) return;

  if (!user) {
    setDataError('Please log in before checkout.');
    return;
  }

  setIsPlacingOrder(true);
  setDataError('');

  try {
    const lines = cart.map((item: CartItem) => ({
      merchandiseId: item.product.shopifyVariantId,
      quantity: item.quantity,
    }));

const checkoutUrl = await createShopifyCart(lines, [
  {
    key: 'supabase_user_id',
    value: user.id,
  },
]);
    window.location.href = checkoutUrl;
    
  } catch (e: any) {
    setDataError(
      e?.message || 'Could not start Shopify checkout. Please try again.'
    );
    setIsPlacingOrder(false);
  }
};

  // Final confirmation of Checkout — writes the order to Supabase.
  // A database trigger (deduct_stock_on_order) reduces product stock atomically.
  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !user || isPlacingOrder) return;
    if (!hasDeliveryZone) {
      setDataError('Please set your delivery distance before placing the order.');
      return;
    }
    setIsPlacingOrder(true);
    setDataError('');

    try {
      const order = await createOrder({
        userId: user.id,
        items: cart,
        subtotal,
        deliveryFee, // frozen charge — future slab changes won't affect this order
        tax,
        total: grandTotal,
        address: addressInput,
        deliveryETA: DELIVERY_ETA_TEXT,
        orderNumber: 'FD-' + Math.floor(100000 + Math.random() * 900000),
        deliveryLat: deliveryLocation?.lat ?? null,
        deliveryLng: deliveryLocation?.lng ?? null,
        deliveryDistanceKm: deliveryDistanceKm,
        paymentMethod: isUpiEnabled ? paymentMethod : 'cod',
      });

      setPlacedOrder(order);
      setPaymentRefInput('');
      setPaymentRefDone(false);
      setPaymentError('');

      // For UPI, prepare the deep link and a QR of the same URI (desktop has no
      // handler for upi://, so the QR is the only way to pay from a computer).
      if (isUpiEnabled && paymentMethod === 'upi') {
        try {
          const uri = buildUpiUri({ amount: order.total, orderNumber: order.orderNumber });
          setUpiUri(uri);
          setUpiQr(await buildUpiQrDataUrl(uri));
        } catch (e: any) {
          setUpiUri('');
          setUpiQr('');
          setPaymentError(e?.message || 'Could not prepare the UPI payment.');
        }
      } else {
        setUpiUri('');
        setUpiQr('');
      }

      // Refresh orders + products (stock changed via the DB trigger)
      await reloadData();

      setShowCheckoutSuccess(true);
      setCart([]);
      handleRemovePromo(); // Reset any applied coupon for the next basket
      // Reset delivery selection for the next basket
      setDeliveryLocation(null);
      setDeliveryAvailable(false);
      setDeliveryCharge(null);
      setDeliveryDistanceKm(null);
      setDeliveryMethod('');
      setLandmark('');
      setLandmark('');
    } catch (e: any) {
      setDataError(e?.message || 'Could not place your order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Filtered Products for Customer Listing
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <>
      {/* SPLASH SCREEN STAGE */}
      <AnimatePresence>
        {isSplashActive && (
          <SplashScreen onComplete={() => setIsSplashActive(false)} />
        )}
      </AnimatePresence>

      {/* VIEW CONTROL TOOLBAR (Only shown on Desktop screens to preview mobile layout easily) */}
      <div className="hidden lg:flex fixed top-4 right-4 z-40 bg-white/90 backdrop-blur-md rounded-xl p-2.5 border border-gray-200 shadow-md gap-2 items-center text-xs">
        <span className="font-semibold text-[#222222] select-none flex items-center gap-1">
          <Smartphone className="w-4 h-4 text-[#1B7A36]" /> Preview Viewport:
        </span>
        <button
          onClick={() => setDisplayMode('mobile')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
            displayMode === 'mobile'
              ? 'bg-[#1B7A36] text-white shadow-xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          id="toggle-pwa-view"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Phone Width</span>
        </button>
        <button
          onClick={() => setDisplayMode('full')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
            displayMode === 'full'
              ? 'bg-[#1B7A36] text-white shadow-xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          id="toggle-full-view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Full Wide Screen</span>
        </button>
      </div>

      {/* MAIN CONTAINER FRAME */}
      <div className="min-h-screen bg-brand-bg select-none transition-colors duration-300">
        {displayMode === 'mobile' ? (
          /* PHONE SIMULATOR SHELL WRAPPER */
          <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen lg:py-6 relative overflow-hidden bg-radial from-emerald-50 via-[#F8F8F8] to-amber-50">
            {/* Animated background highlights */}
            <div className="absolute top-10 left-10 w-96 h-96 bg-[#1B7A36]/5 rounded-full filter blur-3xl -z-1" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#D9AB3B]/5 rounded-full filter blur-3xl -z-1" />

            {/* Left informational sidebar panel (only visible on large displays) */}
            <div className="hidden lg:flex flex-col max-w-sm mr-8 text-left space-y-6">
              <Logo size="md" showText={true} className="self-start text-left" />
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-[#222222] tracking-tight">Farm-Fresh Organic Direct</h3>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    Experiencing the next-gen quick-commerce interface for <strong>Freshly Drop</strong>. Kerala-inspired, organic certified, delivered direct from local cooperatives.
                  </p>
                </div>

                {/* Coupons Guide */}
                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-xs space-y-3.5">
                  <span className="text-[10px] font-semibold text-[#1B7A36] uppercase tracking-wide block bg-emerald-50 px-2 py-0.5 rounded-sm w-fit">
                    Active Coupon Codes
                  </span>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm font-bold text-[10px] font-mono select-all">FRESHRAIN</code>
                        <span className="text-slate-500 text-[11px] block mt-0.5">20% off • min cart ₹249</span>
                      </div>
                      <span className="font-semibold text-[#1B7A36]">20% OFF</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-gray-50 pt-1.5">
                      <div>
                        <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm font-bold text-[10px] font-mono select-all">FIRSTDROP</code>
                        <span className="text-slate-500 text-[11px] block mt-0.5">10% off your first order</span>
                      </div>
                      <span className="font-semibold text-[#D9AB3B]">10% OFF</span>
                    </div>
                  </div>
                </div>

                {/* Kerala Heritage Tip */}
                <div className="p-3 bg-[#1B7A36]/5 rounded-xl border border-[#1B7A36]/10 text-xs">
                  <p className="text-slate-700 italic">
                    "Rooted in Freshness. Our primary crops: fresh Malabar de-husked coconut, true green cardamoms from Wayanad and organic cold-pressed oil, are packed in biodegradable palm fibers."
                  </p>
                </div>
              </div>
            </div>

            {/* APP FRAME — on desktop this is styled as a phone-width column */}
            <div className="w-full max-w-md lg:h-[840px] bg-white rounded-none lg:rounded-[44px] shadow-2xl overflow-hidden border-0 lg:border-[12px] lg:border-[#1E293B] flex flex-col relative">
              {/* SCROLLING CONTENT */}
              <div className="flex-1 overflow-y-auto bg-brand-bg flex flex-col relative pb-20">
                {renderTabContent()}
              </div>

              {/* Bottom Nav inside Phone Frame */}
              <div className="bg-white border-t border-gray-100 absolute bottom-0 inset-x-0 h-16 flex items-center justify-around px-2 shadow-lg z-30">
                {renderBottomTabs()}
              </div>
            </div>
          </div>
        ) : (
          /* FULL SCREEN GENERAL DESKTOP LAYOUT WITH FLUID COLLAPSE */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-h-screen pb-24">
            <header className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4 mb-6">
              <Logo size="sm" showText={true} />
              
              <div className="flex items-center gap-4 text-xs font-bold">
                {/* Only shown once the customer has actually given an address */}
                {displayAddress && (
                  <div className="flex items-center gap-1 bg-[#1B7A36]/5 text-[#1B7A36] px-3 py-1.5 rounded-xl max-w-xs">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate" title={displayAddress}>Delivering to {displayAddress}</span>
                  </div>
                )}
              </div>
            </header>

            <div className="flex-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              {renderTabContent()}
            </div>

            {/* Float Menu or Bottom sticky for Wide Experience */}
            <div className="fixed bottom-6 inset-x-0 max-w-xl mx-auto bg-white/95 backdrop-blur-md border border-gray-100 h-16 rounded-full flex items-center justify-around px-6 shadow-2xl z-40">
              {renderBottomTabs()}
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS CHECKOUT NOTIFICATION OVERLAY */}
      <AnimatePresence>
        {showCheckoutSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setShowCheckoutSuccess(false)}
            />

            {/* Confetti box pop */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              className="bg-white rounded-3xl p-6 h-auto w-full max-w-sm text-center shadow-2xl border border-gray-100 relative z-10 flex flex-col items-center gap-4"
            >
              {/* Green active badge with glowing outer ring */}
              <div className="w-16 h-16 bg-[#1B7A36]/10 rounded-full flex items-center justify-center text-[#1B7A36] relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-[#1B7A36]/5"
                />
                <CheckCircle className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div>
                <span className="text-[10px] text-[#D9AB3B] font-semibold uppercase tracking-wide block">Harvest Order Seeded!</span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">Order Placed Successfully</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Thank you! We have received your order and are packing it now. You can follow its
                  progress under Orders.
                </p>
              </div>

              {/* Brief invoice info */}
              <div className="w-full bg-gray-50 rounded-2xl p-3 border border-gray-100 text-xs text-left text-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order number:</span>
                  <span className="font-mono font-bold">{orders[0]?.orderNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated delivery:</span>
                  <span className="font-bold text-[#1B7A36]" style={{ color: '#1B7A36' }}>{orders[0]?.deliveryETA || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="font-bold">₹{placedOrder?.total ?? grandTotal}</span>
                </div>
              </div>

              {/* UPI PAYMENT STEP — deep link on mobile, QR on desktop */}
              {placedOrder?.paymentMethod === 'upi' && upiUri && !paymentRefDone && (
                <div className="w-full space-y-3 text-left">
                  <a
                    href={upiUri}
                    className="w-full py-3 bg-[#1B7A36] text-white font-semibold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: '#1B7A36' }}
                    id="upi-pay-now"
                  >
                    Pay ₹{placedOrder.total} with UPI
                  </a>

                  {upiQr && (
                    <div className="flex flex-col items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-gray-400 text-center">
                        On a computer? Scan this with GPay / PhonePe
                      </span>
                      <img src={upiQr} alt="UPI payment QR code" className="w-36 h-36 rounded-xl border border-gray-100" />
                    </div>
                  )}

                  <div className="pt-1 border-t border-gray-100 space-y-1.5">
                    <span className="text-[10px] font-semibold text-gray-600 block">
                      Paid already? Enter the reference number
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={paymentRefInput}
                        onChange={(e) => setPaymentRefInput(e.target.value)}
                        placeholder="UPI reference / UTR"
                        className="flex-1 min-w-0 text-[11px] font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-lg px-2 py-2 outline-hidden"
                        id="upi-reference-input"
                      />
                      <button
                        onClick={handleSubmitPaymentRef}
                        disabled={submittingRef || !paymentRefInput.trim()}
                        className="px-3 py-2 bg-[#1B7A36] text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        id="upi-reference-submit"
                      >
                        {submittingRef ? 'Saving…' : 'Submit'}
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-relaxed">
                      We check every payment by hand before dispatch, so please send the reference.
                    </p>
                  </div>

                  {paymentError && (
                    <p className="text-[10px] text-red-500 font-semibold">{paymentError}</p>
                  )}
                </div>
              )}

              {/* Reference received — still not "paid" until an admin verifies */}
              {placedOrder?.paymentMethod === 'upi' && paymentRefDone && (
                <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-left">
                  <span className="text-[11px] font-bold text-emerald-700 block">
                    Reference received
                  </span>
                  <span className="text-[10px] text-emerald-600 leading-relaxed block mt-0.5">
                    We will confirm your payment shortly and start packing your order.
                  </span>
                </div>
              )}

              <button
                onClick={() => {
                  setShowCheckoutSuccess(false);
                  setActiveTab('orders');
                }}
                className="w-full py-3 bg-[#1B7A36] text-white hover:bg-[#1B7A36]/90 font-semibold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: '#1B7A36' }}
                id="view-orders-after-checkout"
              >
                <span>Track Harvest Progress</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  // BOTTOM NAVIGATION COMPONENT
  function renderBottomTabs() {
    return (
      <>
        {/* HOME TAB */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex flex-col items-center justify-center gap-0.5 relative py-1 flex-1 cursor-pointer group"
          id="nav-home-tab"
        >
          <HomeIcon
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'home' ? 'text-brand-green-primary' : 'text-gray-400 group-hover:text-gray-600'
            }`}
            style={{ color: activeTab === 'home' ? '#1B7A36' : undefined }}
          />
          <span
            className="text-[10px] font-bold tracking-tight transition-all"
            style={{ color: activeTab === 'home' ? '#1B7A36' : '#9CA3AF' }}
          >
            Home
          </span>
          {activeTab === 'home' && (
            <motion.div
              layoutId="bottom-nav-indicator"
              className="absolute bottom-[-1px] w-5 h-1 rounded-t-sm"
              style={{ backgroundColor: '#1B7A36' }}
            />
          )}
        </button>

        {/* CART TAB */}
        <button
          onClick={() => setActiveTab('cart')}
          className="flex flex-col items-center justify-center gap-0.5 relative py-1 flex-1 cursor-pointer group"
          id="nav-cart-tab"
        >
          <div className="relative">
            <ShoppingCart
              className={`w-5 h-5 transition-colors duration-200 ${
                activeTab === 'cart' ? 'text-brand-green-primary' : 'text-gray-400 group-hover:text-gray-600'
              }`}
              style={{ color: activeTab === 'cart' ? '#1B7A36' : undefined }}
            />
            {cart.length > 0 && (
              <span 
                className="absolute -top-1.5 -right-1.5 text-[9px] text-white font-semibold rounded-full w-4.5 h-4.5 flex items-center justify-center ring-2 ring-white animate-pulse"
                style={{ backgroundColor: '#D9AB3B' }}
              >
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          <span
            className="text-[10px] font-bold tracking-tight transition-all"
            style={{ color: activeTab === 'cart' ? '#1B7A36' : '#9CA3AF' }}
          >
            Cart
          </span>
          {activeTab === 'cart' && (
            <motion.div
              layoutId="bottom-nav-indicator"
              className="absolute bottom-[-1px] w-5 h-1 rounded-t-sm"
              style={{ backgroundColor: '#1B7A36' }}
            />
          )}
        </button>

        {/* ORDERS TAB */}
        <button
          onClick={() => setActiveTab('orders')}
          className="flex flex-col items-center justify-center gap-0.5 relative py-1 flex-1 cursor-pointer group"
          id="nav-orders-tab"
        >
          <div className="relative">
            <Package
              className={`w-5 h-5 transition-colors duration-200 ${
                activeTab === 'orders' ? 'text-brand-green-primary' : 'text-gray-400 group-hover:text-gray-600'
              }`}
              style={{ color: activeTab === 'orders' ? '#1B7A36' : undefined }}
            />
            {orders.some((o) => o.status !== 'Delivered') && (
              <span 
                className="absolute top-0 right-0 w-2 h-2 rounded-full ring-1 ring-white"
                style={{ backgroundColor: '#D9AB3B' }}
              />
            )}
          </div>
          <span
            className="text-[10px] font-bold tracking-tight transition-all"
            style={{ color: activeTab === 'orders' ? '#1B7A36' : '#9CA3AF' }}
          >
            Orders
          </span>
          {activeTab === 'orders' && (
            <motion.div
              layoutId="bottom-nav-indicator"
              className="absolute bottom-[-1px] w-5 h-1 rounded-t-sm"
              style={{ backgroundColor: '#1B7A36' }}
            />
          )}
        </button>

        {/* PROFILE TAB */}
        <button
          onClick={() => setActiveTab('profile')}
          className="flex flex-col items-center justify-center gap-0.5 relative py-1 flex-1 cursor-pointer group"
          id="nav-profile-tab"
        >
          <User
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'profile' || activeTab === 'admin' ? 'text-brand-green-primary' : 'text-gray-400 group-hover:text-gray-600'
            }`}
            style={{ color: (activeTab === 'profile' || activeTab === 'admin') ? '#1B7A36' : undefined }}
          />
          <span
            className="text-[10px] font-bold tracking-tight transition-all"
            style={{ color: (activeTab === 'profile' || activeTab === 'admin') ? '#1B7A36' : '#9CA3AF' }}
          >
            Profile
          </span>
          {(activeTab === 'profile' || activeTab === 'admin') && (
            <motion.div
              layoutId="bottom-nav-indicator"
              className="absolute bottom-[-1px] w-5 h-1 rounded-t-sm"
              style={{ backgroundColor: '#1B7A36' }}
            />
          )}
        </button>
      </>
    );
  }

  // CORE TAB CONTENTS ROUTER
  function renderTabContent() {
    switch (activeTab) {
      case 'home':
        return renderHomeTab();
      case 'cart':
        return renderCartTab();
      case 'orders':
        return renderOrdersTab();
      case 'profile':
        return renderProfileTab();
      case 'admin':
        if (!isStaff) return renderProfileTab(); // Guard: only admin or delivery staff
        return (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setActiveTab('profile')}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 cursor-pointer"
                id="admin-to-profile-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm text-[#222222]">Back to Profile</span>
            </div>

            <AdminDashboard
              products={products}
              orders={orders}
              onUpdateStock={handleUpdateStock}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onResetDatabase={handleResetDatabase}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onSetPaymentStatus={handleSetPaymentStatus}
              mode={isAdmin ? 'admin' : 'delivery'}
              currentUserId={user?.id ?? ''}
            />
          </div>
        );
      default:
        return null;
    }
  }

  // TAB 1: HOME PAGE (SHOPPING INTERFACE)
  function renderHomeTab() {
    return (
      <div className="flex flex-col flex-1">
        {/* PREMIUM SCENIC HEADER */}
        <div className="hero-gradient text-white p-4 pt-4 pb-6 space-y-3 relative overflow-hidden rounded-b-[24px]">
          
          {/* Aesthetic background curves representing Kerala banana leaf patterns */}
          <div className="absolute top-[-30%] right-[-10%] w-48 h-48 bg-white/5 rounded-full transform rotate-45 scale-x-125 select-none pointer-events-none" />
          <div className="absolute bottom-[-50px] left-[-30px] w-36 h-36 bg-white/5 rounded-full select-none pointer-events-none" />

          {/* Location details badge & App header */}
          <div className="flex justify-between items-center relative z-10">
            {/* Shown only once the customer has given a delivery address */}
            {displayAddress ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-white/10 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-[9px] uppercase tracking-wide text-white/80 font-semibold block">Delivering to:</span>
                  <span className="text-xs font-bold truncate max-w-[190px] block" title={displayAddress}>
                    {displayAddress}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-white/10 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-[9px] uppercase tracking-wide text-white/80 font-semibold block">Delivering from</span>
                  <span className="text-xs font-bold truncate max-w-[190px] block">{STORE_LOCATION.label}</span>
                </div>
              </div>
            )}

            {/* Serviceable radius — a real fact rather than a fixed time claim */}
            <div className="bg-white text-[#1B7A36] font-bold text-[9px] uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 fill-current" />
              <span>Within {MAX_DELIVERY_KM} km</span>
            </div>
          </div>

          {/* Static Beautiful Brand presentation */}
          <div className="pt-3 text-center pb-2 relative z-10 flex flex-col items-center">
            {/* Brand logo (uses public/logo.png, falls back to the built-in mark) */}
            <Logo size="sm" showText={false} className="bg-white p-1.5 rounded-full shadow-md mb-1" />
            <h1 className="brand-font text-2xl font-bold tracking-wide flex items-center gap-2">
              <span>Freshly Drop</span>
            </h1>
            <p className="text-xs text-amber-200 mt-0.5 tracking-wide font-medium">
              "Organic Fresh. Delivered Daily"
            </p>
          </div>

          {/* HIGH POLISHED SEARCH ENGINE BAR */}
          <div className="relative pt-2 z-10">
            <Search className="absolute left-3.5 top-5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search farm organic coconuts, spices, red matta rice..."
              className="w-full bg-white text-gray-950 placeholder-gray-400 text-xs pl-10 pr-4 py-3 rounded-xl border-none outline-hidden focus:ring-2 focus:ring-[#D9AB3B] font-medium shadow-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="product-search-bar"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-5 text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* PROMO CAROUSEL SCROLLER */}
        <div className="p-4 overflow-x-auto flex gap-4 scrollbar-hide">
          {INSTANT_OFFERS.map((offer) => (
            <div
              key={offer.id}
              className="flex-shrink-0 w-72 bg-white rounded-2xl border border-gray-100 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 bg-[#D9AB3B] text-white text-[9px] uppercase font-mono px-2.5 py-1 rounded-bl-xl font-bold">
                {offer.badge}
              </div>
              <div className="space-y-1">
                <span className="text-[#1B7A36] font-bold text-lg block">{offer.discount}</span>
                <h4 className="font-sans font-bold text-xs text-gray-900 leading-tight">{offer.title}</h4>
                <p className="text-[10px] text-gray-500">{offer.description}</p>
              </div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                <span className="text-[9px] font-mono text-gray-400 uppercase">APPLY CODE:</span>
                <button
                  onClick={() => {
                    setPromoCode(offer.code);
                    setActiveTab('cart');
                  }}
                  className="px-2.5 py-1 bg-[#1B7A36]/5 text-[#1B7A36] text-[10px] uppercase font-bold tracking-wide rounded-lg border border-[#1B7A36]/10 hover:bg-[#1B7A36]/10 cursor-pointer"
                  style={{ color: '#1B7A36' }}
                >
                  {offer.code}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ORGANIC CROP SPECIES CATEGORY FILTERS */}
        <div className="px-4 py-2">
          <h3 className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-2.5">Explore Categories</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`py-2 px-4 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.name
                    ? 'bg-[#1B7A36] text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow-3xs'
                }`}
                style={{ backgroundColor: selectedCategory === cat.name ? '#1B7A36' : undefined }}
                id={`category-filter-${cat.name.replace(/\s+/g, '-')}`}
              >
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN BODY: PRODUCT GRID */}
        <div className="p-4 space-y-4 flex-1">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
              {selectedCategory} Crops ({filteredProducts.length})
            </h2>
            
            {searchQuery && (
              <span className="text-[10px] font-mono text-gray-400">Search Filter Live</span>
            )}
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-9 h-9 border-4 border-[#1B7A36]/20 border-t-[#1B7A36] rounded-full animate-spin" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Loading fresh produce…</span>
            </div>
          ) : dataError ? (
            <div className="bg-white rounded-2xl border border-red-100 p-8 text-center space-y-3 shadow-xs">
              <span className="text-3xl block">⚠️</span>
              <h3 className="font-bold text-gray-900 text-sm">Couldn't load produce</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">{dataError}</p>
              <button
                onClick={() => { setDataLoading(true); reloadData(); }}
                className="px-3 py-1.5 bg-[#1B7A36] text-white rounded-lg text-xs font-bold cursor-pointer"
                style={{ backgroundColor: '#1B7A36' }}
              >
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3 shadow-xs">
              <span className="text-3xl block">🍋</span>
              <h3 className="font-bold text-gray-900 text-sm">Harvest Item Missing</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                No organic items matched your search query "{searchQuery}". Check back shortly or reset our crops roster in the Admin portal.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-3 py-1.5 bg-[#1B7A36] text-white rounded-lg text-xs font-bold cursor-pointer"
                style={{ backgroundColor: '#1B7A36' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const cartQty = cart.find((item) => item.product.id === p.id)?.quantity || 0;
                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    cartQuantity={cartQty}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Quick bottom-right Floating Cart Indicator if Cart is not empty */}
        {cart.length > 0 && activeTab !== 'cart' && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-20 inset-x-4 max-w-sm mx-auto bg-[#1B7A36] text-white p-3 rounded-xl shadow-lg flex justify-between items-center z-40 cursor-pointer"
            onClick={() => setActiveTab('cart')}
            style={{ backgroundColor: '#1B7A36' }}
            id="floating-cart-indicator"
          >
            <div className="flex items-center gap-2">
              <span className="bg-[#D9AB3B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
              <span className="text-xs font-semibold">| ₹{grandTotal} Est. total</span>
            </div>
            
            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#E8C35A]">
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // TAB 2: CART PAGE (CHECKOUT WORKFLOW)
  function renderCartTab() {
    return (
      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="serif text-xl font-bold text-[#222222]">Your Harvest Basket</h2>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                id="clear-cart-btn"
              >
                <Trash2 className="w-3.5 h-3.5" /> Empty Basket
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            /* EMPTY STATE */
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-[#1B7A36]/5 rounded-full flex items-center justify-center text-[#1B7A36] mx-auto">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-[#222222]">Basket is empty</h3>
                <p className="text-xs text-gray-500">Pick beautiful sun-ripened organic fruits, oils, and spices on our shop page!</p>
              </div>
              <button
                onClick={() => setActiveTab('home')}
                className="px-4 py-2 bg-[#1B7A36] text-white text-xs font-semibold uppercase tracking-wide rounded-xl shadow-xs cursor-pointer"
                style={{ backgroundColor: '#1B7A36' }}
                id="cart-shop-now-btn"
              >
                Shop Fresh Produce
              </button>
            </div>
          ) : (
            /* BASKET LIST OF ITEMS */
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-3xs divide-y divide-gray-50">
                {cart.map((item) => (
                  <div key={item.product.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        referrerPolicy="no-referrer"
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-11 h-11 rounded-lg object-cover"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-[#222222]">{item.product.name}</h4>
                        <span className="text-[10px] text-gray-500 font-medium">
                          ₹{item.product.price} • {item.product.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-800">
                        ₹{item.product.price * item.quantity}
                      </span>

                      {/* Micro inline adder / subtraher */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5" style={{ color: '#1B7A36' }}>
                        <button
                          onClick={() => handleRemoveFromCart(item.product)}
                          className="p-1 hover:bg-white rounded-sm text-gray-600 transition-colors"
                          id={`cart-dec-${item.product.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                        <span className="text-xs font-semibold px-2.5 text-gray-900 select-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleAddToCart(item.product)}
                          className="p-1 hover:bg-white rounded-sm text-gray-600 transition-colors"
                          id={`cart-inc-${item.product.id}`}
                        >
                          <Plus className="w-3.5 h-3.5 text-[#1B7A36]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DELIVERY LOCATION + DISTANCE-BASED CHARGE */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-3xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-[#1B7A36]" />
                  <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Delivery Location</span>
                </div>

                {/* SAVED ADDRESSES — tap one to deliver there instead of retyping */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide block">Deliver to a saved address</span>
                    <div className="flex flex-wrap gap-1.5">
                      {savedAddresses.map((saved) => {
                        const isOffice = /office|work/i.test(saved.label);
                        return (
                          <div
                            key={saved.id}
                            className="group flex items-center gap-1 bg-gray-50 border border-gray-200 hover:border-[#1B7A36]/40 rounded-xl pl-2 pr-1 py-1.5 transition-all"
                          >
                            <button
                              onClick={() => handleUseSavedAddress(saved)}
                              disabled={calcLoading}
                              className="flex items-center gap-1.5 cursor-pointer disabled:opacity-60 max-w-[150px]"
                              title={saved.address}
                              id={`saved-address-${saved.id}`}
                            >
                              {isOffice ? (
                                <Briefcase className="w-3 h-3 text-[#1B7A36] shrink-0" />
                              ) : (
                                <HomeIcon className="w-3 h-3 text-[#1B7A36] shrink-0" />
                              )}
                              <span className="text-[10px] font-semibold text-[#222222] truncate">{saved.label}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSavedAddress(saved.id)}
                              className="p-0.5 rounded-md hover:bg-red-50 cursor-pointer"
                              aria-label={`Remove saved address ${saved.label}`}
                              id={`delete-saved-address-${saved.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-gray-300 group-hover:text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUseLocation}
                  disabled={calcLoading}
                  className="w-full py-2.5 bg-[#1B7A36]/5 text-[#1B7A36] border border-[#1B7A36]/20 hover:bg-[#1B7A36]/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-60"
                  id="use-location-btn"
                >
                  <MapPin className="w-3.5 h-3.5" /> Use my current location
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">or search address</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <AddressAutocomplete
                  value={addressInput}
                  onChange={handleAddressTextChange}
                  onSelect={handleSelectAddress}
                  placeholder="Search your address…"
                  id="delivery-address-input"
                />

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">or type it in</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* MANUAL ADDRESS — structured so the geocoder gets clean signals */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={houseInput}
                    onChange={(e) => handleManualFieldChange(setHouseInput)(e.target.value)}
                    placeholder="House / flat / building name"
                    className="w-full text-xs font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2.5 outline-hidden"
                    id="delivery-house-input"
                  />
                  <input
                    type="text"
                    value={streetInput}
                    onChange={(e) => handleManualFieldChange(setStreetInput)(e.target.value)}
                    placeholder="Street / road / area"
                    className="w-full text-xs font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2.5 outline-hidden"
                    id="delivery-street-input"
                  />
                  <input
                    type="text"
                    value={townInput}
                    onChange={(e) => handleManualFieldChange(setTownInput)(e.target.value)}
                    placeholder="Town / city"
                    className="w-full text-xs font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2.5 outline-hidden"
                    id="delivery-town-input"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => handleManualFieldChange(setLandmark)(e.target.value)}
                      placeholder="Nearby landmark (optional)"
                      className="flex-1 min-w-0 text-xs font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2.5 outline-hidden"
                      id="delivery-landmark-input"
                    />
                    <button
                      onClick={handleGeocodeTyped}
                      disabled={calcLoading}
                      className="px-3 py-2 text-white text-[11px] font-semibold uppercase tracking-wide rounded-xl cursor-pointer active:scale-95 transition-all disabled:opacity-60 flex items-center gap-1.5 shrink-0"
                      style={{ backgroundColor: '#1B7A36' }}
                      id="calc-distance-btn"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Calculate
                    </button>
                  </div>
                  <span className="text-[9px] text-gray-400 block leading-relaxed">
                    A landmark helps us find you when the street address alone is not on the map.
                  </span>
                </div>

                {calcLoading && (
                  <p className="text-[10px] text-gray-500 font-semibold flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-[#1B7A36]/30 border-t-[#1B7A36] rounded-full animate-spin" />
                    Calculating delivery…
                  </p>
                )}

                {/* Result: distance + charge */}
                {!calcLoading && hasDeliveryZone && deliveryDistanceKm != null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {deliveryDistanceKm} km {deliveryMethod === 'straight-line' ? '(approx)' : ''}
                      </span>
                      <span className="text-xs font-bold text-[#1B7A36]">₹{deliveryCharge} delivery</span>
                    </div>

                    {/* Say which part of the address placed them, and warn when vague */}
                    {locatedVia === 'landmark' && (
                      <p className="text-[10px] text-gray-500 font-medium">
                        Located using your landmark — “{landmark.trim()}”.
                      </p>
                    )}
                    {(locatedPrecision === 'approximate' || locatedVia === 'town') && (
                      <p className="text-[10px] text-amber-600 font-semibold leading-relaxed">
                        We could only place you near the centre of {townInput.trim() || 'your town'}, so
                        this charge is an estimate. Add a landmark for an accurate one.
                      </p>
                    )}
                  </div>
                )}

                {deliveryError && <p className="text-[10px] text-red-500 font-semibold">{deliveryError}</p>}

                {/* SAVE THIS ADDRESS — only once we have a located address to store */}
                {user && deliveryLocation && addressInput.trim() && (
                  <div className="pt-1 border-t border-gray-100 space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide block">Save this address for next time</span>
                    <div className="flex gap-1.5">
                      {['Home', 'Office'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setSaveLabel(preset)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                            saveLabel === preset
                              ? 'bg-[#1B7A36]/10 border-[#1B7A36]/40 text-[#1B7A36]'
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                          id={`save-label-preset-${preset.toLowerCase()}`}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={saveLabel}
                        onChange={(e) => setSaveLabel(e.target.value)}
                        placeholder="or a name…"
                        maxLength={24}
                        className="flex-1 min-w-0 text-[11px] font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-lg px-2 py-1.5 outline-hidden"
                        id="save-address-label-input"
                      />
                      <button
                        onClick={handleSaveAddress}
                        disabled={savingAddress || !saveLabel.trim()}
                        className="px-2.5 py-1.5 bg-[#1B7A36] text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        id="save-address-btn"
                      >
                        {savingAddress ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    {addressBookError && (
                      <p className="text-[10px] text-red-500 font-semibold">{addressBookError}</p>
                    )}
                  </div>
                )}

                <span className="text-[9px] text-gray-400 block">
                  Delivery is charged by road distance from {STORE_LOCATION.label} • up to {MAX_DELIVERY_KM} km
                </span>
              </div>

              {/* BRAND PROMO COUPON CODE BLOCK */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-3xs space-y-3">
                <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide block">Apply Farm Voucher</span>

                {activePromoDiscount > 0 ? (
                  /* APPLIED STATE — show the active coupon with a Remove option */
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[#1B7A36]" />
                      <div>
                        <code className="text-xs font-mono font-bold text-[#1B7A36] uppercase">{promoCode || 'COUPON'}</code>
                        <span className="text-[9px] text-emerald-600 font-bold block">
                          {activePromoDiscount}% discount applied
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleRemovePromo}
                      className="px-3 py-1.5 bg-white border border-red-200 text-red-500 font-semibold text-[10px] uppercase tracking-wide rounded-lg hover:bg-red-50 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      id="remove-promo-btn"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2 font-mono text-center font-bold text-xs placeholder:normal-case placeholder:font-sans uppercase text-gray-800"
                      placeholder="Enter Coupon code..."
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      id="promo-code-input"
                    />
                    <button
                      onClick={handleApplyPromo}
                      className="px-4 py-2 bg-[#D9AB3B] hover:bg-[#D9AB3B]/90 text-white font-semibold text-xs uppercase tracking-wide rounded-xl transition-all active:scale-95 cursor-pointer"
                      style={{ backgroundColor: '#D9AB3B' }}
                      id="apply-promo-btn"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {promoError && (
                  <p className="text-[10px] text-red-500 font-bold">{promoError}</p>
                )}
                {promoSuccessMessage && (
                  <p className="text-[10px] text-emerald-600 font-bold">{promoSuccessMessage}</p>
                )}
              </div>

              {/* INVOICE BILL BREAKDOWN */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-3xs text-xs space-y-2">
                <h3 className="font-semibold text-gray-900 border-b border-gray-50 pb-2">Harvest billing summary:</h3>
                
                <div className="flex justify-between items-center text-gray-500">
                  <span>Crops subtotal:</span>
                  <span className="font-semibold text-[#222222]">₹{subtotal}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600">
                    <span>Coupon savings{promoCode ? ` (${promoCode.toUpperCase()})` : ''}:</span>
                    <span className="font-bold">-₹{discountAmount}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-gray-500">
                  <span>GST Taxes (5%):</span>
                  <span className="font-semibold text-[#222222]">₹{tax}</span>
                </div>

                <div className="flex justify-between items-center text-gray-500">
                  <span>Delivery Fee:</span>
                  {hasDeliveryZone ? (
                    <span className="font-semibold text-[#222222]">₹{deliveryFee}</span>
                  ) : (
                    <span className="text-[#D9AB3B] font-semibold flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Set distance
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center font-semibold text-sm text-[#222222] pt-2.5 border-t border-gray-100">
                  <span>Estimated Total Amount:</span>
                  <span className="text-base text-brand-green-primary" style={{ color: '#1B7A36' }}>₹{grandTotal}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PAYMENT METHOD — always shown so the customer can see how they pay.
            The UPI option appears once a VPA is set in src/config/payment.ts. */}
        {cart.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-3xs space-y-2.5 mt-4">
            <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide block">
              Payment Method
            </span>

            {([
              { key: 'cod' as const, title: 'Cash on Delivery', sub: 'Pay the rider when your order arrives' },
              ...(isUpiEnabled
                ? [{ key: 'upi' as const, title: 'UPI / GPay', sub: `Pay now to ${UPI.payeeName}` }]
                : []),
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPaymentMethod(opt.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  paymentMethod === opt.key
                    ? 'bg-[#1B7A36]/5 border-[#1B7A36]/40'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
                id={`payment-method-${opt.key}`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    paymentMethod === opt.key ? 'border-[#1B7A36]' : 'border-gray-300'
                  }`}
                >
                  {paymentMethod === opt.key && <span className="w-2 h-2 rounded-full bg-[#1B7A36]" />}
                </span>
                <span className="min-w-0">
                  <span className="text-xs font-bold text-[#222222] block">{opt.title}</span>
                  <span className="text-[10px] text-gray-500 block">{opt.sub}</span>
                </span>
              </button>
            ))}

            {paymentMethod === 'upi' && (
              <p className="text-[10px] text-gray-500 leading-relaxed">
                After placing the order we will open your UPI app. Once paid, enter the reference
                number so we can confirm it.
              </p>
            )}
          </div>
        )}

        {/* BOTTOM STICKY PLACE ORDER TRIGGER */}
        {cart.length > 0 && (
          <div className="pt-4 mt-auto">
            <button
              onClick={handleShopifyCheckout}
              disabled={isPlacingOrder || !hasDeliveryZone}
              className="w-full py-4 text-white hover:brightness-105 font-semibold text-xs uppercase tracking-wide rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1B7A36' }}
              id="place-order-checkout-btn"
            >
              {isPlacingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Placing Order…</span>
                </>
              ) : !hasDeliveryZone ? (
                <span>Set delivery distance to continue</span>
              ) : (
                <>
                  <span>Confirm & Place Order (₹{grandTotal})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {dataError && (
              <p className="text-[10px] text-center text-red-500 font-bold mt-2">{dataError}</p>
            )}
            <p className="text-[9px] text-center text-gray-400 mt-2">
              {isUpiEnabled && paymentMethod === 'upi'
                ? 'You will pay by UPI on the next step'
                : 'Pay cash when your order is delivered'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // TAB 3: ORDERS TAB (MEMORIZED TRACKING CYCLES)
  function renderOrdersTab() {
    return (
      <div className="p-4 space-y-4 flex-1">
        <h2 className="serif text-xl font-bold text-[#222222]">Track Your Harvests</h2>

        {orders.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3 shadow-xs">
            <span className="text-3xl block">📦</span>
            <h3 className="font-bold text-[#222222]">No Active Ground Logistics</h3>
            <p className="text-xs text-gray-500">
              Your direct delivery history from the co-operative will register here once checked out!
            </p>
            <button
              onClick={() => setActiveTab('home')}
              className="px-4 py-2 bg-[#1B7A36] text-white text-xs font-semibold uppercase tracking-wide rounded-xl shadow-xs cursor-pointer"
              style={{ backgroundColor: '#1B7A36' }}
              id="orders-browse-now-btn"
            >
              Browse Shop
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              // Status steps mapping
              const steps = [
                { title: 'Placed', active: true },
                { title: 'Picked Up', active: ['Picked Up', 'Packing', 'Out for Delivery', 'Delivered'].includes(order.status) },
                { title: 'Packing', active: ['Packing', 'Out for Delivery', 'Delivered'].includes(order.status) },
                { title: 'Out for Delivery', active: ['Out for Delivery', 'Delivered'].includes(order.status) },
                { title: 'Delivered', active: order.status === 'Delivered' },
              ];

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs space-y-3.5 hover:border-[#1B7A36] transition-colors">
                  
                  {/* Status metadata banner */}
                  <div className="flex justify-between items-start border-b border-gray-50 pb-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wide text-gray-400 block">Dispatch ID: {order.orderNumber}</span>
                      <span className="text-[11px] text-gray-500 font-semibold">{order.date}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-800 block">₹{order.total}</span>
                      <span 
                        className="text-[9px] uppercase font-mono tracking-wide text-[#1B7A36]" 
                        style={{ color: '#1B7A36' }}
                      >
                        {order.items.reduce((s, i) => s + i.quantity, 0)} items
                      </span>
                    </div>
                  </div>

                  {/* Micro list of crops inside order */}
                  <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>🍏 {item.product.name} × {item.quantity}</span>
                        <span className="font-medium">₹{item.product.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* VISUAL PIPELINE FLOW SCHEDULER */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-gray-400">Current Stage:</span>
                      <span className="text-[#1B7A36] uppercase font-bold" style={{ color: '#1B7A36' }}>{order.status}</span>
                    </div>

                    {/* Horizontal Visual indicator timeline */}
                    <div className="flex items-center justify-between relative pt-2">
                      <div className="absolute top-[21px] inset-x-2 h-0.5 bg-gray-100 -z-1" />
                      {steps.map((st, sidx) => (
                        <div key={sidx} className="flex flex-col items-center flex-1 relative">
                          <div 
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              st.active 
                                ? 'bg-[#1B7A36] border-[#1B7A36]' 
                                : 'bg-white border-gray-200'
                            }`}
                            style={{ 
                              backgroundColor: st.active ? '#1B7A36' : '#FFFFFF',
                              borderColor: st.active ? '#1B7A36' : '#E5E7EB'
                            }}
                          >
                            {st.active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                          </div>
                          <span 
                            className="text-[8px] text-center font-bold tracking-tight mt-1 truncate w-14"
                            style={{ color: st.active ? '#1B7A36' : '#9CA3AF' }}
                          >
                            {st.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic tracking instructions */}
                  <div className="flex items-center justify-between text-[11px] font-medium bg-[#1B7A36]/5 text-[#1B7A36] p-2 rounded-xl" style={{ color: '#1B7A36' }}>
                    <span>📍 ETA: {order.status === 'Delivered' ? 'Handed Over' : order.deliveryETA}</span>
                    <span className="underline font-bold text-[10px] uppercase tracking-wide cursor-help">Need Help?</span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // TAB 4: PROFILE PAGE & THE STAFF REENTRY GATEWAY
  function renderProfileTab() {
    return (
      <div className="p-4 space-y-4 flex-1">
        {/* Profile Card Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs flex items-center gap-4 relative overflow-hidden">
          {/* Accent Gold Corner */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#D9AB3B]/10 rounded-bl-3xl" />

          {/* Avatar — Google photo if available, otherwise the first initial */}
          <div className="w-14 h-14 bg-[#1B7A36] text-white rounded-full flex items-center justify-center text-xl font-bold font-serif relative overflow-hidden" style={{ backgroundColor: '#1B7A36' }}>
            {profile?.avatar_url ? (
              <img referrerPolicy="no-referrer" src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white" />
          </div>

          <div className="text-left min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate max-w-[200px]">{profile?.full_name || 'Freshly Drop Guest'}</h3>
            <span className="text-[10px] font-semibold text-[#D9AB3B] uppercase tracking-wide block" style={{ color: '#D9AB3B' }}>
              {isAdmin ? 'Staff · Admin Access' : isDelivery ? 'Delivery Partner' : 'Green Leaf Member'}
            </span>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono select-all truncate max-w-[200px]">{user?.email}</p>
          </div>
        </div>

        {/* Saved delivery addresses — hidden entirely until the customer has one */}
        {savedAddresses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs space-y-3.5 text-xs text-left">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block">
              Saved Addresses
            </span>

            <div className="space-y-2.5">
              {savedAddresses.map((saved) => (
                <div key={saved.id} className="flex justify-between items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500 shrink-0 flex items-center gap-1.5">
                    {/office|work/i.test(saved.label) ? (
                      <Briefcase className="w-3 h-3 text-[#1B7A36]" />
                    ) : (
                      <HomeIcon className="w-3 h-3 text-[#1B7A36]" />
                    )}
                    {saved.label}
                  </span>
                  <span className="font-semibold text-gray-900 text-right line-clamp-2 max-w-[190px]">
                    {saved.address}
                  </span>
                </div>
              ))}
            </div>

            <span className="text-[10px] text-gray-400 block">
              Add or remove addresses from the delivery section at checkout.
            </span>
          </div>
        )}

        {/* Interactive App Preferences */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs text-xs space-y-3.5 text-left">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block">App Preferences</span>
          
          <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
            <div>
              <span className="font-bold text-gray-900 block">Layout</span>
              <span className="text-[10px] text-gray-500">Switch between phone width and full screen</span>
            </div>
            
            <button
              onClick={() => setDisplayMode(displayMode === 'mobile' ? 'full' : 'mobile')}
              className="px-2.5 py-1.5 bg-gray-100 text-gray-800 font-bold text-[10px] rounded-lg border border-gray-200 uppercase tracking-wide hover:bg-gray-200 transition-colors cursor-pointer"
              id="profile-toggle-layout"
            >
              {displayMode === 'mobile' ? 'Wide Fullscreen' : 'Mobile Frame'}
            </button>
          </div>
        </div>

        {/* STAFF & LOGISTICS GATEWAY PORTAL — only visible to admin accounts */}
        {isStaff && (
          <div className="bg-gradient-to-r from-emerald-50 to-amber-50 rounded-2xl p-4 border border-[#1B7A36]/10 text-left space-y-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-[#1B7A36]" />
              <h4 className="font-bold text-sm text-[#1B7A36]">
                {isAdmin ? 'Staff logistics and stock portal' : 'Delivery & fulfilment portal'}
              </h4>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {isAdmin
                ? 'Authorized gate to manage harvest crops direct, restock levels, edit inventory levels in real time, or adjust customer order dispatch status values.'
                : 'Your fulfilment hub — view the picking list, collect items, then move each order through to delivered.'}
            </p>

            <button
              onClick={() => setActiveTab('admin')}
              className="w-full py-3 text-white hover:opacity-95 text-xs uppercase tracking-wide font-semibold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: '#D9AB3B' }}
              id="profile-admin-dashboard-btn"
            >
              <span>{isAdmin ? 'Enter Admin Dashboard' : 'Enter Delivery Dashboard'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SIGN OUT */}
        <button
          onClick={async () => {
            await signOut();
            setActiveTab('home');
            setCart([]);
          }}
          className="w-full py-3 bg-white border border-red-100 text-red-500 hover:bg-red-50 text-xs uppercase tracking-wide font-semibold rounded-xl shadow-3xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          id="profile-signout-btn"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        {/* Humility signature footer */}
        <p className="text-[10px] text-center text-gray-400 font-mono mt-8 pb-4">
          Freshly Drop • Rooted in Freshness. Freshly Delivered <br />
          Built with premium React & Tailwind on Cloud Run
        </p>
      </div>
    );
  }
}
