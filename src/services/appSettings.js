/**
 * Normalisation layer for app_settings.
 *
 * The D1 table stores rows as { key, value, data_type } with snake_case keys
 * and string values. The Worker converts these to a flat key:value object,
 * but this layer defends against every response shape the page might receive:
 *   - a plain object            { advance_booking_weeks: 4, ... }
 *   - a wrapped object/array    { settings: {...} } or { settings: [...] }
 *   - raw D1 rows               [{ key, value, data_type }, ...]
 *   - camelCase keys            { advanceBookingWeeks: '4', ... }
 *   - string-typed values       'true', '4'
 *
 * Frontend state and the database both use snake_case keys.
 */

const camelToSnake = (key) => key.replace(/([A-Z])/g, '_$1').toLowerCase();

/** Convert true, 'true', 1, '1' to true; everything else to false. */
export function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/** Coerce a raw D1 row value using its data_type column. */
function coerceByDataType(value, dataType) {
  if (dataType === 'boolean') return toBool(value);
  if (dataType === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }
  if (dataType === 'json') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value ?? '';
}

/**
 * Convert any settings API response into a flat snake_case object typed
 * according to `types` — a map of setting key → 'number' | 'boolean' | string.
 * Unknown keys are preserved untouched so settings not shown in the UI
 * survive a load → save round trip.
 */
export function normalizeAppSettings(response, types = {}) {
  let raw = response;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.settings !== undefined) {
    raw = raw.settings;
  }

  const flat = {};
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const key = row.key ?? row.setting_key;
      if (key === undefined) continue;
      flat[camelToSnake(key)] = coerceByDataType(row.value, row.data_type ?? row.dataType);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      flat[camelToSnake(key)] = value;
    }
  }

  const settings = { ...flat };
  for (const [key, type] of Object.entries(types)) {
    const value = flat[key];
    if (type === 'boolean') {
      settings[key] = toBool(value);
    } else if (type === 'number') {
      settings[key] = value === '' || value === null || value === undefined ? '' : Number(value);
    } else {
      settings[key] = value === null || value === undefined ? '' : String(value);
    }
  }
  return settings;
}

/**
 * Prepare form state for PUT: coerce each value to its declared type so the
 * Worker stores canonical strings ('true'/'false', '24') and can infer
 * data_type for any new key. Keys stay snake_case, matching the database.
 */
export function serializeAppSettings(settings, types = {}) {
  const body = {};
  for (const [key, value] of Object.entries(settings)) {
    const type = types[key];
    if (type === 'boolean') {
      body[key] = toBool(value);
    } else if (type === 'number') {
      body[key] = value === '' || value === null || value === undefined ? '' : Number(value);
    } else {
      body[key] = value === null || value === undefined ? '' : value;
    }
  }
  return body;
}
