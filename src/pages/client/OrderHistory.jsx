import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const FULFILMENT_BADGE = {
  pending: 'bg-accent text-muted-foreground',
  processing: 'bg-info/20 text-info',
  ready_for_collection: 'bg-primary/20 text-primary',
  dispatched: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/store/orders')
      .then((d) => setOrders(d.orders || []))
      .catch((e) => setError(e.message || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-foreground">My Store Orders</h1>
        <p className="text-muted-foreground text-sm">Orders placed in the Premier Performance GK shop</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : orders.length === 0 ? (
        <div className="p-16 text-center bg-card rounded-2xl border border-border">
          <ShoppingBag size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">You haven't placed any store orders yet</p>
          <Link to="/shop" className="inline-block bg-primary hover:bg-primary-hover text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">Browse the shop</Link>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-bold text-foreground text-sm">{o.orderNumber}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FULFILMENT_BADGE[o.fulfilmentStatus] || ''}`}>{o.fulfilmentStatus?.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {new Date(o.createdAt).toLocaleDateString('en-MT')} · {o.items?.length || 0} item(s) · {o.deliveryMethod === 'collection' ? 'Collection' : 'Delivery'}
                </p>
              </div>
              <p className="text-foreground font-bold text-sm flex-shrink-0">€{Number(o.total).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
