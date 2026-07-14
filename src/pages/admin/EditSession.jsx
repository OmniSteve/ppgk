import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const Input = (props) => <input className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" {...props} />;
const Select = ({ children, ...props }) => <select className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" {...props}>{children}</select>;
const Textarea = (props) => <textarea className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors resize-none" rows={3} {...props} />;
const Label = ({ children }) => <label className="block text-foreground text-sm font-medium mb-1.5">{children}</label>;
const Section = ({ title, children }) => (
  <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
    <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</h2>
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
        name: s.title ?? '',
        date: s.sessionDate ?? '',
        startTime: s.startTime ?? '',
        endTime: s.endTime ?? '',
        locationId: s.locationId ?? '',
        coachId: s.coachId ?? '',
        sessionTypeId: s.sessionTypeId ?? '',
        credits: s.creditCost ?? '',
        price: s.price ?? '',
        capacity: s.capacity ?? '',
        description: s.description ?? '',
        ageGroup: s.ageGroup ?? '',
        abilityLevel: s.abilityLevel ?? '',
        status: s.status ?? 'draft',
        internalNotes: s.notes ?? '',
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
        sessionDate: form.date || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        creditCost: form.credits ? Number(form.credits) : null,
        price: form.price ? Number(form.price) : null,
        description: form.description || null,
        notes: form.internalNotes || null,
        status: form.status || 'draft',
        ageGroup: form.ageGroup || null,
        abilityLevel: form.abilityLevel || null,
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
      await apiClient.patch(`/admin/sessions/${id}`, { status: 'cancelled' });
      navigate('/admin/sessions');
    } catch (err) {
      setError(err.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  if (!form) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/admin/sessions" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />
        Back to Sessions
      </Link>
      <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
        <h1 className="text-2xl font-black text-foreground">Edit Session</h1>
        {form.status !== 'cancelled' && (
          <button onClick={handleCancelSession} disabled={cancelling} className="flex items-center justify-center gap-2 text-destructive hover:text-destructive/80 text-sm font-semibold border border-destructive/30 hover:border-destructive/60 px-4 py-2 rounded-xl transition-all">
            <AlertTriangle size={14} />
            {cancelling ? 'Cancelling…' : 'Cancel Session'}
          </button>
        )}
      </div>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSave} className="space-y-5">
        <Section title="Session Details">
          <div><Label>Session Name</Label><Input value={form.name || ''} onChange={set('name')} /></div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4">
            <div><Label>Date</Label><Input type="date" value={form.date || ''} onChange={set('date')} /></div>
            <div><Label>Start Time</Label><Input type="time" value={form.startTime || ''} onChange={set('startTime')} /></div>
            <div><Label>End Time</Label><Input type="time" value={form.endTime || ''} onChange={set('endTime')} /></div>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <div><Label>Price (EUR)</Label><Input type="number" step="0.01" value={form.price || ''} onChange={set('price')} /></div>
            <div><Label>Credits Required</Label><Input type="number" value={form.credits || ''} onChange={set('credits')} /></div>
          </div>
        </Section>

        <Section title="Internal Notes">
          <Textarea value={form.internalNotes || ''} onChange={set('internalNotes')} />
        </Section>

        <div className="flex gap-3">
          <Link to="/admin/sessions" className="flex-1 border border-border text-foreground font-semibold py-3 rounded-xl text-center text-sm hover:bg-accent transition-colors">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
