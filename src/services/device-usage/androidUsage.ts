import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { ONBOARDING_APPS, type OnboardingAppId } from '../../features/onboarding/lifeProjection';

type UsageModule = {
  hasUsageAccess?: () => Promise<boolean>;
  openUsageAccessSettings?: () => Promise<void>;
  getAppUsage?: (days: number) => Promise<{ granted: boolean; days: number; minutes: Record<string, number> }>;
};

const module = Platform.OS === 'android' ? requireOptionalNativeModule<UsageModule>('FocusUpProtection') : null;

export type MeasuredUsage = { days: number; minutes: Record<OnboardingAppId, number> };

/**
 * Real per-app screen time on Android (Settings → Usage access). iOS never exposes usage numbers
 * to apps, so there the onboarding asks one question instead.
 */
export const androidUsage = {
  /** True when this build can read usage (Android + native module present). */
  supported: Boolean(module?.getAppUsage && module.hasUsageAccess && module.openUsageAccessSettings),
  async hasAccess() { try { return (await module?.hasUsageAccess?.()) ?? false; } catch { return false; } },
  async openSettings() { try { await module?.openUsageAccessSettings?.(); } catch { /* the Settings screen is missing on a few OEM builds */ } },
  /** Daily average minutes per app over the last `days` days, rounded to whole minutes. */
  async read(days = 7): Promise<MeasuredUsage | null> {
    try {
      const result = await module?.getAppUsage?.(days);
      if (!result?.granted) return null;
      const minutes = Object.fromEntries(ONBOARDING_APPS.map((id) => [id, Math.round(Math.max(0, result.minutes[id] ?? 0))])) as Record<OnboardingAppId, number>;
      return { days: result.days, minutes };
    } catch { return null; }
  },
};
