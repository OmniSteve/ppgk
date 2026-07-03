import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, CreditCard, Users, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function Checkout() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [credits, setCredits] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('ppgk_checkout_sessions');
    if (!stored) { navigate('/sessions'); return; }
    setSessions(JSON.parse(stored));
    apiClient.get('/players').then(setPlayers).catch(() => setPlayers([]));
    apiClient.get('/credits/balance').then((d) => setCredits(d.packages || [])).catch(() => setCredits([]));
  }, [navigate]);

  const totalCredits = sessions.reduce((sum, s) => sum + (s.credits || 0), 0);
  const totalPrice = sessions.reduce((sum, s) => sum + (s.price || 0), 0);
  const availableCredits = credits.reduce((sum, p) => sum + (p.remainingCredits || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return setError('Please select a player.');
    if (!agreed) return setError('Please confirm the terms.');
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/bookings/create', {
        sessionIds: sessions.map((s) => s.id),
        playerId: selectedPlayer,
        paymentMethod,
        packagePurchaseId: paymentMethod === 'credits' ? selectedPackage : null,
        idempotencyKey: `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      sessionStorage.removeItem('ppgk_checkout_sessions');
      navigate(`/payment-result?status=success&bookingIds=${res.bookingIds?.join(',')}`);
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sessions.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <ShoppingCart size={24} className="text-[#2563EB]" />
          Checkout
        </h1>
        <p className="text-slate-500 text-sm mt-1">Review and confirm your booking</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sessions summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Sessions Selected</h2>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                  <p className="text-slate-500 text-xs">{new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.startTime} – {s.endTime}</p>
                </div>
                <span className="font-bold text-slate-900 text-sm">
                  {s.credits ? `${s.credits} cr` : `€${s.price}`}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-black text-xl text-slate-900">
              {totalCredits > 0 ? `${totalCredits} credits` : `€${totalPrice.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Player selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users size={18} className="text-[#2563EB]" />
            Select Player
          </h2>
          {players.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm mb-3">No player profiles yet</p>
              <Link to="/players/new" className="text-[#2563EB] text-sm font-semibold hover:underline">+ Create a player profile</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p) => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPlayer === p.id ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="player" value={p.id} checked={selectedPlayer === p.id} onChange={() => setSelectedPlayer(p.id)} className="accent-[#2563EB]" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{p.firstName} {p.lastName}</p>
                    <p className="text-slate-500 text-xs">{p.ageGroup} · {p.experienceLevel}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-[#2563EB]" />
            Payment Method
          </h2>
          <div className="space-y-2">
            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-[#2563EB]" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Pay by card</p>
                  <p className="text-slate-400 text-xs">Secure card payment — €{totalPrice.toFixed(2)} EUR</p>
                </div>
              </div>
            </label>
            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              availableCredits < totalCredits ? 'opacity-50 cursor-not-allowed' :
              paymentMethod === 'credits' ? 'border-[#2563EB] bg-[#2563EB]/5' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <div className="flex items-center gap-3">
                <input type="radio" disabled={availableCredits < totalCredits} checked={paymentMethod === 'credits'} onChange={() => setPaymentMethod('credits')} className="accent-[#2563EB]" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Use session credits</p>
                  <p className="text-slate-400 text-xs">
                    {availableCredits} credits available · Need {totalCredits}
                    {availableCredits < totalCredits ? ' — insufficient balance' : ''}
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Confirm */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#2563EB]" />
            <span className="text-slate-600 text-sm leading-relaxed">
              I confirm this booking for the selected player and agree to the{' '}
              <Link to="/terms" target="_blank" className="text-[#2563EB] hover:underline">booking terms</Link>.
              I understand that amendments are limited to once per 7-day period per booking.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedPlayer || !agreed}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : `Confirm Booking${paymentMethod === 'card' ? ` · €${totalPrice.toFixed(2)}` : ` · ${totalCredits} credits`}`}
        </button>
      </form>
    </div>
  );
}