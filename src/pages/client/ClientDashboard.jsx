import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, CreditCard, AlertCircle, ArrowRight, Clock, MapPin, Users, Bell, Plus, ChevronRight } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const StatCard = ({ label, value, sub, icon: Icon, color, href }) => (
  <Link to={href || '#'} className="bg-white/5 rounded-2xl p-5 border border-white/10 hover:border-[#2563EB]/40 transition-all group">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <ChevronRight size={16} className="text-slate-600 group-hover:text-[#2563EB] transition-colors" />
    </div>
    <p className="text-2xl font-black text-white">{value}</p>
    <p className="text-slate-400 text-sm font-medium mt-0.5">{label}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </Link>
);

const BookingCard = ({ booking }) => (
  <Link to={`/bookings/${booking.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#2563EB]/40 transition-all">
    <div className="w-12 h-12 rounded-xl bg-[#2563EB]/20 flex flex-col items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold">{booking.sessionDate ? new Date(booking.sessionDate).toLocaleString('en-MT', { day: '2-digit' }) : '—'}</span>
      <span className="text-[#2563EB] text-[10px] font-semibold uppercase">{booking.sessionDate ? new Date(booking.sessionDate).toLocaleString('en-MT', { month: 'short' }) : '—'}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-white text-sm truncate">{booking.sessionName || 'Training Session'}</p>
      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
        <Clock size={11} />
        {booking.startTime} – {booking.endTime}
        {booking.locationName && <><span className="text-slate-600">·</span><MapPin size={11} />{booking.locationName}</>}
      </p>
    </div>
    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
      booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
      booking.status === 'pending_payment' ? 'bg-amber-500/20 text-amber-400' :
      'bg-slate-500/20 text-slate-400'
    }`}>{booking.status?.replace(/_/g, ' ')}</span>
  </Link>
);

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/dashboard/client')
      .then(setData)
      .catch(() => setData({ upcomingBookings: [], creditBalance: 0, expiringCredits: 0, notifications: 0, players: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Welcome back, {user?.firstName}!</h1>
          <p className="text-slate-400 text-sm mt-1">Here's your training overview</p>
        </div>
        <Link to="/sessions" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          <Plus size={16} />
          Book Session
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Available Credits" value={data?.creditBalance ?? 0} sub={data?.expiringCredits > 0 ? `${data.expiringCredits} expiring soon` : 'All valid'} icon={CreditCard} color="bg-[#2563EB]/20 text-[#2563EB]" href="/credits" />
        <StatCard label="Upcoming Bookings" value={data?.upcomingBookings?.length ?? 0} sub="Confirmed sessions" icon={Calendar} color="bg-green-500/20 text-green-400" href="/bookings" />
        <StatCard label="Players" value={data?.players ?? 0} sub="Active profiles" icon={Users} color="bg-purple-500/20 text-purple-400" href="/players" />
        <StatCard label="Notifications" value={data?.unreadNotifications ?? 0} sub="Unread messages" icon={Bell} color="bg-amber-500/20 text-amber-400" href="/notifications" />
      </div>

      {data?.expiringCredits > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm">{data.expiringCredits} credit{data.expiringCredits > 1 ? 's' : ''} expiring soon</p>
            <p className="text-amber-400/70 text-xs">Use them before they expire.</p>
          </div>
          <Link to="/credits" className="text-amber-300 text-sm font-semibold hover:underline">View →</Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-lg">Upcoming Sessions</h2>
          <Link to="/bookings" className="text-[#2563EB] text-sm font-medium hover:underline flex items-center gap-1">
            All bookings <ArrowRight size={14} />
          </Link>
        </div>
        {data?.upcomingBookings?.length > 0 ? (
          <div className="space-y-3">
            {data.upcomingBookings.slice(0, 5).map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-10 text-center">
            <Calendar size={36} className="text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-4">No upcoming sessions</p>
            <Link to="/sessions" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors inline-flex items-center gap-2">
              <Plus size={16} />
              Book your first session
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Browse Sessions', href: '/sessions', icon: Calendar },
          { label: 'Manage Bookings', href: '/bookings', icon: Clock },
          { label: 'Buy a Package', href: '/packages', icon: CreditCard },
        ].map((a) => (
          <Link key={a.href} to={a.href} className="bg-white/5 border border-white/10 hover:border-[#2563EB]/40 rounded-xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
              <a.icon size={18} className="text-[#2563EB]" />
            </div>
            <span className="font-semibold text-slate-300 group-hover:text-white text-sm transition-colors">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}