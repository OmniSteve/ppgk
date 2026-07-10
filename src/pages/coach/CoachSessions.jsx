import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, ClipboardList } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function CoachSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    apiClient.get(`/coach/sessions?filter=${filter}`).then((d) => setSessions(d.sessions || d || [])).catch(() => setSessions([])).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-foreground">My Sessions</h1>

      <div className="flex gap-2">
        {[{ key: 'upcoming', label: 'Upcoming' }, { key: 'today', label: 'Today' }, { key: 'past', label: 'Past' }].map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setLoading(true); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === f.key ? 'bg-primary text-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Calendar size={36} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No sessions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="bg-card rounded-2xl border border-border p-5 hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground">{s.title}</p>
                  <p className="text-muted-foreground text-xs mt-1">{s.sessionTypeName}</p>
                </div>
                <span className="font-bold text-sm bg-accent text-foreground px-3 py-1 rounded-full text-label-mono">{s.bookedCount}/{s.capacity}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4 text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5"><Calendar size={12} />{s.sessionDate ? new Date(s.sessionDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span>
                <span className="flex items-center gap-1.5"><Clock size={12} />{s.startTime} – {s.endTime}</span>
                <span className="flex items-center gap-1.5"><MapPin size={12} />{s.locationName}</span>
                <span className="flex items-center gap-1.5"><Users size={12} />{s.ageGroup}</span>
              </div>
              <div className="flex gap-2">
                <Link to={`/coach/sessions/${s.id}/attendees`} className="flex-1 text-center text-sm font-semibold py-2.5 border border-border rounded-xl text-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2">
                  <Users size={14} />Attendees
                </Link>
                <Link to={`/coach/sessions/${s.id}/attendance`} className="flex-1 text-center text-sm font-bold py-2.5 bg-primary text-foreground rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-2">
                  <ClipboardList size={14} />Attendance
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
