import React, { useState, useEffect } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  present: 'bg-green-500/20 text-green-400',
  absent: 'bg-red-500/20 text-red-400',
  late: 'bg-amber-500/20 text-amber-400',
  excused: 'bg-blue-500/20 text-blue-400',
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
        <h1 className="text-2xl font-black text-white">Attendance</h1>
        <p className="text-slate-400 text-sm">{total} attendance records</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by player or session…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]">
          <option value="">All statuses</option>
          {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {records.length === 0 ? (
            <div className="p-16 text-center"><ClipboardList size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No attendance records found</p></div>
          ) : records.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold leading-none">{new Date(r.sessionDate).getDate()}</span>
                <span className="text-slate-400 text-[9px] font-bold uppercase">{new Date(r.sessionDate).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{r.playerName}</p>
                <p className="text-slate-400 text-xs">{r.sessionName} · {r.startTime} · Coach: {r.coachName}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.notes && <span className="text-slate-500 text-xs italic truncate max-w-32">{r.notes}</span>}
                <select value={r.status} onChange={(e) => overrideStatus(r.id, e.target.value)} className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${statusColor[r.status] || 'bg-slate-500/20 text-slate-400'}`}>
                  {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 25)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}