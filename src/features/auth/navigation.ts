import { router } from 'expo-router';
import { accountApi } from '../../services/backend/accountSession';
import { applyCloudOnboarding, finishedOnboarding } from '../../services/backend/onboardingBackup';
import type { CloudBackup } from '../../services/backend/types';
import { entryDestination } from '../../services/backend/accessPolicy';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';

let returningSignIn = false;
/** True once after a returning user skipped onboarding, so it is not counted as a finished onboarding. */
export function takeReturningSignIn() { const value = returningSignIn; returningSignIn = false; return value; }

/**
 * Each account's backup says whether it finished onboarding (with the answers). An account that finished it on
 * another phone, or before a reinstall, skips it here and gets its answers back. A new account, one that stopped
 * partway, or a failed check keeps onboarding.
 */
export async function previousOnboarding(getSettings: () => Promise<CloudBackup> = () => accountApi().getSettings()) {
  try {
    const { payload } = await getSettings();
    return finishedOnboarding(payload) ? { finished: true as const, onboarding: payload?.onboarding } : { finished: false as const };
  } catch { return { finished: false as const }; }
}

/** Only a confirmed session may finish onboarding. Recovery must finish first. */
export async function leaveAuth(fromOnboarding: boolean) {
  const signedIn = useAccountStore.getState();
  if (!signedIn.user) { router.replace('/auth/sign-in'); return; }
  if (!signedIn.recoveryRequired && !useAppStore.getState().onboardingCompleted) {
    const previous = fromOnboarding ? null : await previousOnboarding();
    const returning = Boolean(previous?.finished);
    const account = useAccountStore.getState();
    if (account.user?.id === signedIn.user.id && !account.recoveryRequired && (fromOnboarding || returning)) {
      returningSignIn = returning;
      if (previous?.finished) applyCloudOnboarding(previous.onboarding);
      useAppStore.getState().completeOnboarding();
    }
  }
  const account = useAccountStore.getState();
  if (!account.user) { router.replace('/auth/sign-in'); return; }
  const destination = entryDestination(account, useAppStore.getState().onboardingCompleted, useWellbeingStore.getState().launchDestination);
  router.replace(destination ?? '/');
}
