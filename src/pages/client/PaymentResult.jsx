import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Calendar, ArrowRight } from 'lucide-react';

export default function PaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const bookingIds = params.get('bookingIds')?.split(',').filter(Boolean) || [];
  const success = status === 'success';

  const handleAddToCalendar = (type) => {
    bookingIds.forEach((id) => window.open(`/api/bookings/${id}/calendar?type=${type}`, '_blank'));
  };

  return (
    <div className="max-w-md mx-auto py-12 text-center space-y-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
        {success ? <CheckCircle size={40} className="text-green-400" /> : <XCircle size={40} className="text-red-400" />}
      </div>

      <div>
        <h1 className="text-3xl font-black text-white mb-2">
          {success ? 'Booking Confirmed!' : 'Payment Failed'}
        </h1>
        <p className="text-slate-400">
          {success
            ? `Your ${bookingIds.length} session${bookingIds.length > 1 ? 's' : ''} ${bookingIds.length > 1 ? 'are' : 'is'} booked. A confirmation email has been sent.`
            : 'Your payment was not processed. No credits were deducted. Please try again.'}
        </p>
      </div>

      {success && bookingIds.length > 0 && (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-[#2563EB]" />
            <span className="font-bold text-white">Add to Calendar</span>
          </div>
          <div className="space-y-2">
            {[{ label: 'Google Calendar', type: 'google' }, { label: 'Outlook / Office 365', type: 'outlook' }, { label: 'Apple Calendar (ICS)', type: 'ics' }].map((cal) => (
              <button
                key={cal.type}
                onClick={() => handleAddToCalendar(cal.type)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 hover:border-[#2563EB]/40 text-sm font-medium text-slate-300 hover:text-[#2563EB] transition-all"
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
            <Link to="/bookings" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-8 rounded-xl transition-colors inline-block">
              View My Bookings
            </Link>
            <Link to="/sessions" className="text-[#2563EB] text-sm font-medium hover:underline">Book Another Session</Link>
          </>
        ) : (
          <>
            <Link to="/checkout" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-8 rounded-xl transition-colors inline-block">Try Again</Link>
            <Link to="/sessions" className="text-slate-400 text-sm hover:underline">Back to Sessions</Link>
          </>
        )}
      </div>
    </div>
  );
}