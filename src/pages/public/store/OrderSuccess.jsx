import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, Clock } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import StoreHeader from './StoreHeader';

export default function OrderSuccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stashed = null;
    try { stashed = JSON.parse(sessionStorage.getItem('ppgk_last_order') || 'null'); } catch { /* ignore */ }
    const guestToken = stashed?.guestToken;

    const load = async () => {
      try {
        if (guestToken) {
          const res = await apiClient.get(`/store/orders/guest/${guestToken}`);
          setOrder(res);
        } else if (user) {
          const res = await apiClient.get('/store/orders');
          const match = (res.orders || []).find((o) => o.id === orderId || o.id === stashed?.orderId);
          setOrder(match || null);
        } else {
          setError('We could not find your order details in this browser. Check your email for the order confirmation.');
        }
      } catch (e) {
        setError(e.message || 'Could not load order details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId, user]);

  return (
    <div className="min-h-screen">
      <StoreHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6">
        <CheckCircle size={56} className="text-success mx-auto" />
        <div>
          <h1 className="text-2xl font-black text-foreground">Thank you for your order!</h1>
          <p className="text-muted-foreground text-sm mt-1">A confirmation email is on its way to you.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin" />Loading order details…</div>
        ) : error ? (
          <p className="text-muted-foreground text-sm">{error}</p>
        ) : order ? (
          <div className="bg-card rounded-2xl border border-border p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-foreground font-bold">Order {order.orderNumber}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning flex items-center gap-1"><Clock size={11} />{order.paymentStatus === 'paid' ? 'Payment confirmed' : 'Processing payment'}</span>
            </div>
            <div className="divide-y divide-border">
              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{item.quantity} x {item.productNameSnapshot}{item.variantDetailsSnapshot ? ` (${item.variantDetailsSnapshot})` : ''}</span>
                  <span className="text-muted-foreground">€{Number(item.lineTotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between font-bold pt-2 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-primary">€{Number(order.total).toFixed(2)}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {order.deliveryMethod === 'collection' ? 'We will email you when your order is ready for collection.' : 'We will email you once your order is dispatched.'}
            </p>
          </div>
        ) : null}

        <Link to="/shop" className="inline-block text-primary text-sm hover:underline">← Continue shopping</Link>
      </div>
    </div>
  );
}
