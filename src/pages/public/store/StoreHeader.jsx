import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

/**
 * Shared header for the public storefront pages. Uses the same Tailwind
 * token system (bg-background/bg-card/text-foreground) as the rest of the
 * app's client/admin pages, rather than LandingPage.jsx's separate bespoke
 * CSS — the shop is meant to feel like a native part of the app, not a
 * different marketing template.
 */
export default function StoreHeader({ backTo, backLabel }) {
  const { user } = useAuth();
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="font-black text-lg text-foreground flex-shrink-0">PP<span className="text-primary">GK</span></Link>
          {backTo ? (
            <Link to={backTo} className="hidden sm:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
              <ArrowLeft size={14} />{backLabel || 'Back'}
            </Link>
          ) : (
            <Link to="/shop" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Shop</Link>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {user ? (
            <Link to="/account/orders" className="hidden sm:block text-muted-foreground hover:text-foreground text-sm transition-colors">My Orders</Link>
          ) : (
            <Link to="/signin" className="hidden sm:block text-muted-foreground hover:text-foreground text-sm transition-colors">Sign In</Link>
          )}
          <Link to="/cart" className="relative w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:border-primary transition-colors">
            <ShoppingCart size={16} />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-foreground text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1">{itemCount}</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
