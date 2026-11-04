/**
 * Page-world script for Instagram, separate from the filters so it runs with them on or off:
 * - ACCOUNT: the signed-in username and profile picture, read from the profile tab, for the account switcher.
 * - NAV_BAR: whether Instagram shows its own bottom tab bar (it hides it on the Messages list).
 * - POSTS_SEEN: home-feed posts that were at least half on screen, each counted once, for the session strip.
 * - OPEN_ACCOUNTS: a tap on the username menu, when Vaqtim's own switcher should open instead of Instagram's.
 */
export function createInstagramPageScript(accountSwitcher: boolean): string {
  return String.raw`(function() {
    var host = location.hostname.toLowerCase();
    if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return;
    var SWITCHER = ${JSON.stringify(accountSwitcher)};
    var state = window.__focusUpInstagramPage || (window.__focusUpInstagramPage = {});
    state.switcher = SWITCHER;
    if (state.installed) { state.scan && state.scan(); return; }
    state.installed = true;
    var post = function(event) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ platform: 'instagram' }, event))); } catch (_) {} };
    var RESERVED = /^(?:explore|reels?|direct|accounts|stories|p|tv|about|legal|developer|emails?|web|challenge|privacy|session|api|graphql|static|nametag|directory|lite|ar|create)$/i;

    // A bottom bar (or sidebar) row: one ancestor holds the Home link and the Search or Messages link.
    function tabBarOf(node) {
      for (var depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
        if (node.matches && node.matches('nav, [role="navigation"], [data-focusup-nav-row]')) return node;
        if (node.querySelector && node.querySelector('a[href="/"]') && node.querySelector('a[href^="/explore"], a[href^="/direct"]')) return node;
      }
      return null;
    }
    function readAccount() {
      var images = document.querySelectorAll('a[href] img');
      for (var i = 0; i < images.length && i < 500; i++) {
        var link = images[i].closest('a[href]');
        if (!link || link.closest('article, [role="article"], [role="dialog"]')) continue;
        var path = '';
        try { var url = new URL(link.getAttribute('href'), location.origin); if (url.origin !== location.origin) continue; path = url.pathname; } catch (_) { continue; }
        var match = /^\/([a-z0-9._]{1,30})\/?$/i.exec(path);
        if (!match || RESERVED.test(match[1]) || !tabBarOf(link)) continue;
        var src = images[i].currentSrc || images[i].src || '';
        var avatar = '';
        try { var image = new URL(src); if (image.protocol === 'https:' && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(image.hostname) && src.length <= 2000) avatar = src; } catch (_) {}
        return { username: match[1], avatar: avatar };
      }
      return null;
    }
    function bottomBarVisible() {
      var homes = document.querySelectorAll('a[href="/"]');
      for (var i = 0; i < homes.length; i++) {
        var bar = tabBarOf(homes[i]);
        if (!bar) continue;
        var rect = bar.getBoundingClientRect();
        if (rect.width > rect.height && rect.height > 0 && rect.bottom >= window.innerHeight - 120 && getComputedStyle(bar).visibility !== 'hidden') return true;
      }
      return false;
    }

    var seen = new WeakSet();
    var watched = new WeakSet();
    var pending = 0;
    var flush = null;
    var visibility = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || seen.has(entry.target) || location.pathname !== '/') return;
        seen.add(entry.target);
        pending++;
      });
      if (pending && !flush) flush = setTimeout(function() { flush = null; var count = Math.min(pending, 100); pending = 0; post({ type: 'POSTS_SEEN', count: count }); }, 1000);
    }, { threshold: 0.5 }) : null;

    state.scan = function() {
      if (/^\/(?:accounts\/(?:login|signup|password|onetap|one_tap|two_factor|emailsignup)|challenge|checkpoint)/i.test(location.pathname)) return;
      var account = readAccount();
      var key = account ? account.username + '|' + account.avatar : '';
      if (account && key !== state.accountKey) { state.accountKey = key; state.account = account; post({ type: 'ACCOUNT', username: account.username, avatar: account.avatar }); }
      var nav = bottomBarVisible();
      if (nav !== state.nav) { state.nav = nav; post({ type: 'NAV_BAR', visible: nav }); }
      if (visibility && location.pathname === '/') document.querySelectorAll('article, [role="article"]').forEach(function(item) { if (!watched.has(item)) { watched.add(item); visibility.observe(item); } });
    };
    var timer = null;
    var schedule = function() { if (!timer) timer = setTimeout(function() { timer = null; state.scan(); }, 400); };
    var start = function() {
      state.scan();
      new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true });
    };
    ['pushState', 'replaceState'].forEach(function(method) {
      var original = history[method];
      history[method] = function() { var result = original.apply(this, arguments); schedule(); return result; };
    });
    window.addEventListener('popstate', schedule);
    window.addEventListener('resize', schedule);
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });

    // The username at the top of the profile and Messages pages opens Instagram's switcher, which only offers
    // a new sign-in. Vaqtim keeps each account's own sign-in, so its switcher opens instead.
    document.addEventListener('click', function(event) {
      var account = state.account;
      if (!state.switcher || !account) return;
      var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
      var control = target && target.closest('[role="button"], button');
      if (!control || control.closest('a[href], [role="dialog"], article, [role="article"], [data-focusup-nav-row]')) return;
      var rect = control.getBoundingClientRect();
      if (rect.top > 180 || rect.height > 90) return;
      if ((control.textContent || '').trim().indexOf(account.username) !== 0) return;
      if (!control.querySelector('svg') && !(control.parentElement && control.parentElement.querySelector('svg'))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      post({ type: 'OPEN_ACCOUNTS' });
    }, true);
  })(); true;`;
}
