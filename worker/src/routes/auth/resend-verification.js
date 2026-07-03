/**
 * POST /api/auth/resend-verification
 * Body: { email }
 *
 * Resends the email verification link for an unverified account.
 * Anti-enumeration: always returns 200 regardless of whether email exists.
 */
import { queryOne, execute } from '../../lib/db.js';
import { sendTemplatedEmail } from '../../lib/email.js';
import { ok } from '../../lib/validate.js';

const GENERIC_MSG = 'If that account exists and is unverified, a new verification email has been sent.';

export async function handleResendVerification(request, env) {
  let body;
  try { body = await request.json(); } catch { return ok({ message: GENERIC_MSG }); }

  const { email } = body;
  if (!email) return ok({ message: GENERIC_MSG });

  const user = await queryOne(env,
    'SELECT id, first_name, email_verified, email_verify_token FROM users WHERE email = ? AND active = 1',
    [email.toLowerCase()]
  );

  if (!user || user.email_verified) {
    // Anti-enumeration: don't reveal whether account exists or is already verified
    return ok({ message: GENERIC_MSG });
  }

  // Rotate the token so old links are invalidated
  const newToken = crypto.randomUUID();
  await execute(env, 'UPDATE users SET email_verify_token = ? WHERE id = ?', [newToken, user.id]);

  const appUrl    = env.APP_URL || 'https://ppgk.app';
  const verifyUrl = `${appUrl}/verify-email?token=${newToken}`;

  // Force a fresh send by using a unique idempotencyRef based on the new token
  let emailResult;
  try {
    emailResult = await sendTemplatedEmail(env, {
      eventTrigger:  'verify_email',
      to:             email,
      userId:         user.id,
      idempotencyRef: `verify_email_resend_${newToken}`,
      variables:      { first_name: user.first_name, verify_url: verifyUrl },
    });
  } catch (e) {
    emailResult = { success: false, error: e.message };
  }

  if (emailResult.success) {
    console.log(`[resend-verification] Sent to ${email}`);
  } else {
    console.error(`[resend-verification] Failed for ${email}: ${emailResult.error}`);
  }

  return ok({ message: GENERIC_MSG });
}