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


// 7. Business Brain fields appear in buildSystemPrompt
{
  const { buildSystemPrompt, GREETINGS, greetingFor } = await import('../src/ava-prompt.js');
  const prompt = buildSystemPrompt({
    BUSINESS_NAME: 'Acme Widgets Ltd',
    BUSINESS_ABOUT: 'We make shiny widgets in Dundee.',
    BUSINESS_SERVICES: 'Widgets from £99.',
    BUSINESS_FAQS: 'Q: Do you deliver? A: Yes, UK wide.',
    BUSINESS_CUSTOM: 'Always mention the widget guarantee.',
  });
  assert('prompt uses custom business name', prompt.includes('Acme Widgets Ltd'));
  assert('prompt includes About', prompt.includes('shiny widgets in Dundee'));
  assert('prompt includes Services', prompt.includes('Widgets from £99'));
  assert('prompt includes FAQs', prompt.includes('Do you deliver?'));
  assert('prompt includes Custom Instructions', prompt.includes('widget guarantee'));
  assert('prompt includes BUSINESS KNOWLEDGE header', prompt.includes('BUSINESS KNOWLEDGE'));
  assert('prompt teaches SEND_PRICING token', prompt.includes('[SEND_PRICING]'));
  assert('prompt teaches BOOK token', prompt.includes('[BOOK:YYYY-MM-DD HH:MM'));
  assert('prompt injects current date', /Today's date is .*20\d\d/.test(prompt));

  const def = buildSystemPrompt({});
  assert('defaults fall back to TabSphere', def.includes('TabSphere Limited') && def.includes('Starter from £499'));
  const greet = greetingFor({ BUSINESS_NAME: 'Acme Widgets Ltd' }, false);
  assert('greeting uses business name', greet.includes("you've reached Acme Widgets Ltd"));
  assert('default greeting uses TabSphere', GREETINGS.standard.includes("you've reached TabSphere Limited"));
}

// 8. [SEND_PRICING] token: stripped + SMS skipped gracefully without Twilio
{
  const { processReply } = await import('../src/routes/voice.js');
  // Config earlier in these tests set TWILIO_ACCOUNT_SID but no token/number → not configured.
  const r = await processReply(
    "Absolutely, I'll text that over right now. [SEND_PRICING]",
    { callSid: 'CAtoken1', from: '+447700900555' }
  );
  assert('SEND_PRICING stripped from spoken reply', !r.spoken.includes('[SEND_PRICING]') && !r.spoken.includes('SEND_PRICING'));
  assert('spoken reply intact', r.spoken.includes("I'll text that over right now"));
  assert('no crash without Twilio + no fallback line spoken', !r.spoken.includes('Frederick will text you shortly'));
}

// 9. [BOOK:...] valid → stored; clash rejected; GET /api/bookings (authed)
{
  const { processReply, londonWallToDate } = await import('../src/routes/voice.js');

  // Find the next Mon–Sat date (London) at 10:30.
  function nextSlot() {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    for (let i = 1; i < 10; i++) {
      const d = new Date(Date.now() + i * 86400e3);
      const parts = fmt.formatToParts(d);
      const get = (t) => parts.find((x) => x.type === t).value;
      if (get('weekday') === 'Sun') continue;
      return `${get('year')}-${get('month')}-${get('day')} 10:30`;
    }
    throw new Error('no slot found');
  }
  const slot = nextSlot();
  assert('londonWallToDate parses', londonWallToDate(slot) instanceof Date && !Number.isNaN(londonWallToDate(slot)));

  const ok = await processReply(
    `Lovely, that's booked for you. [BOOK:${slot} | Test Caller | +447700900777 | website consultation]`,
    { callSid: 'CAbook1', from: '+447700900777' }
  );
  assert('BOOK token stripped from spoken reply', !ok.spoken.includes('[BOOK') && !ok.spoken.includes('BOOK:'));

  const { bookings } = await (await authFetch(`${base}/api/bookings`)).json();
  const saved = bookings.find((b) => b.name === 'Test Caller');
  assert('booking stored + returned by GET /api/bookings', Boolean(saved));
  assert('booking has startISO + service', saved && saved.startISO && saved.service === 'website consultation');
  assert('GET /api/bookings requires auth', (await fetch(`${base}/api/bookings`)).status === 401);

  // Clash: same slot again → NOT saved, alternatives offered (no OpenAI → fallback line).
  const clash = await processReply(
    `Booking that now. [BOOK:${slot} | Second Caller | +447700900778 | consultation]`,
    {
      callSid: 'CAbook2',
      from: '+447700900778',
      // OpenAI unreachable in tests → regeneration fails → spoken fallback line.
      regenerate: async () => { throw new Error('OPENAI_API_KEY is not configured'); },
    }
  );
  assert('clash not saved', !(await (await authFetch(`${base}/api/bookings`)).json()).bookings.some((b) => b.name === 'Second Caller'));
  assert('clash reply asks for another time', /another time/i.test(clash.spoken), clash.spoken);

  // Past slot rejected too.
  const past = await processReply(
    'Sure. [BOOK:2020-01-06 10:00 | Past Caller | +447700900779 | consultation]',
    { callSid: 'CAbook3', from: '+447700900779', regenerate: async () => { throw new Error('no OpenAI'); } }
  );
  assert('past slot not saved', !(await (await authFetch(`${base}/api/bookings`)).json()).bookings.some((b) => b.name === 'Past Caller'));

  // DELETE /api/bookings/:id
  const del = await authFetch(`${base}/api/bookings/${saved.id}`, { method: 'DELETE' });
  assert('DELETE booking ok', del.status === 200 && (await del.json()).ok === true);
  assert('booking gone after delete', !(await (await authFetch(`${base}/api/bookings`)).json()).bookings.some((b) => b.id === saved.id));
  assert('DELETE unknown booking 404', (await authFetch(`${base}/api/bookings/nope`, { method: 'DELETE' })).status === 404);
}

// 10. Demo mode includes 2 sample bookings and clears them
{
  await authFetch(`${base}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  const { bookings } = await (await authFetch(`${base}/api/bookings`)).json();
  const demos = bookings.filter((b) => b.demo === true);
  assert('demo seeds 2 bookings', demos.length === 2, String(demos.length));
  await authFetch(`${base}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
  const after = await (await authFetch(`${base}/api/bookings`)).json();
  assert('demo bookings removed', after.bookings.every((b) => b.demo !== true));
}

// 11. Warm transfer whisper TwiML (Twilio webhooks — no auth required)
{
  const w = await fetch(`${base}/whisper?name=Sarah&number=%2B447700900111&reason=Website%20is%20down`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'CallSid=CAwhisper1',
  });
  const wt = await w.text();
  assert('POST /whisper 200 without auth', w.status === 200);
  assert('whisper has Gather numDigits=1', wt.includes('<Gather') && wt.includes('numDigits="1"'), wt.slice(0, 300));
  assert('whisper action is /whisper-decision', wt.includes('action="/whisper-decision"'));
  assert('whisper uses Polly.Amy (cheap voice)', wt.includes('Polly.Amy') && !wt.includes('elevenlabs'));
  assert('whisper announces caller + reason', wt.includes('Sarah') && wt.includes('Website is down'));
  assert('whisper offers press-1 / voicemail choice', /Press 1 to connect/i.test(wt) && /voicemail/i.test(wt));

  const d1 = await fetch(`${base}/whisper-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'Digits=1',
  });
  const d1t = await d1.text();
  assert('whisper-decision Digits=1 connects', d1.status === 200 && d1t.includes('Connecting you now') && !d1t.includes('<Hangup'));
  const d2 = await fetch(`${base}/whisper-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'Digits=2',
  });
  assert('whisper-decision other digit hangs up', (await d2.text()).includes('<Hangup'));
}

// 12. Public branding endpoint + logo upload/remove roundtrip
{
  const pub = await fetch(`${base}/api/public/branding`);
  const pubJ = await pub.json();
  assert('GET /api/public/branding 200 without auth', pub.status === 200);
  assert('branding has logoDataUrl + businessName', 'logoDataUrl' in pubJ && typeof pubJ.businessName === 'string');

  // Tiny valid png data URL (1x1 px).
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await authFetch(`${base}/api/config/logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logoDataUrl: png }),
  });
  assert('POST /api/config/logo ok', up.status === 200 && (await up.json()).ok === true);
  const pub2 = await (await fetch(`${base}/api/public/branding`)).json();
  assert('logo visible on public branding', pub2.logoDataUrl === png);

  // Logo survives a normal config save (stored outside ALL_KEYS).
  await authFetch(`${base}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ BUSINESS_NAME: 'TabSphere Limited' }),
  });
  const pub3 = await (await fetch(`${base}/api/public/branding`)).json();
  assert('logo survives config save', pub3.logoDataUrl === png);

  const bad = await authFetch(`${base}/api/config/logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logoDataUrl: 'data:text/html;base64,PGI+aGk=' }),
  });
  assert('logo rejects non-image type', bad.status === 400);

  const del = await authFetch(`${base}/api/config/logo`, { method: 'DELETE' });
  assert('DELETE /api/config/logo ok', del.status === 200);
  const pub4 = await (await fetch(`${base}/api/public/branding`)).json();
  assert('logo removed', pub4.logoDataUrl === '');

  // Auth gate still blocks unauthenticated config + logo endpoints.
  assert('GET /api/config 401 unauthenticated', (await fetch(`${base}/api/config`)).status === 401);
  const noauth = await fetch(`${base}/api/config/logo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logoDataUrl: png }),
  });
  assert('POST /api/config/logo 401 unauthenticated', noauth.status === 401);
}

// 13. Website in the brain + escalation whisper URL helper
{
  const { buildSystemPrompt, websiteOf } = await import('../src/ava-prompt.js');
  const prompt = buildSystemPrompt({});
  assert('default website is tabsphere', websiteOf({}) === 'www.tabsphere.co.uk');
  assert('prompt includes company website', prompt.includes('www.tabsphere.co.uk'));
  assert('prompt may mention website to callers', /see our work at tabsphere dot co dot uk/i.test(prompt));
  const custom = buildSystemPrompt({ BUSINESS_WEBSITE: 'www.example.com' });
  assert('website configurable via BUSINESS_WEBSITE', custom.includes('www.example.com'));

  const { whisperUrlFor } = await import('../src/routes/voice.js');
  const url = whisperUrlFor(
    { headers: {}, protocol: 'https', get: () => 'host.example' },
    { name: 'Sarah', number: '+447700900111', reason: 'down' }
  );
  assert('whisper URL uses PUBLIC_URL from config', url.startsWith('https://example.ngrok.io/whisper?'), url);
  assert('whisper URL carries params', url.includes('name=Sarah') && url.includes('reason=down'));
}

server.close();
fs.rmSync(tmpData, { recursive: true, force: true });console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
