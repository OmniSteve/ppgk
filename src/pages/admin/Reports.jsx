import React, { useState } from 'react';
import { BarChart2, Download, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

// camelCase or snake_case key → human label ('totalBookings' → 'total bookings')
const labelise = (key) => key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

const REPORT_TYPES = [
  { key: 'bookings',             label: 'Session Bookings' },
  { key: 'attendance',           label: 'Attendance' },
  { key: 'capacity',             label: 'Capacity Utilisation' },
  { key: 'registrations',        label: 'Client Registrations' },
  { key: 'package_sales',        label: 'Package Sales' },
  { key: 'session_sales',        label: 'Individual Session Sales' },
  { key: 'revenue',              label: 'Revenue' },
  { key: 'outstanding_payments', label: 'Outstanding Payments' },
  { key: 'credit_balances',      label: 'Credit Balances' },
  { key: 'credit_usage',         label: 'Credit Usage' },
  { key: 'expired_credits',      label: 'Expired Credits' },
  { key: 'cancellations',        label: 'Cancellations' },
  { key: 'rescheduling',         label: 'Rescheduling Activity' },
];

export default function Reports() {
  const [reportType, setReportType] = useState('bookings');
  const [filters, setFilters] = useState({ from: '', to: '', clientId: '', sessionId: '', coachId: '', locationId: '' });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [exporting, setExporting] = useState(false);

  const set = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });

  const runReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
      const data = await apiClient.get(`/admin/reports/${reportType}${params ? '?' + params : ''}`);
      setResults(data);
    } catch {
      setResults({ error: 'Failed to load report.' });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ ...filters, format: 'csv' }).toString();
      const token = localStorage.getItem('ppgk_token');
      const response = await fetch(`/api/admin/reports/${reportType}/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${reportType}-report.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const inputCls = 'bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Generate and export operational reports</p>
        </div>
        {results && !results.error && (
          <button onClick={exportCsv} disabled={exporting} className="flex items-center gap-2 border border-border text-foreground font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-accent transition-all">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Export CSV
          </button>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Report Type</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.key}
              onClick={() => { setReportType(r.key); setResults(null); }}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${reportType === r.key ? 'bg-primary text-foreground' : 'border border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide pt-2">Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><label className="block text-muted-foreground text-xs mb-1">From date</label><input type="date" value={filters.from} onChange={set('from')} className={inputCls + ' w-full'} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">To date</label><input type="date" value={filters.to} onChange={set('to')} className={inputCls + ' w-full'} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Client ID (optional)</label><input value={filters.clientId} onChange={set('clientId')} className={inputCls + ' w-full'} placeholder="Filter by client" /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Session ID (optional)</label><input value={filters.sessionId} onChange={set('sessionId')} className={inputCls + ' w-full'} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Location ID (optional)</label><input value={filters.locationId} onChange={set('locationId')} className={inputCls + ' w-full'} /></div>
          <div><label className="block text-muted-foreground text-xs mb-1">Coach ID (optional)</label><input value={filters.coachId} onChange={set('coachId')} className={inputCls + ' w-full'} /></div>
        </div>

        <button onClick={runReport} disabled={loading} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground font-bold px-8 py-3 rounded-xl text-sm transition-colors flex items-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" />Running…</> : <><BarChart2 size={15} />Run Report</>}
        </button>
      </div>

      {results && (
        <div className="bg-card rounded-2xl border border-border p-6">
          {results.error ? (
            <p className="text-destructive text-sm">{results.error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-foreground">{REPORT_TYPES.find((r) => r.key === reportType)?.label}</h2>
                <p className="text-muted-foreground text-sm">{results.totalRows ?? results.rows?.length ?? 0} rows</p>
              </div>

              {results.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(results.summary).map(([key, val]) => (
                    <div key={key} className="bg-accent rounded-xl p-4">
                      <p className="text-display text-3xl font-black text-foreground">{val}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 capitalize">{labelise(key)}</p>
                    </div>
                  ))}
                </div>
              )}

              {results.rows?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(results.rows[0]).map((col) => (
                          <th key={col} className="text-left text-muted-foreground font-semibold text-xs uppercase tracking-wide py-2 pr-4 whitespace-nowrap">{labelise(col)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b border-border hover:bg-accent transition-colors">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="py-2 pr-4 text-foreground whitespace-nowrap">{val ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.rows.length > 100 && <p className="text-muted-foreground text-xs mt-3">Showing first 100 rows. Export CSV for full data.</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
