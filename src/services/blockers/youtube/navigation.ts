import type { YouTubeBlockerConfig } from '../../../types/social';
import { isYouTubeExploreUrl, isYouTubeShortsUrl } from './detectors';

/** Which blocked YouTube page a link leads to, or null. */
export function youtubeBlockedPage(url: string, config: Partial<YouTubeBlockerConfig>): 'shorts' | 'explore' | null {
  if (config.shorts && isYouTubeShortsUrl(url)) return 'shorts';
  if (config.explore && isYouTubeExploreUrl(url)) return 'explore';
  return null;
}

export function isBlockedYouTubeNavigation(url: string, config: Partial<YouTubeBlockerConfig>): boolean {
  return youtubeBlockedPage(url, config) !== null;
}

/** Injected path listener; blocked SPA routes (Shorts, Explore) fall back to Subscriptions exactly once. */
export const youtubeNavigationListener = String.raw`
  (() => {
    const bridge = window.__focusUpYouTube;
    if (!bridge || bridge.navigationInstalled) return;
    bridge.navigationInstalled = true;
    let lastRoute = '';
    const report = () => {
      const page = bridge.shouldBlock(location.href, bridge.config);
      if (page) {
        bridge.post({ type: 'BLOCKED_NAVIGATION', feature: page });
        location.replace('/feed/subscriptions');
        return;
      }
      const route = window.__focusUpGetRoute ? window.__focusUpGetRoute('youtube', location.href) : 'other';
      if (route !== lastRoute) {
        lastRoute = route;
        bridge.apply(document);
        bridge.post({ type: 'URL_CHANGED', route });
      }
    };
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function (...args) { const result = push.apply(this, args); queueMicrotask(report); return result; };
    history.replaceState = function (...args) { const result = replace.apply(this, args); queueMicrotask(report); return result; };
    window.addEventListener('popstate', report);
    window.addEventListener('yt-navigate-finish', report);
    window.addEventListener('pageshow', report);
    report();
  })();
`;
