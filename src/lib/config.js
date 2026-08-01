import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR =
  process.env.AVA_DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

/**
 * All configuration keys, with defaults (lowest precedence).
 * Precedence: data/config.json > process.env > defaults.
 */
const DEFAULTS = {
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_NUMBER: '',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-4o-mini',
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',
  ELEVENLABS_MODEL_ID: 'eleven_turbo_v2_5',
  FREDERICK_WHATSAPP: 'whatsapp:+447593836195',
  FREDERICK_NUMBER: '+447593836195',
  NOTIFY_EMAIL: '',
  SMTP_HOST: '',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_PASS: '',
  PUBLIC_URL: '',
  TWILIO_VALIDATE_SIGNATURE: 'false',
};

/** Keys that must never be returned in full by the API. */
export const SECRET_KEYS = [
  'TWILIO_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'SMTP_PASS',
];

export const ALL_KEYS = Object.keys(DEFAULTS);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFileConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Resolved configuration.
 * Precedence: data/config.json > process.env > DEFAULTS.
 */
export function getConfig() {
  const file = readFileConfig();
  const cfg = {};
  for (const key of ALL_KEYS) {
    if (file[key] !== undefined && file[key] !== null && file[key] !== '') {
      cfg[key] = file[key];
    } else if (process.env[key] !== undefined && process.env[key] !== '') {
      cfg[key] = process.env[key];
    } else {
      cfg[key] = DEFAULTS[key];
    }
  }
  return cfg;
}

export function maskSecret(value) {
  if (!value) return '';
  const v = String(value);
  if (v.length <= 7) return '...';
  return `${v.slice(0, 3)}...${v.slice(-4)}`;
}

function isMasked(value) {
  return typeof value === 'string' && value.includes('...');
}

/**
 * Persist a partial config update to data/config.json.
 * - Only known keys are stored.
 * - Secret keys: empty/undefined/masked values keep the stored value
 *   (partial saves never wipe stored secrets).
 * - Non-secret keys: undefined means "leave unchanged"; '' clears.
 */
export function saveConfig(partial = {}) {
  ensureDataDir();
  const current = readFileConfig();
  const next = { ...current };
  for (const key of ALL_KEYS) {
    if (!(key in partial)) continue;
    const value = partial[key];
    if (SECRET_KEYS.includes(key)) {
      if (value === undefined || value === null || value === '' || isMasked(value)) {
        continue; // keep stored secret
      }
      next[key] = value;
    } else {
      if (value === undefined || value === null) continue;
      next[key] = String(value);
    }
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return getConfig();
}

/**
 * Demo mode flag — persisted as `demoMode` boolean in config.json.
 * Kept separate from ALL_KEYS (string config keys).
 */
export function getDemoMode() {
  return readFileConfig().demoMode === true;
}

export function setDemoMode(enabled) {
  ensureDataDir();
  const current = readFileConfig();
  current.demoMode = enabled === true;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(current, null, 2));
  return current.demoMode;
}

/**
 * Config shaped for API responses: secrets masked + configured flags.
 */
export function publicConfig() {
  const cfg = getConfig();
  const out = {};
  for (const key of ALL_KEYS) {
    out[key] = SECRET_KEYS.includes(key) ? maskSecret(cfg[key]) : cfg[key];
  }
  out.configured = {
    twilio: Boolean(cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN && cfg.TWILIO_NUMBER),
    openai: Boolean(cfg.OPENAI_API_KEY),
    elevenlabs: Boolean(cfg.ELEVENLABS_API_KEY && cfg.ELEVENLABS_VOICE_ID),
    whatsapp: Boolean(cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN && cfg.TWILIO_WHATSAPP_FROM && cfg.FREDERICK_WHATSAPP),
    smtp: Boolean(cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS),
  };
  return out;
}
