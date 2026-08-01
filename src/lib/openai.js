import OpenAI from 'openai';
import fs from 'node:fs';
import { getConfig } from './config.js';

// Client is cached per (key, model) pair so Settings changes take effect.
let cached = { key: null, client: null };
function getClient() {
  const { OPENAI_API_KEY: apiKey } = getConfig();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  if (cached.key !== apiKey) {
    cached = { key: apiKey, client: new OpenAI({ apiKey }) };
  }
  return cached.client;
}

function model() {
  return getConfig().OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * Get AVA's spoken reply for the conversation so far.
 * @param {Array<{role:string,content:string}>} messages full message list including system prompt
 * @returns {Promise<string>} reply text (may end with [ESCALATE])
 */
export async function getChatReply(messages) {
  const res = await getClient().chat.completions.create({
    model: model(),
    messages,
    temperature: 0.6,
    max_tokens: 200,
  });
  return res.choices[0].message.content.trim();
}

/**
 * Extract a structured lead summary from a call transcript.
 */
export async function extractLeadSummary(transcript) {
  const prompt = `You are analysing a phone call transcript between AVA (an AI receptionist) and a caller to TabSphere Limited, a web design agency.

Extract the following fields from the transcript. Use null for anything not mentioned.
- fullName
- businessName
- email
- phone
- serviceInterestedIn
- budget
- callbackTime
- howTheyHeard
- urgencyLevel (one of: URGENT, STANDARD, LOW)
- summary (one concise paragraph describing the call and what the caller needs)

Return ONLY valid JSON with exactly those keys.

TRANSCRIPT:
${transcript}`;

  const res = await getClient().chat.completions.create({
    model: model(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });
  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return { summary: res.choices[0].message.content, urgencyLevel: 'STANDARD' };
  }
}

/**
 * Transcribe an audio file with Whisper.
 * @param {string} filePath path to an audio file readable from disk
 */
export async function transcribeAudio(filePath) {
  const res = await getClient().audio.transcriptions.create({
    model: 'whisper-1',
    file: fs.createReadStream(filePath),
  });
  return res.text;
}
