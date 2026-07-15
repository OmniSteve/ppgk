import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, User, ChevronLeft, CreditCard } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

function normaliseSession(s) {
  if (!s) return null;
  const capacity = s.capacity ?? null;
  const bookedCount = s.bookedCount ?? null;
  return {
    ...s,
    name: s.name ?? s.title ?? '',
    date: s.date ?? s.sessionDate ?? '',
    startTime: s.startTime ?? '',
    endTime: s.endTime ?? '',
    credits: s.credits ?? s.creditCost ?? null,
    price: s.price ?? null,
    locationName: s.locationName ?? '',
    locationAddress: s.locationAddress ?? s.addressLine1 ?? '',
    sessionType: s.sessionType ?? s.sessionTypeName ?? '',
    coachName: s.coachName ?? '',
    ageGroup: s.ageGroup ?? '',
    abilityLevel: s.abilityLevel ?? '',
    spotsRemaining: s.spotsRemaining ?? (capacity != null && bookedCount != null ? capacity - bookedCount : null),
    bookingMode: s.bookingMode ?? 'instant',
  };
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    apiClient.get(`/sessions/${id}`)
      .then((data) => setSession(normaliseSession(data)))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [id]);

  const proceedToCheckout = () => {
    sessionStorage.setItem('ppgk_checkout_sessions', JSON.stringify([session]));
    navigate('/checkout');
  };

  const isRequestMode = session?.bookingMode === 'request';

  const handleBookNow = () => {
    if (isRequestMode) { setConfirmOpen(true); return; }
    proceedToCheckout();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!session) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground font-medium">Session not found</p>
      <Link to="/sessions" className="text-primary text-sm hover:underline mt-2 block">← Back to sessions</Link>
    </div>
  );

  // Request-mode sessions keep accepting requests past capacity (they feed
  // the backup pool) — only instant-mode sessions can be "fully booked".
  const fullyBooked = !isRequestMode && session.spotsRemaining === 0 && session.spotsRemaining != null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/sessions" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="bg-sidebar p-6 border-b border-border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-primary text-xs font-semibold uppercase tracking-wide mb-1">{session.sessionType}</p>
              <h1 className="text-foreground font-black text-2xl break-words">{session.name}</h1>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                fullyBooked ? 'bg-destructive/20 text-destructive' :
                !isRequestMode && session.spotsRemaining <= 3 ? 'bg-warning/20 text-warning' :
                'bg-success/20 text-success'
              }`}>
                {fullyBooked ? 'Fully Booked' : isRequestMode ? 'Coach selects roster' : session.spotsRemaining != null ? `${session.spotsRemaining} spots` : 'Available'}
              </span>
              {isRequestMode && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-warning/20 text-warning">Request only</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {session.description && <p className="text-muted-foreground leading-relaxed">{session.description}</p>}

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            {[
              { icon: Calendar, label: 'Date', value: session.date ? new Date(session.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'long' }) : '—' },
              { icon: Clock, label: 'Time', value: `${session.startTime} – ${session.endTime}` },
              { icon: MapPin, label: 'Location', value: session.locationName },
              { icon: User, label: 'Coach', value: session.coachName || '—' },
              { icon: Users, label: 'Age Group', value: `${session.ageGroup || 'All ages'}${session.abilityLevel ? ' · ' + session.abilityLevel : ''}` },
              { icon: CreditCard, label: 'Price', value: session.credits ? `${session.credits} credit${session.credits > 1 ? 's' : ''}` : `€${session.price ?? '—'}` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent border border-border flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{item.label}</p>
                  <p className="font-semibold text-foreground text-sm break-words">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {session.locationAddress && (
            <div className="bg-accent border border-border rounded-xl p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Address</p>
              <p className="text-foreground text-sm">{session.locationAddress}</p>
            </div>
          )}

          {isRequestMode && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <p className="text-warning text-sm font-medium">
                This session has limited places. Requesting does not guarantee a place — the coach reviews all requests and confirms the final roster.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-muted-foreground text-sm">Total per player</p>
                <p className="text-3xl font-black text-foreground text-label-mono">
                  {session.credits ? `${session.credits} credits` : `€${session.price ?? '—'}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleBookNow}
              disabled={fullyBooked}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-bold py-4 rounded-xl text-base transition-colors"
            >
              {fullyBooked ? 'Fully Booked' : isRequestMode ? 'Request Place' : 'Book This Session'}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border text-foreground rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Request a place?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Submitting this request does not guarantee a place. The coach will review the player pool and confirm the final session roster. Your credit is reserved now and returned in full if you're not selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground hover:bg-accent">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedToCheckout} className="bg-primary hover:bg-primary-hover text-foreground">
              Continue to Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
