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
  /** When `measured` was read: the pre-install baseline's date. Null for answers saved before this was kept. */
  measuredAt: number | null;
  cut: number;
  /** Age in years; null until the age step is answered. */
  age: number | null;
  /** "Why not just delete it?" answer keys. */
  reasons: string[];
  /** "What have you tried?" answer keys. */
  tried: string[];
  /** What the user wants to spend the time on instead. */
  goals: string[];
  /** Optional invite code, kept on this device and sent only as an analytics property. */
  referralCode: string;
  /** When the user held the commit button. */
  committedAt: number | null;
  /** Show the paywall once after onboarding finishes (only set while Pro is on). */
  paywallPending: boolean;
  setShortFormMinutes: (minutes: number) => void;
  setMeasured: (usage: MeasuredUsage) => void;
  chooseEstimate: () => void;
  setCut: (cut: number) => void;
  setAge: (age: number) => void;
  setReasons: (reasons: string[]) => void;
  setTried: (tried: string[]) => void;
  setGoals: (goals: string[]) => void;
  setReferralCode: (code: string) => void;
  commit: (paywall: boolean) => void;
  clearPaywall: () => void;
};

type Persisted = Pick<OnboardingState, 'source' | 'shortFormMinutes' | 'measured' | 'measuredAt' | 'cut' | 'age' | 'reasons' | 'tried' | 'goals' | 'referralCode' | 'committedAt' | 'paywallPending'>;

export const ONBOARDING_STORE_VERSION = 5;

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

/**
 * v4 → v5 keeps every answer and adds the new questions empty. Anything older restarts the quiz
 * with only the chosen cut, as before.
 */
export function migrateOnboarding(persisted: unknown, version: number): Partial<Persisted> {
  const old = (persisted ?? {}) as Partial<Persisted>;
  if (version < 4) return { cut: old.cut ?? 0.5 };
  return {
    source: old.source === 'measured' ? 'measured' : 'estimate',
    shortFormMinutes: typeof old.shortFormMinutes === 'number' ? old.shortFormMinutes : 90,
    measured: old.measured ?? null,
    measuredAt: old.measuredAt ?? null,
    cut: old.cut ?? 0.5,
    age: typeof old.age === 'number' ? old.age : null,
    reasons: strings(old.reasons),
    tried: strings(old.tried),
    goals: strings(old.goals),
    referralCode: typeof old.referralCode === 'string' ? old.referralCode : '',
    committedAt: old.committedAt ?? null,
    paywallPending: false,
  };
}

export const useOnboardingStore = create<OnboardingState>()(persist((set) => ({
  source: 'estimate',
  shortFormMinutes: 90,
  measured: null,
  measuredAt: null,
  cut: 0.5,
  age: null,
  reasons: [],
  tried: [],
  goals: [],
  referralCode: '',
  committedAt: null,
  paywallPending: false,
  setShortFormMinutes: (shortFormMinutes) => set({ shortFormMinutes, source: 'estimate' }),
  setMeasured: (measured) => set({ measured, measuredAt: Date.now(), source: 'measured' }),
  chooseEstimate: () => set({ source: 'estimate' }),
  setCut: (cut) => set({ cut }),
  setAge: (age) => set({ age }),
  setReasons: (reasons) => set({ reasons }),
  setTried: (tried) => set({ tried }),
  setGoals: (goals) => set({ goals }),
  setReferralCode: (referralCode) => set({ referralCode }),
  commit: (paywall) => set({ committedAt: Date.now(), paywallPending: paywall }),
  clearPaywall: () => set({ paywallPending: false }),
}), {
  name: 'focusup-onboarding-v1',
  storage: createJSONStorage(() => AsyncStorage),
  version: ONBOARDING_STORE_VERSION,
  partialize: ({ source, shortFormMinutes, measured, measuredAt, cut, age, reasons, tried, goals, referralCode, committedAt, paywallPending }): Persisted => ({ source, shortFormMinutes, measured, measuredAt, cut, age, reasons, tried, goals, referralCode, committedAt, paywallPending }),
  migrate: (persisted, version) => migrateOnboarding(persisted, version) as OnboardingState,
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

/** Adds `key` to a multi-select answer, or removes it when already picked. `only` keys clear the rest. */
export function toggleAnswer(current: readonly string[], key: string, only: readonly string[] = []) {
  if (current.includes(key)) return current.filter((item) => item !== key);
  if (only.includes(key)) return [key];
  return [...current.filter((item) => !only.includes(item)), key];
}
