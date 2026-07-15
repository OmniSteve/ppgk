import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
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
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo variant="auth" className="mb-4" />
          <h1 className="text-foreground font-black text-3xl mb-2 text-display">New password</h1>
          <p className="text-muted-foreground">Choose a strong password</p>
        </div>
        <div className="bg-card rounded-2xl p-8 border border-border shadow-xl">
          {success ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-success mx-auto mb-4" />
              <p className="text-foreground font-semibold mb-2">Password updated!</p>
              <p className="text-muted-foreground text-sm">Redirecting to sign in…</p>
            </div>
          ) : (
            <>
              {error && <div className="bg-destructive/20 border border-destructive/30 text-destructive text-sm rounded-lg p-3 mb-6">{error}</div>}
              {!token && <div className="bg-warning/20 border border-warning/30 text-warning text-sm rounded-lg p-3 mb-6">Invalid or missing reset token.</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-foreground text-sm font-medium mb-2">New password</label>
                  <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" placeholder="Min. 8 characters" />
                </div>
                <div>
                  <label className="block text-foreground text-sm font-medium mb-2">Confirm password</label>
                  <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" placeholder="Repeat password" />
                </div>
                <button type="submit" disabled={loading || !token} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : 'Update Password'}
                </button>
              </form>
              <p className="text-center text-muted-foreground text-sm mt-6">
                <Link to="/signin" className="text-primary font-medium hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
