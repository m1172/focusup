import type { SocialAppId } from '../../types/app';
import { supportedAppIds, useAppStore } from '../../store/appStore';
import { isScheduleActive } from '../schedules/time';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { isRemoteFeatureEnabled } from '../../store/remoteBlockerConfigStore';
import { canUseFeature, type SubscriptionFeature } from '../subscription/subscriptionService';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { sleepRoutine } from '../protection/engine';
import { currentSupervisionRules } from '../../store/familyStore';
import { activeDowntime, familyForcedFilters, isBrowserApp } from '../family/resolver';

const filterFeature: Partial<Record<SocialAppId, Record<string, SubscriptionFeature>>> = {
  instagram: { reels: 'instagramReels', explore: 'instagramExplore', recommendations: 'instagramRecommendations', suggestedPosts: 'instagramSuggestedPosts', homeFeed: 'instagramHomeFeed', sponsoredPosts: 'instagramSponsored', stories: 'instagramStories', messagesOnly: 'focusedMessages' },
  youtube: { shorts: 'youtubeShorts', homeRecommendations: 'youtubeHomeRecommendations', recommendations: 'youtubeRelatedRecommendations', explore: 'youtubeExplore', comments: 'youtubeComments' },
  tiktok: { forYou: 'tiktokForYou', following: 'tiktokFollowing', explore: 'tiktokExplore' },
};

const SHORT_VIDEO: Partial<Record<SocialAppId, string>> = { instagram: 'reels', youtube: 'shorts', tiktok: 'forYou' };

/**
 * `enabled` is clean mode (the app is added to Vaqtim); `blocking` says whether blockers run at all.
 * The short-video feed is blocked even for apps that are not added, and free users cannot turn it off.
 */
/**
 * Whether a filter can be changed by the user right now. Pro-only filters can't while Pro is off, and the
 * short-video feed (Reels, Shorts, For You) is always blocked unless Pro's "turn it off" is available.
 */
export function isFilterAdjustable(appId: SocialAppId, key: string, isPro: boolean): boolean {
  if (SHORT_VIDEO[appId] === key) return canUseFeature(isPro, 'shortVideoControl');
  const access = filterFeature[appId]?.[key];
  return !access || canUseFeature(isPro, access);
}

export function getEffectiveAppConfig(appId: SocialAppId, now = new Date()) {
  const state = useAppStore.getState();
  const base = state.apps[appId] ?? { enabled: false, filters: {} };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay();
  const isPro = useSubscriptionStore.getState().isPro;
  const routines = [...(canUseFeature(isPro, 'schedules') ? state.schedules : []), ...(canUseFeature(isPro, 'sleepMode') ? [sleepRoutine(useWellbeingStore.getState().sleep)] : [])];
  const scheduledRoutines = routines.filter((schedule) => {
    if (!schedule.enabled || !schedule.apps.includes(appId) || schedule.allowedApps?.includes(appId)) return false;
    return isScheduleActive(schedule, weekday, minutes);
  });
  const scheduled = scheduledRoutines.length > 0;
  const strict = canUseFeature(isPro, 'strictMode') && state.strictSession && state.strictSession.endsAt > Date.now() && (state.strictSession.protectedPlatforms ?? state.strictSession.appIds).includes(appId) ? state.strictSession : null;
  const enabled = base.enabled || scheduled || Boolean(strict);
  const short = SHORT_VIDEO[appId];
  // An app that is not added keeps only the short-video block, not the other filters saved for it.
  const filters: Record<string, boolean> = enabled ? { ...base.filters } : short ? { [short]: true } : {};
  for (const routine of scheduledRoutines) {
    const specific = routine.filters?.[appId];
    // A routine turns the saved filters on, but not the modes that change what the page shows (Home posts, messages only).
    if (specific) Object.assign(filters, specific); else Object.keys(base.filters).forEach((key) => { if (key !== 'homeFeed' && key !== 'messagesOnly') filters[key] = true; });
  }
  const strictFilters = strict?.filters[appId];
  if (strictFilters) Object.entries(strictFilters).forEach(([key, value]) => { if (value) filters[key] = true; });
  if (strict && appId === 'instagram') filters.reels = true;
  if (strict && appId === 'youtube') filters.shorts = true;
  if (strict && appId === 'tiktok') filters.forYou = true;
  if (appId === 'instagram' || appId === 'youtube' || appId === 'tiktok') {
    Object.keys(filters).forEach((feature) => {
      if (!isRemoteFeatureEnabled(appId, feature)) filters[feature] = false;
      const access = filterFeature[appId]?.[feature];
      if (access && !canUseFeature(isPro, access)) filters[feature] = false;
    });
  }
  // The short-video feed stays blocked whatever the saved settings, a restored backup or remote rules say.
  if (short && (!enabled || !canUseFeature(isPro, 'shortVideoControl'))) filters[short] = true;
  // Vaqtim Family: the parent's filters apply last and are free; a remotely paused blocker cannot lift them here
  // (the browser closes instead, see familyBrowserAccess).
  const rules = currentSupervisionRules();
  if (rules) Object.assign(filters, familyForcedFilters(appId, rules));
  const familyClean = Boolean(rules && isBrowserApp(appId) && rules.policy.browsers[appId]?.enabled && !activeDowntime(rules, appId, now));
  return { enabled: enabled || familyClean, blocking: enabled || familyClean || Object.values(filters).some(Boolean), filters };
}

export function getActiveScheduleAppIds(now = new Date()): SocialAppId[] {
  return supportedAppIds.filter((appId) => {
    const config = getEffectiveAppConfig(appId, now);
    return config.enabled;
  });
}
