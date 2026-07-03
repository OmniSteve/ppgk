/**
 * POST /api/auth/register
 * Body: { email, password, firstName, lastName, phone? }
 *
 * - PBKDF2 password hashing (100,000 iterations, SHA-256)
 * - Sends email verification via Resend
 * - Does NOT log the user in (must verify email first)
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { sendTemplatedEmail }       from '../../lib/email.js';
import { err, ok, requireFields }   from '../../lib/validate.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const km      = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    km, 256
  );
  const saltHex    = Array.from(salt).map(b => b.toString(16).padStart(2,'0')).join('');
  const derivedHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2,'0')).join('');
  return `pbkdf2:${saltHex}:${derivedHex}`;
}

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

  const appUrl    = env.APP_URL || 'https://premierperformancegk.com';
  const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;

  await sendTemplatedEmail(env, {
    eventTrigger:  'verify_email',
    to:             email,
    userId,
    idempotencyRef: `verify_email_${userId}`,
    variables:      { first_name: firstName, verify_url: verifyUrl },
  });

  await audit(env, {
    actorId:     userId,
    actorName:   `${firstName} ${lastName}`,
    action:      'create',
    recordType:  'user',
    recordId:    userId,
    description: `New client registered: ${email}`,
    ipAddress:   request.headers.get('CF-Connecting-IP'),
  });

  return ok({ message: 'If that email is new, a verification link has been sent.' }, 201);
}