import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Mail, Phone } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function ClientManagement() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/admin/clients?search=${search}&page=${page}&limit=20`)
      .then((d) => {
        const raw = d.clients || [];
        setClients(raw.map((c) => ({ ...c, firstName: c.first_name ?? c.firstName ?? '', lastName: c.last_name ?? c.lastName ?? '', createdAt: c.created_at ?? c.createdAt ?? '' })));
        setTotal(d.total || 0);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [search, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Clients</h1>
          <p className="text-slate-400 text-sm">{total} registered clients</p>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {clients.length === 0 ? (
            <div className="p-16 text-center"><Users size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No clients found</p></div>
          ) : clients.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#2563EB] font-bold text-sm">{c.firstName?.[0]}{c.lastName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{c.firstName} {c.lastName}</p>
                <div className="flex items-center gap-3 text-slate-400 text-xs mt-0.5">
                  <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>
                  {c.mobile && <span className="flex items-center gap-1"><Phone size={11} />{c.mobile}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-300 text-sm font-semibold">{c.playerCount} player{c.playerCount !== 1 ? 's' : ''}</p>
                <p className="text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-MT')}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {c.status}
              </span>
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