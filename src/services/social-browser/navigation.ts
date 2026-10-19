import type { SocialBrowserRoute } from '../../types/social';
import type { SocialAppId } from '../../types/app';

export const socialBrowserHome = {
  instagram: 'https://www.instagram.com/',
  youtube: 'https://m.youtube.com/',
} as const;

/** Accept only secure links for the selected website, including pasted links without a scheme. */
export function normalizeSocialBrowserLink(platform: SocialAppId, input: string): string | null {
  if (platform !== 'instagram' && platform !== 'youtube') return null;
  const value = input.trim();
  if (!value || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const domains = platform === 'instagram' ? ['instagram.com'] : ['youtube.com', 'youtu.be'];
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
    const hosts = platform === 'instagram' ? ['instagram.com'] : platform === 'youtube' ? ['youtube.com', 'youtu.be'] : [];
    if (hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url.protocol === 'https:' ? 'internal' : 'reject';
    if (platform === 'instagram' && isInstagramMetaAuthRedirect(value)) return 'internal';
    return 'external';
  } catch { return 'reject'; }
}

/** Returns a coarse route label only; never persists usernames, search terms, IDs, or query strings. */
export function getSocialBrowserRoute(platform: SocialAppId, url: string): SocialBrowserRoute {
  try {
    const parsed = new URL(url, platform === 'youtube' ? 'https://m.youtube.com' : 'https://www.instagram.com');
    const path = parsed.pathname.toLowerCase();
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
