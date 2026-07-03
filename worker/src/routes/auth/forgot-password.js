/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * - Always returns 200 (anti-enumeration)
 * - Stores single-use token with 1h expiry
 * - Sends reset email via Resend
 */
import { queryOne, execute } from '../../lib/db.js';
import { sendTemplatedEmail } from '../../lib/email.js';
import { ok } from '../../lib/validate.js';

export async function handleForgotPassword(request, env) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const { email } = body;
  const MSG = 'If that email address is registered, a reset link has been sent.';

  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const user = await queryOne(env, 'SELECT id, first_name FROM users WHERE email = ? AND active = 1', [email.toLowerCase()]);
    if (user) {
      const token   = crypto.randomUUID();
      const expires = new Date(Date.now() + 3600 * 1000).toISOString();

      await execute(env,
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, user.id]
      );

      const appUrl   = env.APP_URL || 'https://premierperformancegk.com';
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await sendTemplatedEmail(env, {
        eventTrigger:  'password_reset',
        to:             email,
        userId:         user.id,
        idempotencyRef: `password_reset_${user.id}_${token}`,
        variables:      { first_name: user.first_name, reset_url: resetUrl },
      });
    }
  }

  return ok({ message: MSG });
}