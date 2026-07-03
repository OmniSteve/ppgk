import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, ClipboardList } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function CoachSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    apiClient.get(`/coach/sessions?filter=${filter}`).then(setSessions).catch(() => setSessions([])).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">My Sessions</h1>

      <div className="flex gap-2">
        {[{ key: 'upcoming', label: 'Upcoming' }, { key: 'today', label: 'Today' }, { key: 'past', label: 'Past' }].map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setLoading(true); }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === f.key ? 'bg-[#2563EB] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2563EB]/40'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar size={36} className="text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500">No sessions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#2563EB]/40 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <p className="text-slate-500 text-xs mt-1">{s.sessionType}</p>
                </div>
                <span className="font-bold text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-full">{s.bookingCount}/{s.capacity}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4 text-slate-500 text-xs">
                <span className="flex items-center gap-1.5"><Calendar size={12} />{new Date(s.date).toLocaleDateString('en-MT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="flex items-center gap-1.5"><Clock size={12} />{s.startTime} – {s.endTime}</span>
                <span className="flex items-center gap-1.5"><MapPin size={12} />{s.locationName}</span>
                <span className="flex items-center gap-1.5"><Users size={12} />{s.ageGroup}</span>
              </div>
              <div className="flex gap-2">
                <Link to={`/coach/sessions/${s.id}/attendees`} className="flex-1 text-center text-sm font-semibold py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:border-[#2563EB]/40 transition-all flex items-center justify-center gap-2">
                  <Users size={14} />
                  Attendees
                </Link>
                <Link to={`/coach/sessions/${s.id}/attendance`} className="flex-1 text-center text-sm font-bold py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] transition-all flex items-center justify-center gap-2">
                  <ClipboardList size={14} />
                  Attendance
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}