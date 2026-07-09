import { Star } from 'lucide-react';

const SIZES = { sm: 13, md: 18, lg: 24 };

/** Read-only 1-5 star rating. */
export default function RatingDisplay({ value = 0, size = 'sm', label }) {
  const px = SIZES[size] || SIZES.sm;
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-slate-400 w-28 flex-shrink-0 truncate">{label}</span>}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={px}
            className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}
          />
        ))}
      </div>
    </div>
  );
}
