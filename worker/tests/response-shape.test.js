/**
 * Response-shape regression test: the API contract (worker/src/lib/serializers.js)
 * says every JSON response is camelCase at every depth. This exercises the main
 * GET routes against a mock D1 that returns snake_case rows (like real D1) and
 * asserts no key anywhere in the response contains an underscore.
 *
 * Allowlisted: /api/admin/settings — its keys are DATA (setting identifiers from
 * the app_settings.key column) and must stay snake_case. That route is asserted
 * separately to make sure it KEEPS its snake_case keys.
 *
 * Run with: node worker/tests/response-shape.test.js
 */
import { signJwt } from '../src/lib/auth.js';

import { handleClientBookings }             from '../src/routes/client/bookings.js';
import { handleClientSessions }             from '../src/routes/client/sessions.js';
import { handleClientPlayers }              from '../src/routes/client/players.js';
import { handleClientCredits }              from '../src/routes/client/credits.js';
import { handleClientDashboard }            from '../src/routes/client/dashboard.js';
import { handleCoachSessions }              from '../src/routes/coach/sessions.js';
import { handleCoachDashboard }             from '../src/routes/coach/dashboard.js';
import { handleAdminDashboard }             from '../src/routes/admin/dashboard.js';
import { handleAdminReports }               from '../src/routes/admin/reports.js';
import { handleAdminNotificationTemplates } from '../src/routes/admin/notification-templates.js';
import { handleAdminSettings }              from '../src/routes/admin/settings.js';
import { handleMe }                         from '../src/routes/auth/me.js';

// ─── Mock D1: every SELECT returns snake_case rows, like the real schema ─────
const FUTURE = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

// A superset row: snake_case columns the routes under test SELECT, plus the
// aggregate aliases (count/cnt/total/balance/…) their queryOne calls read.
function genericRow() {
  return {
    id: 'row-1',
    title: 'GK Session',
    status: 'confirmed',
    active: 1, // requireAuth()'s active-status re-check
    first_name: 'Ada',
    last_name: 'Keeper',
    date_of_birth: '2014-03-01',
    medical_info: 'asthma',
    allergies: 'peanuts',
    age_group: 'U12',
    experience_level: 'intermediate',
    session_date: '2026-07-10',
    start_time: '10:00',
    end_time: '11:00',
    booked_at: '2026-07-01T10:00:00Z',
    credits_used: 1,
    amount_charged: 0,
    payment_method: 'credits',
    player_name: 'Ada Keeper',
    coach_name: 'Coach Carter',
    location_name: 'Main Pitch',
    session_name: 'GK Session',
    session_type_name: 'Shot Stopping',
    address_line1: '1 Stadium Way',
    booking_id: 'b-1',
    booking_status: 'confirmed',
    player_id: 'p-1',
    attendance_id: null,
    attendance_status: null,
    notes: null,
    capacity: 8,
    booked_count: 3,
    credit_cost: 1,
    price: 25,
    description: 'desc',
    type: 'purchase',
    amount: 5,
    reference: 'PAY-0001',
    created_at: '2026-07-01T10:00:00Z',
    expires_at: FUTURE,
    email: 'ada@example.com',
    role: 'client',
    phone: '123',
    email_verified: 1,
    last_login_at: null,
    city: 'Valletta',
    post_code: 'VLT01',
    emergency_contact_name: 'Bob',
    emergency_contact_phone: '456',
    gdpr_consent: 1,
    total_bookings: 3,
    total_revenue: 75,
    // aggregate aliases used by dashboard/credit queries
    count: 2,
    cnt: 2,
    total: 10,
    balance: 5,
    expiring: 0,
  };
}

const SETTINGS_ROWS = [
  { key: 'booking_amendment_limit',       value: '2',    data_type: 'number' },
  { key: 'cancellation_deadline_hours',   value: '24',   data_type: 'number' },
  { key: 'credit_refund_on_cancellation', value: 'true', data_type: 'boolean' },
];

function makeEnv() {
  const statement = (sql) => ({
    async first() { return genericRow(); },
    async all() {
      if (sql.includes('FROM app_settings')) return { results: SETTINGS_ROWS.map((r) => ({ ...r })) };
      return { results: [genericRow()] };
    },
    async run() { return { meta: {} }; },
  });
  return {
    JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    DB: {
      prepare(sql) { return { bind: () => statement(sql), ...statement(sql) }; },
      async batch() { return []; },
    },
  };
}

async function tokenFor(env, role) {
  return signJwt({ sub: `${role}-1`, role, firstName: 'Test', lastName: 'User', email: 't@example.com' }, env.JWT_SECRET);
}

async function callRoute(handler, env, { path, role = 'admin', params } = {}) {
  const token = await tokenFor(env, role);
  const request = new Request(`https://ppgk.app${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await handler(request, env, {}, params);
  return { status: res.status, body: await res.json() };
}

// ─── Deep scan for snake_case keys ────────────────────────────────────────────
function underscoreKeyPaths(value, path = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => underscoreKeyPaths(v, `${path}[${i}]`, found));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.includes('_')) found.push(`${path}.${k}`);
      underscoreKeyPaths(v, `${path}.${k}`, found);
    }
  }
  return found;
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function assertCamelOnly({ status, body }, routeName) {
  assert(status === 200, `${routeName}: expected 200, got ${status}: ${JSON.stringify(body)}`);
  const offenders = underscoreKeyPaths(body);
  assert(offenders.length === 0, `${routeName}: snake_case keys leaked: ${offenders.join(', ')}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log('\n── camelCase contract on main GET routes ────────────');

const CASES = [
  ['GET /api/bookings',                        handleClientBookings,             { path: '/api/bookings', role: 'client' }],
  ['GET /api/bookings/:id',                    handleClientBookings,             { path: '/api/bookings/b-1', role: 'client', params: { id: 'b-1' } }],
  ['GET /api/sessions',                        handleClientSessions,             { path: '/api/sessions', role: 'client' }],
  ['GET /api/players',                         handleClientPlayers,              { path: '/api/players', role: 'client' }],
  ['GET /api/credits',                         handleClientCredits,              { path: '/api/credits', role: 'client' }],
  ['GET /api/dashboard/client',                handleClientDashboard,            { path: '/api/dashboard/client', role: 'client' }],
  ['GET /api/coach/sessions',                  handleCoachSessions,              { path: '/api/coach/sessions', role: 'coach' }],
  ['GET /api/coach/sessions/:id',              handleCoachSessions,              { path: '/api/coach/sessions/s-1', role: 'coach', params: { id: 's-1' } }],
  ['GET /api/coach/sessions/:id/attendees',    handleCoachSessions,              { path: '/api/coach/sessions/s-1/attendees', role: 'coach', params: { id: 's-1' } }],
  ['GET /api/coach/dashboard',                 handleCoachDashboard,             { path: '/api/coach/dashboard', role: 'coach' }],
  ['GET /api/admin/dashboard',                 handleAdminDashboard,             { path: '/api/admin/dashboard', role: 'admin' }],
  ['GET /api/admin/reports/bookings',          handleAdminReports,               { path: '/api/admin/reports/bookings', role: 'admin', params: { type: 'bookings' } }],
  ['GET /api/admin/reports/attendance',        handleAdminReports,               { path: '/api/admin/reports/attendance', role: 'admin', params: { type: 'attendance' } }],
  ['GET /api/admin/reports/revenue',           handleAdminReports,               { path: '/api/admin/reports/revenue', role: 'admin', params: { type: 'revenue' } }],
  ['GET /api/admin/notification-templates',    handleAdminNotificationTemplates, { path: '/api/admin/notification-templates', role: 'admin' }],
  ['GET /api/auth/me',                         handleMe,                         { path: '/api/auth/me', role: 'client' }],
];

for (const [name, handler, opts] of CASES) {
  await test(`${name} returns camelCase keys at all depths`, async () => {
    assertCamelOnly(await callRoute(handler, makeEnv(), opts), name);
  });
}

await test('snake_case DB fields are converted, not dropped', async () => {
  const { body } = await callRoute(handleClientBookings, makeEnv(), { path: '/api/bookings', role: 'client' });
  const b = body.bookings[0];
  assert(b.sessionDate === '2026-07-10', `expected sessionDate, got ${JSON.stringify(b)}`);
  assert(b.creditsUsed === 1 && b.bookedAt && b.amountCharged === 0, 'bookedAt/creditsUsed/amountCharged must survive conversion');
  assert(!('session_date' in b) && !('credits_used' in b), 'snake_case duplicates must not remain');
});

await test('coach attendees expose camelCase player fields', async () => {
  const { body } = await callRoute(handleCoachSessions, makeEnv(),
    { path: '/api/coach/sessions/s-1/attendees', role: 'coach', params: { id: 's-1' } });
  const a = body.attendees[0];
  assert(a.firstName === 'Ada' && a.medicalInfo === 'asthma' && a.bookingStatus === 'confirmed',
    `attendee fields must be camelCase, got ${JSON.stringify(a)}`);
});

console.log('\n── allowlisted data-keyed route keeps snake_case ────');

await test('GET /api/admin/settings preserves snake_case setting identifiers', async () => {
  const { status, body } = await callRoute(handleAdminSettings, makeEnv(), { path: '/api/admin/settings', role: 'admin' });
  assert(status === 200, `expected 200, got ${status}`);
  assert(body.booking_amendment_limit === 2, `setting key 'booking_amendment_limit' must survive untouched: ${JSON.stringify(body)}`);
  assert(body.credit_refund_on_cancellation === true, 'boolean setting must keep its snake_case key and typed value');
  assert(!('bookingAmendmentLimit' in body), 'settings keys are data and must NOT be camelCased');
});

console.log(`\n═══════════════════════════════════════════════════\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
