import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Loader2, X, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import AdminLayout from '@/components/layouts/AdminLayout';

const defaultForm = { firstName: '', lastName: '', email: '', phone: '', bio: '', specialisations: '', active: true };

export default function CoachManagement() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | coach id
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/coaches?search=${encodeURIComponent(search)}`)
      .then((d) => setCoaches(d.coaches || []))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openNew = () => { setForm(defaultForm); setEditing('new'); setError(''); setSuccess(''); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); setError(''); setSuccess(''); };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      if (editing === 'new') {
        await apiClient.post('/admin/coaches', form);
        setSuccess('Coach created.');
      } else {
        await apiClient.put(`/admin/coaches/${editing}`, form);
        setSuccess('Coach updated.');
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Coaches</h1>
            <p className="text-slate-400 text-sm">{coaches.length} coaches registered</p>
          </div>
          <button onClick={openNew} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
            <Plus size={15} />New Coach
          </button>
        </div>

        {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={15} />{success}</div>}

        {editing && (
          <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">{editing === 'new' ? 'New Coach' : 'Edit Coach'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-slate-400 text-xs mb-1">First Name</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">Last Name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} /></div>
            </div>
            <div><label className="block text-slate-400 text-xs mb-1">Specialisations</label><input value={form.specialisations} onChange={(e) => setForm({ ...form, specialisations: e.target.value })} className={inp} placeholder="e.g. Shot-stopping, Distribution" /></div>
            <div><label className="block text-slate-400 text-xs mb-1">Bio</label><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={inp + ' resize-none'} rows={3} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#2563EB]" />
              <span className="text-slate-300 text-sm">Active</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Coach'}
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coaches…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
            {coaches.length === 0 ? (
              <div className="p-16 text-center"><p className="text-slate-400">No coaches found</p></div>
            ) : coaches.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#2563EB] font-bold text-sm">{c.firstName?.[0]}{c.lastName?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{c.firstName} {c.lastName}</p>
                  <p className="text-slate-400 text-xs">{c.email} · {c.specialisations || 'No specialisations listed'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${c.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0">
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}