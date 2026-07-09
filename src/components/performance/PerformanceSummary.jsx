import React from 'react';
import RatingDisplay from './RatingDisplay';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function average(records, field) {
  const sum = records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  return Math.round((sum / records.length) * 10) / 10;
}

/** Small summary card: latest evaluation + average overall rating (when there's more than one record). */
export default function PerformanceSummary({ records }) {
  if (!records || records.length === 0) return null;

  const latest = records[0];
  const avgOverall = records.length > 1 ? average(records, 'overallRating') : null;

  return (
    <div className="bg-[#0D1B2A] rounded-2xl border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Latest Evaluation</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-3xl font-black text-white leading-none">
            {latest.overallRating}<span className="text-slate-500 text-lg">/5</span>
          </span>
          <RatingDisplay value={latest.overallRating} size="md" />
        </div>
        <p className="text-slate-400 text-xs mt-1.5">{formatDate(latest.evaluationDate)}</p>
      </div>

      {avgOverall !== null && (
        <div className="sm:text-right">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Average Overall</p>
          <p className="text-2xl font-black text-[#2563EB] leading-none">
            {avgOverall}<span className="text-slate-500 text-base">/5</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">{records.length} evaluations</p>
        </div>
      )}
    </div>
  );
}
