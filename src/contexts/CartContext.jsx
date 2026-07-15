import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'ppgk_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sameLine(a, b) {
  return a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);
}

export const CartProvider = ({ children }) => {
  const [lines, setLines] = useState(loadCart);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* private browsing — cart stays in-memory only */ }
  }, [lines]);

  const addItem = (item) => {
    // item: { productId, variantId?, quantity, name, variantName?, price, imageUrl?, available? }
    setLines((prev) => {
      const existing = prev.find((l) => sameLine(l, item));
      if (existing) {
        return prev.map((l) => sameLine(l, item) ? { ...l, quantity: l.quantity + item.quantity } : l);
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (productId, variantId, quantity) => {
    setLines((prev) => prev.map((l) => (l.productId === productId && (l.variantId ?? null) === (variantId ?? null)) ? { ...l, quantity } : l).filter((l) => l.quantity > 0));
  };

  const removeItem = (productId, variantId) => {
    setLines((prev) => prev.filter((l) => !(l.productId === productId && (l.variantId ?? null) === (variantId ?? null))));
  };

  const clearCart = () => setLines([]);

  const subtotal = useMemo(() => Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100, [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, addItem, updateQuantity, removeItem, clearCart, subtotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
