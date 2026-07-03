import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const typeColor = {
  booking_confirmation: 'bg-green-100 text-green-700',
  booking_cancellation: 'bg-red-100 text-red-700',
  payment_success: 'bg-blue-100 text-blue-700',
  credit_expiry: 'bg-amber-100 text-amber-700',
  session_reminder: 'bg-purple-100 text-purple-700',
  session_cancellation: 'bg-red-100 text-red-700',
  package_purchase: 'bg-blue-100 text-blue-700',
  account_registration: 'bg-green-100 text-green-700',
};

export default function ClientNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/notifications').then(setNotifications).catch(() => setNotifications([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Notifications</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Bell size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`bg-white rounded-2xl border p-5 transition-all ${n.read ? 'border-slate-200' : 'border-[#2563EB]/30 shadow-sm shadow-[#2563EB]/5'}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {n.read ? <CheckCircle size={18} className="text-slate-400" /> : <Bell size={18} className="text-[#2563EB]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className={`font-semibold text-sm ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.subject}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${typeColor[n.type] || 'bg-slate-100 text-slate-600'}`}>
                      {n.type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {n.preview && <p className="text-slate-500 text-xs leading-relaxed">{n.preview}</p>}
                  <p className="text-slate-400 text-xs mt-1.5">{new Date(n.sentAt).toLocaleString('en-MT')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}