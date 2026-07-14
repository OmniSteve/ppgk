import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import PlayerCreditSelector from '@/components/credits/PlayerCreditSelector';

const txnColor = {
  purchase: 'bg-success/20 text-success',
  usage: 'bg-destructive/20 text-destructive',
  refund: 'bg-info/20 text-info',
  expiry: 'bg-accent text-muted-foreground',
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
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [grant, setGrant] = useState({ amount: '', reason: '' });
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
      await apiClient.post('/admin/credits/grant', {
        clientId: selectedPlayer.clientId,
        playerId: selectedPlayer.playerId,
        amount: grant.amount,
        reason: grant.reason,
      });
      setShowGrant(false);
      setSelectedPlayer(null);
      setGrant({ amount: '', reason: '' });
      load();
    } catch (err) {
      setGrantError(err.message || 'Failed to grant credits.');
    } finally {
      setGranting(false);
    }
  };

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Credits</h1>
          <p className="text-muted-foreground text-sm">{total} ledger entries</p>
        </div>
        <button onClick={() => { setShowGrant(true); setGrantError(''); }} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
          <Plus size={15} />Grant Credits
        </button>
      </div>

      {showGrant && (
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Grant / Deduct Credits</h2>
            <button onClick={() => setShowGrant(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          {grantError && <p className="text-destructive text-sm">{grantError}</p>}
          <PlayerCreditSelector selected={selectedPlayer} onSelect={setSelectedPlayer} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-muted-foreground text-xs mb-1">Amount (negative to deduct)</label><input type="number" value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: e.target.value })} className={inp} placeholder="e.g. 5 or -2" /></div>
            <div><label className="block text-muted-foreground text-xs mb-1">Reason (required for audit)</label><input value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} className={inp} placeholder="e.g. Goodwill adjustment" /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowGrant(false)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleGrant} disabled={granting || !selectedPlayer || !grant.amount || !grant.reason} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {granting ? <><Loader2 size={14} className="animate-spin" />Processing…</> : 'Submit'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by client name…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All types</option>
          {Object.keys(txnColor).map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {ledger.length === 0 ? (
            <div className="p-16 text-center"><p className="text-muted-foreground">No credit ledger entries found</p></div>
          ) : ledger.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
              <div className="flex-1 min-w-[9rem]">
                <p className="font-bold text-foreground text-sm truncate">{e.clientName}</p>
                <p className="text-muted-foreground text-xs mt-0.5 truncate">{e.description} · {new Date(e.createdAt).toLocaleString('en-MT')}</p>
                {e.expiresAt && <p className="text-muted-foreground text-xs">Expires: {new Date(e.expiresAt).toLocaleDateString('en-MT')}</p>}
              </div>
              <span className={`font-black text-base flex-shrink-0 text-label-mono ${e.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                {e.amount > 0 ? '+' : ''}{e.amount}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${txnColor[e.type] || 'bg-accent text-muted-foreground'}`}>
                {e.type?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 25)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
