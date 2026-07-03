import React, { useState, useEffect } from 'react';
import { Plus, Package, Edit2, ToggleLeft, ToggleRight, Loader2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import AdminLayout from '@/components/layouts/AdminLayout';

const defaultPkg = { name: '', description: '', credits: '', price: '', validityMonths: 3, eligibleSessionTypes: '', eligibleLocations: '', active: true };

export default function PackageManagement() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultPkg);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    apiClient.get('/admin/packages').then(setPackages).catch(() => setPackages([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    setError(''); setSaving(true);
    try {
      if (editing === 'new') await apiClient.post('/admin/packages', form);
      else await apiClient.put(`/admin/packages/${editing}`, form);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pkg) => {
    try {
      await apiClient.patch(`/admin/packages/${pkg.id}`, { active: !pkg.active });
      load();
    } catch {}
  };

  const inp = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Packages</h1>
            <p className="text-slate-400 text-sm">Session credit packages</p>
          </div>
          <button onClick={() => { setForm(defaultPkg); setEditing('new'); setError(''); }} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
            <Plus size={16} />New Package
          </button>
        </div>

        {editing && (
          <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">{editing === 'new' ? 'New Package' : 'Edit Package'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-slate-300 text-xs font-medium mb-1">Package Name</label><input value={form.name} onChange={set('name')} className={inp} placeholder="e.g. Monthly Bundle" /></div>
              <div><label className="block text-slate-300 text-xs font-medium mb-1">Credits</label><input type="number" value={form.credits} onChange={set('credits')} className={inp} placeholder="e.g. 8" /></div>
              <div><label className="block text-slate-300 text-xs font-medium mb-1">Price (EUR)</label><input type="number" step="0.01" value={form.price} onChange={set('price')} className={inp} placeholder="0.00" /></div>
              <div><label className="block text-slate-300 text-xs font-medium mb-1">Validity (months)</label><input type="number" value={form.validityMonths} onChange={set('validityMonths')} className={inp} /></div>
            </div>
            <div><label className="block text-slate-300 text-xs font-medium mb-1">Description</label><textarea value={form.description} onChange={set('description')} className={inp + ' resize-none'} rows={2} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#2563EB]" />
              <span className="text-slate-300 text-sm">Active (visible to clients)</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={15} className="animate-spin" />Saving…</> : 'Save Package'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
        ) : packages.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
            <Package size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No packages yet</p>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{pkg.name}</p>
                  <p className="text-slate-400 text-xs">{pkg.credits} credits · €{pkg.price} · {pkg.validityMonths} months</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pkg.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {pkg.active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(pkg)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    {pkg.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => { setForm({ ...pkg }); setEditing(pkg.id); setError(''); }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}