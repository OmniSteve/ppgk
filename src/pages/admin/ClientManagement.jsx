import React, { useState, useEffect } from 'react';
import { Search, Users, Edit2, X, Loader2, CheckCircle, Shield, ChevronDown, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { DeactivateModal, ReactivateModal, PermanentDeleteModal } from '@/components/admin/LifecycleModals';

const ROLES = ['client', 'coach', 'head_coach', 'admin'];
// Role-identity badge colours — intentionally preserved, not mapped to semantic tokens
const roleColors = {
  client: 'bg-blue-500/20 text-blue-400',
  coach: 'bg-purple-500/20 text-purple-400',
  head_coach: 'bg-orange-500/20 text-orange-400',
  admin: 'bg-destructive/20 text-destructive',
};

const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

export default function ClientManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState(null); // { type: 'deactivate'|'reactivate'|'delete', entity }

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/clients?search=${encodeURIComponent(search)}&page=${page}&limit=20${includeInactive ? '&includeInactive=true' : ''}`)
      .then((d) => {
        setUsers(d.clients || []);
        setTotal(d.total || 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page, includeInactive]);

  const openLifecycle = (type, u) => {
    setLifecycleAction({ type, entity: { id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email } });
    setError(''); setSuccess('');
  };

  const handleLifecycleSuccess = (message) => {
    setLifecycleAction(null);
    setSuccess(message);
    load();
  };

  const openEdit = (u) => {
    setForm({ firstName: u.firstName, lastName: u.lastName, phone: u.phone || '', role: u.role, active: u.active !== false });
    setEditing(u);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiClient.patch(`/admin/clients/${editing.id}`, form);
      setSuccess('User updated.');
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm">{total} registered users</p>
        </div>
      </div>

      {success && (
        <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm">
          <CheckCircle size={15} />{success}
        </div>
      )}

      {editing && (
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Edit User — {editing.firstName} {editing.lastName}</h2>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div>
              <label className="block text-muted-foreground text-xs mb-1">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1 flex items-center gap-1"><Shield size={11} />Role</label>
              <div className="relative">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp + ' appearance-none pr-8'}>
                  {ROLES.map((r) => <option key={r} value={r} className="bg-sidebar text-foreground">{r}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="text-foreground text-sm">Account Active</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={includeInactive} onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1); }} className="accent-primary" />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {users.length === 0 ? (
            <div className="p-16 text-center"><Users size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No users found</p></div>
          ) : users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-sm">{u.firstName?.[0]}{u.lastName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-[9rem]">
                <p className="font-bold text-foreground text-sm truncate">{u.firstName} {u.lastName}</p>
                <p className="text-muted-foreground text-xs truncate">{u.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleColors[u.role] || 'bg-accent text-muted-foreground'}`}>
                {u.role}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${u.active !== false ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                {u.active !== false ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <button onClick={() => openEdit(u)} title="Edit" className="w-9 h-9 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <Edit2 size={14} />
                </button>
                {u.active !== false ? (
                  <button onClick={() => openLifecycle('deactivate', u)} title="Deactivate" className="w-9 h-9 rounded-lg bg-accent hover:bg-warning flex items-center justify-center text-muted-foreground hover:text-warning-foreground transition-all">
                    <ShieldOff size={14} />
                  </button>
                ) : (
                  <button onClick={() => openLifecycle('reactivate', u)} title="Reactivate" className="w-9 h-9 rounded-lg bg-accent hover:bg-success flex items-center justify-center text-muted-foreground hover:text-success-foreground transition-all">
                    <ShieldCheck size={14} />
                  </button>
                )}
                <button onClick={() => openLifecycle('delete', u)} title="Permanently delete" className="w-9 h-9 rounded-lg bg-accent hover:bg-destructive flex items-center justify-center text-muted-foreground hover:text-destructive-foreground transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-50 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-50 transition-colors">Next</button>
          </div>
        </div>
      )}

      {lifecycleAction?.type === 'deactivate' && (
        <DeactivateModal entityType="user" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('User deactivated.')} />
      )}
      {lifecycleAction?.type === 'reactivate' && (
        <ReactivateModal entityType="user" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('User reactivated.')} />
      )}
      {lifecycleAction?.type === 'delete' && (
        <PermanentDeleteModal entityType="user" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('User permanently deleted.')} />
      )}
    </div>
  );
}
