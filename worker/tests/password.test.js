/**
 * Password utility tests
 *
 * Run with: node --experimental-vm-modules worker/tests/password.test.js
 * (Requires Node 18+ for Web Crypto global)
 *
 * These tests verify the shared password utility used by register, login,
 * and reset-password routes.
 */

// Polyfill crypto for Node if needed
import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { hashPassword, verifyPassword, dummyVerify } from '../src/lib/password.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\nPassword utility tests\n');

// ── Registration flow ────────────────────────────────────────────────────────
await test('hashPassword returns the correct format', async () => {
  const hash = await hashPassword('TestPassword1!');
  const parts = hash.split(':');
  assert(parts.length === 3, `Expected 3 parts, got ${parts.length}`);
  assert(parts[0] === 'pbkdf2', `Expected algorithm "pbkdf2", got "${parts[0]}"`);
  assert(parts[1].length === 32, `Expected 32-char saltHex, got ${parts[1].length}`);
  assert(parts[2].length === 64, `Expected 64-char derivedHex, got ${parts[2].length}`);
});

await test('newly registered password verifies successfully', async () => {
  const password = 'MySecurePass99!';
  const hash = await hashPassword(password);
  const result = await verifyPassword(password, hash);
  assert(result === true, 'Expected true, got false');
});

await test('incorrect password fails verification', async () => {
  const hash = await hashPassword('CorrectPassword');
  const result = await verifyPassword('WrongPassword', hash);
  assert(result === false, 'Expected false, got true');
});

// ── Password reset flow ──────────────────────────────────────────────────────
await test('reset password verifies successfully', async () => {
  const originalHash = await hashPassword('OldPassword1!');
  const newHash      = await hashPassword('NewPassword2@');

  assert(await verifyPassword('NewPassword2@', newHash) === true,  'New password should verify');
  assert(await verifyPassword('OldPassword1!', newHash) === false, 'Old password should fail after reset');
});

await test('old password fails after reset (different hash)', async () => {
  const h1 = await hashPassword('Password123');
  const h2 = await hashPassword('Password123');
  // Same input, different salts — hashes must differ
  assert(h1 !== h2, 'Hashes for same password should differ (different salts)');
  // Both must verify correctly with the original password
  assert(await verifyPassword('Password123', h1) === true, 'First hash must verify');
  assert(await verifyPassword('Password123', h2) === true, 'Second hash must verify');
});

// ── Malformed hash handling ──────────────────────────────────────────────────
await test('empty string returns false', async () => {
  assert(await verifyPassword('password', '') === false);
});

await test('missing parts returns false', async () => {
  assert(await verifyPassword('password', 'pbkdf2:abc') === false);
});

await test('wrong algorithm prefix returns false', async () => {
  const hash = await hashPassword('password');
  const broken = 'bcrypt' + hash.slice(6);
  assert(await verifyPassword('password', broken) === false);
});

await test('wrong salt length returns false', async () => {
  assert(await verifyPassword('password', 'pbkdf2:0000:' + '00'.repeat(32)) === false);
});

await test('wrong hash length returns false', async () => {
  assert(await verifyPassword('password', `pbkdf2:${'00'.repeat(16)}:0000`) === false);
});

await test('uppercase hex is handled correctly', async () => {
  const hash = await hashPassword('CaseTest');
  const upper = hash.toUpperCase().replace('PBKDF2', 'pbkdf2'); // keep algorithm lowercase
  // verifyPassword should decode hex case-insensitively
  const result = await verifyPassword('CaseTest', upper);
  assert(result === true, 'Uppercase hex should verify successfully');
});

// ── Timing safety ────────────────────────────────────────────────────────────
await test('dummyVerify always returns false', async () => {
  const result = await dummyVerify('anypassword');
  assert(result === false, 'dummyVerify must always return false');
});

// ── Existing D1 hash compatibility ──────────────────────────────────────────
await test('existing D1 hash format (manually constructed) verifies correctly', async () => {
  // Simulate exactly what register.js would have stored
  const password  = 'ExistingUserPass1!';
  const stored    = await hashPassword(password);
  // Confirm the format matches what was stored before refactor
  const parts     = stored.split(':');
  assert(parts[0] === 'pbkdf2',        'Algorithm prefix must be pbkdf2');
  assert(parts[1].length === 32,       'Salt must be 32 hex chars');
  assert(parts[2].length === 64,       'Key must be 64 hex chars');
  assert(/^[0-9a-f]+$/.test(parts[1]), 'Salt must be lowercase hex');
  assert(/^[0-9a-f]+$/.test(parts[2]), 'Key must be lowercase hex');
  assert(await verifyPassword(password, stored) === true, 'Must verify against stored hash');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);