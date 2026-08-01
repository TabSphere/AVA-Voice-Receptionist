import express from 'express';
import twilio from 'twilio';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSystemPrompt, GREETINGS, greetingFor, businessNameOf } from '../ava-prompt.js';
import { getChatReply, extractLeadSummary, transcribeAudio } from '../lib/openai.js';
import { synthesize } from '../lib/tts.js';
import { notifyLead, notifyVoicemail, sendSms, sendWhatsApp, smsConfigured } from '../lib/notify.js';
import { getConfig } from '../lib/config.js';
import * as store from '../lib/store.js';

const router = express.Router();

const MAX_REPROMPTS = 2;

// Conversation state keyed by CallSid
const conversations = new Map();

function frederickNumber() {
  return getConfig().FREDERICK_NUMBER || '+447593836195';
}

/** UK time check: business hours Mon–Sat 09:00–18:00 Europe/London. */
export function isAfterHours(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  if (weekday === 'Sun') return true;
  return hour < 9 || hour >= 18;
}

function publicUrlFor(audioPath) {
  return `${(getConfig().PUBLIC_URL || '').replace(/\/$/, '')}${audioPath}`;
}

/** Absolute base URL for Twilio to call back — config PUBLIC_URL, else the request host. */
function baseUrl(req) {
  const cfg = (getConfig().PUBLIC_URL || '').replace(/\/$/, '');
  if (cfg) return cfg;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

/** Build the whisper URL for a warm transfer <Number url="...">. */
export function whisperUrlFor(req, { name, number, reason } = {}) {
  const params = new URLSearchParams({
    name: name || '',
    number: number || '',
    reason: reason || '',
  });
  return `${baseUrl(req)}/whisper?${params.toString()}`;
}


// ---------------------------------------------------------------------------
// Booking availability + tool-token processing
// ---------------------------------------------------------------------------

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function availConfig() {
  const cfg = getConfig();
  return {
    days: new Set((cfg.AVAIL_DAYS || 'mon,tue,wed,thu,fri,sat').split(',').map((d) => d.trim().toLowerCase())),
    startHour: Number(cfg.AVAIL_START_HOUR || 9),
    endHour: Number(cfg.AVAIL_END_HOUR || 18),
    slotMinutes: Number(cfg.AVAIL_SLOT_MINUTES || 30),
    tz: cfg.AVAIL_TIMEZONE || 'Europe/London',
  };
}

function londonParts(date, tz = 'Europe/London') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    weekday: get('weekday').slice(0, 3).toLowerCase(),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

/** Convert a Europe/London wall time (YYYY-MM-DD HH:MM) to a Date instant. */
export function londonWallToDate(dateStr, tz = 'Europe/London') {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(utc));
    const get = (t) => Number(p.find((x) => x.type === t)?.value);
    const seen = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    if (seen === target) break;
    utc += target - seen;
  }
  const result = new Date(utc);
  // sanity: wall time must round-trip
  const check = londonParts(result, tz);
  if (check.year !== y || check.month !== mo || check.day !== d || check.hour !== h || check.minute !== mi) {
    return null;
  }
  return result;
}

/** Validate a requested booking slot. Returns { ok:true, start } or { ok:false, reason }. */
export function validateSlot(start) {
  const avail = availConfig();
  if (!start || Number.isNaN(start.getTime())) return { ok: false, reason: 'unparseable date/time' };
  if (start.getTime() <= Date.now()) return { ok: false, reason: 'in the past' };
  const p = londonParts(start, avail.tz);
  if (!avail.days.has(p.weekday)) return { ok: false, reason: 'day not available' };
  const mins = p.hour * 60 + p.minute;
  if (mins < avail.startHour * 60 || mins + avail.slotMinutes > avail.endHour * 60) {
    return { ok: false, reason: 'outside opening hours' };
  }
  if (store.findBookingAt(start.toISOString())) return { ok: false, reason: 'slot already booked' };
  return { ok: true, start };
}

function gcalLink(start, businessName, service, tz = 'Europe/London') {
  const p = londonParts(start, tz);
  const end = new Date(start.getTime() + availConfig().slotMinutes * 60e3);
  const pe = londonParts(end, tz);
  const f = (x) => String(x).padStart(2, '0');
  const stamp = (q) => `${q.year}${f(q.month)}${f(q.day)}T${f(q.hour)}${f(q.minute)}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Call with ${businessName}`,
    dates: `${stamp(p)}/${stamp(pe)}`,
    details: `Phone consultation with ${businessName} — ${service}.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function pricingSmsBody() {
  const cfg = getConfig();
  const name = businessNameOf(cfg);
  const link = cfg.PRICING_LINK || 'https://tabsphere.co.uk';
  return `Hi, it's Ava from ${name}! Our websites: Starter from £499, Business from £799, E-Commerce from £1,200 — every project includes £500+ of free bonuses. Details: ${link} — Frederick: +44 7593 836195`;
}

/**
 * Send the pricing SMS to the caller.
 * Returns 'sent' | 'failed' | 'skipped' (never throws).
 */
export async function sendPricingSms(to, callSid = '') {
  if (!to) return 'skipped';
  if (!smsConfigured()) return 'skipped';
  const ok = await sendSms(to, pricingSmsBody());
  if (ok) {
    store.logActivity('sms', `Pricing summary texted to ${to}${callSid ? ` (call ${callSid})` : ''}`);
    return 'sent';
  }
  store.logActivity('sms', `Pricing SMS to ${to} FAILED — Frederick to follow up`);
  return 'failed';
}

/**
 * Attempt to book a slot from a [BOOK:...] token body.
 * Returns { ok, booking?, reason? } — never throws.
 */
export async function bookFromToken(body, { from } = {}) {
  const parts = body.split('|').map((x) => x.trim());
  const [dateTime, name, phone, service] = parts;
  if (!dateTime || !name || !service) return { ok: false, reason: 'missing details' };
  const start = londonWallToDate(dateTime);
  const v = validateSlot(start);
  if (!v.ok) return { ok: false, reason: v.reason };
  const booking = store.addBooking({
    name,
    phone: phone || from || null,
    service,
    startISO: start.toISOString(),
  });

  const cfg = getConfig();
  const biz = businessNameOf(cfg);
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(start);

  // SMS confirmation to the caller (skip silently if not configured).
  const smsTo = phone || from;
  if (smsTo && smsConfigured()) {
    const link = gcalLink(start, biz, service);
    const ok = await sendSms(
      smsTo,
      `Hi ${name}, it's Ava from ${biz} — your ${service} is booked for ${when}. Add to calendar: ${link}`
    );
    if (ok) store.logActivity('sms', `Booking confirmation texted to ${smsTo}`);
  }
  // WhatsApp heads-up to Frederick.
  await sendWhatsApp(`New booking: ${name}, ${service}, ${when}`);
  return { ok: true, booking };
}

const SMS_FALLBACK = "I've noted that, Frederick will text you shortly";

/**
 * Process tool tokens in an OpenAI reply.
 * @returns {Promise<{spoken:string, escalate:boolean}>}
 */
export async function processReply(reply, { callSid, from, regenerate } = {}) {
  const escalate = reply.includes('[ESCALATE]');
  let text = reply;

  const bookMatch = text.match(/\[BOOK:([^\]]+)\]/);
  if (bookMatch) {
    const result = await bookFromToken(bookMatch[1], { from }).catch((e) => {
      console.error('Booking failed:', e.message);
      return { ok: false, reason: 'error' };
    });
    if (!result.ok && regenerate) {
      // Slot invalid/clash — ask the brain to offer alternatives instead.
      const regen = await regenerate(
        `That slot is unavailable (${result.reason}). Offer alternative times within opening hours and ask the caller to pick one. Do not output a [BOOK:...] token yet.`
      ).catch(() => null);
      if (regen) {
        text = regen;
      } else {
        text = text.replace(bookMatch[0], "I'm sorry, that slot has just gone — could you pick another time?");
      }
    } else {
      text = text.replace(bookMatch[0], '');
    }
  }

  if (text.includes('[SEND_PRICING]')) {
    text = text.replace(/\[SEND_PRICING\]/g, '');
    const status = await sendPricingSms(from, callSid).catch(() => 'failed');
    if (status === 'failed') text = `${text.trim()} ${SMS_FALLBACK}`;
    // 'skipped' (Twilio not configured) — silently continue.
  }

  const spoken = text
    .replace(/\[ESCALATE\]/g, '')
    .replace(/\[BOOK:[^\]]*\]/g, '')
    .trim();
  return { spoken, escalate };
}

/**
 * Speak text via ElevenLabs audio if possible, else TwiML <Say> (Polly Amy).
 * Appends the spoken markup to `twiml`.
 */
async function speak(twiml, text) {
  const audioPath = await synthesize(text).catch(() => null);
  if (audioPath) {
    twiml.play(publicUrlFor(audioPath));
  } else {
    twiml.say({ voice: 'Polly.Amy' }, text);
  }
}

/** Append a <Gather> that listens for speech and posts to /gather. */
function gatherSpeech(twiml) {
  twiml.gather({
    input: 'speech',
    action: '/gather',
    method: 'POST',
    speechTimeout: 'auto',
    timeout: 6,
    language: 'en-GB',
  });
}

function getConvo(callSid, afterHours) {
  if (!conversations.has(callSid)) {
    conversations.set(callSid, {
      messages: [
        { role: 'system', content: buildSystemPrompt(getConfig(), afterHours) },
      ],
      attempts: 0,
      afterHours,
      ended: false,
    });
  }
  return conversations.get(callSid);
}

function transcriptOf(convo) {
  return convo.messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'Caller' : 'AVA'}: ${m.content}`)
    .join('\n');
}

/** Wrap a handler so errors return a graceful spoken TwiML fallback. */
function safe(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`Error in ${req.path}:`, err);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(
        { voice: 'Polly.Amy' },
        "I'm sorry, something went wrong on our side. Frederick will call you back shortly. Goodbye."
      );
      twiml.hangup();
      res.type('text/xml').send(twiml.toString());
    }
  };
}

// ---------------------------------------------------------------------------
// POST /voice — call starts: greet and listen.
// ---------------------------------------------------------------------------
router.post(
  '/voice',
  safe(async (req, res) => {
    const callSid = req.body.CallSid || `CA-${Date.now()}`;
    const afterHours = isAfterHours();
    const convo = getConvo(callSid, afterHours);

    store.startCall({ callSid, from: req.body.From, afterHours });

    const greeting = greetingFor(getConfig(), afterHours);
    convo.messages.push({ role: 'assistant', content: greeting });
    store.appendTranscript(callSid, 'AVA', greeting);

    const twiml = new twilio.twiml.VoiceResponse();
    await speak(twiml, greeting);
    gatherSpeech(twiml);
    res.type('text/xml').send(twiml.toString());
  })
);

// ---------------------------------------------------------------------------
// POST /gather — caller speech (or silence) comes here.
// ---------------------------------------------------------------------------
router.post(
  '/gather',
  safe(async (req, res) => {
    const callSid = req.body.CallSid;
    const speech = (req.body.SpeechResult || '').trim();
    const convo = getConvo(callSid, isAfterHours());

    const twiml = new twilio.twiml.VoiceResponse();

    // Silence / no speech detected.
    if (!speech) {
      convo.attempts += 1;
      if (convo.attempts > MAX_REPROMPTS) {
        const line =
          "I still can't hear you, so I'll let you go for now. If you'd like a callback, please call again or leave a message after the tone. Goodbye!";
        convo.messages.push({ role: 'assistant', content: line });
        store.appendTranscript(callSid, 'AVA', line);
        await speak(twiml, line);
        twiml.record({
          action: '/voicemail',
          method: 'POST',
          maxLength: 120,
          playBeep: true,
        });
        return res.type('text/xml').send(twiml.toString());
      }
      const reprompt =
        convo.attempts === 1
          ? "Sorry, I didn't catch that. Could you say it again?"
          : "I'm still not hearing anything. Could you try once more?";
      convo.messages.push({ role: 'assistant', content: reprompt });
      store.appendTranscript(callSid, 'AVA', reprompt);
      await speak(twiml, reprompt);
      gatherSpeech(twiml);
      return res.type('text/xml').send(twiml.toString());
    }

    convo.attempts = 0;
    convo.messages.push({ role: 'user', content: speech });
    store.appendTranscript(callSid, 'Caller', speech);

    let reply;
    try {
      reply = await getChatReply(convo.messages);
    } catch (err) {
      console.error('OpenAI reply failed:', err.message);
      reply =
        "Great question — let me have Frederick call you back on that. Could I take your name and number?";
    }

    const { spoken, escalate } = await processReply(reply, {
      callSid,
      from: req.body.From,
      regenerate: async (note) => {
        const msgs = [...convo.messages, { role: 'system', content: note }];
        return getChatReply(msgs);
      },
    });
    convo.messages.push({ role: 'assistant', content: spoken });
    store.appendTranscript(callSid, 'AVA', spoken);

    await speak(twiml, spoken);

    if (escalate) {
      const hold = 'Please hold while I connect you to Frederick now.';
      convo.messages.push({ role: 'assistant', content: hold });
      store.appendTranscript(callSid, 'AVA', hold);
      store.logActivity('escalate', `Call ${callSid} escalated to Frederick`);
      // Store the pending escalation reason in the in-memory call record so
      // the /whisper route can announce it to Frederick before bridging.
      const lastUserMsgs = convo.messages
        .filter((m) => m.role === 'user')
        .slice(-2)
        .map((m) => m.content)
        .join('. ');
      convo.escalation = {
        name: '',
        number: req.body.From || '',
        reason: (lastUserMsgs || spoken || 'urgent enquiry').slice(0, 200),
      };
      await speak(twiml, hold);
      const dial = twiml.dial({
        timeout: 20,
        action: '/dial-complete',
        method: 'POST',
      });
      // Warm transfer: Twilio fetches /whisper when Frederick answers, before bridging.
      dial.number({ url: whisperUrlFor(req, convo.escalation) }, frederickNumber());
      return res.type('text/xml').send(twiml.toString());
    }

    gatherSpeech(twiml);
    res.type('text/xml').send(twiml.toString());
  })
);

// ---------------------------------------------------------------------------
// POST /whisper — played to Frederick when he answers an escalated call,
// BEFORE the caller is bridged (warm transfer). Cheap Polly voice on purpose.
// Caller name/number/reason arrive as query params from the <Number url>.
// ---------------------------------------------------------------------------
router.post(
  '/whisper',
  safe(async (req, res) => {
    const callSid = req.body.CallSid || '';
    const stored = callSid ? conversations.get(callSid)?.escalation : null;
    const q = { ...req.query };
    const name = (q.name ?? stored?.name ?? '').toString().trim();
    const number = (q.number ?? stored?.number ?? req.body.From ?? '').toString().trim();
    const reason = (q.reason ?? stored?.reason ?? 'urgent enquiry').toString().trim() || 'urgent enquiry';
    const who = name ? `${name} on ${number || 'an unknown number'}` : number || 'an unknown caller';

    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 10,
      action: '/whisper-decision',
      method: 'POST',
    });
    gather.say(
      { voice: 'Polly.Amy' },
      `Urgent call from ${who}. Reason: ${reason}. Press 1 to connect, or hang up to send them to voicemail.`
    );
    // No keypress within the timeout → treat as declined.
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  })
);

// ---------------------------------------------------------------------------
// POST /whisper-decision — Frederick pressed a key after the whisper.
// Digits=1 bridges the caller; anything else hangs up this leg so the
// caller falls through to the existing /dial-complete voicemail flow.
// ---------------------------------------------------------------------------
router.post(
  '/whisper-decision',
  safe(async (req, res) => {
    const digits = (req.body.Digits || '').trim();
    const twiml = new twilio.twiml.VoiceResponse();
    if (digits === '1') {
      twiml.say({ voice: 'Polly.Amy' }, 'Connecting you now.');
      // Returning here ends the whisper TwiML — Twilio bridges the caller.
    } else {
      twiml.hangup();
    }
    res.type('text/xml').send(twiml.toString());
  })
);

// ---------------------------------------------------------------------------
// POST /dial-complete — after an escalation <Dial> finishes.
// ---------------------------------------------------------------------------
router.post(
  '/dial-complete',
  safe(async (req, res) => {
    const status = req.body.DialCallStatus;
    const twiml = new twilio.twiml.VoiceResponse();

    if (status === 'completed') {
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // No answer / busy / failed → offer voicemail.
    const tts = new twilio.twiml.VoiceResponse();
    await speak(
      tts,
      "Frederick isn't available right now, but please leave a message after the beep and he'll call you back as soon as possible."
    );
    tts.record({
      action: '/voicemail',
      method: 'POST',
      maxLength: 120,
      playBeep: true,
    });
    res.type('text/xml').send(tts.toString());
  })
);

// ---------------------------------------------------------------------------
// POST /voicemail — recording finished: transcribe and notify.
// ---------------------------------------------------------------------------
router.post(
  '/voicemail',
  safe(async (req, res) => {
    const { RecordingUrl, From, CallSid } = req.body;

    const twiml = new twilio.twiml.VoiceResponse();
    await speak(
      twiml,
      'Thank you for your message. Frederick will get back to you very soon. Goodbye!'
    );
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());

    // Background: download, transcribe, notify.
    (async () => {
      let transcription = '';
      try {
        if (RecordingUrl) {
          const audioUrl = `${RecordingUrl}.mp3`;
          const cfg = getConfig();
          const auth = Buffer.from(
            `${cfg.TWILIO_ACCOUNT_SID}:${cfg.TWILIO_AUTH_TOKEN}`
          ).toString('base64');
          const r = await fetch(audioUrl, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (r.ok) {
            const tmp = path.join(os.tmpdir(), `vm-${CallSid || Date.now()}.mp3`);
            fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
            transcription = await transcribeAudio(tmp);
            fs.unlink(tmp, () => {});
          } else {
            console.error(`Recording download failed: ${r.status}`);
          }
        }
      } catch (err) {
        console.error('Voicemail transcription failed:', err.message);
      }
      if (CallSid) store.setVoicemail(CallSid, transcription || '(transcription unavailable)');
      await notifyVoicemail(transcription, From, RecordingUrl);
    })().catch((e) => console.error('Voicemail notify failed:', e));
  })
);

// ---------------------------------------------------------------------------
// POST /status — call status callback: wrap up, extract lead, notify.
// ---------------------------------------------------------------------------
router.post(
  '/status',
  safe(async (req, res) => {
    res.sendStatus(204); // respond immediately

    const { CallSid, CallStatus, From } = req.body;
    if (!['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
      return;
    }

    store.endCall(CallSid, { status: CallStatus === 'completed' ? 'completed' : CallStatus });

    const convo = conversations.get(CallSid);
    if (!convo || convo.ended) return;
    convo.ended = true;
    conversations.delete(CallSid);

    const transcript = transcriptOf(convo);
    if (!transcript) return;

    try {
      const lead = await extractLeadSummary(transcript);
      store.addLead(lead, { callerNumber: From, callSid: CallSid });
      await notifyLead(lead, From);
    } catch (err) {
      console.error('Lead extraction/notification failed:', err.message);
      // Fallback: send the raw transcript so nothing is lost.
      const fallback = { summary: transcript, urgencyLevel: 'STANDARD' };
      store.addLead(fallback, { callerNumber: From, callSid: CallSid });
      try {
        await notifyLead(fallback, From);
      } catch (e) {
        console.error('Fallback notification failed:', e.message);
      }
    }
  })
);

/** Exposed for tests. */
export { conversations };

export default router;
