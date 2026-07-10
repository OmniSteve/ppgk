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

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function average(records, field) {
  const sum = records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  return Math.round((sum / records.length) * 10) / 10;
}

/**
 * Latest-evaluation highlight card: overall + category ratings, each with a trend
 * indicator vs. the previous evaluation, plus the overall average across all records.
 *
 * `chronological` must be sorted newest-first regardless of any display sort applied
 * elsewhere, so "latest"/"previous" here always mean the two most recent evaluations.
 */
export default function PerformanceSummary({ chronological }) {
  if (!chronological || chronological.length === 0) return null;

  const [latest, previous] = chronological;
  const avgOverall = chronological.length > 1 ? average(chronological, 'overallRating') : null;

  return (
    <div className="bg-sidebar rounded-2xl border border-border p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Latest Evaluation</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-5xl font-black text-foreground leading-none">
              {latest.overallRating}<span className="text-muted-foreground text-2xl">/5</span>
            </span>
            <RatingDisplay value={latest.overallRating} size="md" />
            {previous && <TrendIndicator current={latest.overallRating} previous={previous.overallRating} showLabel />}
          </div>
          <p className="text-muted-foreground text-xs mt-1.5">{formatDate(latest.evaluationDate)}</p>
        </div>

        {avgOverall !== null && (
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Average Overall</p>
            <p className="text-4xl font-black text-primary leading-none">
              {avgOverall}<span className="text-muted-foreground text-xl">/5</span>
            </p>
            <p className="text-muted-foreground text-xs mt-1.5">{chronological.length} evaluations</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 pt-3 border-t border-border">
        {CATEGORY_FIELDS.map(([field, label]) => (
          <div key={field} className="flex items-center gap-2 flex-wrap">
            <RatingDisplay value={latest[field]} label={label} size="sm" />
            {previous && <TrendIndicator current={latest[field]} previous={previous[field]} />}
          </div>
        ))}
      </div>
    </div>
  );
}
