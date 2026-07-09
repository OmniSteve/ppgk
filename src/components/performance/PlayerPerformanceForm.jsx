import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import RatingInput from './RatingInput';
import { createPerformanceRecord, updatePerformanceRecord } from '@/services/playerPerformance';

const inputCls = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

const RATING_FIELDS = [
  ['overallRating', 'Overall'],
  ['handlingRating', 'Handling'],
  ['divingRating', 'Diving'],
  ['footworkRating', 'Footwork'],
  ['distributionRating', 'Distribution'],
  ['communicationRating', 'Communication'],
  ['attitudeRating', 'Attitude'],
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Create/edit modal for a performance evaluation. Staff-only (rendered by PlayerPerformanceList when canManage). */
export default function PlayerPerformanceForm({ playerId, clientId, playerName, record, onClose, onSaved }) {
  const isEdit = !!record;
  const [form, setForm] = useState({
    evaluationDate: record?.evaluationDate || todayISO(),
    overallRating: record?.overallRating || 0,
    handlingRating: record?.handlingRating || 0,
    divingRating: record?.divingRating || 0,
    footworkRating: record?.footworkRating || 0,
    distributionRating: record?.distributionRating || 0,
    communicationRating: record?.communicationRating || 0,
    attitudeRating: record?.attitudeRating || 0,
    strengths: record?.strengths || '',
    areasToImprove: record?.areasToImprove || '',
    coachNotes: record?.coachNotes || '',
    recommendedFocus: record?.recommendedFocus || '',
    isVisibleToClient: record?.isVisibleToClient ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setRating = (k) => (n) => setForm((f) => ({ ...f, [k]: n }));

  const handleSave = async () => {
    setError('');
    if (!form.evaluationDate) { setError('Evaluation date is required'); return; }
    const missing = RATING_FIELDS.find(([key]) => !(form[key] >= 1 && form[key] <= 5));
    if (missing) { setError(`Please set a rating for ${missing[1]}`); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        strengths: form.strengths.trim() || undefined,
        areasToImprove: form.areasToImprove.trim() || undefined,
        coachNotes: form.coachNotes.trim() || undefined,
        recommendedFocus: form.recommendedFocus.trim() || undefined,
      };

      if (isEdit) {
        await updatePerformanceRecord(record.id, payload);
        onSaved({ ...record, ...payload });
      } else {
        const created = await createPerformanceRecord({ playerId, clientId, ...payload });
        onSaved({ id: created.id, playerId, clientId, ...payload });
      }
    } catch (e) {
      setError(e.message || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#0F172A]">
          <h2 className="font-bold text-white text-lg">{isEdit ? 'Edit' : 'New'} Evaluation{playerName ? ` — ${playerName}` : ''}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

          <div>
            <label className={labelCls}>Evaluation Date</label>
            <input type="date" className={inputCls} value={form.evaluationDate} onChange={setField('evaluationDate')} />
          </div>

          <div>
            <p className={labelCls}>Ratings</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
              {RATING_FIELDS.map(([key, label]) => (
                <RatingInput key={key} label={label} value={form[key]} onChange={setRating(key)} />
              ))}
            </div>
          </div>

          <div><label className={labelCls}>Strengths</label><textarea className={inputCls} rows={2} value={form.strengths} onChange={setField('strengths')} /></div>
          <div><label className={labelCls}>Areas to Improve</label><textarea className={inputCls} rows={2} value={form.areasToImprove} onChange={setField('areasToImprove')} /></div>
          <div><label className={labelCls}>Recommended Focus</label><textarea className={inputCls} rows={2} value={form.recommendedFocus} onChange={setField('recommendedFocus')} /></div>
          <div><label className={labelCls}>Coach Notes</label><textarea className={inputCls} rows={2} value={form.coachNotes} onChange={setField('coachNotes')} /></div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isVisibleToClient}
              onChange={(e) => setForm((f) => ({ ...f, isVisibleToClient: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#2563EB]"
            />
            <span className="text-sm text-slate-300">Visible to client/parent</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 sticky bottom-0 bg-[#0F172A]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:border-white/30 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
            <Save size={14} />{saving ? 'Saving…' : 'Save Evaluation'}
          </button>
        </div>
      </div>
    </div>
  );
}
