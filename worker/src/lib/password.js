/**
 * Shared PBKDF2 password hashing and verification utility.
 *
 * Stored format: pbkdf2:<saltHex>:<derivedHex>
 *   - algorithm : "pbkdf2"
 *   - saltHex   : 32 hex chars  (16 bytes)
 *   - derivedHex: 64 hex chars  (32 bytes / 256 bits)
 *
 * All existing hashes stored in D1 with this format remain valid.
 */

const ITERATIONS  = 100_000;
const HASH_ALG    = 'SHA-256';
const SALT_BYTES  = 16; // 32 hex chars
const KEY_BITS    = 256; // 64 hex chars
const DEV_LOGGING = false; // set true temporarily in dev to diagnose; never log secrets

/** Encode a Uint8Array to a lowercase hex string */
function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Decode a hex string to a Uint8Array — handles both upper and lowercase */
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Import a password string as a PBKDF2 key material */
function importKey(password) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
}

/**
 * Hash a plaintext password.
 * Returns: "pbkdf2:<saltHex>:<derivedHex>"
 */
export async function hashPassword(password) {
  const salt    = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const km      = await importKey(password);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALG },
    km,
    KEY_BITS
  );
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(derived))}`;
}

/**
 * Timing-safe comparison of two Uint8Arrays of equal length.
 * Returns true only if every byte matches.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verify a plaintext password against a stored hash string.
 * Returns true on match, false on any mismatch or parse error.
 */
export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split(':');

    if (DEV_LOGGING) {
      console.log('[password] parts count:', parts.length);
      console.log('[password] algorithm:', parts[0]);
      console.log('[password] saltHex length:', parts[1]?.length);
      console.log('[password] expectedHex length:', parts[2]?.length);
    }

    if (parts.length !== 3) return false;
    const [algorithm, saltHex, expectedHex] = parts;
    if (algorithm !== 'pbkdf2') return false;
    if (saltHex.length !== SALT_BYTES * 2) return false;   // 32 hex chars
    if (expectedHex.length !== (KEY_BITS / 8) * 2) return false; // 64 hex chars

    const salt        = fromHex(saltHex);
    const expectedKey = fromHex(expectedHex);

    const km      = await importKey(password);
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALG },
      km,
      KEY_BITS
    );
    const derivedBytes = new Uint8Array(derived);

    const match = timingSafeEqual(derivedBytes, expectedKey);

    if (DEV_LOGGING) {
      console.log('[password] salt bytes:', salt.length);
      console.log('[password] derived bytes:', derivedBytes.length);
      console.log('[password] expected bytes:', expectedKey.length);
      console.log('[password] match:', match);
    }

    return match;
  } catch (e) {
    console.error('[password] verifyPassword error:', e.message);
    return false;
  }
}

/**
 * Dummy verification for unknown users — runs the full PBKDF2 derivation
 * to keep timing indistinguishable from a real user lookup.
 * Always returns false.
 */
export async function dummyVerify(password) {
  const dummyHash = `pbkdf2:${'00'.repeat(SALT_BYTES)}:${'00'.repeat(KEY_BITS / 8)}`;
  await verifyPassword(password, dummyHash);
  return false;
}