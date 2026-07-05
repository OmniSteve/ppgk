import React, { useState, useEffect } from 'react';
import { Search, Users, Edit2, X, Loader2, CheckCircle, Shield, ChevronDown } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const ROLES = ['client', 'coach', 'head_coach', 'admin'];
const roleColors = {
  client: 'bg-blue-500/20 text-blue-400',
  coach: 'bg-purple-500/20 text-purple-400',
  head_coach: 'bg-orange-500/20 text-orange-400',
  admin: 'bg-red-500/20 text-red-400',
};

const inp = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';

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

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/clients?search=${encodeURIComponent(search)}&page=${page}&limit=20`)
      .then((d) => {
        setUsers(d.clients || []);
        setTotal(d.total || 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

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
          <h1 className="text-2xl font-black text-white">User Management</h1>
          <p className="text-slate-400 text-sm">{total} registered users</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle size={15} />{success}
        </div>
      )}

      {editing && (
        <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Edit User — {editing.firstName} {editing.lastName}</h2>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1 flex items-center gap-1"><Shield size={11} />Role</label>
              <div className="relative">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp + ' appearance-none pr-8'}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#2563EB]" />
            <span className="text-slate-300 text-sm">Account Active</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {users.length === 0 ? (
            <div className="p-16 text-center"><Users size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No users found</p></div>
          ) : users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#2563EB] font-bold text-sm">{u.firstName?.[0]}{u.lastName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{u.firstName} {u.lastName}</p>
                <p className="text-slate-400 text-xs">{u.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleColors[u.role] || 'bg-slate-500/20 text-slate-400'}`}>
                {u.role}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${u.active !== false ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {u.active !== false ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0">
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}