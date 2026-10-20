import { router } from 'expo-router';
import { entryDestination } from '../../services/backend/accessPolicy';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';

/** Only a confirmed session may finish onboarding. Recovery must finish first. */
export function leaveAuth(fromOnboarding: boolean) {
  const account = useAccountStore.getState();
  if (!account.user) { router.replace('/auth/sign-in'); return; }
  if (fromOnboarding && !account.recoveryRequired) useAppStore.getState().completeOnboarding();
  const destination = entryDestination(account, useAppStore.getState().onboardingCompleted, useWellbeingStore.getState().launchDestination);
  router.replace(destination ?? '/');
}
