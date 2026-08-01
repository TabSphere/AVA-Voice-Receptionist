import express from 'express';
import twilio from 'twilio';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSystemPrompt, GREETINGS } from '../ava-prompt.js';
import { getChatReply, extractLeadSummary, transcribeAudio } from '../lib/openai.js';
import { synthesize } from '../lib/tts.js';
import { notifyLead, notifyVoicemail } from '../lib/notify.js';
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
        { role: 'system', content: buildSystemPrompt({ afterHours }) },
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

    const greeting = afterHours ? GREETINGS.afterHours : GREETINGS.standard;
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

    const escalate = reply.includes('[ESCALATE]');
    const spoken = reply.replace(/\[ESCALATE\]/g, '').trim();
    convo.messages.push({ role: 'assistant', content: spoken });
    store.appendTranscript(callSid, 'AVA', spoken);

    await speak(twiml, spoken);

    if (escalate) {
      const hold = 'Please hold while I connect you to Frederick now.';
      convo.messages.push({ role: 'assistant', content: hold });
      store.appendTranscript(callSid, 'AVA', hold);
      store.logActivity('escalate', `Call ${callSid} escalated to Frederick`);
      await speak(twiml, hold);
      const dial = twiml.dial({
        timeout: 20,
        action: '/dial-complete',
        method: 'POST',
      });
      dial.number(frederickNumber());
      return res.type('text/xml').send(twiml.toString());
    }

    gatherSpeech(twiml);
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
