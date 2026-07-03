import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, AlertCircle, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const txIcon = {
  purchase: <ArrowUpRight size={14} className="text-green-600" />,
  deduction: <ArrowDownLeft size={14} className="text-red-600" />,
  refund: <RotateCcw size={14} className="text-blue-600" />,
  adjustment: <CreditCard size={14} className="text-purple-600" />,
  expiry: <AlertCircle size={14} className="text-orange-600" />,
};

export default function CreditBalance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/credits/balance').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Credit Balance</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your session credits and transaction history</p>
        </div>
        <Link to="/packages" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          Buy Credits
        </Link>
      </div>

      {/* Total balance */}
      <div className="bg-[#0D1B2A] rounded-2xl p-6 text-center">
        <p className="text-slate-400 text-sm mb-1">Available Credits</p>
        <p className="text-white font-black text-5xl">{data?.totalAvailable ?? 0}</p>
        <p className="text-slate-400 text-sm mt-2">across {data?.packages?.length ?? 0} active packages</p>
      </div>

      {/* Package breakdown */}
      {data?.packages?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Active Packages</h2>
          <div className="space-y-3">
            {data.packages.map((pkg) => {
              const daysLeft = Math.ceil((new Date(pkg.expiresAt) - new Date()) / 86400000);
              const expiringSoon = daysLeft <= 14;
              return (
                <div key={pkg.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{pkg.packageName}</p>
                    <p className="text-slate-500 text-xs">Purchased {new Date(pkg.purchasedAt).toLocaleDateString('en-MT')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{pkg.remainingCredits} <span className="text-slate-400 font-normal text-xs">credits</span></p>
                    <p className={`text-xs font-semibold ${expiringSoon ? 'text-red-600' : 'text-slate-500'}`}>
                      Expires {new Date(pkg.expiresAt).toLocaleDateString('en-MT')}
                      {expiringSoon && ` (${daysLeft} days)`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold text-slate-900 mb-4">Transaction History</h2>
        {data?.transactions?.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {data?.transactions?.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    {txIcon[tx.type] || <CreditCard size={14} className="text-slate-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{tx.description}</p>
                    <p className="text-slate-400 text-xs">{new Date(tx.createdAt).toLocaleString('en-MT')}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}