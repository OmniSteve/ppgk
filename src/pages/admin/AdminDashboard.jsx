import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, ClipboardList, UserPlus, AlertCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const StatCard = ({ label, value, sub, icon: Icon, color, href, alert }) => (
  <Link to={href || '#'} className={`rounded-2xl p-5 border transition-all hover:border-[#2563EB]/50 group ${alert ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      {alert && <AlertCircle size={16} className="text-amber-400" />}
    </div>
    <p className={`text-2xl font-black ${alert ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    <p className={`text-sm font-medium mt-0.5 ${alert ? 'text-amber-400' : 'text-slate-400'}`}>{label}</p>
    {sub && <p className={`text-xs mt-1 ${alert ? 'text-amber-500' : 'text-slate-500'}`}>{sub}</p>}
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/20 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Premier Performance Goalkeeping — operational overview</p>
      </div>

      {/* Today */}
      <div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Sessions Today" value={data?.stats?.upcomingSessions ?? 0} icon={Calendar} color="bg-[#2563EB]/20 text-[#2563EB]" href="/admin/sessions" />
          <StatCard label="Bookings Today" value={data?.stats?.todayBookings ?? 0} icon={ClipboardList} color="bg-green-500/20 text-green-400" href="/admin/bookings" />
          <StatCard label="Total Clients" value={data?.stats?.totalClients ?? 0} icon={UserPlus} color="bg-purple-500/20 text-purple-400" href="/admin/clients" />
          <StatCard label="Total Revenue" value={`€${data?.stats?.totalRevenue ?? 0}`} sub="All time" icon={TrendingUp} color="bg-amber-500/20 text-amber-400" href="/admin/payments" />
        </div>
      </div>

      {/* Upcoming sessions list */}
      {Array.isArray(data?.upcomingSessions) && data.upcomingSessions.length > 0 && (
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Upcoming Sessions</p>
          <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
            {data.upcomingSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">{s.title}</p>
                  <p className="text-slate-400 text-xs">{s.session_date} · {s.start_time} · {s.location_name || 'No location'}</p>
                </div>
                <p className="text-slate-400 text-xs">{s.booked_count ?? 0}/{s.capacity ?? '–'} booked</p>
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
          <Link key={l.href} to={l.href} className="bg-white/5 hover:bg-[#2563EB] border border-white/10 hover:border-[#2563EB] text-slate-300 hover:text-white font-semibold py-3 rounded-xl text-center text-sm transition-all">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}