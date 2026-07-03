import React, { useState, useEffect } from 'react';
import { Search, Calendar, User } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  confirmed: 'bg-green-500/20 text-green-400',
  pending_payment: 'bg-amber-500/20 text-amber-400',
  cancelled_by_client: 'bg-red-500/20 text-red-400',
  cancelled_by_admin: 'bg-red-500/20 text-red-400',
  attended: 'bg-slate-500/20 text-slate-400',
  absent: 'bg-orange-500/20 text-orange-400',
  payment_failed: 'bg-red-500/20 text-red-400',
  rescheduled: 'bg-blue-500/20 text-blue-400',
};

export default function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/admin/bookings?search=${search}&status=${statusFilter}&page=${page}&limit=25`)
      .then((d) => { setBookings(d.bookings || []); setTotal(d.total || 0); })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Bookings</h1>
          <p className="text-slate-400 text-sm">{total} total bookings</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, player or session…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0D1B2A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]">
          <option value="">All statuses</option>
          {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {bookings.length === 0 ? (
            <div className="p-16 text-center"><Calendar size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No bookings found</p></div>
          ) : bookings.map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold leading-none">{new Date(b.sessionDate).getDate()}</span>
                <span className="text-[#2563EB] text-[9px] font-bold uppercase">{new Date(b.sessionDate).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{b.sessionName}</p>
                <div className="flex items-center gap-3 text-slate-400 text-xs mt-0.5">
                  <span className="flex items-center gap-1"><User size={11} />{b.clientName} → {b.playerName}</span>
                  <span>{b.startTime}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-300 text-sm font-semibold">{b.creditsUsed ? `${b.creditsUsed} cr` : b.amountCharged ? `€${b.amountCharged}` : '—'}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[b.status] || 'bg-slate-500/20 text-slate-400'}`}>
                {b.status?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 25)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-50 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}