import React, { useState, useEffect } from 'react';
import { Search, User, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function PlayerManagement() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/players?search=${encodeURIComponent(search)}&page=${page}&limit=20`)
      .then((d) => { setPlayers(d.players || []); setTotal(d.total || 0); })
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Players</h1>
          <p className="text-slate-400 text-sm">{total} player profiles on file</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, club or parent…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {players.length === 0 ? (
            <div className="p-16 text-center">
              <User size={36} className="text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400">No players found</p>
            </div>
          ) : players.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#2563EB] font-bold text-sm">{p.firstName?.[0]}{p.lastName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white text-sm">{p.firstName} {p.lastName}</p>
                  {(p.medicalInfo || p.allergies) && (
                    <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" title="Medical info on file" />
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  {p.dateOfBirth ? `DOB: ${p.dateOfBirth}` : 'No DOB'} · {p.currentClub || 'No club'} · Parent: {p.parentName || '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-slate-300 text-xs font-medium">{p.experienceLevel || '—'}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {p.status || 'unknown'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}