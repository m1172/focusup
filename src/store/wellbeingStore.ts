import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SocialAppId } from '../types/app';
import type { SleepPlan, TemporaryAccess } from '../services/protection/types';
import { ALL_PLATFORMS, validateSleepPlan } from '../services/protection/engine';

export const defaultSleepPlan: SleepPlan = { enabled: false, bedtime: '22:30', wakeTime: '07:00', windDownMinutes: 30, morningMinutes: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['instagram', 'youtube', 'tiktok'], allowedApps: [], notify: false };
type WellbeingState = {
  launchDestination: 'home' | 'instagram' | 'youtube' | 'tiktok';
  nativeApps: SocialAppId[];
  sleep: SleepPlan;
  temporary: TemporaryAccess | null;
  liveActivity: boolean;
  /** iOS: Apple's adult-website filter (Pro). */
  adultFilter: boolean;
  /** iOS: Vaqtim cannot be deleted while this is on (Pro). */
  uninstallProtection: boolean;
  /** Shows the clean browser in black and white (Pro). */
  grayscale: boolean;
  /** Minutes a day per app before it is blocked until midnight (Pro). */
  dailyLimits: Partial<Record<SocialAppId, number>>;
  /** Breaks taken today in Hard Mode, by local date. */
  breaks: { day: string; count: number };
  setLiveActivity: (enabled: boolean) => void;
  setAdultFilter: (enabled: boolean) => void;
  setUninstallProtection: (enabled: boolean) => void;
  setGrayscale: (enabled: boolean) => void;
  setDailyLimit: (appId: SocialAppId, minutes: number | null) => void;
  recordBreak: (day: string) => void;
  setLaunchDestination: (value: WellbeingState['launchDestination']) => void;
  setNativeApps: (apps: SocialAppId[]) => void;
  setSleep: (sleep: SleepPlan) => void;
  setTemporary: (access: TemporaryAccess | null) => void;
};
/** Daily limits are whole minutes between 5 and 600 for known apps. */
export function validDailyLimits(value: unknown): Partial<Record<SocialAppId, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([app, minutes]) => ALL_PLATFORMS.includes(app as SocialAppId) && Number.isInteger(minutes) && (minutes as number) >= 5 && (minutes as number) <= 600)) as Partial<Record<SocialAppId, number>>;
}

export const useWellbeingStore = create<WellbeingState>()(persist((set) => ({
  launchDestination: 'home', nativeApps: [], sleep: defaultSleepPlan, temporary: null, liveActivity: false,
  adultFilter: false, uninstallProtection: false, grayscale: false, dailyLimits: {}, breaks: { day: '', count: 0 },
  setLiveActivity: (liveActivity) => set({ liveActivity }),
  setAdultFilter: (adultFilter) => set({ adultFilter }),
  setUninstallProtection: (uninstallProtection) => set({ uninstallProtection }),
  setGrayscale: (grayscale) => set({ grayscale }),
  setDailyLimit: (appId, minutes) => set((state) => {
    const dailyLimits = { ...state.dailyLimits };
    if (minutes === null) delete dailyLimits[appId]; else dailyLimits[appId] = minutes;
    return { dailyLimits };
  }),
  recordBreak: (day) => set((state) => ({ breaks: { day, count: state.breaks.day === day ? state.breaks.count + 1 : 1 } })),
  setLaunchDestination: (launchDestination) => set({ launchDestination }),
  setNativeApps: (nativeApps) => set({ nativeApps: [...new Set(nativeApps)] }),
  setSleep: (sleep) => set({ sleep }),
  setTemporary: (temporary) => set({ temporary }),
}), { name: 'focusup-wellbeing-v1', version: 1, storage: createJSONStorage(() => AsyncStorage), merge: (persisted, current) => {
  const raw = persisted && typeof persisted === 'object' ? persisted as Partial<WellbeingState> : {};
  const temporary = raw.temporary;
  const validTemporary = temporary && ALL_PLATFORMS.includes(temporary.platform) && typeof temporary.id === 'string' && temporary.id.length < 100 && Number.isFinite(temporary.startedAt) && Number.isFinite(temporary.endsAt) && temporary.endsAt > temporary.startedAt && temporary.endsAt - temporary.startedAt <= 120 * 60_000;
  return { ...current, launchDestination: raw.launchDestination === 'instagram' || raw.launchDestination === 'youtube' || raw.launchDestination === 'tiktok' ? raw.launchDestination : 'home', nativeApps: Array.isArray(raw.nativeApps) ? [...new Set(raw.nativeApps.filter((app) => ALL_PLATFORMS.includes(app)))] : [], sleep: validateSleepPlan(raw.sleep) ? raw.sleep : defaultSleepPlan, temporary: validTemporary ? temporary : null, liveActivity: raw.liveActivity === true,
    adultFilter: raw.adultFilter === true, uninstallProtection: raw.uninstallProtection === true, grayscale: raw.grayscale === true,
    dailyLimits: validDailyLimits(raw.dailyLimits),
    breaks: raw.breaks && typeof raw.breaks.day === 'string' && Number.isSafeInteger(raw.breaks.count) && raw.breaks.count >= 0 ? raw.breaks : { day: '', count: 0 } };
} }));
