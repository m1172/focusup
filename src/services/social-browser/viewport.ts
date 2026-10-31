import type { SocialAppId } from '../../types/app';

/** Fill the browser viewport and report only its edge color so native cutout clearance blends into the page. */
export function createBrowserViewportScript(fullScreen: boolean, insets: { top: number; right: number; bottom: number; left: number }, platform: SocialAppId): string {
  return String.raw`(function() {
    var FULL_SCREEN = ${JSON.stringify(fullScreen)};
    var INSETS = ${JSON.stringify(insets)};
    var PLATFORM = ${JSON.stringify(platform)};
    var state = window.__focusUpViewport || (window.__focusUpViewport = {});
    state.reportAppearance = function() {
      if (!document.body || !window.ReactNativeWebView) return;
      var isStory = PLATFORM === 'instagram' && /^\/stories(?:\/|$)/.test(window.location.pathname);
      var report = function(hex) {
        var appearance = hex + ':' + isStory;
        if (appearance !== state.appearance) {
          state.appearance = appearance;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_APPEARANCE', platform: PLATFORM, backgroundColor: hex, isStory: isStory }));
        }
      };
      // Instagram paints the Story backdrop through an overlay rather than the document background.
      if (isStory) { report('#0b1014'); return; }
      var node = document.elementFromPoint && document.elementFromPoint(window.innerWidth / 2, 1);
      node = node || document.body;
      while (node) {
        var color = window.getComputedStyle(node).backgroundColor;
        var match = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
        if (match && (!match[4] || Number(match[4]) === 1)) {
          var hex = '#' + [match[1], match[2], match[3]].map(function(value) { return Number(value).toString(16).padStart(2, '0'); }).join('');
          report(hex);
          return;
        }
        node = node.parentElement;
      }
    };
    state.update = function() {
      if (!document.documentElement || !document.head) return;
      var root = document.documentElement;
      root.toggleAttribute('data-focusup-fullscreen', FULL_SCREEN);
      Object.keys(INSETS).forEach(function(side) { root.style.setProperty('--focusup-safe-' + side, (FULL_SCREEN ? INSETS[side] : 0) + 'px'); });
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width, initial-scale=1'; document.head.appendChild(meta); }
      var content = (meta.content || 'width=device-width, initial-scale=1').replace(/,?\s*viewport-fit\s*=\s*[^,]+/ig, '');
      var next = content + ', viewport-fit=cover';
      if (meta.content !== next) meta.content = next;
      var style = document.getElementById('focusup-viewport-styles');
      if (!style) { style = document.createElement('style'); style.id = 'focusup-viewport-styles'; document.head.appendChild(style); }
      var css = 'html[data-focusup-fullscreen] [data-focusup-nav-row] { padding-bottom: var(--focusup-safe-bottom, 0px) !important; height: auto !important; min-height: 50px; box-sizing: content-box !important; }';
      if (style.textContent !== css) style.textContent = css;
    };
    if (state.observer) state.observer.disconnect();
    if (state.pageObserver) state.pageObserver.disconnect();
    if (state.themeObserver) state.themeObserver.disconnect();
    if (state.frame) clearTimeout(state.frame);
    state.frame = null;
    if (state.initialize) document.removeEventListener('DOMContentLoaded', state.initialize);
    // Video players restyle the page every frame; checking the top edge color that often keeps the CPU busy.
    // A trailing check at most every 400 ms still follows theme and page changes. Hidden pages skip it.
    var scheduleAppearance = function() {
      if (state.frame || document.hidden) return;
      var wait = Math.max(0, 400 - (Date.now() - (state.lastAppearanceAt || 0)));
      state.frame = setTimeout(function() { state.frame = null; state.lastAppearanceAt = Date.now(); state.reportAppearance(); }, wait);
    };
    if (!state.historyInstalled) {
      ['pushState', 'replaceState'].forEach(function(method) {
        var original = history[method];
        history[method] = function() {
          var result = original.apply(this, arguments);
          queueMicrotask(function() { state.reportAppearance(); });
          return result;
        };
      });
      window.addEventListener('popstate', function() { state.reportAppearance(); });
      state.historyInstalled = true;
    }
    state.initialize = function() {
      state.update();
      state.reportAppearance();
      if (!document.head) return;
      state.observer = new MutationObserver(function() { state.update(); scheduleAppearance(); });
      state.observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
      if (document.body) {
        // Themes switch on <html>/<body>; watching style changes on every element would wake this for each video frame.
        state.pageObserver = new MutationObserver(scheduleAppearance);
        state.pageObserver.observe(document.body, { childList: true, subtree: true });
        // Observing the same node twice replaces its options, so <body>'s own attributes need a second observer.
        state.themeObserver = new MutationObserver(scheduleAppearance);
        state.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        state.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'dark'] });
      }
    };
    if (document.head && document.body) state.initialize(); else document.addEventListener('DOMContentLoaded', state.initialize, { once: true });
  })(); true;`;
}
