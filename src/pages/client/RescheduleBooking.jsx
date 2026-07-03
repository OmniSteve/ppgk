import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Calendar, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

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
    Promise.all([
      apiClient.get(`/bookings/${id}`),
      apiClient.get(`/bookings/${id}/reschedule-options`),
    ]).then(([b, sessions]) => {
      setBooking(b);
      setAvailableSessions(sessions);
    }).catch(() => navigate(`/bookings/${id}`)).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Please select a replacement session.');
    setError('');
    setSubmitting(true);
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  if (success) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <CheckCircle size={48} className="text-green-500 mx-auto" />
      <h2 className="text-2xl font-black text-slate-900">Booking rescheduled!</h2>
      <p className="text-slate-500">A confirmation email has been sent. Redirecting…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/bookings/${id}`} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
        <ChevronLeft size={16} />
        Back to Booking
      </Link>

      <div>
        <h1 className="text-2xl font-black text-slate-900">Reschedule Booking</h1>
        {booking && <p className="text-slate-500 text-sm mt-1">{booking.sessionName} · {booking.playerName}</p>}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 text-sm">You can reschedule a booking once per 7-day period from the original booking date. This action cannot be reversed through the portal.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Select Replacement Session</h2>
          {availableSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No available sessions for rescheduling.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSessions.map((s) => (
                <label key={s.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selected === s.id ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="session" value={s.id} checked={selected === s.id} onChange={() => setSelected(s.id)} className="accent-[#2563EB]" />
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                      <p className="text-slate-500 text-xs">{new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.startTime}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.spotsRemaining <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {s.spotsRemaining} spots
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link to={`/bookings/${id}`} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-center text-sm hover:bg-slate-50 transition-colors">Cancel</Link>
          <button type="submit" disabled={submitting || !selected} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Rescheduling…</> : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </div>
  );
}