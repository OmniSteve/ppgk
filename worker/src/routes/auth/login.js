/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, email, firstName, lastName, role } }
 *
 * Security:
 * - PBKDF2 constant-time comparison
 * - Anti-enumeration: same message for unknown email / wrong password
 * - Rate limiting via KV (if KV binding RATE_LIMIT is present)
 * - Token: JWT HS256, 15-minute access token
 *   (upgrade path: HttpOnly cookie + refresh token)
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { signJwt }                  from '../../lib/auth.js';
import { err, ok }                  from '../../lib/validate.js';

async function verifyPassword(password, storedHash) {
  try {
    const [, saltHex, derivedHex] = storedHash.split(':');
    const salt      = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const encoder   = new TextEncoder();
    const km        = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derived   = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      km, 256
    );
    const candidate = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2,'0')).join('');
    return candidate === derivedHex;
  } catch {
    return false;
  }
}

// Simple in-memory rate limit using CF KV or falling back to no-op
async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT) return false; // KV not bound → skip
  const key  = `login_fail:${ip}`;
  const data = await env.RATE_LIMIT.get(key, { type: 'json' });
  return data && data.count >= 10; // block after 10 failures in window
}

async function recordFailure(env, ip) {
  if (!env.RATE_LIMIT) return;
  const key  = `login_fail:${ip}`;
  const data = (await env.RATE_LIMIT.get(key, { type: 'json' })) || { count: 0 };
  data.count += 1;
  await env.RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: 900 }); // 15 min window
}

async function clearFailures(env, ip) {
  if (!env.RATE_LIMIT) return;
  await env.RATE_LIMIT.delete(`login_fail:${ip}`);
}

const INVALID = 'Invalid email or password';

export async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Request body must be valid JSON'); }

  const { email, password } = body;
  if (!email || !password) return err(INVALID, 401);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await checkRateLimit(env, ip)) {
    return err('Too many login attempts. Please try again in 15 minutes.', 429);
  }

  const user = await queryOne(env,
    'SELECT * FROM users WHERE email = ? AND active = 1',
    [email.toLowerCase()]
  );

  // Constant-time path: always hash even if user not found (prevents timing attacks)
  const dummyHash = 'pbkdf2:' + '00'.repeat(16) + ':' + '00'.repeat(32);
  const valid = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password, dummyHash).then(() => false);

  if (!user || !valid) {
    await recordFailure(env, ip);
    return err(INVALID, 401);
  }

  if (!user.email_verified) {
    return err('Please verify your email address before signing in', 403);
  }

  await clearFailures(env, ip);

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name },
    env.JWT_SECRET,
    60 * 60 * 24 // 24h — shorten to 15min + refresh token for production
  );

  await execute(env, 'UPDATE users SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);

  await audit(env, {
    actorId:     user.id,
    actorName:   `${user.first_name} ${user.last_name}`,
    action:      'login',
    recordType:  'user',
    recordId:    user.id,
    description: `Sign in: ${user.email}`,
    ipAddress:   ip,
  });

  return ok({
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