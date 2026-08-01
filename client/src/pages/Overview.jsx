import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { api } from '../api.js';

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Animated count-up number that springs to its new value on change. */
function Counter({ value, className = '' }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    if (typeof value === 'number') spring.set(value);
  }, [value, spring]);
  return <motion.span className={className}>{display}</motion.span>;
}

function PulseDot({ ok }) {
  if (!ok) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-stone-300" />;
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function Overview() {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');
  const firstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .status()
        .then((s) => {
          if (cancelled) return;
          // Merge smoothly: keep object identity stable to avoid flicker.
          setStatus(s);
          setErr('');
          firstLoad.current = false;
        })
        .catch((e) => !cancelled && setErr(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const services = status?.services || {};
  const cards = [
    { label: 'Twilio', ok: services.twilio },
    { label: 'OpenAI', ok: services.openai },
    { label: 'ElevenLabs', ok: services.elevenlabs },
    { label: 'WhatsApp', ok: services.whatsapp },
  ];

  if (!status && !err) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-9 w-44" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="skeleton h-56" />
          <div className="skeleton h-56" />
        </div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Overview</h1>
        {status && (
          <span className="text-sm text-stone-500">
            Uptime: <span className="font-semibold text-charcoal">{fmtUptime(status.uptimeSec)}</span>
          </span>
        )}
      </motion.div>

      {err && <div className="card border-red-300 text-red-700 text-sm">API error: {err}</div>}

      {/* Service status */}
      <motion.div variants={rise} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center justify-between hover:shadow-md transition-shadow">
            <span className="font-bold">{c.label}</span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <PulseDot ok={c.ok} />
              {c.ok ? (
                <span className="text-emerald-600">Configured</span>
              ) : (
                <span className="text-stone-400">Not set</span>
              )}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Counts + active calls */}
      <motion.div variants={rise} className="grid lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="label">Calls today</div>
          <Counter value={status?.callsToday ?? 0} className="text-4xl font-extrabold" />
        </div>
        <div className="card">
          <div className="label">Leads today</div>
          <Counter value={status?.leadsToday ?? 0} className="text-4xl font-extrabold text-amber-600" />
        </div>
        <div className="card">
          <div className="label">Active calls</div>
          <Counter value={status?.activeCalls?.length ?? 0} className="text-4xl font-extrabold" />
        </div>
      </motion.div>

      <motion.div variants={rise} className="grid lg:grid-cols-2 gap-4">
        {/* Active calls list */}
        <div className="card">
          <h2 className="font-bold mb-3">Live calls</h2>
          {status?.activeCalls?.length ? (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {status.activeCalls.map((c) => (
                  <motion.li
                    key={c.callSid}
                    layout
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 14 }}
                    className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5"
                  >
                    <div>
                      <div className="font-semibold text-sm">{c.from}</div>
                      <div className="text-xs text-stone-500">
                        {new Date(c.startedAt).toLocaleTimeString()} · {c.turns} turns
                      </div>
                    </div>
                    <span className="badge bg-red-500 text-white gap-1.5">
                      <span className="relative flex w-2 h-2">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" />
                        <span className="relative inline-flex w-2 h-2 rounded-full bg-white" />
                      </span>
                      LIVE
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <div className="text-center py-6">
              <div className="text-2xl mb-1">📞</div>
              <p className="text-sm text-stone-400">No calls in progress right now.</p>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="card">
          <h2 className="font-bold mb-3">Recent activity</h2>
          {status?.activity?.length ? (
            <ul className="space-y-2 max-h-64 overflow-auto pr-1">
              <AnimatePresence initial={false}>
                {status.activity.map((a) => (
                  <motion.li
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm flex gap-3 items-start overflow-hidden"
                  >
                    <span className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">
                      {new Date(a.ts).toLocaleTimeString()}
                    </span>
                    <span className="text-stone-700">{a.message}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <div className="text-center py-6">
              <div className="text-2xl mb-1">✨</div>
              <p className="text-sm text-stone-400">
                Nothing yet — once AVA starts answering calls, activity will stream in here.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
