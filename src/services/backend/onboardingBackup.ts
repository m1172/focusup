import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { CloudOnboarding, CloudSettings } from './types';

/**
 * Whether the account behind a cloud backup finished onboarding. Backups from builds before onboarding was
 * saved have no `onboarding` part; those accounts were set up on a phone, so they count as finished.
 */
export function finishedOnboarding(payload: CloudSettings | null): boolean {
  if (!payload) return false;
  return payload.onboarding ? payload.onboarding.completed : true;
}

/**
 * Gives this phone a finished onboarding's daily time, so Home's usual time and savings match the account
 * (split evenly across the apps, as for a typed-in estimate). Only while this phone has not finished onboarding
 * itself: its own answers are never replaced.
 */
export function applyCloudOnboarding(onboarding: CloudOnboarding | undefined) {
  if (!onboarding?.completed || useAppStore.getState().onboardingCompleted) return;
  useOnboardingStore.setState({ source: 'estimate', shortFormMinutes: onboarding.usualMinutes, cut: onboarding.cut });
}
