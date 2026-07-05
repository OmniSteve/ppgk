import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

const typeColor = {
  purchase: 'bg-green-500/20 text-green-400',
  deduction: 'bg-red-500/20 text-red-400',
  refund: 'bg-blue-500/20 text-blue-400',
  adjustment: 'bg-purple-500/20 text-purple-400',
  expiry: 'bg-orange-500/20 text-orange-400',
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
      <h1 className="text-2xl font-black text-white">Transaction History</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
          <ShoppingBag size={40} className="text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No transactions yet</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/10">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  {e.type === 'purchase' ? <CreditCard size={18} className="text-[#2563EB]" /> : <ShoppingBag size={18} className="text-slate-400" />}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{e.description}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{e.created_at ? new Date(e.created_at).toLocaleDateString('en-MT', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-base ${e.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {e.amount > 0 ? '+' : ''}{e.amount}
                </p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[e.type] || 'bg-slate-500/20 text-slate-400'}`}>
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