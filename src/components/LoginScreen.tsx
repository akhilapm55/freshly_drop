/**
 * Login gate — shown when no user is signed in.
 * Two ways in: Google (one tap) or email + password (for delivery staff or
 * anyone without a Google account).
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Leaf, Sparkles, Mail, Lock, User as UserIcon, CheckCircle } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Email/password form
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleGoogle() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signInWithGoogle();
      // Redirects to Google, so we usually never reach here.
    } catch (e: any) {
      setError(e?.message || 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password) return setError('Enter your email and password.');
    if (emailMode === 'signup' && !fullName.trim()) return setError('Please enter your name.');
    if (emailMode === 'signup' && password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      if (emailMode === 'signin') {
        await signInWithEmail(email.trim(), password);
        // On success the auth listener swaps this screen for the app.
      } else {
        const sessionStarted = await signUpWithEmail(email.trim(), password, fullName.trim());
        if (!sessionStarted) {
          setInfo('Account created! Check your email to confirm, then sign in.');
          setEmailMode('signin');
          setPassword('');
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-gray-800 outline-hidden';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-radial from-emerald-50 via-[#F8F8F8] to-amber-50 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-96 h-96 bg-[#1B7A36]/5 rounded-full filter blur-3xl -z-1" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#D9AB3B]/5 rounded-full filter blur-3xl -z-1" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-7 space-y-5 relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo size="md" showText={true} />
          <div>
            <h1 className="brand-font text-2xl font-bold text-[#1B7A36]">Welcome to Freshly Drop</h1>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Sign in to shop farm-fresh organic produce, delivered direct from Kerala's local cooperatives.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Leaf, label: '100% Organic' },
            { icon: Sparkles, label: '32 min Express' },
            { icon: ShieldCheck, label: 'Secure Login' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-emerald-50/60 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <Icon className="w-4 h-4 text-[#1B7A36]" />
              <span className="text-[9px] font-bold text-gray-600 leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl shadow-sm flex items-center justify-center gap-3 font-bold text-sm text-gray-700 transition-all active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          id="google-signin-btn"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>{busy ? 'Connecting…' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">or email</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-2.5">
          {emailMode === 'signup' && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" id="login-name" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" id="login-email" autoComplete="email" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" id="login-password" autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 text-white font-semibold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1B7A36' }}
            id="email-submit-btn"
          >
            {busy ? 'Please wait…' : emailMode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <p className="text-[11px] text-center text-gray-500">
          {emailMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setEmailMode(emailMode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
            className="font-semibold text-[#1B7A36] hover:underline cursor-pointer"
            id="toggle-email-mode"
          >
            {emailMode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        {info && (
          <p className="text-[11px] text-emerald-700 font-semibold text-center bg-emerald-50 rounded-lg py-2 px-3 flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> {info}
          </p>
        )}
        {error && (
          <p className="text-[11px] text-red-500 font-semibold text-center bg-red-50 rounded-lg py-2 px-3">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}
