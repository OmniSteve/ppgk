import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo variant="auth" className="mb-4" />
          <h1 className="text-foreground font-black text-3xl mb-2 text-display">Reset password</h1>
          <p className="text-muted-foreground">We'll send a reset link to your email</p>
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border shadow-xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-success mx-auto mb-4" />
              <p className="text-foreground font-semibold mb-2">Check your email</p>
              <p className="text-muted-foreground text-sm mb-6">If an account exists for {email}, you'll receive a password reset link shortly.</p>
              <Link to="/signin" className="text-primary font-medium hover:underline text-sm">Back to sign in</Link>
            </div>
          ) : (
            <>
              {error && <div className="bg-destructive/20 border border-destructive/30 text-destructive text-sm rounded-lg p-3 mb-6">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-foreground text-sm font-medium mb-2">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" placeholder="you@example.com" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
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
