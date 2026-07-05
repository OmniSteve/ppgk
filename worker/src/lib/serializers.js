/**
 * Shared serialization utilities for Worker API responses.
 *
 * CONTRACT:
 *  - D1 / SQL layer:   snake_case  (first_name, date_of_birth, …)
 *  - API responses:    camelCase   (firstName, dateOfBirth, …)
 *  - Frontend payloads: camelCase  (accepted by routes that call fromCamel before INSERT/UPDATE)
 *
 * Usage in a route:
 *   import { toCamel, toCamelArray } from '../../lib/serializers.js';
 *   return Response.json({ players: toCamelArray(rows) });
 */

/** Convert a single snake_case key to camelCase */
function keyToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Convert a single camelCase key to snake_case */
function keyToSnake(key) {
  return key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Recursively convert all keys of an object (or array of objects) to camelCase.
 * Safe with null / undefined / primitives / nested objects / arrays.
 */
export function toCamel(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      keyToCamel(k),
      Array.isArray(v) ? v.map(toCamel) : (v !== null && typeof v === 'object' ? toCamel(v) : v),
    ])
  );
}

/** Convenience wrapper for arrays of DB rows */
export function toCamelArray(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(toCamel);
}

/**
 * Convert camelCase keys from a frontend payload to snake_case for SQL.
 * Only converts keys — values are untouched.
 * Safe with null / undefined / primitives.
 */
export function toSnake(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [keyToSnake(k), v])
  );
}