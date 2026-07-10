import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, AlertTriangle, RefreshCw, X, Save, TrendingUp } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];
const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Senior'];

const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1';

function EditModal({ player, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName: player.firstName || '',
    lastName: player.lastName || '',
    dateOfBirth: player.dateOfBirth || '',
    ageGroup: player.ageGroup || '',
    experienceLevel: player.experienceLevel || '',
    currentClub: player.currentClub || '',
    school: player.school || '',
    medicalInfo: player.medicalInfo || '',
    allergies: player.allergies || '',
    emergencyContactName: player.emergencyContactName || '',
    emergencyContactPhone: player.emergencyContactPhone || '',
    emergencyContactRelationship: player.emergencyContactRelationship || '',
    notes: player.notes || '',
    status: player.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await apiClient.patch(`/admin/players/${player.id}`, form);
      onSaved(updated);
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background">
          <h2 className="font-bold text-foreground text-lg">Edit Player — {player.firstName} {player.lastName}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>First Name</label><input className={inputCls} value={form.firstName} onChange={set('firstName')} /></div>
            <div><label className={labelCls}>Last Name</label><input className={inputCls} value={form.lastName} onChange={set('lastName')} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Date of Birth</label><input type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} /></div>
            <div>
              <label className={labelCls}>Age Group</label>
              <select className={inputCls} value={form.ageGroup} onChange={set('ageGroup')}>
                <option value="">— Select —</option>
                {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Experience Level</label>
              <select className={inputCls} value={form.experienceLevel} onChange={set('experienceLevel')}>
                <option value="">— Select —</option>
                {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Current Club</label><input className={inputCls} value={form.currentClub} onChange={set('currentClub')} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>School</label><input className={inputCls} value={form.school} onChange={set('school')} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-warning mb-3 flex items-center gap-1.5"><AlertTriangle size={13} />Medical Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Medical Info</label><textarea className={inputCls} rows={3} value={form.medicalInfo} onChange={set('medicalInfo')} /></div>
              <div><label className={labelCls}>Allergies</label><textarea className={inputCls} rows={3} value={form.allergies} onChange={set('allergies')} /></div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={form.emergencyContactName} onChange={set('emergencyContactName')} /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></div>
              <div className="col-span-2"><label className={labelCls}>Relationship</label><input className={inputCls} value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} placeholder="e.g. Parent" /></div>
            </div>
          </div>

          <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} value={form.notes} onChange={set('notes')} /></div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border sticky bottom-0 bg-background">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-foreground text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
            <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlayerManagement() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/players?search=${encodeURIComponent(search)}&page=${page}&limit=20`)
      .then((d) => { setPlayers(d.players || []); setTotal(d.total || 0); })
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  const handleSaved = (updated) => {
    setPlayers((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Players</h1>
          <p className="text-muted-foreground text-sm">{total} player profiles on file</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, club or parent…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {players.length === 0 ? (
            <div className="p-16 text-center">
              <User size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No players found</p>
            </div>
          ) : players.map((p) => (
            <div key={p.id} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-accent transition-colors">
              <button
                onClick={() => setEditing(p)}
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{p.firstName?.[0]}{p.lastName?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                    {(p.medicalInfo || p.allergies) && (
                      <AlertTriangle size={13} className="text-warning flex-shrink-0" title="Medical info / allergies on file" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {p.dateOfBirth ? `DOB: ${p.dateOfBirth}` : 'No DOB'} · {p.currentClub || 'No club'} · Parent: {p.parentName || '—'}
                  </p>
                </div>
              </button>
              <div className="text-right flex-shrink-0">
                <p className="text-foreground text-xs font-medium">{p.experienceLevel || '—'}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                  {p.status || 'unknown'}
                </span>
              </div>
              <Link
                to={`/admin/players/${p.id}/performance`}
                state={{ player: p }}
                title="Performance evaluations"
                className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-all flex-shrink-0"
              >
                <TrendingUp size={15} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {editing && <EditModal player={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}
