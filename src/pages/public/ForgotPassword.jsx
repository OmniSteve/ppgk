import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl">GK</span>
          </div>
          <h1 className="text-white font-black text-3xl mb-2">Reset password</h1>
          <p className="text-slate-400">We'll send a reset link to your email</p>
        </div>

        <div className="bg-[#0F2237] rounded-2xl p-8 border border-white/10 shadow-xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">Check your email</p>
              <p className="text-slate-400 text-sm mb-6">If an account exists for {email}, you'll receive a password reset link shortly.</p>
              <Link to="/signin" className="text-[#2563EB] font-medium hover:underline text-sm">Back to sign in</Link>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-6">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" placeholder="you@example.com" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
                </button>
              </form>
              <p className="text-center text-slate-400 text-sm mt-6">
                <Link to="/signin" className="text-[#2563EB] font-medium hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}