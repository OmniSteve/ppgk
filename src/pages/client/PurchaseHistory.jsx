import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const statusColor = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-blue-100 text-blue-700',
};

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/purchases').then(setPurchases).catch(() => setPurchases([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Purchase History</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <ShoppingBag size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No purchases yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  {p.type === 'package' ? <CreditCard size={18} className="text-[#2563EB]" /> : <ShoppingBag size={18} className="text-slate-600" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{p.description}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{new Date(p.createdAt).toLocaleDateString('en-MT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {p.transactionRef && <p className="text-slate-400 text-xs font-mono">{p.transactionRef}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-900">€{p.amount}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[p.paymentStatus] || 'bg-slate-100 text-slate-600'}`}>
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