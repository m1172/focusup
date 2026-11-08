import type { SessionState } from './sessionManager';
import type { FamilyRole } from '../../store/familyStore';

/** A supervised child's phone (Vaqtim Family) enters without a personal account and skips onboarding. */
export function canEnterApp(account: SessionState, onboardingCompleted: boolean, hydrated: boolean, backendConfigured: boolean, familyRole: FamilyRole = 'none'): boolean {
  if (hydrated && account.ready && familyRole === 'child') return true;
  return hydrated && backendConfigured && account.ready && Boolean(account.user) && !account.recoveryRequired && onboardingCompleted && familyRole === 'none';
}

/** One destination policy for cold starts, successful authentication, and denied links. */
export function entryDestination(account: SessionState, onboardingCompleted: boolean, launchDestination: string, familyRole: FamilyRole = 'none') {
  if (familyRole === 'child') return '/(tabs)' as const;
  if (familyRole === 'pending') return '/family/connect' as const;
  if (!account.user) return onboardingCompleted ? '/auth/sign-in' as const : null;
  if (account.recoveryRequired) return '/account' as const;
  if (!onboardingCompleted) return '/onboarding' as const;
  if (launchDestination === 'instagram' || launchDestination === 'youtube' || launchDestination === 'tiktok') {
    return { pathname: '/browser/[appId]' as const, params: { appId: launchDestination } };
  }
  return '/(tabs)' as const;
}
