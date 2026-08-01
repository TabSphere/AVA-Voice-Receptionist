import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api.js';

const URGENCY_STYLE = {
  URGENT: 'bg-red-100 text-red-700 animate-pulse',
  'HIGH VALUE': 'bg-amber-400 text-charcoal',
  STANDARD: 'bg-amber-100 text-amber-800',
  LOW: 'bg-stone-200 text-stone-600',
};

function fmtDur(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const COLS = 'grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.7fr_2rem] items-center gap-3';

export default function Calls() {
  const [calls, setCalls] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const load = () =>
      api
        .calls()
        .then((d) => {
          if (cancelled) return;
          setCalls(d.calls);
          // Poll fast while any call is in progress so transcripts stream in live.
          const live = d.calls.some((c) => c.status === 'active' || c.status === 'in-progress');
          clearTimeout(timer);
          if (live) timer = setTimeout(load, 3000);
        })
        .catch(() => {
          if (!cancelled) setCalls((prev) => prev ?? []);
        });
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Calls</h1>
      <div className="card p-0 overflow-hidden">
        {!calls ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12" />)}
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="text-4xl mb-3">📞</div>
            <h2 className="font-bold text-lg">No calls yet</h2>
            <p className="text-sm text-stone-500 mt-1 mb-5 max-w-sm mx-auto">
              Once Twilio is connected, AVA will answer and log every call here — with full transcripts.
            </p>
            <button className="btn-amber" onClick={() => window.dispatchEvent(new CustomEvent('ava:nav', { detail: 'settings' }))}>
              Connect Twilio in Settings →
            </button>
          </div>
        ) : (
          <div className="text-sm">
            <div className={`${COLS} px-5 py-3 text-left text-xs uppercase tracking-wide text-stone-400 border-b border-stone-200`}>
              <span>Time</span><span>Caller</span><span>Duration</span><span>Urgency</span><span>Lead</span><span />
            </div>
            {calls.map((c) => (
              <div key={c.id} className="border-b border-stone-100 last:border-0">
                <button
                  className={`${COLS} w-full px-5 py-3 text-left hover:bg-stone-50 transition-colors`}
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                >
                  <span className="whitespace-nowrap">
                    {new Date(c.startedAt).toLocaleString()}
                    {c.afterHours && (
                      <span className="ml-2 badge bg-stone-200 text-stone-500">after-hours</span>
                    )}
                    {c.demo && (
                      <span className="ml-2 badge bg-amber-500/15 text-amber-600 border border-amber-400/50">demo</span>
                    )}
                  </span>
                  <span className="font-semibold truncate">{c.from}</span>
                  <span>
                    {c.status === 'active' || c.status === 'in-progress' ? (
                      <span className="badge bg-amber-500 text-charcoal gap-1.5 animate-pulse">
                        <span className="relative flex w-2 h-2">
                          <span className="absolute inline-flex w-full h-full rounded-full bg-charcoal opacity-60 animate-ping" />
                          <span className="relative inline-flex w-2 h-2 rounded-full bg-charcoal" />
                        </span>
                        LIVE
                      </span>
                    ) : (
                      fmtDur(c.durationSec)
                    )}
                  </span>
                  <span>
                    {c.urgency ? (
                      <span className={`badge ${URGENCY_STYLE[c.urgency] || URGENCY_STYLE.STANDARD}`}>
                        {c.urgency}
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </span>
                  <span>
                    {c.leadId ? (
                      <span className="badge bg-emerald-100 text-emerald-700">lead ✓</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </span>
                  <motion.span
                    className="text-stone-400 justify-self-end"
                    animate={{ rotate: open === c.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    ▼
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {open === c.id && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden bg-stone-50"
                    >
                      <div className="px-5 py-4 space-y-2 max-w-2xl">
                        {c.transcript.length === 0 && (
                          <p className="text-stone-400 text-sm">No transcript captured.</p>
                        )}
                        {c.transcript.map((t, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.06, duration: 0.25 }}
                            className={`flex ${t.role === 'AVA' ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-2 max-w-[80%] text-sm shadow-sm ${
                                t.role === 'AVA'
                                  ? 'bg-charcoal text-white rounded-bl-sm'
                                  : 'bg-amber-100 text-charcoal rounded-br-sm'
                              }`}
                            >
                              <div className="text-[10px] uppercase tracking-wide opacity-60 font-bold mb-0.5">
                                {t.role}
                              </div>
                              {t.content}
                            </div>
                          </motion.div>
                        ))}
                        {c.voicemail && (
                          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                            <div className="label mb-1">Voicemail</div>
                            {c.voicemail}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
