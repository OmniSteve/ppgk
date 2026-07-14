import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, CreditCard, Users, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

const sectionCls = 'bg-card rounded-2xl border border-border p-5';

// Normalise session fields for display (may come from sessionStorage, which stores
// the already-normalised catalogue shape, or straight from the camelCase API)
function normaliseSession(s) {
  if (!s) return s;
  return {
    ...s,
    name: s.name ?? s.title ?? '',
    date: s.date ?? s.sessionDate ?? '',
    startTime: s.startTime ?? '',
    endTime: s.endTime ?? '',
    credits: s.credits ?? s.creditCost ?? null,
  };
}

// Default optional player display fields — the API contract guarantees camelCase keys
function normalisePlayer(p) {
  if (!p) return p;
  return {
    ...p,
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    ageGroup: p.ageGroup ?? '',
    experienceLevel: p.experienceLevel ?? '',
    isAccountHolder: !!p.isAccountHolder,
  };
}

export default function Checkout() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('ppgk_checkout_sessions');
    if (!stored) { navigate('/sessions'); return; }
    try {
      const parsed = JSON.parse(stored);
      setSessions(Array.isArray(parsed) ? parsed.map(normaliseSession) : []);
    } catch {
      navigate('/sessions');
      return;
    }

    // Load players
    apiClient.get('/players')
      .then((data) => setPlayers(unwrap(data, 'players').map(normalisePlayer)))
      .catch(() => setPlayers([]));

    // Load credit balance
    apiClient.get('/credits')
      .then((data) => setCreditBalance(data?.balance ?? 0))
      .catch(() => setCreditBalance(0));
  }, [navigate]);

  const totalCredits = sessions.reduce((sum, s) => sum + (s.credits || 0), 0);
  const totalPrice = sessions.reduce((sum, s) => sum + (s.price || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return setError('Please select a player.');
    if (!agreed) return setError('Please confirm the terms.');
    setError(''); setLoading(true);
    try {
      const res = await apiClient.post('/bookings', {
        sessionIds: sessions.map((s) => s.id),
        playerId: selectedPlayer,
        paymentMethod,
        idempotencyKey: `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      sessionStorage.removeItem('ppgk_checkout_sessions');

      if (paymentMethod === 'card' && res.orderId) {
        // Initiate Stripe checkout
        const checkoutRes = await apiClient.post('/checkout', { orderId: res.orderId });
        if (checkoutRes.checkoutUrl) {
          window.location.href = checkoutRes.checkoutUrl;
          return;
        }
      }

      // Credits payment — booking already confirmed
      const bookingIds = Array.isArray(res.bookingIds) ? res.bookingIds : [];
      navigate(`/payment/result?status=success&bookingIds=${bookingIds.join(',')}`);
    } catch (err) {
      const body = err.responseBody;
      if (body?.step && body?.message) {
        // Debug-visible structured error from worker
        setError(`Booking failed at "${body.step}": ${body.message}`);
      } else {
        setError(err.message || 'Booking failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sessions.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const radioItem = (active) => `flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${active ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/40'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
          <ShoppingCart size={24} className="text-primary" />Checkout
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Review and confirm your booking</p>
      </div>

      {error && (
        <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-destructive flex-shrink-0" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={sectionCls}>
          <h2 className="font-bold text-foreground mb-4">Sessions Selected</h2>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-semibold text-foreground text-sm">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.date ? new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'} · {s.startTime} – {s.endTime}</p>
                </div>
                <span className="font-bold text-foreground text-sm text-label-mono">{s.credits ? `${s.credits} cr` : `€${s.price ?? '—'}`}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-black text-xl text-foreground text-label-mono">
              {totalCredits > 0 ? `${totalCredits} credits` : `€${totalPrice.toFixed(2)}`}
            </span>
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Users size={18} className="text-primary" />Select Player
          </h2>
          {players.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No player profiles yet</p>
              <Link to="/players/new" className="text-primary text-sm font-semibold hover:underline">+ Create a player profile</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p) => (
                <label key={p.id} className={radioItem(selectedPlayer === p.id)}>
                  <input type="radio" name="player" value={p.id} checked={selectedPlayer === p.id} onChange={() => setSelectedPlayer(p.id)} className="accent-primary" />
                  <div>
                    <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      {p.firstName} {p.lastName}
                      {p.isAccountHolder && <span className="text-muted-foreground text-xs font-medium">(My Player Profile)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">{p.ageGroup}{p.experienceLevel ? ` · ${p.experienceLevel}` : ''}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />Payment Method
          </h2>
          <div className="space-y-2">
            <label className={radioItem(paymentMethod === 'card')}>
              <input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-primary" />
              <div>
                <p className="font-semibold text-foreground text-sm">Pay by card</p>
                <p className="text-muted-foreground text-xs text-label-mono">Secure card payment — €{totalPrice.toFixed(2)} EUR</p>
              </div>
            </label>
            <label className={`${radioItem(paymentMethod === 'credits')} ${creditBalance < totalCredits ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input type="radio" disabled={creditBalance < totalCredits} checked={paymentMethod === 'credits'} onChange={() => setPaymentMethod('credits')} className="accent-primary" />
              <div>
                <p className="font-semibold text-foreground text-sm">Use session credits</p>
                <p className="text-muted-foreground text-xs text-label-mono">
                  {creditBalance} credits available · Need {totalCredits}
                  {creditBalance < totalCredits ? ' — insufficient balance' : ''}
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className={sectionCls}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-primary" />
            <span className="text-foreground text-sm leading-relaxed">
              I confirm this booking for the selected player and agree to the{' '}
              <Link to="/terms" target="_blank" className="text-primary hover:underline">booking terms</Link>.
              I understand that amendments are limited to once per 7-day period per booking.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedPlayer || !agreed}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : `Confirm Booking${paymentMethod === 'card' ? ` · €${totalPrice.toFixed(2)}` : ` · ${totalCredits} credits`}`}
        </button>
      </form>
    </div>
  );
}
