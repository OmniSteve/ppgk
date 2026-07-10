import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

function normaliseBooking(b) {
  if (!b) return null;
  return {
    ...b,
    sessionName: b.sessionName ?? '',
    sessionDate: b.sessionDate ?? '',
    startTime: b.startTime ?? '',
    playerName: b.playerName ?? '',
    paymentMethod: b.paymentMethod ?? '',
  };
}

export default function CancelBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiClient.get(`/bookings/${id}`)
      .then((data) => setBooking(normaliseBooking(data)))
      .catch(() => navigate(`/bookings/${id}`))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleCancel = async () => {
    if (!confirmed) return;
    setSubmitting(true); setError('');
    try {
      await apiClient.post(`/bookings/${id}/cancel`, {});
      setSuccess(true);
      setTimeout(() => navigate('/bookings'), 2000);
    } catch (err) {
      setError(err.message || 'Cancellation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  if (success) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <CheckCircle size={48} className="text-success mx-auto" />
      <h2 className="text-2xl font-black text-foreground">Booking cancelled</h2>
      <p className="text-muted-foreground">A confirmation email has been sent. Redirecting…</p>
    </div>
  );

  const usedCredits = booking?.paymentMethod === 'credits';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/bookings/${id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Booking
      </Link>

      <h1 className="text-2xl font-black text-foreground">Cancel Booking</h1>

      {booking && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="font-bold text-foreground">{booking.sessionName}</p>
          <p className="text-muted-foreground text-sm">{booking.sessionDate ? new Date(booking.sessionDate).toLocaleDateString('en-MT', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {booking.startTime}</p>
          <p className="text-muted-foreground text-sm">Player: {booking.playerName}</p>
        </div>
      )}

      <div className={`rounded-xl p-4 border ${usedCredits ? 'bg-success/20 border-success/30' : 'bg-destructive/20 border-destructive/30'}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className={`flex-shrink-0 ${usedCredits ? 'text-success' : 'text-destructive'}`} />
          <div>
            <p className={`font-bold text-sm ${usedCredits ? 'text-success' : 'text-destructive'}`}>
              {usedCredits ? 'Credits may be refunded' : 'No credit refund'}
            </p>
            <p className={`text-xs mt-1 ${usedCredits ? 'text-success/70' : 'text-destructive/70'}`}>
              {usedCredits
                ? 'If cancelled within the deadline, your credits will be returned to your balance.'
                : 'This booking was paid by card. Refunds are handled separately.'}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-primary" />
          <span className="text-foreground text-sm">
            I understand this cancellation {usedCredits ? 'may refund my credits depending on timing' : 'will not automatically refund card payments'} and I wish to proceed.
          </span>
        </label>

        <div className="flex gap-3">
          <Link to={`/bookings/${id}`} className="flex-1 border border-border text-foreground font-semibold py-3 rounded-xl text-center text-sm hover:bg-accent transition-colors">
            Keep Booking
          </Link>
          <button
            onClick={handleCancel}
            disabled={submitting || !confirmed}
            className="flex-1 bg-destructive hover:bg-destructive/80 disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Cancelling…</> : 'Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
