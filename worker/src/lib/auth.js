/**
 * JWT-based authentication helpers for Cloudflare Worker.
 * Uses the Web Crypto API (available in Workers runtime).
 */

const ALG = { name: 'HMAC', hash: 'SHA-256' };

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALG,
    false,
    ['sign', 'verify']
  );
}

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64decode(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

export async function signJwt(payload, secret, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader  = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(ALG, key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key    = await getKey(secret);
  const sig    = b64decode(encodedSig);
  const valid  = await crypto.subtle.verify(ALG, key, sig, new TextEncoder().encode(signingInput));
  if (!valid) throw new Error('Invalid token signature');

  const payload = JSON.parse(new TextDecoder().decode(b64decode(encodedPayload)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return payload;
}

/**
 * Extract and verify the Bearer token from a request.
 * Returns the decoded payload or throws.
 */
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const token = authHeader.slice(7);
  return verifyJwt(token, env.JWT_SECRET);
}

/**
 * Like requireAuth but also asserts the user has the required role.
 */
export async function requireRole(request, env, ...roles) {
  const payload = await requireAuth(request, env);
  if (!roles.includes(payload.role)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return payload;
}