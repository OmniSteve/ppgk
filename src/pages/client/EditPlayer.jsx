import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const inputCls = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className={labelCls}>{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
    {children}
    {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
  </div>
);

const Input = (props) => <input className={inputCls} {...props} />;
const Select = ({ children, ...props }) => <select className={inputCls} {...props}>{children}</select>;
const Textarea = (props) => <textarea className={`${inputCls} resize-none`} rows={3} {...props} />;

export default function EditPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get(`/players/${id}`).then(setForm).catch(() => navigate('/players')).finally(() => setLoading(false));
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>;
  if (!form) return null;

  const sectionCls = 'bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/players" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Players
      </Link>

      <h1 className="text-2xl font-black text-white">Edit Player: {form.firstName} {form.lastName}</h1>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500">Personal Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required><Input required value={form.firstName || ''} onChange={set('firstName')} /></Field>
            <Field label="Last name" required><Input required value={form.lastName || ''} onChange={set('lastName')} /></Field>
          </div>
          <Field label="Date of birth"><Input type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age group">
              <Select value={form.ageGroup || ''} onChange={set('ageGroup')}>
                <option value="">Select</option>
                {['U8','U10','U12','U14','U16','U18','Senior'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Experience level">
              <Select value={form.experienceLevel || ''} onChange={set('experienceLevel')}>
                <option value="">Select</option>
                {['Beginner','Intermediate','Advanced','Elite'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Current club"><Input value={form.currentClub || ''} onChange={set('currentClub')} /></Field>
          <Field label="Status">
            <Select value={form.status || 'active'} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500">Health & Safety</h2>
          <Field label="Medical information"><Textarea value={form.medicalInfo || ''} onChange={set('medicalInfo')} /></Field>
          <Field label="Allergies"><Textarea value={form.allergies || ''} onChange={set('allergies')} rows={2} /></Field>
        </div>

        <div className={sectionCls}>
          <h2 className="font-bold text-xs uppercase tracking-wide text-slate-500">Emergency Contact</h2>
          <Field label="Name"><Input value={form.emergencyContactName || ''} onChange={set('emergencyContactName')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone"><Input type="tel" value={form.emergencyContactPhone || ''} onChange={set('emergencyContactPhone')} /></Field>
            <Field label="Relationship"><Input value={form.emergencyContactRelationship || ''} onChange={set('emergencyContactRelationship')} /></Field>
          </div>
        </div>

        <div className="flex gap-3">
          <Link to="/players" className="flex-1 border border-white/20 text-slate-300 font-semibold py-3 rounded-xl text-center text-sm hover:bg-white/5 transition-colors">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}