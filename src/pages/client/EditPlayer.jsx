import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const inputCls = 'w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-sm font-medium text-foreground mb-1.5';

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className={labelCls}>{label}{required && <span className="text-destructive ml-1">*</span>}</label>
    {children}
    {hint && <p className="text-muted-foreground text-xs mt-1">{hint}</p>}
  </div>
);

const Input = (props) => <input className={inputCls} {...props} />;
const Select = ({ children, ...props }) => <select className={inputCls} {...props}>{children}</select>;
const Textarea = (props) => <textarea className={`${inputCls} resize-none`} rows={3} {...props} />;

// Default form fields — the API contract guarantees camelCase keys
function normalisePlayer(p) {
  if (!p) return null;
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    dateOfBirth: p.dateOfBirth ?? '',
    ageGroup: p.ageGroup ?? '',
    experienceLevel: p.experienceLevel ?? '',
    currentClub: p.currentClub ?? '',
    medicalInfo: p.medicalInfo ?? '',
    allergies: p.allergies ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    emergencyContactRelationship: p.emergencyContactRelationship ?? '',
    status: p.status ?? 'active',
  };
}

export default function EditPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get(`/players/${id}`)
      .then((data) => setForm(normalisePlayer(data)))
      .catch(() => navigate('/players'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await apiClient.put(`/players/${id}`, form);
      navigate('/players');
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  if (!form) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground">Player not found</p>
      <Link to="/players" className="text-primary text-sm hover:underline mt-2 block">← Back to players</Link>
    </div>
  );

  const sectionCls = 'bg-card rounded-2xl border border-border p-6 space-y-4';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/players" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Players
      </Link>

      <h1 className="text-2xl font-black text-foreground">Edit Player: {form.firstName} {form.lastName}</h1>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Personal Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required><Input required value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name" required><Input required value={form.lastName} onChange={set('lastName')} /></Field>
          </div>
          <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age group">
              <Select value={form.ageGroup} onChange={set('ageGroup')}>
                <option value="">Select</option>
                {['U8','U10','U12','U14','U16','U18','Senior'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Experience level">
              <Select value={form.experienceLevel} onChange={set('experienceLevel')}>
                <option value="">Select</option>
                {['Beginner','Intermediate','Advanced','Elite'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Current club"><Input value={form.currentClub} onChange={set('currentClub')} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Health & Safety</h2>
          <Field label="Medical information"><Textarea value={form.medicalInfo} onChange={set('medicalInfo')} /></Field>
          <Field label="Allergies"><Textarea value={form.allergies} onChange={set('allergies')} rows={2} /></Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Emergency Contact</h2>
          <Field label="Name"><Input value={form.emergencyContactName} onChange={set('emergencyContactName')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone"><Input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></Field>
            <Field label="Relationship"><Input value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} /></Field>
          </div>
        </div>

        <div className="flex gap-3">
          <Link to="/players" className="flex-1 border border-border text-foreground font-semibold py-3 rounded-xl text-center text-sm hover:bg-accent transition-colors">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
