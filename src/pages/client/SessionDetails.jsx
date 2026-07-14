import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, User, ChevronLeft, CreditCard } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

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
  };
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/sessions/${id}`)
      .then((data) => setSession(normaliseSession(data)))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBookNow = () => {
    sessionStorage.setItem('ppgk_checkout_sessions', JSON.stringify([session]));
    navigate('/checkout');
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
            <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${
              session.spotsRemaining === 0 ? 'bg-destructive/20 text-destructive' :
              session.spotsRemaining <= 3 ? 'bg-warning/20 text-warning' :
              'bg-success/20 text-success'
            }`}>
              {session.spotsRemaining === 0 ? 'Fully Booked' : session.spotsRemaining != null ? `${session.spotsRemaining} spots` : 'Available'}
            </span>
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
              disabled={session.spotsRemaining === 0 && session.spotsRemaining != null}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-bold py-4 rounded-xl text-base transition-colors"
            >
              {session.spotsRemaining === 0 && session.spotsRemaining != null ? 'Fully Booked' : 'Book This Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
