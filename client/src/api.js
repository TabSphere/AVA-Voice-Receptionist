async function req(path, options) {
  const r = await fetch(path, options);
  if (r.status === 401) {
    window.location = '/login';
    throw new Error('auth required');
  }
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Bad response (${r.status})`);
  }
}

export const api = {
  status: () => req('/api/status'),
  config: () => req('/api/config'),
  saveConfig: (body) =>
    req('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  calls: () => req('/api/calls'),
  leads: () => req('/api/leads'),
  bookings: () => req('/api/bookings'),
  cancelBooking: (id) => req(`/api/bookings/${id}`, { method: 'DELETE' }),
  test: (service) => req(`/api/test/${service}`, { method: 'POST' }),
  branding: () => req('/api/public/branding'),
  uploadLogo: (logoDataUrl) =>
    req('/api/config/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoDataUrl }),
    }),
  removeLogo: () => req('/api/config/logo', { method: 'DELETE' }),
  changePassword: (current, next) =>
    req('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, next }),
    }),
  setDemo: (enabled) =>
    req('/api/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
};
