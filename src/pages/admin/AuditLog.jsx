import React, { useState, useEffect } from 'react';
import { Search, FileText } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import AdminLayout from '@/components/layouts/AdminLayout';

const actionColors = {
  create:   'bg-green-500/20 text-green-400',
  update:   'bg-blue-500/20 text-blue-400',
  delete:   'bg-red-500/20 text-red-400',
  cancel:   'bg-red-500/20 text-red-400',
  override: 'bg-amber-500/20 text-amber-400',
  payment:  'bg-purple-500/20 text-purple-400',
  credit:   'bg-cyan-500/20 text-cyan-400',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recordType, setRecordType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ search, recordType, page, limit: 25 }).toString();
    apiClient.get(`/admin/audit?${q}`)
      .then((d) => { setLogs(d.logs || []); setTotal(d.total || 0); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [search, recordType, page]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black text-white">Audit Log</h1>
          <p className="text-slate-400 text-sm">{total} audit records</p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search audit log…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
          </div>
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="bg-[#0D1B2A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]">
            <option value="">All types</option>
            {['booking','session','payment','credit','player','user','package','attendance'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
            <FileText size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No audit records found</p>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionColors[log.action?.split('_')[0]] || 'bg-slate-500/20 text-slate-400'}`}>
                      {log.action?.replace(/_/g, ' ')}
                    </span>
                    <span className="bg-slate-500/20 text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full capitalize">{log.recordType}</span>
                    <span className="text-white font-bold text-sm">{log.description}</span>
                  </div>
                  <p className="text-slate-500 text-xs whitespace-nowrap flex-shrink-0">{new Date(log.createdAt).toLocaleString('en-MT')}</p>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-xs">
                  <span>by {log.actorName || 'System'}</span>
                  {log.recordId && <span>· ID: {log.recordId}</span>}
                  {log.reason && <span>· Reason: {log.reason}</span>}
                </div>
                {(log.previousValue || log.newValue) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {log.previousValue && <div className="bg-red-500/10 rounded-lg px-3 py-2 text-xs text-red-300"><span className="font-semibold block">Before</span>{log.previousValue}</div>}
                    {log.newValue && <div className="bg-green-500/10 rounded-lg px-3 py-2 text-xs text-green-300"><span className="font-semibold block">After</span>{log.newValue}</div>}
                  </div>
                )}
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
    </AdminLayout>
  );
}