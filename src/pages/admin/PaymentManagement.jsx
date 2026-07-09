import React, { useState, useEffect } from 'react';
import { Search, CreditCard, RefreshCw, ExternalLink, AlertTriangle, X } from 'lucide-react';
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

  // ── Refund dialog state ────────────────────────────────────────────────────
  const [refundTarget, setRefundTarget] = useState(null);   // payment being refunded
  const [refundAmount, setRefundAmount] = useState('');
  const [keepCredits, setKeepCredits]   = useState(false);
  const [adminNote, setAdminNote]       = useState('');
  const [preview, setPreview]           = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');

  const openRefund = (payment) => {
    setRefundTarget(payment);
    setRefundAmount('');
    setKeepCredits(false);
    setAdminNote('');
    setPreview(null);
    setPreviewError('');
    setSubmitError('');
  };

  const closeRefund = () => setRefundTarget(null);

  // Fetch the server-computed credit impact whenever the dialog opens or the
  // amount changes. The server is the source of truth — this is display only.
  useEffect(() => {
    if (!refundTarget) return;
    const q = refundAmount !== '' ? `?amount=${encodeURIComponent(refundAmount)}` : '';
    let cancelled = false;
    setPreview(null);
    setPreviewError('');
    apiClient.get(`/admin/payments/${refundTarget.id}/refund-preview${q}`)
      .then((d) => { if (!cancelled) setPreview(d); })
      .catch((err) => { if (!cancelled) setPreviewError(err.message || 'Could not compute refund impact'); });
    return () => { cancelled = true; };
  }, [refundTarget, refundAmount]);

  const confirmWording = () => {
    if (!preview) return '';
    const amt = `€${Number(preview.refundAmount).toFixed(2)}`;
    const n   = preview.creditsToRemove;
    if (n === 0) return `Refund ${amt}? No credits are linked to this payment.`;
    const creditWord = n === 1 ? '1 credit' : `${n} unused credits`;
    if (keepCredits) return `Refund ${amt} and keep ${creditWord} as goodwill? Admin note required.`;
    const from = preview.packages?.length === 1 ? 'this package' : 'this account';
    return `Refund ${amt} and remove ${creditWord} from ${from}?`;
  };

  const noteRequired  = keepCredits && adminNote.trim().length < 5;
  const refundBlocked = preview?.blocked && !keepCredits;
  const canSubmit     = preview && !previewError && !refundBlocked && !noteRequired && !submitting;

  const submitRefund = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await apiClient.post(`/admin/payments/${refundTarget.id}/refund`, {
        amount:      refundAmount !== '' ? Number(refundAmount) : undefined,
        keepCredits,
        adminNote:   adminNote.trim() || undefined,
      });
      closeRefund();
      load();
    } catch (err) {
      setSubmitError(err.message || 'Refund failed.');
    } finally {
      setSubmitting(false);
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
                {p.stripePaymentIntent && (
                  <a href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntent}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <ExternalLink size={13} />
                  </a>
                )}
                {['paid', 'partial_refund'].includes(p.status) && (
                  <button onClick={() => openRefund(p)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all text-xs font-bold">R</button>
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

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeRefund}>
          <div className="w-full max-w-lg bg-[#0D1B2A] border border-white/10 rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Refund payment</h2>
                <p className="text-slate-400 text-xs mt-0.5">{refundTarget.clientName} · {refundTarget.reference} · €{Number(refundTarget.amount || 0).toFixed(2)}</p>
              </div>
              <button onClick={closeRefund} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Refund amount (€)</label>
              <input
                type="number" min="0.01" step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={preview ? Number(preview.maxRefundable).toFixed(2) : 'Full amount'}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors"
              />
              {preview?.alreadyRefunded > 0 && (
                <p className="text-slate-500 text-xs mt-1">€{Number(preview.alreadyRefunded).toFixed(2)} already refunded — up to €{Number(preview.maxRefundable).toFixed(2)} remaining</p>
              )}
            </div>

            {previewError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">{previewError}</p>
              </div>
            )}

            {preview && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-3 space-y-1.5">
                <p className="text-slate-300 text-xs font-semibold">Credit impact</p>
                {preview.creditsToRemove === 0 ? (
                  <p className="text-slate-400 text-xs">No credits are linked to this payment.</p>
                ) : (
                  preview.packages.filter((pk) => pk.toRemove > 0 || pk.available > 0).map((pk) => (
                    <p key={pk.packagePurchaseId} className="text-slate-400 text-xs">
                      {pk.packageName}: remove <span className="text-white font-semibold">{pk.toRemove}</span> of {pk.available} unused credit(s)
                      <span className="text-slate-500"> (€{Number(pk.perCreditValue).toFixed(2)}/credit)</span>
                    </p>
                  ))
                )}
              </div>
            )}

            {refundBlocked && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">{preview.blockedReason}</p>
              </div>
            )}

            {preview?.creditsToRemove > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={keepCredits} onChange={(e) => setKeepCredits(e.target.checked)} className="mt-0.5 accent-[#2563EB]" />
                <span>
                  <span className="text-white text-sm font-semibold block">Keep credit after refund</span>
                  <span className="text-slate-400 text-xs">The client keeps the credits as goodwill even though the money is returned. Requires a note.</span>
                </span>
              </label>
            )}

            {keepCredits && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Admin note (required)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  placeholder="Why is the credit being kept? e.g. goodwill after coach cancellation"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors"
                />
                {noteRequired && <p className="text-amber-400 text-xs mt-1">A note of at least 5 characters is required to keep credits.</p>}
              </div>
            )}

            {preview && !refundBlocked && (
              <p className="text-white text-sm font-semibold bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-3">{confirmWording()}</p>
            )}

            {submitError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">{submitError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeRefund} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-300 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={submitRefund}
                disabled={!canSubmit}
                className="px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Refunding…' : 'Confirm refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}