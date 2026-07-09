import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Improved/same/declined vs. the previous evaluation's value for one field.
 * Compact mode (showLabel=false, used on category rows/cards) hides "same" entirely
 * rather than rendering a confusing "- 0"; changes show a clear +1 / -1.
 * Label mode (showLabel=true, used on the latest-evaluation highlight) always renders
 * a full sentence, including for "no change".
 */
export default function TrendIndicator({ current, previous, size = 12, showLabel = false }) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  const diff = current - previous;

  if (diff === 0) {
    if (!showLabel) return null;
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
        No change from previous evaluation
      </span>
    );
  }

  const improved = diff > 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  const colorCls = improved ? 'text-green-400' : 'text-red-400';

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colorCls}`}>
        <Icon size={size} />{improved ? 'Improved from previous evaluation' : 'Declined from previous evaluation'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${colorCls}`}>
      <Icon size={size} />{improved ? `+${diff}` : diff}
    </span>
  );
}
