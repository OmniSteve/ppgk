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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Coach Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Your assigned sessions</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today's Sessions", value: data?.todaySessions?.length ?? 0, icon: Calendar, color: 'bg-[#2563EB]/20 text-[#2563EB]' },
          { label: 'Upcoming Sessions', value: data?.upcomingSessions?.length ?? 0, icon: Clock, color: 'bg-green-500/20 text-green-400' },
          { label: 'Attendance Pending', value: data?.attendancePending ?? 0, icon: ClipboardList, color: 'bg-amber-500/20 text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 rounded-2xl border border-white/10 p-5 text-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {data?.todaySessions?.length > 0 && (
        <div>
          <h2 className="font-bold text-white mb-3">Today's Sessions</h2>
          <div className="space-y-3">
            {data.todaySessions.map((s) => (
              <div key={s.id} className="bg-white/5 rounded-2xl border border-white/10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-white">{s.name}</p>
                    <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
                      <Clock size={13} />{s.startTime} – {s.endTime}
                      <MapPin size={13} />{s.locationName}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-full">
                    {s.bookingCount} / {s.capacity}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/coach/sessions/${s.id}/attendees`} className="flex-1 text-center text-sm font-semibold py-2 border border-white/20 rounded-xl text-slate-300 hover:border-[#2563EB]/40 hover:text-white transition-all flex items-center justify-center gap-2">
                    <Users size={14} />Attendees
                  </Link>
                  <Link to={`/coach/sessions/${s.id}/attendance`} className="flex-1 text-center text-sm font-bold py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] transition-all flex items-center justify-center gap-2">
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
          <h2 className="font-bold text-white">Upcoming Sessions</h2>
          <Link to="/coach/sessions" className="text-[#2563EB] text-sm font-medium hover:underline">View all →</Link>
        </div>
        {data?.upcomingSessions?.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <Calendar size={32} className="text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No upcoming sessions assigned</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.upcomingSessions.slice(0, 5).map((s) => (
              <Link key={s.id} to={`/coach/sessions/${s.id}/attendees`} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-[#2563EB]/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold leading-none">{new Date(s.date).getDate()}</span>
                  <span className="text-[#2563EB] text-[9px] font-bold uppercase">{new Date(s.date).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{s.name}</p>
                  <p className="text-slate-400 text-xs">{s.startTime} · {s.locationName} · {s.bookingCount} players</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}