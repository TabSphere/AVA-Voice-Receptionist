import { useEffect, useState } from 'react';
import { api } from '../api.js';

const GROUPS = [
  {
    id: 'twilio',
    title: 'Twilio',
    testable: true,
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', secret: true },
      { key: 'TWILIO_NUMBER', label: 'Twilio Phone Number', placeholder: '+44xxxxxxxxxx' },
      { key: 'TWILIO_WHATSAPP_FROM', label: 'WhatsApp From (sandbox sender)', placeholder: 'whatsapp:+14155238886' },
    ],
  },
  {
    id: 'openai',
    title: 'OpenAI',
    testable: true,
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key', secret: true, placeholder: 'sk-...' },
      { key: 'OPENAI_MODEL', label: 'Model', placeholder: 'gpt-4o-mini' },
    ],
  },
  {
    id: 'elevenlabs',
    title: 'ElevenLabs',
    testable: true,
    hint: 'Find your Voice ID in the ElevenLabs VoiceLab — click a voice → "ID". Without a key + voice ID, AVA speaks with Twilio Polly Amy instead.',
    fields: [
      { key: 'ELEVENLABS_API_KEY', label: 'API Key', secret: true },
      { key: 'ELEVENLABS_VOICE_ID', label: 'Voice ID', placeholder: 'e.g. 21m00Tcm4TlvDq8ikWAM' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'Notifications',
    testable: true,
    testService: 'whatsapp',
    hint: 'Frederick must join the WhatsApp sandbox once: send "join <code>" to the sandbox number from his phone (Twilio Console → Messaging → Try it out).',
    fields: [
      { key: 'FREDERICK_WHATSAPP', label: 'Frederick WhatsApp', placeholder: 'whatsapp:+447593836195' },
      { key: 'FREDERICK_NUMBER', label: 'Forward-to Number (escalations)', placeholder: '+447593836195' },
      { key: 'NOTIFY_EMAIL', label: 'Notification Email (optional)', placeholder: 'info@tabsphere.co.uk' },
      { key: 'SMTP_HOST', label: 'SMTP Host (optional)' },
      { key: 'SMTP_PORT', label: 'SMTP Port', placeholder: '587' },
      { key: 'SMTP_USER', label: 'SMTP User (optional)' },
      { key: 'SMTP_PASS', label: 'SMTP Password (optional)', secret: true },
    ],
  },
  {
    id: 'server',
    title: 'Server',
    fields: [
      { key: 'PUBLIC_URL', label: 'Public URL', placeholder: 'https://your-domain.example.com' },
    ],
  },
];

export default function Settings() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState('');
  const [tests, setTests] = useState({});
  const [copied, setCopied] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    api.config().then((c) => {
      setCfg(c);
      setForm(c);
    });
    api.status().then((s) => setDemoMode(Boolean(s.demoMode))).catch(() => {});
  }, []);

  async function toggleDemo() {
    const next = !demoMode;
    setDemoBusy(true);
    try {
      const res = await api.setDemo(next);
      if (res.ok) {
        setDemoMode(res.demoMode);
        window.dispatchEvent(new CustomEvent('ava:demo', { detail: res.demoMode }));
      }
    } finally {
      setDemoBusy(false);
    }
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function saveGroup(group) {
    const body = {};
    for (const f of group.fields) body[f.key] = form[f.key];
    const res = await api.saveConfig(body);
    if (res.ok) {
      setCfg(res.config);
      setForm(res.config);
      setSaved(group.id);
      setTimeout(() => setSaved(''), 2500);
    }
  }

  async function runTest(service) {
    setTests((t) => ({ ...t, [service]: { loading: true } }));
    const res = await api.test(service);
    setTests((t) => ({ ...t, [service]: { ...res, loading: false } }));
  }

  const webhookUrl = `${(form.PUBLIC_URL || cfg?.PUBLIC_URL || 'https://your-public-url').replace(/\/$/, '')}/voice`;

  if (!cfg) return <p className="text-stone-400">Loading settings…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Settings</h1>

      {/* Webhook URL card */}
      <div className="card border-amber-300 bg-amber-50">
        <div className="label">Twilio webhook URL</div>
        <p className="text-sm text-stone-600 mb-2">
          Paste this into your Twilio console (Phone Numbers → your number → Voice → "A call comes in", HTTP POST):
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-xl bg-white border border-amber-200 px-4 py-2.5 text-sm font-semibold break-all">
            {webhookUrl}
          </code>
          <button
            className="btn-amber shrink-0"
            onClick={() => {
              navigator.clipboard?.writeText(webhookUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {!form.PUBLIC_URL && (
          <p className="text-xs text-red-600 mt-2 font-semibold">
            Set PUBLIC_URL below first (e.g. your deployed domain or ngrok URL).
          </p>
        )}
      </div>

      {/* Demo Mode */}
      <div className={`card border-2 ${demoMode ? 'border-amber-400 bg-amber-50/50' : 'border-transparent'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              Demo Mode
              {demoMode && <span className="badge bg-amber-500 text-charcoal">ACTIVE</span>}
            </h2>
            <p className="text-sm text-stone-500 mt-1 max-w-lg">
              Fills the dashboard with sample calls and leads for demos. Demo data is clearly tagged
              and never mixes with real call data — turning it off removes every demo record.
            </p>
          </div>
          <button
            onClick={toggleDemo}
            disabled={demoBusy}
            aria-pressed={demoMode}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
              demoMode ? 'bg-amber-500' : 'bg-stone-300'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                demoMode ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.id} className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{g.title}</h2>
            <div className="flex items-center gap-2">
              {saved === g.id && <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>}
              {g.testable && (
                <button
                  className="btn"
                  disabled={tests[g.testService || g.id]?.loading}
                  onClick={() => runTest(g.testService || g.id)}
                >
                  {tests[g.testService || g.id]?.loading ? 'Testing…' : 'Test connection'}
                </button>
              )}
              <button className="btn-amber" onClick={() => saveGroup(g)}>
                Save
              </button>
            </div>
          </div>

          {g.hint && (
            <p className="text-xs text-stone-500 bg-stone-100 rounded-xl px-3 py-2 mb-4">{g.hint}</p>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {g.fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  className="input"
                  type={f.secret ? 'password' : 'text'}
                  placeholder={f.placeholder || ''}
                  value={form[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
                {f.secret && form[f.key] && String(form[f.key]).includes('...') && (
                  <p className="text-xs text-stone-400 mt-1">
                    Saved (masked). Type a new value to replace it.
                  </p>
                )}
              </div>
            ))}
          </div>

          {tests[g.testService || g.id] && !tests[g.testService || g.id].loading && (
            <div
              className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
                tests[g.testService || g.id].ok
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {tests[g.testService || g.id].ok
                ? `✓ ${tests[g.testService || g.id].message}`
                : `✗ ${tests[g.testService || g.id].error}`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
