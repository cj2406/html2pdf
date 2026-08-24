import { API_BASE_URL } from '../config.js';

const CSRF_COOKIE = 'h2p_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (MUTATING_METHODS.has(method)) {
    // Double-submit CSRF: the backend set this cookie on login/signup;
    // we read it (it's deliberately NOT httpOnly) and echo it back as a
    // header. The session cookie itself stays httpOnly and rides along
    // automatically via `credentials: 'include'`.
    const csrfToken = readCookie(CSRF_COOKIE);
    if (csrfToken) headers[CSRF_HEADER] = csrfToken;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  signup: (email, password) => request('/api/auth/signup', { method: 'POST', body: { email, password } }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  rotateKey: () => request('/api/auth/api-keys/rotate', { method: 'POST' }),
  plans: () => request('/api/billing/plans'),
  subscribe: (planId, provider) => request('/api/billing/subscribe', { method: 'POST', body: { planId, provider } }),
  verifyPayment: (reference, provider) => request(`/api/billing/verify/${reference}?provider=${provider}`),
  history: () => request('/api/billing/history'),
};

// Lightweight, non-authoritative signal for UI only (e.g. "show Dashboard
// vs Log in" in the nav). The backend independently re-verifies the real
// httpOnly session cookie on every request regardless of this.
export function isLoggedIn() {
  return !!readCookie(CSRF_COOKIE);
}

/** Directly fetch the API-key-scoped usage endpoint (not part of the cookie session). */
export async function fetchUsageWithApiKey(apiKey) {
  const res = await fetch(`${API_BASE_URL}/api/v1/usage`, { headers: { 'X-API-Key': apiKey } });
  if (!res.ok) return null;
  return res.json();
}
