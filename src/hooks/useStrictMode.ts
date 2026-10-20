import { PRO_ENABLED } from '../config/release';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { reconcileStrictModeState } from '../services/strict-mode/strictModeController';
import { getRemainingMs } from '../services/strict-mode/types';

export function useStrictMode() {
  const session = useAppStore((state) => PRO_ENABLED ? state.strictSession : null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (session && session.endsAt <= next) void reconcileStrictModeState(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);
  return { session, now, remainingMs: getRemainingMs(session, now), active: Boolean(session && session.endsAt > now) };
}
