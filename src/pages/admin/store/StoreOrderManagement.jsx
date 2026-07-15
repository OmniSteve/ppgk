import React, { useState, useEffect } from 'react';
import {
  Search, ClipboardCheck, RefreshCw, X, CheckCircle, ExternalLink,
  Truck, Package as PackageIcon,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const PAYMENT_BADGE = {
  paid: 'bg-success/20 text-success',
  pending: 'bg-warning/20 text-warning',
  failed: 'bg-destructive/20 text-destructive',
};

const FULFILMENT_BADGE = {
  pending: 'bg-accent text-muted-foreground',
  processing: 'bg-info/20 text-info',
  ready_for_collection: 'bg-primary/20 text-primary',
  dispatched: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

const inp = 'w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

function OrderDetail({ orderId, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [showRefund, setShowRefund] = useState(false);

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

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true); setError('');
    try {
      await apiClient.post(`/admin/store/orders/${orderId}/notes`, { note: note.trim() });
      setNote(''); load();
    } catch (e) { setError(e.message || 'Failed to add note'); }
    finally { setBusy(false); }
  };

  const submitRefund = async () => {
    const amt = Number(refundAmount);
    if (!amt || amt <= 0) { setError('Enter a positive refund amount'); return; }
    setBusy(true); setError('');
    try {
      await apiClient.post(`/admin/store/orders/${orderId}/refund`, { amount: amt, note: refundNote || undefined });
      setShowRefund(false); setRefundAmount(''); setRefundNote('');
      load(); onChanged();
    } catch (e) { setError(e.message || 'Failed to record refund'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="font-bold text-foreground text-lg">Order {order?.orderNumber || ''}</h2>
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

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Payment</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAYMENT_BADGE[order.paymentStatus] || ''}`}>{order.paymentStatus}</span>
                {order.stripePaymentIntent && (
                  <a href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntent}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs mt-2 hover:underline">
                    View in Stripe <ExternalLink size={11} />
                  </a>
                )}
                {order.refundStatus && <p className="text-muted-foreground text-xs mt-2">Refund recorded: {order.refundStatus} — €{Number(order.refundAmount).toFixed(2)}</p>}
              </div>
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Fulfilment</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FULFILMENT_BADGE[order.fulfilmentStatus] || ''}`}>{order.fulfilmentStatus?.replace(/_/g, ' ')}</span>
              </div>
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
                {order.paymentStatus === 'paid' && !order.refundStatus && (
                  <button disabled={busy} onClick={() => setShowRefund((s) => !s)} className="px-3 py-2 rounded-xl border border-warning/30 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">Record Refund</button>
                )}
              </div>
              {showRefund && (
                <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-foreground">This records that a refund was already completed manually in the Stripe dashboard — it does not trigger a new Stripe refund.</p>
                  <input type="number" step="0.01" placeholder="Amount (€)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className={inp} />
                  <input placeholder="Note (optional)" value={refundNote} onChange={(e) => setRefundNote(e.target.value)} className={inp} />
                  <button disabled={busy} onClick={submitRefund} className="px-3 py-2 rounded-xl bg-warning hover:bg-warning/80 text-warning-foreground text-xs font-bold disabled:opacity-50">Confirm Refund Recorded</button>
                </div>
              )}
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
    </div>
  );
}

export default function StoreOrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ paymentStatus: '', fulfilmentStatus: '', deliveryMethod: '', customerEmail: '', orderNumber: '', sort: 'newest' });
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
