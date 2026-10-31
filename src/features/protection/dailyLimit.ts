import { useEffect, useState } from 'react';
import { getLocalAnalytics } from '../../services/analytics/localAnalytics';
import { getDailyStatistics } from '../../services/analytics/statisticsCalculator';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import type { SocialAppId } from '../../types/app';

/** Today's measured minutes in Vaqtim's clean browser for one app. */
export async function minutesUsedToday(appId: SocialAppId, now = new Date()): Promise<number> {
  const storage = await getLocalAnalytics();
  const entry = getDailyStatistics(storage.daily, now).platforms.find((item) => item.platform === appId);
  return Math.floor((entry?.durationMs ?? 0) / 60_000);
}

export const DAILY_LIMIT_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** Whether this app's daily limit (Pro) is used up in the clean browser. Rechecked every minute while open. */
export function useDailyLimitReached(appId: SocialAppId): boolean {
  const limit = useWellbeingStore((state) => state.dailyLimits[appId]);
  const allowed = useSubscriptionStore((state) => canUseFeature(state.isPro, 'dailyLimits'));
  const onBreak = useWellbeingStore((state) => Boolean(state.temporary && state.temporary.platform === appId && state.temporary.endsAt > Date.now()));
  const [used, setUsed] = useState(0);
  useEffect(() => {
    if (!limit || !allowed) return undefined;
    let active = true;
    const check = () => { void minutesUsedToday(appId).then((minutes) => { if (active) setUsed(minutes); }).catch(() => undefined); };
    check();
    const timer = setInterval(check, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [appId, limit, allowed]);
  return Boolean(limit && allowed && used >= limit) && !onBreak;
}
