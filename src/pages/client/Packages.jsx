import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/packages/active').then(setPackages).catch(() => setPackages([])).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg) => {
    setPurchasing(pkg.id);
    setError('');
    try {
      const res = await apiClient.post('/orders/package', {
        packageId: pkg.id,
        idempotencyKey: `pkg-${pkg.id}-${Date.now()}`,
      });
      window.location.href = res.paymentUrl;
    } catch (err) {
      setError(err.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Session Packages</h1>
        <p className="text-slate-500 text-sm mt-0.5">Buy session credits and save</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Package size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No packages available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-[#2563EB]/40 hover:shadow-md transition-all">
              <div className="bg-[#0D1B2A] p-5">
                <p className="text-[#2563EB] text-xs font-semibold uppercase tracking-wide mb-1">{pkg.credits} Session Credits</p>
                <h3 className="text-white font-black text-xl">{pkg.name}</h3>
              </div>
              <div className="p-5 space-y-4">
                {pkg.description && <p className="text-slate-600 text-sm leading-relaxed">{pkg.description}</p>}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <CheckCircle size={14} className="text-[#2563EB]" />
                    {pkg.credits} training sessions
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <CheckCircle size={14} className="text-[#2563EB]" />
                    Valid for {pkg.validityMonths || 3} months from purchase
                  </div>
                  {pkg.eligibleSessionTypes && (
                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                      <CheckCircle size={14} className="text-[#2563EB]" />
                      {pkg.eligibleSessionTypes}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-3xl font-black text-slate-900">€{pkg.price}</span>
                    <span className="text-slate-400 text-sm ml-2">EUR</span>
                  </div>
                  <span className="text-slate-400 text-xs">€{(pkg.price / pkg.credits).toFixed(2)} / session</span>
                </div>

                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {purchasing === pkg.id ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : `Buy Package · €${pkg.price}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 text-sm mb-2">About Session Credits</h3>
        <ul className="space-y-1.5 text-slate-500 text-sm">
          <li>• Credits are valid for 3 months from purchase date</li>
          <li>• Expired credits cannot be used</li>
          <li>• Credits from the earliest expiring package are used first</li>
          <li>• Credits are refunded for eligible cancellations</li>
        </ul>
      </div>
    </div>
  );
}