import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';

function fmtDate(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function fmtTime(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export default function Bookings() {
  const [bookings, setBookings] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const reload = () => api.bookings().then((d) => setBookings(d.bookings)).catch(() => setBookings([]));
  useEffect(() => { reload(); }, []);

  async function cancel(b) {
    if (!window.confirm(`Cancel the booking for ${b.name || 'this caller'} on ${fmtDate(b.startISO)} at ${fmtTime(b.startISO)}?`)) return;
    setBusyId(b.id);
    try {
      await api.cancelBooking(b.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

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

  const upcoming = (bookings || [])
    .filter((b) => new Date(b.startISO).getTime() >= Date.now() - 30 * 60e3)
    .sort((a, b2) => new Date(a.startISO) - new Date(b2.startISO));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Bookings</h1>
      {!bookings ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="card text-center py-14 px-6">
          <div className="text-4xl mb-3">📅</div>
          <h2 className="font-bold text-lg">No upcoming bookings</h2>
          <p className="text-sm text-stone-500 mt-1 mb-5 max-w-sm mx-auto">
            When a caller asks for a consultation or callback at a specific time, AVA books a slot and it appears here.
          </p>
          <button className="btn-amber" onClick={tryDemo} disabled={demoBusy}>
            {demoBusy ? 'Loading…' : 'Try demo mode'}
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {upcoming.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-lg leading-tight">
                    {fmtDate(b.startISO)} · {fmtTime(b.startISO)}
                  </div>
                  <div className="text-sm text-stone-500 mt-0.5">{b.service || 'Consultation'}</div>
                </div>
                {b.demo && (
                  <span className="badge bg-amber-500/15 text-amber-600 border border-amber-500/40 shrink-0">DEMO</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-stone-400 text-xs font-semibold uppercase tracking-wide">Name</dt>
                  <dd className="font-medium">{b.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-stone-400 text-xs font-semibold uppercase tracking-wide">Phone</dt>
                  <dd className="font-medium">{b.phone || '—'}</dd>
                </div>
              </dl>
              <div className="flex gap-2 pt-1">
                <button
                  className="btn text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => cancel(b)}
                  disabled={busyId === b.id}
                >
                  {busyId === b.id ? 'Cancelling…' : 'Cancel booking'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
