/**
 * Shared validation and error-response utilities.
 * All Worker routes should use these helpers for consistency.
 */
import { toCamel } from './serializers.js';

/** Standard error response */
export function err(message, status = 400, extras = {}) {
  return Response.json({ error: message, ...extras }, { status });
}

/**
 * Standard success response.
 *
 * Enforces the API serialization contract (see lib/serializers.js) at a single
 * choke point: every key at every depth is converted to camelCase, so routes
 * can pass raw snake_case D1 rows straight through. toCamel is idempotent on
 * already-camelCase keys.
 *
 * Responses whose keys are DATA rather than field names (e.g. the app_settings
 * map in routes/admin/settings.js, keyed by setting identifier) must NOT use
 * ok() — they return Response.json directly to keep their keys untouched.
 */
export function ok(data = {}, status = 200) {
  return Response.json(toCamel(data), { status });
}

/** Assert required fields exist and are non-empty */
export function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      return `Field '${f}' is required`;
    }
  }
  return null;
}

/** Parse and validate a request body against an allowed field list */
export async function parseBody(request, requiredFields = [], allowedFields = null) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Request body must be valid JSON', body: null };
  }
  if (allowedFields) {
    const unknown = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unknown.length > 0) {
      return { error: `Unknown fields: ${unknown.join(', ')}`, body: null };
    }
  }
  const missing = requireFields(body, requiredFields);
  if (missing) return { error: missing, body: null };
  return { error: null, body };
}

/** Validate ISO date string YYYY-MM-DD */
export function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

/** Validate HH:MM time string */
export function isValidTime(str) {
  return /^\d{2}:\d{2}$/.test(str);
}