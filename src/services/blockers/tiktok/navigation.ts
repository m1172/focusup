import type { TikTokBlockerConfig } from '../../../types/social';
import { tiktokFeedFeature } from './detectors';

export function isBlockedTikTokNavigation(url: string, config: Partial<TikTokBlockerConfig>): boolean {
  const feature = tiktokFeedFeature(url);
  return Boolean(feature && config[feature]);
}

/** Injected path listener; blocked feeds fall back to the inbox. */
export const tiktokNavigationListener = String.raw`
  (() => {
    const bridge = window.__focusUpTikTok;
    if (!bridge || bridge.navigationInstalled) return;
    bridge.navigationInstalled = true;
    let lastRoute = '';
    const report = () => {
      const feature = bridge.blockedFeature(location.href, bridge.config);
      if (feature) {
        bridge.post({ type: 'BLOCKED_NAVIGATION', feature: feature });
        location.replace('/inbox');
        return;
      }
      const route = window.__focusUpGetRoute ? window.__focusUpGetRoute('tiktok', location.href) : 'other';
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
    window.addEventListener('pageshow', report);
    report();
  })();
`;
