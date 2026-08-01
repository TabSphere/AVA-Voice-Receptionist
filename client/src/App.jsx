import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Overview from './pages/Overview.jsx';
import Settings from './pages/Settings.jsx';
import Calls from './pages/Calls.jsx';
import Leads from './pages/Leads.jsx';
import { api } from './api.js';

const NAV = [
  {
    id: 'overview', label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'calls', label: 'Calls',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />
      </svg>
    ),
  },
  {
    id: 'leads', label: 'Leads',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 2l2.6 5.6 6 .6-4.5 4.1 1.3 5.9L12 15.2 6.6 18.2l1.3-5.9L3.4 8.2l6-.6z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

const PAGES = { overview: Overview, calls: Calls, leads: Leads, settings: Settings };

export default function App() {
  const [page, setPage] = useState('overview');
  const [demoMode, setDemoMode] = useState(false);

  // Poll status lightly for the DEMO badge (pages poll their own data too).
  useEffect(() => {
    let cancelled = false;
    const load = () => api.status().then((s) => !cancelled && setDemoMode(Boolean(s.demoMode))).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    const onDemo = (e) => setDemoMode(Boolean(e.detail));
    const onNav = (e) => setPage(e.detail);
    window.addEventListener('ava:demo', onDemo);
    window.addEventListener('ava:nav', onNav);
    return () => { cancelled = true; clearInterval(t); window.removeEventListener('ava:demo', onDemo); window.removeEventListener('ava:nav', onNav); };
  }, []);

  const Page = PAGES[page];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-16 lg:w-60 shrink-0 bg-charcoal text-stone-200 flex flex-col transition-all">
        <div className="px-3 lg:px-5 py-6 border-b border-stone-800">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-2xl bg-amber-500/40 blur-md" aria-hidden />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-charcoal font-extrabold flex items-center justify-center text-lg shadow-lg shadow-amber-500/20">
                A
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="font-bold text-white leading-tight">AVA</div>
              <div className="text-xs text-stone-400 leading-tight">Voice Receptionist</div>
            </div>
            <AnimatePresence>
              {demoMode && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="hidden lg:inline-flex badge bg-amber-500/15 text-amber-400 border border-amber-500/40 ml-auto"
                >
                  DEMO
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <nav className="flex-1 p-2 lg:p-3 space-y-1">
          {NAV.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`relative w-full flex items-center gap-3 rounded-xl px-3 lg:px-4 py-2.5 text-sm font-semibold transition-colors justify-center lg:justify-start ${
                  active ? 'text-charcoal' : 'text-stone-300 hover:bg-slate2 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-amber-500 shadow-md shadow-amber-500/25"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 w-5 flex justify-center">{n.icon}</span>
                <span className="relative z-10 hidden lg:inline">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-2 lg:p-3 border-t border-stone-800">
          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
              window.location = '/login';
            }}
            title="Sign out"
            className="w-full flex items-center gap-3 rounded-xl px-3 lg:px-4 py-2.5 text-sm font-semibold text-stone-400 hover:bg-slate2 hover:text-white transition-colors justify-center lg:justify-start"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden lg:inline">Sign out</span>
          </button>
          <div className="p-2 text-xs text-stone-500 hidden lg:block">
            TabSphere Limited · Stirling
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-5 lg:p-10 max-w-6xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
