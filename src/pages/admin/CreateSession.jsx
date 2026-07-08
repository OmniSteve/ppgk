import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const Input = (props) => <input className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors" {...props} />;
const Select = ({ children, ...props }) => <select className="w-full bg-[#0D1B2A] border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2563EB] transition-colors" {...props}>{children}</select>;
const Textarea = (props) => <textarea className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors resize-none" rows={3} {...props} />;
const Label = ({ children, required }) => <label className="block text-slate-300 text-sm font-medium mb-1.5">{children}{required && <span className="text-red-400 ml-1">*</span>}</label>;
const Section = ({ title, children }) => (
  <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
    <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{title}</h2>
    {children}
  </div>
);

export default function CreateSession() {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', sessionTypeId: '', description: '', coachId: '', date: '', startTime: '', endTime: '',
    locationId: '', ageGroup: '', abilityLevel: '', capacity: '', price: '', credits: '',
    bookingOpenDate: '', bookingCloseDate: '', cancellationDeadlineHours: '24',
    rescheduleDeadlineHours: '24', status: 'draft', internalNotes: '',
  });

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/coaches'),
      apiClient.get('/admin/locations'),
      apiClient.get('/admin/session-types'),
    ]).then(([c, l, st]) => {
      setCoaches(Array.isArray(c) ? c : (c.coaches || []));
      setLocations(Array.isArray(l) ? l : (l.locations || []));
      setSessionTypes(Array.isArray(st) ? st : (st.sessionTypes || st.session_types || []));
    }).catch(() => {});
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await apiClient.post('/admin/sessions', {
        title: form.name,
        sessionTypeId: form.sessionTypeId || null,
        locationId: form.locationId || null,
        coachId: form.coachId || null,
        sessionDate: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity: form.capacity || 10,
        creditCost: form.credits || 1,
        price: form.price || null,
        description: form.description || null,
        notes: form.internalNotes || null,
        ageGroup: form.ageGroup || null,
        abilityLevel: form.abilityLevel || null,
        status: form.status || 'draft',
      });
      navigate('/admin/sessions');
    } catch (err) {
      setError(err.message || 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/admin/sessions" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />
        Back to Sessions
      </Link>
      <h1 className="text-2xl font-black text-white">Create Session</h1>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Session Details">
          <div><Label required>Session Name</Label><Input required value={form.name} onChange={set('name')} placeholder="e.g. Saturday Morning GK Session" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Session Type</Label>
              <Select value={form.sessionTypeId} onChange={set('sessionTypeId')}>
                <option value="">Select type</option>
                {sessionTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onChange={set('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={set('description')} placeholder="Session description…" /></div>
        </Section>

        <Section title="Schedule & Location">
          <div className="grid grid-cols-3 gap-4">
            <div><Label required>Date</Label><Input type="date" required value={form.date} onChange={set('date')} /></div>
            <div><Label required>Start Time</Label><Input type="time" required value={form.startTime} onChange={set('startTime')} /></div>
            <div><Label required>End Time</Label><Input type="time" required value={form.endTime} onChange={set('endTime')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Location</Label>
              <Select value={form.locationId} onChange={set('locationId')}>
                <option value="">Select location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
            <div><Label>Coach</Label>
              <Select value={form.coachId} onChange={set('coachId')}>
                <option value="">Select coach</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Eligibility & Capacity">
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Age Group</Label>
              <Select value={form.ageGroup} onChange={set('ageGroup')}>
                <option value="">All ages</option>
                {['U8','U10','U12','U14','U16','U18','Senior'].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </div>
            <div><Label>Ability Level</Label>
              <Select value={form.abilityLevel} onChange={set('abilityLevel')}>
                <option value="">All levels</option>
                {['Beginner','Intermediate','Advanced','Elite'].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </div>
            <div><Label required>Max Capacity</Label><Input type="number" required min="1" value={form.capacity} onChange={set('capacity')} placeholder="e.g. 10" /></div>
          </div>
        </Section>

        <Section title="Pricing">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Price (EUR)</Label><Input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} placeholder="0.00" /></div>
            <div><Label>Credits Required</Label><Input type="number" min="0" value={form.credits} onChange={set('credits')} placeholder="e.g. 1" /></div>
          </div>
        </Section>

        <Section title="Booking Rules">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Booking Opens</Label><Input type="datetime-local" value={form.bookingOpenDate} onChange={set('bookingOpenDate')} /></div>
            <div><Label>Booking Closes</Label><Input type="datetime-local" value={form.bookingCloseDate} onChange={set('bookingCloseDate')} /></div>
            <div><Label>Cancellation Deadline (hours)</Label><Input type="number" value={form.cancellationDeadlineHours} onChange={set('cancellationDeadlineHours')} /></div>
            <div><Label>Reschedule Deadline (hours)</Label><Input type="number" value={form.rescheduleDeadlineHours} onChange={set('rescheduleDeadlineHours')} /></div>
          </div>
        </Section>

        <Section title="Internal Notes">
          <Textarea value={form.internalNotes} onChange={set('internalNotes')} placeholder="Internal notes (not visible to clients)…" />
        </Section>

        <div className="flex gap-3">
          <Link to="/admin/sessions" className="flex-1 border border-white/20 text-slate-300 font-semibold py-3 rounded-xl text-center text-sm hover:bg-white/5 transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
}