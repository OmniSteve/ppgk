import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Settings } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { normalizeAppSettings, serializeAppSettings } from '@/services/appSettings';

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
    <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-[#2563EB]" />
        <div>
          <h1 className="text-2xl font-black text-white">Application Settings</h1>
          <p className="text-slate-400 text-sm">Configure business rules without code changes</p>
        </div>
      </div>

      {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />Settings saved successfully.</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {SETTING_GROUPS.map((group) => (
        <div key={group.label} className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="font-bold text-white">{group.label}</h2>
          {group.settings.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-slate-300 text-sm font-medium mb-0.5">{s.label}</label>
                {s.hint && <p className="text-slate-500 text-xs">{s.hint}</p>}
              </div>
              <div className="flex-shrink-0">
                {s.type === 'boolean' ? (
                  <button
                    role="switch"
                    aria-checked={Boolean(settings[s.key])}
                    onClick={() => set(s.key, !settings[s.key])}
                    className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${Boolean(settings[s.key]) ? 'bg-[#2563EB]' : 'bg-white/20'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${Boolean(settings[s.key]) ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                ) : (
                  <input
                    type={s.type || 'text'}
                    value={settings[s.key] ?? ''}
                    onChange={(e) => set(s.key, e.target.value)}
                    className="w-48 bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors text-right"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
        {saving ? <><Loader2 size={18} className="animate-spin" />Saving…</> : 'Save All Settings'}
      </button>
    </div>
  );
}