import { Star } from 'lucide-react';

/** Interactive 1-5 star rating picker for the evaluation form. */
export default function RatingInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${label}: ${n} of 5`}
            aria-pressed={value === n}
          >
            <Star
              size={22}
              className={n <= (value || 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-foreground'}
            />
          </button>
        ))}
        <span className="ml-1.5 text-xs text-muted-foreground text-label-mono">{value ? `${value}/5` : '—'}</span>
      </div>
    </div>
  );
}
