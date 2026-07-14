import React, { useState, useEffect } from 'react';
import { Search, Calendar, User } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  confirmed: 'bg-success/20 text-success',
  pending_payment: 'bg-warning/20 text-warning',
  cancelled_by_client: 'bg-destructive/20 text-destructive',
  cancelled_by_admin: 'bg-destructive/20 text-destructive',
  attended: 'bg-accent text-muted-foreground',
  absent: 'bg-orange-500/20 text-orange-400',
  payment_failed: 'bg-destructive/20 text-destructive',
  rescheduled: 'bg-info/20 text-info',
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
    const q = new URLSearchParams({ search, status: statusFilter, page, limit: 25 }).toString();
    apiClient.get(`/admin/bookings?${q}`)
      .then((d) => { setBookings(d.bookings || []); setTotal(d.total || 0); })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Bookings</h1>
          <p className="text-muted-foreground text-sm">{total} total bookings</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by client, player or session…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All statuses</option>
          {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {bookings.length === 0 ? (
            <div className="p-16 text-center">
              <Calendar size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No bookings found</p>
            </div>
          ) : bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-foreground text-xs font-bold leading-none text-label-mono">{new Date(b.sessionDate).getDate()}</span>
                <span className="text-primary text-[9px] font-bold uppercase">{new Date(b.sessionDate).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-[9rem]">
                <p className="font-bold text-foreground text-sm truncate">{b.sessionName}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs mt-0.5">
                  <span className="flex items-center gap-1 min-w-0 truncate"><User size={11} className="flex-shrink-0" />{b.clientName} → {b.playerName}</span>
                  <span>{b.startTime}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-foreground text-sm font-semibold text-label-mono">{b.creditsUsed ? `${b.creditsUsed} cr` : b.amountCharged ? `€${b.amountCharged}` : '—'}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[b.status] || 'bg-accent text-muted-foreground'}`}>
                {b.status?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 25)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
