/** Exact button labels Instagram, YouTube and TikTok use to send people to their native apps, in every FocusUp language. */
export const openAppLabels = [
  'open instagram', 'open the instagram app', 'open in instagram', 'open instagram app',
  'open youtube', 'open the youtube app', 'open in youtube', 'open youtube app',
  'open tiktok', 'open the tiktok app', 'open in tiktok', 'open tiktok app', 'get tiktok app', 'get the tiktok app',
  'open app', 'open the app', 'open in app', 'open in the app', 'use the app', 'use app', 'get the app', 'get app',
  'download the app', 'install the app', 'switch to the app', 'continue in app', 'continue in the app',
  'открыть instagram', 'открыть приложение instagram', 'открыть youtube', 'открыть приложение youtube', 'открыть tiktok', 'открыть приложение tiktok',
  'открыть приложение', 'открыть в приложении', 'перейти в приложение', 'использовать приложение',
  'скачать приложение', 'установить приложение', 'продолжить в приложении',
  "instagram'ni ochish", 'instagramni ochish', 'instagram ilovasini ochish',
  "youtube'ni ochish", 'youtubeni ochish', 'youtube ilovasini ochish',
  "tiktok'ni ochish", 'tiktokni ochish', 'tiktok ilovasini ochish',
  'ilovani ochish', 'ilovada ochish', 'ilovani yuklab olish', "ilovaga o'tish", 'ilovada davom etish',
];

/**
 * Hides the website's "Open Instagram" / "Open app" buttons so sign-in and browsing stay inside FocusUp.
 * Runs regardless of Clean Mode because leaving for the native app bypasses every filter.
 */
export function createAppPromoScript(): string {
  return String.raw`(function() {
    var LABELS = ${JSON.stringify(openAppLabels)};
    var HANDOFF_SCHEME = /^(?:intent|instagram|youtube|vnd\.youtube|snssdk\d+|tiktok|itms-apps|itms-services|market):/i;
    var STORE_HOSTS = ['apps.apple.com', 'itunes.apple.com', 'play.google.com', 'app.link', 'onelink.me'];
    var MARKER = 'data-focusup-app-promo';
    var STYLE_ID = 'focusup-app-promo-styles';
    var state = window.__focusUpAppPromo || (window.__focusUpAppPromo = {});
    function normalize(value) { return (value || '').replace(/[\u2018\u2019\u02BB\u02BC\u0060]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); }
    function isHandoffLink(node) {
      var href = node.getAttribute('href');
      if (!href) return false;
      if (HANDOFF_SCHEME.test(href)) return true;
      try {
        var host = new URL(href, location.href).hostname;
        return STORE_HOSTS.some(function(store) { return host === store || host.endsWith('.' + store); });
      } catch (_) { return false; }
    }
    function isOpenAppControl(node) {
      var text = node.textContent || '';
      if (text.length < 80 && LABELS.indexOf(normalize(text)) !== -1) return true;
      if (LABELS.indexOf(normalize(node.getAttribute('aria-label'))) !== -1) return true;
      return isHandoffLink(node);
    }
    // YouTube wraps its "Switch to the app" prompts in dedicated upsell renderers; hide the whole prompt.
    function promptFor(node) {
      for (var parent = node.parentElement, depth = 0; parent && depth < 8; parent = parent.parentElement, depth++) {
        if (/UPSELL|MEALBAR|APP-PROMO/.test(parent.tagName)) return parent;
      }
      return node;
    }
    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return;
      var parent = document.head || document.documentElement;
      if (!parent) return;
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = '[' + MARKER + '] { display: none !important; }';
      parent.appendChild(style);
    }
    var CONTROLS = 'a, button, [role="button"], [role="link"]';
    function check(node) {
      if (node.hasAttribute(MARKER) || !isOpenAppControl(node)) return;
      promptFor(node).setAttribute(MARKER, '');
    }
    // Only what changed is checked. Video timers, counters and feed scrolling change the page every frame;
    // rescanning every link and button for each change kept the CPU busy and heated the phone.
    function scan(rootNode) {
      if (!rootNode.isConnected) return;
      var control = rootNode.closest(CONTROLS);
      if (control) check(control);
      rootNode.querySelectorAll(CONTROLS).forEach(check);
    }
    function hideOpenAppControls() {
      state.frame = 0;
      var roots = state.pending || [];
      state.pending = []; state.pendingSeen = new WeakSet();
      if (!document.documentElement) return;
      ensureStyle();
      roots.forEach(scan);
    }
    function schedule(node) {
      if (!node || node.nodeType !== 1) return;
      if (!state.pending) { state.pending = []; state.pendingSeen = new WeakSet(); }
      if (!state.pendingSeen.has(node)) { state.pendingSeen.add(node); state.pending.push(node); }
      if (!state.frame) state.frame = requestAnimationFrame(hideOpenAppControls);
    }
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        if (record.type === 'childList') record.addedNodes.forEach(function(node) { schedule(node.nodeType === 1 ? node : node.parentElement); });
        else schedule(record.type === 'characterData' ? record.target.parentElement : record.target);
      });
    });
    var start = function() {
      if (!document.documentElement) return;
      state.observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href', 'aria-label'] });
      state.pending = [document.documentElement]; state.pendingSeen = new WeakSet();
      hideOpenAppControls();
    };
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  })(); true;`;
}
