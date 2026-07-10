import RatingBar from './RatingBar';

const CATEGORY_FIELDS = [
  ['overallRating', 'Overall'],
  ['handlingRating', 'Handling'],
  ['divingRating', 'Diving'],
  ['footworkRating', 'Footwork'],
  ['distributionRating', 'Distribution'],
  ['communicationRating', 'Communication'],
  ['attitudeRating', 'Attitude'],
];

function average(records, field) {
  const sum = records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  return sum / records.length;
}

/** Average rating per category across all of a player's evaluations, as simple bars. */
export default function CategoryBreakdown({ records }) {
  if (!records || records.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Category Averages{records.length > 1 ? ` · ${records.length} evaluations` : ''}
      </p>
      {CATEGORY_FIELDS.map(([field, label]) => (
        <RatingBar key={field} label={label} value={average(records, field)} />
      ))}
    </div>
  );
}
