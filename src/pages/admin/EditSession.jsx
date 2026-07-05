import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const Input = (props) => <input className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" {...props} />;
const Select = ({ children, ...props }) => <select className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2563EB] transition-colors" {...props}>{children}</select>;
const Textarea = (props) => <textarea className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors resize-none" rows={3} {...props} />;
const Label = ({ children }) => <label className="block text-slate-300 text-sm font-medium mb-1.5">{children}</label>;
const Section = ({ title, children }) => (
  <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
    <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{title}</h2>
    {children}
  </div>
);

export default function EditSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get(`/admin/sessions/${id}`),
      apiClient.get('/admin/coaches'),
      apiClient.get('/admin/locations'),
      apiClient.get('/admin/session-types'),
    ]).then(([s, c, l, st]) => {
      // Normalise session snake_case → camelCase form fields
      setForm({
        ...s,
        name: s.title ?? s.name ?? '',
        date: s.session_date ?? s.date ?? '',
        startTime: s.start_time ?? s.startTime ?? '',
        endTime: s.end_time ?? s.endTime ?? '',
        locationId: s.location_id ?? s.locationId ?? '',
        coachId: s.coach_id ?? s.coachId ?? '',
        sessionTypeId: s.session_type_id ?? s.sessionTypeId ?? '',
        credits: s.credit_cost ?? s.credits ?? '',
        internalNotes: s.notes ?? s.internalNotes ?? '',
      });
      setCoaches(Array.isArray(c) ? c : (c.coaches || []));
      setLocations(Array.isArray(l) ? l : (l.locations || []));
      setSessionTypes(Array.isArray(st) ? st : (st.sessionTypes || []));
    })
      .catch(() => navigate('/admin/sessions'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await apiClient.put(`/admin/sessions/${id}`, {
        title: form.name,
        sessionTypeId: form.sessionTypeId || null,
        locationId: form.locationId || null,
        coachId: form.coachId || null,
        sessionDate: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity: form.capacity || null,
        creditCost: form.credits || null,
        price: form.price || null,
        description: form.description || null,
        notes: form.internalNotes || null,
        status: form.status || null,
      });
      navigate('/admin/sessions');
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSession = async () => {
    if (!window.confirm('Cancel this session? All clients will be notified and eligible credits restored.')) return;
    setCancelling(true);
    try {
      await apiClient.post(`/admin/sessions/${id}/cancel`, {});
      navigate('/admin/sessions');
    } catch (err) {
      setError(err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;
  if (!form) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/admin/sessions" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />
        Back to Sessions
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Edit Session</h1>
        {form.status !== 'cancelled' && (
          <button onClick={handleCancelSession} disabled={cancelling} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-semibold border border-red-500/30 hover:border-red-500/60 px-4 py-2 rounded-xl transition-all">
            <AlertTriangle size={14} />
            {cancelling ? 'Cancelling…' : 'Cancel Session'}
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSave} className="space-y-5">
        <Section title="Session Details">
          <div><Label>Session Name</Label><Input value={form.name || ''} onChange={set('name')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Session Type</Label>
              <Select value={form.sessionTypeId || ''} onChange={set('sessionTypeId')}>
                <option value="">Select type</option>
                {sessionTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status || 'draft'} onChange={set('status')}>
                {['draft','published','fully_booked','cancelled','completed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description || ''} onChange={set('description')} /></div>
        </Section>

        <Section title="Schedule & Location">
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Date</Label><Input type="date" value={form.date || ''} onChange={set('date')} /></div>
            <div><Label>Start Time</Label><Input type="time" value={form.startTime || ''} onChange={set('startTime')} /></div>
            <div><Label>End Time</Label><Input type="time" value={form.endTime || ''} onChange={set('endTime')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Location</Label>
              <Select value={form.locationId || ''} onChange={set('locationId')}>
                <option value="">Select location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
            <div><Label>Coach</Label>
              <Select value={form.coachId || ''} onChange={set('coachId')}>
                <option value="">Select coach</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Eligibility & Capacity">
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Age Group</Label>
              <Select value={form.ageGroup || ''} onChange={set('ageGroup')}>
                <option value="">All</option>
                {['U8','U10','U12','U14','U16','U18','Senior'].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </div>
            <div><Label>Ability Level</Label>
              <Select value={form.abilityLevel || ''} onChange={set('abilityLevel')}>
                <option value="">All</option>
                {['Beginner','Intermediate','Advanced','Elite'].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </div>
            <div><Label>Capacity</Label><Input type="number" min="1" value={form.capacity || ''} onChange={set('capacity')} /></div>
          </div>
        </Section>

        <Section title="Pricing">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Price (EUR)</Label><Input type="number" step="0.01" value={form.price || ''} onChange={set('price')} /></div>
            <div><Label>Credits Required</Label><Input type="number" value={form.credits || ''} onChange={set('credits')} /></div>
          </div>
        </Section>

        <Section title="Internal Notes">
          <Textarea value={form.internalNotes || ''} onChange={set('internalNotes')} />
        </Section>

        <div className="flex gap-3">
          <Link to="/admin/sessions" className="flex-1 border border-white/20 text-slate-300 font-semibold py-3 rounded-xl text-center text-sm hover:bg-white/5 transition-colors">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}