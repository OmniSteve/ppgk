/** Simple horizontal bar (no charting library) representing a 0-5 rating/average. */
export default function RatingBar({ label, value, max = 5 }) {
  const numeric = Number(value) || 0;
  const pct = Math.max(0, Math.min(100, (numeric / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-28 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-300 w-8 text-right flex-shrink-0">
        {value != null ? numeric.toFixed(1).replace(/\.0$/, '') : '—'}
      </span>
    </div>
  );
}
