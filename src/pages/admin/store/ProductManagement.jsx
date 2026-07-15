import React, { useState, useEffect, useRef } from 'react';
import {
  Search, ShoppingBag, Edit2, X, Loader2, CheckCircle, Trash2, Plus,
  Star, Upload, ChevronDown, ImageOff,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { AdminActionButton } from '@/components/admin/AdminActionButton';

const STATUS_BADGE = {
  active: 'bg-success/20 text-success',
  draft: 'bg-accent text-muted-foreground',
  archived: 'bg-destructive/20 text-destructive',
};

const inp = 'w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const label = 'block text-muted-foreground text-xs mb-1';

const defaultForm = {
  name: '', categoryId: '', brand: '', shortDescription: '', fullDescription: '',
  basePrice: '', salePrice: '', sku: '', status: 'draft', featured: false,
  trackStock: true, stockQty: 0,
};

function ProductEditor({ productId, categories, onClose, onSaved }) {
  const isNew = productId === 'new';
  const [form, setForm] = useState(defaultForm);
  const [detail, setDetail] = useState(null); // full detail incl. variants/images, only for existing products
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState(isNew ? null : productId);
  const [justCreatedSku, setJustCreatedSku] = useState(null);

  const loadDetail = (id) => {
    setLoading(true);
    apiClient.get(`/admin/store/products/${id}`)
      .then((d) => {
        setDetail(d);
        setForm({
          name: d.name, categoryId: d.categoryId || '', brand: d.brand || '',
          shortDescription: d.shortDescription || '', fullDescription: d.fullDescription || '',
          basePrice: d.basePrice, salePrice: d.salePrice ?? '', sku: d.sku || '',
          status: d.status, featured: !!d.featured, trackStock: !!d.trackStock, stockQty: d.stockQty ?? 0,
        });
      })
      .catch((e) => setError(e.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (!isNew) loadDetail(productId); }, [productId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const buildPayload = () => ({
    name: form.name, categoryId: form.categoryId || null, brand: form.brand || null,
    shortDescription: form.shortDescription || null, fullDescription: form.fullDescription || null,
    basePrice: form.basePrice === '' ? null : Number(form.basePrice),
    salePrice: form.salePrice === '' ? null : Number(form.salePrice),
    sku: form.sku || null, status: form.status, featured: form.featured,
    trackStock: form.trackStock, stockQty: form.stockQty === '' ? 0 : Number(form.stockQty),
  });

  const handleSave = async () => {
    if (!form.name || form.basePrice === '') { setError('Name and base price are required'); return; }
    setSaving(true); setError('');
    try {
      if (currentId) {
        await apiClient.patch(`/admin/store/products/${currentId}`, buildPayload());
        onSaved();
      } else {
        const res = await apiClient.post('/admin/store/products', buildPayload());
        setCurrentId(res.id);
        setJustCreatedSku(res.sku);
        onSaved();
        loadDetail(res.id); // stay open so variants/images can be added
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="font-bold text-foreground text-lg">{currentId ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}
            {justCreatedSku && (
              <p className="text-success text-xs bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                Product created with SKU <span className="font-mono">{justCreatedSku}</span>
              </p>
            )}

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div><label className={label}>Name</label><input className={inp} value={form.name} onChange={set('name')} /></div>
              <div>
                <label className={label}>Category</label>
                <div className="relative">
                  <select className={inp + ' appearance-none pr-8'} value={form.categoryId} onChange={set('categoryId')}>
                    <option value="">— None —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div><label className={label}>Brand</label><input className={inp} value={form.brand} onChange={set('brand')} /></div>
              <div>
                <label className={label}>SKU</label>
                <input className={inp} value={form.sku} onChange={set('sku')} placeholder="Auto-generated if left blank" />
                {!currentId && <p className="text-muted-foreground text-[11px] mt-1">Optional. A unique SKU will be generated automatically if left blank.</p>}
              </div>
            </div>

            <div><label className={label}>Short Description</label><input className={inp} value={form.shortDescription} onChange={set('shortDescription')} /></div>
            <div><label className={label}>Full Description</label><textarea className={inp} rows={4} value={form.fullDescription} onChange={set('fullDescription')} /></div>

            <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
              <div><label className={label}>Base Price (€)</label><input type="number" step="0.01" className={inp} value={form.basePrice} onChange={set('basePrice')} /></div>
              <div><label className={label}>Sale Price (€, optional)</label><input type="number" step="0.01" className={inp} value={form.salePrice} onChange={set('salePrice')} /></div>
              <div>
                <label className={label}>Status</label>
                <div className="relative">
                  <select className={inp + ' appearance-none pr-8'} value={form.status} onChange={set('status')}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={set('featured')} className="accent-primary" />
                <span className="text-foreground text-sm">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.trackStock} onChange={set('trackStock')} className="accent-primary" />
                <span className="text-foreground text-sm">Track stock at product level</span>
              </label>
              {form.trackStock && (!detail?.variants?.length) && (
                <div className="flex items-center gap-2">
                  <label className="text-foreground text-sm">Stock qty:</label>
                  <input type="number" className={inp + ' w-24'} value={form.stockQty} onChange={set('stockQty')} />
                </div>
              )}
            </div>
            {detail?.variants?.length > 0 && (
              <p className="text-xs text-muted-foreground">This product has variants — stock is tracked per variant below, not at the product level.</p>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={onClose} className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-accent transition-colors">Close</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : (currentId ? 'Save Changes' : 'Create Product')}
              </button>
            </div>

            {currentId && (
              <>
                <VariantsEditor productId={currentId} variants={detail?.variants || []} onChange={() => loadDetail(currentId)} />
                <ImagesEditor productId={currentId} images={detail?.images || []} onChange={() => loadDetail(currentId)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyVariantForm = { name: '', size: '', colour: '', sku: '', stockQty: 0 };

function VariantsEditor({ productId, variants, onChange }) {
  const [form, setForm] = useState(emptyVariantForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justCreated, setJustCreated] = useState(null); // { name, sku } — brief confirmation banner

  const reset = () => { setForm(emptyVariantForm); setEditingId(null); };
  const startEdit = (v) => { setForm({ name: v.name, size: v.size || '', colour: v.colour || '', sku: v.sku || '', stockQty: v.stockQty ?? 0 }); setEditingId(v.id); setJustCreated(null); };

  const handleSave = async () => {
    if (!form.name) { setError('Variant name is required'); return; }
    setSaving(true); setError(''); setJustCreated(null);
    // Explicit payload (rather than spreading `form` directly) so it's clear
    // exactly which fields — including sku — are sent to the backend.
    const payload = { name: form.name, size: form.size || undefined, colour: form.colour || undefined, sku: form.sku || undefined, stockQty: Number(form.stockQty) || 0 };
    try {
      if (editingId) {
        await apiClient.patch(`/admin/store/products/${productId}/variants/${editingId}`, payload);
      } else {
        const created = await apiClient.post(`/admin/store/products/${productId}/variants`, payload);
        setJustCreated({ name: created.name, sku: created.sku });
      }
      reset();
      onChange(); // reloads product (and thus inventory-relevant) data — no page refresh needed
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (variantId) => {
    try {
      await apiClient.delete(`/admin/store/products/${productId}/variants/${variantId}`);
      onChange();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="font-bold text-foreground text-sm">Variants (size / colour)</h3>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {justCreated && (
        <p className="text-success text-xs bg-success/10 border border-success/30 rounded-lg px-3 py-2">
          Variant "{justCreated.name}" created with SKU <span className="font-mono">{justCreated.sku}</span>
        </p>
      )}
      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
              <div className="flex-1 min-w-[8rem]">
                <span className="text-foreground text-sm font-medium block">{v.name}</span>
                <span className="text-muted-foreground text-xs font-mono">{v.sku || 'No SKU'}</span>
              </div>
              <span className="text-muted-foreground text-xs">Stock: {v.stockQty}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.active ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>{v.active ? 'Active' : 'Inactive'}</span>
              <AdminActionButton icon={Edit2} label="Edit variant" onClick={() => startEdit(v)} className="w-8 h-8" />
              <AdminActionButton icon={Trash2} label="Delete variant" variant="destructive" onClick={() => handleDelete(v.id)} className="w-8 h-8" />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 xs:grid-cols-5 gap-2 items-end">
        <input placeholder="Name (e.g. Size 8 / Black)" className={inp + ' col-span-2'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Size" className={inp} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
        <input placeholder="Colour" className={inp} value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
        <input type="number" placeholder="Stock" className={inp} value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
      </div>
      <div>
        <input placeholder="SKU (optional — auto-generated if left blank)" className={inp} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        <p className="text-muted-foreground text-[11px] mt-1">Optional. A unique SKU will be generated automatically if left blank.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{editingId ? 'Update Variant' : 'Add Variant'}
        </button>
        {editingId && <button onClick={reset} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Cancel</button>}
      </div>
    </div>
  );
}

function ImagesEditor({ productId, images, onChange }) {
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.upload(`/admin/store/products/${productId}/images`, formData);
      onChange();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const setPrimary = async (imageId) => {
    try { await apiClient.patch(`/admin/store/products/${productId}/images/${imageId}`, { isPrimary: true }); onChange(); }
    catch (err) { setError(err.message || 'Failed to set primary'); }
  };

  const remove = async (imageId) => {
    try { await apiClient.delete(`/admin/store/products/${productId}/images/${imageId}`); onChange(); }
    catch (err) { setError(err.message || 'Delete failed'); }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="font-bold text-foreground text-sm">Images</h3>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="grid grid-cols-3 xs:grid-cols-4 gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative group">
            <img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl border border-border" />
            {img.isPrimary && <span className="absolute top-1 left-1 bg-primary text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Star size={9} />Primary</span>}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1.5">
              {!img.isPrimary && (
                <button onClick={() => setPrimary(img.id)} title="Set as primary" className="w-7 h-7 rounded-lg bg-card flex items-center justify-center text-foreground"><Star size={12} /></button>
              )}
              <button onClick={() => remove(img.id)} title="Delete image" className="w-7 h-7 rounded-lg bg-destructive flex items-center justify-center text-destructive-foreground"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 cursor-pointer transition-colors">
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          <span className="text-[10px]">Upload</span>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <p className="text-muted-foreground text-xs">JPEG, PNG or WEBP, up to 5MB. The first image uploaded becomes primary automatically.</p>
    </div>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState(null); // 'new' | id | null
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ search, status: statusFilter, page, limit: 20 }).toString();
    apiClient.get(`/admin/store/products?${q}`)
      .then((d) => { setProducts(d.products || []); setTotal(d.total || 0); })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter, page]);
  useEffect(() => { apiClient.get('/admin/store/categories').then((d) => setCategories(d.categories || [])).catch(() => {}); }, []);

  const handleSaved = () => { setSuccess('Product saved.'); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm">{total} products</p>
        </div>
        <button onClick={() => setEditingId('new')} className="bg-primary hover:bg-primary-hover text-foreground font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
          <Plus size={15} />New Product
        </button>
      </div>

      {success && <div className="bg-success/20 border border-success/30 rounded-xl p-3 flex items-center gap-2 text-success text-sm"><CheckCircle size={15} />{success}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, SKU or brand…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="relative flex-shrink-0">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="bg-card border border-border rounded-xl pl-4 pr-9 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:border-primary transition-colors">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {products.length === 0 ? (
            <div className="p-16 text-center"><ShoppingBag size={36} className="text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No products found</p></div>
          ) : products.map((p) => (
            <div key={p.id} className="px-5 py-4 hover:bg-accent transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0"><ImageOff size={16} className="text-primary" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-bold text-foreground text-sm break-words">{p.name}</p>
                      <span className={`sm:hidden text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                      {p.featured ? <Star size={12} className="text-warning flex-shrink-0" /> : null}
                    </div>
                    <p className="hidden sm:block text-muted-foreground text-xs mt-0.5 truncate">{p.categoryName || 'Uncategorised'} · {p.brand || 'No brand'}</p>
                  </div>
                </div>

                <div className="hidden sm:flex sm:flex-col sm:items-end text-right flex-shrink-0">
                  <p className="text-foreground text-sm font-bold">{p.salePrice != null ? <>€{Number(p.salePrice).toFixed(2)} <span className="line-through text-muted-foreground text-xs">€{Number(p.basePrice).toFixed(2)}</span></> : `€${Number(p.basePrice).toFixed(2)}`}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </div>

                <div className="sm:hidden grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Category</span><span className="text-foreground">{p.categoryName || 'Uncategorised'}</span>
                  <span className="text-muted-foreground">Price</span><span className="text-foreground">{p.salePrice != null ? `€${Number(p.salePrice).toFixed(2)} (was €${Number(p.basePrice).toFixed(2)})` : `€${Number(p.basePrice).toFixed(2)}`}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 sm:flex sm:items-center sm:gap-2 sm:pt-0 sm:border-t-0 sm:flex-shrink-0">
                  <AdminActionButton icon={Edit2} label="Edit product" onClick={() => setEditingId(p.id)} className="w-full h-11 sm:w-9 sm:h-9" />
                  <AdminActionButton icon={Trash2} label="Permanently delete product" variant="destructive" onClick={() => setDeleteTarget(p)} className="w-full h-11 sm:w-9 sm:h-9" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {editingId && (
        <ProductEditor productId={editingId} categories={categories} onClose={() => setEditingId(null)} onSaved={handleSaved} />
      )}

      {deleteTarget && (
        <DeleteProductModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); setSuccess('Product deleted.'); load(); }}
          onArchived={() => { setDeleteTarget(null); setSuccess('Product archived.'); load(); }}
        />
      )}
    </div>
  );
}

function DeleteProductModal({ product, onClose, onDeleted, onArchived }) {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    apiClient.get(`/admin/store/products/${product.id}/deletion-eligibility`)
      .then(setEligibility)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [product.id]);

  const handleDelete = async () => {
    setSubmitting(true); setError('');
    try {
      await apiClient.delete(`/admin/store/products/${product.id}`, { confirm: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true); setError('');
    try {
      await apiClient.patch(`/admin/store/products/${product.id}`, { status: 'archived' });
      onArchived();
    } catch (err) {
      setError(err.message || 'Archive failed');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-sidebar border border-border rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-destructive">Permanently Delete "{product.name}"</h2>
        <p className="text-muted-foreground text-sm">This cannot be undone. Products with any order history cannot be deleted — archive them instead.</p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" />Checking eligibility…</div>
        ) : eligibility && !eligibility.eligible ? (
          <div className="bg-warning/20 border border-warning/30 rounded-xl p-3 text-sm text-foreground space-y-2">
            <p className="font-semibold">Cannot delete:</p>
            <ul className="list-disc list-inside text-muted-foreground">{eligibility.blockingReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <p className="text-muted-foreground">This product has been used in one or more orders and cannot be permanently deleted. It can be archived and removed from the shop while keeping order history intact.</p>
          </div>
        ) : eligibility?.eligible ? (
          <div>
            <label className="block text-muted-foreground text-xs mb-1">Type DELETE to confirm</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inp} placeholder="DELETE" autoComplete="off" />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground">Close</button>
          {eligibility && !eligibility.eligible && (
            <button onClick={handleArchive} disabled={archiving} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold disabled:opacity-50">
              {archiving ? 'Archiving…' : 'Archive Product Instead'}
            </button>
          )}
          {eligibility?.eligible && (
            <button onClick={handleDelete} disabled={submitting || confirmText !== 'DELETE'} className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold disabled:opacity-50">
              {submitting ? 'Deleting…' : 'Permanently Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
