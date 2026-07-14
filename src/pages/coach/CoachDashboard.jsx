import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, ClipboardList, Clock, MapPin } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export default function CoachDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/coach/dashboard').then(setData).catch(() => setData({ todaySessions: [], upcomingSessions: [] })).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Coach Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your assigned sessions</p>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
        {[
          { label: "Today's Sessions", value: data?.todaySessions?.length ?? 0, icon: Calendar, color: 'bg-primary/20 text-primary' },
          { label: 'Upcoming Sessions', value: data?.upcomingSessions?.length ?? 0, icon: Clock, color: 'bg-success/20 text-success' },
          { label: 'Attendance Pending', value: data?.attendancePending ?? 0, icon: ClipboardList, color: 'bg-warning/20 text-warning' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-5 text-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <p className="text-display text-3xl font-black text-foreground">{s.value}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {data?.todaySessions?.length > 0 && (
        <div>
          <h2 className="font-bold text-foreground mb-3">Today's Sessions</h2>
          <div className="space-y-3">
            {data.todaySessions.map((s) => (
              <div key={s.id} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{s.title}</p>
                    <p className="text-muted-foreground text-sm flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      <span className="flex items-center gap-1"><Clock size={13} />{s.startTime} – {s.endTime}</span>
                      <span className="flex items-center gap-1 min-w-0 truncate"><MapPin size={13} className="flex-shrink-0" />{s.locationName}</span>
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground bg-accent px-3 py-1 rounded-full text-label-mono flex-shrink-0">
                    {s.bookedCount} / {s.capacity}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/coach/sessions/${s.id}/attendees`} className="flex-1 text-center text-sm font-semibold py-2 border border-border rounded-xl text-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2">
                    <Users size={14} />Attendees
                  </Link>
                  <Link to={`/coach/sessions/${s.id}/attendance`} className="flex-1 text-center text-sm font-bold py-2 bg-primary text-foreground rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-2">
                    <ClipboardList size={14} />Record Attendance
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Upcoming Sessions</h2>
          <Link to="/coach/sessions" className="text-primary text-sm font-medium hover:underline">View all →</Link>
        </div>
        {data?.upcomingSessions?.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No upcoming sessions assigned</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.upcomingSessions.slice(0, 5).map((s) => (
              <Link key={s.id} to={`/coach/sessions/${s.id}/attendees`} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-foreground text-xs font-bold leading-none text-label-mono">{new Date(s.sessionDate).getDate()}</span>
                  <span className="text-primary text-[9px] font-bold uppercase">{new Date(s.sessionDate).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{s.title}</p>
                  <p className="text-muted-foreground text-xs truncate">{s.startTime} · {s.locationName} · {s.bookedCount} players</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
