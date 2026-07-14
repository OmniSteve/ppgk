import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';

const AuthContext = createContext(null);

// Detect Base44 preview environment (not ppgk.app)
const IS_PREVIEW = !window.location.hostname.includes('ppgk.app');

const PREVIEW_USER = {
  id: 'preview-admin',
  email: 'admin@ppgk.app',
  firstName: 'Preview',
  lastName: 'Admin',
  role: 'admin',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(IS_PREVIEW ? PREVIEW_USER : null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (IS_PREVIEW) {
      setIsLoading(false);
      return;
    }
    const token = localStorage.getItem('ppgk_token');
    const stored = localStorage.getItem('ppgk_user');
    if (!token || !stored) {
      setIsLoading(false);
      return;
    }
    // Validate the persisted token against the backend on startup so that an
    // expired/invalid token does not leave the UI in a "logged in but no data"
    // state. Uses a raw fetch (not apiClient) to avoid the 401 auto-redirect —
    // we clear state quietly here and let route guards send to /signin.
    console.info('[auth] rehydrating session — validating token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const me = await res.json();
          console.info('[auth] token valid — session restored for', me.email);
          const restored = {
            id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName, role: me.role,
          };
          localStorage.setItem('ppgk_user', JSON.stringify(restored));
          setUser(restored);
        } else {
          console.warn('[auth] token invalid/expired (' + res.status + ') — clearing stale session');
          localStorage.removeItem('ppgk_token');
          localStorage.removeItem('ppgk_user');
          setUser(null);
        }
      })
      .catch((e) => {
        console.warn('[auth] session validation failed — clearing stale session:', e.message);
        localStorage.removeItem('ppgk_token');
        localStorage.removeItem('ppgk_user');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Invalid credentials');
    }
    localStorage.setItem('ppgk_token', data.token);
    localStorage.setItem('ppgk_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    // 201 with accountCreated=true but emailSent=false is still a partial success
    if (!response.ok && !data.accountCreated) {
      throw new Error(data.error || data.message || 'Registration failed');
    }
    return data;
  };

  const signOut = () => {
    localStorage.removeItem('ppgk_token');
    localStorage.removeItem('ppgk_user');
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    localStorage.setItem('ppgk_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, register, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};