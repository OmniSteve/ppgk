/**
 * POST /api/auth/register
 * Body: { email, password, firstName, lastName, phone? }
 *
 * - PBKDF2 password hashing (100,000 iterations, SHA-256)
 * - Sends email verification via Resend
 * - Does NOT log the user in (must verify email first)
 *
 * Source file: worker/src/routes/auth/register.js
 * Email send: line ~67 via sendTemplatedEmail (worker/src/lib/email.js)
 * Sender address: 'Premier Performance GK <no-reply@premierperformancegk.com>'
 *   ↑ Must match a verified domain in your Resend account.
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { sendTemplatedEmail }       from '../../lib/email.js';
import { err, ok, requireFields }   from '../../lib/validate.js';
import { hashPassword }             from '../../lib/password.js';

export async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Request body must be valid JSON'); }

  const missing = requireFields(body, ['email', 'password', 'firstName', 'lastName']);
  if (missing) return err(missing);

  const { email, password, firstName, lastName, phone } = body;

  if (password.length < 8) return err('Password must be at least 8 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Invalid email address');

  const existing = await queryOne(env, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  // Anti-enumeration: return same message regardless
  if (existing) {
    return ok({ message: 'If that email is new, a verification link has been sent.' }, 201);
  }

  const passwordHash  = await hashPassword(password);
  const verifyToken   = crypto.randomUUID();
  const userId        = crypto.randomUUID();

  await execute(env,
    `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verify_token, active)
     VALUES (?, ?, ?, ?, ?, ?, 'client', ?, 1)`,
    [userId, email.toLowerCase(), passwordHash, firstName, lastName, phone ?? null, verifyToken]
  );
  await execute(env,
    `INSERT INTO client_profiles (id, user_id) VALUES (?, ?)`,
    [crypto.randomUUID(), userId]
  );

  await audit(env, {
    actorId:     userId,
    actorName:   `${firstName} ${lastName}`,
    action:      'create',
    recordType:  'user',
    recordId:    userId,
    description: `New client registered: ${email}`,
    ipAddress:   request.headers.get('CF-Connecting-IP'),
  });

  const appUrl    = env.APP_URL || 'https://ppgk.app';
  const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;

  // Send verification email and capture the result
  let emailResult;
  try {
    emailResult = await sendTemplatedEmail(env, {
      eventTrigger:  'verify_email',
      to:             email,
      userId,
      idempotencyRef: `verify_email_${userId}`,
      variables:      { first_name: firstName, verify_url: verifyUrl },
    });
  } catch (e) {
    emailResult = { success: false, error: e.message };
  }

  // Log outcome (no secrets logged)
  if (emailResult.success) {
    console.log(`[register] Verification email sent to ${email} (resendId: ${emailResult.resendId ?? 'n/a'})`);
  } else {
    console.error(`[register] Verification email FAILED for ${email}: ${emailResult.error ?? 'unknown'}`);
  }

  if (!emailResult.success) {
    return Response.json({
      accountCreated: true,
      emailSent: false,
      message: 'Your account was created, but we could not send the verification email. Please use Resend Verification Email.',
      error: emailResult.error ?? 'Email delivery failed',
    }, { status: 201 });
  }

  return ok({
    accountCreated: true,
    emailSent: true,
    message: 'Account created. Please check your email to verify your account, then sign in.',
  }, 201);
}