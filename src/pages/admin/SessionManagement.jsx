import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Edit2, Eye, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColors = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-green-100 text-green-700',
  fully_booked: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-slate-100 text-slate-500',
};

export default function SessionManagement() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchSessions = () => {
    setLoading(true);
    apiClient.get(`/admin/sessions?search=${search}&status=${statusFilter}&page=${page}&limit=20`)
      .then((data) => { setSessions(data.sessions || []); setTotal(data.total || 0); })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, [search, statusFilter, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Sessions</h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} sessions total</p>
        </div>
        <Link to="/admin/sessions/new" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
          <Plus size={16} />
          New Session
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB] transition-colors">
          <option value="">All statuses</option>
          {Object.keys(statusColors).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
          <Calendar size={36} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">No sessions found</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold leading-none">{new Date(s.date).getDate()}</span>
                <span className="text-[#2563EB] text-[9px] font-bold uppercase">{new Date(s.date).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{s.name}</p>
                <div className="flex items-center gap-3 text-slate-400 text-xs mt-0.5">
                  <span className="flex items-center gap-1"><Clock size={11} />{s.startTime}</span>
                  <span className="flex items-center gap-1"><MapPin size={11} />{s.locationName}</span>
                  <span className="flex items-center gap-1"><Users size={11} />{s.bookingCount}/{s.capacity}</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[s.status] || 'bg-slate-100 text-slate-600'}`}>
                {s.status?.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-2">
                <Link to={`/admin/sessions/${s.id}/edit`} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <Edit2 size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}