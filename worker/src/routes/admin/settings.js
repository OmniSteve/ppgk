/**
 * Admin app settings.
 * GET /api/admin/settings  — returns all settings as a flat key:value object
 *                            (snake_case keys, values typed per data_type)
 * PUT /api/admin/settings  — upserts settings by key (key is the PRIMARY KEY,
 *                            so saving can never create duplicate rows)
 */
import { requireRole } from '../../lib/auth.js';
import { query, execute } from '../../lib/db.js';

/** true, 'true', 1, '1' → true; everything else → false. */
const parseBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

export async function handleAdminSettings(request, env) {
  await requireRole(request, env, 'admin');

  if (request.method === 'GET') {
    const rows = await query(env, 'SELECT key, value, data_type FROM app_settings', []);
    const settings = {};
    for (const row of rows) {
      if (row.data_type === 'boolean') {
        settings[row.key] = parseBool(row.value);
      } else if (row.data_type === 'number') {
        const n = Number(row.value);
        settings[row.key] = Number.isFinite(n) ? n : null;
      } else if (row.data_type === 'json') {
        try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
      } else {
        settings[row.key] = row.value ?? '';
      }
    }
    return Response.json(settings);
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const now  = new Date().toISOString();

    for (const [key, value] of Object.entries(body)) {
      // Infer data_type for brand-new keys only; existing rows keep theirs
      // (ON CONFLICT does not touch data_type).
      const dataType =
        typeof value === 'boolean' ? 'boolean' :
        typeof value === 'number'  ? 'number'  :
        value !== null && typeof value === 'object' ? 'json' : 'string';
      const stored =
        value === null || value === undefined ? '' :
        dataType === 'json' ? JSON.stringify(value) : String(value);
      await execute(env,
        `INSERT INTO app_settings (key, value, data_type, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, stored, dataType, now]
      );
    }

    return Response.json({ message: 'Settings saved' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
