/**
 * Application-owned API client.
 * All requests go through /api/* — no Base44 SDK, no @base44 imports.
 */

const getToken = () => localStorage.getItem('ppgk_token');

/** Safely unwrap a possibly-wrapped array response. */
export function unwrap(data, key) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  return [];
}

/**
 * Normalise snake_case keys to camelCase for objects returned by the Worker.
 * Only one level deep — nested arrays/objects are handled where needed.
 */
export function toCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      Array.isArray(v) ? v.map(toCamel) : (v && typeof v === 'object' ? toCamel(v) : v),
    ])
  );
}

let _redirecting = false;

function handleAuthFailure(status, path) {
  console.warn(`[api] ${status} on ${path} — clearing stale auth state`);
  localStorage.removeItem('ppgk_token');
  localStorage.removeItem('ppgk_user');
  // Don't redirect for auth endpoints themselves (handled by callers) or if
  // already redirecting, to avoid loops from parallel requests.
  if (!_redirecting && !path.startsWith('/auth/')) {
    _redirecting = true;
    window.location.href = '/signin';
  }
}

async function request(path, options = {}) {
  const token = getToken();
  console.debug(`[api] ${options.method || 'GET'} ${path} auth=${token ? 'yes' : 'no'}`);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  // 401 → token missing/expired/invalid: clear stale session and force re-login.
  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    handleAuthFailure(401, path);
    const error = new Error(body.message || body.error || 'Session expired. Please sign in again.');
    error.status = 401;
    error.responseBody = body;
    throw error;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.step
      ? `${body.error || 'Request failed'} at ${body.step}: ${body.message || response.status}`
      : body.message || body.error || `Request failed: ${response.status}`;
    const error = new Error(msg);
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }
  return response.json();
}

export const apiClient = {
  get:    (path)        => request(path, { method: 'GET' }),
  post:   (path, body)  => request(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    (path, body)  => request(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  (path, body)  => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path)        => request(path, { method: 'DELETE' }),

  async upload(path, formData) {
    const token = getToken();
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: formData,
    });
    if (response.status === 401) {
      const body = await response.json().catch(() => ({}));
      handleAuthFailure(401, path);
      throw new Error(body.message || body.error || 'Session expired. Please sign in again.');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Upload failed: ${response.status}`);
    }
    return response.json();
  },
};