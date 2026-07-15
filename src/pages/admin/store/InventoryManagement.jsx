import React, { useState, useEffect } from 'react';
import { Boxes, AlertTriangle, RefreshCw, X, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    apiClient.get('/admin/store/inventory/low-stock')
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdjust = (item) => { setAdjustTarget(item); setDelta(''); setNote(''); setError(''); };

  const handleAdjust = async () => {
    const deltaNum = parseInt(delta, 10);
    if (!Number.isInteger(deltaNum) || deltaNum === 0) { setError('Enter a non-zero whole number'); return; }
    setSubmitting(true); setError('');
    try {
      await apiClient.post('/admin/store/inventory/adjust', {
        productId: adjustTarget.id, variantId: adjustTarget.variantId ?? undefined, delta: deltaNum, note: note || undefined,
      });
      setAdjustTarget(null);
      setSuccess('Stock adjusted.');
      load();
    } catch (err) {
      setError(err.message || 'Adjustment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Inventory</h1>
          <p className="text-muted-foreground text-sm">{items.length} item(s) at or below the low-stock threshold</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {items.length === 0 ? (
            <div className="p-16 text-center"><Boxes size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">Nothing is low on stock right now</p></div>
          ) : items.map((item, i) => (
            <div key={item.variantId || item.id || i} className="flex flex-col gap-3 px-5 py-4 hover:bg-accent transition-colors sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <AlertTriangle size={18} className={`flex-shrink-0 ${item.available <= 0 ? 'text-destructive' : 'text-warning'}`} />
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm break-words">{item.name}{item.variant_name ? ` — ${item.variant_name}` : ''}</p>
                  <p className="text-muted-foreground text-xs">{item.available <= 0 ? 'Out of stock' : `${item.available} left`}</p>
                </div>
              </div>
              <button onClick={() => openAdjust({ id: item.id, variantId: item.variant_name ? item.id : undefined, name: item.name })}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm text-foreground hover:bg-accent transition-colors flex-shrink-0">
                Adjust stock
              </button>
            </div>
          ))}
        </div>
      )}

      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAdjustTarget(null)}>
          <div className="w-full max-w-sm bg-sidebar border border-border rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">Adjust — {adjustTarget.name}</h2>
              <button onClick={() => setAdjustTarget(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div>
              <label className="block text-muted-foreground text-xs mb-1">Change in stock (e.g. 10 or -3)</label>
              <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className={inp} placeholder="10" />
            </div>
            <div>
              <label className="block text-muted-foreground text-xs mb-1">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="e.g. New stock delivery" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdjustTarget(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Cancel</button>
              <button onClick={handleAdjust} disabled={submitting} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
