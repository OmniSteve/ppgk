import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, User, Phone, AlertTriangle, ClipboardList, TrendingUp,
  Check, ArrowRightLeft, X, ArrowUpCircle, RotateCcw,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const SORTS = {
  oldest: (a, b) => a.bookedAt.localeCompare(b.bookedAt) || a.firstName.localeCompare(b.firstName),
  newest: (a, b) => b.bookedAt.localeCompare(a.bookedAt) || a.firstName.localeCompare(b.firstName),
  name:   (a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
};

const ActionButton = ({ icon: Icon, label, onClick, disabled, tone = 'default' }) => {
  const toneCls = {
    default: 'border-border text-foreground hover:border-primary/40 hover:text-primary',
    primary: 'border-primary/50 text-primary hover:bg-primary/10',
    warn:    'border-warning/50 text-warning hover:bg-warning/10',
    danger:  'border-destructive/40 text-destructive hover:bg-destructive/10',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
    >
      <Icon size={12} />{label}
    </button>
  );
};

function RosterCard({ player, actions, pending }) {
  return (
    <div className="p-4 border-b border-border last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-foreground text-xs">{player.firstName?.[0]}{player.lastName?.[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{player.firstName} {player.lastName}</p>
            <p className="text-muted-foreground text-[11px] truncate">
              Requested {player.bookedAt ? new Date(player.bookedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
              {player.clientName ? ` · Parent: ${player.clientName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <ActionButton key={a.label} {...a} disabled={pending || a.disabled} />
          ))}
          <Link
            to={`/coach/players/${player.playerId}/performance`}
            state={{ player: { firstName: player.firstName, lastName: player.lastName, clientId: player.clientId } }}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          >
            <User size={12} />Profile
          </Link>
        </div>
      </div>
      {(player.medicalInfo || player.allergies) && (
        <div className="mt-2 flex items-start gap-1.5 text-warning text-[11px]">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{[player.medicalInfo, player.allergies].filter(Boolean).join(' · ')}</span>
        </div>
      )}
    </div>
  );
}

function RosterSection({ title, badgeCls, players, emptyText, renderActions, sort, actioning }) {
  const sorted = [...players].sort(SORTS[sort]);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-bold text-foreground text-sm">{title}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{players.length}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">{emptyText}</p>
      ) : (
        sorted.map((p) => (
          <RosterCard key={p.bookingId} player={p} actions={renderActions(p)} pending={actioning === p.bookingId} />
        ))
      )}
    </div>
  );
}

export default function SessionAttendees() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('oldest');
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState('');

  const isRequestMode = session?.bookingMode === 'request';

  const loadRoster = useCallback(() => {
    return apiClient.get(`/coach/sessions/${id}/roster`).then((data) => {
      setRoster(data);
      setSession((prev) => ({ ...prev, ...data.session }));
    });
  }, [id]);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/coach/sessions/${id}`).then((s) => {
      setSession(s);
      if (s.bookingMode === 'request') return loadRoster();
      return apiClient.get(`/coach/sessions/${id}/attendees`).then((a) => {
        setAttendees(Array.isArray(a) ? a : (a?.attendees ?? []));
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, [id, loadRoster]);

  const runAction = async (bookingId, action) => {
    setError(''); setActioning(bookingId);
    try {
      await apiClient.patch(`/coach/sessions/${id}/roster/${bookingId}`, { action });
      await loadRoster();
    } catch (err) {
      setError(err.message || 'That action could not be completed.');
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  const capacityFull = roster ? roster.session.confirmedCount >= roster.session.capacity : false;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/coach/sessions" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
        <ChevronLeft size={16} />Back to Sessions
      </Link>

      {session && (
        <div className="bg-sidebar rounded-2xl p-5 border border-border">
          <h1 className="text-foreground font-black text-xl">{session.title || session.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {session.sessionDate ? new Date(session.sessionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {session.startTime} – {session.endTime}
            {session.locationName ? ` · ${session.locationName}` : ''}
          </p>

          {isRequestMode && roster ? (
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span className="text-success font-semibold text-label-mono">Confirmed: {roster.session.confirmedCount} / {roster.session.capacity}</span>
              <span className="text-warning font-semibold text-label-mono">Pending: {roster.session.pendingCount}</span>
              <span className="text-muted-foreground font-semibold text-label-mono">Backup: {roster.session.backupCount}</span>
            </div>
          ) : (
            <p className="text-primary text-sm mt-1 text-label-mono">{attendees.length} / {session.capacity} players</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {isRequestMode && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Sort:</span>
            {[{ key: 'oldest', label: 'Oldest request' }, { key: 'newest', label: 'Newest request' }, { key: 'name', label: 'Name' }].map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${sort === s.key ? 'bg-primary text-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <Link to={`/coach/sessions/${id}/attendance`} className="ml-auto bg-primary hover:bg-primary-hover text-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
          <ClipboardList size={16} />Record Attendance
        </Link>
      </div>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">{error}</div>}

      {isRequestMode && roster ? (
        <div className="space-y-4">
          {capacityFull && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-warning flex-shrink-0" />
              <p className="text-warning text-xs">Session is full — confirm a backup player after removing or backing up a confirmed player to free a slot.</p>
            </div>
          )}

          <RosterSection
            title="Confirmed Players" badgeCls="bg-success/20 text-success"
            players={roster.confirmed} sort={sort} actioning={actioning}
            emptyText="No players confirmed yet."
            renderActions={(p) => [
              { icon: ArrowRightLeft, label: 'Move to Backup', tone: 'warn', onClick: () => runAction(p.bookingId, 'backup') },
              { icon: X, label: 'Remove', tone: 'danger', onClick: () => runAction(p.bookingId, 'remove') },
            ]}
          />

          <RosterSection
            title="Pending Requests" badgeCls="bg-warning/20 text-warning"
            players={roster.pending} sort={sort} actioning={actioning}
            emptyText="No pending requests."
            renderActions={(p) => [
              { icon: Check, label: capacityFull ? 'Session full' : 'Confirm', tone: 'primary', disabled: capacityFull, onClick: () => runAction(p.bookingId, 'confirm') },
              { icon: ArrowRightLeft, label: 'Move to Backup', tone: 'warn', onClick: () => runAction(p.bookingId, 'backup') },
              { icon: X, label: 'Decline', tone: 'danger', onClick: () => runAction(p.bookingId, 'decline') },
            ]}
          />

          <RosterSection
            title="Backup Pool" badgeCls="bg-accent text-muted-foreground"
            players={roster.backup} sort={sort} actioning={actioning}
            emptyText="No players on the backup list."
            renderActions={(p) => [
              { icon: ArrowUpCircle, label: capacityFull ? 'Session full' : 'Promote', tone: 'primary', disabled: capacityFull, onClick: () => runAction(p.bookingId, 'confirm') },
              { icon: RotateCcw, label: 'Return to Pending', onClick: () => runAction(p.bookingId, 'pending') },
              { icon: X, label: 'Decline', tone: 'danger', onClick: () => runAction(p.bookingId, 'decline') },
            ]}
          />
        </div>
      ) : attendees.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <User size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No bookings yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {attendees.map((a) => (
            <div key={a.bookingId} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-foreground text-sm">{a.firstName?.[0]}{a.lastName?.[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-muted-foreground text-xs truncate">{a.ageGroup} · {a.experienceLevel}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">Parent: {a.parentName}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.bookingStatus === 'confirmed' ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'
                }`}>{a.bookingStatus?.replace(/_/g, ' ')}</span>
              </div>

              {(a.medicalInfo || a.allergies) && (
                <div className="mt-3 bg-warning/20 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-warning">
                    {a.medicalInfo && <p><strong>Medical:</strong> {a.medicalInfo}</p>}
                    {a.allergies && <p><strong>Allergies:</strong> {a.allergies}</p>}
                  </div>
                </div>
              )}

              {a.emergencyPhone && (
                <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Phone size={12} />Emergency: {a.emergencyContactName} — {a.emergencyPhone}
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Link
                  to={`/coach/players/${a.playerId}/performance`}
                  state={{ player: { firstName: a.firstName, lastName: a.lastName, clientId: a.clientId } }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-foreground transition-colors"
                >
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
