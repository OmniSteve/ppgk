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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;
  if (!booking) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Booking not found</p>
      <Link to="/bookings" className="text-[#2563EB] text-sm hover:underline mt-2 block">← Back to bookings</Link>
    </div>
  );

  const canAmend = booking.canAmend && booking.status === 'confirmed';
  const canCancel = booking.canCancel && ['confirmed', 'pending_payment'].includes(booking.status);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/bookings" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Bookings
      </Link>

      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="bg-[#0D1B2A] p-6 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-xs mb-1">Booking #{booking.bookingRef}</p>
              <h1 className="text-white font-black text-2xl">{booking.sessionName}</h1>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
              booking.status === 'cancelled_by_client' || booking.status === 'cancelled_by_admin' ? 'bg-red-500/20 text-red-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>{booking.status?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calendar, label: 'Date', value: booking.sessionDate ? new Date(booking.sessionDate).toLocaleDateString('en-MT', { weekday: 'long', day: 'numeric', month: 'long' }) : '—' },
              { icon: Clock, label: 'Time', value: `${booking.startTime} – ${booking.endTime}` },
              { icon: MapPin, label: 'Location', value: booking.locationName || '—' },
              { icon: User, label: 'Coach', value: booking.coachName || '—' },
              { icon: User, label: 'Player', value: booking.playerName || '—' },
              { icon: CreditCard, label: 'Payment', value: booking.creditsUsed ? `${booking.creditsUsed} credits` : `€${booking.amountCharged}` },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs">{item.label}</p>
                  <p className="font-semibold text-white text-sm">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {!booking.canAmend && booking.amendmentBlockedReason && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">Rescheduling restricted</p>
                <p className="text-amber-400/70 text-xs mt-0.5">{booking.amendmentBlockedReason}</p>
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="border-t border-white/10 pt-4">
              <p className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-[#2563EB]" />
                Add to Calendar
              </p>
              <div className="flex flex-wrap gap-2">
                {[{ label: 'Google Calendar', type: 'google' }, { label: 'Outlook', type: 'outlook' }, { label: 'Apple / ICS', type: 'ics' }].map((cal) => (
                  <button key={cal.type} onClick={() => handleAddToCalendar(cal.type)} className="text-xs font-semibold px-3 py-2 border border-white/10 rounded-lg text-slate-300 hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all flex items-center gap-1.5">
                    {cal.label} <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(canAmend || canCancel) && (
            <div className="border-t border-white/10 pt-4 flex gap-3">
              {canAmend && (
                <Link to={`/bookings/${id}/reschedule`} className="flex-1 flex items-center justify-center gap-2 border border-[#2563EB]/50 text-[#2563EB] font-semibold py-3 rounded-xl text-sm hover:bg-[#2563EB]/10 transition-all">
                  <Edit2 size={14} />Reschedule
                </Link>
              )}
              {canCancel && (
                <Link to={`/bookings/${id}/cancel`} className="flex-1 flex items-center justify-center gap-2 border border-red-500/40 text-red-400 font-semibold py-3 rounded-xl text-sm hover:bg-red-500/10 transition-all">
                  <X size={14} />Cancel Booking
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {booking.amendments?.length > 0 && (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <h2 className="font-bold text-white mb-3">Amendment History</h2>
          <div className="space-y-2">
            {booking.amendments.map((a, i) => (
              <div key={i} className="text-sm flex items-start gap-2 py-2 border-b border-white/10 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-300">{a.action}</p>
                  <p className="text-slate-500 text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleString('en-MT') : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}