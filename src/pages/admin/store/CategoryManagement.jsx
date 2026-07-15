import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2, X, CheckCircle, Trash2, Layers } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { AdminActionButton } from '@/components/admin/AdminActionButton';

const defaultForm = { name: '', description: '', sortOrder: 0, active: true };

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | id | null
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient.get('/admin/store/categories')
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(defaultForm); setEditing('new'); setError(''); setSuccess(''); };
  const openEdit = (c) => { setForm({ name: c.name, description: c.description || '', sortOrder: c.sortOrder ?? 0, active: c.active !== false }); setEditing(c.id); setError(''); setSuccess(''); };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      if (editing === 'new') {
        await apiClient.post('/admin/store/categories', form);
        setSuccess('Category created.');
      } else {
        await apiClient.patch(`/admin/store/categories/${editing}`, form);
        setSuccess('Category updated.');
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (c) => { setDeleteTarget(c); setDeleteError(''); };

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    try {
      await apiClient.delete(`/admin/store/categories/${deleteTarget.id}`);
      setDeleteTarget(null);
      setSuccess('Category deleted.');
      load();
    } catch (err) {
      setDeleteError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Store Categories</h1>
          <p className="text-muted-foreground text-sm">{categories.length} categories</p>
        </div>
        <button onClick={openNew} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
          <Plus size={15} />New Category
        </button>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      {editing && (
        <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">{editing === 'new' ? 'New Category' : 'Edit Category'}</h2>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div><label className="block text-muted-foreground text-xs mb-1">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp + ' resize-none'} rows={2} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Sort Order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className={inp} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="text-foreground text-sm">Active (visible in the shop filter bar)</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Category'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {categories.length === 0 ? (
            <div className="p-16 text-center"><Layers size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No categories yet</p></div>
          ) : categories.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{c.name}</p>
                <p className="text-muted-foreground text-xs truncate">{c.description || 'No description'}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${c.active ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                {c.active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <AdminActionButton icon={Edit2} label="Edit category" onClick={() => openEdit(c)} className="w-9 h-9" />
                <AdminActionButton icon={Trash2} label="Delete category" variant="destructive" onClick={() => openDelete(c)} className="w-9 h-9" />
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm bg-sidebar border border-border rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-foreground">Delete "{deleteTarget.name}"?</h2>
            <p className="text-muted-foreground text-sm">This only works if no products use this category — you'll be told if it's blocked.</p>
            {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
