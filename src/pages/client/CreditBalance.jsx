import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, AlertCircle, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const txIcon = {
  purchase: <ArrowUpRight size={14} className="text-success" />,
  deduction: <ArrowDownLeft size={14} className="text-destructive" />,
  refund: <RotateCcw size={14} className="text-info" />,
  adjustment: <CreditCard size={14} className="text-purple-400" />,
  expiry: <AlertCircle size={14} className="text-warning" />,
};

export default function CreditBalance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/credits').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Credit Balance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your session credits and transaction history</p>
        </div>
        <Link to="/packages" className="bg-primary hover:bg-primary-hover text-foreground text-sm font-bold px-4 py-2.5 rounded-xl transition-colors self-start">
          Buy Credits
        </Link>
      </div>

      <div className="bg-sidebar rounded-2xl p-6 text-center border border-border">
        <p className="text-muted-foreground text-sm mb-1">Available Credits</p>
        <p className="text-display text-5xl font-black text-foreground">{data?.balance ?? 0}</p>
        <p className="text-muted-foreground text-sm mt-2">across {data?.purchases?.length ?? 0} active packages</p>
      </div>

      {data?.purchases?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-foreground mb-4">Active Packages</h2>
          <div className="space-y-3">
            {data.purchases.map((pkg) => {
              const expiryDate = pkg.expiresAt ? new Date(pkg.expiresAt) : null;
              const purchaseDate = pkg.createdAt ? new Date(pkg.createdAt) : null;
              const daysLeft = expiryDate ? Math.ceil((expiryDate - new Date()) / 86400000) : null;
              const expiringSoon = daysLeft !== null && daysLeft <= 14;
              return (
                <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3 rounded-xl bg-accent border border-border">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{pkg.packageName || 'Credit Package'}</p>
                    <p className="text-muted-foreground text-xs">Purchased {purchaseDate ? purchaseDate.toLocaleDateString('en-GB') : '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-foreground text-lg">{pkg.creditsRemaining ?? pkg.creditsGranted ?? '?'} <span className="text-muted-foreground font-normal text-xs">credits</span></p>
                    <p className={`text-xs font-semibold ${expiringSoon ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {expiryDate ? `Expires ${expiryDate.toLocaleDateString('en-GB')}${expiringSoon ? ` (${daysLeft} days)` : ''}` : 'No expiry'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-bold text-foreground mb-4">Transaction History</h2>
        {data?.entries?.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {data?.entries?.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center">
                    {txIcon[tx.type] || <CreditCard size={14} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{tx.description}</p>
                    <p className="text-muted-foreground text-xs">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-GB') : '—'}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-success' : 'text-destructive'}`}>
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
