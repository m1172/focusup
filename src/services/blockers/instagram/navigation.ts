/** Block Reels before Instagram's SPA handles a tap or changes history. Only coarse route labels cross the bridge. */
export const instagramNavigationListener = String.raw`
  (() => {
    const bridge = window.__focusUpInstagram;
    if (!bridge || bridge.navigationInstalled) return;
    bridge.navigationInstalled = true;
    let last = '';
    let lastSafeUrl = '/';
    const block = (url) => {
      if (!bridge.shouldBlock || !bridge.shouldBlock(url, bridge.config)) return false;
      bridge.post({ type: 'BLOCKED_NAVIGATION', feature: 'reels' });
      return true;
    };
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
      if (bridge.shouldBlock && bridge.shouldBlock(location.href, bridge.config)) {
        document.querySelectorAll('video').forEach((video) => video.pause());
        bridge.post({ type: 'BLOCKED_NAVIGATION', feature: 'reels' });
        location.replace(lastSafeUrl);
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
