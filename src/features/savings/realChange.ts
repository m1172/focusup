import type { AnalyticsStorage } from '../../services/analytics/types';
import type { MeasuredUsage } from '../../services/device-usage/androidUsage';
import { addLocalDays, getLocalDateKey } from '../../utils/date';
import { ONBOARDING_APPS, type OnboardingAppId } from '../onboarding/dayBudget';

/**
 * Measured, not modelled: Android's own per-app minutes now, plus minutes in FocusUp's clean apps,
 * against the per-app minutes Android measured before install (onboarding). It catches users who
 * simply move back to the native Instagram, YouTube or TikTok apps, which `savings.ts` cannot see.
 */
export type UsageSnapshot = {
  at: number;
  dateKey: string;
  /** Days the native average covers (Android may hold fewer than requested). */
  days: number;
  nativeMinutes: Record<OnboardingAppId, number>;
  /** FocusUp clean-mode minutes a day over the same days. */
  focusUpMinutes: number;
};

export type RealChange = {
  baselineMinutes: number;
  nativeMinutes: number;
  focusUpMinutes: number;
  currentMinutes: number;
  /** Baseline minus now, minutes a day. Negative when the user spends more than before. */
  savedMinutes: number;
  /** savedMinutes as a share of the baseline, or null without a baseline to compare against. */
  savedShare: number | null;
};

const WEEK_MS = 7 * 24 * 60 * 60_000;

export function nativeTotal(minutes: Partial<Record<OnboardingAppId, number>>): number {
  return ONBOARDING_APPS.reduce((sum, id) => sum + Math.max(0, minutes[id] ?? 0), 0);
}

/** Average clean-mode minutes a day over the `days` local days ending today. */
export function focusUpMinutesPerDay(daily: AnalyticsStorage['daily'], days: number, now: Date): number {
  const span = Math.max(1, Math.round(days));
  let totalMs = 0;
  for (let offset = 0; offset < span; offset += 1) totalMs += daily[getLocalDateKey(addLocalDays(now, -offset))]?.cleanModeDurationMs ?? 0;
  return totalMs / 60_000 / span;
}

/** Native + FocusUp minutes a day now versus the pre-install measurement. Null when either is missing. */
export function realChange(baseline: MeasuredUsage | null, snapshot: Pick<UsageSnapshot, 'nativeMinutes' | 'focusUpMinutes'> | null): RealChange | null {
  if (!baseline || !snapshot) return null;
  const baselineMinutes = nativeTotal(baseline.minutes);
  const nativeMinutes = nativeTotal(snapshot.nativeMinutes);
  const focusUpMinutes = Math.max(0, snapshot.focusUpMinutes);
  const currentMinutes = nativeMinutes + focusUpMinutes;
  const savedMinutes = baselineMinutes - currentMinutes;
  return { baselineMinutes, nativeMinutes, focusUpMinutes, currentMinutes, savedMinutes, savedShare: baselineMinutes > 0 ? savedMinutes / baselineMinutes : null };
}

/** Whole weeks since install: 0 during the first seven days. */
export function weekSinceInstall(installedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - installedAt) / WEEK_MS));
}

/** Analytics never carries exact minutes. */
export function roundToFive(minutes: number): number {
  return Math.round(minutes / 5) * 5 || 0;
}
