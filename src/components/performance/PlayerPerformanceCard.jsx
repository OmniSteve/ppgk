import { Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import RatingDisplay from './RatingDisplay';
import TrendIndicator from './TrendIndicator';

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

/**
 * One performance evaluation, in a card. Edit/delete/visibility are staff-only (canManage).
 * `previous` (optional) is the chronologically-prior evaluation, used to show a trend badge.
 */
export default function PlayerPerformanceCard({ record, previous, canManage, onEdit, onDelete, deleting }) {
  const hasNotes = TEXT_FIELDS.some(([field]) => record[field]);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-muted-foreground text-xs font-semibold">{formatDate(record.evaluationDate)}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-2xl font-black text-foreground leading-none text-label-mono">
              {record.overallRating}<span className="text-muted-foreground text-sm">/5</span>
            </span>
            <RatingDisplay value={record.overallRating} size="md" />
            {previous && <TrendIndicator current={record.overallRating} previous={previous.overallRating} />}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              record.isVisibleToClient ? 'bg-success/20 text-success' : 'bg-accent text-muted-foreground'
            }`}>
              {record.isVisibleToClient ? <Eye size={11} /> : <EyeOff size={11} />}
              {record.isVisibleToClient ? 'Visible to client' : 'Coach only'}
            </span>
          )}
          {canManage && (
            <span className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => onEdit(record)}
                className="w-8 h-8 rounded-lg bg-accent hover:bg-primary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                aria-label="Edit evaluation"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(record)}
                disabled={deleting}
                className="w-8 h-8 rounded-lg bg-accent hover:bg-destructive flex items-center justify-center text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                aria-label="Delete evaluation"
              >
                <Trash2 size={14} />
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 pt-3 border-t border-border">
        {CATEGORY_FIELDS.map(([field, label]) => (
          <RatingDisplay key={field} value={record[field]} label={label} size="sm" />
        ))}
      </div>

      {hasNotes && (
        <div className="space-y-2 pt-3 border-t border-border text-sm">
          {TEXT_FIELDS.map(([field, label]) => record[field] && (
            <p key={field}>
              <span className="text-muted-foreground font-semibold">{label}: </span>
              <span className="text-foreground whitespace-pre-wrap">{record[field]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
