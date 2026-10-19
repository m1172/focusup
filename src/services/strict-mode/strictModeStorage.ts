import { useAppStore } from '../../store/appStore';
import type { StrictSession } from '../../types/app';

/** Persistence boundary over the app's existing Zustand + AsyncStorage store. */
export const strictModeStorage = {
  getSession(): StrictSession | null { return useAppStore.getState().strictSession; },
  saveSession(session: StrictSession) { useAppStore.getState().activateStrict(session); },
  clearSession(endedEarly = false) { useAppStore.getState().finishStrict(endedEarly); },
  setNativeProtectionActive(active: boolean) { useAppStore.getState().setStrictNativeProtection(active); },
};
