import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  paid: 'bg-green-500/20 text-green-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-blue-500/20 text-blue-400',
};

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/purchases').then(setPurchases).catch(() => setPurchases([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-white">Purchase History</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
          <ShoppingBag size={40} className="text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No purchases yet</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/10">
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  {p.type === 'package' ? <CreditCard size={18} className="text-[#2563EB]" /> : <ShoppingBag size={18} className="text-slate-400" />}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{p.description}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{new Date(p.createdAt).toLocaleDateString('en-MT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {p.transactionRef && <p className="text-slate-500 text-xs font-mono">{p.transactionRef}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-white">€{p.amount}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[p.paymentStatus] || 'bg-slate-500/20 text-slate-400'}`}>
                  {p.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}