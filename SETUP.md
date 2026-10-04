# Freshly Drop — Setup Guide

This app uses **Supabase** (hosted Postgres database + authentication) with
**Google sign-in** and **role-based admin** access. Follow these steps once to
get a fully working app with a real database and login.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up (free).
2. Click **New project**. Give it a name (e.g. `freshly-drop`), set a database
   password (save it somewhere), pick a region close to you, and create it.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Get your API credentials

1. In your project, go to **Project Settings → API** (gear icon, bottom left).
2. Copy two values:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon public** key (under "Project API keys")

## 3. Add credentials to the app

1. In the project root, copy `.env.local.example` to a new file named
   **`.env.local`**.
2. Paste in your values:

   ```   
   VITE_SUPABASE_URL=https://chdduwxkhimwpefossmq.supabase.co/rest/v1/
         VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZGR1d3hraGltd3BlZm9zc21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTAyNjEsImV4cCI6MjA5NjA2NjI2MX0.XFTiTxqWbcjSpSDyXdeH0UdEIkIzNFzwBO3kmqkw-ZE
   ```

3. Save the file.

## 4. Create the database tables

1. In Supabase, open the **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project, copy the **entire** contents,
   paste into the SQL editor, and click **Run**.
3. You should see "Success". This creates the `profiles`, `products`, and
   `orders` tables, the security policies, the auto-stock-deduction trigger,
   and seeds the 9 products. (Re-running it later is safe.)

## 4b. Create the image storage bucket (for uploading product photos)

So admins can upload product images from their device:

1. **SQL Editor → New query**
2. Paste the contents of `supabase/storage.sql` and click **Run**.

This creates a public `product-images` bucket where uploads are stored; their
public URL is saved in `products.image`. Only admins can upload; everyone can view.

## 4c. Enable real-time order tracking

So customers see their order status update live (no refresh):

1. **SQL Editor → New query**
2. Paste the contents of `supabase/realtime.sql` and click **Run**.

This adds the `orders` table to Supabase's realtime feed. Status changes the admin
makes then push instantly to the customer's tracker over a WebSocket.

## 4d. Enable the delivery-staff role (optional)

So you can give staff a delivery-only dashboard:

1. **SQL Editor → New query**
2. Paste the contents of `supabase/roles.sql` and click **Run**.

This adds a `delivery` role. Then, as an admin, open **Admin Dashboard → 👥 Staff**
and tap to make any signed-up user **Delivery** (focused pick/pack/deliver view) or
**Admin** (full control).

## Delivery distance & charges

Delivery is charged by distance from the store using configurable slabs. Edit the
store location and slabs in **`src/config/delivery.ts`** (default: 0–2 km ₹20,
2–4 ₹30, 4–6 ₹40, 6–8 ₹50, 8–10 ₹70, beyond 10 km unavailable).

At checkout the customer searches/selects their address; the distance and charge
are calculated and shown immediately.

- **Free (default):** address search via OpenStreetMap + straight-line distance.
  Nothing to set up.
- **Accurate (optional):** add `VITE_GOOGLE_MAPS_API_KEY` to use Google Places
  Autocomplete + real driving distance. Enable "Maps JavaScript API" +
  "Distance Matrix API" with billing (Google's $200/month credit covers small use).

Run `supabase/delivery-location.sql` once so each order also stores the delivery
latitude/longitude/distance (the charge is already frozen in `orders.delivery_fee`).

## 5. Enable Google sign-in

You need Google OAuth credentials so users can log in with Google.

### a) Create Google OAuth credentials

1. Go to <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen** → choose **External** → fill in an
   app name, your support email, and developer email → Save. Add your own Google
   account under **Test users** so you can sign in during development.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `http://localhost:3000`
   - **Authorized redirect URIs**: add your Supabase callback URL, which looks
     like:
     `https://xxxxxxxx.supabase.co/auth/v1/callback`
     (You can copy the exact value from the next step in Supabase.)
   - Create, then copy the **Client ID** and **Client secret**.

### b) Tell Supabase about it

1. In Supabase: **Authentication → Providers → Google**.
2. Toggle it **on**, paste the **Client ID** and **Client secret**, and save.
   (The callback URL shown there is the one you added to Google above.)

## 6. Run the app

```bash
npm install      # if you haven't already
npm run dev
```

Open <http://localhost:3000>. You'll see the **login screen** → click
**Continue with Google** → sign in. You're now a customer and can shop, add to
cart, apply coupons, and place real orders saved in the database.

## 7. Make yourself an admin

The Admin Dashboard (stock + order management) is restricted to admin accounts.
After signing in once with Google:

1. In Supabase open **SQL Editor → New query** and run (use your Gmail address):

   ```sql
   update public.profiles set role = 'admin' where email = 'YOUR_EMAIL@gmail.com';
   ```

2. Refresh the app. You'll now see **"Enter Admin Dashboard"** in the Profile tab.

---

## Coupon codes (for testing)

- `FRESHRAIN` — 20% off
- `FIRSTDROP` — free shipping on carts ≥ ₹299

## Troubleshooting

- **"Supabase not configured yet" screen** → `.env.local` is missing or the dev
  server wasn't restarted after creating it. Stop (`Ctrl+C`) and run `npm run dev`
  again.
- **Login popup error / redirect mismatch** → double-check the redirect URI in
  Google Cloud exactly matches your Supabase callback URL, and that
  `http://localhost:3000` is an authorized JavaScript origin.
- **Can't see products** → make sure you ran `supabase/schema.sql` (step 4).
- **Admin button missing** → run the `update ... set role = 'admin'` query (step 7)
  and refresh.
