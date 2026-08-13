// Every network call in the app goes through this module. Centralising it means
// error shapes, auth headers, and JSON handling are defined once instead of
// being re-implemented slightly differently in each component.

const TOKEN_KEY = 'asett.reviewer.token';
const NAME_KEY = 'asett.reviewer.name';

/**
 * Errors carry the server's per-field `errors` map alongside the message, so a
 * form can render field-level messages and a page can render a banner from the
 * same thrown object.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, errors = {}, reason } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.reason = reason;
  }
}

/* --------------------------------------------------------- token storage -- */
// sessionStorage, not localStorage: the token dies with the tab, which is the
// closer match to "a reviewer session" and limits how long a token sits on a
// shared machine. It is still readable by any script on the origin - see
// ARCHITECTURE.md on why a real deployment would use an httpOnly cookie.

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  getName: () => sessionStorage.getItem(NAME_KEY),
  set: (token, name) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (name) sessionStorage.setItem(NAME_KEY, name);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(NAME_KEY);
  },
};

/* ----------------------------------------------------------------- core -- */

async function request(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (body !== undefined) finalHeaders['content-type'] = 'application/json';
  if (auth) {
    const token = tokenStore.get();
    if (token) finalHeaders.authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects on a transport failure, so this really is "the server
    // is unreachable" rather than "the server said no".
    throw new ApiError('Could not reach the server. Check that the API is running.');
  }

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // The in-memory token store is emptied when the API restarts, which shows up
    // here as a 401 on a token that used to work. Clearing it locally sends the
    // reviewer back to the login screen instead of leaving the UI wedged.
    if (res.status === 401 && auth) tokenStore.clear();

    throw new ApiError(payload?.error || 'Request failed.', {
      status: res.status,
      errors: payload?.errors,
      reason: payload?.reason,
    });
  }

  return payload;
}

/* ------------------------------------------------------------- endpoints -- */

export const api = {
  reference: () => request('/api/reference'),

  requestVerificationCode: (email) =>
    request('/api/verification/request', { method: 'POST', body: { email } }),

  verifyCode: (email, code) =>
    request('/api/verification/verify', { method: 'POST', body: { email, code } }),

  searchOrganizations: (query) =>
    request(`/api/organizations?q=${encodeURIComponent(query)}`),

  createOrganization: (organization) =>
    request('/api/organizations', { method: 'POST', body: organization }),

  submitComplaint: (payload, verificationToken) =>
    request('/api/complaints', {
      method: 'POST',
      body: payload,
      headers: { 'x-verification-token': verificationToken },
    }),

  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),

  logout: () => request('/api/auth/logout', { method: 'POST', auth: true }),

  listComplaints: (status) =>
    request(`/api/complaints${status ? `?status=${encodeURIComponent(status)}` : ''}`, {
      auth: true,
    }),

  getComplaint: (id) => request(`/api/complaints/${id}`, { auth: true }),

  reviewComplaint: (id, action, note) =>
    request(`/api/complaints/${id}/reviews`, {
      method: 'POST',
      body: { action, note },
      auth: true,
    }),
};
