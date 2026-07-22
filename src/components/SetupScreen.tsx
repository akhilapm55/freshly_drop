/**
 * Shown when Supabase env vars are missing, so the app gives clear setup
 * guidance instead of a blank crash.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function SetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F8F8]">
      <div className="max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="w-6 h-6" />
          <h1 className="text-lg font-bold text-gray-900">Supabase not configured yet</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          The app needs your Supabase project credentials to connect to the database and
          handle login. Create a <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>{' '}
          file in the project root with:
        </p>
        <pre className="bg-gray-900 text-emerald-300 text-xs rounded-xl p-4 overflow-x-auto">
{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}
        </pre>
        <p className="text-xs text-gray-500 leading-relaxed">
          Find both values in your Supabase dashboard under{' '}
          <strong>Project Settings → API</strong>. Then restart the dev server
          (<code className="bg-gray-100 px-1 rounded">npm run dev</code>). See{' '}
          <strong>SETUP.md</strong> for the full step-by-step guide.
        </p>
      </div>
    </div>
  );
}
