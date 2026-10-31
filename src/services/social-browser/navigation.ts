import type { SocialBrowserRoute } from '../../types/social';
import type { SocialAppId } from '../../types/app';
import { isCleanPlatform } from '../../types/social';

export const socialBrowserHome = {
  instagram: 'https://www.instagram.com/',
  youtube: 'https://m.youtube.com/',
  tiktok: 'https://www.tiktok.com/inbox',
} as const;

/** Each clean platform's own website hosts; subdomains are included. */
export const socialBrowserHosts = {
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
} as const;

/** Accept only secure links for the selected website, including pasted links without a scheme. */
export function normalizeSocialBrowserLink(platform: SocialAppId, input: string): string | null {
  if (!isCleanPlatform(platform)) return null;
  const value = input.trim();
  if (!value || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const domains: readonly string[] = socialBrowserHosts[platform];
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    return url.href;
  } catch { return null; }
}

/** Embedded frames belong to the current page and must never launch an external browser. */
export function classifySocialBrowserNavigation(platform: SocialAppId, value: string, isTopFrame = true): 'internal' | 'external' | 'reject' {
  try {
    const url = new URL(value);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return 'reject';
    if (!isTopFrame) return url.protocol === 'https:' ? 'internal' : 'reject';
    const hosts: readonly string[] = isCleanPlatform(platform) ? socialBrowserHosts[platform] : [];
    if (hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url.protocol === 'https:' ? 'internal' : 'reject';
    if (platform === 'instagram' && isInstagramMetaAuthRedirect(value)) return 'internal';
    if (platform === 'youtube' && isYouTubeGoogleAuthUrl(value)) return 'internal';
    if (platform === 'tiktok' && isTikTokThirdPartyAuthUrl(value)) return 'internal';
    if (isAppHandoffUrl(value)) return 'reject';
    return 'external';
  } catch { return 'reject'; }
}

/** Returns a coarse route label only; never persists usernames, search terms, IDs, or query strings. */
export function getSocialBrowserRoute(platform: SocialAppId, url: string): SocialBrowserRoute {
  try {
    const parsed = new URL(url, platform === 'youtube' ? 'https://m.youtube.com' : platform === 'tiktok' ? 'https://www.tiktok.com' : 'https://www.instagram.com');
    const path = parsed.pathname.toLowerCase();
    if (platform === 'tiktok') {
      if (path === '/' || /^\/(?:foryou|following|friends|live)(?:\/|$)/.test(path)) return 'feed';
      if (path === '/search' || path.startsWith('/search/') || path === '/discover' || path === '/explore') return 'search';
      if (/^\/@[^/]+\/video\//.test(path)) return 'watch';
      if (path.startsWith('/@') || path === '/profile') return 'profile';
      return 'other';
    }
    if (platform === 'youtube') {
      if (path === '/' || path === '/home') return 'feed';
      if (path === '/results') return 'search';
      if (path === '/watch') return 'watch';
      if (path === '/feed/subscriptions') return 'subscriptions';
      if (path === '/playlist') return 'playlist';
      if (/^\/(?:shorts)(?:\/|$)/.test(path)) return 'shorts';
      if (/^\/(?:channel|c|user)\//.test(path) || path.startsWith('/@')) return 'channel';
      return 'other';
    }
    if (path === '/' || path === '/accounts/onetap') return 'feed';
    if (path === '/search' || path.startsWith('/explore/search/')) return 'search';
    if (/^\/(?:reels?)(?:\/|$)/.test(path)) return 'reels';
    if (/^\/(?:p|tv)\//.test(path)) return 'watch';
    if (/^\/(?:direct|accounts|about|legal)(?:\/|$)/.test(path)) return 'other';
    return path.split('/').filter(Boolean).length === 1 ? 'profile' : 'other';
  } catch {
    return 'other';
  }
}

/** Keeps Instagram's Facebook-based sign-in handoff in the same WebView session. */
export function isInstagramMetaAuthRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isFacebookHost = parsed.hostname === 'facebook.com' || parsed.hostname.endsWith('.facebook.com');
    const isAuthPath = parsed.pathname === '/'
      || /^\/(?:login|checkpoint|recover|consent)(?:\/|$)/i.test(parsed.pathname)
      || /^\/(?:dialog\/oauth|v\d+\.\d+\/dialog\/oauth)(?:\/|$)/i.test(parsed.pathname);
    return parsed.protocol === 'https:' && isFacebookHost && isAuthPath;
  } catch {
    return false;
  }
}

/** Keeps YouTube's Google account sign-in and sign-up in the same WebView session. */
export function isYouTubeGoogleAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    // Google finishes sign-in by setting cookies on regional hosts such as accounts.google.co.uk.
    return parsed.hostname === 'accounts.youtube.com' || /^accounts\.google\.(?:com|[a-z]{2,3})(?:\.[a-z]{2})?$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** TikTok lets people sign in with Google, Apple or Facebook; those pages must stay in the same WebView session. */
export function isTikTokThirdPartyAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return isYouTubeGoogleAuthUrl(url) || parsed.hostname === 'appleid.apple.com' || isInstagramMetaAuthRedirect(url);
  } catch {
    return false;
  }
}

const appStoreHosts = ['apps.apple.com', 'itunes.apple.com', 'play.google.com', 'app.link', 'onelink.me'];

/** App-store and deep links would leave FocusUp for the native Instagram or YouTube app. */
export function isAppHandoffUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return appStoreHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Compares only document origin/path so subresource failures do not replace a usable page with an error screen. */
export function isSameDocumentLocation(candidateUrl: string, documentUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const document = new URL(documentUrl);
    return candidate.origin === document.origin && candidate.pathname === document.pathname;
  } catch {
    return false;
  }
}
