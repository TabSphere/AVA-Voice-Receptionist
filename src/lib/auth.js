import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.js';

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const COOKIE_NAME = 'ava_session';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

// In-memory sessions: token -> expiresAt
const sessions = new Map();

// Login rate limiting: ip -> [failure timestamps]
const loginFailures = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

function readConfigFile() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfigFile(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2));
}

export function isSetupDone() {
  const cfg = readConfigFile();
  return Boolean(cfg.auth && typeof cfg.auth.passwordHash === 'string' && cfg.auth.passwordHash);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64, SCRYPT_PARAMS).toString('hex');
  return `scrypt$${SCRYPT_PARAMS.N}$${salt}$${hash}`;
}

export function setPassword(password) {
  const cfg = readConfigFile();
  cfg.auth = { passwordHash: hashPassword(password) };
  writeConfigFile(cfg);
}

export function verifyPassword(pw) {
  if (!isSetupDone() || typeof pw !== 'string') return false;
  const stored = readConfigFile().auth.passwordHash;
  const [scheme, nStr, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  try {
    const candidate = crypto.scryptSync(pw, salt, 64, { N: Number(nStr), r: 8, p: 1 });
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(req, token, maxAgeSec) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function createSession(res, req) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_TTL_MS / 1000));
  return token;
}

export function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
}

export function isAuthed(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// --- login rate limiting ---
export function loginRateLimited(ip) {
  const now = Date.now();
  const list = (loginFailures.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  loginFailures.set(ip, list);
  return list.length >= RATE_MAX;
}

export function recordLoginFailure(ip) {
  const list = loginFailures.get(ip) || [];
  list.push(Date.now());
  loginFailures.set(ip, list);
}

export function clearLoginFailures(ip) {
  loginFailures.delete(ip);
}

// Periodic cleanup of expired sessions and stale rate-limit entries.
const timer = setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of sessions) if (now > exp) sessions.delete(token);
  for (const [ip, list] of loginFailures) {
    const fresh = list.filter((t) => now - t < RATE_WINDOW_MS);
    if (fresh.length) loginFailures.set(ip, fresh);
    else loginFailures.delete(ip);
  }
}, 10 * 60 * 1000);
timer.unref();
