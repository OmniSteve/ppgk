/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 * Returns: { token, user: { id, email, firstName, lastName, role } }
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { signJwt } from '../../lib/auth.js';

export async function handleLogin(request, env) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return Response.json({ message: 'email and password are required' }, { status: 400 });
  }

  const user = await queryOne(env, 'SELECT * FROM users WHERE email = ? AND active = 1', [email.toLowerCase()]);

  if (!user) {
    return Response.json({ message: 'Invalid email or password' }, { status: 401 });
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return Response.json({ message: 'Invalid email or password' }, { status: 401 });
  }

  if (!user.email_verified) {
    return Response.json({ message: 'Please verify your email address before signing in' }, { status: 403 });
  }

  const tokenPayload = {
    sub:       user.id,
    email:     user.email,
    role:      user.role,
    firstName: user.first_name,
    lastName:  user.last_name,
  };

  const token = await signJwt(tokenPayload, env.JWT_SECRET, 60 * 60 * 24); // 24h

  // Update last_login_at
  await execute(env, 'UPDATE users SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);

  await audit(env, {
    actorId: user.id, actorName: `${user.first_name} ${user.last_name}`,
    action: 'login', recordType: 'user', recordId: user.id,
    description: `User signed in: ${user.email}`,
    ipAddress: request.headers.get('CF-Connecting-IP'),
  });

  return Response.json({
    token,
    user: {
      id:        user.id,
      email:     user.email,
      firstName: user.first_name,
      lastName:  user.last_name,
      role:      user.role,
    },
  });
}

async function verifyPassword(password, storedHash) {
  try {
    const [, saltHex, derivedHex] = storedHash.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const candidateHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return candidateHex === derivedHex;
  } catch {
    return false;
  }
}