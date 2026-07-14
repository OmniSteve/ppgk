import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

const Input = ({ className = '', ...props }) => (
  <input className={`${inputCls} ${className}`} {...props} />
);

const Select = ({ children, className = '', ...props }) => (
  <select className={`${inputCls} ${className}`} {...props}>{children}</select>
);

const Textarea = ({ className = '', ...props }) => (
  <textarea className={`${inputCls} resize-none ${className}`} rows={3} {...props} />
);

export default function CreatePlayer() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', ageGroup: '', experienceLevel: '',
    currentClub: '', medicalInfo: '', allergies: '', emergencyContactName: '',
    emergencyContactPhone: '', emergencyContactRelationship: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await apiClient.post('/players', form);
      navigate('/players');
    } catch (err) {
      setError(err.message || 'Failed to create player.');
    } finally {
      setLoading(false);
    }
  };

  const sectionCls = 'bg-card rounded-2xl border border-border p-6 space-y-4';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/players" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Players
      </Link>

      <h1 className="text-2xl font-black text-foreground">Add Player Profile</h1>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Personal Details</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <Field label="First name" required><Input required value={form.firstName} onChange={set('firstName')} placeholder="First name" /></Field>
            <Field label="Last name" required><Input required value={form.lastName} onChange={set('lastName')} placeholder="Last name" /></Field>
          </div>
          <Field label="Date of birth" required><Input type="date" required value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <Field label="Age group" required>
              <Select required value={form.ageGroup} onChange={set('ageGroup')}>
                <option value="">Select age group</option>
                {['U8','U10','U12','U14','U16','U18','Senior'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Experience level" required>
              <Select required value={form.experienceLevel} onChange={set('experienceLevel')}>
                <option value="">Select level</option>
                {['Beginner','Intermediate','Advanced','Elite'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Current club" hint="Optional — leave blank if not currently at a club">
            <Input value={form.currentClub} onChange={set('currentClub')} placeholder="Club name (optional)" />
          </Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Health & Safety</h2>
          <Field label="Medical information" hint="Any medical conditions relevant to training">
            <Textarea value={form.medicalInfo} onChange={set('medicalInfo')} placeholder="e.g. asthma, previous injuries..." />
          </Field>
          <Field label="Allergies" hint="Any known allergies">
            <Textarea value={form.allergies} onChange={set('allergies')} placeholder="e.g. peanuts, bee stings..." rows={2} />
          </Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Emergency Contact</h2>
          <Field label="Contact name"><Input value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Full name" /></Field>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
            <Field label="Phone"><Input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="+356 …" /></Field>
            <Field label="Relationship"><Input value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} placeholder="e.g. Parent" /></Field>
          </div>
        </div>

        <div className="flex gap-3">
          <Link to="/players" className="flex-1 border border-border text-foreground font-semibold py-3 rounded-xl text-center text-sm hover:bg-accent transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Create Player'}
          </button>
        </div>
      </form>
    </div>
  );
}
