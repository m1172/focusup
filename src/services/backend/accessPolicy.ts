import type { SessionState } from './sessionManager';

export function canEnterApp(account: SessionState, onboardingCompleted: boolean, hydrated: boolean, backendConfigured: boolean): boolean {
  return hydrated && backendConfigured && account.ready && Boolean(account.user) && !account.recoveryRequired && onboardingCompleted;
}

/** One destination policy for cold starts, successful authentication, and denied links. */
export function entryDestination(account: SessionState, onboardingCompleted: boolean, launchDestination: string) {
  if (!account.user) return onboardingCompleted ? '/auth/sign-in' as const : null;
  if (account.recoveryRequired) return '/account' as const;
  if (!onboardingCompleted) return '/onboarding' as const;
  if (launchDestination === 'instagram' || launchDestination === 'youtube' || launchDestination === 'tiktok') {
    return { pathname: '/browser/[appId]' as const, params: { appId: launchDestination } };
  }
  return '/(tabs)' as const;
}
