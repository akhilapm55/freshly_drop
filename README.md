<div align="center">
<h1>🌿 Freshly Drop</h1>
<p><em>Rooted in Freshness. Freshly Delivered.</em></p>
<p>An organic vegetable & produce delivery app for Kerala — React + Vite + Tailwind, with a Supabase database, Google authentication, and a role-based admin dashboard.</p>
</div>

---

## Features

- 🛒 Browse organic produce, search & filter by category, add to cart
- 🏷️ Coupon codes (`FRESHRAIN` 20% off, `FIRSTDROP` free shipping ≥ ₹299) — with proper apply/remove
- 📦 Place orders saved to a real Postgres database, track delivery status
- 🔐 Google sign-in (Supabase Auth)
- 🛠️ Role-based **Admin Dashboard**: manage stock & order status (admins only)

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, Motion, Lucide
- **Backend:** Supabase (Postgres database, Auth, Row-Level Security)

## Run locally

**Prerequisites:** Node.js (v18+)

```bash
npm install
npm run dev
```

The app needs a Supabase project (free) for the database and login.
👉 **Follow the step-by-step guide in [SETUP.md](SETUP.md)** to:

1. Create a Supabase project & add credentials to `.env.local`
2. Run `supabase/schema.sql` to create tables + seed products
3. Enable Google sign-in
4. Make yourself an admin

Until Supabase is configured, the app shows a friendly setup screen instead of crashing.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Main app (shop, cart, orders, profile, admin routing) |
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/queries.ts` | All database reads/writes |
| `src/context/AuthContext.tsx` | Auth state + Google sign-in + role |
| `src/components/` | UI components (LoginScreen, AdminDashboard, ProductCard, …) |
| `supabase/schema.sql` | Database schema, security policies, seed data |
