import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const RESOURCE_PATHS = { user: '/admin/clients', player: '/admin/players', coach: '/admin/coaches' };
const ENTITY_LABELS = { user: 'User', player: 'Player', coach: 'Coach' };

const IMPACT_FIELDS = {
  user: [
    ['futureBookings', 'Future bookings'],
    ['completedBookings', 'Completed bookings (retained)'],
    ['activeCredits', 'Active credits'],
    ['payments', 'Payments on file (retained)'],
    ['attendanceRecords', 'Attendance records (retained)'],
    ['performanceEvaluations', 'Performance evaluations (retained)'],
    ['linkedPlayers', 'Linked player profiles'],
    ['linkedCoachProfile', 'Has a coach profile'],
  ],
  player: [
    ['futureBookings', 'Future bookings'],
    ['completedBookings', 'Completed bookings (retained)'],
    ['activeCredits', "Client's active credits"],
    ['attendanceRecords', 'Attendance records (retained)'],
    ['performanceEvaluations', 'Performance evaluations (retained)'],
  ],
  coach: [
    ['futureSessions', 'Future scheduled sessions'],
    ['attendanceRecords', 'Attendance records on their sessions (retained)'],
    ['performanceEvaluations', 'Performance evaluations on their sessions (retained)'],
  ],
};

const inputCls = 'w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1';

function ImpactGrid({ entityType, impact }) {
  if (!impact) return null;
  const fields = IMPACT_FIELDS[entityType];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-accent/50 rounded-xl p-3 text-sm">
      {fields.map(([key, label]) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{label}</span>
          <span className="text-foreground font-semibold">
            {typeof impact[key] === 'boolean' ? (impact[key] ? 'Yes' : 'No') : (impact[key] ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ShellDialog({ children, onDismiss }) {
  return (
    <AlertDialog open onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <AlertDialogContent className="bg-card border-border text-foreground rounded-2xl max-w-lg">
        {children}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Deactivate ─────────────────────────────────────────────────────────────

export function DeactivateModal({ entityType, entity, onClose, onSuccess }) {
  const resourcePath = RESOURCE_PATHS[entityType];
  const label = ENTITY_LABELS[entityType];

  const [impact, setImpact] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [resolution, setResolution] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [blockInfo, setBlockInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`${resourcePath}/${entity.id}/deactivation-impact`)
      .then((d) => { if (!cancelled) setImpact(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load impact preview'); })
      .finally(() => { if (!cancelled) setLoadingImpact(false); });
    return () => { cancelled = true; };
  }, [resourcePath, entity.id]);

  const needsResolution = entityType === 'player'
    ? (impact?.futureBookings ?? 0) > 0
    : entityType === 'coach'
      ? (impact?.futureSessions ?? 0) > 0
      : false;

  useEffect(() => {
    if (!needsResolution) return;
    let cancelled = false;
    if (entityType === 'player') {
      apiClient.get('/admin/players?limit=100').then((d) => {
        if (cancelled) return;
        setCandidates((d.players || []).filter((p) => p.clientId === entity.clientId && p.id !== entity.id && p.status === 'active'));
      }).catch(() => {});
    } else if (entityType === 'coach') {
      apiClient.get('/admin/coaches').then((d) => {
        if (cancelled) return;
        setCandidates((d.coaches || []).filter((c) => c.id !== entity.id));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [needsResolution, entityType, entity.id, entity.clientId]);

  const handleSubmit = async () => {
    setSubmitting(true); setError(''); setBlockInfo(null);
    try {
      const body = { reason: reason || undefined };
      if (entityType === 'player' && needsResolution) {
        body.futureBookingAction = resolution;
        if (resolution === 'reassign') body.reassignToPlayerId = reassignTo;
      }
      if (entityType === 'coach' && needsResolution) {
        body.futureSessionAction = resolution;
        if (resolution === 'reassign') body.reassignToCoachId = reassignTo;
      }
      await apiClient.post(`${resourcePath}/${entity.id}/deactivate`, body);
      onSuccess();
    } catch (e) {
      if (e.status === 409) {
        setBlockInfo(e.responseBody || { message: e.message });
      } else {
        setError(e.message || 'Failed to deactivate');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resolutionReady = !needsResolution || (resolution === 'cancel_and_return_credit') || (resolution === 'cancel')
    || (resolution === 'reassign' && !!reassignTo);

  return (
    <ShellDialog onDismiss={onClose}>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground flex items-center gap-2"><ShieldOff size={18} className="text-warning" />Deactivate {label} — {entity.name}</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          {entity.email && <span className="block mb-1">{entity.email}</span>}
          This blocks future use but keeps all historical records intact. It can be reversed at any time.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-4">
        {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}

        {loadingImpact ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" />Loading impact preview…</div>
        ) : impact && <ImpactGrid entityType={entityType} impact={impact} />}

        {entityType === 'user' && (
          <p className="text-xs text-muted-foreground">Linked player profiles and any coach profile are <strong className="text-foreground">not</strong> affected — deactivate them separately if needed.</p>
        )}

        {blockInfo && (
          <div className="bg-warning/20 border border-warning/30 rounded-xl p-3 text-sm text-foreground flex items-start gap-2">
            <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
            <span>{blockInfo.message}</span>
          </div>
        )}

        {needsResolution && (
          <div className="border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              {entityType === 'player'
                ? `This player has ${impact.futureBookings} future booking(s) that must be resolved:`
                : `This coach has ${impact.futureSessions} future session(s) that must be resolved:`}
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="resolution" checked={resolution === (entityType === 'player' ? 'cancel_and_return_credit' : 'cancel')}
                onChange={() => setResolution(entityType === 'player' ? 'cancel_and_return_credit' : 'cancel')} className="accent-primary" />
              {entityType === 'player' ? 'Cancel the bookings and return eligible credits' : 'Cancel the sessions'}
            </label>
            <label className={`flex items-center gap-2 text-sm ${candidates.length === 0 ? 'text-muted-foreground/50' : 'cursor-pointer'}`}>
              <input type="radio" name="resolution" disabled={candidates.length === 0} checked={resolution === 'reassign'}
                onChange={() => setResolution('reassign')} className="accent-primary" />
              Reassign to another active {entityType === 'player' ? 'player on this account' : 'coach'}
              {candidates.length === 0 && ' (none available)'}
            </label>
            {resolution === 'reassign' && candidates.length > 0 && (
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} rows={2} placeholder="e.g. Account no longer required" />
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={submitting} className="bg-transparent border-border text-foreground hover:bg-accent">Cancel</AlertDialogCancel>
        <button onClick={handleSubmit} disabled={submitting || loadingImpact || !resolutionReady}
          className="px-4 py-2 rounded-xl bg-warning hover:bg-warning/80 text-warning-foreground text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
          Deactivate {label}
        </button>
      </AlertDialogFooter>
    </ShellDialog>
  );
}

// ─── Reactivate ─────────────────────────────────────────────────────────────

const REACTIVATE_COPY = {
  user: 'This restores login access and all previously available functionality.',
  player: 'This returns the player to active lists, booking selectors, and allows credits to be issued/used again.',
  coach: 'This restores coach access and returns the coach to session-assignment selectors.',
};

export function ReactivateModal({ entityType, entity, onClose, onSuccess }) {
  const resourcePath = RESOURCE_PATHS[entityType];
  const label = ENTITY_LABELS[entityType];
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      await apiClient.post(`${resourcePath}/${entity.id}/reactivate`, {});
      onSuccess();
    } catch (e) {
      setError(e.message || 'Failed to reactivate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellDialog onDismiss={onClose}>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground flex items-center gap-2"><ShieldCheck size={18} className="text-success" />Reactivate {label} — {entity.name}</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">{REACTIVATE_COPY[entityType]}</AlertDialogDescription>
      </AlertDialogHeader>
      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={submitting} className="bg-transparent border-border text-foreground hover:bg-accent">Cancel</AlertDialogCancel>
        <button onClick={handleSubmit} disabled={submitting}
          className="px-4 py-2 rounded-xl bg-success hover:bg-success/80 text-success-foreground text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Reactivate {label}
        </button>
      </AlertDialogFooter>
    </ShellDialog>
  );
}

// ─── Permanent delete ───────────────────────────────────────────────────────

export function PermanentDeleteModal({ entityType, entity, onClose, onSuccess }) {
  const resourcePath = RESOURCE_PATHS[entityType];
  const label = ENTITY_LABELS[entityType];

  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`${resourcePath}/${entity.id}/deletion-eligibility`)
      .then((d) => { if (!cancelled) setEligibility(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to check deletion eligibility'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resourcePath, entity.id]);

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      await apiClient.delete(`${resourcePath}/${entity.id}`, { confirm: 'DELETE', reason: reason || undefined });
      onSuccess();
    } catch (e) {
      setError(e.message || 'Failed to permanently delete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellDialog onDismiss={onClose}>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-destructive flex items-center gap-2"><Trash2 size={18} />Permanently Delete {label} — {entity.name}</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          This action cannot be undone. Records with any booking, payment, attendance, or other protected history cannot be deleted — deactivate them instead.
        </AlertDialogDescription>
      </AlertDialogHeader>

      {error && <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" />Checking eligibility…</div>
      ) : eligibility && !eligibility.eligible ? (
        <div className="bg-warning/20 border border-warning/30 rounded-xl p-3 text-sm text-foreground space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} className="text-warning" />This record cannot be permanently deleted:</p>
          <ul className="list-disc list-inside text-muted-foreground">
            {eligibility.blockingReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="text-muted-foreground pt-1">Deactivate it instead to remove access while preserving this history.</p>
        </div>
      ) : eligibility?.eligible ? (
        <div className="space-y-3">
          <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-3 text-destructive text-sm">
            No protected history was found for this record — it is eligible for permanent deletion.
          </div>
          <div>
            <label className={labelCls}>Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} rows={2} placeholder="e.g. Duplicate test registration" />
          </div>
          <div>
            <label className={labelCls}>Type <span className="font-mono text-destructive">DELETE</span> to confirm</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inputCls} placeholder="DELETE" autoComplete="off" />
          </div>
        </div>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={submitting} className="bg-transparent border-border text-foreground hover:bg-accent">Close</AlertDialogCancel>
        {eligibility?.eligible && (
          <button onClick={handleSubmit} disabled={submitting || confirmText !== 'DELETE'}
            className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Permanently Delete
          </button>
        )}
      </AlertDialogFooter>
    </ShellDialog>
  );
}
