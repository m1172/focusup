import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ONBOARDING_APPS, type OnboardingAppId } from '../features/onboarding/lifeProjection';
import type { MeasuredUsage } from '../services/device-usage/androidUsage';

/**
 * Answers from the onboarding. Android measures real per-app time (`measured`);
 * iOS — or an Android user who skips the permission — answers one short-video question.
 */
type OnboardingState = {
  source: 'estimate' | 'measured';
  shortFormMinutes: number;
  measured: MeasuredUsage | null;
  age: number;
  cut: number;
  setShortFormMinutes: (minutes: number) => void;
  setMeasured: (usage: MeasuredUsage) => void;
  chooseEstimate: () => void;
  setAge: (age: number) => void;
  setCut: (cut: number) => void;
};

export const useOnboardingStore = create<OnboardingState>()(persist((set) => ({
  source: 'estimate',
  shortFormMinutes: 90,
  measured: null,
  age: 25,
  cut: 0.5,
  setShortFormMinutes: (shortFormMinutes) => set({ shortFormMinutes, source: 'estimate' }),
  setMeasured: (measured) => set({ measured, source: 'measured' }),
  chooseEstimate: () => set({ source: 'estimate' }),
  setAge: (age) => set({ age }),
  setCut: (cut) => set({ cut }),
}), {
  name: 'focusup-onboarding-v1',
  storage: createJSONStorage(() => AsyncStorage),
  version: 3,
  partialize: ({ source, shortFormMinutes, measured, age, cut }) => ({ source, shortFormMinutes, measured, age, cut }),
  migrate: (persisted) => {
    const { age, cut } = (persisted ?? {}) as Partial<OnboardingState>;
    return { age: age ?? 25, cut: cut ?? 0.5 } as OnboardingState;
  },
}));

type Answers = Pick<OnboardingState, 'source' | 'shortFormMinutes' | 'measured'>;

/** Total daily minutes the projection uses. */
export function totalMinutes(state: Answers) {
  if (state.source === 'measured' && state.measured) return ONBOARDING_APPS.reduce((sum, id) => sum + (state.measured?.minutes[id] ?? 0), 0);
  return state.shortFormMinutes;
}

/** Per-app minutes when measured; empty for the single-question estimate. */
export function measuredMinutes(state: Answers): Partial<Record<OnboardingAppId, number>> {
  return state.source === 'measured' && state.measured ? state.measured.minutes : {};
}
