import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import StoreHeader from './StoreHeader';

const FULFILMENT_LABEL = {
  pending: 'Order received', processing: 'Processing', ready_for_collection: 'Ready for collection',
  dispatched: 'Dispatched', completed: 'Completed', cancelled: 'Cancelled',
};

/** Reached via the link in the order confirmation email — /shop/order/:token */
export default function GuestOrderLookup() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get(`/store/orders/guest/${token}`)
      .then(setOrder)
      .catch((e) => setError(e.message || 'Order not found'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen">
      <StoreHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
        ) : error || !order ? (
          <div className="text-center bg-card rounded-2xl border border-border p-10">
            <PackageSearch size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-destructive text-sm">{error || 'Order not found'}</p>
            <Link to="/shop" className="text-primary text-sm hover:underline mt-3 inline-block">← Back to shop</Link>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-black text-foreground">Order {order.orderNumber}</h1>
              <p className="text-muted-foreground text-sm mt-1">Placed {new Date(order.createdAt).toLocaleDateString('en-MT')}</p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">{FULFILMENT_LABEL[order.fulfilmentStatus] || order.fulfilmentStatus}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/20 text-success">{order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus}</span>
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
            </div>

            <div className="bg-card rounded-2xl border border-border p-5">
              <p className="text-foreground font-semibold text-sm mb-1">{order.deliveryMethod === 'collection' ? 'Collection' : 'Delivery'}</p>
              {order.deliveryMethod === 'collection' ? (
                <p className="text-muted-foreground text-sm">Collection from Main Academy — you'll receive an email when it's ready.</p>
              ) : (
                <p className="text-muted-foreground text-sm">{order.deliveryAddressLine1}{order.deliveryAddressLine2 ? `, ${order.deliveryAddressLine2}` : ''}, {order.deliveryCity} {order.deliveryPostCode}</p>
              )}
            </div>

            <Link to="/shop" className="inline-block text-primary text-sm hover:underline">← Continue shopping</Link>
          </>
        )}
      </div>
    </div>
  );
}
