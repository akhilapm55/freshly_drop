/**
 * Supabase client.
 *
 * Reads credentials from Vite env vars. Create a `.env.local` file in the
 * project root (see `.env.local.example`) with:
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 *
 * The anon key is safe to expose in the browser — row-level security (RLS)
 * policies in the database (see supabase/schema.sql) protect the data.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both env vars are present. The app shows a setup screen otherwise. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Fall back to harmless placeholders when unconfigured so createClient does not
// throw at import time — the UI checks isSupabaseConfigured and guides the user.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
