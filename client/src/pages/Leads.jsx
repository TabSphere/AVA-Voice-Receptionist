import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';

const URGENCY_STYLE = {
  URGENT: 'bg-red-100 text-red-700 border-red-300 animate-pulse',
  'HIGH VALUE': 'bg-amber-400 text-charcoal border-amber-500',
  STANDARD: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-stone-200 text-stone-600 border-stone-300',
};

const FIELDS = [
  ['fullName', 'Name'],
  ['businessName', 'Business'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['serviceInterestedIn', 'Service'],
  ['budget', 'Budget'],
  ['callbackTime', 'Best callback'],
  ['howTheyHeard', 'Heard via'],
];

function waLink(lead) {
  const num = (lead.phone || lead.callerNumber || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return num ? `https://wa.me/${num}` : null;
}

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const reload = () => api.leads().then((d) => setLeads(d.leads)).catch(() => setLeads([]));
  useEffect(() => { reload(); }, []);

  async function tryDemo() {
    setDemoBusy(true);
    try {
      const res = await api.setDemo(true);
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('ava:demo', { detail: true }));
        await reload();
      }
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Leads</h1>
      {!leads ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-56" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="card text-center py-14 px-6">
          <div className="text-4xl mb-3">⭐</div>
          <h2 className="font-bold text-lg">No leads captured yet</h2>
          <p className="text-sm text-stone-500 mt-1 mb-5 max-w-sm mx-auto">
            When a call ends, AVA extracts the caller's details and saves them here.
          </p>
          <button className="btn-amber" disabled={demoBusy} onClick={tryDemo}>
            {demoBusy ? 'Loading sample data…' : 'Try Demo Mode'}
          </button>
          <p className="text-xs text-stone-400 mt-3">Demo data is clearly tagged and never mixes with real call data.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {leads.map((l, i) => {
            const wa = waLink(l);
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.5), duration: 0.35, ease: 'easeOut' }}
                whileHover={{ y: -4, boxShadow: '0 12px 28px -12px rgba(28,25,23,0.25)' }}
                className="card space-y-3 border-l-4 border-l-amber-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-lg leading-tight">
                      {l.fullName || l.callerNumber || 'Unknown caller'}
                      {l.demo && (
                        <span className="ml-2 badge bg-amber-500/15 text-amber-600 border border-amber-400/50 align-middle">demo</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400">
                      {new Date(l.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className={`badge border ${URGENCY_STYLE[l.urgencyLevel] || URGENCY_STYLE.STANDARD}`}>
                    {l.urgencyLevel}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {FIELDS.map(([k, label]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-stone-400 font-bold">{label}</dt>
                      <dd className="font-medium break-words">{l[k] || '—'}</dd>
                    </div>
                  ))}
                </dl>

                {l.summary && (
                  <p className="text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
                    {l.summary}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  {wa && (
                    <a className="btn-amber text-xs" href={wa} target="_blank" rel="noreferrer">
                      WhatsApp ↗
                    </a>
                  )}
                  {l.email && (
                    <a className="btn text-xs" href={`mailto:${l.email}`}>
                      Email ↗
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
