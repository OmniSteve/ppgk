import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useTheme } from '@/contexts/ThemeContext';

const inputCls = 'w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-sm font-medium text-foreground mb-1.5';

export default function AccountDetails() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiClient.get('/account');
        if (!active) return;
        setForm({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          emergencyContactRelation: data.emergencyContactRelation || '',
        });
      } catch (err) {
        // fall back to auth context user
        if (user) setForm(f => ({ ...f, firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '' }));
      }
    })();
    return () => { active = false; };
  }, [user]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false); setLoading(true);
    try {
      const updated = await apiClient.put('/account', form);
      updateUser({ id: user?.id, role: user?.role, ...updated });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-foreground">Account Details</h1>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-success text-sm"><CheckCircle size={16} />Details saved successfully.</div>}
      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>First name</label><input value={form.firstName} onChange={set('firstName')} className={inputCls} /></div>
            <div><label className={labelCls}>Last name</label><input value={form.lastName} onChange={set('lastName')} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Email address</label><input type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
          <div><label className={labelCls}>Mobile number</label><input type="tel" value={form.phone} onChange={set('phone')} className={inputCls} /></div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Name</label><input value={form.emergencyContactName} onChange={set('emergencyContactName')} className={inputCls} /></div>
            <div><label className={labelCls}>Phone</label><input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>Relationship</label><input value={form.emergencyContactRelation} onChange={set('emergencyContactRelation')} placeholder="e.g. Parent, Spouse, Guardian" className={inputCls} /></div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground mb-4">Security</h2>
          <p className="text-muted-foreground text-sm mb-3">To change your password, use the forgot password flow from the sign-in page.</p>
          <a href="/forgot-password" className="text-primary text-sm font-semibold hover:underline">Change Password →</a>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
        </button>
      </form>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Appearance</h2>
        <div className="space-y-2">
          {[
            { id: 'classic',  label: 'Classic dark',   desc: 'Navy background with blue accent — the original PPGK look.' },
            { id: 'floodlit', label: 'Floodlit green', desc: 'Dark pitch green with amber accent and display typography.' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                theme === opt.id ? 'border-primary bg-primary/10' : 'border-border hover:border-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                theme === opt.id ? 'border-primary bg-primary' : 'border-border'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${theme === opt.id ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
