import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import twilio from 'twilio';
import voiceRouter from './routes/voice.js';
import apiRouter from './routes/api.js';
import { cleanupOldAudio } from './lib/tts.js';
import { getConfig } from './lib/config.js';
import authRouter from './routes/auth.js';
import { isAuthed } from './lib/auth.js';
import { LOGIN_PAGE_HTML } from './loginPage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export function createApp() {
  const app = express();

  // Twilio posts form-encoded data.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Serve synthesized audio for TwiML <Play>.
  app.use(
    '/audio',
    express.static(path.join(ROOT, 'public', 'audio'), { maxAge: '1h' })
  );

  // Login page (self-contained HTML, no client rebuild needed).
  app.get('/login', (req, res) => {
    res.type('html').send(LOGIN_PAGE_HTML);
  });

  // Auth endpoints (status is public; setup/login manage sessions).
  app.use('/api/auth', authRouter);

  // --- Dashboard login lock ---
  // Everything below requires a session, except Twilio webhooks + audio.
  const AUTH_EXEMPT_EXACT = new Set([
    '/voice',
    '/gather',
    '/dial-complete',
    '/voicemail',
    '/status', // Twilio status callback (exact path only)
    '/login',
    '/health',
  ]);
  app.use((req, res, next) => {
    const p = req.path;
    if (
      AUTH_EXEMPT_EXACT.has(p) ||
      p.startsWith('/audio/') ||
      p.startsWith('/api/auth/')
    ) {
      return next();
    }
    if (isAuthed(req)) return next();
    const acceptsHtml = (req.headers.accept || '').includes('text/html');
    if (acceptsHtml && req.method === 'GET') {
      return res.redirect(302, '/login');
    }
    return res.status(401).json({ ok: false, error: 'auth required' });
  });

  // Optional Twilio signature validation (enable in production).
  const validate = getConfig().TWILIO_VALIDATE_SIGNATURE === 'true';
  if (validate) {
    app.use(
      ['/voice', '/gather', '/dial-complete', '/voicemail', '/status'],
      twilio.webhook({
        validate: true,
        authToken: getConfig().TWILIO_AUTH_TOKEN,
        protocol: 'https',
      })
    );
    console.log('Twilio signature validation: ENABLED');
  } else {
    console.warn(
      'Twilio signature validation: DISABLED (set TWILIO_VALIDATE_SIGNATURE=true in production)'
    );
  }

  app.use(voiceRouter);
  app.use('/api', apiRouter);

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Serve the built React client in production.
  const distDir = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api|voice|gather|dial-complete|voicemail|status|audio|health).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Periodic cleanup of old audio files (every 30 min, delete files > 1h old).
  const timer = setInterval(() => cleanupOldAudio(60 * 60 * 1000), 30 * 60 * 1000);
  timer.unref();

  return app;
}

// Start server when run directly (not imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3001;
  const app = createApp();
  app.listen(port, () => {
    console.log(`AVA Voice Receptionist Dashboard listening on port ${port}`);
    console.log(`Voice webhook: ${getConfig().PUBLIC_URL || '(set PUBLIC_URL in Settings)'}/voice`);
  });
}
