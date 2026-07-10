import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, User, Mail, Phone, Wallet } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const inp = 'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors';

/**
 * Searchable player selector for admin credit adjustments.
 * Searches by player name, parent/client name, email, or phone.
 * On selection, calls onSelect with { playerId, clientId, ... }.
 */
export default function PlayerCreditSelector({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Debounced search — 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get(`/admin/credits/search-players?q=${encodeURIComponent(query)}`);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (player) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setTouched(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  // ── Selected player card ──────────────────────────────────────────────
  if (selected) {
    return (
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{selected.playerName}</p>
              <p className="text-muted-foreground text-xs">Parent: {selected.clientName}</p>
            </div>
          </div>
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear selection">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-11">
          {selected.clientEmail && (
            <span className="flex items-center gap-1"><Mail size={11} />{selected.clientEmail}</span>
          )}
          {selected.clientPhone && (
            <span className="flex items-center gap-1"><Phone size={11} />{selected.clientPhone}</span>
          )}
          <span className="flex items-center gap-1"><Wallet size={11} />Credits: {selected.creditBalance ?? 0}</span>
        </div>
      </div>
    );
  }

  // ── Search input + results dropdown ──────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <label className="block text-muted-foreground text-xs mb-1">Search player / parent</label>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); setTouched(true); }}
          onFocus={() => setShowResults(true)}
          className={inp + ' pl-9'}
          placeholder="Search by player or parent name, email, phone…"
        />
        {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
      </div>

      {showResults && touched && query.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {!searching && results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No players found</div>
          ) : (
            results.map((p) => (
              <button
                key={p.playerId}
                onClick={() => handleSelect(p)}
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{p.playerName}</p>
                    <p className="text-muted-foreground text-xs truncate">Parent: {p.clientName}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      {p.clientEmail && <span className="truncate">{p.clientEmail}</span>}
                      {p.clientPhone && <span>{p.clientPhone}</span>}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-primary/20 text-primary text-label-mono">
                    {p.creditBalance ?? 0} cr
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
