import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardList, AlertCircle } from 'lucide-react';
import PlayerPerformanceCard from './PlayerPerformanceCard';
import PlayerPerformanceForm from './PlayerPerformanceForm';
import PerformanceSummary from './PerformanceSummary';
import { getPlayerPerformance, getClientPlayerPerformance, deletePerformanceRecord } from '@/services/playerPerformance';

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

      <PerformanceSummary records={records} />

      {records.length === 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
          <ClipboardList size={32} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">No performance evaluations yet</p>
          {canManage && <p className="text-slate-500 text-xs mt-1">Add the first evaluation to start tracking progress.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <PlayerPerformanceCard
              key={r.id}
              record={r}
              canManage={canManage}
              deleting={deletingId === r.id}
              onEdit={(rec) => { setEditingRecord(rec); setFormOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
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
