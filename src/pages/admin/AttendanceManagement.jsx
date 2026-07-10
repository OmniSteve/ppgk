import React, { useState, useEffect } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  present: 'bg-success/20 text-success',
  absent: 'bg-destructive/20 text-destructive',
  late: 'bg-warning/20 text-warning',
  excused: 'bg-info/20 text-info',
};

export default function AttendanceManagement() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ search, dateFrom, dateTo, status: statusFilter, page, limit: 25 }).toString();
    apiClient.get(`/admin/attendance?${q}`)
      .then((d) => { setRecords(d.records || []); setTotal(d.total || 0); })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, dateFrom, dateTo, statusFilter, page]);

  const overrideStatus = async (id, status) => {
    try {
      await apiClient.patch(`/admin/attendance/${id}`, { status });
      load();
    } catch {}
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-foreground">Attendance</h1>
        <p className="text-muted-foreground text-sm">{total} attendance records</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by player or session…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-sidebar border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All statuses</option>
          {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {records.length === 0 ? (
            <div className="p-16 text-center"><ClipboardList size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No attendance records found</p></div>
          ) : records.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent transition-colors">
              <div className="w-10 h-10 rounded-xl bg-accent flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-foreground text-xs font-bold leading-none text-label-mono">{new Date(r.sessionDate).getDate()}</span>
                <span className="text-muted-foreground text-[9px] font-bold uppercase">{new Date(r.sessionDate).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{r.playerName}</p>
                <p className="text-muted-foreground text-xs">{r.sessionName} · {r.startTime} · Coach: {r.coachName}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.notes && <span className="text-muted-foreground text-xs italic truncate max-w-32">{r.notes}</span>}
                <select value={r.status} onChange={(e) => overrideStatus(r.id, e.target.value)} className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${statusColor[r.status] || 'bg-accent text-muted-foreground'}`}>
                  {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
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
