import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, User, Calendar, Activity, TrendingUp } from 'lucide-react';
import { apiClient, unwrap } from '@/services/apiClient';

function normalisePlayer(p) {
  if (!p) return p;
  return {
    ...p,
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    ageGroup: p.ageGroup ?? '',
    experienceLevel: p.experienceLevel ?? '',
    currentClub: p.currentClub ?? '',
    dateOfBirth: p.dateOfBirth ?? '',
    status: p.status ?? 'active',
  };
}

export default function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/players')
      .then((data) => setPlayers(unwrap(data, 'players').map(normalisePlayer)))
      .catch(() => setPlayers([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Players</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage goalkeeper profiles</p>
        </div>
        <Link to="/players/new" className="bg-primary hover:bg-primary-hover text-foreground text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          <Plus size={16} />Add Player
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : players.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <User size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium mb-4">No players yet</p>
          <Link to="/players/new" className="bg-primary hover:bg-primary-hover text-foreground font-bold px-6 py-2.5 rounded-xl text-sm transition-colors inline-flex items-center gap-2">
            <Plus size={16} />Add first player
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {players.map((p) => (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-5 hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <span className="text-foreground font-black text-base">{p.firstName?.[0]}{p.lastName?.[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{p.firstName} {p.lastName}</p>
                    <p className="text-muted-foreground text-xs">{p.ageGroup}{p.experienceLevel ? ` · ${p.experienceLevel}` : ''}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'}`}>
                  {p.status}
                </span>
              </div>
              <div className="space-y-1.5 mb-4">
                {p.currentClub && <p className="text-muted-foreground text-xs flex items-center gap-1.5"><Activity size={11} />Club: {p.currentClub}</p>}
                <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <Calendar size={11} />DOB: {p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-MT') : '—'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link to={`/players/${p.id}/edit`} className="flex items-center gap-2 text-primary text-sm font-semibold hover:underline">
                  <Edit2 size={13} />Edit Profile
                </Link>
                <Link to={`/players/${p.id}/performance`} className="flex items-center gap-2 text-primary text-sm font-semibold hover:underline">
                  <TrendingUp size={13} />Performance
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
