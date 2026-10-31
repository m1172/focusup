import type { TikTokBlockerConfig } from '../../../types/social';

export const TIKTOK_HOSTS = ['tiktok.com'];

/** The For You feed: the site root, /foryou and the live feed. A single shared video (/@name/video/<id>) stays allowed. */
export const tiktokForYouPathPattern = /^\/(?:foryou(?:\/.*)?|live(?:\/.*)?|[a-z]{2}(?:-[a-z]{2})?\/?)?$/i;
export const tiktokFollowingPathPattern = /^\/(?:following|friends)(?:\/|$)/i;
export const tiktokExplorePathPattern = /^\/(?:explore|discover)(?:\/|$)/i;

export function isTikTokHost(hostname: string): boolean {
  return TIKTOK_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/** Which TikTok feed a URL opens, if it is one Clean Mode can block. */
export function tiktokFeedFeature(url: string): keyof TikTokBlockerConfig | null {
  try {
    const parsed = new URL(url, 'https://www.tiktok.com');
    if (!isTikTokHost(parsed.hostname)) return null;
    if (tiktokForYouPathPattern.test(parsed.pathname)) return 'forYou';
    if (tiktokFollowingPathPattern.test(parsed.pathname)) return 'following';
    if (tiktokExplorePathPattern.test(parsed.pathname)) return 'explore';
    return null;
  } catch { return null; }
}

export function isTikTokVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://www.tiktok.com');
    return isTikTokHost(parsed.hostname) && /^\/@[^/]+\/video\/\d+/.test(parsed.pathname);
  } catch { return false; }
}
