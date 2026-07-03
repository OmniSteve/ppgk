/**
 * Admin app settings.
 * GET /api/admin/settings  — returns all settings as key:value object
 * PUT /api/admin/settings  — upserts all settings
 */
import { requireRole } from '../../lib/auth.js';
import { query, execute } from '../../lib/db.js';

export async function handleAdminSettings(request, env) {
  await requireRole(request, env, 'admin');

  if (request.method === 'GET') {
    const rows = await query(env, 'SELECT key, value, data_type FROM app_settings', []);
    const settings = {};
    for (const row of rows) {
      if (row.data_type === 'boolean') settings[row.key] = row.value === 'true';
      else if (row.data_type === 'number') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
    return Response.json(settings);
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const now  = new Date().toISOString();

    for (const [key, value] of Object.entries(body)) {
      await execute(env,
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, String(value), now]
      );
    }

    return Response.json({ message: 'Settings saved' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}