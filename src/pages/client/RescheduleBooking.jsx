import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Calendar, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

function normaliseSession(s) {
  if (!s) return s;
  return {
    ...s,
    name: s.name ?? s.title ?? '',
    date: s.date ?? s.session_date ?? '',
    startTime: s.startTime ?? s.start_time ?? '',
    spotsRemaining: s.spotsRemaining ?? (s.capacity != null && s.booked_count != null ? s.capacity - s.booked_count : null) ?? 0,
  };
}

function normaliseBooking(b) {
  if (!b) return null;
  return {
    ...b,
    sessionName: b.sessionName ?? b.session_name ?? '',
    playerName: b.playerName ?? b.player_name ?? '',
  };
}

export default function RescheduleBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch booking details + all available sessions for rescheduling
    Promise.all([
      apiClient.get(`/bookings/${id}`),
      apiClient.get('/sessions'),
    ]).then(([b, sessionsData]) => {
      setBooking(normaliseBooking(b));
      // Filter out the current session and only show sessions with spots
      const allSessions = unwrap(sessionsData, 'sessions').map(normaliseSession);
      const currentSessionId = b.session_id;
      setAvailableSessions(allSessions.filter((s) => s.id !== currentSessionId && s.spotsRemaining > 0));
    }).catch(() => navigate(`/bookings/${id}`)).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Please select a replacement session.');
    setError(''); setSubmitting(true);
    try {
      await apiClient.post(`/bookings/${id}/reschedule`, { newSessionId: selected });
      setSuccess(true);
      setTimeout(() => navigate(`/bookings/${id}`), 2000);
    } catch (err) {
      setError(err.message || 'Rescheduling failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  if (success) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <CheckCircle size={48} className="text-green-400 mx-auto" />
      <h2 className="text-2xl font-black text-white">Booking rescheduled!</h2>
      <p className="text-slate-400">A confirmation email has been sent. Redirecting…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/bookings/${id}`} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Booking
      </Link>

      <div>
        <h1 className="text-2xl font-black text-white">Reschedule Booking</h1>
        {booking && <p className="text-slate-400 text-sm mt-1">{booking.sessionName} · {booking.playerName}</p>}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300 text-sm">You can reschedule a booking once per 7-day period from the original booking date. This action cannot be reversed through the portal.</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <h2 className="font-bold text-white mb-4">Select Replacement Session</h2>
          {availableSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No available sessions for rescheduling.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSessions.map((s) => (
                <label key={s.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selected === s.id ? 'border-[#2563EB] bg-[#2563EB]/10' : 'border-white/10 hover:border-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="session" value={s.id} checked={selected === s.id} onChange={() => setSelected(s.id)} className="accent-[#2563EB]" />
                    <div>
                      <p className="font-semibold text-white text-sm">{s.name}</p>
                      <p className="text-slate-400 text-xs">{s.date ? new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'} · {s.startTime}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.spotsRemaining <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                    {s.spotsRemaining} spots
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link to={`/bookings/${id}`} className="flex-1 border border-white/20 text-slate-300 font-semibold py-3 rounded-xl text-center text-sm hover:bg-white/5 transition-colors">Cancel</Link>
          <button type="submit" disabled={submitting || !selected} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Rescheduling…</> : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </div>
  );
}