import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

/** Improved/same/declined vs. the previous evaluation's value for one field. */
export default function TrendIndicator({ current, previous, size = 12, showLabel = false }) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  const diff = current - previous;

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-400 text-xs font-semibold">
        <ArrowUp size={size} />{showLabel ? `Improved (+${diff})` : `+${diff}`}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-xs font-semibold">
        <ArrowDown size={size} />{showLabel ? `Declined (${diff})` : diff}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-400 text-xs font-semibold">
      <Minus size={size} />{showLabel ? 'Same' : '0'}
    </span>
  );
}
