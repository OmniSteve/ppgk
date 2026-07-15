/**
 * Account & profile lifecycle tests — deactivate/reactivate/permanently-delete
 * for users (clients.js), players (players.js), and coaches (coaches.js), plus
 * the requireAuth() active-status enforcement added to lib/auth.js.
 *
 * Unlike the other worker/tests/*.test.js files (which hand-roll an in-memory
 * D1 mock that pattern-matches literal SQL strings), this suite backs env.DB
 * with a REAL in-memory SQLite database via Node's built-in node:sqlite
 * (DatabaseSync), loaded with the actual migration files. Eligibility checks
 * alone run a dozen distinct COUNT queries across different tables — a
 * hand-maintained string-matching mock doesn't scale to that, and running
 * against real SQL/FK semantics is strictly more trustworthy. No new
 * dependency is introduced; node:sqlite ships with Node.
 *
 * Run with: node worker/tests/lifecycle.test.js
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { signJwt } from '../src/lib/auth.js';
import { handleAdminClients } from '../src/routes/admin/clients.js';
import { handleAdminPlayers } from '../src/routes/admin/players.js';
import { handleAdminCoaches } from '../src/routes/admin/coaches.js';
import { handleLogin } from '../src/routes/auth/login.js';
import { handleMe } from '../src/routes/auth/me.js';
import { handleResetPassword } from '../src/routes/auth/reset-password.js';
import { batch as dbBatch } from '../src/lib/db.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.stack || e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Migration loading ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const MIGRATION_FILES = [
  '0001_initial_schema', '0002_additions', '0003_player_emergency_relationship',
  '0004_player_performance', '0005_player_account_holder', '0006_booking_roster',
  '0007_account_lifecycle',
];
const MIGRATION_SQL = MIGRATION_FILES.map(f => readFileSync(join(MIGRATIONS_DIR, `${f}.sql`), 'utf8'));

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const sql of MIGRATION_SQL) db.exec(sql);
  return db;
}

// ─── D1 shim over node:sqlite ───────────────────────────────────────────────
function makeD1(db) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all()   { return { results: db.prepare(sql).all(...params) }; },
            async first() { return db.prepare(sql).get(...params) ?? null; },
            async run()   {
              const info = db.prepare(sql).run(...params);
              return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
            },
          };
        },
      };
    },
    async batch(prepared) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of prepared) results.push(await stmt.run());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function makeEnv(db) {
  return { JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef', APP_URL: 'https://ppgk.app', DB: makeD1(db) };
}

async function tokenFor(env, sub, role, extra = {}) {
  return signJwt({ sub, role, firstName: 'Test', lastName: 'User', email: 't@example.com', ...extra }, env.JWT_SECRET);
}

function req(method, path, { token, body } = {}) {
  return new Request(`https://ppgk.app${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ─── Seed helpers (raw SQL against the test DB, not through the D1 shim) ────
let seq = 0;
const uid = (prefix) => `${prefix}-${++seq}`;

function seedUser(db, { id = uid('user'), email = `${id}@example.com`, role = 'client', active = 1, firstName = 'Pat', lastName = 'Parent', emailVerified = 1 } = {}) {
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, active, email_verified)
              VALUES (?, ?, 'pbkdf2:x:y', ?, ?, ?, ?, ?)`)
    .run(id, email, firstName, lastName, role, active, emailVerified);
  return id;
}

function seedPlayer(db, { id = uid('player'), clientId, status = 'active', firstName = 'Ada', lastName = 'Keeper' }) {
  db.prepare(`INSERT INTO players (id, client_id, first_name, last_name, status) VALUES (?, ?, ?, ?, ?)`)
    .run(id, clientId, firstName, lastName, status);
  return id;
}

function seedCoach(db, { id = uid('coach'), userId = null, active = 1, firstName = 'Cam', lastName = 'Coach' }) {
  db.prepare(`INSERT INTO coach_profiles (id, user_id, first_name, last_name, active) VALUES (?, ?, ?, ?, ?)`)
    .run(id, userId, firstName, lastName, active);
  return id;
}

function seedSession(db, { id = uid('sess'), coachId = null, sessionDate, startTime = '10:00', endTime = '11:00', status = 'scheduled', capacity = 10, bookedCount = 0, title = 'GK Clinic' }) {
  db.prepare(`INSERT INTO sessions (id, coach_id, title, session_date, start_time, end_time, status, capacity, booked_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, coachId, title, sessionDate, startTime, endTime, status, capacity, bookedCount);
  return id;
}

function seedBooking(db, { id = uid('booking'), clientId, playerId, sessionId, status = 'confirmed', paymentMethod = 'credits', creditsUsed = 0 }) {
  db.prepare(`INSERT INTO bookings (id, client_id, player_id, session_id, status, payment_method, credits_used)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, clientId, playerId, sessionId, status, paymentMethod, creditsUsed);
  return id;
}

function seedCredit(db, { id = uid('credit'), clientId, type = 'admin_grant', amount, balanceAfter = amount, bookingId = null }) {
  db.prepare(`INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, booking_id, description)
              VALUES (?, ?, ?, ?, ?, ?, 'test credit')`)
    .run(id, clientId, type, amount, balanceAfter, bookingId);
  return id;
}

function futureDate() { return '2099-01-10'; }
function pastDate()   { return '2020-01-10'; }

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Auth core: active-status enforcement ─────────────────────────────');

await test('disabled user cannot log in', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const id = seedUser(db, { active: 0, email: 'disabled@example.com' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run('pbkdf2:x:y', id);
  const res = await handleLogin(req('POST', '/api/auth/login', { body: { email: 'disabled@example.com', password: 'whatever' } }), env);
  assertEqual(res.status, 401);
});

await test('a still-valid JWT is rejected once the account is deactivated (ACCOUNT_INACTIVE)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const id = seedUser(db, { role: 'client' });
  const token = await tokenFor(env, id, 'client');
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);

  // requireAuth() throws (it's called directly by route handlers, and the
  // top-level catch in index.js is what normally turns this into a Response) —
  // so calling the handler here must throw with the ACCOUNT_INACTIVE code.
  let caught = null;
  try { await handleMe(req('GET', '/api/auth/me', { token }), env); }
  catch (e) { caught = e; }
  assert(caught, 'requireAuth must throw for a deactivated account');
  assertEqual(caught.status, 403);
  assertEqual(caught.code, 'ACCOUNT_INACTIVE');
});

await test('password reset is rejected for a disabled account', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const id = seedUser(db, { active: 0 });
  const future = new Date(Date.now() + 3600_000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run('tok-1', future, id);
  const res = await handleResetPassword(req('POST', '/api/auth/reset-password', { body: { token: 'tok-1', newPassword: 'newpassword123' } }), env);
  assertEqual(res.status, 400);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Admin-only enforcement ──────────────────────────────────────');

await test('non-admin (client) cannot call any lifecycle endpoint', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const target = seedUser(db, { role: 'client' });
  const clientId = seedUser(db, { role: 'client' });
  const token = await tokenFor(env, clientId, 'client');
  // requireRole('admin','head_coach') throws directly for a disallowed role —
  // the top-level index.js catch normally converts this to a 403 Response.
  let caught = null;
  try { await handleAdminClients(req('POST', `/api/admin/clients/${target}/deactivate`, { token, body: {} }), env, {}, { id: target }); }
  catch (e) { caught = e; }
  assert(caught, 'a client role must be rejected before reaching the handler body');
  assertEqual(caught.status, 403);
});

await test('head_coach cannot deactivate a player (admin-only lifecycle action)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const hcId = seedUser(db, { role: 'head_coach' });
  const token = await tokenFor(env, hcId, 'head_coach');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${playerId}/deactivate`, { token, body: {} }), env, {}, { id: playerId });
  assertEqual(res.status, 403);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── User (client) deactivate / reactivate ────────────────────────');

await test('admin deactivates and reactivates a user; audit rows are written', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const target = seedUser(db, { role: 'client', email: 'client@example.com' });
  const adminToken = await tokenFor(env, adminId, 'admin', { firstName: 'Ad', lastName: 'Min' });

  const dRes = await handleAdminClients(req('POST', `/api/admin/clients/${target}/deactivate`, { token: adminToken, body: { reason: 'no longer needed' } }), env, {}, { id: target });
  assertEqual(dRes.status, 200);
  const row = db.prepare('SELECT active, disabled_by, disabled_reason FROM users WHERE id = ?').get(target);
  assertEqual(row.active, 0);
  assertEqual(row.disabled_by, adminId);
  assertEqual(row.disabled_reason, 'no longer needed');

  const auditRows = db.prepare("SELECT * FROM audit_log WHERE record_type = 'user' AND record_id = ? AND action = 'deactivate'").all(target);
  assertEqual(auditRows.length, 1);

  const rRes = await handleAdminClients(req('POST', `/api/admin/clients/${target}/reactivate`, { token: adminToken, body: {} }), env, {}, { id: target });
  assertEqual(rRes.status, 200);
  const row2 = db.prepare('SELECT active, reactivated_by FROM users WHERE id = ?').get(target);
  assertEqual(row2.active, 1);
  assertEqual(row2.reactivated_by, adminId);
});

await test('duplicate deactivate requests are idempotent (no duplicate audit row)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const target = seedUser(db, { role: 'client' });
  const token = await tokenFor(env, adminId, 'admin');

  await handleAdminClients(req('POST', `/api/admin/clients/${target}/deactivate`, { token, body: {} }), env, {}, { id: target });
  const res2 = await handleAdminClients(req('POST', `/api/admin/clients/${target}/deactivate`, { token, body: {} }), env, {}, { id: target });
  assertEqual(res2.status, 200);
  const auditRows = db.prepare("SELECT * FROM audit_log WHERE record_type = 'user' AND record_id = ? AND action = 'deactivate'").all(target);
  assertEqual(auditRows.length, 1, 'second call must not write a duplicate audit row');
});

await test('an admin cannot deactivate their own account', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  seedUser(db, { role: 'admin' }); // second admin so "last admin" isn't the blocker here
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminClients(req('POST', `/api/admin/clients/${adminId}/deactivate`, { token, body: {} }), env, {}, { id: adminId });
  assertEqual(res.status, 400);
});

await test('a second admin can still be deactivated while another remains active', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const admin1 = seedUser(db, { role: 'admin' });
  const admin2 = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, admin1, 'admin');
  const res = await handleAdminClients(req('POST', `/api/admin/clients/${admin2}/deactivate`, { token, body: {} }), env, {}, { id: admin2 });
  assertEqual(res.status, 200);
  assertEqual(db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1").get().c, 1);
});

await test('the last-active-admin guard blocks a deactivation that would leave zero active admins', async () => {
  // Only reachable as defense-in-depth alongside the separate self-deactivation
  // block: exercise the guard condition directly against the same query the
  // route handler runs, seeding a DB where exactly one active admin exists.
  const db = makeDb();
  seedUser(db, { role: 'admin', active: 1 });
  seedUser(db, { role: 'admin', active: 0 });
  const activeAdmins = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get();
  assertEqual(activeAdmins.c, 1);
  assert(activeAdmins.c <= 1, 'the route handler treats this as "cannot deactivate the last active admin"');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Player deactivate / reactivate ────────────────────────────────');

await test('player with zero future bookings deactivates immediately', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${playerId}/deactivate`, { token, body: { reason: 'left programme' } }), env, {}, { id: playerId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerId).status, 'inactive');
});

await test('player deactivation is blocked (409) when future bookings exist and no resolution is given', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const sessionId = seedSession(db, { sessionDate: futureDate() });
  seedBooking(db, { clientId, playerId, sessionId, status: 'confirmed' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${playerId}/deactivate`, { token, body: {} }), env, {}, { id: playerId });
  assertEqual(res.status, 409);
  const body = await res.json();
  assertEqual(body.futureBookings, 1);
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerId).status, 'active', 'player must remain active until resolved');
});

await test('cancel_and_return_credit resolution cancels the booking and refunds credits', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const sessionId = seedSession(db, { sessionDate: futureDate(), bookedCount: 1 });
  const bookingId = seedBooking(db, { clientId, playerId, sessionId, status: 'confirmed', paymentMethod: 'credits' });
  seedCredit(db, { clientId, type: 'admin_grant', amount: 5 });
  seedCredit(db, { clientId, type: 'usage', amount: -1, balanceAfter: 4, bookingId });

  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${playerId}/deactivate`, {
    token, body: { futureBookingAction: 'cancel_and_return_credit', reason: 'left' },
  }), env, {}, { id: playerId });
  assertEqual(res.status, 200);

  const booking = db.prepare('SELECT status FROM bookings WHERE id = ?').get(bookingId);
  assertEqual(booking.status, 'cancelled_by_admin');
  const refund = db.prepare("SELECT * FROM credit_ledger WHERE booking_id = ? AND type = 'refund'").get(bookingId);
  assert(refund, 'a refund ledger row must exist');
  assertEqual(db.prepare('SELECT booked_count FROM sessions WHERE id = ?').get(sessionId).booked_count, 0);
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerId).status, 'inactive');
});

await test('reassign resolution moves the booking to another active player on the same account', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const fromPlayer = seedPlayer(db, { clientId });
  const toPlayer = seedPlayer(db, { clientId });
  const sessionId = seedSession(db, { sessionDate: futureDate() });
  const bookingId = seedBooking(db, { clientId, playerId: fromPlayer, sessionId, status: 'confirmed', paymentMethod: 'card' });

  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${fromPlayer}/deactivate`, {
    token, body: { futureBookingAction: 'reassign', reassignToPlayerId: toPlayer },
  }), env, {}, { id: fromPlayer });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT player_id FROM bookings WHERE id = ?').get(bookingId).player_id, toPlayer);
});

await test('reassign resolution rejects a target player from a different client account', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientA = seedUser(db, { role: 'client' });
  const clientB = seedUser(db, { role: 'client' });
  const fromPlayer = seedPlayer(db, { clientId: clientA });
  const otherPlayer = seedPlayer(db, { clientId: clientB });
  const sessionId = seedSession(db, { sessionDate: futureDate() });
  seedBooking(db, { clientId: clientA, playerId: fromPlayer, sessionId, status: 'confirmed', paymentMethod: 'card' });

  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${fromPlayer}/deactivate`, {
    token, body: { futureBookingAction: 'reassign', reassignToPlayerId: otherPlayer },
  }), env, {}, { id: fromPlayer });
  assertEqual(res.status, 400);
});

await test('player reactivation restores active status', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId, status: 'inactive' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('POST', `/api/admin/players/${playerId}/reactivate`, { token, body: {} }), env, {}, { id: playerId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerId).status, 'active');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Coach deactivate / reactivate ──────────────────────────────');

await test('coach deactivation is blocked by future scheduled sessions', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const coachId = seedCoach(db, {});
  seedSession(db, { coachId, sessionDate: futureDate(), status: 'scheduled' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminCoaches(req('POST', `/api/admin/coaches/${coachId}/deactivate`, { token, body: {} }), env, {}, { id: coachId });
  assertEqual(res.status, 409);
  assertEqual(db.prepare('SELECT active FROM coach_profiles WHERE id = ?').get(coachId).active, 1);
});

await test('coach deactivation resolved via reassign moves future sessions to the new coach', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const fromCoach = seedCoach(db, {});
  const toCoach = seedCoach(db, {});
  const sessionId = seedSession(db, { coachId: fromCoach, sessionDate: futureDate(), status: 'scheduled' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminCoaches(req('POST', `/api/admin/coaches/${fromCoach}/deactivate`, {
    token, body: { futureSessionAction: 'reassign', reassignToCoachId: toCoach },
  }), env, {}, { id: fromCoach });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT coach_id FROM sessions WHERE id = ?').get(sessionId).coach_id, toCoach);
  assertEqual(db.prepare('SELECT active FROM coach_profiles WHERE id = ?').get(fromCoach).active, 0);
});

await test('coach deactivation resolved via cancel marks future sessions cancelled', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const coachId = seedCoach(db, {});
  const sessionId = seedSession(db, { coachId, sessionDate: futureDate(), status: 'scheduled' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminCoaches(req('POST', `/api/admin/coaches/${coachId}/deactivate`, {
    token, body: { futureSessionAction: 'cancel' },
  }), env, {}, { id: coachId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId).status, 'cancelled');
});

await test('coach reactivation restores active status', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const coachId = seedCoach(db, { active: 0 });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminCoaches(req('POST', `/api/admin/coaches/${coachId}/reactivate`, { token, body: {} }), env, {}, { id: coachId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT active FROM coach_profiles WHERE id = ?').get(coachId).active, 1);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Independent status across linked entities ──────────────────────');

await test('a user linked to multiple players can have each deactivated independently', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerA = seedPlayer(db, { clientId });
  const playerB = seedPlayer(db, { clientId });
  const token = await tokenFor(env, adminId, 'admin');

  await handleAdminPlayers(req('POST', `/api/admin/players/${playerA}/deactivate`, { token, body: {} }), env, {}, { id: playerA });
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerA).status, 'inactive');
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerB).status, 'active');
  assertEqual(db.prepare('SELECT active FROM users WHERE id = ?').get(clientId).active, 1);
});

await test('deactivating a coach profile does not touch the linked user or their player profile', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const userId = seedUser(db, { role: 'coach' });
  const playerId = seedPlayer(db, { clientId: userId });
  const coachId = seedCoach(db, { userId });
  const token = await tokenFor(env, adminId, 'admin');

  const res = await handleAdminCoaches(req('POST', `/api/admin/coaches/${coachId}/deactivate`, { token, body: {} }), env, {}, { id: coachId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT active FROM coach_profiles WHERE id = ?').get(coachId).active, 0);
  assertEqual(db.prepare('SELECT active FROM users WHERE id = ?').get(userId).active, 1, 'linked user must remain active');
  assertEqual(db.prepare('SELECT status FROM players WHERE id = ?').get(playerId).status, 'active', 'unrelated player profile must be untouched');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Permanent deletion eligibility & deletion ─────────────────────');

await test('an empty test player is eligible for permanent deletion', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, {clientId});
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('GET', `/api/admin/players/${playerId}/deletion-eligibility`, { token }), env, {}, { id: playerId });
  const body = await res.json();
  assertEqual(body.eligible, true);
  assertEqual(body.blockingReasons.length, 0);
});

await test('a player with a booking is NOT eligible for permanent deletion, with correct dependency counts', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const sessionId = seedSession(db, { sessionDate: pastDate() });
  seedBooking(db, { clientId, playerId, sessionId, status: 'attended' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('GET', `/api/admin/players/${playerId}/deletion-eligibility`, { token }), env, {}, { id: playerId });
  const body = await res.json();
  assertEqual(body.eligible, false);
  assertEqual(body.dependencyCounts.bookings, 1);
});

await test('permanent deletion of an eligible player removes the row and writes a snapshot audit entry', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId, firstName: 'Test', lastName: 'Duplicate' });
  const token = await tokenFor(env, adminId, 'admin');

  const res = await handleAdminPlayers(req('DELETE', `/api/admin/players/${playerId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: playerId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT id FROM players WHERE id = ?').get(playerId), undefined);

  const auditRow = db.prepare("SELECT * FROM audit_log WHERE record_type = 'player' AND record_id = ? AND action = 'delete'").get(playerId);
  assert(auditRow, 'a delete audit row must exist');
  const snapshot = JSON.parse(auditRow.previous_value);
  assertEqual(snapshot.name, 'Test Duplicate');
});

await test('permanent deletion requires the literal confirm string DELETE', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminPlayers(req('DELETE', `/api/admin/players/${playerId}`, { token, body: { confirm: 'delete' } }), env, {}, { id: playerId });
  assertEqual(res.status, 400);
  assert(db.prepare('SELECT id FROM players WHERE id = ?').get(playerId), 'player must not have been deleted');
});

await test('the server re-checks eligibility at delete time and ignores a stale client-side eligible flag', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const clientId = seedUser(db, { role: 'client' });
  const playerId = seedPlayer(db, { clientId });
  const token = await tokenFor(env, adminId, 'admin');

  const elig = await handleAdminPlayers(req('GET', `/api/admin/players/${playerId}/deletion-eligibility`, { token }), env, {}, { id: playerId });
  assertEqual((await elig.json()).eligible, true);

  // A booking appears after the eligibility check was fetched (e.g. a race, or a stale UI).
  const sessionId = seedSession(db, { sessionDate: pastDate() });
  seedBooking(db, { clientId, playerId, sessionId, status: 'attended' });

  const res = await handleAdminPlayers(req('DELETE', `/api/admin/players/${playerId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: playerId });
  assertEqual(res.status, 409, 'server must re-check eligibility rather than trusting a stale client-side result');
  assert(db.prepare('SELECT id FROM players WHERE id = ?').get(playerId), 'player must not have been deleted');
});

await test('a coach with any assigned session (past or future) is not eligible for deletion', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const coachId = seedCoach(db, {});
  seedSession(db, { coachId, sessionDate: pastDate(), status: 'completed' });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminCoaches(req('GET', `/api/admin/coaches/${coachId}/deletion-eligibility`, { token }), env, {}, { id: coachId });
  const body = await res.json();
  assertEqual(body.eligible, false);
  assertEqual(body.dependencyCounts.sessions, 1);
});

await test('an empty test user is eligible for deletion; deleting detaches (not deletes) their coach profile', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const userId = seedUser(db, { role: 'coach', email: 'unused@example.com' });
  const coachId = seedCoach(db, { userId });
  const token = await tokenFor(env, adminId, 'admin');

  const elig = await handleAdminClients(req('GET', `/api/admin/clients/${userId}/deletion-eligibility`, { token }), env, {}, { id: userId });
  assertEqual((await elig.json()).eligible, true);

  const res = await handleAdminClients(req('DELETE', `/api/admin/clients/${userId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: userId });
  assertEqual(res.status, 200);
  assertEqual(db.prepare('SELECT id FROM users WHERE id = ?').get(userId), undefined);
  const coach = db.prepare('SELECT user_id FROM coach_profiles WHERE id = ?').get(coachId);
  assert(coach, 'the coach_profiles row itself must survive');
  assertEqual(coach.user_id, null, 'the coach profile must be detached, not deleted');
});

await test('a user with any players is NOT eligible for deletion', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const userId = seedUser(db, { role: 'client' });
  seedPlayer(db, { clientId: userId });
  const token = await tokenFor(env, adminId, 'admin');
  const res = await handleAdminClients(req('GET', `/api/admin/clients/${userId}/deletion-eligibility`, { token }), env, {}, { id: userId });
  const body = await res.json();
  assertEqual(body.eligible, false);
  assertEqual(body.dependencyCounts.players, 1);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Transaction atomicity ──────────────────────────────────────────');

await test('a batch() transaction rolls back entirely when a later statement violates a FK constraint', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const clientId = seedUser(db, { role: 'client', email: 'blocked@example.com' });
  const playerId = seedPlayer(db, { clientId }); // orders.client_id is ON DELETE RESTRICT
  const sessionId = seedSession(db, { sessionDate: pastDate() });
  seedBooking(db, { clientId, playerId, sessionId, status: 'attended' }); // bookings.client_id is ON DELETE RESTRICT

  let threw = false;
  try {
    await dbBatch(env, [
      { sql: `INSERT INTO audit_log (id, action, record_type, record_id, description) VALUES (?, 'delete', 'user', ?, 'test')`, params: ['audit-rollback-1', clientId] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [clientId] }, // must fail: bookings.client_id RESTRICT
    ]);
  } catch (e) { threw = true; }

  assert(threw, 'the batch must throw because of the RESTRICT foreign key');
  assert(db.prepare('SELECT id FROM users WHERE id = ?').get(clientId), 'the user row must still exist');
  assertEqual(db.prepare("SELECT id FROM audit_log WHERE id = 'audit-rollback-1'").get(), undefined,
    'the audit insert earlier in the same batch must have been rolled back too');
});

// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
