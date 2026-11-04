import type { SocialAppId } from '../../types/app';
import { supportedAppIds, useAppStore } from '../../store/appStore';
import { isScheduleActive } from '../schedules/time';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { isRemoteFeatureEnabled } from '../../store/remoteBlockerConfigStore';
import { canUseFeature, type SubscriptionFeature } from '../subscription/subscriptionService';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { sleepRoutine } from '../protection/engine';

const filterFeature: Partial<Record<SocialAppId, Record<string, SubscriptionFeature>>> = {
  instagram: { reels: 'instagramReels', explore: 'instagramExplore', recommendations: 'instagramRecommendations', suggestedPosts: 'instagramSuggestedPosts', homeFeed: 'instagramHomeFeed', sponsoredPosts: 'instagramCleanBrowsing' },
  youtube: { shorts: 'youtubeShorts', homeRecommendations: 'youtubeHomeRecommendations', recommendations: 'youtubeRelatedRecommendations', comments: 'youtubeComments' },
  tiktok: { forYou: 'tiktokForYou', following: 'tiktokFollowing', explore: 'tiktokExplore' },
};

const SHORT_VIDEO: Partial<Record<SocialAppId, string>> = { instagram: 'reels', youtube: 'shorts', tiktok: 'forYou' };

/**
 * `enabled` is clean mode (the app is added to Vaqtim); `blocking` says whether blockers run at all.
 * The short-video feed is blocked even for apps that are not added, and free users cannot turn it off.
 */
export function getEffectiveAppConfig(appId: SocialAppId, now = new Date()) {
  const state = useAppStore.getState();
  const base = state.apps[appId] ?? { enabled: false, filters: {} };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay();
  const isPro = useSubscriptionStore.getState().isPro;
  const routines = [...state.schedules, sleepRoutine(useWellbeingStore.getState().sleep)];
  const scheduledRoutines = canUseFeature(isPro, 'schedules') ? routines.filter((schedule) => {
    if (!schedule.enabled || !schedule.apps.includes(appId) || schedule.allowedApps?.includes(appId)) return false;
    return isScheduleActive(schedule, weekday, minutes);
  }) : [];
  const scheduled = scheduledRoutines.length > 0;
  const strict = canUseFeature(isPro, 'strictMode') && state.strictSession && state.strictSession.endsAt > Date.now() && (state.strictSession.protectedPlatforms ?? state.strictSession.appIds).includes(appId) ? state.strictSession : null;
  const enabled = base.enabled || scheduled || Boolean(strict);
  const short = SHORT_VIDEO[appId];
  // An app that is not added keeps only the short-video block, not the other filters saved for it.
  const filters: Record<string, boolean> = enabled ? { ...base.filters } : short ? { [short]: true } : {};
  for (const routine of scheduledRoutines) {
    const specific = routine.filters?.[appId];
    if (specific) Object.assign(filters, specific); else Object.keys(base.filters).forEach((key) => { if (key !== 'homeFeed') filters[key] = true; });
  }
  const strictFilters = strict?.filters[appId];
  if (strictFilters) Object.entries(strictFilters).forEach(([key, value]) => { if (value) filters[key] = true; });
  if (strict && appId === 'instagram') filters.reels = true;
  if (strict && appId === 'youtube') filters.shorts = true;
  if (strict && appId === 'tiktok') filters.forYou = true;
  if (short && (!enabled || !canUseFeature(isPro, 'shortVideoControl'))) filters[short] = true;
  if (appId === 'instagram' || appId === 'youtube' || appId === 'tiktok') {
    Object.keys(filters).forEach((feature) => {
      if (!isRemoteFeatureEnabled(appId, feature)) filters[feature] = false;
      const access = filterFeature[appId]?.[feature];
      if (access && !canUseFeature(isPro, access)) filters[feature] = false;
    });
  }
  return { enabled, blocking: enabled || Object.values(filters).some(Boolean), filters };
}

export function getActiveScheduleAppIds(now = new Date()): SocialAppId[] {
  return supportedAppIds.filter((appId) => {
    const config = getEffectiveAppConfig(appId, now);
    return config.enabled;
  });
}
