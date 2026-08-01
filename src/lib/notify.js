import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { getConfig } from './config.js';

let twilioCache = { sid: null, token: null, client: null };
function getTwilio() {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = getConfig();
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured');
  }
  if (twilioCache.sid !== accountSid || twilioCache.token !== authToken) {
    twilioCache = { sid: accountSid, token: authToken, client: twilio(accountSid, authToken) };
  }
  return twilioCache.client;
}

/**
 * Send a WhatsApp message to Frederick. Returns true on success.
 */
export async function sendWhatsApp(body) {
  const cfg = getConfig();
  try {
    await getTwilio().messages.create({
      from: cfg.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: cfg.FREDERICK_WHATSAPP || 'whatsapp:+447593836195',
      body,
    });
    return true;
  } catch (err) {
    console.error('WhatsApp notification failed:', err.message);
    return false;
  }
}

let transporterCache = { key: null, transporter: null };
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = getConfig();
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const key = `${SMTP_HOST}|${SMTP_PORT}|${SMTP_USER}|${SMTP_PASS}`;
  if (transporterCache.key !== key) {
    transporterCache = {
      key,
      transporter: nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      }),
    };
  }
  return transporterCache.transporter;
}

/**
 * Send an email notification if SMTP is configured. Returns true on success.
 */
export async function sendEmail(subject, text) {
  const cfg = getConfig();
  const t = getTransporter();
  const to = cfg.NOTIFY_EMAIL;
  if (!t || !to) return false;
  try {
    await t.sendMail({
      from: cfg.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('Email notification failed:', err.message);
    return false;
  }
}

function fmt(v) {
  return v === null || v === undefined || v === '' ? '—' : v;
}

/**
 * Format a lead summary object into a readable message.
 */
export function formatLeadMessage(lead, callerNumber) {
  return [
    `📞 *New call summary — TabSphere*`,
    ``,
    `*Name:* ${fmt(lead.fullName)}`,
    `*Business:* ${fmt(lead.businessName)}`,
    `*Email:* ${fmt(lead.email)}`,
    `*Phone:* ${fmt(lead.phone || callerNumber)}`,
    `*Service:* ${fmt(lead.serviceInterestedIn)}`,
    `*Budget:* ${fmt(lead.budget)}`,
    `*Callback:* ${fmt(lead.callbackTime)}`,
    `*Heard via:* ${fmt(lead.howTheyHeard)}`,
    `*Urgency:* ${fmt(lead.urgencyLevel)}`,
    ``,
    `*Summary:*`,
    fmt(lead.summary),
  ].join('\n');
}

/**
 * Notify Frederick about a finished call via WhatsApp (+ email if configured).
 */
export async function notifyLead(lead, callerNumber) {
  const msg = formatLeadMessage(lead, callerNumber);
  const [wa] = await Promise.all([
    sendWhatsApp(msg),
    sendEmail(`TabSphere call summary — ${fmt(lead.fullName)}`, msg),
  ]);
  return wa;
}

/**
 * Notify Frederick about a new voicemail with its transcription.
 */
export async function notifyVoicemail(transcription, callerNumber, recordingUrl) {
  const msg = [
    `🎙️ *New voicemail — TabSphere*`,
    ``,
    `*From:* ${fmt(callerNumber)}`,
    `*Transcription:*`,
    transcription || '(transcription unavailable)',
    ``,
    recordingUrl ? `Recording: ${recordingUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return sendWhatsApp(msg);
}
