'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const MotionContext = createContext({ paused: true, reduced: false, toggle: () => {} });

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReduced(query.matches);
    syncPreference();
    try { setUserPaused(localStorage.getItem('sky-motion') === 'paused'); } catch {}
    setReady(true);
    query.addEventListener('change', syncPreference);
    return () => query.removeEventListener('change', syncPreference);
  }, []);

  const paused = !ready || reduced || userPaused;
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? 'paused' : 'playing';
  }, [paused]);

  function toggle() {
    if (reduced || !ready) return;
    setUserPaused(!userPaused);
    try { localStorage.setItem('sky-motion', userPaused ? 'playing' : 'paused'); } catch {}
  }

  return <MotionContext.Provider value={{ paused, reduced, toggle }}>{children}</MotionContext.Provider>;
}

export function MotionControl() {
  const { paused, reduced, toggle } = useContext(MotionContext);
  const label = reduced ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
  return <button className="motion-toggle" type="button" aria-label={label} onClick={toggle} disabled={reduced}>
    {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}<span>{label}</span>
  </button>;
}
