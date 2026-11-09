/** Block Reels, Stories and (messages-only) feeds before Instagram's SPA handles a tap or changes history. Only coarse route labels cross the bridge. */
export const instagramNavigationListener = String.raw`
  (() => {
    const bridge = window.__focusUpInstagram;
    if (!bridge || bridge.navigationInstalled) return;
    bridge.navigationInstalled = true;
    let last = '';
    let lastSafeUrl = '';
    const blocked = (url) => bridge.shouldBlock ? bridge.shouldBlock(url, bridge.config) : '';
    const block = (url) => {
      const page = blocked(url);
      if (!page) return false;
      bridge.post({ type: 'BLOCKED_NAVIGATION', feature: page });
      return true;
    };
    // Go back to the last allowed page; Home in messages-only mode is blocked, so that falls back to the inbox.
    const safeUrl = () => lastSafeUrl && !blocked(lastSafeUrl) ? lastSafeUrl : (bridge.safeHome ? bridge.safeHome() : '/');
    document.addEventListener('click', (event) => {
      const target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
      const link = target && target.closest('a[href]');
      if (!link || !block(link.href)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    const report = () => {
      if (/^\/(?:accounts\/(?:login|signup|password\/reset|onetap|one_tap|two_factor_authentication|confirm_email)|challenge|checkpoint)(?:\/|$)/i.test(location.pathname)) {
        bridge.authenticationPage = true;
        return;
      }
      bridge.authenticationPage = false;
      if (bridge.updateDmReelSwipeState) bridge.updateDmReelSwipeState(location.pathname);
      const page = blocked(location.href);
      if (page) {
        document.querySelectorAll('video').forEach((video) => video.pause());
        bridge.post({ type: 'BLOCKED_NAVIGATION', feature: page });
        location.replace(safeUrl());
        return;
      }
      lastSafeUrl = location.href;
      const route = window.__focusUpGetRoute ? window.__focusUpGetRoute('instagram', location.href) : 'other';
      bridge.apply(document);
      if (route === last) return;
      last = route;
      bridge.post({ type: 'URL_CHANGED', route });
    };
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function (...args) { if (args[2] != null && block(new URL(args[2], location.href).href)) return; const result = originalPush.apply(this, args); queueMicrotask(report); return result; };
    history.replaceState = function (...args) { if (args[2] != null && block(new URL(args[2], location.href).href)) return; const result = originalReplace.apply(this, args); queueMicrotask(report); return result; };
    window.addEventListener('popstate', report);
    window.addEventListener('pageshow', report);
    report();
  })();
`;
