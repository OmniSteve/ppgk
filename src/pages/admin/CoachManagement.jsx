import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Loader2, X, CheckCircle, RefreshCw, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { DeactivateModal, ReactivateModal, PermanentDeleteModal } from '@/components/admin/LifecycleModals';
import { AdminActionButton } from '@/components/admin/AdminActionButton';

const defaultForm = { firstName: '', lastName: '', email: '', phone: '', bio: '', specialisations: '', active: true };

export default function CoachManagement() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState(null); // { type: 'deactivate'|'reactivate'|'delete', entity }

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/coaches?search=${encodeURIComponent(search)}${includeInactive ? '&includeInactive=true' : ''}`)
      .then((d) => setCoaches(d.coaches || []))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, includeInactive]);

  const openLifecycle = (type, c) => {
    setLifecycleAction({ type, entity: { id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email } });
    setError(''); setSuccess('');
  };

  const handleLifecycleSuccess = (message) => {
    setLifecycleAction(null);
    setSuccess(message);
    load();
  };

  const handleSync = async () => {
    setSyncing(true); setError(''); setSuccess('');
    try {
      const res = await apiClient.post('/admin/coaches/sync', {});
      setSuccess(`Synced ${res.synced} coach profile(s) from user roles.`);
      load();
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

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

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Coaches</h1>
          <p className="text-muted-foreground text-sm">{coaches.length} coaches registered</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSync} disabled={syncing} className="border border-border hover:bg-accent text-foreground font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />Sync from Roles
          </button>
          <button onClick={openNew} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            <Plus size={15} />New Coach
          </button>
        </div>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      {editing && (
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">{editing === 'new' ? 'New Coach' : 'Edit Coach'}</h2>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div><label className="block text-muted-foreground text-xs mb-1">First Name</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Last Name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} /></div>
          </div>
          <div><label className="block text-muted-foreground text-xs mb-1">Specialisations</label><input value={form.specialisations} onChange={(e) => setForm({ ...form, specialisations: e.target.value })} className={inp} placeholder="e.g. Shot-stopping, Distribution" /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Bio</label><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={inp + ' resize-none'} rows={3} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="text-foreground text-sm">Active</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Coach'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coaches…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="accent-primary" />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {coaches.length === 0 ? (
            <div className="p-16 text-center"><p className="text-muted-foreground">No coaches found</p></div>
          ) : coaches.map((c) => {
            const statusBadge = (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${c.active ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                {c.active ? 'Active' : 'Inactive'}
              </span>
            );
            return (
            <div key={c.id} className="px-5 py-4 hover:bg-accent transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {/* Header: avatar + name (status badge inline on mobile only) */}
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{c.firstName?.[0]}{c.lastName?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-bold text-foreground text-sm break-words">{c.firstName} {c.lastName}</p>
                      <span className="sm:hidden">{statusBadge}</span>
                    </div>
                    {/* Desktop-only compact detail line */}
                    <p className="hidden sm:block text-muted-foreground text-xs truncate" title={`${c.email || ''} · ${c.specialisations || 'No specialisations listed'}`}>
                      {c.email} · {c.specialisations || 'No specialisations listed'}
                    </p>
                  </div>
                </div>

                {/* Desktop-only status badge (original position) */}
                <span className="hidden sm:inline-flex">{statusBadge}</span>

                {/* Mobile-only details */}
                <div className="sm:hidden grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground break-words">{c.email || '—'}</span>
                  <span className="text-muted-foreground">Specialisations</span>
                  <span className="text-foreground break-words">{c.specialisations || '—'}</span>
                  <span className="text-muted-foreground">Linked user</span>
                  <span className="text-foreground">{c.userId ? 'Yes' : 'No — standalone profile'}</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60 sm:flex sm:items-center sm:gap-2 sm:pt-0 sm:border-t-0 sm:flex-shrink-0">
                  <AdminActionButton icon={Edit2} label="Edit coach" onClick={() => openEdit(c)} className="w-full h-11 sm:w-8 sm:h-8" />
                  {c.active ? (
                    <AdminActionButton icon={ShieldOff} label="Deactivate coach" variant="warning" onClick={() => openLifecycle('deactivate', c)} className="w-full h-11 sm:w-8 sm:h-8" />
                  ) : (
                    <AdminActionButton icon={ShieldCheck} label="Reactivate coach" variant="success" onClick={() => openLifecycle('reactivate', c)} className="w-full h-11 sm:w-8 sm:h-8" />
                  )}
                  <AdminActionButton icon={Trash2} label="Permanently delete coach" variant="destructive" onClick={() => openLifecycle('delete', c)} className="w-full h-11 sm:w-8 sm:h-8" />
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {lifecycleAction?.type === 'deactivate' && (
        <DeactivateModal entityType="coach" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Coach deactivated.')} />
      )}
      {lifecycleAction?.type === 'reactivate' && (
        <ReactivateModal entityType="coach" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Coach reactivated.')} />
      )}
      {lifecycleAction?.type === 'delete' && (
        <PermanentDeleteModal entityType="coach" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Coach permanently deleted.')} />
      )}
    </div>
  );
}
