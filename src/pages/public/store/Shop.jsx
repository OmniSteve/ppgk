import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag, ChevronDown, ImageOff } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import StoreHeader from './StoreHeader';

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('featured');
  const [total, setTotal] = useState(0);

  useEffect(() => { apiClient.get('/store/categories').then((d) => setCategories(d.categories || [])).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({
      ...(search ? { search } : {}), ...(category ? { category } : {}),
      ...(inStockOnly ? { inStock: 'true' } : {}), sort, limit: '24',
    }).toString();
    apiClient.get(`/store/products?${q}`)
      .then((d) => { setProducts(d.products || []); setTotal(d.total || 0); })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, category, inStockOnly, sort]);

  return (
    <div className="min-h-screen">
      <StoreHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-foreground">Shop Goalkeeping Gear</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} products · Gloves, clothing, accessories &amp; equipment from Premier Performance GK</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-card border border-border rounded-xl pl-4 pr-9 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:border-primary transition-colors">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-card border border-border rounded-xl pl-4 pr-9 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:border-primary transition-colors">
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-primary" />
            In stock only
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center bg-card rounded-2xl border border-border">
            <ShoppingBag size={36} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No products match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <Link key={p.id} to={`/shop/product/${p.slug}`} className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/50 transition-colors group">
                <div className="aspect-square bg-accent flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <ImageOff size={28} className="text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  {p.featured && <span className="text-[10px] font-bold text-warning uppercase tracking-wide">Featured</span>}
                  <p className="text-foreground font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-muted-foreground text-xs truncate">{p.categoryName || ''}</p>
                  <div className="flex items-center gap-2">
                    {p.salePrice != null ? (
                      <>
                        <span className="text-primary font-bold text-sm">€{Number(p.salePrice).toFixed(2)}</span>
                        <span className="text-muted-foreground text-xs line-through">€{Number(p.basePrice).toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="text-foreground font-bold text-sm">€{Number(p.basePrice).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
