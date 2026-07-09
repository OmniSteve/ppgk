import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

const statusColor = {
  confirmed: 'bg-green-500/20 text-green-400',
  pending_payment: 'bg-amber-500/20 text-amber-400',
  cancelled_by_client: 'bg-red-500/20 text-red-400',
  cancelled_by_admin: 'bg-red-500/20 text-red-400',
  rescheduled: 'bg-blue-500/20 text-blue-400',
  attended: 'bg-slate-500/20 text-slate-400',
  absent: 'bg-orange-500/20 text-orange-400',
  payment_failed: 'bg-red-500/20 text-red-400',
};

// Default optional display fields — the API contract guarantees camelCase keys
function normaliseBooking(b) {
  if (!b) return b;
  return {
    ...b,
    sessionName: b.sessionName ?? '',
    sessionDate: b.sessionDate ?? '',
    startTime: b.startTime ?? '',
    endTime: b.endTime ?? '',
    locationName: b.locationName ?? '',
    playerName: b.playerName ?? '',
  };
}

// Map UI filter tabs to API status query values
const FILTER_STATUS = {
  upcoming: '',          // server defaults to upcoming when no status
  past: 'past',
  cancelled: 'cancelled_by_client',
  all: 'all',
};

export default function UpcomingBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    setLoading(true);
    setError('');
    const status = FILTER_STATUS[filter] ?? '';
    const qs = status ? `?status=${status}` : '';
    apiClient.get(`/bookings${qs}`)
      .then((data) => setBookings(unwrap(data, 'bookings').map(normaliseBooking)))
      .catch((err) => { console.error('Bookings fetch error:', err); setError('Could not load bookings.'); setBookings([]); })
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">My Bookings</h1>
        <Link to="/sessions" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          Book Session
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past', label: 'Past' },
          { key: 'cancelled', label: 'Cancelled' },
          { key: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filter === f.key ? 'bg-[#2563EB] text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:border-[#2563EB]/40 hover:text-white'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
          <Calendar size={40} className="text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No bookings found</p>
          <Link to="/sessions" className="text-[#2563EB] text-sm font-semibold hover:underline mt-2 block">Browse sessions →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link
              key={b.id}
              to={`/bookings/${b.id}`}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-[#2563EB]/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#2563EB]/20 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-black leading-none">{b.sessionDate ? new Date(b.sessionDate).getDate() : '—'}</span>
                <span className="text-[#2563EB] text-[9px] font-bold uppercase">{b.sessionDate ? new Date(b.sessionDate).toLocaleString('en', { month: 'short' }) : ''}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-white text-sm truncate">{b.sessionName}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[b.status] || 'bg-slate-500/20 text-slate-400'}`}>
                    {b.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-xs">
                  {b.startTime && <span className="flex items-center gap-1"><Clock size={11} />{b.startTime}</span>}
                  {b.locationName && <span className="flex items-center gap-1"><MapPin size={11} />{b.locationName}</span>}
                  {b.playerName && <span className="text-slate-500">Player: {b.playerName}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-600 group-hover:text-[#2563EB] flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}