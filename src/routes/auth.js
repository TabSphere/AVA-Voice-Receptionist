import express from 'express';
import {
  isSetupDone,
  verifyPassword,
  setPassword,
  createSession,
  destroySession,
  isAuthed,
  loginRateLimited,
  recordLoginFailure,
  clearLoginFailures,
} from '../lib/auth.js';

const router = express.Router();

function ip(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// GET /api/auth/status — public.
router.get('/status', (req, res) => {
  res.json({ setup: isSetupDone(), authed: isAuthed(req) });
});

// POST /api/auth/setup {password} — first-run only.
router.post('/setup', (req, res) => {
  if (isSetupDone()) {
    return res.status(403).json({ ok: false, error: 'Setup already complete' });
  }
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
  }
  setPassword(password);
  createSession(res, req);
  res.json({ ok: true });
});

// POST /api/auth/login {password} — rate limited.
router.post('/login', (req, res) => {
  const key = ip(req);
  if (loginRateLimited(key)) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — try again later' });
  }
  const password = req.body?.password;
  if (!verifyPassword(password)) {
    recordLoginFailure(key);
    return res.status(401).json({ ok: false, error: 'Incorrect password' });
  }
  clearLoginFailures(key);
  createSession(res, req);
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

// POST /api/auth/password {current, next} — authed only.
router.post('/password', (req, res) => {
  if (!isAuthed(req)) {
    return res.status(401).json({ ok: false, error: 'auth required' });
  }
  const { current, next } = req.body || {};
  if (!verifyPassword(current)) {
    return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
  }
  if (typeof next !== 'string' || next.length < 8) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
  }
  setPassword(next);
  res.json({ ok: true });
});

export default router;
