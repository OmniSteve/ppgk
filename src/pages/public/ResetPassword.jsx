import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: form.password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Reset failed');
      }
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
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
          <h1 className="text-white font-black text-3xl mb-2">New password</h1>
          <p className="text-slate-400">Choose a strong password</p>
        </div>
        <div className="bg-[#0F2237] rounded-2xl p-8 border border-white/10 shadow-xl">
          {success ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">Password updated!</p>
              <p className="text-slate-400 text-sm">Redirecting to sign in…</p>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-6">{error}</div>}
              {!token && <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm rounded-lg p-3 mb-6">Invalid or missing reset token.</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">New password</label>
                  <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" placeholder="Min. 8 characters" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Confirm password</label>
                  <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" placeholder="Repeat password" />
                </div>
                <button type="submit" disabled={loading || !token} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : 'Update Password'}
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