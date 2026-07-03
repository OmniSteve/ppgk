/**
 * Resend email integration.
 * Every send attempt writes/updates a notifications row.
 */
import { queryOne, execute } from './db.js';

/**
 * Send a transactional email via Resend.
 * Returns { success, resendId, error }.
 */
export async function sendEmail(env, { to, subject, html, notificationId }) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email send');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const fromAddress = 'Premier Performance GK <no-reply@premierperformancegk.com>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (notificationId) {
        await execute(env,
          "UPDATE notifications SET status='failed', error_message=?, sent_at=? WHERE id=?",
          [JSON.stringify(data), new Date().toISOString(), notificationId]
        );
      }
      return { success: false, error: data.message || 'Resend API error' };
    }

    if (notificationId) {
      await execute(env,
        "UPDATE notifications SET status='sent', sent_at=?, error_message=NULL WHERE id=?",
        [new Date().toISOString(), notificationId]
      );
    }

    return { success: true, resendId: data.id };
  } catch (e) {
    if (notificationId) {
      await execute(env,
        "UPDATE notifications SET status='failed', error_message=?, sent_at=? WHERE id=?",
        [e.message, new Date().toISOString(), notificationId]
      );
    }
    return { success: false, error: e.message };
  }
}

/**
 * Look up a template by event_trigger, interpolate variables, send, and log.
 * idempotencyRef prevents duplicate sends for the same event.
 */
export async function sendTemplatedEmail(env, {
  eventTrigger,
  to,
  userId,
  bookingId,
  sessionId,
  variables = {},
  idempotencyRef,
}) {
  // Check idempotency
  if (idempotencyRef) {
    const existing = await queryOne(env,
      "SELECT id, status FROM notifications WHERE idempotency_ref = ?",
      [idempotencyRef]
    );
    if (existing && existing.status === 'sent') {
      return { success: true, skipped: true };
    }
  }

  const template = await queryOne(env,
    "SELECT * FROM notification_templates WHERE event_trigger = ? AND active = 1",
    [eventTrigger]
  );

  if (!template) {
    console.warn(`No active template for event: ${eventTrigger}`);
    return { success: false, error: `No template for ${eventTrigger}` };
  }

  // Interpolate {{variable}} placeholders
  let subject = template.subject;
  let bodyHtml = template.body_html;
  for (const [key, val] of Object.entries(variables)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject  = subject.replace(re, String(val ?? ''));
    bodyHtml = bodyHtml.replace(re, String(val ?? ''));
  }

  // Create / update notification record
  let notifId;
  if (idempotencyRef) {
    const existing = await queryOne(env, "SELECT id FROM notifications WHERE idempotency_ref = ?", [idempotencyRef]);
    if (existing) {
      notifId = existing.id;
      await execute(env,
        "UPDATE notifications SET status='queued', error_message=NULL WHERE id=?",
        [notifId]
      );
    }
  }
  if (!notifId) {
    notifId = crypto.randomUUID();
    await execute(env,
      `INSERT INTO notifications (id, user_id, template_id, channel, recipient_email, subject, body_html, status, booking_id, session_id, idempotency_ref)
       VALUES (?, ?, ?, 'email', ?, ?, ?, 'queued', ?, ?, ?)`,
      [notifId, userId ?? null, template.id, to, subject, bodyHtml,
       bookingId ?? null, sessionId ?? null, idempotencyRef ?? null]
    );
  }

  return sendEmail(env, { to, subject, html: bodyHtml, notificationId: notifId });
}