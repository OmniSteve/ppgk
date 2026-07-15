import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Edit2, Calendar, Clock, MapPin, Users, ClipboardList } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColors = {
  draft: 'bg-accent text-muted-foreground',
  published: 'bg-success/20 text-success',
  fully_booked: 'bg-info/20 text-info',
  cancelled: 'bg-destructive/20 text-destructive',
  completed: 'bg-accent text-muted-foreground',
};

export default function SessionManagement() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (s) => {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    setDeleting(s.id);
    try {
      await apiClient.delete(`/admin/sessions/${s.id}`);
      fetchSessions();
    } catch (e) {
      alert(e.message || 'Failed to delete session');
    } finally {
      setDeleting(null);
    }
  };

  const fetchSessions = () => {
    setLoading(true);
    apiClient.get(`/admin/sessions?search=${search}&status=${statusFilter}&page=${page}&limit=20`)
      .then((data) => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.sessions) ? data.sessions : []);
        setSessions(list);
        setTotal(data?.total || list.length);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, [search, statusFilter, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Sessions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} sessions total</p>
        </div>
        <Link to="/admin/sessions/new" className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
          <Plus size={16} />
          New Session
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
          <option value="">All statuses</option>
          {Object.keys(statusColors).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <Calendar size={36} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No sessions found</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-foreground text-xs font-bold leading-none text-label-mono">{new Date(s.sessionDate).getDate()}</span>
              <span className="text-primary text-[9px] font-bold uppercase">{new Date(s.sessionDate).toLocaleString('en', { month: 'short' })}</span>
            </div>
            <div className="flex-1 min-w-[9rem]">
              <p className="font-bold text-foreground text-sm truncate">{s.title}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs mt-0.5 min-w-0">
                <span className="flex items-center gap-1"><Clock size={11} />{s.startTime}</span>
                <span className="flex items-center gap-1 min-w-0 truncate"><MapPin size={11} className="flex-shrink-0" />{s.locationName}</span>
                <span className="flex items-center gap-1 text-label-mono"><Users size={11} />{s.bookedCount}/{s.capacity}</span>
                {s.bookingMode === 'request' && (
                  <span className="text-warning font-semibold">Request only</span>
                )}
              </div>
            </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[s.status] || 'bg-accent text-muted-foreground'}`}>
                {s.status?.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                {s.bookingMode === 'request' && (
                  <Link to={`/coach/sessions/${s.id}/attendees`} className="w-9 h-9 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all" title="Manage roster">
                    <ClipboardList size={14} />
                  </Link>
                )}
                <Link to={`/admin/sessions/${s.id}/edit`} className="w-9 h-9 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <Edit2 size={14} />
                </Link>
                <button onClick={() => handleDelete(s)} disabled={deleting === s.id} className="w-9 h-9 rounded-lg bg-accent hover:bg-destructive flex items-center justify-center text-muted-foreground hover:text-foreground transition-all disabled:opacity-50">
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-50 transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-50 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
