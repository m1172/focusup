import type { InstagramBlockedPage } from '../../../types/social';

export const instagramAuthenticationRoutePattern = String.raw`^/(?:accounts/(?:login|signup|password/reset|onetap|one_tap|two_factor_authentication|confirm_email)|challenge|checkpoint)(?:/|$)`;
/** Restrict the Reels feed landing page. Individual video links and account grids stay accessible. */
export const instagramReelsFeedRoutePattern = String.raw`^/(?:reels|explore/reels)/?$`;

export const instagramStoriesRoutePattern = String.raw`^/stories/`;
/** Messages-only mode: Home and the Explore grid (Search under /explore/search stays open). */
export const instagramHomeRoutePattern = String.raw`^/$`;
export const instagramExploreGridRoutePattern = String.raw`^/explore(?:/(?!search(?:/|$))[^?#]*)?/?$`;
export const INSTAGRAM_INBOX_URL = 'https://www.instagram.com/direct/inbox/';

type PageRules = { reels?: boolean; stories?: boolean; messagesOnly?: boolean };

/** Which blocked page a link leads to, or null. Sign-in pages are never blocked. */
export function instagramBlockedPage(url: string, config: PageRules): InstagramBlockedPage | null {
  try {
    const parsed = new URL(url, 'https://www.instagram.com');
    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) return null;
    const path = parsed.pathname;
    if ((config.reels || config.messagesOnly) && new RegExp(instagramReelsFeedRoutePattern, 'i').test(path)) return 'reels';
    if ((config.stories || config.messagesOnly) && new RegExp(instagramStoriesRoutePattern, 'i').test(path)) return 'stories';
    if (config.messagesOnly && new RegExp(instagramHomeRoutePattern).test(path)) return 'homeFeed';
    if (config.messagesOnly && new RegExp(instagramExploreGridRoutePattern, 'i').test(path)) return 'explore';
    return null;
  } catch { return null; }
}

export function isBlockedInstagramNavigation(url: string, config: PageRules): boolean {
  return instagramBlockedPage(url, config) !== null;
}

/** Where Instagram opens, and where a blocked page sends the user back to. */
export function instagramStartUrl(config: PageRules): string {
  return config.messagesOnly ? INSTAGRAM_INBOX_URL : 'https://www.instagram.com/';
}

export function isInstagramAuthenticationUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://www.instagram.com');
    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) return false;
    return new RegExp(instagramAuthenticationRoutePattern, 'i').test(parsed.pathname);
  } catch {
    return false;
  }
}
