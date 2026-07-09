import React from 'react';
import { Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import RatingDisplay from './RatingDisplay';

const CATEGORY_FIELDS = [
  ['handlingRating', 'Handling'],
  ['divingRating', 'Diving'],
  ['footworkRating', 'Footwork'],
  ['distributionRating', 'Distribution'],
  ['communicationRating', 'Communication'],
  ['attitudeRating', 'Attitude'],
];

const TEXT_FIELDS = [
  ['strengths', 'Strengths'],
  ['areasToImprove', 'Areas to improve'],
  ['recommendedFocus', 'Recommended focus'],
  ['coachNotes', 'Coach notes'],
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One performance evaluation, in a card. Edit/delete/visibility are staff-only (canManage). */
export default function PlayerPerformanceCard({ record, canManage, onEdit, onDelete, deleting }) {
  const hasNotes = TEXT_FIELDS.some(([field]) => record[field]);

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-slate-400 text-xs font-semibold">{formatDate(record.evaluationDate)}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-2xl font-black text-white leading-none">
              {record.overallRating}<span className="text-slate-500 text-sm">/5</span>
            </span>
            <RatingDisplay value={record.overallRating} size="md" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              record.isVisibleToClient ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
            }`}>
              {record.isVisibleToClient ? <Eye size={11} /> : <EyeOff size={11} />}
              {record.isVisibleToClient ? 'Visible to client' : 'Coach only'}
            </span>
          )}
          {canManage && (
            <>
              <button
                onClick={() => onEdit(record)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#2563EB] flex items-center justify-center text-slate-400 hover:text-white transition-all"
                aria-label="Edit evaluation"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(record)}
                disabled={deleting}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-600 flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-50"
                aria-label="Delete evaluation"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 pt-3 border-t border-white/10">
        {CATEGORY_FIELDS.map(([field, label]) => (
          <RatingDisplay key={field} value={record[field]} label={label} size="sm" />
        ))}
      </div>

      {hasNotes && (
        <div className="space-y-2 pt-3 border-t border-white/10 text-sm">
          {TEXT_FIELDS.map(([field, label]) => record[field] && (
            <p key={field}>
              <span className="text-slate-400 font-semibold">{label}: </span>
              <span className="text-slate-300 whitespace-pre-wrap">{record[field]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
