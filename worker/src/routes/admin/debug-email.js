/**
 * GET /api/admin/debug-email
 * Temporary diagnostic — checks Resend key + verify_email template, then sends a test email.
 * Remove this route after debugging.
 */
import { requireAdmin } from '../../lib/auth.js';
import { queryOne } from '../../lib/db.js';
import { sendEmail } from '../../lib/email.js';
import { corsHeaders } from '../../lib/cors.js';

export async function handleDebugEmail(request, env) {
  const authResult = await requireAdmin(request, env);
  if (authResult instanceof Response) return authResult;

  const checks = {};

  // 1. Check RESEND_API_KEY is present
  checks.resend_key_set = !!env.RESEND_API_KEY;
  checks.resend_key_prefix = env.RESEND_API_KEY ? env.RESEND_API_KEY.substring(0, 8) + '...' : 'NOT SET';

  // 2. Check verify_email template exists and is active
  const template = await queryOne(env,
    "SELECT id, event_trigger, active, subject FROM notification_templates WHERE event_trigger = 'verify_email'",
    []
  );
  checks.template_found = !!template;
  checks.template_active = template?.active === 1;
  checks.template_subject = template?.subject ?? null;

  // 3. Send a real test email to the admin
  const adminEmail = authResult.email;
  checks.test_email_to = adminEmail;

  const sendResult = await sendEmail(env, {
    to: adminEmail,
    subject: 'PPGK Email Debug Test',
    html: '<p>If you see this, Resend is working correctly from <strong>no-reply@ppgk.app</strong>.</p>',
  });

  checks.send_success = sendResult.success;
  checks.send_resend_id = sendResult.resendId ?? null;
  checks.send_error = sendResult.error ?? null;

  return Response.json({ checks }, {
    status: 200,
    headers: corsHeaders(request),
  });
}