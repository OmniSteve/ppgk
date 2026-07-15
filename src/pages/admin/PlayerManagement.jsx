import React, { useState, useEffect } from 'react';
import { Search, User, AlertTriangle, RefreshCw, X, Save, TrendingUp, CheckCircle, ShieldOff, ShieldCheck, Trash2, ChevronDown, Edit2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { DeactivateModal, ReactivateModal, PermanentDeleteModal } from '@/components/admin/LifecycleModals';
import { AdminActionButton } from '@/components/admin/AdminActionButton';

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

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div><label className={labelCls}>First Name</label><input className={inputCls} value={form.firstName} onChange={set('firstName')} /></div>
            <div><label className={labelCls}>Last Name</label><input className={inputCls} value={form.lastName} onChange={set('lastName')} /></div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div><label className={labelCls}>Date of Birth</label><input type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} /></div>
            <div>
              <label className={labelCls}>Age Group</label>
              <select className={inputCls} value={form.ageGroup} onChange={set('ageGroup')}>
                <option value="">— Select —</option>
                {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Experience Level</label>
              <select className={inputCls} value={form.experienceLevel} onChange={set('experienceLevel')}>
                <option value="">— Select —</option>
                {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Current Club</label><input className={inputCls} value={form.currentClub} onChange={set('currentClub')} /></div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div><label className={labelCls}>Medical Info</label><textarea className={inputCls} rows={3} value={form.medicalInfo} onChange={set('medicalInfo')} /></div>
              <div><label className={labelCls}>Allergies</label><textarea className={inputCls} rows={3} value={form.allergies} onChange={set('allergies')} /></div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Emergency Contact</p>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={form.emergencyContactName} onChange={set('emergencyContactName')} /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></div>
              <div className="col-span-1 xs:col-span-2"><label className={labelCls}>Relationship</label><input className={inputCls} value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} placeholder="e.g. Parent" /></div>
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
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'inactive' | 'archived' | 'all'
  const [success, setSuccess] = useState('');
  const [lifecycleAction, setLifecycleAction] = useState(null); // { type: 'deactivate'|'reactivate'|'delete', entity }

  const load = () => {
    setLoading(true);
    const statusParam = statusFilter === 'all' ? '&includeInactive=true' : statusFilter === 'active' ? '' : `&status=${statusFilter}`;
    apiClient.get(`/admin/players?search=${encodeURIComponent(search)}&page=${page}&limit=20${statusParam}`)
      .then((d) => { setPlayers(d.players || []); setTotal(d.total || 0); })
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page, statusFilter]);

  const handleSaved = (updated) => {
    setPlayers((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditing(null);
  };

  const openLifecycle = (type, p) => {
    setLifecycleAction({ type, entity: { id: p.id, name: `${p.firstName} ${p.lastName}`, clientId: p.clientId } });
    setSuccess('');
  };

  const handleLifecycleSuccess = (message) => {
    setLifecycleAction(null);
    setSuccess(message);
    load();
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

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, club or parent…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="relative flex-shrink-0">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="bg-card border border-border rounded-xl pl-4 pr-9 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:border-primary transition-colors">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {players.length === 0 ? (
            <div className="p-16 text-center">
              <User size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No players found</p>
            </div>
          ) : players.map((p) => {
            const statusBadge = (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${p.status === 'active' ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                {p.status || 'unknown'}
              </span>
            );
            const hasWarning = p.medicalInfo || p.allergies;
            return (
            <div key={p.id} className="px-5 py-4 hover:bg-accent transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {/* Header: avatar + name (badges inline on mobile only) */}
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{p.firstName?.[0]}{p.lastName?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-bold text-foreground text-sm break-words">{p.firstName} {p.lastName}</p>
                      {hasWarning && <AlertTriangle size={13} className="text-warning flex-shrink-0" title="Medical info / allergies on file" />}
                      <span className="sm:hidden">{statusBadge}</span>
                      {p.experienceLevel && (
                        <span className="sm:hidden text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground flex-shrink-0">{p.experienceLevel}</span>
                      )}
                    </div>
                    {/* Desktop-only compact detail line */}
                    <p className="hidden sm:block text-muted-foreground text-xs mt-0.5 truncate">
                      {p.dateOfBirth ? `DOB: ${p.dateOfBirth}` : 'No DOB'} · {p.currentClub || 'No club'} · Parent: {p.parentName || '—'}
                    </p>
                  </div>
                </div>

                {/* Desktop-only status/level column (original position) */}
                <div className="hidden sm:flex sm:flex-col sm:items-end text-right flex-shrink-0">
                  <p className="text-foreground text-xs font-medium">{p.experienceLevel || '—'}</p>
                  {statusBadge}
                </div>

                {/* Mobile-only details */}
                <div className="sm:hidden grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Date of birth</span>
                  <span className="text-foreground">{p.dateOfBirth || '—'}</span>
                  <span className="text-muted-foreground">Club</span>
                  <span className="text-foreground break-words">{p.currentClub || '—'}</span>
                  <span className="text-muted-foreground">Parent</span>
                  <span className="text-foreground break-words">{p.parentName || '—'}</span>
                  {hasWarning && (
                    <>
                      <span className="text-warning flex items-center gap-1"><AlertTriangle size={12} />Alert</span>
                      <span className="text-warning">Medical info / allergies on file</span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/60 sm:flex sm:items-center sm:gap-2 sm:pt-0 sm:border-t-0 sm:flex-shrink-0">
                  <AdminActionButton icon={Edit2} label="Edit player" onClick={() => setEditing(p)} className="w-full h-11 sm:w-9 sm:h-9" />
                  <AdminActionButton icon={TrendingUp} label="Performance evaluations" to={{ pathname: `/admin/players/${p.id}/performance`, state: { player: p } }} className="w-full h-11 sm:w-9 sm:h-9" />
                  {p.status === 'active' ? (
                    <AdminActionButton icon={ShieldOff} label="Deactivate player" variant="warning" onClick={() => openLifecycle('deactivate', p)} className="w-full h-11 sm:w-9 sm:h-9" />
                  ) : (
                    <AdminActionButton icon={ShieldCheck} label="Reactivate player" variant="success" onClick={() => openLifecycle('reactivate', p)} className="w-full h-11 sm:w-9 sm:h-9" />
                  )}
                  <AdminActionButton icon={Trash2} label="Permanently delete player" variant="destructive" onClick={() => openLifecycle('delete', p)} className="w-full h-11 sm:w-9 sm:h-9" />
                </div>
              </div>
            </div>
            );
          })}
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

      {lifecycleAction?.type === 'deactivate' && (
        <DeactivateModal entityType="player" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Player deactivated.')} />
      )}
      {lifecycleAction?.type === 'reactivate' && (
        <ReactivateModal entityType="player" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Player reactivated.')} />
      )}
      {lifecycleAction?.type === 'delete' && (
        <PermanentDeleteModal entityType="player" entity={lifecycleAction.entity}
          onClose={() => setLifecycleAction(null)} onSuccess={() => handleLifecycleSuccess('Player permanently deleted.')} />
      )}
    </div>
  );
}
