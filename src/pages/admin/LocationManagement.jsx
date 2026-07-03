import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Edit2, Loader2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import AdminLayout from '@/components/layouts/AdminLayout';

const defaultForm = { name: '', addressLine1: '', addressLine2: '', city: '', postCode: '', mapUrl: '', notes: '', active: true };

export default function LocationManagement() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    apiClient.get('/admin/locations')
      .then((d) => setLocations(d.locations || []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (editing === 'new') await apiClient.post('/admin/locations', form);
      else await apiClient.put(`/admin/locations/${editing}`, form);
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
            <h1 className="text-2xl font-black text-white">Locations</h1>
            <p className="text-slate-400 text-sm">Training venues and pitches</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditing('new'); setError(''); }} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
            <Plus size={15} />New Location
          </button>
        </div>

        {editing && (
          <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">{editing === 'new' ? 'New Location' : 'Edit Location'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div><label className="block text-slate-400 text-xs mb-1">Venue Name</label><input value={form.name} onChange={set('name')} className={inp} placeholder="e.g. Marsa Sports Complex" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-slate-400 text-xs mb-1">Address Line 1</label><input value={form.addressLine1} onChange={set('addressLine1')} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">Address Line 2</label><input value={form.addressLine2} onChange={set('addressLine2')} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">City / Area</label><input value={form.city} onChange={set('city')} className={inp} /></div>
              <div><label className="block text-slate-400 text-xs mb-1">Post Code</label><input value={form.postCode} onChange={set('postCode')} className={inp} /></div>
            </div>
            <div><label className="block text-slate-400 text-xs mb-1">Google Maps URL</label><input value={form.mapUrl} onChange={set('mapUrl')} className={inp} placeholder="https://maps.google.com/…" /></div>
            <div><label className="block text-slate-400 text-xs mb-1">Notes (directions, parking, etc.)</label><textarea value={form.notes} onChange={set('notes')} className={inp + ' resize-none'} rows={2} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#2563EB]" />
              <span className="text-slate-300 text-sm">Active</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Location'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
            {locations.length === 0 ? (
              <div className="p-16 text-center"><MapPin size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No locations yet</p></div>
            ) : locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{loc.name}</p>
                  <p className="text-slate-400 text-xs">{[loc.addressLine1, loc.city, loc.postCode].filter(Boolean).join(', ')}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${loc.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {loc.active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => { setForm({ ...loc }); setEditing(loc.id); setError(''); }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0">
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