import { FAMILY_ENABLED } from '../../config/release';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useFamilyStore } from '../../store/familyStore';
import { initializeProductAnalytics, setAnalyticsRoleGate, shutDownProductAnalytics, type AnalyticsRole } from '../analytics/productAnalytics';

/**
 * Whether this phone may send product analytics. A supervised or pairing phone never does. When this build offers
 * the child path, a fresh install waits until someone picks the personal path (Start, Sign in) or signs in.
 */
export function familyAnalyticsRole(): AnalyticsRole {
  if (!useFamilyStore.persist.hasHydrated()) return 'unknown';
  const family = useFamilyStore.getState();
  if (family.role !== 'none') return 'supervised';
  if (!FAMILY_ENABLED) return 'personal';
  if (useAccountStore.getState().user || useAppStore.getState().onboardingCompleted || family.personalChosen) return 'personal';
  return 'unknown';
}

/** Installs the gate and starts or stops analytics as the role becomes known. Returns a cleanup function. */
export function startFamilyAnalyticsGate(): () => void {
  setAnalyticsRoleGate(familyAnalyticsRole);
  let last: AnalyticsRole | null = null;
  const apply = () => {
    const role = familyAnalyticsRole();
    if (role === last) return;
    last = role;
    if (role === 'supervised') void shutDownProductAnalytics();
    if (role === 'personal') void initializeProductAnalytics();
  };
  const stops = [
    useFamilyStore.persist.onFinishHydration(apply),
    useFamilyStore.subscribe(apply),
    useAccountStore.subscribe(apply),
    useAppStore.subscribe(apply),
  ];
  apply();
  return () => stops.forEach((stop) => stop());
}
