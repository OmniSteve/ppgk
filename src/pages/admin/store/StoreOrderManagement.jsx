import React, { useState, useEffect } from 'react';
import {
  Search, ClipboardCheck, RefreshCw, X, CheckCircle, ExternalLink,
  Truck, Package as PackageIcon, Archive, ArchiveRestore, Trash2, ReceiptText,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const PAYMENT_BADGE = {
  paid: 'bg-success/20 text-success',
  pending: 'bg-warning/20 text-warning',
  failed: 'bg-destructive/20 text-destructive',
};

const REFUND_BADGE = {
  none: '',
  pending: 'bg-warning/20 text-warning',
  partial: 'bg-info/20 text-info',
  full: 'bg-destructive/20 text-destructive',
  failed: 'bg-destructive/20 text-destructive',
};

const REFUND_LABEL = {
  none: '',
  pending: 'Refund pending',
  partial: 'Partially refunded',
  full: 'Refunded',
  failed: 'Refund failed',
};

const FULFILMENT_BADGE = {
  pending: 'bg-accent text-muted-foreground',
  processing: 'bg-info/20 text-info',
  ready_for_collection: 'bg-primary/20 text-primary',
  dispatched: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

const REFUND_REASONS = [
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'duplicate', label: 'Duplicate charge' },
  { value: 'fraudulent', label: 'Fraudulent' },
];

const inp = 'w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

function RefundModal({ order, refundSummary, onClose, onDone }) {
  const remaining = refundSummary.remainingRefundableAmount;
  const [isFull, setIsFull] = useState(true);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [reason, setReason] = useState('requested_by_customer');
  const [adminNote, setAdminNote] = useState('');
  const [restoreAll, setRestoreAll] = useState(true);
  const [restoreQty, setRestoreQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.id, 0])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isFull) { setAmount(remaining.toFixed(2)); setRestoreAll(true); }
  }, [isFull]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const body = { amount: Number(amount), reason, adminNote: adminNote || undefined };
      if (isFull) {
        body.restoreInventory = restoreAll;
      } else {
        const restoreItems = order.items
          .filter((i) => (restoreQty[i.id] || 0) > 0)
          .map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: Math.min(restoreQty[i.id], i.quantity) }));
        body.restoreInventory = restoreItems.length > 0;
        body.restoreItems = restoreItems;
      }
      const res = await apiClient.post(`/admin/store/orders/${order.id}/refund`, body);
      onDone(res);
    } catch (e) {
      setError(e.message || 'Refund failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground text-lg">Refund order {order.orderNumber}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-card rounded-xl border border-border p-2"><p className="text-muted-foreground">Paid</p><p className="text-foreground font-bold">€{refundSummary.paidAmount.toFixed(2)}</p></div>
          <div className="bg-card rounded-xl border border-border p-2"><p className="text-muted-foreground">Already refunded</p><p className="text-foreground font-bold">€{refundSummary.refundedAmount.toFixed(2)}</p></div>
          <div className="bg-card rounded-xl border border-border p-2"><p className="text-muted-foreground">Remaining</p><p className="text-foreground font-bold">€{remaining.toFixed(2)}</p></div>
        </div>

        {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}

        <div className="flex gap-2">
          <button onClick={() => setIsFull(true)} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${isFull ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>Full refund</button>
          <button onClick={() => setIsFull(false)} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${!isFull ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>Partial refund</button>
        </div>

        {!isFull && (
          <div>
            <label className="block text-muted-foreground text-xs mb-1">Amount (€)</label>
            <input type="number" step="0.01" min="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
          </div>
        )}

        <div>
          <label className="block text-muted-foreground text-xs mb-1">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inp}>
            {REFUND_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-muted-foreground text-xs mb-1">Internal note (optional)</label>
          <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className={inp} placeholder="Why is this refund being issued?" />
        </div>

        {isFull ? (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={restoreAll} onChange={(e) => setRestoreAll(e.target.checked)} />
            Return all refunded items to inventory
          </label>
        ) : (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Return items to inventory (only if goods were physically returned)</p>
            <div className="space-y-1">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 bg-card rounded-xl border border-border p-2 text-xs">
                  <span className="text-foreground truncate">{i.productNameSnapshot}{i.variantDetailsSnapshot ? ` (${i.variantDetailsSnapshot})` : ''} — qty {i.quantity}</span>
                  <input
                    type="number" min="0" max={i.quantity} value={restoreQty[i.id] || 0}
                    onChange={(e) => setRestoreQty((prev) => ({ ...prev, [i.id]: Math.max(0, Math.min(i.quantity, Number(e.target.value) || 0)) }))}
                    className="w-16 bg-background border border-border rounded-lg px-2 py-1 text-foreground"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-foreground">
          This will issue a real refund through Stripe for €{Number(amount || 0).toFixed(2)}. This cannot be undone.
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Cancel</button>
          <button disabled={busy || !amount || Number(amount) <= 0} onClick={submit} className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold disabled:opacity-50">
            {busy ? 'Processing…' : 'Issue Stripe Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteOrderModal({ order, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await apiClient.delete(`/admin/store/orders/${order.id}`, { confirm: 'DELETE' });
      onDeleted();
    } catch (e) { setError(e.message || 'Delete failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-destructive">Permanently Delete {order.orderNumber}</h2>
        <p className="text-muted-foreground text-sm">This cannot be undone. Only test orders with no captured, unrefunded payment and no fulfilment history can be deleted.</p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div>
          <label className="block text-muted-foreground text-xs mb-1">Type DELETE to confirm</label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inp} placeholder="DELETE" autoComplete="off" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Close</button>
          <button disabled={busy || confirmText !== 'DELETE'} onClick={submit} className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold disabled:opacity-50">
            {busy ? 'Deleting…' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ orderId, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient.get(`/admin/store/orders/${orderId}`)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [orderId]);

  const setStatus = async (fulfilmentStatus) => {
    setBusy(true); setError('');
    try {
      await apiClient.patch(`/admin/store/orders/${orderId}`, { fulfilmentStatus });
      load(); onChanged();
    } catch (e) { setError(e.message || 'Update failed'); }
    finally { setBusy(false); }
  };

  const toggleTestOrder = async () => {
    setBusy(true); setError('');
    try {
      await apiClient.patch(`/admin/store/orders/${orderId}`, { isTestOrder: !order.isTestOrder });
      load(); onChanged();
    } catch (e) { setError(e.message || 'Update failed'); }
    finally { setBusy(false); }
  };

  const archive = async () => {
    setBusy(true); setError('');
    try {
      await apiClient.post(`/admin/store/orders/${orderId}/archive`, {});
      load(); onChanged();
    } catch (e) { setError(e.message || 'Archive failed'); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    setBusy(true); setError('');
    try {
      await apiClient.post(`/admin/store/orders/${orderId}/restore`, {});
      load(); onChanged();
    } catch (e) { setError(e.message || 'Restore failed'); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true); setError('');
    try {
      await apiClient.post(`/admin/store/orders/${orderId}/notes`, { note: note.trim() });
      setNote(''); load();
    } catch (e) { setError(e.message || 'Failed to add note'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="font-bold text-foreground text-lg flex items-center gap-2">
            Order {order?.orderNumber || ''}
            {order?.archivedAt && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground">Archived</span>}
            {order?.isTestOrder ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning">Test order</span> : null}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
        ) : !order ? (
          <div className="p-5 text-destructive text-sm">{error || 'Order not found'}</div>
        ) : (
          <div className="p-5 space-y-5">
            {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Customer</p>
                <p className="text-foreground text-sm font-bold">{order.customerName}</p>
                <p className="text-muted-foreground text-xs">{order.customerEmail} · {order.customerPhone}</p>
                {!order.userId && <p className="text-muted-foreground text-xs mt-1">Guest order</p>}
              </div>
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{order.deliveryMethod === 'collection' ? 'Collection' : 'Delivery'}</p>
                {order.deliveryMethod === 'collection' ? (
                  <p className="text-foreground text-sm">Collection from Main Academy</p>
                ) : (
                  <p className="text-foreground text-sm">{order.deliveryAddressLine1}{order.deliveryAddressLine2 ? `, ${order.deliveryAddressLine2}` : ''}, {order.deliveryCity} {order.deliveryPostCode}</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Items</p>
              <div className="bg-card rounded-xl border border-border divide-y divide-border">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">{item.quantity} x {item.productNameSnapshot}{item.variantDetailsSnapshot ? ` (${item.variantDetailsSnapshot})` : ''}</p>
                      {item.skuSnapshot && <p className="text-muted-foreground text-xs">SKU: {item.skuSnapshot}</p>}
                    </div>
                    <p className="text-foreground flex-shrink-0">€{Number(item.lineTotal).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-end gap-0.5 mt-2 text-sm">
                <p className="text-muted-foreground">Subtotal: €{Number(order.subtotal).toFixed(2)}</p>
                <p className="text-muted-foreground">Delivery: €{Number(order.deliveryFee).toFixed(2)}</p>
                {order.taxAmount > 0 && <p className="text-muted-foreground">Tax: €{Number(order.taxAmount).toFixed(2)}</p>}
                <p className="text-foreground font-bold">Total: €{Number(order.total).toFixed(2)}</p>
              </div>
            </div>

            {order.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Customer notes</p>
                <p className="text-foreground text-sm bg-card rounded-xl border border-border p-3">{order.notes}</p>
              </div>
            )}

            {/* Financial Actions */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><ReceiptText size={13} />Financial Actions</p>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Payment</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAYMENT_BADGE[order.paymentStatus] || ''}`}>{order.paymentStatus}</span>
                  {order.refundSummary?.status && order.refundSummary.status !== 'none' && (
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${REFUND_BADGE[order.refundSummary.status] || ''}`}>{REFUND_LABEL[order.refundSummary.status]}</span>
                  )}
                  {order.stripePaymentIntent && (
                    <a href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntent}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs mt-2 hover:underline">
                      View in Stripe <ExternalLink size={11} />
                    </a>
                  )}
                  {order.refundSummary && (
                    <p className="text-muted-foreground text-xs mt-2">Paid €{order.refundSummary.paidAmount.toFixed(2)} · Refunded €{order.refundSummary.refundedAmount.toFixed(2)} · Remaining €{order.refundSummary.remainingRefundableAmount.toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-card rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Refund history</p>
                  {order.refunds?.length ? (
                    <div className="space-y-1">
                      {order.refunds.map((r) => (
                        <p key={r.id} className="text-xs text-muted-foreground">€{(r.amountCents / 100).toFixed(2)} — {r.status}{r.stripeRefundId ? ` (${r.stripeRefundId})` : ''}</p>
                      ))}
                    </div>
                  ) : <p className="text-muted-foreground text-xs">No refunds issued</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {order.paymentStatus === 'paid' && order.refundSummary?.remainingRefundableAmount > 0 && (
                  <button disabled={busy} onClick={() => setShowRefund(true)} className="px-3 py-2 rounded-xl border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50">Issue Refund</button>
                )}
                <button disabled={busy} onClick={toggleTestOrder} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50">
                  {order.isTestOrder ? 'Unmark as test order' : 'Mark as test order'}
                </button>
                {order.archivedAt ? (
                  <button disabled={busy} onClick={restore} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50 flex items-center gap-1"><ArchiveRestore size={12} />Restore</button>
                ) : (
                  <button disabled={busy} onClick={archive} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50 flex items-center gap-1"><Archive size={12} />Archive</button>
                )}
                {order.deleteEligibility?.eligible && (
                  <button disabled={busy} onClick={() => setShowDelete(true)} className="px-3 py-2 rounded-xl border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-1"><Trash2 size={12} />Delete Test Order</button>
                )}
              </div>
              {order.isTestOrder && order.deleteEligibility && !order.deleteEligibility.eligible && (
                <p className="text-muted-foreground text-xs mt-1">Not yet deletable: {order.deleteEligibility.blockingReasons.join('; ')}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Fulfilment</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FULFILMENT_BADGE[order.fulfilmentStatus] || ''}`}>{order.fulfilmentStatus?.replace(/_/g, ' ')}</span>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => setStatus('processing')} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50">Mark Processing</button>
                {order.deliveryMethod === 'collection' && (
                  <button disabled={busy} onClick={() => setStatus('ready_for_collection')} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50">Ready for Collection</button>
                )}
                {order.deliveryMethod === 'delivery' && (
                  <button disabled={busy} onClick={() => setStatus('dispatched')} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50 flex items-center gap-1"><Truck size={12} />Mark Dispatched</button>
                )}
                <button disabled={busy} onClick={() => setStatus('completed')} className="px-3 py-2 rounded-xl border border-border text-xs text-foreground hover:bg-accent disabled:opacity-50 flex items-center gap-1"><PackageIcon size={12} />Mark Completed</button>
                <button disabled={busy} onClick={() => setStatus('cancelled')} className="px-3 py-2 rounded-xl border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50">Cancel Order</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Timeline</p>
              <div className="space-y-2">
                {order.statusHistory?.map((h) => (
                  <div key={h.id} className="text-xs bg-card rounded-lg border border-border p-2">
                    <p className="text-foreground">{h.fromStatus && h.fromStatus !== h.toStatus ? `${h.fromStatus} → ${h.toStatus}` : (h.note ? 'Note added' : h.toStatus)}</p>
                    {h.note && <p className="text-muted-foreground mt-0.5">{h.note}</p>}
                    <p className="text-muted-foreground mt-0.5">{h.actorName || 'System'} · {new Date(h.createdAt).toLocaleString('en-MT')}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} className={inp} />
                <button disabled={busy || !note.trim()} onClick={addNote} className="px-3 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-accent disabled:opacity-50 flex-shrink-0">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRefund && order && (
        <RefundModal
          order={order}
          refundSummary={order.refundSummary}
          onClose={() => setShowRefund(false)}
          onDone={() => { setShowRefund(false); load(); onChanged(); }}
        />
      )}
      {showDelete && order && (
        <DeleteOrderModal order={order} onClose={() => setShowDelete(false)} onDeleted={() => { setShowDelete(false); onClose(); onChanged(); }} />
      )}
    </div>
  );
}

export default function StoreOrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ paymentStatus: '', fulfilmentStatus: '', deliveryMethod: '', customerEmail: '', orderNumber: '', archived: '', isTestOrder: '', sort: 'newest' });
  const [selectedId, setSelectedId] = useState(null);
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ ...filters, page, limit: 20 }).toString();
    apiClient.get(`/admin/store/orders?${q}`)
      .then((d) => { setOrders(d.orders || []); setTotal(d.total || 0); })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters, page]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Store Orders</h1>
          <p className="text-muted-foreground text-sm">{total} orders</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={filters.orderNumber} onChange={(e) => setFilter('orderNumber', e.target.value)} placeholder="Order number…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <input value={filters.customerEmail} onChange={(e) => setFilter('customerEmail', e.target.value)} placeholder="Customer email…" className="flex-1 min-w-[180px] px-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        <select value={filters.paymentStatus} onChange={(e) => setFilter('paymentStatus', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All payment statuses</option>
          <option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option>
        </select>
        <select value={filters.fulfilmentStatus} onChange={(e) => setFilter('fulfilmentStatus', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All fulfilment statuses</option>
          {Object.keys(FULFILMENT_BADGE).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.deliveryMethod} onChange={(e) => setFilter('deliveryMethod', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">Collection & Delivery</option>
          <option value="collection">Collection</option><option value="delivery">Delivery</option>
        </select>
        <select value={filters.archived} onChange={(e) => setFilter('archived', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">Active orders</option>
          <option value="true">Archived only</option>
          <option value="all">All (active + archived)</option>
        </select>
        <select value={filters.isTestOrder} onChange={(e) => setFilter('isTestOrder', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">All orders</option>
          <option value="true">Test orders only</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className="bg-sidebar border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {orders.length === 0 ? (
            <div className="p-16 text-center"><ClipboardCheck size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No orders found</p></div>
          ) : orders.map((o) => (
            <button key={o.id} onClick={() => setSelectedId(o.id)} className="w-full text-left flex flex-col gap-2 px-5 py-4 hover:bg-accent transition-colors sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-bold text-foreground text-sm">{o.orderNumber}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAYMENT_BADGE[o.paymentStatus] || ''}`}>{o.paymentStatus}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FULFILMENT_BADGE[o.fulfilmentStatus] || ''}`}>{o.fulfilmentStatus?.replace(/_/g, ' ')}</span>
                  {o.archivedAt && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground">Archived</span>}
                  {o.isTestOrder ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning">Test</span> : null}
                </div>
                <p className="text-muted-foreground text-xs mt-0.5 truncate">{o.customerName} · {o.customerEmail} · {o.deliveryMethod} · {new Date(o.createdAt).toLocaleDateString('en-MT')}</p>
              </div>
              <p className="text-foreground font-bold text-sm flex-shrink-0">€{Number(o.total).toFixed(2)}</p>
            </button>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {selectedId && (
        <OrderDetail orderId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => { setSuccess('Order updated.'); load(); }} />
      )}
    </div>
  );
}
