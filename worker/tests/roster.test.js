/**
 * Session booking → coach roster workflow tests.
 *
 * Part 1 exercises the pure transition table directly (no DB).
 * Part 2 drives the real route handlers (handleClientBookings,
 * handleCoachRoster) against a small in-memory D1 stand-in — same style as
 * worker/tests/booking.test.js / account-holder-player.test.js. Credit
 * ledger rows in these tests are always simple single-source admin_grant
 * rows (no package_purchase_id), so the mock doesn't need to replicate
 * lib/credits.js's multi-source FIFO math — it exercises the REAL
 * deductCredits/refundCredits functions, just with simple inputs.
 *
 * Run with: node worker/tests/roster.test.js
 */

import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { TRANSITIONS, isValidTransition } from '../src/lib/roster.js';
import { handleClientBookings } from '../src/routes/client/bookings.js';
import { handleCoachRoster }    from '../src/routes/coach/roster.js';
import { signJwt }              from '../src/lib/auth.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.stack || e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Part 1: pure transition table ─────────────────────────────────────────
console.log('\n── Status transition table ──────────────────────────────────');

test('pending can move to confirmed, backup, declined, cancelled', () => {
  assert(isValidTransition('pending', 'confirmed'));
  assert(isValidTransition('pending', 'backup'));
  assert(isValidTransition('pending', 'declined'));
  assert(isValidTransition('pending', 'cancelled_by_client'));
  assert(isValidTransition('pending', 'cancelled_by_admin'));
});

test('backup can move to confirmed, pending, declined, cancelled', () => {
  assert(isValidTransition('backup', 'confirmed'));
  assert(isValidTransition('backup', 'pending'));
  assert(isValidTransition('backup', 'declined'));
  assert(isValidTransition('backup', 'cancelled_by_admin'));
});

test('confirmed can move to backup, cancelled, declined — but not pending', () => {
  assert(isValidTransition('confirmed', 'backup'));
  assert(isValidTransition('confirmed', 'cancelled_by_client'));
  assert(isValidTransition('confirmed', 'declined'));
  assert(!isValidTransition('confirmed', 'pending'));
});

test('declined and cancelled are terminal (no outbound transitions defined)', () => {
  assert(!TRANSITIONS.declined);
  assert(!TRANSITIONS.cancelled_by_client);
  assert(!isValidTransition('declined', 'pending'));
});

test('unknown statuses reject every transition', () => {
  assert(!isValidTransition('pending_payment', 'confirmed'));
  assert(!isValidTransition('bogus', 'confirmed'));
});

// ─── Part 2: in-memory D1 + real route handlers ────────────────────────────

function makeStore() {
  return {
    sessions: [], bookings: [], players: [], users: [], coach_profiles: [],
    credit_ledger: [], booking_amendments: [], audit_log: [], orders: [],
  };
}

function seedBase(store) {
  store.users.push({ id: 'client-1', email: 'parent@example.com', first_name: 'Pat', last_name: 'Parent', role: 'client', active: 1 });
  store.players.push({ id: 'player-1', client_id: 'client-1', first_name: 'Ada', last_name: 'Keeper', status: 'active' });
  store.coach_profiles.push({ id: 'coach-profile-1', user_id: 'coach-1' });
  store.sessions.push({
    id: 'sess-1', title: 'GK Clinic', session_date: '2099-01-10', start_time: '10:00', end_time: '11:00',
    capacity: 2, credit_cost: 1, price: 20, status: 'published', booking_mode: 'request',
    booking_open_at: null, booking_close_at: null, location_id: null, coach_id: 'coach-profile-1',
    booked_count: 0,
  });
  // One simple, single-source, never-expiring credit grant per test client.
  store.credit_ledger.push({ id: 'grant-1', client_id: 'client-1', type: 'admin_grant', amount: 10, balance_after: 10, package_purchase_id: null, expires_at: null, booking_id: null });
}

function grantCredits(store, clientId, amount) {
  store.credit_ledger.push({ id: `grant-${clientId}-${store.credit_ledger.length}`, client_id: clientId, type: 'admin_grant', amount, balance_after: amount, package_purchase_id: null, expires_at: null, booking_id: null });
}

function requestBooking(store, { id, clientId = 'client-1', playerId = 'player-1', sessionId = 'sess-1', status = 'pending', creditsUsed = 1 }) {
  const row = { id, order_id: `order-${id}`, client_id: clientId, player_id: playerId, session_id: sessionId, status, payment_method: 'credits', credits_used: creditsUsed, booked_at: new Date().toISOString(), confirmed_at: null };
  store.bookings.push(row);
  return row;
}

function runStatement(store, sql, params) {
  const s = sql.replace(/\s+/g, ' ').trim();

  // ── credit_ledger (real lib/credits.js queries) ──────────────────────
  if (s.startsWith('SELECT COALESCE(SUM(amount), 0) as balance')) {
    const [clientId, now] = params;
    const bal = store.credit_ledger
      .filter(r => r.client_id === clientId && (!r.expires_at || r.expires_at > now))
      .reduce((sum, r) => sum + r.amount, 0);
    return { first: { balance: bal } };
  }
  if (s.startsWith('SELECT package_purchase_id, -COALESCE(SUM(amount), 0) as consumed')) {
    return { results: [] }; // no package-scoped rows in these tests
  }
  if (s.startsWith('SELECT -COALESCE(SUM(amount), 0) as consumed')) {
    const [clientId] = params;
    const consumed = -store.credit_ledger
      .filter(r => r.client_id === clientId && ['usage', 'refund', 'admin_deduct'].includes(r.type) && !r.package_purchase_id)
      .reduce((sum, r) => sum + r.amount, 0);
    return { first: { consumed } };
  }
  if (s.startsWith("SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'usage'")) {
    const [bookingId] = params;
    const row = store.credit_ledger.find(r => r.booking_id === bookingId && r.type === 'usage');
    return { first: row ? { id: row.id } : null };
  }
  if (s.startsWith("SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'refund'")) {
    const [bookingId] = params;
    const row = store.credit_ledger.find(r => r.booking_id === bookingId && r.type === 'refund');
    return { first: row ? { id: row.id } : null };
  }
  if (s.startsWith('SELECT id, type, amount, expires_at, package_purchase_id')) {
    const [clientId] = params;
    const rows = store.credit_ledger.filter(r => r.client_id === clientId && ['purchase', 'admin_grant'].includes(r.type));
    return { results: rows };
  }
  if (s.startsWith('SELECT id, amount, package_purchase_id, expires_at FROM credit_ledger')) {
    const [bookingId] = params;
    const rows = store.credit_ledger.filter(r => r.booking_id === bookingId && r.type === 'usage');
    return { results: rows };
  }
  if (s.startsWith('INSERT INTO credit_ledger')) {
    // type is a SQL literal (VALUES (?, ?, 'usage', ?, ...)), not a bound
    // param — pull it out of the SQL text, then read the 8 real params in
    // the order every credits.js insert uses: id, client_id, amount,
    // balance_after, booking_id, package_purchase_id, description, expires_at.
    const typeMatch = s.match(/'(usage|refund|purchase|admin_grant|refund_removal|admin_deduct|expiry)'/);
    const [id, clientId, amount, balanceAfter, bookingId, packagePurchaseId, , expiresAt] = params;
    store.credit_ledger.push({
      id, client_id: clientId, type: typeMatch?.[1], amount, balance_after: balanceAfter,
      booking_id: bookingId ?? null, package_purchase_id: packagePurchaseId ?? null, expires_at: expiresAt ?? null,
    });
    return { meta: {} };
  }

  // ── orders / idempotency ──────────────────────────────────────────────
  if (s.startsWith('SELECT id FROM orders WHERE idempotency_key')) {
    const [key, clientId] = params;
    const row = store.orders.find(o => o.idempotency_key === key && o.client_id === clientId);
    return { first: row ? { id: row.id } : null };
  }
  if (s.startsWith('SELECT id FROM bookings WHERE order_id = ?')) {
    const [orderId] = params;
    return { results: store.bookings.filter(b => b.order_id === orderId).map(b => ({ id: b.id })) };
  }
  if (s.startsWith('INSERT INTO orders')) {
    const [id, clientId, idempotencyKey, status, totalAmt] = params;
    store.orders.push({ id, client_id: clientId, idempotency_key: idempotencyKey, status, total_amount: totalAmt });
    return { meta: {} };
  }
  if (s.startsWith("UPDATE orders SET status='paid'") || s.startsWith("UPDATE orders SET status='failed'")) {
    const [orderId] = params;
    const o = store.orders.find(x => x.id === orderId);
    if (o) o.status = s.includes("'paid'") ? 'paid' : 'failed';
    return { meta: {} };
  }

  // ── players / sessions lookups ─────────────────────────────────────────
  if (s.startsWith('SELECT id, client_id, status FROM players')) {
    const [playerId, clientId] = params;
    const p = store.players.find(x => x.id === playerId && x.client_id === clientId);
    return { first: p ?? null };
  }
  if (s.startsWith('SELECT id, title, session_date, start_time, end_time, capacity, credit_cost, price, status, booking_mode')) {
    const [sessionId] = params;
    const sess = store.sessions.find(x => x.id === sessionId);
    return { first: sess ?? null };
  }
  if (s.startsWith('SELECT s.*, l.name as location_name FROM sessions')) {
    const [sessionId] = params;
    const sess = store.sessions.find(x => x.id === sessionId);
    return { first: sess ? { ...sess, location_name: null } : null };
  }
  if (s.startsWith('SELECT id FROM coach_profiles WHERE user_id')) {
    const [userId] = params;
    const c = store.coach_profiles.find(x => x.user_id === userId);
    return { first: c ? { id: c.id } : null };
  }

  // ── requireAuth()'s active-status re-check ──────────────────────────────
  // This file only models client-1 as a full users row; coach/admin JWT
  // subjects (coach-1, coach-2, admin-1, ...) are never inserted into
  // store.users, so treat any unmodelled actor as active rather than
  // rejecting every coach/admin request in this suite.
  if (s.startsWith('SELECT active FROM users WHERE id')) {
    const [userId] = params;
    const u = store.users.find(x => x.id === userId);
    return { first: { active: u ? u.active : 1 } };
  }

  // ── duplicate / capacity checks ─────────────────────────────────────────
  // NOTE: check the literal-status query (existingFailed reuse lookup)
  // before the bound-params ACTIVE_BLOCKING_STATUSES query — both start
  // with the same "SELECT id FROM bookings WHERE player_id = ? AND
  // session_id = ? AND status IN" prefix, but only the latter has the
  // statuses as bound params.
  if (s.includes("status IN ('payment_failed', 'pending_payment')")) {
    const [playerId, sessionId] = params;
    const row = store.bookings.find(b => b.player_id === playerId && b.session_id === sessionId && ['payment_failed', 'pending_payment'].includes(b.status));
    return { first: row ? { id: row.id } : null };
  }
  if (s.startsWith('SELECT id FROM bookings WHERE player_id = ? AND session_id = ? AND status IN')) {
    const [playerId, sessionId, ...statuses] = params;
    const row = store.bookings.find(b => b.player_id === playerId && b.session_id === sessionId && statuses.includes(b.status));
    return { first: row ? { id: row.id } : null };
  }
  if (s.startsWith('SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status NOT IN')) {
    const [sessionId] = params;
    const excluded = ['cancelled_by_client', 'cancelled_by_admin', 'payment_failed', 'rescheduled'];
    const cnt = store.bookings.filter(b => b.session_id === sessionId && !excluded.includes(b.status)).length;
    return { first: { cnt } };
  }

  // ── booking insert/update (create flow) ─────────────────────────────────
  if (s.startsWith('INSERT INTO bookings')) {
    const [id, orderId, clientId, playerId, sessionId, status, paymentMethod, creditsUsed] = params;
    store.bookings.push({ id, order_id: orderId, client_id: clientId, player_id: playerId, session_id: sessionId, status, payment_method: paymentMethod, credits_used: creditsUsed, booked_at: new Date().toISOString(), confirmed_at: null });
    return { meta: {} };
  }
  if (s.startsWith("UPDATE bookings SET status='confirmed', confirmed_at=?")) {
    const [confirmedAt, bookingId] = params;
    const b = store.bookings.find(x => x.id === bookingId);
    if (b) { b.status = 'confirmed'; b.confirmed_at = confirmedAt; }
    return { meta: {} };
  }
  if (s.startsWith("UPDATE bookings SET status='payment_failed'")) {
    const [bookingId] = params;
    const b = store.bookings.find(x => x.id === bookingId);
    if (b) b.status = 'payment_failed';
    return { meta: {} };
  }
  if (s.startsWith("UPDATE bookings SET status='cancelled_by_client'")) {
    const [cancelledAt, reason, updatedAt, bookingId] = params;
    const b = store.bookings.find(x => x.id === bookingId);
    if (b) { b.status = 'cancelled_by_client'; b.cancelled_at = cancelledAt; }
    return { meta: {} };
  }

  // ── sessions.booked_count ───────────────────────────────────────────────
  if (s.startsWith('UPDATE sessions SET booked_count = booked_count + 1')) {
    const [sessionId] = params;
    const sess = store.sessions.find(x => x.id === sessionId);
    if (sess) sess.booked_count += 1;
    return { meta: {} };
  }
  if (s.startsWith('UPDATE sessions SET booked_count = booked_count - 1')) {
    const [sessionId] = params;
    const sess = store.sessions.find(x => x.id === sessionId);
    if (sess && sess.booked_count > 0) sess.booked_count -= 1;
    return { meta: {} };
  }

  // ── roster.js: booking lookup for PATCH ─────────────────────────────────
  if (s.startsWith('SELECT b.*, p.first_name, p.last_name, u.email as client_email')) {
    const [bookingId, sessionId] = params;
    const b = store.bookings.find(x => x.id === bookingId && x.session_id === sessionId);
    if (!b) return { first: null };
    const player = store.players.find(p => p.id === b.player_id);
    const user = store.users.find(u => u.id === b.client_id);
    return { first: { ...b, first_name: player?.first_name, last_name: player?.last_name, client_email: user?.email, client_first_name: user?.first_name } };
  }

  // ── roster.js: the concurrency-safe conditional confirm UPDATE ──────────
  if (s.includes("SET status = 'confirmed', confirmed_at = ?, updated_at = ?") && s.includes('< (SELECT capacity FROM sessions')) {
    const [, , bookingId, sessionId] = params;
    const b = store.bookings.find(x => x.id === bookingId && x.session_id === sessionId);
    const sess = store.sessions.find(x => x.id === sessionId);
    if (!b || !sess) return { changes: 0 };
    if (!['pending', 'backup'].includes(b.status)) return { changes: 0 };
    const confirmedCount = store.bookings.filter(x => x.session_id === sessionId && x.status === 'confirmed').length;
    if (confirmedCount >= sess.capacity) return { changes: 0 };
    b.status = 'confirmed';
    return { changes: 1 };
  }

  // ── roster.js: plain guarded status UPDATE (backup/decline/pending/remove) ──
  if (s.startsWith('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND session_id = ? AND status = ?')) {
    const [newStatus, , bookingId, sessionId, expectedStatus] = params;
    const b = store.bookings.find(x => x.id === bookingId && x.session_id === sessionId);
    if (!b || b.status !== expectedStatus) return { changes: 0 };
    b.status = newStatus;
    return { changes: 1 };
  }

  // ── roster pool listing ──────────────────────────────────────────────────
  if (s.startsWith('SELECT') && s.includes('FROM bookings b') && s.includes('JOIN players p') && s.includes('JOIN users u') && s.includes('WHERE b.session_id = ? AND b.status = ?')) {
    const [sessionId, status] = params;
    const rows = store.bookings
      .filter(b => b.session_id === sessionId && b.status === status)
      .map(b => {
        const player = store.players.find(p => p.id === b.player_id);
        const user = store.users.find(u => u.id === b.client_id);
        return { booking_id: b.id, booking_status: b.status, booked_at: b.booked_at, credits_used: b.credits_used, player_id: player?.id, first_name: player?.first_name, last_name: player?.last_name, client_id: user?.id, client_name: `${user?.first_name} ${user?.last_name}`, client_email: user?.email };
      })
      .sort((a, b) => a.booked_at.localeCompare(b.booked_at) || a.first_name.localeCompare(b.first_name));
    return { results: rows };
  }

  // ── catch-alls: audit_log / booking_amendments / notification lookups ───
  if (s.startsWith('INSERT')) return { meta: {} };
  if (s.startsWith('SELECT')) return { first: null, results: [] };
  return { meta: {} };
}

function makeEnv(store) {
  return {
    JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    APP_URL: 'https://ppgk.app',
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() { return runStatement(store, sql, params).first ?? null; },
              async all()   { return { results: runStatement(store, sql, params).results ?? [] }; },
              async run()   { return { meta: runStatement(store, sql, params) }; },
            };
          },
        };
      },
    },
  };
}

async function tokenFor(env, sub, role, extra = {}) {
  return signJwt({ sub, role, firstName: 'Test', lastName: 'User', email: 't@example.com', ...extra }, env.JWT_SECRET);
}

console.log('\n── Request creation ─────────────────────────────────────────');

await test('a booking request creates a pending booking and reserves the credit', async () => {
  const store = makeStore(); seedBase(store);
  const env = makeEnv(store);
  const token = await tokenFor(env, 'client-1', 'client', { email: 'parent@example.com' });
  const req = new Request('https://ppgk.app/api/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionIds: ['sess-1'], playerId: 'player-1', paymentMethod: 'credits', idempotencyKey: 'k1' }),
  });
  const res = await handleClientBookings(req, env, {}, {});
  const body = await res.json();
  assertEqual(res.status, 201);
  assertEqual(body.status, 'pending');
  const booking = store.bookings.find(b => b.id === body.bookingIds[0]);
  assertEqual(booking.status, 'pending');
  assertEqual(store.sessions[0].booked_count, 0, 'pending requests must not count toward capacity');
  const usage = store.credit_ledger.find(r => r.booking_id === booking.id && r.type === 'usage');
  assert(usage, 'credit must be reserved (deducted) at request time');
});

await test('card payment is rejected for a request-mode session', async () => {
  const store = makeStore(); seedBase(store);
  const env = makeEnv(store);
  const token = await tokenFor(env, 'client-1', 'client');
  const req = new Request('https://ppgk.app/api/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionIds: ['sess-1'], playerId: 'player-1', paymentMethod: 'card', idempotencyKey: 'k2' }),
  });
  const res = await handleClientBookings(req, env, {}, {});
  assertEqual(res.status, 422);
});

await test('a duplicate request for the same session is blocked', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'existing-1' });
  const env = makeEnv(store);
  const token = await tokenFor(env, 'client-1', 'client');
  const req = new Request('https://ppgk.app/api/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionIds: ['sess-1'], playerId: 'player-1', paymentMethod: 'credits', idempotencyKey: 'k3' }),
  });
  const res = await handleClientBookings(req, env, {}, {});
  assertEqual(res.status, 422);
});

await test('an abandoned pending_payment booking does not block a retry (reuse flow intact)', async () => {
  const store = makeStore(); seedBase(store);
  store.sessions[0].booking_mode = 'instant';
  requestBooking(store, { id: 'stuck-1', status: 'pending_payment' });
  const env = makeEnv(store);
  const token = await tokenFor(env, 'client-1', 'client', { email: 'parent@example.com' });
  const req = new Request('https://ppgk.app/api/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionIds: ['sess-1'], playerId: 'player-1', paymentMethod: 'credits', idempotencyKey: 'k-retry' }),
  });
  const res = await handleClientBookings(req, env, {}, {});
  const body = await res.json();
  assertEqual(res.status, 201, `retry must not be blocked as a duplicate: ${JSON.stringify(body)}`);
  assertEqual(body.bookingIds[0], 'stuck-1', 'the abandoned row must be reused, not duplicated');
  assertEqual(store.bookings.filter(b => b.session_id === 'sess-1').length, 1, 'no duplicate row should be created');
});

console.log('\n── Coach roster management ──────────────────────────────────');

async function coachToken(env) { return tokenFor(env, 'coach-1', 'coach'); }

await test('coach sees pending requests in the roster', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster', { headers: { Authorization: `Bearer ${token}` } });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1' });
  const body = await res.json();
  assertEqual(body.session.pendingCount, 1);
  assertEqual(body.pending[0].playerId, 'player-1');
});

await test('coach confirms a pending player — capacity count updates', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b1', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b1' });
  assertEqual(res.status, 200);
  assertEqual(store.bookings.find(b => b.id === 'b1').status, 'confirmed');
  assertEqual(store.sessions[0].booked_count, 1);
});

await test('coach cannot exceed session capacity', async () => {
  const store = makeStore(); seedBase(store); // capacity 2
  requestBooking(store, { id: 'b1', status: 'confirmed' });
  requestBooking(store, { id: 'b2', status: 'confirmed' });
  store.sessions[0].booked_count = 2;
  requestBooking(store, { id: 'b3', playerId: 'player-1', status: 'pending' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b3', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b3' });
  assertEqual(res.status, 409);
  assertEqual(store.bookings.find(b => b.id === 'b3').status, 'pending', 'booking must remain pending when capacity is full');
});

await test('concurrent confirm attempts cannot both exceed capacity', async () => {
  const store = makeStore(); seedBase(store); // capacity 2
  requestBooking(store, { id: 'b1', status: 'confirmed' });
  store.sessions[0].booked_count = 1;
  requestBooking(store, { id: 'b2', status: 'pending' });
  requestBooking(store, { id: 'b3', playerId: 'player-1', status: 'pending' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const confirm = (bookingId) => handleCoachRoster(
    new Request(`https://ppgk.app/api/coach/sessions/sess-1/roster/${bookingId}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }),
    }), env, {}, { id: 'sess-1', bookingId }
  );
  // Simulated as sequential (single-threaded JS/D1 statement execution is
  // effectively serialized) — the second must be rejected by the same
  // conditional UPDATE that would gate a true concurrent race.
  const [r1, r2] = [await confirm('b2'), await confirm('b3')];
  const statuses = [r1.status, r2.status].sort();
  assertEqual(statuses[0], 200);
  assertEqual(statuses[1], 409);
  const confirmedCount = store.bookings.filter(b => b.status === 'confirmed').length;
  assertEqual(confirmedCount, 2, 'capacity of 2 must never be exceeded');
});

await test('coach moves a confirmed player to backup and frees the slot', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1', status: 'confirmed' });
  store.sessions[0].booked_count = 1;
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b1', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'backup' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b1' });
  assertEqual(res.status, 200);
  assertEqual(store.bookings.find(b => b.id === 'b1').status, 'backup');
  assertEqual(store.sessions[0].booked_count, 0);
});

await test('coach promotes a backup player when a slot is available', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1', status: 'backup' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b1', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b1' });
  assertEqual(res.status, 200);
  assertEqual(store.bookings.find(b => b.id === 'b1').status, 'confirmed');
});

await test('promotion is rejected when no slot remains', async () => {
  const store = makeStore(); seedBase(store); // capacity 2
  requestBooking(store, { id: 'b1', status: 'confirmed' });
  requestBooking(store, { id: 'b2', status: 'confirmed' });
  store.sessions[0].booked_count = 2;
  requestBooking(store, { id: 'b3', playerId: 'player-1', status: 'backup' });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b3', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b3' });
  assertEqual(res.status, 409);
});

await test('declining a request refunds the reserved credit exactly once', async () => {
  const store = makeStore(); seedBase(store);
  const booking = requestBooking(store, { id: 'b1', status: 'pending' });
  store.credit_ledger.push({ id: 'usage-1', client_id: 'client-1', type: 'usage', amount: -1, balance_after: 9, booking_id: 'b1', package_purchase_id: null, expires_at: null });
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b1', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'decline' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b1' });
  assertEqual(res.status, 200);
  assertEqual(store.bookings.find(b => b.id === 'b1').status, 'declined');
  const refunds = store.credit_ledger.filter(r => r.booking_id === 'b1' && r.type === 'refund');
  assertEqual(refunds.length, 1);
});

await test('removing a confirmed player refunds credit and frees the slot', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1', status: 'confirmed' });
  store.credit_ledger.push({ id: 'usage-1', client_id: 'client-1', type: 'usage', amount: -1, balance_after: 9, booking_id: 'b1', package_purchase_id: null, expires_at: null });
  store.sessions[0].booked_count = 1;
  const env = makeEnv(store);
  const token = await coachToken(env);
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster/b1', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'remove' }),
  });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1', bookingId: 'b1' });
  assertEqual(res.status, 200);
  assertEqual(store.bookings.find(b => b.id === 'b1').status, 'cancelled_by_admin');
  assertEqual(store.sessions[0].booked_count, 0);
  assertEqual(store.credit_ledger.filter(r => r.booking_id === 'b1' && r.type === 'refund').length, 1);
});

console.log('\n── Authorisation ─────────────────────────────────────────────');

await test('a coach cannot manage a session assigned to another coach', async () => {
  const store = makeStore(); seedBase(store);
  store.coach_profiles.push({ id: 'coach-profile-2', user_id: 'coach-2' });
  requestBooking(store, { id: 'b1', status: 'pending' });
  const env = makeEnv(store);
  const token = await tokenFor(env, 'coach-2', 'coach');
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster', { headers: { Authorization: `Bearer ${token}` } });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1' });
  assertEqual(res.status, 403);
});

await test('admin can manage any session regardless of assigned coach', async () => {
  const store = makeStore(); seedBase(store);
  requestBooking(store, { id: 'b1', status: 'pending' });
  const env = makeEnv(store);
  const token = await tokenFor(env, 'admin-1', 'admin');
  const req = new Request('https://ppgk.app/api/coach/sessions/sess-1/roster', { headers: { Authorization: `Bearer ${token}` } });
  const res = await handleCoachRoster(req, env, {}, { id: 'sess-1' });
  assertEqual(res.status, 200);
});

console.log('\n── Instant-mode sessions are unaffected ────────────────────────');

await test('an instant-mode session still confirms immediately at request time', async () => {
  const store = makeStore(); seedBase(store);
  store.sessions[0].booking_mode = 'instant';
  const env = makeEnv(store);
  const token = await tokenFor(env, 'client-1', 'client', { email: 'parent@example.com' });
  const req = new Request('https://ppgk.app/api/bookings', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionIds: ['sess-1'], playerId: 'player-1', paymentMethod: 'credits', idempotencyKey: 'k-instant' }),
  });
  const res = await handleClientBookings(req, env, {}, {});
  const body = await res.json();
  assertEqual(res.status, 201);
  assertEqual(body.status, 'confirmed');
  assertEqual(store.bookings.find(b => b.id === body.bookingIds[0]).status, 'confirmed');
  assertEqual(store.sessions[0].booked_count, 1, 'instant-mode booked_count behaviour is unchanged');
});

console.log(`\n═══════════════════════════════════════════════════\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
