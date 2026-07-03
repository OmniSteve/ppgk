/**
 * POST /api/auth/forgot-password
 *
 * Body: { email }
 * Always returns 200 to avoid email enumeration.
 * Generates a reset token, stores it, and triggers an email send.
 */
import { queryOne, execute } from '../../lib/db.js';

export async function handleForgotPassword(request, env) {
  const body = await request.json();
  const { email } = body;

  if (email) {
    const user = await queryOne(env, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (user) {
      const token   = crypto.randomUUID();
      const expires = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

      await execute(env,
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, user.id]
      );

      // TODO: Send password-reset email via Resend
      // await sendEmail(env, { to: email, subject: 'Reset your password', token })
      console.info(`Password reset token for ${email}: ${token}`);
    }
  }

  // Always respond the same way regardless of whether the email exists
  return Response.json({ message: 'If that email address is registered, a reset link has been sent.' });
}