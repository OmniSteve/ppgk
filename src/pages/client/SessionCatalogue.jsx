import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Filter, Search, ChevronDown, X } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const StatusBadge = ({ spots }) => {
  if (spots === 0) return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">Full</span>;
  if (spots <= 3) return <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{spots} left</span>;
  return <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">{spots} spots</span>;
};

const SessionCard = ({ session, onSelect, selected }) => (
  <div
    className={`bg-white rounded-2xl border transition-all cursor-pointer ${
      selected ? 'border-[#2563EB] shadow-md shadow-[#2563EB]/10 ring-1 ring-[#2563EB]/30' : 'border-slate-200 hover:border-[#2563EB]/40 hover:shadow-sm'
    }`}
    onClick={() => onSelect(session)}
  >
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[#0D1B2A] flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold leading-none">{new Date(session.date).getDate()}</span>
            <span className="text-[#2563EB] text-[9px] font-semibold uppercase">{new Date(session.date).toLocaleString('en', { month: 'short' })}</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-tight">{session.name}</h3>
            <p className="text-slate-500 text-xs">{session.sessionType}</p>
          </div>
        </div>
        <StatusBadge spots={session.spotsRemaining} />
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Clock size={12} />
          {session.startTime} – {session.endTime}
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <MapPin size={12} />
          {session.locationName}
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Users size={12} />
          Age: {session.ageGroup} · {session.abilityLevel}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-black text-slate-900">
            {session.credits ? `${session.credits} credit${session.credits > 1 ? 's' : ''}` : `€${session.price}`}
          </span>
          {session.price && session.credits && (
            <span className="text-slate-400 text-xs ml-2">or €{session.price}</span>
          )}
        </div>
        <Link
          to={`/sessions/${session.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[#2563EB] text-xs font-semibold hover:underline"
        >
          Details →
        </Link>
      </div>
    </div>
    {selected && (
      <div className="border-t border-[#2563EB]/20 bg-[#2563EB]/5 px-5 py-2.5 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold">✓</span>
        </div>
        <span className="text-[#2563EB] text-xs font-semibold">Added to booking</span>
      </div>
    )}
  </div>
);

export default function SessionCatalogue() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ageGroup: '', location: '', abilityLevel: '', sessionType: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    apiClient.get('/sessions?' + new URLSearchParams({ ...filters, search }).toString())
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [filters, search]);

  const toggleSelect = (session) => {
    if (session.spotsRemaining === 0) return;
    setSelected((prev) =>
      prev.find((s) => s.id === session.id)
        ? prev.filter((s) => s.id !== session.id)
        : [...prev, session]
    );
  };

  const proceedToCheckout = () => {
    sessionStorage.setItem('ppgk_checkout_sessions', JSON.stringify(selected));
    navigate('/checkout');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Available Sessions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Select one or more sessions to book</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'border-slate-200 text-slate-600 hover:border-[#2563EB]'}`}
          >
            <Filter size={15} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            {['ageGroup', 'abilityLevel', 'location', 'sessionType'].map((key) => (
              <div key={key} className="relative">
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2563EB] appearance-none bg-white text-slate-700 pr-8"
                >
                  <option value="">{key === 'ageGroup' ? 'All ages' : key === 'abilityLevel' ? 'All levels' : key === 'location' ? 'All locations' : 'All types'}</option>
                  {key === 'ageGroup' && ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'].map((v) => <option key={v}>{v}</option>)}
                  {key === 'abilityLevel' && ['Beginner', 'Intermediate', 'Advanced', 'Elite'].map((v) => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No sessions available</p>
          <p className="text-slate-400 text-sm mt-1">Check back soon or adjust your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onSelect={toggleSelect}
              selected={!!selected.find((x) => x.id === s.id)}
            />
          ))}
        </div>
      )}

      {/* Checkout bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-[#0D1B2A] border-t border-white/10 px-4 py-4 flex items-center justify-between z-20">
          <div>
            <p className="text-white font-bold">{selected.length} session{selected.length > 1 ? 's' : ''} selected</p>
            <p className="text-slate-400 text-xs">
              {selected.reduce((sum, s) => sum + (s.credits || 0), 0)} credits or €{selected.reduce((sum, s) => sum + (s.price || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected([])} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
            <button
              onClick={proceedToCheckout}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              Continue to Checkout →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}