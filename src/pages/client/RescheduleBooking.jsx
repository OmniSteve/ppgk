import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Calendar, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

function normaliseSession(s) {
  if (!s) return s;
  return {
    ...s,
    name: s.name ?? s.title ?? '',
    date: s.date ?? s.sessionDate ?? '',
    startTime: s.startTime ?? '',
    spotsRemaining: s.spotsRemaining ?? (s.capacity != null && s.bookedCount != null ? s.capacity - s.bookedCount : null) ?? 0,
  };
}

function normaliseBooking(b) {
  if (!b) return null;
  return {
    ...b,
    sessionName: b.sessionName ?? '',
    playerName: b.playerName ?? '',
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  if (success) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <CheckCircle size={48} className="text-success mx-auto" />
      <h2 className="text-2xl font-black text-foreground">Booking rescheduled!</h2>
      <p className="text-muted-foreground">A confirmation email has been sent. Redirecting…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/bookings/${id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Booking
      </Link>

      <div>
        <h1 className="text-2xl font-black text-foreground">Reschedule Booking</h1>
        {booking && <p className="text-muted-foreground text-sm mt-1">{booking.sessionName} · {booking.playerName}</p>}
      </div>

      <div className="bg-warning/20 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
        <p className="text-warning text-sm">You can reschedule a booking once per 7-day period from the original booking date. This action cannot be reversed through the portal.</p>
      </div>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-bold text-foreground mb-4">Select Replacement Session</h2>
          {availableSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No available sessions for rescheduling.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSessions.map((s) => (
                <label key={s.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selected === s.id ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="session" value={s.id} checked={selected === s.id} onChange={() => setSelected(s.id)} className="accent-primary" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{s.name}</p>
                      <p className="text-muted-foreground text-xs">{s.date ? new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'} · {s.startTime}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.spotsRemaining <= 3 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                    {s.spotsRemaining} spots
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link to={`/bookings/${id}`} className="flex-1 border border-border text-foreground font-semibold py-3 rounded-xl text-center text-sm hover:bg-accent transition-colors">Cancel</Link>
          <button type="submit" disabled={submitting || !selected} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Rescheduling…</> : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
