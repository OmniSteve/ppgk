import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Calendar, ArrowRight, Clock } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, downloadIcs } from '@/utils/calendarUtils';

export default function PaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const bookingIds = params.get('bookingIds')?.split(',').filter(Boolean) || [];
  const pending = status === 'pending';
  const success = status === 'success' || pending;

  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!success || bookingIds.length === 0) return;
    Promise.all(bookingIds.map((id) => apiClient.get(`/bookings/${id}`).catch(() => null)))
      .then((results) => setBookings(results.filter(Boolean)));
  }, []);

  const handleAddToCalendar = (type) => {
    if (bookings.length === 0) return;
    if (type === 'google') {
      bookings.forEach((b) => window.open(buildGoogleCalendarUrl(b), '_blank', 'noopener,noreferrer'));
    } else if (type === 'outlook') {
      bookings.forEach((b) => window.open(buildOutlookCalendarUrl(b), '_blank', 'noopener,noreferrer'));
    } else if (type === 'ics') {
      const filename = bookings.length === 1
        ? `booking-${bookings[0].id.slice(0, 8)}.ics`
        : `bookings-${bookings[0].id.slice(0, 8)}.ics`;
      downloadIcs(bookings, filename);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 text-center space-y-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${pending ? 'bg-warning/20' : success ? 'bg-success/20' : 'bg-destructive/20'}`}>
        {pending ? <Clock size={40} className="text-warning" /> : success ? <CheckCircle size={40} className="text-success" /> : <XCircle size={40} className="text-destructive" />}
      </div>

      <div>
        <h1 className="text-3xl font-black text-foreground mb-2">
          {pending ? 'Request Submitted' : success ? 'Booking Confirmed!' : 'Payment Failed'}
        </h1>
        <p className="text-muted-foreground">
          {pending
            ? `Your ${bookingIds.length > 1 ? 'requests have' : 'request has'} been received and ${bookingIds.length > 1 ? 'are' : 'is'} awaiting coach confirmation. We'll email you as soon as a decision is made.`
            : success
              ? `Your ${bookingIds.length} session${bookingIds.length > 1 ? 's' : ''} ${bookingIds.length > 1 ? 'are' : 'is'} booked. A confirmation email has been sent.`
              : 'Your payment was not processed. No credits were deducted. Please try again.'}
        </p>
      </div>

      {success && !pending && bookingIds.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-primary" />
            <span className="font-bold text-foreground">Add to Calendar</span>
          </div>
          <div className="space-y-2">
            {[{ label: 'Google Calendar', type: 'google' }, { label: 'Outlook / Office 365', type: 'outlook' }, { label: 'Apple Calendar (ICS)', type: 'ics' }].map((cal) => (
              <button
                key={cal.type}
                onClick={() => handleAddToCalendar(cal.type)}
                disabled={bookings.length === 0}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-primary/40 text-sm font-medium text-muted-foreground hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cal.label}<ArrowRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {success ? (
          <>
            <Link to="/bookings" className="bg-primary hover:bg-primary-hover text-foreground font-bold py-3 px-8 rounded-xl transition-colors inline-block">
              View My Bookings
            </Link>
            <Link to="/sessions" className="text-primary text-sm font-medium hover:underline">Book Another Session</Link>
          </>
        ) : (
          <>
            <Link to="/checkout" className="bg-primary hover:bg-primary-hover text-foreground font-bold py-3 px-8 rounded-xl transition-colors inline-block">Try Again</Link>
            <Link to="/sessions" className="text-muted-foreground text-sm hover:underline">Back to Sessions</Link>
          </>
        )}
      </div>
    </div>
  );
}
