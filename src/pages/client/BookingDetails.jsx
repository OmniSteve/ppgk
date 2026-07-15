import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, CreditCard, ChevronLeft, ArrowRight, AlertCircle, Edit2, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, downloadIcs } from '@/utils/calendarUtils';

function normaliseBooking(b) {
  if (!b) return null;
  return {
    ...b,
    sessionName: b.sessionName ?? '',
    sessionDate: b.sessionDate ?? '',
    startTime: b.startTime ?? '',
    endTime: b.endTime ?? '',
    locationName: b.locationName ?? '',
    playerName: b.playerName ?? '',
    coachName: b.coachName ?? '',
    creditsUsed: b.creditsUsed ?? 0,
    amountCharged: b.amountCharged ?? 0,
    bookingRef: b.bookingRef ?? b.id,
    canAmend: b.canAmend ?? true,
    canCancel: b.canCancel ?? true,
    amendments: Array.isArray(b.amendments) ? b.amendments.map((a) => ({
      ...a,
      action: a.action ?? a.amendmentType ?? '',
      createdAt: a.createdAt ?? '',
    })) : [],
  };
}

export default function BookingDetails() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/bookings/${id}`)
      .then((data) => setBooking(normaliseBooking(data)))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCalendar = (type) => {
    if (!booking) return;
    if (type === 'google') {
      window.open(buildGoogleCalendarUrl(booking), '_blank', 'noopener,noreferrer');
    } else if (type === 'outlook') {
      window.open(buildOutlookCalendarUrl(booking), '_blank', 'noopener,noreferrer');
    } else if (type === 'ics') {
      downloadIcs(booking, `booking-${booking.id.slice(0, 8)}.ics`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  if (!booking) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground">Booking not found</p>
      <Link to="/bookings" className="text-primary text-sm hover:underline mt-2 block">← Back to bookings</Link>
    </div>
  );

  const canAmend = booking.canAmend && booking.status === 'confirmed';
  const canCancel = booking.canCancel && ['confirmed', 'pending_payment', 'pending', 'backup'].includes(booking.status);

  const STATUS_LABEL = {
    pending: 'Awaiting coach confirmation',
    backup: 'Backup',
    declined: 'Declined',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/bookings" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Bookings
      </Link>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="bg-sidebar p-6 border-b border-border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs mb-1 text-label-mono">Booking #{booking.bookingRef}</p>
              <h1 className="text-foreground font-black text-2xl break-words">{booking.sessionName}</h1>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
              booking.status === 'confirmed' ? 'bg-success/20 text-success' :
              ['cancelled_by_client', 'cancelled_by_admin', 'declined'].includes(booking.status) ? 'bg-destructive/20 text-destructive' :
              'bg-warning/20 text-warning'
            }`}>{STATUS_LABEL[booking.status] || booking.status?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            {[
              { icon: Calendar, label: 'Date', value: booking.sessionDate ? new Date(booking.sessionDate).toLocaleDateString('en-MT', { weekday: 'long', day: 'numeric', month: 'long' }) : '—' },
              { icon: Clock, label: 'Time', value: `${booking.startTime} – ${booking.endTime}` },
              { icon: MapPin, label: 'Location', value: booking.locationName || '—' },
              { icon: User, label: 'Coach', value: booking.coachName || '—' },
              { icon: User, label: 'Player', value: booking.playerName || '—' },
              { icon: CreditCard, label: 'Payment', value: booking.creditsUsed ? `${booking.creditsUsed} credits` : `€${booking.amountCharged}` },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon size={14} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{item.label}</p>
                  <p className="font-semibold text-foreground text-sm break-words">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {!booking.canAmend && booking.amendmentBlockedReason && (
            <div className="bg-warning/20 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-warning font-semibold text-sm">Rescheduling restricted</p>
                <p className="text-warning/70 text-xs mt-0.5">{booking.amendmentBlockedReason}</p>
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="border-t border-border pt-4">
              <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                Add to Calendar
              </p>
              <div className="flex flex-wrap gap-2">
                {[{ label: 'Google Calendar', type: 'google' }, { label: 'Outlook', type: 'outlook' }, { label: 'Apple / ICS', type: 'ics' }].map((cal) => (
                  <button key={cal.type} onClick={() => handleAddToCalendar(cal.type)} className="text-xs font-semibold px-3 py-2 border border-border rounded-lg text-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center gap-1.5">
                    {cal.label} <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(canAmend || canCancel) && (
            <div className="border-t border-border pt-4 flex gap-3">
              {canAmend && (
                <Link to={`/bookings/${id}/reschedule`} className="flex-1 flex items-center justify-center gap-2 border border-primary/50 text-primary font-semibold py-3 rounded-xl text-sm hover:bg-primary/10 transition-all">
                  <Edit2 size={14} />Reschedule
                </Link>
              )}
              {canCancel && (
                <Link to={`/bookings/${id}/cancel`} className="flex-1 flex items-center justify-center gap-2 border border-destructive/40 text-destructive font-semibold py-3 rounded-xl text-sm hover:bg-destructive/10 transition-all">
                  <X size={14} />Cancel Booking
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {booking.amendments?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-foreground mb-3">Amendment History</h2>
          <div className="space-y-2">
            {booking.amendments.map((a, i) => (
              <div key={i} className="text-sm flex items-start gap-2 py-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{a.action}</p>
                  <p className="text-muted-foreground text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleString('en-MT') : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
