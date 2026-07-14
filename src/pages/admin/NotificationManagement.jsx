import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Loader2, X, Send } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const defaultTemplate = { name: '', eventTrigger: '', subject: '', bodyHtml: '', active: true };
const triggers = ['booking_confirmed', 'booking_cancelled', 'session_reminder', 'payment_received', 'credit_expiry', 'password_reset', 'welcome', 'reschedule_confirmed', 'coach_assigned'];

export default function NotificationManagement() {
  const [tab, setTab] = useState('log');
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

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Notifications</h1>
          <p className="text-muted-foreground text-sm">Log and email templates</p>
        </div>
        {tab === 'templates' && (
          <button onClick={() => { setForm(defaultTemplate); setEditingTemplate('new'); setError(''); }} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors self-start">
            <Plus size={15} />New Template
          </button>
        )}
      </div>

      <div className="flex bg-card rounded-xl p-1 gap-1 border border-border">
        {['log', 'templates'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t === 'log' ? 'Notification Log' : 'Email Templates'}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : tab === 'log' ? (
        <>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="p-16 text-center"><Bell size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No notifications sent yet</p></div>
            ) : notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-4 px-5 py-4 hover:bg-accent transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.status === 'sent' ? 'bg-success' : n.status === 'failed' ? 'bg-destructive' : 'bg-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{n.subject}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">To: {n.recipientEmail} · {new Date(n.sentAt || n.createdAt).toLocaleString('en-MT')}</p>
                  {n.errorMessage && <p className="text-destructive text-xs mt-0.5">{n.errorMessage}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${n.status === 'sent' ? 'bg-success/20 text-success' : n.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'}`}>
                  {n.status}
                </span>
              </div>
            ))}
          </div>
          {total > 25 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 25)}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Previous</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {editingTemplate && (
            <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground">{editingTemplate === 'new' ? 'New Template' : 'Edit Template'}</h2>
                <button onClick={() => setEditingTemplate(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                <div><label className="block text-muted-foreground text-xs mb-1">Template Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></div>
                <div>
                  <label className="block text-muted-foreground text-xs mb-1">Event Trigger</label>
                  <select value={form.eventTrigger} onChange={(e) => setForm({ ...form, eventTrigger: e.target.value })} className={inp}>
                    <option value="">Select trigger…</option>
                    {triggers.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-muted-foreground text-xs mb-1">Subject Line</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inp} placeholder="Use {{variable}} for dynamic values" /></div>
              <div><label className="block text-muted-foreground text-xs mb-1">Body HTML</label><textarea value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} className={inp + ' resize-none font-mono text-xs'} rows={8} placeholder="HTML content — use {{variable}} placeholders" /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
                <span className="text-foreground text-sm">Active</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setEditingTemplate(null)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
                <button onClick={saveTemplate} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                  {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Template'}
                </button>
              </div>
            </div>
          )}
          <div className="bg-card rounded-2xl border border-border divide-y divide-border">
            {templates.length === 0 ? (
              <div className="p-16 text-center"><p className="text-muted-foreground">No templates configured</p></div>
            ) : templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-accent transition-colors">
                <div className="flex-1 min-w-[9rem]">
                  <p className="font-bold text-foreground text-sm truncate">{t.name}</p>
                  <p className="text-muted-foreground text-xs truncate">{t.eventTrigger?.replace(/_/g, ' ')} · {t.subject}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${t.active ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                  {t.active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-2 flex-shrink-0 ml-auto">
                  <button onClick={() => testSend(t.id)} className="w-8 h-8 rounded-lg bg-accent hover:bg-success/20 flex items-center justify-center text-muted-foreground hover:text-success transition-all">
                    <Send size={13} />
                  </button>
                  <button onClick={() => { setForm({ ...t }); setEditingTemplate(t.id); setError(''); }} className="w-8 h-8 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Edit2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
