import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_STORE_VERSION, migrateOnboarding, toggleAnswer, useOnboardingStore } from '../onboardingStore';

const v4 = { source: 'estimate', shortFormMinutes: 150, measured: null, measuredAt: null, cut: 0.75 };

describe('onboarding store migration', () => {
  it('keeps v4 answers and adds the new questions empty', () => {
    expect(migrateOnboarding(v4, 4)).toEqual({
      ...v4, age: null, reasons: [], tried: [], goals: [], referralCode: '', committedAt: null, paywallPending: false,
    });
  });

  it('restarts older quizzes with only the chosen cut', () => {
    expect(migrateOnboarding({ cut: 0.25, shortFormMinutes: 60 }, 3)).toEqual({ cut: 0.25 });
    expect(migrateOnboarding(undefined, 0)).toEqual({ cut: 0.5 });
  });

  it('drops malformed list answers instead of crashing', () => {
    const migrated = migrateOnboarding({ ...v4, reasons: 'messages', goals: ['sleep', 3] }, 4);
    expect(migrated.reasons).toEqual([]);
    expect(migrated.goals).toEqual(['sleep']);
  });

  it('rehydrates a saved v4 store into the current version', async () => {
    await AsyncStorage.setItem('focusup-onboarding-v1', JSON.stringify({ state: v4, version: 4 }));
    await useOnboardingStore.persist.rehydrate();
    const state = useOnboardingStore.getState();
    expect(state.shortFormMinutes).toBe(150);
    expect(state.cut).toBe(0.75);
    expect(state.age).toBeNull();
    expect(state.goals).toEqual([]);
    const saved = JSON.parse((await AsyncStorage.getItem('focusup-onboarding-v1')) ?? '{}');
    expect(saved.version).toBe(ONBOARDING_STORE_VERSION);
  });
});

describe('toggleAnswer', () => {
  it('adds and removes keys', () => {
    expect(toggleAnswer([], 'a')).toEqual(['a']);
    expect(toggleAnswer(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('treats exclusive answers as "only this one"', () => {
    expect(toggleAnswer(['a', 'b'], 'nothing', ['nothing'])).toEqual(['nothing']);
    expect(toggleAnswer(['nothing'], 'a', ['nothing'])).toEqual(['a']);
  });
});
