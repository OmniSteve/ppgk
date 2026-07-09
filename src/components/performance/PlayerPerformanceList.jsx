import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, ClipboardList, AlertCircle, Printer, Download } from 'lucide-react';
import PlayerPerformanceCard from './PlayerPerformanceCard';
import PlayerPerformanceForm from './PlayerPerformanceForm';
import PerformanceSummary from './PerformanceSummary';
import CategoryBreakdown from './CategoryBreakdown';
import { getPlayerPerformance, getClientPlayerPerformance, deletePerformanceRecord } from '@/services/playerPerformance';

const SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['highest', 'Highest overall rating'],
  ['lowest', 'Lowest overall rating'],
];

const CSV_COLUMNS = [
  ['evaluationDate', 'Date'],
  ['overallRating', 'Overall'],
  ['handlingRating', 'Handling'],
  ['divingRating', 'Diving'],
  ['footworkRating', 'Footwork'],
  ['distributionRating', 'Distribution'],
  ['communicationRating', 'Communication'],
  ['attitudeRating', 'Attitude'],
  ['strengths', 'Strengths'],
  ['areasToImprove', 'Areas to Improve'],
  ['recommendedFocus', 'Recommended Focus'],
  ['coachNotes', 'Coach Notes'],
];

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(records, playerName) {
  const header = CSV_COLUMNS.map(([, label]) => csvEscape(label)).join(',');
  const rows = records.map((r) => CSV_COLUMNS.map(([field]) => csvEscape(r[field])).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(playerName || 'player').trim().replace(/\s+/g, '-').toLowerCase()}-performance.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sortRecords(records, sortBy) {
  const list = [...records];
  switch (sortBy) {
    case 'oldest':
      return list.sort((a, b) => (a.evaluationDate || '').localeCompare(b.evaluationDate || ''));
    case 'highest':
      return list.sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));
    case 'lowest':
      return list.sort((a, b) => (a.overallRating || 0) - (b.overallRating || 0));
    case 'newest':
    default:
      return list.sort((a, b) => (b.evaluationDate || '').localeCompare(a.evaluationDate || ''));
  }
}

/**
 * Fetches and renders a player's performance evaluations.
 * canManage=true (admin/coach): create/edit/delete + visibility toggle.
 * canManage=false (client/parent): read-only, server already filters to visible records.
 */
export default function PlayerPerformanceList({ playerId, clientId, playerName, canManage }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const fetcher = canManage ? getPlayerPerformance(playerId) : getClientPlayerPerformance(playerId);
    fetcher
      .then((data) => setRecords(Array.isArray(data?.records) ? data.records : []))
      .catch((e) => setError(e.message || 'Failed to load performance records'))
      .finally(() => setLoading(false));
  }, [playerId, canManage]);

  useEffect(() => { load(); }, [load]);

  // Chronological (newest-first) order, independent of the display sort below —
  // "latest"/"previous" for trend indicators always mean this order.
  const chronological = useMemo(() => sortRecords(records, 'newest'), [records]);

  const previousByRecordId = useMemo(() => {
    const map = {};
    for (let i = 0; i < chronological.length - 1; i++) {
      map[chronological[i].id] = chronological[i + 1];
    }
    return map;
  }, [chronological]);

  const displayRecords = useMemo(() => sortRecords(records, sortBy), [records, sortBy]);

  const handleDelete = async (record) => {
    if (!confirm('Delete this evaluation? This cannot be undone.')) return;
    setDeletingId(record.id);
    try {
      await deletePerformanceRecord(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch (e) {
      alert(e.message || 'Failed to delete evaluation');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingRecord(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
        <AlertCircle size={22} className="text-red-400" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={load} className="text-xs text-slate-300 underline mt-1">Try again</button>
      </div>
    );
  }

  const canCreate = canManage && !!clientId;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white">Performance Evaluations</h2>
        <div className="flex items-center gap-2 print:hidden">
          {records.length > 0 && (
            <>
              <button
                onClick={() => window.print()}
                title="Print this page"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-all"
              >
                <Printer size={15} />
              </button>
              <button
                onClick={() => downloadCsv(displayRecords, playerName)}
                title="Export as CSV"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-all"
              >
                <Download size={15} />
              </button>
            </>
          )}
          {canManage && (
            <button
              onClick={() => { setEditingRecord(null); setFormOpen(true); }}
              disabled={!canCreate}
              title={!canCreate ? 'Player details unavailable on this page — open Performance from the players list' : undefined}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} />Add Evaluation
            </button>
          )}
        </div>
      </div>

      <PerformanceSummary chronological={chronological} />
      <CategoryBreakdown records={records} />

      {records.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
          <ClipboardList size={32} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">No performance evaluations yet</p>
          {canManage && <p className="text-slate-500 text-xs mt-1">Add the first evaluation to start tracking progress.</p>}
        </div>
      ) : (
        <>
          {records.length > 1 && (
            <div className="flex items-center justify-end gap-2 print:hidden">
              <label htmlFor="performance-sort" className="text-xs text-slate-400 font-semibold">Sort by</label>
              <select
                id="performance-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#2563EB] transition-colors"
              >
                {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-4">
            {displayRecords.map((r) => (
              <PlayerPerformanceCard
                key={r.id}
                record={r}
                previous={previousByRecordId[r.id]}
                canManage={canManage}
                deleting={deletingId === r.id}
                onEdit={(rec) => { setEditingRecord(rec); setFormOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {formOpen && canManage && (
        <PlayerPerformanceForm
          playerId={playerId}
          clientId={clientId}
          playerName={playerName}
          record={editingRecord}
          onClose={() => { setFormOpen(false); setEditingRecord(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
