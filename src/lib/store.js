import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.js';

const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { calls: [], leads: [], activity: [] };

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    cache = { ...EMPTY, ...parsed };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/** Test helper: reset in-memory cache (used with a fresh AVA_DATA_DIR). */
export function _resetCache() {
  cache = null;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function logActivity(type, message) {
  const db = load();
  db.activity.unshift({ id: crypto.randomUUID(), ts: new Date().toISOString(), type, message });
  db.activity = db.activity.slice(0, 100);
  save();
}

export function startCall({ callSid, from, afterHours }) {
  const db = load();
  const call = {
    id: crypto.randomUUID(),
    callSid,
    from: from || 'Unknown',
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSec: null,
    status: 'active',
    afterHours,
    transcript: [],
    voicemail: '',
    urgency: null,
    leadId: null,
  };
  db.calls.unshift(call);
  save();
  logActivity('call', `Call started from ${call.from}`);
  return call;
}

export function appendTranscript(callSid, role, content) {
  const db = load();
  const call = db.calls.find((c) => c.callSid === callSid && c.status === 'active')
    || db.calls.find((c) => c.callSid === callSid);
  if (!call) return;
  call.transcript.push({ role, content, ts: new Date().toISOString() });
  save();
}

export function endCall(callSid, { status = 'completed' } = {}) {
  const db = load();
  const call = db.calls.find((c) => c.callSid === callSid);
  if (!call || call.status !== 'active') return null;
  call.status = status;
  call.endedAt = new Date().toISOString();
  call.durationSec = Math.max(
    0,
    Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
  );
  save();
  logActivity('call', `Call ended (${status}) from ${call.from} — ${call.durationSec}s`);
  return call;
}

export function setVoicemail(callSid, text) {
  const db = load();
  const call = db.calls.find((c) => c.callSid === callSid);
  if (!call) return;
  call.voicemail = text;
  save();
  logActivity('voicemail', `Voicemail left by ${call.from}`);
}

export function addLead(lead, { callerNumber, callSid } = {}) {
  const db = load();
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    callerNumber: callerNumber || null,
    callSid: callSid || null,
    fullName: lead.fullName ?? null,
    businessName: lead.businessName ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? callerNumber ?? null,
    serviceInterestedIn: lead.serviceInterestedIn ?? null,
    budget: lead.budget ?? null,
    callbackTime: lead.callbackTime ?? null,
    howTheyHeard: lead.howTheyHeard ?? null,
    urgencyLevel: lead.urgencyLevel ?? 'STANDARD',
    summary: lead.summary ?? null,
  };
  db.leads.unshift(record);
  const call = db.calls.find((c) => c.callSid === callSid);
  if (call) {
    call.leadId = record.id;
    call.urgency = record.urgencyLevel;
  }
  save();
  logActivity('lead', `New lead: ${record.fullName || callerNumber || 'Unknown'} (${record.urgencyLevel})`);
  return record;
}

export function listCalls(limit = 200) {
  return load().calls.slice(0, limit);
}

export function listLeads(limit = 200) {
  return load().leads.slice(0, limit);
}

export function recentActivity(limit = 20) {
  return load().activity.slice(0, limit);
}

export function activeCalls() {
  return load().calls.filter((c) => c.status === 'active');
}

export function countsToday() {
  const db = load();
  const start = todayStart();
  return {
    callsToday: db.calls.filter((c) => new Date(c.startedAt).getTime() >= start).length,
    leadsToday: db.leads.filter((l) => new Date(l.createdAt).getTime() >= start).length,
  };
}

// ---------------------------------------------------------------------------
// Demo mode — seed/clear sample data (all tagged demo:true).
// ---------------------------------------------------------------------------

/** Remove every record tagged demo:true. Returns counts removed. */
export function clearDemo() {
  const db = load();
  const removed = {
    calls: db.calls.filter((c) => c.demo).length,
    leads: db.leads.filter((l) => l.demo).length,
    activity: db.activity.filter((a) => a.demo).length,
  };
  db.calls = db.calls.filter((c) => !c.demo);
  db.leads = db.leads.filter((l) => !l.demo);
  db.activity = db.activity.filter((a) => !a.demo);
  save();
  return removed;
}

/** Seed realistic demo data (clears any previous demo data first). */
export async function seedDemo() {
  clearDemo();
  const { demoCalls, demoLeads, demoActivity } = await import('./demo.js');
  const db = load();
  db.calls = [...demoCalls(), ...db.calls];
  db.leads = [...demoLeads(), ...db.leads];
  db.activity = [...demoActivity(), ...db.activity].slice(0, 100);
  save();
  return { calls: demoCalls().length, leads: demoLeads().length };
}
