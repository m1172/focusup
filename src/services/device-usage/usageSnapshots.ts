import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { focusUpMinutesPerDay, nativeTotal, realChange, roundToFive, weekSinceInstall, type RealChange, type UsageSnapshot } from '../../features/savings/realChange';
import { useAppStore } from '../../store/appStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { getLocalDateKey } from '../../utils/date';
import { getAnalyticsStorage } from '../analytics/eventStore';
import { captureProductEvent } from '../analytics/productAnalytics';
import { isClearingFocusUpData } from '../privacy/clearFocusUpData';
import { androidUsage } from './androidUsage';

/**
 * Android only, with Usage access: once a day on app activation, re-read the native short-video
 * minutes and add FocusUp's clean-mode minutes for the same days. The history stays on the device;
 * once per week since install an anonymous, rounded summary goes to PostHog (when consented).
 */
export const USAGE_HISTORY_KEY = 'focusup-usage-history-v1';
const WINDOW_DAYS = 7;
const MAX_SNAPSHOTS = 120;

export type UsageHistory = {
  /** First time a snapshot was attempted; the install date for baselines saved before `measuredAt` existed. */
  firstSeenAt: number;
  snapshots: UsageSnapshot[];
  lastWeeklyEventWeek: number | null;
};

function isHistory(value: unknown): value is UsageHistory {
  const history = value as UsageHistory | null;
  return Boolean(history) && typeof history!.firstSeenAt === 'number' && Array.isArray(history!.snapshots)
    && (history!.lastWeeklyEventWeek === null || typeof history!.lastWeeklyEventWeek === 'number');
}

export async function loadUsageHistory(): Promise<UsageHistory | null> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isHistory(parsed) ? parsed : null;
  } catch { return null; }
}

/** The latest measured change against the onboarding baseline, for a screen to show. Null without both. */
export async function loadLatestRealChange(): Promise<RealChange | null> {
  const history = await loadUsageHistory();
  return realChange(useOnboardingStore.getState().measured, history?.snapshots.at(-1) ?? null);
}

function weeklyProperties(snapshot: UsageSnapshot, week: number, installKnown: boolean) {
  const onboarding = useOnboardingStore.getState();
  const native = nativeTotal(snapshot.nativeMinutes);
  const current = native + snapshot.focusUpMinutes;
  const baseline = onboarding.measured ? nativeTotal(onboarding.measured.minutes) : totalMinutes(onboarding);
  return {
    week_since_install: week,
    install_date_source: installKnown ? 'baseline' : 'first_snapshot',
    baseline_source: onboarding.measured ? 'measured' : 'estimate',
    baseline_minutes: roundToFive(baseline),
    current_total_minutes: roundToFive(current),
    native_minutes: roundToFive(native),
    focusup_minutes: roundToFive(snapshot.focusUpMinutes),
    saved_minutes: roundToFive(baseline - current),
    days_measured: snapshot.days,
  };
}

async function snapshotOnce(now: Date) {
  if (Platform.OS !== 'android' || !androidUsage.supported || isClearingFocusUpData()) return;
  if (!useAppStore.persist.hasHydrated() || !useOnboardingStore.persist.hasHydrated() || !useAppStore.getState().onboardingCompleted) return;
  if (!(await androidUsage.hasAccess())) return;
  const history = (await loadUsageHistory()) ?? { firstSeenAt: now.getTime(), snapshots: [], lastWeeklyEventWeek: null };
  let changed = false;
  const today = getLocalDateKey(now);
  if (history.snapshots.at(-1)?.dateKey !== today) {
    const usage = await androidUsage.read(WINDOW_DAYS);
    if (!usage) return;
    const days = Math.max(1, usage.days);
    const { daily } = await getAnalyticsStorage();
    history.snapshots = [...history.snapshots, { at: now.getTime(), dateKey: today, days, nativeMinutes: usage.minutes, focusUpMinutes: focusUpMinutesPerDay(daily, days, now) }].slice(-MAX_SNAPSHOTS);
    changed = true;
  }
  const latest = history.snapshots.at(-1);
  const { measuredAt } = useOnboardingStore.getState();
  const week = weekSinceInstall(measuredAt ?? history.firstSeenAt, now.getTime());
  if (latest?.dateKey === today && (history.lastWeeklyEventWeek === null || week > history.lastWeeklyEventWeek)
    && captureProductEvent('usage_weekly', weeklyProperties(latest, week, measuredAt !== null))) {
    history.lastWeeklyEventWeek = week;
    changed = true;
  }
  // A clear that started meanwhile must not get this history written back.
  if (changed && !isClearingFocusUpData()) await AsyncStorage.setItem(USAGE_HISTORY_KEY, JSON.stringify(history));
}

let running: Promise<void> | null = null;
/** Safe to call on every activation: it reads Android usage at most once a day. */
export function takeUsageSnapshot(now = new Date()): Promise<void> {
  running ??= snapshotOnce(now).catch(() => { /* Usage history is optional; a failed read retries on the next activation. */ }).finally(() => { running = null; });
  return running;
}
