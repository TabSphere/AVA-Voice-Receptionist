import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';

const ICONS = {
  voice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" opacity="0.4" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  business: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  branding: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a15 15 0 0 1 0 18M3.5 9h17M3.5 15h17" opacity="0.5" />
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

const SECTIONS = [
  {
    id: 'elevenlabs',
    icon: ICONS.voice,
    title: 'AI Voice (ElevenLabs)',
    description: "The voice callers hear. Without a key + Voice ID, AVA falls back to Twilio's free Polly Amy voice.",
    testable: true,
    hint: 'Find your Voice ID in the ElevenLabs VoiceLab — click a voice → "ID".',
    fields: [
      { key: 'ELEVENLABS_API_KEY', label: 'API Key', secret: true },
      { key: 'ELEVENLABS_VOICE_ID', label: 'Voice ID', placeholder: 'e.g. 21m00Tcm4TlvDq8ikWAM' },
      { key: 'ELEVENLABS_MODEL_ID', label: 'Model ID', placeholder: 'eleven_turbo_v2_5' },
    ],
  },
  {
    id: 'openai',
    icon: ICONS.brain,
    title: 'Brain (OpenAI)',
    description: 'The language model that thinks, answers questions, captures leads and books appointments.',
    testable: true,
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key', secret: true, placeholder: 'sk-...' },
      { key: 'OPENAI_MODEL', label: 'Model', placeholder: 'gpt-4o-mini' },
    ],
  },
  {
    id: 'twilio',
    icon: ICONS.phone,
    title: 'Phone & Messaging (Twilio)',
    description: 'Connects your phone number so AVA can answer calls, send SMS and warm-transfer escalations.',
    testable: true,
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', secret: true },
      { key: 'TWILIO_NUMBER', label: 'Twilio Phone Number', placeholder: '+44xxxxxxxxxx' },
      { key: 'TWILIO_WHATSAPP_FROM', label: 'WhatsApp From (sandbox sender)', placeholder: 'whatsapp:+14155238886' },
      { key: 'PUBLIC_URL', label: 'Public URL (webhook base)', placeholder: 'https://your-domain.example.com' },
    ],
  },
  {
    id: 'whatsapp',
    icon: ICONS.whatsapp,
    title: 'Notifications (WhatsApp)',
    description: 'Where AVA sends lead alerts, booking confirmations and voicemail transcripts.',
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
];

const BRAIN_FIELDS = [
  { key: 'BUSINESS_NAME', label: 'Business Name', placeholder: 'TabSphere Limited' },
  { key: 'BUSINESS_WEBSITE', label: 'Business Website', placeholder: 'www.tabsphere.co.uk' },
  { key: 'PRICING_LINK', label: 'Pricing link', placeholder: 'https://tabsphere.co.uk' },
  { key: 'BUSINESS_ABOUT', label: 'About the Business', textarea: true,
    placeholder: 'Who you are, where you are, what makes you special…' },
  { key: 'BUSINESS_SERVICES', label: 'Services & Prices', textarea: true,
    placeholder: 'Starter website from £499; Business from £799; E-Commerce from £1,200; Logo design from £150…' },
  { key: 'BUSINESS_FAQS', label: 'FAQs (one "Q: ... A: ..." per line)', textarea: true,
    placeholder: 'Q: How long does a website take? A: Usually 2 to 4 weeks.' },
  { key: 'BUSINESS_CUSTOM', label: 'Custom Instructions', textarea: true,
    placeholder: 'Anything else AVA should always say or never say…' },
];

const DAY_OPTIONS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
  ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

function SectionCard({ icon, title, description, children, actions }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="card"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-charcoal text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
            {icon}
          </div>
          <div>
            <h2 className="font-bold leading-tight">{title}</h2>
            {description && <p className="text-xs text-stone-500 mt-0.5 max-w-lg">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </motion.section>
  );
}

function SavedTick({ show }) {
  return show ? <span className="text-sm font-semibold text-emerald-600">Saved ✓</span> : null;
}

export default function Settings() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState('');
  const [tests, setTests] = useState({});
  const [copied, setCopied] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  // Branding
  const [logo, setLogo] = useState('');
  const [logoMsg, setLogoMsg] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef(null);

  // Security
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api.config().then((c) => {
      setCfg(c);
      setForm(c);
    });
    api.status().then((s) => setDemoMode(Boolean(s.demoMode))).catch(() => {});
    api.branding().then((b) => setLogo(b.logoDataUrl || '')).catch(() => {});
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

  async function saveKeys(id, keys) {
    const body = {};
    for (const k of keys) body[k] = form[k];
    const res = await api.saveConfig(body);
    if (res.ok) {
      setCfg(res.config);
      setForm(res.config);
      setSaved(id);
      setTimeout(() => setSaved(''), 2500);
    }
  }

  async function runTest(service) {
    setTests((t) => ({ ...t, [service]: { loading: true } }));
    const res = await api.test(service);
    setTests((t) => ({ ...t, [service]: { ...res, loading: false } }));
  }

  function onLogoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) {
      setLogoMsg({ ok: false, text: 'Please choose a png, jpg, svg or webp image.' });
      return;
    }
    if (file.size > 500 * 1024) {
      setLogoMsg({ ok: false, text: 'Logo is too large — max 500KB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setLogoBusy(true);
      setLogoMsg(null);
      try {
        const res = await api.uploadLogo(reader.result);
        if (res.ok) {
          setLogo(res.branding?.logoDataUrl || reader.result);
          setLogoMsg({ ok: true, text: 'Logo uploaded — it now appears on the login page and navbar.' });
          window.dispatchEvent(new CustomEvent('ava:branding'));
        } else {
          setLogoMsg({ ok: false, text: res.error || 'Upload failed' });
        }
      } catch (err) {
        setLogoMsg({ ok: false, text: err.message || 'Upload failed' });
      } finally {
        setLogoBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    setLogoBusy(true);
    setLogoMsg(null);
    try {
      const res = await api.removeLogo();
      if (res.ok) {
        setLogo('');
        setLogoMsg({ ok: true, text: 'Logo removed — the default amber mark is back.' });
        window.dispatchEvent(new CustomEvent('ava:branding'));
      }
    } finally {
      setLogoBusy(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    setPwBusy(true);
    try {
      const res = await api.changePassword(pw.current, pw.next);
      if (res.ok) {
        setPwMsg({ ok: true, text: 'Password updated.' });
        setPw({ current: '', next: '', confirm: '' });
      } else {
        setPwMsg({ ok: false, text: res.error || 'Could not update password' });
      }
    } catch (err) {
      setPwMsg({ ok: false, text: err.message || 'Could not update password' });
    } finally {
      setPwBusy(false);
    }
  }

  const webhookUrl = `${(form.PUBLIC_URL || cfg?.PUBLIC_URL || 'https://your-public-url').replace(/\/$/, '')}/voice`;

  if (!cfg) return <p className="text-stone-400">Loading settings…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Everything that powers AVA — grouped by what it does.</p>
      </div>

      {/* Webhook URL card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="card border-amber-300 bg-amber-50"
      >
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
            Set the Public URL in Phone & Messaging below first (e.g. your deployed domain or ngrok URL).
          </p>
        )}
      </motion.div>

      {/* Demo Mode */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
        className={`card border-2 ${demoMode ? 'border-amber-400 bg-amber-50/50' : 'border-transparent'}`}
      >
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
      </motion.div>

      {/* Connection sections */}
      {SECTIONS.map((g) => {
        const svc = g.testService || g.id;
        return (
          <SectionCard
            key={g.id}
            icon={g.icon}
            title={g.title}
            description={g.description}
            actions={
              <>
                <SavedTick show={saved === g.id} />
                {g.testable && (
                  <button className="btn" disabled={tests[svc]?.loading} onClick={() => runTest(svc)}>
                    {tests[svc]?.loading ? 'Testing…' : 'Test connection'}
                  </button>
                )}
                <button className="btn-amber" onClick={() => saveKeys(g.id, g.fields.map((f) => f.key))}>
                  Save
                </button>
              </>
            }
          >
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
            {tests[svc] && !tests[svc].loading && (
              <div
                className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
                  tests[svc].ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {tests[svc].ok ? `✓ ${tests[svc].message}` : `✗ ${tests[svc].error}`}
              </div>
            )}
          </SectionCard>
        );
      })}

      {/* Business Brain */}
      <SectionCard
        icon={ICONS.business}
        title="Business Brain"
        description="Everything AVA knows about your business — she greets callers, answers questions and texts pricing from this."
        actions={
          <>
            <SavedTick show={saved === 'brain'} />
            <button className="btn-amber" onClick={() => saveKeys('brain', BRAIN_FIELDS.map((f) => f.key))}>
              Save
            </button>
          </>
        }
      >
        <p className="text-xs text-stone-500 bg-stone-100 rounded-xl px-3 py-2 mb-4">
          Leave a field empty to keep the TabSphere defaults. The website may be mentioned to callers
          ("you can also see our work at tabsphere dot co dot uk").
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {BRAIN_FIELDS.map((f) => (
            <div key={f.key} className={f.textarea ? 'md:col-span-2' : ''}>
              <label className="label">{f.label}</label>
              {f.textarea ? (
                <textarea
                  className="input min-h-[96px] resize-y"
                  placeholder={f.placeholder || ''}
                  value={form[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  type="text"
                  placeholder={f.placeholder || ''}
                  value={form[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Availability & Booking */}
      <SectionCard
        icon={ICONS.calendar}
        title="Availability & Booking"
        description="The hours AVA can offer when a caller asks for a callback or consultation."
        actions={
          <>
            <SavedTick show={saved === 'availability'} />
            <button
              className="btn-amber"
              onClick={() => saveKeys('availability', ['AVAIL_DAYS', 'AVAIL_START_HOUR', 'AVAIL_END_HOUR'])}
            >
              Save
            </button>
          </>
        }
      >
        <p className="text-xs text-stone-500 bg-stone-100 rounded-xl px-3 py-2 mb-4">
          Slots are 30 minutes, timezone Europe/London.
        </p>
        <div className="mb-4">
          <label className="label">Available days</label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map(([key, label]) => {
              const active = (form.AVAIL_DAYS ?? 'mon,tue,wed,thu,fri,sat').split(',').map((d) => d.trim()).includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const cur = new Set((form.AVAIL_DAYS ?? 'mon,tue,wed,thu,fri,sat').split(',').map((d) => d.trim()).filter(Boolean));
                    if (cur.has(key)) cur.delete(key); else cur.add(key);
                    set('AVAIL_DAYS', DAY_OPTIONS.map(([k]) => k).filter((k) => cur.has(k)).join(','));
                  }}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-amber-500 text-charcoal border-amber-500'
                      : 'bg-white text-stone-500 border-stone-300 hover:border-amber-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="label">Start hour</label>
            <select
              className="input"
              value={form.AVAIL_START_HOUR ?? '9'}
              onChange={(e) => set('AVAIL_START_HOUR', e.target.value)}
            >
              {[...Array(24)].map((_, h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
          <div>
            <label className="label">End hour</label>
            <select
              className="input"
              value={form.AVAIL_END_HOUR ?? '18'}
              onChange={(e) => set('AVAIL_END_HOUR', e.target.value)}
            >
              {[...Array(24)].map((_, h) => <option key={h + 1} value={String(h + 1)}>{String(h + 1).padStart(2, '0')}:00</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Branding */}
      <SectionCard
        icon={ICONS.branding}
        title="Branding"
        description="Your logo appears on the login page and in the dashboard navbar."
      >
        <div className="flex flex-wrap items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {logo ? (
              <img src={logo} alt="Business logo" className="w-full h-full object-contain p-1.5" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-charcoal font-extrabold flex items-center justify-center text-xl">
                A
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button className="btn-amber" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
                {logoBusy ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
              </button>
              {logo && (
                <button className="btn" disabled={logoBusy} onClick={removeLogo}>
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500">png, jpg, svg or webp — max 500KB.</p>
            {logoMsg && (
              <p className={`text-xs font-semibold ${logoMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {logoMsg.text}
              </p>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={onLogoFile}
        />
      </SectionCard>

      {/* Security */}
      <SectionCard
        icon={ICONS.security}
        title="Security"
        description="Change the dashboard password. Sessions are protected by an HttpOnly cookie with login rate limiting."
      >
        <form onSubmit={submitPassword} className="grid md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="label">Current password</label>
            <input
              className="input"
              type="password"
              required
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">New password (8+ chars)</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-3">
            <button type="submit" className="btn-amber" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
            {pwMsg && (
              <span className={`text-sm font-semibold ${pwMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {pwMsg.text}
              </span>
            )}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
