/**
 * Application-owned API client.
 * All requests go through /api/* — no Base44 SDK, no @base44 imports.
 */

const getToken = () => localStorage.getItem('ppgk_token');

export const apiClient = {
  async get(path) {
    const response = await fetch(`/api${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      credentials: 'include',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }
    return response.json();
  },

  async post(path, body) {
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }
    return response.json();
  },

  async put(path, body) {
    const response = await fetch(`/api${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }
    return response.json();
  },

  async patch(path, body) {
    const response = await fetch(`/api${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }
    return response.json();
  },

  async delete(path) {
    const response = await fetch(`/api${path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      credentials: 'include',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Request failed: ${response.status}`);
    }
    return response.json();
  },

  async upload(path, formData) {
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
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