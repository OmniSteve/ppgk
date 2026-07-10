import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Settings } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { normalizeAppSettings, serializeAppSettings } from '@/services/appSettings';
import { useTheme } from '@/contexts/ThemeContext';

const SETTING_GROUPS = [
  {
    label: 'Booking Rules',
    settings: [
      { key: 'advance_booking_weeks',       label: 'Advance Booking Window (weeks)',                type: 'number',  hint: 'Default: 4 weeks' },
      { key: 'package_validity_months',     label: 'Package Validity (months)',                    type: 'number',  hint: 'Default: 3 months from purchase' },
      { key: 'cancellation_deadline_hours', label: 'Cancellation Deadline (hours before session)', type: 'number' },
      { key: 'reschedule_deadline_hours',   label: 'Reschedule Deadline (hours before session)',   type: 'number' },
      { key: 'credit_refund_on_cancellation', label: 'Refund Credits on Eligible Cancellation',   type: 'boolean' },
    ],
  },
  {
    label: 'Business Settings',
    settings: [
      { key: 'currency',                 label: 'Currency',                  type: 'text', hint: 'e.g. EUR' },
      { key: 'default_timezone',         label: 'Default Timezone',          type: 'text', hint: 'e.g. Europe/Malta' },
      { key: 'default_session_capacity', label: 'Default Session Capacity',  type: 'number' },
      { key: 'company_name',             label: 'Company Name',              type: 'text' },
      { key: 'contact_email',            label: 'Contact Email',             type: 'email' },
      { key: 'contact_phone',            label: 'Contact Phone',             type: 'text' },
    ],
  },
  {
    label: 'Notifications',
    settings: [
      { key: 'session_reminder_hours',         label: 'Session Reminder (hours before)',      type: 'number', hint: 'e.g. 24' },
      { key: 'credit_expiry_reminder_days',    label: 'Credit Expiry Reminder (days before)', type: 'number', hint: 'e.g. 14' },
      { key: 'send_booking_confirmation',      label: 'Send Booking Confirmation Emails',     type: 'boolean' },
      { key: 'send_session_reminders',         label: 'Send Session Reminders',               type: 'boolean' },
      { key: 'send_credit_expiry_reminders',   label: 'Send Credit Expiry Reminders',         type: 'boolean' },
      { key: 'send_cancellation_emails',       label: 'Send Cancellation Emails',             type: 'boolean' },
    ],
  },
];

// key → 'number' | 'boolean' | 'text' | ... derived from the groups above,
// used to type-coerce values on load and save.
const SETTING_TYPES = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.settings.map((s) => [s.key, s.type]))
);

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/admin/settings')
      .then((response) => setSettings(normalizeAppSettings(response, SETTING_TYPES)))
      .catch((err) => setError(err.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      await apiClient.put('/admin/settings', serializeAppSettings(settings, SETTING_TYPES));
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary" />
        <div>
          <h1 className="text-2xl font-black text-foreground">Application Settings</h1>
          <p className="text-muted-foreground text-sm">Configure business rules without code changes</p>
        </div>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-success text-sm"><CheckCircle size={16} />Settings saved successfully.</div>}
      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-bold text-foreground">Appearance</h2>
        <div className="space-y-2">
          {[
            { id: 'classic',   label: 'Classic dark',    desc: 'Navy background with blue accent — the original PPGK look.' },
            { id: 'floodlit',  label: 'Floodlit green',  desc: 'Dark pitch green with amber accent and display typography.' },
            { id: 'midnight',  label: 'Midnight (black)', desc: 'Neutral black with amber accents.' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                theme === opt.id ? 'border-primary bg-primary/10' : 'border-border hover:border-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                theme === opt.id ? 'border-primary bg-primary' : 'border-border'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${theme === opt.id ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {SETTING_GROUPS.map((group) => (
        <div key={group.label} className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground">{group.label}</h2>
          {group.settings.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-foreground text-sm font-medium mb-0.5">{s.label}</label>
                {s.hint && <p className="text-muted-foreground text-xs">{s.hint}</p>}
              </div>
              <div className="flex-shrink-0">
                {s.type === 'boolean' ? (
                  <button
                    role="switch"
                    aria-checked={Boolean(settings[s.key])}
                    onClick={() => set(s.key, !settings[s.key])}
                    className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${Boolean(settings[s.key]) ? 'bg-primary' : 'bg-accent'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${Boolean(settings[s.key]) ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                ) : (
                  <input
                    type={s.type || 'text'}
                    value={settings[s.key] ?? ''}
                    onChange={(e) => set(s.key, e.target.value)}
                    className="w-48 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-right"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
        {saving ? <><Loader2 size={18} className="animate-spin" />Saving…</> : 'Save All Settings'}
      </button>
    </div>
  );
}
