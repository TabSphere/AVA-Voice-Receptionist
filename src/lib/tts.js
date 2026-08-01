import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', '..', 'public', 'audio');

// In-memory cache: text hash -> filename (files persist on disk too)
const cache = new Map();

function ensureAudioDir() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Synthesize text with ElevenLabs and save as MP3 under public/audio.
 * Returns the public URL path (e.g. "/audio/abc.mp3") or null on failure,
 * so callers can fall back to TwiML <Say>.
 */
export async function synthesize(text) {
  const { ELEVENLABS_API_KEY: key, ELEVENLABS_VOICE_ID: voiceId, ELEVENLABS_MODEL_ID: modelId } =
    getConfig();
  if (!key || !voiceId) return null;

  const hash = crypto.createHash('sha1').update(text).digest('hex');
  const filename = `${hash}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);

  if (cache.has(hash) || fs.existsSync(filePath)) {
    cache.set(hash, filename);
    return `/audio/${filename}`;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId || 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!res.ok) {
      console.error(`ElevenLabs error ${res.status}: ${await res.text()}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    ensureAudioDir();
    fs.writeFileSync(filePath, buf);
    cache.set(hash, filename);
    return `/audio/${filename}`;
  } catch (err) {
    console.error('ElevenLabs synthesis failed:', err.message);
    return null;
  }
}

/**
 * Delete audio files older than maxAgeMs. Runs on an interval from server.js.
 */
export function cleanupOldAudio(maxAgeMs = 60 * 60 * 1000) {
  try {
    ensureAudioDir();
    const now = Date.now();
    for (const f of fs.readdirSync(AUDIO_DIR)) {
      if (!f.endsWith('.mp3')) continue;
      const p = path.join(AUDIO_DIR, f);
      const stat = fs.statSync(p);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(p);
        const hash = f.replace('.mp3', '');
        if (cache.get(hash) === f) cache.delete(hash);
      }
    }
  } catch (err) {
    console.error('Audio cleanup failed:', err.message);
  }
}
