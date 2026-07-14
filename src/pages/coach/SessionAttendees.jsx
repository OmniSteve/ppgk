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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/coach/sessions" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      {session && (
        <div className="bg-sidebar rounded-2xl p-5 border border-border">
          <h1 className="text-foreground font-black text-xl">{session.title || session.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {session.startTime} – {session.endTime}</p>
          <p className="text-primary text-sm mt-1 text-label-mono">{attendees.length} / {session.capacity} players</p>
        </div>
      )}

      <div className="flex justify-end">
        <Link to={`/coach/sessions/${id}/attendance`} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
          <ClipboardList size={16} />Record Attendance
        </Link>
      </div>

      {attendees.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <User size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No bookings yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {attendees.map((a) => (
            <div key={a.bookingId} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-foreground text-sm">{a.firstName?.[0]}{a.lastName?.[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-muted-foreground text-xs truncate">{a.ageGroup} · {a.experienceLevel}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">Parent: {a.parentName}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.bookingStatus === 'confirmed' ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'
                }`}>{a.bookingStatus?.replace(/_/g, ' ')}</span>
              </div>

              {(a.medicalInfo || a.allergies) && (
                <div className="mt-3 bg-warning/20 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-warning">
                    {a.medicalInfo && <p><strong>Medical:</strong> {a.medicalInfo}</p>}
                    {a.allergies && <p><strong>Allergies:</strong> {a.allergies}</p>}
                  </div>
                </div>
              )}

              {a.emergencyPhone && (
                <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Phone size={12} />Emergency: {a.emergencyContactName} — {a.emergencyPhone}
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Link
                  to={`/coach/players/${a.playerId}/performance`}
                  state={{ player: { firstName: a.firstName, lastName: a.lastName, clientId: a.clientId } }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-foreground transition-colors"
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
