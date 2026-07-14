import React, { useState, useEffect } from 'react';
import { Plus, Tag, Edit2, Loader2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const defaultForm = { name: '', description: '', durationMinutes: 60, defaultCapacity: 10, creditCost: 1, price: '', colour: '#2563EB', active: true };

export default function SessionTypeManagement() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const normalise = (t) => ({
    id: t.id,
    name: t.name ?? '',
    description: t.description ?? '',
    durationMinutes: t.durationMinutes ?? 60,
    defaultCapacity: t.defaultCapacity ?? 10,
    creditCost: t.creditCost ?? 1,
    price: t.price ?? '',
    colour: t.colour ?? '#2563EB',
    active: Boolean(t.active),
  });

  const load = () => {
    setLoading(true);
    apiClient.get('/admin/session-types')
      .then((d) => setTypes((d.sessionTypes || []).map(normalise)))
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (editing === 'new') await apiClient.post('/admin/session-types', form);
      else await apiClient.put(`/admin/session-types/${editing}`, form);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Session Types</h1>
          <p className="text-muted-foreground text-sm">Define training formats and pricing</p>
        </div>
        <button onClick={() => { setForm(defaultForm); setEditing('new'); setError(''); }} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
          <Plus size={15} />New Type
        </button>
      </div>

      {editing && (
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">{editing === 'new' ? 'New Session Type' : 'Edit Session Type'}</h2>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div className="col-span-1 xs:col-span-2"><label className="block text-muted-foreground text-xs mb-1">Type Name</label><input value={form.name} onChange={set('name')} className={inp} placeholder="e.g. Individual Training" /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Duration (minutes)</label><input type="number" value={form.durationMinutes} onChange={set('durationMinutes')} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Default Capacity</label><input type="number" value={form.defaultCapacity} onChange={set('defaultCapacity')} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Credit Cost</label><input type="number" value={form.creditCost} onChange={set('creditCost')} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Drop-in Price (EUR, optional)</label><input type="number" step="0.01" value={form.price} onChange={set('price')} className={inp} placeholder="Leave blank if credits only" /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Colour</label><input type="color" value={form.colour} onChange={set('colour')} className="h-10 w-full rounded-xl border border-border bg-transparent cursor-pointer" /></div>
          </div>
          <div><label className="block text-muted-foreground text-xs mb-1">Description</label><textarea value={form.description} onChange={set('description')} className={inp + ' resize-none'} rows={2} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="text-foreground text-sm">Active</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Type'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {types.length === 0 ? (
            <div className="p-16 text-center"><Tag size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No session types yet</p></div>
          ) : types.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.colour || '#2563EB' }} />
              <div className="flex-1 min-w-[9rem]">
                <p className="font-bold text-foreground text-sm truncate">{t.name}</p>
                <p className="text-muted-foreground text-xs text-label-mono truncate">{t.durationMinutes}min · capacity {t.defaultCapacity} · {t.creditCost} credit{t.creditCost !== 1 ? 's' : ''}{t.price ? ` · €${t.price} drop-in` : ''}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${t.active ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                {t.active ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => { setForm({ ...t }); setEditing(t.id); setError(''); }} className="w-9 h-9 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all flex-shrink-0 ml-auto">
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
