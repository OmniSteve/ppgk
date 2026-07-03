import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', mobile: '',
    password: '', confirmPassword: '',
    emergencyContactName: '', emergencyContactPhone: '',
    consentTerms: false, consentPrivacy: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!form.consentTerms || !form.consentPrivacy) return setError('You must accept the terms and privacy notice.');
    setLoading(true);
    try {
      await register(form);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="text-white font-black text-2xl mb-3">Account created!</h2>
          <p className="text-slate-400 mb-6">Please check your email to verify your account, then sign in.</p>
          <Link to="/signin" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-8 py-3 rounded-xl transition-colors inline-block">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl">GK</span>
          </div>
          <h1 className="text-white font-black text-3xl mb-2">Create account</h1>
          <p className="text-slate-400">Join Premier Performance Goalkeeping</p>
        </div>

        <div className="bg-[#0F2237] rounded-2xl p-8 border border-white/10 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">First name</label>
                <input required value={form.firstName} onChange={set('firstName')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="First name" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Last name</label>
                <input required value={form.lastName} onChange={set('lastName')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="Last name" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email address</label>
              <input type="email" required value={form.email} onChange={set('email')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Mobile number</label>
              <input type="tel" required value={form.mobile} onChange={set('mobile')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="+356 7900 0000" />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={set('password')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Confirm password</label>
              <input type="password" required value={form.confirmPassword} onChange={set('confirmPassword')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="Repeat password" />
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wide">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input value={form.emergencyContactName} onChange={set('emergencyContactName')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="Contact name" />
                </div>
                <div>
                  <input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-sm" placeholder="Contact phone" />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.consentTerms} onChange={set('consentTerms')} className="mt-0.5 w-4 h-4 accent-[#2563EB]" />
                <span className="text-slate-400 text-sm">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-[#2563EB] hover:underline">Terms and Conditions</Link>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.consentPrivacy} onChange={set('consentPrivacy')} className="mt-0.5 w-4 h-4 accent-[#2563EB]" />
                <span className="text-slate-400 text-sm">
                  I have read and accept the{' '}
                  <Link to="/privacy" target="_blank" className="text-[#2563EB] hover:underline">Privacy Notice</Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account…</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/signin" className="text-[#2563EB] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}