import { appendAnalyticsEvent, cleanupOldAnalyticsEvents, getAnalyticsStorage } from './eventStore';
import type { BlockedNavigationDestination, FocusUpAnalyticsEvent, PaywallSource, SavedTimeEstimate, SocialPlatform } from './types';
import { useStatisticsStore } from '../../store/statisticsStore';
import { BLOCKED_ATTEMPT_DEDUP_WINDOW_MS } from './constants';

export async function track(event: FocusUpAnalyticsEvent): Promise<boolean> {
  try {
    await appendAnalyticsEvent(event);
    useStatisticsStore.getState().notifyChanged();
    return true;
  } catch { if (__DEV__) console.warn(`[analytics] local persistence failed for ${event.type}`); }
  return false;
}

const recentBlockedAttempts = new Map<string, number>();

export async function trackBlockedNavigation(platform: SocialPlatform, destination: BlockedNavigationDestination, timestamp = Date.now()): Promise<boolean> {
  const key = `${platform}:${destination}`;
  const previous = recentBlockedAttempts.get(key);
  if (previous !== undefined && timestamp >= previous && timestamp - previous < BLOCKED_ATTEMPT_DEDUP_WINDOW_MS) return false;
  recentBlockedAttempts.set(key, timestamp);
  for (const [recentKey, at] of recentBlockedAttempts) if (timestamp - at > BLOCKED_ATTEMPT_DEDUP_WINDOW_MS) recentBlockedAttempts.delete(recentKey);
  return track({ type: 'BLOCKED_NAVIGATION', platform, destination, timestamp });
}

export async function trackSubscriptionEvent(event: Extract<FocusUpAnalyticsEvent, { type: 'SUBSCRIPTION_EVENT' }>['event'], planId?: 'monthly' | 'annual', source?: PaywallSource): Promise<void> {
  await track({ type: 'SUBSCRIPTION_EVENT', event, planId, source, timestamp: Date.now() });
}

export async function getLocalAnalytics() { return getAnalyticsStorage(); }
export async function initializeLocalAnalytics() {
  try { await cleanupOldAnalyticsEvents(); } catch { /* Statistics remain an optional local feature if storage is unavailable. */ }
}
export function getSavedTimeEstimate(): SavedTimeEstimate { return null; }
export function resetBlockedAttemptDedup() { recentBlockedAttempts.clear(); }

export const resetBlockedAttemptDedupForTests = resetBlockedAttemptDedup;
