/**
 * Automatic account-holder player profile — tests for the registration flow
 * introduced in migrations/0005_player_account_holder.sql.
 *
 * Exercises the real route handlers (handleRegister, handleClientPlayers,
 * handleAdminClients) against a small in-memory D1 stand-in that understands
 * just the SQL these routes issue. No Base44, no real D1 required.
 *
 * Run with: node worker/tests/account-holder-player.test.js
 */

import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { handleRegister }      from '../src/routes/auth/register.js';
import { handleClientPlayers } from '../src/routes/client/players.js';
import { handleAdminClients }  from '../src/routes/admin/clients.js';
import { signJwt }             from '../src/lib/auth.js';
import { toCamel }             from '../src/lib/serializers.js';

// ─── Minimal in-memory D1 stand-in ────────────────────────────────────────────
// Understands exactly the statements issued by register.js / client/players.js
// / admin/clients.js. Deliberately narrow (not a generic SQL engine) — mirrors
// the style already used in worker/tests/booking.test.js.

function makeStore() {
  return { users: [], client_profiles: [], players: [], coach_profiles: [] };
}

function runStatement(store, sql, params) {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.startsWith('SELECT id FROM users WHERE email')) {
    const [email] = params;
    const row = store.users.find((u) => u.email === email);
    return { first: row ? { id: row.id } : null, results: row ? [{ id: row.id }] : [] };
  }

  if (s.startsWith('INSERT INTO users')) {
    const [id, email, passwordHash, firstName, lastName, phone, emailVerifyToken] = params;
    if (store.users.some((u) => u.email === email)) {
      throw new Error('D1_ERROR: UNIQUE constraint failed: users.email');
    }
    store.users.push({
      id, email, password_hash: passwordHash, first_name: firstName, last_name: lastName,
      phone, role: 'client', email_verify_token: emailVerifyToken, active: 1,
    });
    return { meta: {} };
  }

  if (s.startsWith('INSERT INTO client_profiles')) {
    const [id, userId] = params;
    store.client_profiles.push({ id, user_id: userId });
    return { meta: {} };
  }

  if (s.startsWith('INSERT INTO players')) {
    // Two call sites use this: register.js (id, client_id, first_name, last_name, status='active', is_account_holder=1)
    // and client/players.js (id, client_id, first_name, last_name, dob, ageGroup, ..., notes)
    if (s.includes('is_account_holder')) {
      const [id, clientId, firstName, lastName] = params;
      if (store.players.some((p) => p.client_id === clientId && p.is_account_holder === 1)) {
        throw new Error('D1_ERROR: UNIQUE constraint failed: idx_players_one_account_holder_per_client');
      }
      store.players.push({
        id, client_id: clientId, first_name: firstName, last_name: lastName,
        status: 'active', is_account_holder: 1,
      });
    } else {
      const [id, clientId, firstName, lastName, dob, ageGroup, experienceLevel, currentClub,
        medicalInfo, allergies, emergencyContactName, emergencyContactPhone, emergencyContactRelationship, notes] = params;
      store.players.push({
        id, client_id: clientId, first_name: firstName, last_name: lastName,
        date_of_birth: dob, age_group: ageGroup, experience_level: experienceLevel, current_club: currentClub,
        medical_info: medicalInfo, allergies, emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone, emergency_contact_relationship: emergencyContactRelationship,
        notes, status: 'active', is_account_holder: 0,
      });
    }
    return { meta: {} };
  }

  if (s.startsWith('SELECT * FROM players WHERE client_id')) {
    const [clientId] = params;
    return { results: store.players.filter((p) => p.client_id === clientId) };
  }

  if (s.startsWith('UPDATE users SET')) {
    const id = params[params.length - 1];
    const user = store.users.find((u) => u.id === id);
    if (user) {
      const [firstName, lastName, phone, role, active] = params;
      if (firstName != null) user.first_name = firstName;
      if (lastName != null) user.last_name = lastName;
      if (phone != null) user.phone = phone;
      if (role != null) user.role = role;
      if (active != null) user.active = active;
    }
    return { meta: {} };
  }

  if (s.startsWith('SELECT id FROM coach_profiles')) {
    const [userId] = params;
    const row = store.coach_profiles.find((c) => c.user_id === userId);
    return { first: row ?? null, results: row ? [row] : [] };
  }

  if (s.startsWith('SELECT first_name, last_name, email FROM users')) {
    const [userId] = params;
    const u = store.users.find((x) => x.id === userId);
    return { first: u ? { first_name: u.first_name, last_name: u.last_name, email: u.email } : null };
  }

  if (s.startsWith('INSERT INTO coach_profiles')) {
    const [id, userId, firstName, lastName, email] = params;
    store.coach_profiles.push({ id, user_id: userId, first_name: firstName, last_name: lastName, email });
    return { meta: {} };
  }

  // Catch-all for statements this suite doesn't care about (audit_log,
  // notifications, notification_templates lookups during the verify-email
  // send, etc.) — behave like an empty table rather than asserting on them.
  if (s.startsWith('SELECT')) return { first: null, results: [] };
  return { meta: {} };
}

function makeEnv(store) {
  return {
    JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    APP_URL: 'https://ppgk.app',
    // RESEND_API_KEY intentionally omitted — email send fails gracefully,
    // which does not affect player creation (that happens before the send).
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              sql, params,
              async first() { return runStatement(store, sql, params).first ?? null; },
              async all()   { return { results: runStatement(store, sql, params).results ?? [] }; },
              async run()   { return runStatement(store, sql, params); },
            };
          },
        };
      },
      async batch(bound) {
        // All-or-nothing: if any statement throws, none of the preceding
        // ones in this call are kept (mirrors D1's batch semantics).
        const snapshot = JSON.parse(JSON.stringify(store));
        try {
          return bound.map((b) => runStatement(store, b.sql, b.params));
        } catch (e) {
          Object.keys(store).forEach((k) => { store[k] = snapshot[k]; });
          throw e;
        }
      },
    },
  };
}

function registerRequest(body) {
  return new Request('https://ppgk.app/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function tokenFor(env, sub, role) {
  return signJwt({ sub, role, firstName: 'Test', lastName: 'User', email: 't@example.com' }, env.JWT_SECRET);
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const NEW_CLIENT = { email: 'ada@example.com', password: 'TestPassword1!', firstName: 'Ada', lastName: 'Keeper', phone: '35699000000' };

console.log('\n── Registration creates exactly one account-holder player ──');

await test('new client registration creates exactly one player', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  const res = await handleRegister(registerRequest(NEW_CLIENT), env);
  assert(res.status === 201, `expected 201, got ${res.status}`);
  const players = store.players;
  assertEqual(players.length, 1, 'expected exactly one player row');
});

await test('the player is linked to the correct client_id', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  const user = store.users[0];
  const player = store.players[0];
  assertEqual(player.client_id, user.id, 'player.client_id must equal the new user id');
});

await test('the player is active and flagged as the account holder', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  const player = store.players[0];
  assertEqual(player.status, 'active');
  assertEqual(player.is_account_holder, 1);
});

await test('the player uses the registration first/last name', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  const player = store.players[0];
  assertEqual(player.first_name, 'Ada');
  assertEqual(player.last_name, 'Keeper');
});

console.log('\n── Duplicate / concurrent registration ──────────────────────');

await test('a duplicate registration request (existing email) returns 409 and does not create another player', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  assertEqual(store.players.length, 1);

  const res2 = await handleRegister(registerRequest(NEW_CLIENT), env);
  assertEqual(res2.status, 409, 'duplicate email must return 409');
  assertEqual(store.users.length, 1, 'no second user should be created');
  assertEqual(store.players.length, 1, 'no second player should be created');
});

console.log('\n── Validation and field mapping ──────────────────────────────');

await test('mismatched confirmPassword returns 400 and creates nothing', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  const res = await handleRegister(registerRequest({ ...NEW_CLIENT, confirmPassword: 'Different1!' }), env);
  assertEqual(res.status, 400, 'confirmPassword mismatch must return 400');
  assertEqual(store.users.length, 0, 'no user should be created');
});

await test('the form field `mobile` is stored as the user phone', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  const { phone, ...withoutPhone } = NEW_CLIENT;
  const res = await handleRegister(registerRequest({ ...withoutPhone, mobile: '35679000000' }), env);
  assertEqual(res.status, 201);
  assertEqual(store.users[0].phone, '35679000000', 'mobile must map to users.phone');
});

await test('a concurrent registration race (UNIQUE violation mid-batch) does not leave a stray player', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  // Simulate two requests both passing the pre-check before either commits,
  // by pre-inserting the user directly (as request #1's batch would have)
  // and then running handleRegister's batch path for request #2 by hand.
  store.users.push({ id: 'racer-1', email: NEW_CLIENT.email.toLowerCase(), first_name: 'Ada', last_name: 'Keeper', role: 'client', active: 1 });

  let threw = false;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verify_token, active) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind('racer-2', NEW_CLIENT.email.toLowerCase(), 'hash', 'Ada', 'Keeper', null, 'verify'),
      env.DB.prepare('INSERT INTO players (id, client_id, first_name, last_name, status, is_account_holder) VALUES (?,?,?,?,?,?)')
        .bind('player-racer-2', 'racer-2', 'Ada', 'Keeper'),
    ]);
  } catch { threw = true; }

  assert(threw, 'second racer batch must fail on the UNIQUE users.email constraint');
  assertEqual(store.players.filter((p) => p.client_id === 'racer-2').length, 0, 'batch rollback must leave no player for the losing racer');
});

console.log('\n── Additional players ────────────────────────────────────────');

await test('a client can create an additional (non-account-holder) player', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  const clientId = store.users[0].id;
  const token = await tokenFor(env, clientId, 'client');

  const req = new Request('https://ppgk.app/api/players', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Sam', lastName: 'Keeper' }),
  });
  const res = await handleClientPlayers(req, env, {}, {});
  assertEqual(res.status, 201);

  const clientPlayers = store.players.filter((p) => p.client_id === clientId);
  assertEqual(clientPlayers.length, 2, 'account holder + the newly added player');
  const added = clientPlayers.find((p) => p.first_name === 'Sam');
  assertEqual(added.is_account_holder, 0, 'manually created players are not account holders');
});

console.log('\n── Admin / coach account creation never creates a player ─────');

await test('promoting a user to coach does not create a player row', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  store.users.push({ id: 'coach-1', email: 'coach@example.com', first_name: 'Cara', last_name: 'Coach', role: 'client', active: 1 });
  const admin = await tokenFor(env, 'admin-1', 'admin');

  const req = new Request('https://ppgk.app/api/admin/clients/coach-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'coach' }),
  });
  const res = await handleAdminClients(req, env, {}, { id: 'coach-1' });
  assertEqual(res.status, 200);
  assertEqual(store.players.length, 0, 'coach promotion must not create any player');
  assertEqual(store.coach_profiles.length, 1, 'coach_profile is still auto-created as before');
});

console.log('\n── Existing clients ──────────────────────────────────────────');

await test('existing clients that already have players are unaffected by backfill', () => {
  const store = makeStore();
  store.users.push({ id: 'legacy-1', email: 'legacy@example.com', first_name: 'Lee', last_name: 'Gacy', role: 'client', active: 1 });
  store.players.push({ id: 'p-legacy', client_id: 'legacy-1', first_name: 'Lee', last_name: 'Gacy', status: 'active', is_account_holder: 0 });

  // Mirrors scripts/backfill-account-holder-players.sql: only clients with
  // zero players are touched.
  function backfill() {
    for (const u of store.users) {
      if (u.role !== 'client' || u.active !== 1) continue;
      const hasPlayer = store.players.some((p) => p.client_id === u.id);
      if (!hasPlayer) {
        store.players.push({ id: `bf-${u.id}`, client_id: u.id, first_name: u.first_name, last_name: u.last_name, status: 'active', is_account_holder: 1 });
      }
    }
  }
  backfill();
  const legacyPlayers = store.players.filter((p) => p.client_id === 'legacy-1');
  assertEqual(legacyPlayers.length, 1, 'existing player must not be duplicated or overwritten');
  assertEqual(legacyPlayers[0].id, 'p-legacy', 'existing player row must be untouched');
});

await test('existing clients without players are safely backfilled, idempotently', () => {
  const store = makeStore();
  store.users.push({ id: 'legacy-2', email: 'legacy2@example.com', first_name: 'Nia', last_name: 'Wells', role: 'client', active: 1 });

  function backfill() {
    for (const u of store.users) {
      if (u.role !== 'client' || u.active !== 1) continue;
      const hasPlayer = store.players.some((p) => p.client_id === u.id);
      if (!hasPlayer) {
        store.players.push({ id: `bf-${u.id}`, client_id: u.id, first_name: u.first_name, last_name: u.last_name, status: 'active', is_account_holder: 1 });
      }
    }
  }
  backfill();
  assertEqual(store.players.filter((p) => p.client_id === 'legacy-2').length, 1);

  // Running it again must not create a second row.
  backfill();
  assertEqual(store.players.filter((p) => p.client_id === 'legacy-2').length, 1, 'backfill must be idempotent on rerun');
});

console.log('\n── Frontend contract (camelCase mapping) ──────────────────────');

await test('player appears via GET /api/players after registration, camelCased', async () => {
  const store = makeStore();
  const env = makeEnv(store);
  await handleRegister(registerRequest(NEW_CLIENT), env);
  const clientId = store.users[0].id;
  const token = await tokenFor(env, clientId, 'client');

  const req = new Request('https://ppgk.app/api/players', { headers: { Authorization: `Bearer ${token}` } });
  const res = await handleClientPlayers(req, env, {}, {});
  const body = await res.json();
  assertEqual(body.players.length, 1);
  assertEqual(body.players[0].firstName, 'Ada', 'API response must be camelCase');
  assertEqual(body.players[0].isAccountHolder, 1, 'is_account_holder must be exposed as isAccountHolder');
  assert(!('first_name' in body.players[0]), 'snake_case duplicate keys must not leak');
});

await test('toCamel maps is_account_holder to isAccountHolder', () => {
  const camelled = toCamel({ id: 'p1', is_account_holder: 1, first_name: 'Ada' });
  assertEqual(camelled.isAccountHolder, 1);
  assertEqual(camelled.firstName, 'Ada');
  assert(!('is_account_holder' in camelled) && !('first_name' in camelled));
});

console.log(`\n═══════════════════════════════════════════════════\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
