import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle, AlertTriangle, Loader2, Save } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const STATUS_OPTIONS = [
  { value: 'attended', label: 'Attended', activeClass: 'border-green-500 bg-green-500/20 text-green-400' },
  { value: 'absent', label: 'Absent', activeClass: 'border-red-500 bg-red-500/20 text-red-400' },
  { value: 'cancelled', label: 'Cancelled', activeClass: 'border-slate-500 bg-slate-500/20 text-slate-300' },
  { value: 'excused', label: 'Excused', activeClass: 'border-amber-500 bg-amber-500/20 text-amber-400' },
];

export default function AttendanceRecording() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get(`/coach/sessions/${id}`),
      apiClient.get(`/coach/sessions/${id}/attendees`),
    ]).then(([s, a]) => {
      setSession(s);
      setAttendance(a.map((att) => ({ ...att, attendanceStatus: att.attendanceStatus || 'not_recorded', notes: att.notes || '' })));
    }).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = (bookingId, field, value) => {
    setAttendance((prev) => prev.map((a) => a.bookingId === bookingId ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiClient.post(`/coach/sessions/${id}/attendance`, {
        records: attendance.map((a) => ({ bookingId: a.bookingId, status: a.attendanceStatus, notes: a.notes })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/coach/sessions" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      {session && (
        <div className="bg-[#0D1B2A] rounded-2xl p-5 border border-white/10">
          <h1 className="text-white font-black text-xl">Attendance — {session.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{new Date(session.date).toLocaleDateString('en-MT', { weekday: 'long', day: 'numeric', month: 'long' })} · {session.startTime}</p>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}
      {saved && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />Attendance saved!</div>}

      <div className="space-y-3">
        {attendance.map((a) => (
          <div key={a.bookingId} className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 flex items-center justify-center">
                <span className="font-bold text-white text-sm">{a.playerFirstName?.[0]}{a.playerLastName?.[0]}</span>
              </div>
              <div>
                <p className="font-bold text-white">{a.playerFirstName} {a.playerLastName}</p>
                <p className="text-slate-400 text-xs">{a.ageGroup}</p>
              </div>
              {(a.medicalInfo || a.allergies) && (
                <AlertTriangle size={16} className="text-amber-400 ml-auto" title="Medical info on file" />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateStatus(a.bookingId, 'attendanceStatus', opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    a.attendanceStatus === opt.value ? opt.activeClass : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <textarea
              value={a.notes}
              onChange={(e) => updateStatus(a.bookingId, 'notes', e.target.value)}
              placeholder="Coach notes (optional)…"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors resize-none"
            />
          </div>
        ))}
      </div>

      {attendance.length > 0 && (
        <button onClick={handleSave} disabled={saving} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} />Save Attendance</>}
        </button>
      )}
    </div>
  );
}