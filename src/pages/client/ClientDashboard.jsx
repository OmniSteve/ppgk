import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, CreditCard, AlertCircle, ArrowRight, Clock, MapPin, Users, Bell, Plus, ChevronRight } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const StatCard = ({ label, value, sub, icon: Icon, color, href }) => (
  <Link to={href || '#'} className="bg-card rounded-2xl p-5 border border-border hover:border-primary/40 transition-all group">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
    <p className="text-display text-3xl font-black text-foreground">{value}</p>
    <p className="text-muted-foreground text-sm font-medium mt-0.5">{label}</p>
    {sub && <p className="text-muted-foreground text-xs mt-1">{sub}</p>}
  </Link>
);

const BookingCard = ({ booking }) => (
  <Link to={`/bookings/${booking.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all">
    <div className="w-12 h-12 rounded-xl bg-primary/20 flex flex-col items-center justify-center flex-shrink-0">
      <span className="text-foreground text-xs font-bold text-label-mono">{booking.sessionDate ? new Date(booking.sessionDate).toLocaleString('en-MT', { day: '2-digit' }) : '—'}</span>
      <span className="text-primary text-[10px] font-semibold uppercase">{booking.sessionDate ? new Date(booking.sessionDate).toLocaleString('en-MT', { month: 'short' }) : '—'}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-foreground text-sm truncate">{booking.sessionName || 'Training Session'}</p>
      <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
        <Clock size={11} />
        {booking.startTime} – {booking.endTime}
        {booking.locationName && <><span className="text-muted-foreground">·</span><MapPin size={11} />{booking.locationName}</>}
      </p>
      {booking.playerName && <p className="text-muted-foreground text-xs mt-0.5">{booking.playerName}</p>}
    </div>
    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
      booking.status === 'confirmed' ? 'bg-success/20 text-success' :
      booking.status === 'pending_payment' ? 'bg-warning/20 text-warning' :
      'bg-accent text-muted-foreground'
    }`}>{booking.status?.replace(/_/g, ' ')}</span>
  </Link>
);

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiClient.get('/dashboard/client')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={36} className="text-destructive mx-auto mb-3" />
          <p className="text-destructive font-semibold">Unable to load dashboard data</p>
          <p className="text-muted-foreground text-sm mt-1">Please refresh the page to try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Welcome back, {user?.firstName}!</h1>
          <p className="text-muted-foreground text-sm mt-1">Here's your training overview</p>
        </div>
        <Link to="/sessions" className="bg-primary hover:bg-primary-hover text-foreground text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          <Plus size={16} />
          Book Session
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Available Credits" value={data?.creditBalance ?? 0} sub={data?.expiringCredits > 0 ? `${data.expiringCredits} expiring soon` : 'All valid'} icon={CreditCard} color="bg-primary/20 text-primary" href="/credits" />
        <StatCard label="Upcoming Bookings" value={data?.upcomingBookings?.length ?? 0} sub="Confirmed sessions" icon={Calendar} color="bg-success/20 text-success" href="/bookings" />
        <StatCard label="Players" value={data?.players ?? 0} sub="Active profiles" icon={Users} color="bg-info/20 text-info" href="/players" />
        <StatCard label="Notifications" value={data?.unreadNotifications ?? 0} sub="Unread messages" icon={Bell} color="bg-warning/20 text-warning" href="/notifications" />
      </div>

      {data?.expiringCredits > 0 && (
        <div className="bg-warning/20 border border-warning/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-warning font-semibold text-sm">{data.expiringCredits} credit{data.expiringCredits > 1 ? 's' : ''} expiring soon</p>
            <p className="text-warning/70 text-xs">Use them before they expire.</p>
          </div>
          <Link to="/credits" className="text-warning text-sm font-semibold hover:underline">View →</Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground text-lg">Upcoming Sessions</h2>
          <Link to="/bookings" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
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
          <div className="bg-card rounded-2xl border border-border p-10 text-center">
            <Calendar size={36} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium mb-4">No upcoming sessions</p>
            <Link to="/sessions" className="bg-primary hover:bg-primary-hover text-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-colors inline-flex items-center gap-2">
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
          <Link key={a.href} to={a.href} className="bg-card border border-border hover:border-primary/40 rounded-xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <a.icon size={18} className="text-primary" />
            </div>
            <span className="font-semibold text-muted-foreground group-hover:text-foreground text-sm transition-colors">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
