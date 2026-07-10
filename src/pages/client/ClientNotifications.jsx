import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const typeColor = {
  booking_confirmation: 'bg-success/20 text-success',
  booking_cancellation: 'bg-destructive/20 text-destructive',
  payment_success: 'bg-info/20 text-info',
  credit_expiry: 'bg-warning/20 text-warning',
  session_reminder: 'bg-purple-500/20 text-purple-400',
  session_cancellation: 'bg-destructive/20 text-destructive',
  package_purchase: 'bg-info/20 text-info',
  account_registration: 'bg-success/20 text-success',
};

export default function ClientNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/notifications').then((data) => setNotifications(data.notifications ?? data ?? [])).catch(() => setNotifications([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-foreground">Notifications</h1>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <Bell size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`bg-card rounded-2xl border p-5 transition-all ${n.read ? 'border-border' : 'border-primary/30'}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center flex-shrink-0">
                  {n.read ? <CheckCircle size={18} className="text-muted-foreground" /> : <Bell size={18} className="text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className={`font-semibold text-sm ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.subject}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${typeColor[n.type] || 'bg-accent text-muted-foreground'}`}>
                      {n.type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {n.preview && <p className="text-muted-foreground text-xs leading-relaxed">{n.preview}</p>}
                  <p className="text-muted-foreground text-xs mt-1.5">{new Date(n.sentAt).toLocaleString('en-MT')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
