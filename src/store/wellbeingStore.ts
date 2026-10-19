import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SocialAppId } from '../types/app';
import type { SleepPlan, TemporaryAccess } from '../services/protection/types';
import { ALL_PLATFORMS, validateSleepPlan } from '../services/protection/engine';

export const defaultSleepPlan: SleepPlan = { enabled: false, bedtime: '22:30', wakeTime: '07:00', windDownMinutes: 30, morningMinutes: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['instagram', 'youtube'], allowedApps: [], notify: false };
type WellbeingState = {
  launchDestination: 'home' | 'instagram' | 'youtube';
  nativeApps: SocialAppId[];
  sleep: SleepPlan;
  temporary: TemporaryAccess | null;
  liveActivity: boolean;
  setLiveActivity: (enabled: boolean) => void;
  setLaunchDestination: (value: WellbeingState['launchDestination']) => void;
  setNativeApps: (apps: SocialAppId[]) => void;
  setSleep: (sleep: SleepPlan) => void;
  setTemporary: (access: TemporaryAccess | null) => void;
};
export const useWellbeingStore = create<WellbeingState>()(persist((set) => ({
  launchDestination: 'home', nativeApps: [], sleep: defaultSleepPlan, temporary: null, liveActivity: false,
  setLiveActivity: (liveActivity) => set({ liveActivity }),
  setLaunchDestination: (launchDestination) => set({ launchDestination }),
  setNativeApps: (nativeApps) => set({ nativeApps: [...new Set(nativeApps)] }),
  setSleep: (sleep) => set({ sleep }),
  setTemporary: (temporary) => set({ temporary }),
}), { name: 'focusup-wellbeing-v1', version: 1, storage: createJSONStorage(() => AsyncStorage), merge: (persisted, current) => {
  const raw = persisted && typeof persisted === 'object' ? persisted as Partial<WellbeingState> : {};
  const temporary = raw.temporary;
  const validTemporary = temporary && ALL_PLATFORMS.includes(temporary.platform) && typeof temporary.id === 'string' && temporary.id.length < 100 && Number.isFinite(temporary.startedAt) && Number.isFinite(temporary.endsAt) && temporary.endsAt > temporary.startedAt && temporary.endsAt - temporary.startedAt <= 120 * 60_000;
  return { ...current, launchDestination: raw.launchDestination === 'instagram' || raw.launchDestination === 'youtube' ? raw.launchDestination : 'home', nativeApps: Array.isArray(raw.nativeApps) ? [...new Set(raw.nativeApps.filter((app) => ALL_PLATFORMS.includes(app)))] : [], sleep: validateSleepPlan(raw.sleep) ? raw.sleep : defaultSleepPlan, temporary: validTemporary ? temporary : null, liveActivity: raw.liveActivity === true };
} }));
