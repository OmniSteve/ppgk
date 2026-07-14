import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Filter, Search, ChevronDown, X } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

// Normalise a session from the camelCase API to the shape this page expects
function normaliseSession(s) {
  if (!s) return s;
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
    sessionType: s.sessionType ?? s.sessionTypeName ?? '',
    spotsRemaining: s.spotsRemaining ?? (capacity != null && bookedCount != null ? capacity - bookedCount : null),
    ageGroup: s.ageGroup ?? '',
    abilityLevel: s.abilityLevel ?? '',
  };
}

const StatusBadge = ({ spots }) => {
  if (spots == null) return <span className="bg-success/20 text-success text-xs font-semibold px-2 py-0.5 rounded-full">Available</span>;
  if (spots === 0) return <span className="bg-destructive/20 text-destructive text-xs font-semibold px-2 py-0.5 rounded-full">Full</span>;
  if (spots <= 3) return <span className="bg-warning/20 text-warning text-xs font-semibold px-2 py-0.5 rounded-full">{spots} left</span>;
  return <span className="bg-success/20 text-success text-xs font-semibold px-2 py-0.5 rounded-full">{spots} spots</span>;
};

const SessionCard = ({ session, onSelect, selected }) => (
  <div
    className={`bg-card rounded-2xl border transition-all cursor-pointer ${
      selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'
    }`}
    onClick={() => onSelect(session)}
  >
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-foreground text-xs font-bold leading-none text-label-mono">{new Date(session.date).getDate()}</span>
            <span className="text-primary text-[9px] font-semibold uppercase">{new Date(session.date).toLocaleString('en', { month: 'short' })}</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight truncate">{session.name}</h3>
            <p className="text-muted-foreground text-xs">{session.sessionType}</p>
          </div>
        </div>
        <span className="flex-shrink-0"><StatusBadge spots={session.spotsRemaining} /></span>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock size={12} />{session.startTime} – {session.endTime}</div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><MapPin size={12} />{session.locationName}</div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users size={12} />{session.ageGroup || 'All ages'}{session.abilityLevel ? ` · ${session.abilityLevel}` : ''}</div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-black text-foreground text-label-mono">
            {session.credits ? `${session.credits} credit${session.credits > 1 ? 's' : ''}` : `€${session.price ?? '—'}`}
          </span>
          {session.price && session.credits && (
            <span className="text-muted-foreground text-xs ml-2">or €{session.price}</span>
          )}
        </div>
        <Link to={`/sessions/${session.id}`} onClick={(e) => e.stopPropagation()} className="text-primary text-xs font-semibold hover:underline">
          Details →
        </Link>
      </div>
    </div>
    {selected && (
      <div className="border-t border-primary/20 bg-primary/10 px-5 py-2.5 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-foreground text-[10px] font-bold">✓</span>
        </div>
        <span className="text-primary text-xs font-semibold">Added to booking</span>
      </div>
    )}
  </div>
);

const inputCls = 'bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

export default function SessionCatalogue() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ageGroup: '', locationId: '', abilityLevel: '', typeId: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filters.typeId) params.set('typeId', filters.typeId);
    if (filters.locationId) params.set('locationId', filters.locationId);
    const qs = params.toString();
    apiClient.get(`/sessions${qs ? '?' + qs : ''}`)
      .then((data) => setSessions(unwrap(data, 'sessions').map(normaliseSession)))
      .catch((err) => { console.error('Sessions fetch error:', err); setError('Could not load sessions.'); setSessions([]); })
      .finally(() => setLoading(false));
  }, [filters, search]);

  const toggleSelect = (session) => {
    if (session.spotsRemaining === 0) return;
    setSelected((prev) =>
      prev.find((s) => s.id === session.id) ? prev.filter((s) => s.id !== session.id) : [...prev, session]
    );
  };

  const proceedToCheckout = () => {
    sessionStorage.setItem('ppgk_checkout_sessions', JSON.stringify(selected));
    navigate('/checkout');
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-5 ${selected.length > 0 ? 'pb-28' : ''}`}>
      <div>
        <h1 className="text-2xl font-black text-foreground">Available Sessions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Select one or more sessions to book</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions…" className={`w-full pl-9 ${inputCls}`} />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters ? 'bg-primary text-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'}`}
          >
            <Filter size={15} />Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
            {[
              { key: 'ageGroup', label: 'All ages', options: ['U8','U10','U12','U14','U16','U18','Senior'] },
              { key: 'abilityLevel', label: 'All levels', options: ['Beginner','Intermediate','Advanced','Elite'] },
            ].map(({ key, label, options }) => (
              <div key={key} className="relative">
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  className={`w-full ${inputCls} appearance-none pr-8`}
                >
                  <option value="">{label}</option>
                  {options.map((v) => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <Calendar size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No sessions available</p>
          <p className="text-muted-foreground text-sm mt-1">Check back soon or adjust your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onSelect={toggleSelect} selected={!!selected.find((x) => x.id === s.id)} />
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-sidebar border-t border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-20">
          <div className="min-w-0">
            <p className="text-foreground font-bold truncate">{selected.length} session{selected.length > 1 ? 's' : ''} selected</p>
            <p className="text-muted-foreground text-xs text-label-mono">
              {selected.reduce((sum, s) => sum + (s.credits || 0), 0)} credits or €{selected.reduce((sum, s) => sum + (s.price || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setSelected([])} aria-label="Clear selected sessions" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><X size={18} /></button>
            <button onClick={proceedToCheckout} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
              Continue to Checkout →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
