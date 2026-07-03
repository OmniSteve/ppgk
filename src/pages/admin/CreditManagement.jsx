import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const txnColor = {
  purchase: 'bg-green-500/20 text-green-400',
  usage: 'bg-red-500/20 text-red-400',
  refund: 'bg-blue-500/20 text-blue-400',
  expiry: 'bg-slate-500/20 text-slate-400',
  admin_grant: 'bg-purple-500/20 text-purple-400',
  admin_deduct: 'bg-orange-500/20 text-orange-400',
};

export default function CreditManagement() {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showGrant, setShowGrant] = useState(false);
  const [grant, setGrant] = useState({ clientId: '', amount: '', reason: '' });
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ search, type: typeFilter, page, limit: 25 }).toString();
    apiClient.get(`/admin/credits?${q}`)
      .then((d) => { setLedger(d.entries || []); setTotal(d.total || 0); })
      .catch(() => setLedger([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, typeFilter, page]);

  const handleGrant = async () => {
    setGranting(true); setGrantError('');
    try {
      await apiClient.post('/admin/credits/grant', grant);
      setShowGrant(false);
      setGrant({ clientId: '', amount: '', reason: '' });
      load();
    } catch (err) {
      setGrantError(err.message || 'Failed to grant credits.');
    } finally {
      setGranting(false);
    }
  };

  const inp = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Credits</h1>
          <p className="text-slate-400 text-sm">{total} ledger entries</p>
        </div>
        <button onClick={() => { setShowGrant(true); setGrantError(''); }} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
          <Plus size={15} />Grant Credits
        </button>
      </div>

      {showGrant && (
        <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Grant / Deduct Credits</h2>
            <button onClick={() => setShowGrant(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          {grantError && <p className="text-red-400 text-sm">{grantError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-slate-400 text-xs mb-1">Client ID</label><input value={grant.clientId} onChange={(e) => setGrant({ ...grant, clientId: e.target.value })} className={inp} placeholder="Client UUID" /></div>
            <div><label className="block text-slate-400 text-xs mb-1">Amount (negative to deduct)</label><input type="number" value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: e.target.value })} className={inp} placeholder="e.g. 5 or -2" /></div>
          </div>
          <div><label className="block text-slate-400 text-xs mb-1">Reason (required for audit)</label><input value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} className={inp} placeholder="e.g. Goodwill adjustment" /></div>
          <div className="flex gap-3">
            <button onClick={() => setShowGrant(false)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={handleGrant} disabled={granting || !grant.clientId || !grant.amount || !grant.reason} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {granting ? <><Loader2 size={14} className="animate-spin" />Processing…</> : 'Submit'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by client name…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-[#0D1B2A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#2563EB]">
          <option value="">All types</option>
          {Object.keys(txnColor).map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          {ledger.length === 0 ? (
            <div className="p-16 text-center"><p className="text-slate-400">No credit ledger entries found</p></div>
          ) : ledger.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{e.clientName}</p>
                <p className="text-slate-400 text-xs mt-0.5">{e.description} · {new Date(e.createdAt).toLocaleString('en-MT')}</p>
                {e.expiresAt && <p className="text-slate-500 text-xs">Expires: {new Date(e.expiresAt).toLocaleDateString('en-MT')}</p>}
              </div>
              <span className={`font-black text-base flex-shrink-0 ${e.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {e.amount > 0 ? '+' : ''}{e.amount}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${txnColor[e.type] || 'bg-slate-500/20 text-slate-400'}`}>
                {e.type?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 25)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}