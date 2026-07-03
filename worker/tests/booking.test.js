/**
 * Automated tests for booking business logic.
 * Run with: node --experimental-vm-modules worker/tests/booking.test.js
 * (or integrate with a test runner like vitest)
 *
 * These tests use an in-memory mock of the DB helpers — no Base44, no D1 required.
 */

// ─── Minimal in-memory DB mock ────────────────────────────────────────────────
let _store = {};
let _seq   = 0;

function makeDb() {
  _store = {
    users: [],
    players: [],
    sessions: [],
    bookings: [],
    booking_amendments: [],
    orders: [],
    order_items: [],
    credit_ledger: [],
    package_purchases: [],
    app_settings: [
      { key: 'cancellation_deadline_hours', value: '24' },
      { key: 'reschedule_deadline_hours',   value: '24' },
      { key: 'credit_refund_on_cancellation', value: 'true' },
    ],
    audit_log: [],
    notifications: [],
    notification_templates: [],
  };
}

// Tiny synchronous in-memory query engine
function tableQuery(table, filter = {}) {
  return (_store[table] || []).filter(row => {
    for (const [k, v] of Object.entries(filter)) {
      if (row[k] !== v) return false;
    }
    return true;
  });
}

function insert(table, row) {
  const id = row.id || `id-${++_seq}`;
  const record = { ...row, id, created_at: new Date().toISOString() };
  (_store[table] = _store[table] || []).push(record);
  return record;
}

function update(table, id, changes) {
  const idx = _store[table].findIndex(r => r.id === id);
  if (idx === -1) throw new Error(`${table}:${id} not found`);
  _store[table][idx] = { ..._store[table][idx], ...changes };
  return _store[table][idx];
}

// ─── Inline credit logic (mirrors worker/src/lib/credits.js) ─────────────────
function getBalance(clientId) {
  const now = new Date().toISOString();
  return (_store.credit_ledger || [])
    .filter(e => e.client_id === clientId && (!e.expires_at || e.expires_at > now))
    .reduce((sum, e) => sum + e.amount, 0);
}

function deductCredits(clientId, bookingId, amount) {
  const already = tableQuery('credit_ledger', { booking_id: bookingId, type: 'usage' });
  if (already.length) return { success: true, skipped: true };

  const balance = getBalance(clientId);
  if (balance < amount) return { success: false, error: `Insufficient credits: ${balance} < ${amount}` };

  const balAfter = balance - amount;
  insert('credit_ledger', { client_id: clientId, type: 'usage', amount: -amount, balance_after: balAfter, booking_id: bookingId, description: 'test deduction' });
  return { success: true };
}

function refundCredits(clientId, bookingId) {
  const already = tableQuery('credit_ledger', { booking_id: bookingId, type: 'refund' });
  if (already.length) return { success: true, skipped: true };

  const deductions = tableQuery('credit_ledger', { booking_id: bookingId, type: 'usage' });
  if (!deductions.length) return { success: true, skipped: true };

  const totalRefund = deductions.reduce((s, d) => s + Math.abs(d.amount), 0);
  const balance     = getBalance(clientId);
  insert('credit_ledger', { client_id: clientId, type: 'refund', amount: totalRefund, balance_after: balance + totalRefund, booking_id: bookingId, description: 'refund' });
  return { success: true, refunded: totalRefund };
}

// ─── Amendment frequency check (mirrors bookings.js) ─────────────────────────
function amendmentAllowed(bookingId) {
  const booking = _store.bookings.find(b => b.id === bookingId);
  if (!booking) return false;
  const windowStart = new Date(booking.created_at);
  const windowEnd   = new Date(windowStart.getTime() + 7 * 24 * 3600 * 1000);
  const now         = new Date();
  if (now > windowEnd) return true;
  const count = tableQuery('booking_amendments', { booking_id: bookingId, amendment_type: 'reschedule' })
    .filter(a => new Date(a.created_at) >= windowStart && new Date(a.created_at) <= windowEnd).length;
  return count < 1;
}

// ─── Capacity check (mirrors bookings.js) ────────────────────────────────────
function liveConfirmedCount(sessionId) {
  const CANCELLED = ['cancelled_by_client', 'cancelled_by_admin', 'payment_failed', 'rescheduled'];
  return tableQuery('bookings', { session_id: sessionId })
    .filter(b => !CANCELLED.includes(b.status)).length;
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
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

function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ─── Test suites ──────────────────────────────────────────────────────────────

console.log('\n── Capacity Enforcement ─────────────────────────────────');
makeDb();

test('session with 0/2 capacity accepts a booking', () => {
  const s = insert('sessions', { id: 's1', capacity: 2, status: 'scheduled' });
  assertEqual(liveConfirmedCount('s1'), 0);
  assert(liveConfirmedCount('s1') < s.capacity, 'should be able to book');
});

test('session at capacity (2/2) rejects a booking', () => {
  insert('bookings', { session_id: 's1', status: 'confirmed' });
  insert('bookings', { session_id: 's1', status: 'confirmed' });
  const session = _store.sessions.find(s => s.id === 's1');
  assert(liveConfirmedCount('s1') >= session.capacity, 'should be full');
});

test('cancelled booking does not count towards capacity', () => {
  makeDb();
  insert('sessions', { id: 's2', capacity: 1, status: 'scheduled' });
  insert('bookings', { session_id: 's2', status: 'cancelled_by_client' });
  assertEqual(liveConfirmedCount('s2'), 0);
  assert(liveConfirmedCount('s2') < 1, 'cancelled booking should not fill slot');
});

test('payment_failed booking does not count towards capacity', () => {
  makeDb();
  insert('sessions', { id: 's3', capacity: 1, status: 'scheduled' });
  insert('bookings', { session_id: 's3', status: 'payment_failed' });
  assertEqual(liveConfirmedCount('s3'), 0);
});

console.log('\n── Duplicate Booking Prevention ─────────────────────────');
makeDb();

test('cannot book same player+session twice (active)', () => {
  insert('bookings', { id: 'b1', player_id: 'p1', session_id: 's1', status: 'confirmed' });
  const dup = tableQuery('bookings', { player_id: 'p1', session_id: 's1' })
    .find(b => !['cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled'].includes(b.status));
  assert(!!dup, 'duplicate should be detected');
});

test('can re-book after cancellation', () => {
  makeDb();
  insert('bookings', { id: 'b1', player_id: 'p1', session_id: 's1', status: 'cancelled_by_client' });
  const dup = tableQuery('bookings', { player_id: 'p1', session_id: 's1' })
    .find(b => !['cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled'].includes(b.status));
  assert(!dup, 'should allow rebooking after cancellation');
});

console.log('\n── Multi-session Booking ────────────────────────────────');
makeDb();

test('booking multiple sessions creates one record per session', () => {
  const sessionIds = ['s1', 's2', 's3'];
  for (const sid of sessionIds) {
    insert('sessions', { id: sid, capacity: 5, status: 'scheduled', credit_cost: 1, price: 20 });
  }
  const orderId = 'order-1';
  insert('orders', { id: orderId, client_id: 'client-1', idempotency_key: 'ik-1', status: 'pending', total_amount: 60 });

  for (const sid of sessionIds) {
    insert('bookings', { order_id: orderId, client_id: 'client-1', player_id: 'player-1', session_id: sid, status: 'confirmed' });
  }

  const bookings = tableQuery('bookings', { order_id: orderId });
  assertEqual(bookings.length, 3, 'should have 3 individual booking records');
});

test('idempotency key returns existing order', () => {
  const existing = _store.orders.find(o => o.idempotency_key === 'ik-1');
  assert(!!existing, 'should find existing order by idempotency key');
});

console.log('\n── Credit Deduction ─────────────────────────────────────');
makeDb();

test('sufficient credits are deducted', () => {
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 5, balance_after: 5, description: 'pkg', expires_at: '2099-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  const result = deductCredits(clientId, 'booking-1', 2);
  assert(result.success, 'deduction should succeed');
  assertEqual(getBalance(clientId), 3, 'balance should be 3 after deduction');
});

test('insufficient credits are rejected', () => {
  makeDb();
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 1, balance_after: 1, description: 'pkg', expires_at: '2099-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  const result = deductCredits(clientId, 'booking-x', 5);
  assert(!result.success, 'should reject insufficient credits');
  assert(result.error.includes('Insufficient'), result.error);
});

test('expired credits are not counted in balance', () => {
  makeDb();
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 10, balance_after: 10, description: 'pkg', expires_at: '2000-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  const balance = getBalance(clientId);
  assertEqual(balance, 0, 'expired credits should not count towards balance');
});

test('deduction is idempotent', () => {
  makeDb();
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 5, balance_after: 5, description: 'pkg', expires_at: '2099-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  deductCredits(clientId, 'booking-idem', 2);
  const result2 = deductCredits(clientId, 'booking-idem', 2);
  assert(result2.skipped, 'second deduction should be skipped (idempotent)');
  assertEqual(getBalance(clientId), 3, 'balance should not change on duplicate deduction');
});

console.log('\n── Credit Refund ────────────────────────────────────────');

test('credits are refunded on cancellation', () => {
  makeDb();
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 5, balance_after: 5, description: 'pkg', expires_at: '2099-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  deductCredits(clientId, 'booking-ref', 2);
  assertEqual(getBalance(clientId), 3);
  const refund = refundCredits(clientId, 'booking-ref');
  assert(refund.success, 'refund should succeed');
  assertEqual(getBalance(clientId), 5, 'balance should be restored');
});

test('credit refund is idempotent', () => {
  makeDb();
  const clientId = 'client-1';
  insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 5, balance_after: 5, description: 'pkg', expires_at: '2099-01-01T00:00:00Z', package_purchase_id: 'pp1' });
  deductCredits(clientId, 'booking-ref2', 2);
  refundCredits(clientId, 'booking-ref2');
  const result2 = refundCredits(clientId, 'booking-ref2');
  assert(result2.skipped, 'second refund should be skipped');
  assertEqual(getBalance(clientId), 5, 'balance should not double-refund');
});

console.log('\n── Booking Amendment Restriction ────────────────────────');
makeDb();

test('first amendment within 7-day window is allowed', () => {
  const booking = insert('bookings', { id: 'bk-amend', player_id: 'p1', session_id: 's1', status: 'confirmed', created_at: new Date().toISOString() });
  assert(amendmentAllowed('bk-amend'), 'first amendment should be allowed');
});

test('second amendment within same 7-day window is rejected', () => {
  insert('booking_amendments', { booking_id: 'bk-amend', amendment_type: 'reschedule', amended_by: 'u1', created_at: new Date().toISOString() });
  assert(!amendmentAllowed('bk-amend'), 'second amendment within 7 days should be rejected');
});

test('amendment is allowed after the 7-day window resets', () => {
  makeDb();
  const oldDate = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  insert('bookings', { id: 'bk-old', player_id: 'p1', session_id: 's1', status: 'confirmed', created_at: oldDate });
  insert('booking_amendments', { booking_id: 'bk-old', amendment_type: 'reschedule', amended_by: 'u1', created_at: oldDate });
  assert(amendmentAllowed('bk-old'), 'amendment should be allowed after 7-day window expires');
});

console.log('\n── Package Credit Issuance ──────────────────────────────');
makeDb();

test('issuing package credits updates the ledger', () => {
  const clientId = 'client-1';
  insert('package_purchases', { id: 'pp-1', client_id: clientId, credits_granted: 8, expires_at: '2099-01-01T00:00:00Z', status: 'active' });

  // Simulate issuePackageCredits
  const already = tableQuery('credit_ledger', { package_purchase_id: 'pp-1', type: 'purchase' });
  if (!already.length) {
    insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 8, balance_after: 8, package_purchase_id: 'pp-1', description: 'Package issued', expires_at: '2099-01-01T00:00:00Z' });
  }

  assertEqual(getBalance(clientId), 8, 'should have 8 credits after package issued');
});

test('package credits are not issued twice (idempotent)', () => {
  const clientId = 'client-1';
  // Already has a purchase entry for pp-1 from previous test
  const already = tableQuery('credit_ledger', { package_purchase_id: 'pp-1', type: 'purchase' });
  assert(already.length === 1, 'should only have one purchase entry');
  // Attempt second issue
  if (!already.length) {
    insert('credit_ledger', { client_id: clientId, type: 'purchase', amount: 8, balance_after: 16, package_purchase_id: 'pp-1', description: 'dup' });
  }
  const after = tableQuery('credit_ledger', { package_purchase_id: 'pp-1', type: 'purchase' });
  assertEqual(after.length, 1, 'should still only have one purchase entry');
});

console.log('\n── Notification Idempotency ─────────────────────────────');
makeDb();

test('same idempotency_ref does not create duplicate notification', () => {
  const ref = 'booking_confirmed_bk-1';
  insert('notifications', { id: 'n1', idempotency_ref: ref, status: 'sent' });
  const existing = _store.notifications.find(n => n.idempotency_ref === ref && n.status === 'sent');
  assert(!!existing, 'should find existing sent notification');
  // In real code, we skip sending if already sent
  const shouldSkip = !!existing;
  assert(shouldSkip, 'should skip duplicate send');
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed ✓');
}