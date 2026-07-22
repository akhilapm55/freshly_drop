import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen';

/** Decides what to render based on auth state. */
function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1B7A36]/20 border-t-[#1B7A36] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loading Freshly Drop…</span>
        </div>
      </div>
    );
  }

  return user ? <App /> : <LoginScreen />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <Root />
      </AuthProvider>
    ) : (
      <SetupScreen />
    )}
  </StrictMode>,
);
