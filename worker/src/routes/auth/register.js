/**
 * POST /api/auth/register
 * Body: { email, password, firstName, lastName, phone? }
 *
 * - PBKDF2 password hashing (100,000 iterations, SHA-256)
 * - Creates the user, client_profile, and one active "account holder" player
 *   in a single D1 batch (all-or-nothing) so a client never ends up with an
 *   account but no player profile.
 * - Sends email verification via Resend
 * - Does NOT log the user in (must verify email first)
 *
 * Source file: worker/src/routes/auth/register.js
 * Email send: line ~80 via sendTemplatedEmail (worker/src/lib/email.js)
 * Sender address: 'Premier Performance GK <no-reply@premierperformancegk.com>'
 *   ↑ Must match a verified domain in your Resend account.
 */
import { queryOne, batch, audit }   from '../../lib/db.js';
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

  // User + client_profile + the client's own "account holder" player are
  // created as one D1 batch (all-or-nothing) — if any insert fails, none of
  // them are committed, so we never end up with a user and no player (or a
  // player without a user). The account-holder player is marked active and
  // is_account_holder=1; a partial unique index (migration 0005) guarantees
  // at most one such player per client even if this ever runs twice for the
  // same userId.
  try {
    await batch(env, [
      {
        sql: `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verify_token, active)
              VALUES (?, ?, ?, ?, ?, ?, 'client', ?, 1)`,
        params: [userId, email.toLowerCase(), passwordHash, firstName, lastName, phone ?? null, verifyToken],
      },
      {
        sql: `INSERT INTO client_profiles (id, user_id) VALUES (?, ?)`,
        params: [crypto.randomUUID(), userId],
      },
      {
        sql: `INSERT INTO players (id, client_id, first_name, last_name, status, is_account_holder)
              VALUES (?, ?, ?, ?, 'active', 1)`,
        params: [crypto.randomUUID(), userId, firstName, lastName],
      },
    ]);
  } catch (e) {
    // Most likely a concurrent registration for the same email racing past
    // the existence check above (UNIQUE constraint on users.email). Respond
    // the same anti-enumeration way rather than leaking which case it was.
    if (String(e?.message || '').toUpperCase().includes('UNIQUE')) {
      return ok({ message: 'If that email is new, a verification link has been sent.' }, 201);
    }
    console.error('[register] Account creation failed:', e);
    return err('Registration failed. Please try again.', 500);
  }

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