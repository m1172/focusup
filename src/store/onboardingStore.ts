import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ONBOARDING_APPS, type OnboardingAppId } from '../features/onboarding/dayBudget';
import type { MeasuredUsage } from '../services/device-usage/androidUsage';

/**
 * Answers from the onboarding. Android measures real per-app time (`measured`);
 * iOS — or an Android user who skips the permission — answers one short-video question.
 */
type OnboardingState = {
  source: 'estimate' | 'measured';
  shortFormMinutes: number;
  measured: MeasuredUsage | null;
  cut: number;
  setShortFormMinutes: (minutes: number) => void;
  setMeasured: (usage: MeasuredUsage) => void;
  chooseEstimate: () => void;
  setCut: (cut: number) => void;
};

export const useOnboardingStore = create<OnboardingState>()(persist((set) => ({
  source: 'estimate',
  shortFormMinutes: 90,
  measured: null,
  cut: 0.5,
  setShortFormMinutes: (shortFormMinutes) => set({ shortFormMinutes, source: 'estimate' }),
  setMeasured: (measured) => set({ measured, source: 'measured' }),
  chooseEstimate: () => set({ source: 'estimate' }),
  setCut: (cut) => set({ cut }),
}), {
  name: 'focusup-onboarding-v1',
  storage: createJSONStorage(() => AsyncStorage),
  version: 4,
  partialize: ({ source, shortFormMinutes, measured, cut }) => ({ source, shortFormMinutes, measured, cut }),
  migrate: (persisted) => {
    const { cut } = (persisted ?? {}) as Partial<OnboardingState>;
    return { cut: cut ?? 0.5 } as OnboardingState;
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
