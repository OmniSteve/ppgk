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

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${response.status}`);
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
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Upload failed: ${response.status}`);
    }
    return response.json();
  },
};