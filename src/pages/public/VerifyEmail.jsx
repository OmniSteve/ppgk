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
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center bg-[#0F2237] rounded-2xl p-10 border border-white/10 shadow-xl">

        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-[#2563EB] animate-spin mx-auto mb-4" />
            <h2 className="text-white font-bold text-xl">Verifying your email…</h2>
            <p className="text-slate-400 mt-2 text-sm">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Email verified!</h2>
            <p className="text-slate-400 text-sm mb-6">Your account is now active. Redirecting you to sign in…</p>
            <Link to="/signin" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-8 py-3 rounded-xl transition-colors inline-block">
              Sign In
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Verification failed</h2>
            <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>

            {!resendSent ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter your email to resend"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {resendLoading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Resend Verification Email'}
                </button>
              </div>
            ) : (
              <p className="text-green-400 text-sm mb-4">
                If that account exists and is unverified, a new link has been sent.
              </p>
            )}

            <Link to="/signin" className="block mt-4 text-[#2563EB] text-sm hover:underline">
              Back to Sign In
            </Link>
          </>
        )}

      </div>
    </div>
  );
}