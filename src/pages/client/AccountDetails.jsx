import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const inputCls = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

export default function AccountDetails() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', mobile: '', emergencyContactName: '', emergencyContactPhone: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', mobile: user.mobile || '', emergencyContactName: user.emergencyContactName || '', emergencyContactPhone: user.emergencyContactPhone || '' });
  }, [user]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false); setLoading(true);
    try {
      const updated = await apiClient.put('/account', form);
      updateUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-white">Account Details</h1>

      {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />Details saved successfully.</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>First name</label><input value={form.firstName} onChange={set('firstName')} className={inputCls} /></div>
            <div><label className={labelCls}>Last name</label><input value={form.lastName} onChange={set('lastName')} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Email address</label><input type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
          <div><label className={labelCls}>Mobile number</label><input type="tel" value={form.mobile} onChange={set('mobile')} className={inputCls} /></div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500">Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Name</label><input value={form.emergencyContactName} onChange={set('emergencyContactName')} className={inputCls} /></div>
            <div><label className={labelCls}>Phone</label><input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} className={inputCls} /></div>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500 mb-4">Security</h2>
          <p className="text-slate-400 text-sm mb-3">To change your password, use the forgot password flow from the sign-in page.</p>
          <a href="/forgot-password" className="text-[#2563EB] text-sm font-semibold hover:underline">Change Password →</a>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}