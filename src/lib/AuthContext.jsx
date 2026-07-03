/**
 * Platform-required AuthContext stub.
 * The Base44 SDK public-settings call is replaced with a no-op so it
 * doesn't fire a 404 against /api/apps/public/* in production.
 * Real authentication is handled by src/contexts/AuthContext.jsx.
 */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // No SDK calls — real auth is in src/contexts/AuthContext.jsx
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};