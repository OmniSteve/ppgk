import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function CancelBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [cancellationPolicy, setCancellationPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/bookings/${id}`),
      apiClient.get(`/bookings/${id}/cancellation-preview`),
    ]).then(([b, policy]) => {
      setBooking(b); setCancellationPolicy(policy);
    }).catch(() => navigate(`/bookings/${id}`)).finally(() => setLoading(false));
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  if (success) return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <CheckCircle size={48} className="text-green-400 mx-auto" />
      <h2 className="text-2xl font-black text-white">Booking cancelled</h2>
      <p className="text-slate-400">A confirmation email has been sent. Redirecting…</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to={`/bookings/${id}`} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Booking
      </Link>

      <h1 className="text-2xl font-black text-white">Cancel Booking</h1>

      {booking && (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
          <p className="font-bold text-white">{booking.sessionName}</p>
          <p className="text-slate-400 text-sm">{new Date(booking.sessionDate).toLocaleDateString('en-MT', { weekday: 'long', day: 'numeric', month: 'long' })} · {booking.startTime}</p>
          <p className="text-slate-400 text-sm">Player: {booking.playerName}</p>
        </div>
      )}

      {cancellationPolicy && (
        <div className={`rounded-xl p-4 border ${cancellationPolicy.refundCredits ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className={`flex-shrink-0 ${cancellationPolicy.refundCredits ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <p className={`font-bold text-sm ${cancellationPolicy.refundCredits ? 'text-green-300' : 'text-red-300'}`}>
                {cancellationPolicy.refundCredits ? 'Credits will be refunded' : 'No credit refund'}
              </p>
              <p className={`text-xs mt-1 ${cancellationPolicy.refundCredits ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {cancellationPolicy.reason}
              </p>
              {cancellationPolicy.refundCredits && (
                <p className="text-green-400 text-xs mt-0.5 font-semibold">{cancellationPolicy.creditsToRefund} credit{cancellationPolicy.creditsToRefund > 1 ? 's' : ''} will be returned to your balance.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#2563EB]" />
          <span className="text-slate-300 text-sm">
            I understand this cancellation {cancellationPolicy?.refundCredits ? 'will refund my credits' : 'will not refund credits'} and I wish to proceed.
          </span>
        </label>

        <div className="flex gap-3">
          <Link to={`/bookings/${id}`} className="flex-1 border border-white/20 text-slate-300 font-semibold py-3 rounded-xl text-center text-sm hover:bg-white/5 transition-colors">
            Keep Booking
          </Link>
          <button
            onClick={handleCancel}
            disabled={submitting || !confirmed}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Cancelling…</> : 'Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}