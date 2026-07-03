import React, { useState, useEffect } from 'react';
import { Search, CreditCard, RefreshCw, ExternalLink } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  paid: 'bg-green-500/20 text-green-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-blue-500/20 text-blue-400',
  partial_refund: 'bg-cyan-500/20 text-cyan-400',
  cancelled: 'bg-slate-500/20 text-slate-400',
};

export default function PaymentManagement() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({});

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ search, status: statusFilter, page, limit: 25 }).toString();
    apiClient.get(`/admin/payments?${q}`)
      .then((d) => { setPayments(d.payments || []); setTotal(d.total || 0); setTotals(d.totals || {}); })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter, page]);

  const refund = async (id) => {
    if (!window.confirm('Issue a full refund for this payment?')) return;
    try {
      await apiClient.post(`/admin/payments/${id}/refund`, {});
      load();
    } catch (err) {
      alert(err.message || 'Refund failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Payments</h1>
          <p className="text-slate-400 text-sm">{total} transactions</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {totals.totalPaid !== undefined && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <p className="text-2xl font-black text-white">€{Number(totals.totalPaid || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-0.5">Total Collected</p>
            </div>
          )}
          {totals.totalRefunded !== undefined && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <p className="text-2xl font-black text-blue-400">€{Number(totals.totalRefunded || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-0.5">Total Refunded</p>
            </div>
          )}
          {totals.totalPending !== undefined && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <p className="text-2xl font-black text-amber-400">€{Number(totals.totalPending || 0).toFixed(2)}</p>
              <p className="text-slate-400 text-xs mt-0.5">Pending</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by client, reference…" className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" />
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
          {payments.length === 0 ? (
            <div className="p-16 text-center"><CreditCard size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No payments found</p></div>
          ) : payments.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white text-sm">{p.clientName}</p>
                  <span className="text-slate-500 text-xs font-mono">{p.reference}</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{p.description} · {new Date(p.createdAt).toLocaleString('en-MT')}</p>
              </div>
              <p className="text-white font-bold text-sm flex-shrink-0">€{Number(p.amount || 0).toFixed(2)}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[p.status] || 'bg-slate-500/20 text-slate-400'}`}>
                {p.status?.replace(/_/g, ' ')}
              </span>
              <div className="flex gap-1 flex-shrink-0">
                {p.stripePaymentIntentId && (
                  <a href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <ExternalLink size={13} />
                  </a>
                )}
                {p.status === 'paid' && (
                  <button onClick={() => refund(p.id)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all text-xs font-bold">R</button>
                )}
              </div>
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