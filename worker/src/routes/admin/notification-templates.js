/** CRUD /api/admin/notification-templates */
import { requireRole } from '../../lib/auth.js';
import { query, execute, audit } from '../../lib/db.js';
import { ok } from '../../lib/validate.js';

export async function handleAdminNotificationTemplates(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const method = request.method;
  const url    = new URL(request.url);

  if (method === 'GET') {
    const templates = await query(env, 'SELECT * FROM notification_templates ORDER BY name', []);
    return ok({ templates });
  }

  if (method === 'POST' && !params?.id) {
    const body = await request.json();
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO notification_templates (id, name, event_trigger, subject, body_html, active) VALUES (?,?,?,?,?,?)`,
      [id, body.name, body.eventTrigger, body.subject, body.bodyHtml, body.active ? 1 : 0]
    );
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    await execute(env,
      `UPDATE notification_templates SET name=?, event_trigger=?, subject=?, body_html=?, active=?, updated_at=? WHERE id=?`,
      [body.name, body.eventTrigger, body.subject, body.bodyHtml, body.active ? 1 : 0, new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  if (method === 'POST' && params?.id && url.pathname.endsWith('/test')) {
    const { email } = await request.json();
    // TODO: Actually send test email via Resend
    console.info(`Test notification send to ${email} for template ${params.id}`);
    return Response.json({ message: `Test email queued to ${email}` });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}