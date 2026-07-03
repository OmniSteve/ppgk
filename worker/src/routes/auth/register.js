/**
 * POST /api/auth/register
 *
 * Body: { email, password, firstName, lastName, phone? }
 *
 * Creates a new user with role='client', sends email verification.
 * Returns: { message: 'Verification email sent' }
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { signJwt } from '../../lib/auth.js';

export async function handleRegister(request, env) {
  const body = await request.json();
  const { email, password, firstName, lastName, phone } = body;

  if (!email || !password || !firstName || !lastName) {
    return Response.json({ message: 'email, password, firstName and lastName are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Check for existing email
  const existing = await queryOne(env, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) {
    return Response.json({ message: 'An account with this email already exists' }, { status: 409 });
  }

  // Hash password using Web Crypto (PBKDF2)
  const passwordHash = await hashPassword(password);

  // Generate email verification token
  const verifyToken = crypto.randomUUID();

  const userId = crypto.randomUUID();

  await execute(env,
    `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verify_token)
     VALUES (?, ?, ?, ?, ?, ?, 'client', ?)`,
    [userId, email.toLowerCase(), passwordHash, firstName, lastName, phone || null, verifyToken]
  );

  // Create client profile
  await execute(env,
    `INSERT INTO client_profiles (id, user_id) VALUES (?, ?)`,
    [crypto.randomUUID(), userId]
  );

  // TODO: Send verification email via Resend / email worker
  // await sendEmail(env, { to: email, subject: 'Verify your email', ... })

  await audit(env, {
    actorId: userId,
    actorName: `${firstName} ${lastName}`,
    action: 'create',
    recordType: 'user',
    recordId: userId,
    description: `New client registered: ${email}`,
  });

  return Response.json({ message: 'Registration successful. Please check your email to verify your account.' }, { status: 201 });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltHex    = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const derivedHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${derivedHex}`;
}