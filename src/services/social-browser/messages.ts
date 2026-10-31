import type { SocialAppId } from '../../types/app';
import { isCleanPlatform, type SocialBrowserRoute, type SocialWebViewEvent } from '../../types/social';

const routes = new Set<SocialBrowserRoute>(['feed', 'search', 'watch', 'subscriptions', 'channel', 'playlist', 'reels', 'shorts', 'profile', 'other']);
const instagramFeatures = new Set(['reels', 'explore', 'suggestedPosts', 'recommendations', 'sponsoredPosts', 'homeFeed']);
const youtubeFeatures = new Set(['shorts', 'homeRecommendations', 'recommendations', 'comments', 'sponsoredContent']);
const tiktokFeatures = new Set(['forYou', 'following', 'explore']);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function parseSocialWebViewEvent(raw: string, expectedPlatform: SocialAppId): SocialWebViewEvent | null {
  if (!isCleanPlatform(expectedPlatform)) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.platform !== expectedPlatform || typeof value.type !== 'string') return null;

    if (value.type === 'PAGE_APPEARANCE' && hasOnlyKeys(value, ['type', 'platform', 'backgroundColor', 'isStory']) && typeof value.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.backgroundColor) && typeof value.isStory === 'boolean' && (expectedPlatform === 'instagram' || !value.isStory)) {
      return { type: 'PAGE_APPEARANCE', platform: expectedPlatform, backgroundColor: value.backgroundColor, isStory: value.isStory };
    }

    if (value.type === 'READY' && hasOnlyKeys(value, ['type', 'platform', 'observerActive']) && typeof value.observerActive === 'boolean') {
      return { type: 'READY', platform: expectedPlatform, observerActive: value.observerActive };
    }
    if (value.type === 'URL_CHANGED' && hasOnlyKeys(value, ['type', 'platform', 'route']) && typeof value.route === 'string' && routes.has(value.route as SocialBrowserRoute)) {
      return { type: 'URL_CHANGED', platform: expectedPlatform, route: value.route as SocialBrowserRoute };
    }
    if (value.type === 'CONTENT_DETECTED' && expectedPlatform === 'instagram' && hasOnlyKeys(value, ['type', 'platform', 'feature', 'count'])
      && (value.feature === 'sponsoredPosts' || value.feature === 'suggestedPosts') && Number.isSafeInteger(value.count) && (value.count as number) > 0 && (value.count as number) <= 1000) {
      return { type: 'CONTENT_DETECTED', platform: 'instagram', feature: value.feature, count: value.count as number };
    }
    if (value.type === 'FILTER_APPLIED' && hasOnlyKeys(value, ['type', 'platform', 'feature', 'count']) && typeof value.feature === 'string' && Number.isSafeInteger(value.count) && (value.count as number) >= 0) {
      const allowedFeatures = expectedPlatform === 'instagram' ? instagramFeatures : expectedPlatform === 'tiktok' ? tiktokFeatures : youtubeFeatures;
      if (!allowedFeatures.has(value.feature)) return null;
      if (expectedPlatform === 'tiktok') return { type: 'FILTER_APPLIED', platform: 'tiktok', feature: value.feature as 'forYou' | 'following' | 'explore', count: value.count as number };
      if (expectedPlatform === 'instagram') return { type: 'FILTER_APPLIED', platform: expectedPlatform, feature: value.feature as 'reels' | 'explore' | 'suggestedPosts' | 'recommendations' | 'sponsoredPosts', count: value.count as number };
      return { type: 'FILTER_APPLIED', platform: expectedPlatform, feature: value.feature as 'shorts' | 'homeRecommendations' | 'recommendations' | 'comments' | 'sponsoredContent', count: value.count as number };
    }
    if (value.type === 'BLOCKED_NAVIGATION' && hasOnlyKeys(value, ['type', 'platform', 'feature'])) {
      if (expectedPlatform === 'instagram' && value.feature === 'reels') return { type: 'BLOCKED_NAVIGATION', platform: expectedPlatform, feature: 'reels' };
      if (expectedPlatform === 'youtube' && value.feature === 'shorts') return { type: 'BLOCKED_NAVIGATION', platform: expectedPlatform, feature: 'shorts' };
      if (expectedPlatform === 'tiktok' && typeof value.feature === 'string' && tiktokFeatures.has(value.feature)) return { type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: value.feature as 'forYou' | 'following' | 'explore' };
      return null;
    }
    if (value.type === 'ERROR' && hasOnlyKeys(value, ['type', 'platform', 'scope']) && typeof value.scope === 'string' && /^(?:filter|script):[a-zA-Z]+$/.test(value.scope)) {
      return { type: 'ERROR', platform: expectedPlatform, scope: value.scope };
    }
  } catch {
    return null;
  }
  return null;
}
