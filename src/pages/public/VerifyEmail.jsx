import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token found. Please use the link from your email.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (res.ok) {
          setStatus('success');
          setTimeout(() => { window.location.href = '/signin'; }, 3000);
        } else {
          setStatus('error');
          setErrorMsg(data.message || 'This verification link is invalid or has already been used.');
        }
      } catch {
        setStatus('error');
        setErrorMsg('Something went wrong. Please try again or request a new verification email.');
      }
    })();
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
    } catch { /* generic message shown regardless */ }
    setResendSent(true);
    setResendLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center bg-card rounded-2xl p-10 border border-border shadow-xl">

        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-foreground font-bold text-xl">Verifying your email…</h2>
            <p className="text-muted-foreground mt-2 text-sm">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-success" />
            </div>
            <h2 className="text-foreground font-bold text-xl mb-2">Email verified!</h2>
            <p className="text-muted-foreground text-sm mb-6">Your account is now active. Redirecting you to sign in…</p>
            <Link to="/signin" className="bg-primary hover:bg-primary-hover text-foreground font-bold px-8 py-3 rounded-xl transition-colors inline-block">
              Sign In
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-destructive" />
            </div>
            <h2 className="text-foreground font-bold text-xl mb-2">Verification failed</h2>
            <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>

            {!resendSent ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter your email to resend"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {resendLoading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Resend Verification Email'}
                </button>
              </div>
            ) : (
              <p className="text-success text-sm mb-4">
                If that account exists and is unverified, a new link has been sent.
              </p>
            )}

            <Link to="/signin" className="block mt-4 text-primary text-sm hover:underline">
              Back to Sign In
            </Link>
          </>
        )}

      </div>
    </div>
  );
}
