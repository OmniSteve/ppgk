/**
 * CORS headers helper.
 *
 * Strict per-environment allowlist: the only browser origin each deployment
 * accepts is its own APP_URL (production → https://ppgk.app, dev →
 * https://dev.ppgk.app), plus localhost for local development. This stops
 * the dev frontend calling the production API and vice versa.
 *
 * Note: the app normally calls the API same-origin (relative /api paths),
 * which never needs CORS — these headers only matter for cross-origin
 * callers, which is exactly what we want to restrict.
 */
const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
];

export function corsHeaders(request, env) {
  const origin    = request.headers.get('Origin') || '';
  const appOrigin = env?.APP_URL || 'https://ppgk.app';
  const allowed   = origin === appOrigin || LOCAL_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': allowed ? origin : appOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
