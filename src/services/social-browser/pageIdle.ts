/**
 * Run when a kept page leaves the screen. An off-screen WebView is still "visible" to the site, so Instagram and
 * YouTube would keep playing feed videos and running timers. The page is told it is hidden (sites slow down for
 * background tabs), media is paused and cannot start again, and nothing holds the keyboard.
 */
export const createPageIdleScript = (hidden: boolean) => `(function () { try {
  var idle = window.__focusupIdle || (window.__focusupIdle = {});
  if (!idle.installed) {
    idle.installed = true;
    var play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (idle.hidden) return Promise.reject(new DOMException('FocusUp paused this page while it is hidden', 'NotAllowedError'));
      return play.apply(this, arguments);
    };
    ['hidden', 'visibilityState'].forEach(function (name) {
      var original = Object.getOwnPropertyDescriptor(Document.prototype, name);
      if (!original || !original.get) return;
      Object.defineProperty(document, name, { configurable: true, get: function () {
        return idle.hidden ? (name === 'hidden' ? true : 'hidden') : original.get.call(document);
      } });
    });
  }
  if (idle.hidden === ${hidden}) return;
  idle.hidden = ${hidden};
  if (idle.hidden) {
    // FocusUp's own page watchers stop too; showing the page injects the scripts again, which reconnects them.
    [window.__focusUpInstagram, window.__focusUpYouTube, window.__focusUpAppPromo].forEach(function (state) { if (state && state.observer) state.observer.disconnect(); });
    var viewport = window.__focusUpViewport;
    if (viewport) ['observer', 'pageObserver', 'themeObserver'].forEach(function (name) { if (viewport[name]) viewport[name].disconnect(); });
    document.querySelectorAll('video, audio').forEach(function (media) { if (!media.paused) media.pause(); });
    var focused = document.activeElement; if (focused && focused.blur) focused.blur();
  }
  document.dispatchEvent(new Event('visibilitychange'));
} catch (e) {} })(); true;`;
