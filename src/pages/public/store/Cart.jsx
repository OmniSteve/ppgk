import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart, ImageOff } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import StoreHeader from './StoreHeader';

export default function Cart() {
  const { lines, updateQuantity, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader backTo="/shop" backLabel="Continue shopping" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-black text-foreground">Your Cart</h1>

        {lines.length === 0 ? (
          <div className="p-16 text-center bg-card rounded-2xl border border-border">
            <ShoppingCart size={36} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link to="/shop" className="inline-block bg-primary hover:bg-primary-hover text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">Browse the shop</Link>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-2xl border border-border divide-y divide-border">
              {lines.map((line) => (
                <div key={`${line.productId}-${line.variantId || 'base'}`} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center overflow-hidden flex-shrink-0">
                    {line.imageUrl ? <img src={line.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageOff size={18} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">{line.name}</p>
                    {line.variantName && <p className="text-muted-foreground text-xs">{line.variantName}</p>}
                    <p className="text-muted-foreground text-xs">€{Number(line.price).toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="flex items-center border border-border rounded-xl">
                      <button onClick={() => updateQuantity(line.productId, line.variantId, line.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-accent transition-colors"><Minus size={13} /></button>
                      <span className="w-8 text-center text-foreground text-sm font-semibold">{line.quantity}</span>
                      <button onClick={() => updateQuantity(line.productId, line.variantId, line.quantity + 1)} className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-accent transition-colors"><Plus size={13} /></button>
                    </div>
                    <p className="text-foreground font-bold text-sm w-16 text-right flex-shrink-0">€{Number(line.price * line.quantity).toFixed(2)}</p>
                    <button onClick={() => removeItem(line.productId, line.variantId)} className="w-9 h-9 rounded-lg bg-accent hover:bg-destructive flex items-center justify-center text-muted-foreground hover:text-destructive-foreground transition-all flex-shrink-0" aria-label="Remove item">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground font-semibold">€{subtotal.toFixed(2)}</span>
              </div>
              <p className="text-muted-foreground text-xs">Delivery fee and tax (if applicable) are calculated at checkout based on your chosen delivery method.</p>
            </div>

            <button onClick={() => navigate('/shop/checkout')} className="w-full bg-primary hover:bg-primary-hover text-foreground font-bold py-3.5 rounded-xl text-sm transition-colors">
              Proceed to Checkout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
