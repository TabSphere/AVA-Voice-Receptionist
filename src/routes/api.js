import express from 'express';
import twilio from 'twilio';
import { getConfig, saveConfig, publicConfig, SECRET_KEYS, getDemoMode, setDemoMode, getBranding, setBranding } from '../lib/config.js';
import { businessNameOf } from '../ava-prompt.js';
import * as store from '../lib/store.js';

const router = express.Router();

const startedAt = Date.now();

// GET /api/status — dashboard overview.
router.get('/status', (req, res) => {
  const pub = publicConfig();
  const counts = store.countsToday();
  res.json({
    ok: true,
    services: pub.configured,
    activeCalls: store.activeCalls().map((c) => ({
      callSid: c.callSid,
      from: c.from,
      startedAt: c.startedAt,
      afterHours: c.afterHours,
      turns: c.transcript.length,
    })),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    callsToday: counts.callsToday,
    leadsToday: counts.leadsToday,
    demoMode: getDemoMode(),
    activity: store.recentActivity(20),
  });
});

// GET /api/config — masked secrets, never full secrets.
router.get('/config', (req, res) => {
  res.json(publicConfig());
});

// POST /api/config — save settings (partial saves keep stored secrets).
router.post('/config', (req, res) => {
  try {
    saveConfig(req.body || {});
    store.logActivity('config', 'Settings updated');
    res.json({ ok: true, config: publicConfig() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/public/branding — PUBLIC (exempted from auth gate in server.js).
// Used by the /login page and navbar to show the uploaded logo.
router.get('/public/branding', (req, res) => {
  const branding = getBranding();
  res.json({ logoDataUrl: branding.logoDataUrl, businessName: businessNameOf(getConfig()) });
});

const LOGO_DATA_URL_RE = /^data:image\/(png|jpe?g|svg\+xml|webp);base64,[A-Za-z0-9+/=\s]+$/;
// ~500KB binary ≈ ~680KB base64; cap the whole data URL generously below that.
const LOGO_MAX_CHARS = 700 * 1024;

// POST /api/config/logo {logoDataUrl} — store branding logo (png/jpg/svg/webp ≤ ~500KB).
router.post('/config/logo', (req, res) => {
  const logoDataUrl = req.body?.logoDataUrl;
  if (typeof logoDataUrl !== 'string' || !LOGO_DATA_URL_RE.test(logoDataUrl)) {
    return res.status(400).json({ ok: false, error: 'Logo must be a png, jpg, svg or webp image' });
  }
  if (logoDataUrl.length > LOGO_MAX_CHARS) {
    return res.status(400).json({ ok: false, error: 'Logo is too large (max ~500KB)' });
  }
  setBranding(logoDataUrl);
  store.logActivity('config', 'Branding logo updated');
  res.json({ ok: true, branding: getBranding() });
});

// DELETE /api/config/logo — remove the branding logo.
router.delete('/config/logo', (req, res) => {
  setBranding(null);
  store.logActivity('config', 'Branding logo removed');
  res.json({ ok: true });
});

// GET /api/calls
router.get('/calls', (req, res) => {
  res.json({ calls: store.listCalls() });
});

// GET /api/leads
router.get('/leads', (req, res) => {
  res.json({ leads: store.listLeads() });
});

// GET /api/bookings
router.get('/bookings', (req, res) => {
  res.json({ bookings: store.listBookings() });
});

// DELETE /api/bookings/:id
router.delete('/bookings/:id', (req, res) => {
  const ok = store.deleteBooking(req.params.id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Booking not found' });
  res.json({ ok: true });
});

// POST /api/demo {enabled:true|false} — seed or remove tagged demo data.
router.post('/demo', async (req, res) => {
  try {
    const enabled = req.body?.enabled === true;
    setDemoMode(enabled);
    if (enabled) {
      await store.seedDemo();
      store.logActivity('demo', 'Demo mode enabled — sample data loaded');
    } else {
      store.clearDemo();
    }
    res.json({ ok: true, demoMode: enabled });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/test/:service — lightweight real connectivity checks.
// ---------------------------------------------------------------------------

async function testOpenAI() {
  const { OPENAI_API_KEY } = getConfig();
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  const r = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  });
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return `Connected — ${data.data.length} models available`;
}

async function testElevenLabs() {
  const { ELEVENLABS_API_KEY } = getConfig();
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key not configured');
  const r = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  });
  if (!r.ok) throw new Error(`ElevenLabs error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return `Connected — ${data.voices.length} voices available`;
}

function twilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getConfig();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

async function testTwilio() {
  const { TWILIO_ACCOUNT_SID } = getConfig();
  const account = await twilioClient().api.accounts(TWILIO_ACCOUNT_SID).fetch();
  return `Connected — account "${account.friendlyName}" is ${account.status}`;
}

async function testWhatsapp() {
  const cfg = getConfig();
  if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }
  const from = cfg.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const to = cfg.FREDERICK_WHATSAPP || 'whatsapp:+447593836195';
  return (
    `Twilio credentials present. WhatsApp sender: ${from}, recipient: ${to}. ` +
    `To activate the sandbox: from the recipient phone, send "join <your-sandbox-code>" to ${from.replace('whatsapp:', '')} on WhatsApp, ` +
    `then a lead notification will arrive there. (Find the sandbox code in Twilio Console → Messaging → Try it out → Send a WhatsApp message.)`
  );
}

router.post('/test/:service', async (req, res) => {
  const { service } = req.params;
  try {
    let message;
    if (service === 'openai') message = await testOpenAI();
    else if (service === 'elevenlabs') message = await testElevenLabs();
    else if (service === 'twilio') message = await testTwilio();
    else if (service === 'whatsapp') message = await testWhatsapp();
    else return res.status(404).json({ ok: false, error: `Unknown service: ${service}` });
    res.json({ ok: true, message });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

/** Guard: belt-and-braces check that no secret ever leaves the API. */
export function assertNoSecrets(payload) {
  const cfg = getConfig();
  const str = JSON.stringify(payload);
  for (const key of SECRET_KEYS) {
    const v = cfg[key];
    if (v && str.includes(v)) {
      throw new Error(`Refusing to leak secret ${key}`);
    }
  }
  return payload;
}

export default router;
