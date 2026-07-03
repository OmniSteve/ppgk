import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Loader2, X, Send } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import AdminLayout from '@/components/layouts/AdminLayout';

const defaultTemplate = { name: '', eventTrigger: '', subject: '', bodyHtml: '', active: true };
const triggers = ['booking_confirmed', 'booking_cancelled', 'session_reminder', 'payment_received', 'credit_expiry', 'password_reset', 'welcome', 'reschedule_confirmed', 'coach_assigned'];

export default function NotificationManagement() {
  const [tab, setTab] = useState('log'); // 'log' | 'templates'
  const [notifications, setNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState(defaultTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    if (tab === 'log') {
      apiClient.get(`/admin/notifications?page=${page}&limit=25`)
        .then((d) => { setNotifications(d.notifications || []); setTotal(d.total || 0); })
        .catch(() => setNotifications([]))
        .finally(() => setLoading(false));
    } else {
      apiClient.get('/admin/notification-templates')
        .then((d) => setTemplates(d.templates || []))
        .catch(() => setTemplates([]))
        .finally(() => setLoading(false));
    }
  }, [tab, page]);

  const saveTemplate = async () => {
    setSaving(true); setError('');
    try {
      if (editingTemplate === 'new') await apiClient.post('/admin/notification-templates', form);
      else await apiClient.put(`/admin/notification-templates/${editingTemplate}`, form);
      setEditingTemplate(null);
      apiClient.get('/admin/notification-templates').then((d) => setTemplates(d.templates || []));
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const testSend = async (templateId) => {
    const email = window.prompt('Send test to email address:');
    if (!email) return;
    try {
      await apiClient.post(`/admin/notification-templates/${templateId}/test`, { email });
      alert('Test notification sent.');
    } catch (err) {
      alert(err.message || 'Send failed.');
    }
  };

  const inp = 'w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Notifications</h1>
            <p className="text-slate-400 text-sm">Log and email templates</p>
          </div>
          {tab === 'templates' && (
            <button onClick={() => { setForm(defaultTemplate); setEditingTemplate('new'); setError(''); }} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors">
              <Plus size={15} />New Template
            </button>
          )}
        </div>

        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {['log', 'templates'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white'}`}>{t === 'log' ? 'Notification Log' : 'Email Templates'}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" /></div>
        ) : tab === 'log' ? (
          <>
            <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
              {notifications.length === 0 ? (
                <div className="p-16 text-center"><Bell size={36} className="text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No notifications sent yet</p></div>
              ) : notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.status === 'sent' ? 'bg-green-400' : n.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{n.subject}</p>
                    <p className="text-slate-400 text-xs mt-0.5">To: {n.recipientEmail} · {new Date(n.sentAt || n.createdAt).toLocaleString('en-MT')}</p>
                    {n.errorMessage && <p className="text-red-400 text-xs mt-0.5">{n.errorMessage}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${n.status === 'sent' ? 'bg-green-500/20 text-green-400' : n.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {n.status}
                  </span>
                </div>
              ))}
            </div>
            {total > 25 && (
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">Page {page} of {Math.ceil(total / 25)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 disabled:opacity-40 transition-colors">Previous</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {editingTemplate && (
              <div className="bg-white/5 rounded-2xl border border-[#2563EB]/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white">{editingTemplate === 'new' ? 'New Template' : 'Edit Template'}</h2>
                  <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-slate-400 text-xs mb-1">Template Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Event Trigger</label>
                    <select value={form.eventTrigger} onChange={(e) => setForm({ ...form, eventTrigger: e.target.value })} className={inp}>
                      <option value="">Select trigger…</option>
                      {triggers.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="block text-slate-400 text-xs mb-1">Subject Line</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inp} placeholder="Use {{variable}} for dynamic values" /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Body HTML</label><textarea value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} className={inp + ' resize-none font-mono text-xs'} rows={8} placeholder="HTML content — use {{variable}} placeholders" /></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#2563EB]" />
                  <span className="text-slate-300 text-sm">Active</span>
                </label>
                <div className="flex gap-3">
                  <button onClick={() => setEditingTemplate(null)} className="flex-1 border border-white/20 text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={saveTemplate} disabled={saving} className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                    {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Template'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
              {templates.length === 0 ? (
                <div className="p-16 text-center"><p className="text-slate-400">No templates configured</p></div>
              ) : templates.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-slate-400 text-xs">{t.eventTrigger?.replace(/_/g, ' ')} · {t.subject}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${t.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {t.active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => testSend(t.id)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-green-500/20 flex items-center justify-center text-slate-400 hover:text-green-400 transition-all">
                      <Send size={13} />
                    </button>
                    <button onClick={() => { setForm({ ...t }); setEditingTemplate(t.id); setError(''); }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}