import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle, AlertTriangle, Loader2, Save } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const STATUS_OPTIONS = [
  { value: 'attended', label: 'Attended', activeClass: 'border-success bg-success/20 text-success' },
  { value: 'absent', label: 'Absent', activeClass: 'border-destructive bg-destructive/20 text-destructive' },
  { value: 'cancelled', label: 'Cancelled', activeClass: 'border-border bg-accent text-muted-foreground' },
  { value: 'excused', label: 'Excused', activeClass: 'border-warning bg-warning/20 text-warning' },
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
      const list = Array.isArray(a) ? a : (a?.attendees ?? []);
      setAttendance(list.map((att) => ({ ...att, attendanceStatus: att.attendanceStatus || 'not_recorded', notes: att.notes || '' })));
    }).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = (bookingId, field, value) => {
    setAttendance((prev) => prev.map((a) => a.bookingId === bookingId ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await Promise.all(attendance.map((a) =>
        apiClient.post('/coach/attendance', {
          bookingId: a.bookingId,
          sessionId: id,
          playerId: a.playerId,
          status: a.attendanceStatus,
          notes: a.notes,
        })
      ));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/coach/sessions" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      {session && (
        <div className="bg-sidebar rounded-2xl p-5 border border-border">
          <h1 className="text-foreground font-black text-xl">Attendance — {session.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {session.startTime}</p>
        </div>
      )}

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}
      {saved && <div className="bg-success/20 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-success text-sm"><CheckCircle size={16} />Attendance saved!</div>}

      <div className="space-y-3">
        {attendance.map((a) => (
          <div key={a.bookingId} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="font-bold text-foreground text-sm">{a.firstName?.[0]}{a.lastName?.[0]}</span>
              </div>
              <div>
                <p className="font-bold text-foreground">{a.firstName} {a.lastName}</p>
                <p className="text-muted-foreground text-xs">{a.ageGroup}</p>
              </div>
              {(a.medicalInfo || a.allergies) && (
                <AlertTriangle size={16} className="text-warning ml-auto" title="Medical info on file" />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateStatus(a.bookingId, 'attendanceStatus', opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    a.attendanceStatus === opt.value ? opt.activeClass : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
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
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        ))}
      </div>

      {attendance.length > 0 && (
        <button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} />Save Attendance</>}
        </button>
      )}
    </div>
  );
}
