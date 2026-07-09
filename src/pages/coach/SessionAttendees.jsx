import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, User, Phone, AlertTriangle, ClipboardList, TrendingUp } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function SessionAttendees() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/coach/sessions/${id}`),
      apiClient.get(`/coach/sessions/${id}/attendees`),
    ]).then(([s, a]) => {
      setSession(s);
      setAttendees(Array.isArray(a) ? a : (a?.attendees ?? []));
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/coach/sessions" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      {session && (
        <div className="bg-[#0D1B2A] rounded-2xl p-5 border border-white/10">
          <h1 className="text-white font-black text-xl">{session.title || session.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {session.startTime} – {session.endTime}</p>
          <p className="text-[#2563EB] text-sm mt-1">{attendees.length} / {session.capacity} players</p>
        </div>
      )}

      <div className="flex justify-end">
        <Link to={`/coach/sessions/${id}/attendance`} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
          <ClipboardList size={16} />Record Attendance
        </Link>
      </div>

      {attendees.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
          <User size={32} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">No bookings yet</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/10">
          {attendees.map((a) => (
            <div key={a.bookingId} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center">
                    <span className="font-bold text-white text-sm">{a.firstName?.[0]}{a.lastName?.[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{a.firstName} {a.lastName}</p>
                    <p className="text-slate-400 text-xs">{a.ageGroup} · {a.experienceLevel}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Parent: {a.parentName}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  a.bookingStatus === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                }`}>{a.bookingStatus?.replace(/_/g, ' ')}</span>
              </div>

              {(a.medicalInfo || a.allergies) && (
                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-300">
                    {a.medicalInfo && <p><strong>Medical:</strong> {a.medicalInfo}</p>}
                    {a.allergies && <p><strong>Allergies:</strong> {a.allergies}</p>}
                  </div>
                </div>
              )}

              {a.emergencyPhone && (
                <div className="mt-2 flex items-center gap-1.5 text-slate-500 text-xs">
                  <Phone size={12} />Emergency: {a.emergencyContactName} — {a.emergencyPhone}
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Link
                  to={`/coach/players/${a.playerId}/performance`}
                  state={{ player: { firstName: a.firstName, lastName: a.lastName, clientId: a.clientId } }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-white transition-colors"
                >
                  <TrendingUp size={13} />Performance
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}