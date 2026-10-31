import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { PRO_ENABLED } from '../../config/release';
import { useOnboardingStore } from '../../store/onboardingStore';

/**
 * Opens the paywall once, right after onboarding, when Pro is on. The paywall has its own close button, so
 * blocking (free) is never held behind it. Mounted outside the root Stack so navigation updates don't
 * re-create its Protected groups.
 */
export function OnboardingPaywall({ enabled }: { enabled: boolean }) {
  const navigationKey = useRootNavigationState()?.key;
  const pending = useOnboardingStore((s) => s.paywallPending);
  useEffect(() => {
    if (!enabled || !pending || !navigationKey) return;
    useOnboardingStore.getState().clearPaywall();
    if (PRO_ENABLED) router.push('/pro');
  }, [enabled, navigationKey, pending]);
  return null;
}
