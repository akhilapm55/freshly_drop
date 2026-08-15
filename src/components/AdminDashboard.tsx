/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Layers,
  Plus,
  Minus,
  CheckCircle,
  Package,
  RefreshCw,
  Edit2,
  Trash2,
  PackagePlus,
  Undo2,
  ClipboardList,
  Truck,
  Loader2,
  Search,
  UserPlus,
  Mail,
  Lock
} from 'lucide-react';
import ProductFormModal from './ProductFormModal';
import { fetchStaffMembers, searchProfiles, updateUserRole, createStaffAccount, StaffProfile, UserRole } from '../lib/queries';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { Product, Order } from '../types';

interface AdminDashboardProps {
  products: Product[];
  orders: Order[];
  onUpdateStock: (productId: string, newStock: number) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onBulkUpdateStatus: (orderIds: string[], status: Order['status']) => void;
  onResetDatabase: () => void;
  onAddProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => void;
  /** Confirm/reject a UPI payment after checking the money actually arrived. */
  onSetPaymentStatus: (orderId: string, status: Order['paymentStatus']) => void;
  mode?: 'admin' | 'delivery'; // delivery = restricted fulfilment-only view
  currentUserId: string;       // to prevent an admin demoting their own account
}

export default function AdminDashboard({
  products,
  orders,
  onUpdateStock,
  onUpdateOrderStatus,
  onBulkUpdateStatus,
  onResetDatabase,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSetPaymentStatus,
  mode = 'admin',
  currentUserId,
}: AdminDashboardProps) {
  const isDeliveryView = mode === 'delivery';
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'picking' | 'inventory' | 'orders' | 'staff'>(
    isDeliveryView ? 'picking' : 'analytics'
  );
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [tempStockValue, setTempStockValue] = useState<number>(0);

  // Product add/edit modal + delete confirmation state
  const [productForm, setProductForm] = useState<{ mode: 'add' | 'edit'; product?: Product } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Two-step confirm for the batch pick/pack/dispatch buttons (avoids accidental clicks)
  const [confirmBulk, setConfirmBulk] = useState<null | 'pick' | 'pack' | 'dispatch'>(null);

  // Staff management (admin only). Loads only existing staff by default (small
  // list); use search to find any customer to promote — searched in the database
  // so it scales to any number of users.
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StaffProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Create-a-delivery-account form
  const [newStaff, setNewStaff] = useState({ fullName: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffError('');
    try {
      setStaff(await fetchStaffMembers());
    } catch (e: any) {
      setStaffError(e?.message || 'Could not load staff.');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'staff') loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const runSearch = async () => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setStaffError('');
    try {
      setSearchResults(await searchProfiles(term));
    } catch (e: any) {
      setStaffError(e?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    // Optimistic update in both the staff list and any visible search results
    setStaff((prev) => prev.map((s) => (s.id === userId ? { ...s, role } : s)));
    setSearchResults((prev) => (prev ? prev.map((s) => (s.id === userId ? { ...s, role } : s)) : prev));
    try {
      await updateUserRole(userId, role);
      await loadStaff(); // refresh so demoted users drop off the staff list
    } catch (e: any) {
      setStaffError(e?.message || 'Could not update role.');
      loadStaff();
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setCreateMsg('');
    if (!newStaff.fullName.trim() || !newStaff.email.trim() || newStaff.password.length < 6) {
      setStaffError('Enter a name, email, and a password of at least 6 characters.');
      return;
    }
    setCreating(true);
    try {
      const { needsConfirmation } = await createStaffAccount({
        fullName: newStaff.fullName.trim(),
        email: newStaff.email.trim(),
        password: newStaff.password,
        role: 'delivery',
      });
      const email = newStaff.email.trim();
      setNewStaff({ fullName: '', email: '', password: '' });
      setCreateMsg(
        needsConfirmation
          ? `Account created for ${email}, but they must confirm their email before logging in. Turn off "Confirm email" in Supabase for instant access.`
          : `Delivery account created! ${email} can sign in now with that email and password.`
      );
      await loadStaff();
    } catch (err: any) {
      setStaffError(err?.message || 'Could not create the account.');
    } finally {
      setCreating(false);
    }
  };

  // Role toggle buttons shared by the staff list and search results
  const renderRoleButtons = (u: StaffProfile) => {
    const isSelf = u.id === currentUserId;
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        {(['customer', 'delivery', 'admin'] as const).map((r) => {
          const active = u.role === r;
          return (
            <button
              key={r}
              disabled={isSelf}
              onClick={() => handleRoleChange(u.id, r)}
              className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-wide rounded-md transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={active ? { backgroundColor: r === 'admin' ? '#1B7A36' : r === 'delivery' ? '#D9AB3B' : '#9CA3AF' } : undefined}
              title={isSelf ? "You can't change your own role" : `Set as ${r}`}
            >
              {r}
            </button>
          );
        })}
      </div>
    );
  };

  // Calculate stats dynamically — real orders only. (These used to be padded
  // with invented baselines of ₹24,890 / 142 orders, which made the dashboard
  // report money the shop had not taken.)
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;

    // Rough margin assumption — not an accounting figure, labelled as an estimate.
    const totalProfit = Math.round(totalRevenue * 0.35);

    // Filter inventory statuses
    const lowStockCount = products.filter(p => p.stock <= 15 && p.stock > 0).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    return {
      revenue: totalRevenue,
      orders: totalOrders,
      profit: totalProfit,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      totalInventoryItems: products.reduce((sum, p) => sum + p.stock, 0),
    };
  }, [products, orders]);

  // Batch fulfilment groups
  const toPickOrders = useMemo(() => orders.filter((o) => o.status === 'Order Placed'), [orders]);
  const toPackOrders = useMemo(() => orders.filter((o) => o.status === 'Picked Up'), [orders]);
  const toDispatchOrders = useMemo(() => orders.filter((o) => o.status === 'Packing'), [orders]);

  // Aggregated picking list: total quantity needed per product across every
  // order still waiting to be picked. This is the sheet to read out to farmers.
  const pickingList = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; category: string; qty: number }>();
    toPickOrders.forEach((o) =>
      o.items.forEach((it) => {
        const ex = map.get(it.product.id);
        if (ex) ex.qty += it.quantity;
        else
          map.set(it.product.id, {
            name: it.product.name,
            unit: it.product.unit,
            category: it.product.category,
            qty: it.quantity,
          });
      })
    );
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [toPickOrders]);

  // Real sales for the last 7 days, grouped by day from the orders themselves.
  // Days with no orders stay in the series as zeroes so the shape of the week
  // is honest rather than compressed.
  const chartsData = useMemo(() => {
    const days: { name: string; key: string; Sales: number; Profit: number; Deliveries: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        name: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        key: d.toDateString(),
        Sales: 0,
        Profit: 0,
        Deliveries: 0,
      });
    }

    const byKey = new Map(days.map((d) => [d.key, d]));
    orders.forEach((order) => {
      if (!order.createdAt) return;
      const bucket = byKey.get(new Date(order.createdAt).toDateString());
      if (!bucket) return; // older than 7 days
      bucket.Sales += order.total;
      bucket.Deliveries += 1;
    });

    days.forEach((d) => {
      d.Sales = Math.round(d.Sales);
      d.Profit = Math.round(d.Sales * 0.35); // same estimate as the stats card
    });
    return days;
  }, [orders]);

  const handleStartEditStock = (product: Product) => {
    setEditingStockId(product.id);
    setTempStockValue(product.stock);
  };

  const handleSaveStock = (productId: string) => {
    onUpdateStock(productId, tempStockValue);
    setEditingStockId(null);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-gray-100">
        <div>
          <span className="text-xs uppercase tracking-wide font-semibold text-[#1B7A36]">
            {isDeliveryView ? 'Delivery Portal' : 'Admin Portal'}
          </span>
          <h2 className="text-2xl font-semibold text-[#222222]">
            {isDeliveryView ? 'Pick, Pack & Deliver' : 'Farm-to-Door Command'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isDeliveryView
              ? 'Collect the items, then move each order through to delivered.'
              : 'Real-time control center for Freshly Drop logistics & stocks.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetDatabase}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            id="reset-database-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Delivery summary (delivery staff don't see revenue/profit) */}
      {isDeliveryView ? (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'To Pick', value: toPickOrders.length, color: '#1B7A36', icon: ClipboardList },
            { label: 'To Pack', value: toPackOrders.length, color: '#D9AB3B', icon: Package },
            { label: 'Out for Delivery', value: orders.filter((o) => o.status === 'Out for Delivery').length, color: '#1B7A36', icon: Truck },
          ].map((c) => (
            <div key={c.label} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.label}</span>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
              <h3 className="text-2xl font-semibold" style={{ color: c.color }}>{c.value}</h3>
            </div>
          ))}
        </div>
      ) : (

      /* Analytics Summary Grid (admin only) */
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* REVENUE */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between group hover:border-[#1B7A36] transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Revenue</span>
            <div className="p-2 bg-[#1B7A36]/5 text-[#1B7A36] rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-semibold text-[#222222]">₹{stats.revenue.toLocaleString()}</h3>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              Across all orders placed
            </span>
          </div>
        </div>

        {/* ORDERS */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between group hover:border-[#D9AB3B] transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Orders</span>
            <div className="p-2 bg-[#D9AB3B]/5 text-[#D9AB3B] rounded-xl">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-semibold text-[#222222]">{stats.orders}</h3>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              Total orders received
            </span>
          </div>
        </div>

        {/* NET PROFIT */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between group hover:border-[#1B7A36] transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Est. Profit</span>
            <div className="p-2 bg-[#1B7A36]/5 text-[#1B7A36] rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-semibold text-[#222222]">₹{stats.profit.toLocaleString()}</h3>
            <span className="text-[10px] text-gray-400 font-semibold block mt-1">
              35% steady net profit margin
            </span>
          </div>
        </div>

        {/* INVENTORY */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between group hover:border-[#D9AB3B] transition-colors align-stretch">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inventory</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-semibold text-[#222222]">{stats.totalInventoryItems} kg/pcs</h3>
            <span className="text-[10px] text-amber-500 font-bold block mt-1">
              {stats.lowStock} Low stock • {stats.outOfStock} Sold out!
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Internal Ribbon Nav — equal-width tabs. Delivery view shows only Picking + Dispatch. */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'analytics', emoji: '📈', label: 'Reports', count: 0, adminOnly: true },
          { key: 'picking', emoji: '🧺', label: 'Picking', count: toPickOrders.length, adminOnly: false },
          { key: 'inventory', emoji: '🌾', label: 'Stock', count: products.length, adminOnly: true },
          { key: 'orders', emoji: '🚚', label: 'Dispatch', count: orders.length, adminOnly: false },
          { key: 'staff', emoji: '👥', label: 'Staff', count: 0, adminOnly: true },
        ] as const).filter((t) => !isDeliveryView || !t.adminOnly).map((t) => {
          const active = activeSubTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              className={`flex-1 min-w-0 px-1 py-2 border-b-2 transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                active ? 'border-[#1B7A36] text-[#1B7A36]' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
              id={`admin-${t.key}-tab`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <span className="flex items-center gap-1 leading-none">
                <span className="text-[10px] font-semibold uppercase tracking-wide">{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`text-[8px] font-semibold px-1 rounded-full leading-tight ${
                      active ? 'bg-[#1B7A36]/10 text-[#1B7A36]' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB CONTENTS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {/* Dual Charts powered by Recharts (Green & Gold) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Sales Bar chart using #1B7A36 and #D9AB3B */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Weekly Organic Revenue (₹)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F1FDF4' }} />
                    <Bar dataKey="Sales" fill="#1B7A36" radius={[4, 4, 0, 0]} name="Gross Sales" />
                    <Bar dataKey="Profit" fill="#D9AB3B" radius={[4, 4, 0, 0]} name="Est Net Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance line chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Daily Dispatch Frequency (Orders)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line 
                      type="monotone" 
                      dataKey="Deliveries" 
                      stroke="#1B7A36" 
                      strokeWidth={3} 
                      activeDot={{ r: 8 }} 
                      name="Dispatched Deliveries"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeSubTab === 'picking' && (
        <div className="space-y-5">
          {/* How-it-works intro */}
          <div className="bg-[#1B7A36]/5 rounded-2xl p-4 border border-[#1B7A36]/10 flex items-start gap-3">
            <div className="p-2 bg-white text-[#1B7A36] rounded-xl shadow-xs flex-shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-[#1B7A36] text-sm">Morning Picking List</h4>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                Total quantity of each item across all new orders. Read these out to the farmers, collect
                everything, then mark the whole batch as <strong>Picked Up</strong> — every customer's tracker
                moves forward together.
              </p>
            </div>
          </div>

          {/* SECTION 1 — items to pick (aggregated) */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">To Pick</span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {toPickOrders.length} order{toPickOrders.length === 1 ? '' : 's'} • {pickingList.length} item{pickingList.length === 1 ? '' : 's'} to collect
                </p>
              </div>

              {pickingList.length > 0 && (
                confirmBulk === 'pick' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { onBulkUpdateStatus(toPickOrders.map((o) => o.id), 'Picked Up'); setConfirmBulk(null); }}
                      className="px-3 py-1.5 bg-[#1B7A36] text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer hover:bg-[#1B7A36]/90"
                      style={{ backgroundColor: '#1B7A36' }}
                      id="confirm-bulk-pick"
                    >
                      Yes, all picked
                    </button>
                    <button
                      onClick={() => setConfirmBulk(null)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmBulk('pick')}
                    className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs flex-shrink-0"
                    style={{ backgroundColor: '#1B7A36' }}
                    id="bulk-pick-btn"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Mark all Picked Up
                  </button>
                )
              )}
            </div>

            {pickingList.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <span className="text-2xl block">🧺</span>
                <p className="text-xs text-gray-400">No new orders waiting to be picked. New customer orders show up here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pickingList.map((item) => (
                  <div key={item.name} className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#222222] truncate">{item.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono italic truncate">{item.category} • sold as {item.unit}</p>
                    </div>
                    <div className="text-right flex-shrink-0 pl-3">
                      <span className="text-xl font-bold text-[#1B7A36]" style={{ color: '#1B7A36' }}>{item.qty}</span>
                      <span className="text-[9px] text-gray-400 block uppercase tracking-wide font-bold">to collect</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2 — picked up, ready to pack */}
          {toPackOrders.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Picked Up — Ready to Pack</span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {toPackOrders.length} order{toPackOrders.length === 1 ? '' : 's'} collected and waiting to be packed
                </p>
              </div>

              {confirmBulk === 'pack' ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { onBulkUpdateStatus(toPackOrders.map((o) => o.id), 'Packing'); setConfirmBulk(null); }}
                    className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer"
                    style={{ backgroundColor: '#D9AB3B' }}
                    id="confirm-bulk-pack"
                  >
                    Yes, start packing
                  </button>
                  <button
                    onClick={() => setConfirmBulk(null)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulk('pack')}
                  className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: '#D9AB3B' }}
                  id="bulk-pack-btn"
                >
                  <Package className="w-3.5 h-3.5" /> Mark all as Packing
                </button>
              )}
            </div>
          )}

          {/* SECTION 3 — packed, ready to send out on the vehicle */}
          {toDispatchOrders.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Packed — Ready to Send Out</span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {toDispatchOrders.length} order{toDispatchOrders.length === 1 ? '' : 's'} packed and ready to load on the vehicle
                </p>
              </div>

              {confirmBulk === 'dispatch' ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { onBulkUpdateStatus(toDispatchOrders.map((o) => o.id), 'Out for Delivery'); setConfirmBulk(null); }}
                    className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer"
                    style={{ backgroundColor: '#1B7A36' }}
                    id="confirm-bulk-dispatch"
                  >
                    Yes, send out
                  </button>
                  <button
                    onClick={() => setConfirmBulk(null)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide rounded-lg cursor-pointer hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBulk('dispatch')}
                  className="px-3 py-1.5 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: '#1B7A36' }}
                  id="bulk-dispatch-btn"
                >
                  <Truck className="w-3.5 h-3.5" /> Send all Out for Delivery
                </button>
              )}
            </div>
          )}

          {/* Hint about the per-order delivered step */}
          {toDispatchOrders.length === 0 && orders.some((o) => o.status === 'Out for Delivery') && (
            <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-100 text-[11px] text-slate-700 leading-relaxed">
              🚚 Orders are out on the vehicle. Mark each one <strong>Delivered</strong> in the{' '}
              <strong>Dispatch</strong> tab as you hand it over at each doorstep.
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center gap-3">
            <span className="text-xs text-gray-500">Manage your produce catalogue</span>
            <button
              onClick={() => setProductForm({ mode: 'add' })}
              className="px-3 py-1.5 text-white text-xs font-semibold uppercase tracking-wide rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs"
              style={{ backgroundColor: '#1B7A36' }}
              id="admin-add-product-btn"
            >
              <PackagePlus className="w-4 h-4" /> Add Product
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {products.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-400">No products yet. Click "Add Product" to create your first crop.</div>
            )}
            {products.map((p) => {
              const isEditing = editingStockId === p.id;
              const isConfirmingDelete = confirmDeleteId === p.id;
              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      referrerPolicy="no-referrer"
                      src={p.image}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#222222] truncate">{p.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono italic truncate">
                        {p.category} • ₹{p.price} / {p.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isConfirmingDelete ? (
                      /* Inline delete confirmation */
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 hidden sm:block">Delete?</span>
                        <button
                          onClick={() => { onDeleteProduct(p.id); setConfirmDeleteId(null); }}
                          className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-semibold uppercase rounded-md hover:bg-red-600 cursor-pointer"
                          id={`admin-confirm-delete-${p.id}`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase rounded-md hover:bg-gray-200 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
                        <button
                          onClick={() => setTempStockValue(prev => Math.max(0, prev - 1))}
                          className="p-1 hover:bg-white rounded-md text-gray-600 transition-colors"
                          id={`admin-dec-${p.id}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          className="w-12 text-center bg-transparent font-bold text-xs outline-hidden focus:ring-0"
                          value={tempStockValue}
                          onChange={(e) => setTempStockValue(parseInt(e.target.value) || 0)}
                          id={`admin-input-${p.id}`}
                        />
                        <button
                          onClick={() => setTempStockValue(prev => prev + 1)}
                          className="p-1 hover:bg-white rounded-md text-gray-600 transition-colors"
                          id={`admin-inc-${p.id}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSaveStock(p.id)}
                          className="ml-1 px-2.5 py-1 bg-[#1B7A36] text-white text-[10px] font-semibold uppercase rounded-md hover:bg-[#1B7A36]/90 cursor-pointer"
                          id={`admin-save-${p.id}`}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Stock badge */}
                        {p.stock === 0 ? (
                          <span className="text-[10px] bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-sm uppercase">Sold Out</span>
                        ) : p.stock <= 15 ? (
                          <span className="text-[10px] bg-amber-50 text-amber-500 font-bold px-2 py-0.5 rounded-sm uppercase">Low ({p.stock})</span>
                        ) : (
                          <span className="text-[10px] bg-[#1B7A36]/10 text-[#1B7A36] font-bold px-2 py-0.5 rounded-sm uppercase">{p.stock}</span>
                        )}

                        {/* Quick stock edit */}
                        <button
                          onClick={() => handleStartEditStock(p)}
                          className="p-2 text-gray-400 hover:text-[#1B7A36] rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Quick adjust stock"
                          id={`admin-edit-stock-${p.id}`}
                        >
                          <Layers className="w-4 h-4" />
                        </button>

                        {/* Full edit */}
                        <button
                          onClick={() => setProductForm({ mode: 'edit', product: p })}
                          className="p-2 text-gray-400 hover:text-[#1B7A36] rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit product details"
                          id={`admin-edit-product-${p.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete product"
                          id={`admin-delete-product-${p.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STAFF & ROLES (admin only) */}
      {activeSubTab === 'staff' && !isDeliveryView && (
        <div className="space-y-4">
          {staffError && (
            <div className="p-3 rounded-xl text-[11px] text-red-500 font-bold bg-red-50 border border-red-100">{staffError}</div>
          )}

          {/* CREATE a delivery account directly (admin sets their email + password) */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#1B7A36]/10 rounded-lg">
                <UserPlus className="w-4 h-4 text-[#1B7A36]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Add a Delivery Boy</span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Create their account here, then share the email & password — they log in to their delivery view.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-2.5">
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="Delivery boy's name"
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-800 outline-hidden"
                  id="new-staff-name"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="Email"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-800 outline-hidden"
                    id="new-staff-email"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    placeholder="Password (6+ chars)"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-800 outline-hidden"
                    id="new-staff-password"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 text-white text-xs font-semibold uppercase tracking-wide rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1B7A36' }}
                id="create-delivery-btn"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{creating ? 'Creating…' : 'Create Delivery Account'}</span>
              </button>
            </form>

            {createMsg && (
              <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg py-2 px-3">{createMsg}</p>
            )}
            <p className="text-[9px] text-gray-400">
              The password is visible so you can copy it to share. They can change it later.
            </p>
          </div>

          {/* Promote an EXISTING user (e.g. someone who signed in with Google) */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 space-y-3">
            <div>
              <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Promote an Existing User</span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Already signed up (e.g. via Google)? Search by name or email, then tap <strong>delivery</strong> or <strong>admin</strong>.
              </p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); runSearch(); }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name or email…"
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-gray-800 outline-hidden"
                  id="staff-search-input"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-white text-xs font-semibold uppercase tracking-wide rounded-xl cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                style={{ backgroundColor: '#1B7A36' }}
                id="staff-search-btn"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
              </button>
            </form>

            {searchResults !== null && (
              searchResults.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-3">No users matched "{searchTerm.trim()}".</p>
              ) : (
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                  {searchResults.map((u) => (
                    <div key={u.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-[#222222] truncate">{u.full_name || 'Unnamed user'}</h4>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{u.email}</p>
                      </div>
                      {renderRoleButtons(u)}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Current team (admins + delivery) — stays short regardless of customer count */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-[#222222] uppercase tracking-wide">Current Team</span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                <strong>Delivery</strong> = pick/pack/deliver · <strong>Admin</strong> = full control. Tap to change.
              </p>
            </div>

            {staffLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#1B7A36]" />
              </div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No staff yet. Search above to promote your first delivery boy or admin.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {staff.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#222222] truncate">
                        {u.full_name || 'Unnamed user'}
                        {u.id === currentUserId && <span className="text-[9px] text-gray-400 font-normal"> (you)</span>}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{u.email}</p>
                    </div>
                    {renderRoleButtons(u)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRODUCT ADD / EDIT MODAL */}
      <AnimatePresence>
        {productForm && (
          <ProductFormModal
            mode={productForm.mode}
            initial={productForm.product}
            onClose={() => setProductForm(null)}
            onSave={productForm.mode === 'add' ? onAddProduct : onUpdateProduct}
          />
        )}
      </AnimatePresence>

      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xs text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#222222] text-sm">No Active Direct Orders</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                No real-time user checkout cycles in progress yet. Place an order on the checkout screen to control its live status steps!
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-3 hover:border-brand-green-primary transition-colors">
                
                {/* Header line */}
                <div className="flex items-center justify-between border-b border-gray-50 pb-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wide text-gray-400 block">Order UUID: {order.id.slice(0, 8)}</span>
                    <span className="font-semibold text-xs text-[#222222]">{order.orderNumber}</span>
                  </div>

                  <span className="text-xs font-bold font-mono text-brand-green-primary" style={{ color: '#1B7A36' }}>
                    Value: ₹{order.total}
                  </span>
                </div>

                {/* Items & details */}
                <div className="text-xs space-y-1">
                  <div className="text-gray-500 mb-1 font-semibold">Ordered Harvest:</div>
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-[#222222]">
                      <span>🍏 {item.product.name} × {item.quantity}</span>
                      <span className="font-semibold">₹{item.product.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Delivery Location */}
                <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg leading-tight">
                  📍 <span className="font-medium text-gray-600">Address:</span> {order.address}
                </div>

                {/* PAYMENT — a UPI order is only 'paid' once YOU have seen the money.
                    The customer's reference is a claim, never proof. */}
                <div
                  className={`text-[11px] p-2 rounded-lg leading-tight space-y-1.5 border ${
                    order.paymentStatus === 'paid'
                      ? 'bg-emerald-50 border-emerald-100'
                      : order.paymentStatus === 'submitted'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-600">
                      {order.paymentMethod === 'upi' ? '📲 UPI' : order.paymentMethod === 'gateway' ? '💳 Online' : '💵 Cash on delivery'}
                    </span>
                    <span
                      className={`font-bold uppercase tracking-wide text-[9px] px-2 py-0.5 rounded-full ${
                        order.paymentStatus === 'paid'
                          ? 'bg-emerald-600 text-white'
                          : order.paymentStatus === 'submitted'
                          ? 'bg-amber-500 text-white'
                          : order.paymentStatus === 'failed'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {order.paymentStatus === 'submitted' ? 'Needs checking' : order.paymentStatus}
                    </span>
                  </div>

                  {order.paymentRef && (
                    <div className="text-gray-600">
                      Ref: <span className="font-mono font-bold select-all">{order.paymentRef}</span>
                    </div>
                  )}

                  {/* Verification controls — admins only, and never for COD */}
                  {mode === 'admin' && order.paymentMethod !== 'cod' && order.paymentStatus !== 'paid' && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        onClick={() => onSetPaymentStatus(order.id, 'paid')}
                        className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wide rounded-md hover:brightness-110 cursor-pointer active:scale-95 transition-all"
                        id={`confirm-payment-${order.id}`}
                      >
                        Money received
                      </button>
                      <button
                        onClick={() => onSetPaymentStatus(order.id, 'failed')}
                        className="px-2 py-1 bg-white border border-red-200 text-red-500 text-[9px] font-bold uppercase tracking-wide rounded-md hover:bg-red-50 cursor-pointer active:scale-95 transition-all"
                        id={`reject-payment-${order.id}`}
                      >
                        Not received
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Status stepper */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-150 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Process Dispatch:</span>
                    <div className="px-2 py-0.5 bg-brand-green-primary/10 rounded-full text-[10px] font-semibold text-brand-green-primary" style={{ color: '#1B7A36' }}>
                      {order.status}
                    </div>
                  </div>

                  {/* Quick status stepper — advance forward, or step back to undo a mistake */}
                  <div className="flex items-center gap-1.5">
                    {/* BACK / UNDO — shown whenever the order is past the first stage */}
                    {order.status !== 'Order Placed' && (
                      <button
                        onClick={() => {
                          const prevStatusMap: Record<Order['status'], Order['status']> = {
                            'Order Placed': 'Order Placed',
                            'Picked Up': 'Order Placed',
                            'Packing': 'Picked Up',
                            'Out for Delivery': 'Packing',
                            'Delivered': 'Out for Delivery',
                          };
                          onUpdateOrderStatus(order.id, prevStatusMap[order.status]);
                        }}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-semibold uppercase tracking-wide rounded-md cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                        title="Step status back (undo)"
                        id={`revert-status-${order.id}`}
                      >
                        <Undo2 className="w-3 h-3" /> Back
                      </button>
                    )}

                    {/* ADVANCE forward, or the completed badge once delivered */}
                    {order.status !== 'Delivered' ? (
                      <button
                        onClick={() => {
                          const nextStatusMap: Record<Order['status'], Order['status']> = {
                            'Order Placed': 'Picked Up',
                            'Picked Up': 'Packing',
                            'Packing': 'Out for Delivery',
                            'Out for Delivery': 'Delivered',
                            'Delivered': 'Delivered',
                          };
                          onUpdateOrderStatus(order.id, nextStatusMap[order.status]);
                        }}
                        className="px-2.5 py-1 bg-[#1B7A36] hover:bg-[#1B7A36]/90 text-[10px] font-semibold uppercase tracking-wide text-white rounded-md cursor-pointer transition-all active:scale-95"
                        style={{ backgroundColor: '#1B7A36' }}
                        id={`advance-status-${order.id}`}
                      >
                        Advance Status ➜
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Handed Over
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
