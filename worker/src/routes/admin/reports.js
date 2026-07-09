/** GET /api/admin/reports/:type */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { ok } from '../../lib/validate.js';

const REPORT_QUERIES = {
  bookings: {
    summary: async (env, f) => queryOne(env, `SELECT COUNT(*) as total_bookings, COALESCE(SUM(amount_charged),0) as total_revenue FROM bookings WHERE ${f.where}`, f.bindings),
    rows: (env, f) => query(env,
      `SELECT b.id, b.status, b.booked_at, b.amount_charged, b.credits_used,
              u.first_name || ' ' || u.last_name as client, p.first_name || ' ' || p.last_name as player,
              s.title as session, s.session_date
       FROM bookings b JOIN users u ON u.id = b.client_id JOIN players p ON p.id = b.player_id JOIN sessions s ON s.id = b.session_id
       WHERE ${f.where} ORDER BY s.session_date DESC LIMIT 500`, f.bindings),
  },
  attendance: {
    summary: async (env, f) => queryOne(env, `SELECT COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present, SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE ${f.where}`, f.bindings),
    rows: (env, f) => query(env,
      `SELECT a.status, a.recorded_at, p.first_name || ' ' || p.last_name as player, s.title as session, s.session_date
       FROM attendance a JOIN players p ON p.id = a.player_id JOIN sessions s ON s.id = a.session_id WHERE ${f.where} ORDER BY s.session_date DESC LIMIT 500`, f.bindings),
  },
  revenue: {
    summary: async (env, f) => queryOne(env, `SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) as total_paid, COALESCE(SUM(CASE WHEN status='refunded' THEN amount ELSE 0 END),0) as total_refunded FROM payments WHERE ${f.where}`, f.bindings),
    rows: (env, f) => query(env, `SELECT reference, amount, status, description, created_at FROM payments WHERE ${f.where} ORDER BY created_at DESC LIMIT 500`, f.bindings),
  },
};

function buildFilters(url) {
  const conditions = ['1=1'];
  const bindings   = [];
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  if (from) { conditions.push('s.session_date >= ?'); bindings.push(from); }
  if (to)   { conditions.push('s.session_date <= ?'); bindings.push(to); }
  return { where: conditions.join(' AND '), bindings };
}

export async function handleAdminReports(request, env, ctx, params) {
  await requireRole(request, env, 'admin', 'head_coach');
  const url   = new URL(request.url);
  const type  = params?.type;
  const handler = REPORT_QUERIES[type];

  if (!handler) {
    return Response.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  if (url.pathname.endsWith('/export')) {
    const filters = buildFilters(url);
    const rows    = await handler.rows(env, filters);
    if (!rows.length) return new Response('No data', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv     = [headers, ...csvRows].join('\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type}-report.csv"` } });
  }

  const filters = buildFilters(url);
  const [summaryRaw, rows] = await Promise.all([handler.summary(env, filters), handler.rows(env, filters)]);
  const summary = summaryRaw ? Object.fromEntries(Object.entries(summaryRaw).map(([k, v]) => [k, Number(v) === v ? Number(v).toFixed(2) : v])) : null;

  return ok({ summary, rows, totalRows: rows.length });
}