import { useEffect, useState } from 'react';
import { getLocalAnalytics } from '../../services/analytics/localAnalytics';
import { getDailyStatistics } from '../../services/analytics/statisticsCalculator';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { getUnsavedActiveMs } from '../../services/analytics/sessionTracker';
import { startOfLocalDay } from '../../utils/date';
import type { SocialAppId } from '../../types/app';

/** Today's foreground time in Vaqtim's clean browser for one app, including the session that is still open. */
export async function msUsedToday(appId: SocialAppId, now = new Date()): Promise<number> {
  const storage = await getLocalAnalytics();
  const entry = getDailyStatistics(storage.daily, now).platforms.find((item) => item.platform === appId);
  return (entry?.durationMs ?? 0) + getUnsavedActiveMs(appId, startOfLocalDay(now).getTime(), now.getTime());
}

/** Today's measured minutes in Vaqtim's clean browser for one app. */
export async function minutesUsedToday(appId: SocialAppId, now = new Date()): Promise<number> {
  return Math.floor(await msUsedToday(appId, now) / 60_000);
}

/** How often an open browser rechecks its limit. */
export const LIMIT_CHECK_MS = 5_000;

export const DAILY_LIMIT_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** Whether this app's daily limit is used up in the clean browser. Rechecked every few seconds while open. */
export function useDailyLimitReached(appId: SocialAppId, extraLimitMinutes?: number | null): boolean {
  const personal = useWellbeingStore((state) => state.dailyLimits[appId]);
  // A parent's limit and the personal one both apply; the smaller one wins.
  const limit = [personal, extraLimitMinutes].filter((value): value is number => typeof value === 'number' && value > 0).reduce<number | undefined>((low, value) => low === undefined ? value : Math.min(low, value), undefined);
  const allowed = useSubscriptionStore((state) => canUseFeature(state.isPro, 'dailyLimits'));
  const onBreak = useWellbeingStore((state) => Boolean(state.temporary && state.temporary.platform === appId && state.temporary.endsAt > Date.now()));
  const supervisedLimit = typeof extraLimitMinutes === 'number' && extraLimitMinutes > 0;
  const [usedMs, setUsedMs] = useState(0);
  useEffect(() => {
    if (!limit || !(allowed || supervisedLimit)) return undefined;
    let active = true;
    const check = () => { void msUsedToday(appId).then((ms) => { if (active) setUsedMs(ms); }).catch(() => undefined); };
    check();
    const timer = setInterval(check, LIMIT_CHECK_MS);
    return () => { active = false; clearInterval(timer); };
  }, [appId, limit, allowed, supervisedLimit]);
  // Breaks never lift a parent's limit.
  return Boolean(limit && (allowed || supervisedLimit) && usedMs >= limit * 60_000) && (supervisedLimit || !onBreak);
}
