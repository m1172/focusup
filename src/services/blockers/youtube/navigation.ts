import type { YouTubeBlockerConfig } from '../../../types/social';
import { isYouTubeShortsUrl } from './detectors';

export function isBlockedYouTubeNavigation(url: string, config: Partial<YouTubeBlockerConfig>): boolean {
  return Boolean(config.shorts && isYouTubeShortsUrl(url));
}

/** Injected path listener; Shorts SPA routes fall back to Subscriptions exactly once. */
export const youtubeNavigationListener = String.raw`
  (() => {
    const bridge = window.__focusUpYouTube;
    if (!bridge || bridge.navigationInstalled) return;
    bridge.navigationInstalled = true;
    let lastRoute = '';
    const report = () => {
      if (bridge.shouldBlock(location.href, bridge.config)) {
        bridge.post({ type: 'BLOCKED_NAVIGATION', feature: 'shorts' });
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
