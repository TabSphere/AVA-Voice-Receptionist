/**
 * Smoke tests — no external API calls.
 * Run: node test/smoke.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'ava-test-'));
process.env.AVA_DATA_DIR = tmpData;

const { createApp } = await import('../src/server.js');
const { SECRET_KEYS, getConfig } = await import('../src/lib/config.js');

let passed = 0;
let failed = 0;
function assert(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name} ${extra}`);
  }
}

const app = createApp();
const server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;

// --- 0. Auth: login lock ---
let sessionCookie = '';
const PASSWORD = 'test-password-123';
{
  // Unauthenticated: HTML requests redirect, API requests 401.
  const r = await fetch(`${base}/`, { redirect: 'manual', headers: { Accept: 'text/html' } });
  assert('GET / redirects to /login', r.status === 302 && r.headers.get('location') === '/login');
  const apiR = await fetch(`${base}/api/status`);
  assert('GET /api/status 401 unauthenticated', apiR.status === 401);

  // Status endpoint is public.
  const st = await (await fetch(`${base}/api/auth/status`, { headers: { Cookie: sessionCookie } })).json();
  assert('auth status setup=false before setup', st.setup === false && st.authed === false);

  // Login page serves.
  const lp = await fetch(`${base}/login`);
  const lpText = await lp.text();
  assert('GET /login 200 HTML', lp.status === 200 && lpText.includes('AVA'));

  // Short password rejected.
  const short = await fetch(`${base}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'short' }),
  });
  assert('setup rejects <8 chars', short.status === 400);

  // Setup creates password + session.
  const setup = await fetch(`${base}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert('POST /api/auth/setup ok', setup.status === 200);
  const setCookie = setup.headers.get('set-cookie') || '';
  assert('setup sets ava_session cookie', setCookie.includes('ava_session=') && setCookie.includes('HttpOnly'));
  sessionCookie = setCookie.split(';')[0];

  // Setup again -> 403.
  const again = await fetch(`${base}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'another-password-9' }),
  });
  assert('setup again 403', again.status === 403);

  // Authed status now true.
  const st2 = await (await fetch(`${base}/api/auth/status`, { headers: { Cookie: sessionCookie } })).json();
  assert('auth status authed=true with cookie', st2.setup === true && st2.authed === true);

  // Authed /api/status works.
  const authed = await fetch(`${base}/api/status`, { headers: { Cookie: sessionCookie } });
  assert('GET /api/status 200 authed', authed.status === 200);

  // Logout, then wrong + right login.
  await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: sessionCookie } });
  const bad = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password-x' }),
  });
  assert('wrong login 401', bad.status === 401);
  const good = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert('right login 200 + cookie', good.status === 200 && (good.headers.get('set-cookie') || '').includes('ava_session='));
  sessionCookie = (good.headers.get('set-cookie') || '').split(';')[0];

  // Twilio webhook works WITHOUT auth.
  const voice = await fetch(`${base}/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'CallSid=CAauthcheck&From=%2B447700900999',
  });
  const voiceText = await voice.text();
  assert('POST /voice 200 TwiML without auth', voice.status === 200 && voiceText.includes('<Response>'));

  // Rate limit: 5 bad logins -> 429 (1 already used above).
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r2 = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password-x' }),
    });
    last = r2.status;
  }
  assert('rate limit 429 after 5 failures', last === 429, `last=${last}`);
  // Successful login still works for a different "IP" — same IP here is limited,
  // so use the already-valid session cookie for the remaining tests.
}

// Authenticated fetch for all remaining tests.
const authFetch = (url, options = {}) =>
  fetch(url, { ...options, headers: { ...(options.headers || {}), Cookie: sessionCookie } });

// 1. /api/status shape
{
  const r = await authFetch(`${base}/api/status`);
  const j = await r.json();
  assert('/api/status 200', r.status === 200);
  assert(
    '/api/status shape',
    j.ok === true &&
      typeof j.services === 'object' &&
      'twilio' in j.services && 'openai' in j.services &&
      'elevenlabs' in j.services && 'whatsapp' in j.services &&
      Array.isArray(j.activeCalls) &&
      typeof j.uptimeSec === 'number' &&
      typeof j.callsToday === 'number' &&
      typeof j.leadsToday === 'number' &&
      typeof j.demoMode === 'boolean' &&
      Array.isArray(j.activity),
    JSON.stringify(j).slice(0, 200)
  );
}

// 2. Config roundtrip with masked secrets
{
  const secret = 'sk-testsecret1234567890abcd';
  const r = await authFetch(`${base}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      OPENAI_API_KEY: secret,
      TWILIO_ACCOUNT_SID: 'AC1234567890',
      PUBLIC_URL: 'https://example.ngrok.io',
    }),
  });
  assert('POST /api/config 200', r.status === 200);
  const g = await (await authFetch(`${base}/api/config`)).json();
  assert('config saved non-secret', g.TWILIO_ACCOUNT_SID === 'AC1234567890');
  assert('config secret masked', g.OPENAI_API_KEY === 'sk-...abcd', g.OPENAI_API_KEY);
  assert('secret not in response', !JSON.stringify(g).includes(secret));
  assert('configured flag set', g.configured.openai === true);

  // Partial save with masked value must not wipe stored secret
  await authFetch(`${base}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ OPENAI_API_KEY: g.OPENAI_API_KEY, OPENAI_MODEL: 'gpt-4o-mini' }),
  });
  assert(
    'partial save keeps stored secret',
    getConfig().OPENAI_API_KEY === secret,
    getConfig().OPENAI_API_KEY
  );
}

// 3. Secrets never appear in any API response
{
  const cfg = getConfig();
  const responses = await Promise.all([
    authFetch(`${base}/api/status`).then((r) => r.text()),
    authFetch(`${base}/api/config`).then((r) => r.text()),
    authFetch(`${base}/api/calls`).then((r) => r.text()),
    authFetch(`${base}/api/leads`).then((r) => r.text()),
  ]);
  for (const key of SECRET_KEYS) {
    const v = cfg[key];
    if (!v) continue;
    for (const body of responses) {
      assert(`secret ${key} not leaked`, !body.includes(v));
    }
  }
}

// 4. POST /voice returns TwiML
{
  const r = await fetch(`${base}/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'CallSid=CAtest123&From=%2B447700900123',
  });
  const text = await r.text();
  assert('POST /voice 200', r.status === 200);
  assert('POST /voice TwiML', text.includes('<?xml') && text.includes('<Response>'), text.slice(0, 120));
  assert(
    'TwiML greets and gathers',
    (text.includes('<Say') || text.includes('<Play')) && text.includes('<Gather')
  );
}

// 5. Voice call writes to store
{
  const { calls } = await (await authFetch(`${base}/api/calls`)).json();
  const call = calls.find((c) => c.callSid === 'CAtest123');
  assert('call written to store', Boolean(call));
  assert('call has transcript', call && call.transcript.length >= 1);
  const { activeCalls } = await (await authFetch(`${base}/api/status`)).json();
  assert('call shows active', activeCalls.some((c) => c.callSid === 'CAtest123'));
  assert('db.json persisted', fs.existsSync(path.join(tmpData, 'db.json')));
}

// 6. Demo mode seeds and clears tagged data
{
  const on = await authFetch(`${base}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  const onJ = await on.json();
  assert('POST /api/demo enable 200', on.status === 200 && onJ.ok === true && onJ.demoMode === true);

  const { calls } = await (await authFetch(`${base}/api/calls`)).json();
  const { leads } = await (await authFetch(`${base}/api/leads`)).json();
  const demoCalls = calls.filter((c) => c.demo === true);
  const demoLeads = leads.filter((l) => l.demo === true);
  assert('demo seeds 6-8 calls', demoCalls.length >= 6 && demoCalls.length <= 8, String(demoCalls.length));
  assert('demo seeds 4-5 leads', demoLeads.length >= 4 && demoLeads.length <= 5, String(demoLeads.length));
  assert('demo calls have transcripts', demoCalls.every((c) => c.transcript.length >= 2));
  assert('demo has URGENT lead', demoLeads.some((l) => l.urgencyLevel === 'URGENT'));
  assert('demo has HIGH VALUE lead', demoLeads.some((l) => l.urgencyLevel === 'HIGH VALUE'));
  const st = await (await authFetch(`${base}/api/status`)).json();
  assert('status reports demoMode true', st.demoMode === true);

  const realCall = calls.find((c) => c.callSid === 'CAtest123');
  assert('real call untouched by demo', Boolean(realCall) && realCall.demo !== true);

  const off = await authFetch(`${base}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
  const offJ = await off.json();
  assert('POST /api/demo disable ok', off.status === 200 && offJ.ok === true && offJ.demoMode === false);
  const after = await (await authFetch(`${base}/api/calls`)).json();
  const afterLeads = await (await authFetch(`${base}/api/leads`)).json();
  assert('demo calls removed', after.calls.every((c) => c.demo !== true));
  assert('demo leads removed', afterLeads.leads.every((l) => l.demo !== true));
  assert('real call survives demo clear', after.calls.some((c) => c.callSid === 'CAtest123'));
  const st2 = await (await authFetch(`${base}/api/status`)).json();
  assert('status reports demoMode false', st2.demoMode === false);
}

server.close();
fs.rmSync(tmpData, { recursive: true, force: true });console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
