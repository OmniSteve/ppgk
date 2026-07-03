import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, User, ChevronLeft, CreditCard } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/sessions/${id}`)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBookNow = () => {
    sessionStorage.setItem('ppgk_checkout_sessions', JSON.stringify([session]));
    navigate('/checkout');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
    </div>
  );

  if (!session) return (
    <div className="text-center py-20">
      <p className="text-slate-500 font-medium">Session not found</p>
      <Link to="/sessions" className="text-[#2563EB] text-sm hover:underline mt-2 block">← Back to sessions</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/sessions" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
        <ChevronLeft size={16} />
        Back to Sessions
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-[#0D1B2A] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#2563EB] text-xs font-semibold uppercase tracking-wide mb-1">{session.sessionType}</p>
              <h1 className="text-white font-black text-2xl">{session.name}</h1>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              session.spotsRemaining === 0 ? 'bg-red-500/20 text-red-400' :
              session.spotsRemaining <= 3 ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {session.spotsRemaining === 0 ? 'Fully Booked' : `${session.spotsRemaining} spots`}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {session.description && (
            <p className="text-slate-600 leading-relaxed">{session.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Calendar size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Date</p>
                <p className="font-semibold text-slate-900 text-sm">{new Date(session.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Time</p>
                <p className="font-semibold text-slate-900 text-sm">{session.startTime} – {session.endTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <MapPin size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Location</p>
                <p className="font-semibold text-slate-900 text-sm">{session.locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <User size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Coach</p>
                <p className="font-semibold text-slate-900 text-sm">{session.coachName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Age Group</p>
                <p className="font-semibold text-slate-900 text-sm">{session.ageGroup} · {session.abilityLevel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <CreditCard size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Price</p>
                <p className="font-semibold text-slate-900 text-sm">
                  {session.credits ? `${session.credits} credit${session.credits > 1 ? 's' : ''}` : `€${session.price}`}
                </p>
              </div>
            </div>
          </div>

          {session.locationAddress && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-slate-500 text-xs font-medium mb-1">Address</p>
              <p className="text-slate-700 text-sm">{session.locationAddress}</p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-500 text-sm">Total per player</p>
                <p className="text-3xl font-black text-slate-900">
                  {session.credits ? `${session.credits} credits` : `€${session.price}`}
                </p>
              </div>
            </div>

            <button
              onClick={handleBookNow}
              disabled={session.spotsRemaining === 0}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-colors"
            >
              {session.spotsRemaining === 0 ? 'Fully Booked' : 'Book This Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}