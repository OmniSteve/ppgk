import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import StoreHeader from './StoreHeader';

const inp = 'w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const label = 'block text-foreground text-sm font-medium mb-1';

export default function StoreCheckout() {
  const { user } = useAuth();
  const { lines, subtotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    customerName: user ? `${user.firstName} ${user.lastName}` : '', customerEmail: user?.email || '', customerPhone: '',
    deliveryMethod: '', deliveryAddressLine1: '', deliveryAddressLine2: '', deliveryCity: '', deliveryPostCode: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/store/settings').then((d) => {
      setSettings(d);
      setForm((f) => ({ ...f, deliveryMethod: d.collectionEnabled ? 'collection' : (d.deliveryEnabled ? 'delivery' : '') }));
    }).catch(() => {});
  }, []);

  useEffect(() => { if (lines.length === 0) navigate('/cart'); }, [lines.length, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const deliveryFee = settings && form.deliveryMethod === 'delivery' && settings.deliveryEnabled
    ? (settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee)
    : 0;
  const taxAmount = settings?.taxMode === 'added' ? Math.round(subtotal * (settings.taxRate / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + deliveryFee + taxAmount) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const orderRes = await apiClient.post('/store/orders', {
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.quantity })),
        customerName: form.customerName, customerEmail: form.customerEmail, customerPhone: form.customerPhone,
        deliveryMethod: form.deliveryMethod,
        deliveryAddressLine1: form.deliveryMethod === 'delivery' ? form.deliveryAddressLine1 : undefined,
        deliveryAddressLine2: form.deliveryMethod === 'delivery' ? form.deliveryAddressLine2 : undefined,
        deliveryCity: form.deliveryMethod === 'delivery' ? form.deliveryCity : undefined,
        deliveryPostCode: form.deliveryMethod === 'delivery' ? form.deliveryPostCode : undefined,
        notes: form.notes || undefined,
      });
      const checkoutRes = await apiClient.post('/store/checkout', { orderId: orderRes.orderId });
      // Stashed so /shop/order-success can look the order up after the Stripe
      // redirect — same "stash in Web Storage, read on the next page" idiom
      // already used for the session-booking checkout handoff.
      try { sessionStorage.setItem('ppgk_last_order', JSON.stringify({ orderId: orderRes.orderId, guestToken: orderRes.guestToken })); } catch { /* private browsing */ }
      clearCart();
      window.location.href = checkoutRes.checkoutUrl;
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (lines.length === 0) return null;

  return (
    <div className="min-h-screen">
      <StoreHeader backTo="/cart" backLabel="Back to cart" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-black text-foreground mb-6">Checkout</h1>
        {!user && (
          <p className="text-muted-foreground text-sm mb-6 bg-card border border-border rounded-xl p-3">
            Checking out as a guest. <Link to="/signin" className="text-primary hover:underline">Sign in</Link> to see this order in your account, or continue below — no account required.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm flex items-start gap-2"><AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />{error}</div>}

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="font-bold text-foreground">Your Details</h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div><label className={label}>Full Name</label><input required className={inp} value={form.customerName} onChange={set('customerName')} /></div>
              <div><label className={label}>Email</label><input required type="email" className={inp} value={form.customerEmail} onChange={set('customerEmail')} /></div>
            </div>
            <div><label className={label}>Phone</label><input required className={inp} value={form.customerPhone} onChange={set('customerPhone')} /></div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="font-bold text-foreground">Delivery Method</h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              {settings?.collectionEnabled && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, deliveryMethod: 'collection' }))}
                  className={`text-left p-4 rounded-xl border transition-colors ${form.deliveryMethod === 'collection' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <p className="text-foreground font-semibold text-sm">Collection — Free</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Collect from {settings.collectionLocationName || 'Main Academy'}</p>
                </button>
              )}
              {settings?.deliveryEnabled && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, deliveryMethod: 'delivery' }))}
                  className={`text-left p-4 rounded-xl border transition-colors ${form.deliveryMethod === 'delivery' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <p className="text-foreground font-semibold text-sm">Delivery (Malta) — €{Number(settings.deliveryFee || 0).toFixed(2)}</p>
                  {settings.freeDeliveryThreshold > 0 && <p className="text-muted-foreground text-xs mt-0.5">Free over €{Number(settings.freeDeliveryThreshold).toFixed(2)}</p>}
                </button>
              )}
            </div>

            {form.deliveryMethod === 'collection' && settings?.collectionInstructions && (
              <div className="flex items-start gap-2 bg-accent rounded-xl p-3 text-sm text-foreground">
                <MapPin size={15} className="flex-shrink-0 mt-0.5 text-primary" />
                <div>
                  <p>{settings.collectionInstructions}</p>
                  {settings.collectionAddress && <p className="text-muted-foreground text-xs mt-1">{settings.collectionAddress}</p>}
                  {settings.collectionHours && <p className="text-muted-foreground text-xs mt-1">Hours: {settings.collectionHours}</p>}
                </div>
              </div>
            )}

            {form.deliveryMethod === 'delivery' && (
              <div className="space-y-3">
                <div><label className={label}>Address Line 1</label><input required className={inp} value={form.deliveryAddressLine1} onChange={set('deliveryAddressLine1')} /></div>
                <div><label className={label}>Address Line 2 (optional)</label><input className={inp} value={form.deliveryAddressLine2} onChange={set('deliveryAddressLine2')} /></div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div><label className={label}>City</label><input required className={inp} value={form.deliveryCity} onChange={set('deliveryCity')} /></div>
                  <div><label className={label}>Post Code</label><input required className={inp} value={form.deliveryPostCode} onChange={set('deliveryPostCode')} /></div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h2 className="font-bold text-foreground">Order Notes (optional)</h2>
            <textarea className={inp} rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything we should know about your order?" />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">€{subtotal.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span className="text-foreground">{deliveryFee > 0 ? `€${deliveryFee.toFixed(2)}` : 'Free'}</span></div>
            {taxAmount > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Tax</span><span className="text-foreground">€{taxAmount.toFixed(2)}</span></div>}
            <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-border"><span className="text-foreground">Total</span><span className="text-primary">€{total.toFixed(2)}</span></div>
          </div>

          <button type="submit" disabled={submitting || !form.deliveryMethod} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {submitting ? <><Loader2 size={16} className="animate-spin" />Redirecting to payment…</> : 'Continue to Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
