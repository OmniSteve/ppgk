import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, ClipboardList, UserPlus, AlertCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const StatCard = ({ label, value, sub, icon: Icon, color, href, alert }) => (
  <Link to={href || '#'} className={`rounded-2xl p-5 border transition-all hover:border-primary/50 group ${alert ? 'border-warning/30 bg-warning/10' : 'border-border bg-card hover:bg-accent'}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      {alert && <AlertCircle size={16} className="text-warning" />}
    </div>
    <p className={`text-display text-3xl font-black ${alert ? 'text-warning' : 'text-foreground'}`}>{value}</p>
    <p className={`text-sm font-medium mt-0.5 ${alert ? 'text-warning' : 'text-muted-foreground'}`}>{label}</p>
    {sub && <p className={`text-xs mt-1 ${alert ? 'text-warning/70' : 'text-muted-foreground'}`}>{sub}</p>}
  </Link>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/dashboard')
      .then((d) => setData(d?.stats ? d : { stats: d }))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Premier Performance Goalkeeping — operational overview</p>
      </div>

      {/* Today */}
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Sessions Today" value={data?.stats?.upcomingSessions ?? 0} icon={Calendar} color="bg-primary/20 text-primary" href="/admin/sessions" />
          <StatCard label="Bookings Today" value={data?.stats?.todayBookings ?? 0} icon={ClipboardList} color="bg-success/20 text-success" href="/admin/bookings" />
          <StatCard label="Total Clients" value={data?.stats?.totalClients ?? 0} icon={UserPlus} color="bg-info/20 text-info" href="/admin/clients" />
          <StatCard label="Total Revenue" value={`€${data?.stats?.totalRevenue ?? 0}`} sub="All time" icon={TrendingUp} color="bg-warning/20 text-warning" href="/admin/payments" />
        </div>
      </div>

      {/* Upcoming sessions list */}
      {Array.isArray(data?.upcomingSessions) && data.upcomingSessions.length > 0 && (
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-3">Upcoming Sessions</p>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border">
            {data.upcomingSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-foreground text-sm font-semibold">{s.title}</p>
                  <p className="text-muted-foreground text-xs">{s.sessionDate} · {s.startTime} · {s.locationName || 'No location'}</p>
                </div>
                <p className="text-muted-foreground text-xs text-label-mono">{s.bookedCount ?? 0}/{s.capacity ?? '–'} booked</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Create Session', href: '/admin/sessions/new' },
          { label: 'View Bookings', href: '/admin/bookings' },
          { label: 'Manage Packages', href: '/admin/packages' },
          { label: 'View Reports', href: '/admin/reports' },
        ].map((l) => (
          <Link key={l.href} to={l.href} className="bg-card hover:bg-primary border border-border hover:border-primary text-muted-foreground hover:text-foreground font-semibold py-3 rounded-xl text-center text-sm transition-all">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
