import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, ImageOff, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useCart } from '@/contexts/CartContext';
import StoreHeader from './StoreHeader';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/store/products/${slug}`)
      .then((d) => { setProduct(d); if (d.variants?.length === 1) setVariantId(d.variants[0].id); })
      .catch((e) => setError(e.message || 'Product not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <StoreHeader backTo="/shop" backLabel="Back to shop" />
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <StoreHeader backTo="/shop" backLabel="Back to shop" />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-destructive">{error || 'Product not found'}</p>
          <Link to="/shop" className="text-primary text-sm hover:underline mt-3 inline-block">← Back to shop</Link>
        </div>
      </div>
    );
  }

  const hasVariants = product.variants?.length > 0;
  const selectedVariant = product.variants?.find((v) => v.id === variantId) || null;
  const price = selectedVariant?.priceOverride ?? product.salePrice ?? product.basePrice;
  const originalPrice = selectedVariant?.priceOverride == null && product.salePrice != null ? product.basePrice : null;
  const available = hasVariants ? (selectedVariant ? selectedVariant.available : null) : (product.trackStock ? Infinity : Infinity);
  const canAddToCart = hasVariants ? (selectedVariant && selectedVariant.available > 0) : product.inStock;
  const images = product.images?.length > 0 ? product.images : (product.imageUrl ? [{ url: product.imageUrl, id: 'primary' }] : []);

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    addItem({
      productId: product.id, variantId: selectedVariant?.id ?? null,
      name: product.name, variantName: selectedVariant?.name ?? null,
      price, quantity, imageUrl: images[0]?.url ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <StoreHeader backTo="/shop" backLabel="Back to shop" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center">
            {images.length > 0 ? (
              <img src={images[selectedImage]?.url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <ImageOff size={40} className="text-muted-foreground" />
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setSelectedImage(i)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${i === selectedImage ? 'border-primary' : 'border-border'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            {product.categoryName && <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{product.categoryName}</p>}
            <h1 className="text-2xl font-black text-foreground">{product.name}</h1>
            {product.brand && <p className="text-muted-foreground text-sm mt-0.5">{product.brand}</p>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-primary">€{Number(price).toFixed(2)}</span>
            {originalPrice != null && <span className="text-muted-foreground line-through">€{Number(originalPrice).toFixed(2)}</span>}
          </div>

          {product.shortDescription && <p className="text-foreground text-sm">{product.shortDescription}</p>}

          {hasVariants && (
            <div>
              <label className="block text-foreground text-sm font-semibold mb-2">Select an option</label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    disabled={v.available <= 0}
                    className={`px-3 py-2 rounded-xl border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantId === v.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-muted-foreground/40'}`}
                  >
                    {v.name}{v.available <= 0 ? ' (out of stock)' : ''}
                  </button>
                ))}
              </div>
              {!variantId && <p className="text-muted-foreground text-xs mt-2">Choose an option to see availability</p>}
            </div>
          )}

          {(!hasVariants || selectedVariant) && !canAddToCart && (
            <p className="text-destructive text-sm font-semibold">Out of stock</p>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center border border-border rounded-xl">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-foreground hover:bg-accent transition-colors"><Minus size={14} /></button>
              <span className="w-10 text-center text-foreground font-semibold">{quantity}</span>
              <button onClick={() => setQuantity((q) => (Number.isFinite(available) ? Math.min(available, q + 1) : q + 1))} className="w-10 h-10 flex items-center justify-center text-foreground hover:bg-accent transition-colors"><Plus size={14} /></button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart || (hasVariants && !selectedVariant)}
              className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {added ? <><CheckCircle size={16} />Added!</> : <><ShoppingCart size={16} />Add to Cart</>}
            </button>
          </div>

          {product.fullDescription && (
            <div className="border-t border-border pt-4">
              <h2 className="text-foreground font-bold text-sm mb-2">Details</h2>
              <p className="text-muted-foreground text-sm whitespace-pre-line">{product.fullDescription}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
