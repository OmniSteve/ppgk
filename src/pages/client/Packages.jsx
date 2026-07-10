import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/packages').then((data) => setPackages(data.packages ?? data ?? [])).catch(() => setPackages([])).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg) => {
    setPurchasing(pkg.id);
    setError('');
    try {
      // Step 1: create pending order
      const order = await apiClient.post(`/packages/${pkg.id}/purchase`, {
        idempotencyKey: `pkg-${pkg.id}-${Date.now()}`,
      });
      // Step 2: create Stripe checkout session and redirect
      const checkout = await apiClient.post('/checkout', { orderId: order.orderId });
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      setError(err.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-foreground">Session Packages</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Buy session credits and save</p>
      </div>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <Package size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No packages available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 transition-all">
              <div className="bg-sidebar p-5 border-b border-border">
                <p className="text-primary text-xs font-semibold uppercase tracking-wide mb-1">{pkg.credits} Session Credits</p>
                <h3 className="text-foreground font-black text-xl">{pkg.name}</h3>
              </div>
              <div className="p-5 space-y-4">
                {pkg.description && <p className="text-muted-foreground text-sm leading-relaxed">{pkg.description}</p>}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-foreground text-sm"><CheckCircle size={14} className="text-primary" />{pkg.credits} training sessions</div>
                  <div className="flex items-center gap-2 text-foreground text-sm"><CheckCircle size={14} className="text-primary" />Valid for {pkg.validityMonths || 3} months from purchase</div>
                  {pkg.eligibleSessionTypes && (
                    <div className="flex items-center gap-2 text-foreground text-sm"><CheckCircle size={14} className="text-primary" />{pkg.eligibleSessionTypes}</div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-3xl font-black text-foreground text-label-mono">€{pkg.price}</span>
                    <span className="text-muted-foreground text-sm ml-2">EUR</span>
                  </div>
                  <span className="text-muted-foreground text-xs text-label-mono">€{(pkg.price / pkg.credits).toFixed(2)} / session</span>
                </div>
                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {purchasing === pkg.id ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : `Buy Package · €${pkg.price}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-bold text-foreground text-sm mb-2">About Session Credits</h3>
        <ul className="space-y-1.5 text-muted-foreground text-sm">
          <li>• Credits are valid for 3 months from purchase date</li>
          <li>• Expired credits cannot be used</li>
          <li>• Credits from the earliest expiring package are used first</li>
          <li>• Credits are refunded for eligible cancellations</li>
        </ul>
      </div>
    </div>
  );
}
