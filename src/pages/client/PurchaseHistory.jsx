import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

const typeColor = {
  purchase: 'bg-success/20 text-success',
  deduction: 'bg-destructive/20 text-destructive',
  refund: 'bg-info/20 text-info',
  adjustment: 'bg-purple-500/20 text-purple-400',
  expiry: 'bg-warning/20 text-warning',
};

export default function PurchaseHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/credits')
      .then((data) => setEntries(unwrap(data, 'entries')))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-foreground">Transaction History</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <ShoppingBag size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No transactions yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center">
                  {e.type === 'purchase' ? <CreditCard size={18} className="text-primary" /> : <ShoppingBag size={18} className="text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{e.description}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-MT', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-base text-label-mono ${e.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                  {e.amount > 0 ? '+' : ''}{e.amount}
                </p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[e.type] || 'bg-accent text-muted-foreground'}`}>
                  {e.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
