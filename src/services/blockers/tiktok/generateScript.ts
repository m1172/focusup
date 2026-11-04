import type { TikTokBlockerConfig } from '../../../types/social';
import type { RemotePlatformRule } from '../../../store/remoteBlockerConfigStore';
import { normalizeTikTokBlockerConfig } from './config';
import { tiktokExplorePathPattern, tiktokFollowingPathPattern, tiktokForYouPathPattern } from './detectors';
import { tiktokNavigationListener } from './navigation';
import { tiktokSelectors } from './selectors';
import { socialBrowserRouteScript } from '../../social-browser/routeScript';

/** `rule` is the validated remote rule: its selectors are added to the built-in ones, and its routes block extra feed pages. */
export function generateTikTokBlockingScript(input: Partial<TikTokBlockerConfig>, enabled = true, rule?: RemotePlatformRule): string {
  const config = normalizeTikTokBlockerConfig(input);
  const selectors: Record<string, readonly string[]> = { ...tiktokSelectors };
  Object.entries(rule?.selectors ?? {}).forEach(([group, extra]) => { if (group in tiktokSelectors && group !== 'promoDismiss') selectors[group] = [...(selectors[group] ?? []), ...extra]; });
  return `(function(){
    'use strict';
    var CONFIG = ${JSON.stringify({ ...config, enabled, behaviorVersion: 1, ruleKey: JSON.stringify([rule?.selectors, rule?.routes]) })};
    var REMOTE_ROUTES = ${JSON.stringify(rule?.routes ?? [])};
    var PATHS = { forYou: new RegExp(${JSON.stringify(tiktokForYouPathPattern.source)}, 'i'), following: new RegExp(${JSON.stringify(tiktokFollowingPathPattern.source)}, 'i'), explore: new RegExp(${JSON.stringify(tiktokExplorePathPattern.source)}, 'i') };
    var SELECTORS = ${JSON.stringify(selectors)};
    var MARKER = 'data-focusup-tiktok-hidden';
    var NAV_ROW = 'data-focusup-tiktok-nav-row';
    var STYLE_ID = 'focusup-tiktok-clean-styles';
    var root = window.__focusUpTikTok;
    if (!root) { root = { observer: null, navigationInstalled: false, config: CONFIG, apply: null, post: null, blockedFeature: null, dismissed: new WeakSet() }; window.__focusUpTikTok = root; }
    root.config = CONFIG;
    root.post = function(event) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ platform: 'tiktok' }, event))); } catch (_) {} };
    window.__focusUpGetRoute = ${socialBrowserRouteScript};
    function isTikTokHost(host) { return host === 'tiktok.com' || host.endsWith('.tiktok.com'); }
    root.blockedFeature = function(url, current) {
      try {
        var parsed = new URL(url, location.href);
        if (!current || !current.enabled || !isTikTokHost(parsed.hostname)) return null;
        var features = ['forYou', 'following', 'explore'];
        for (var i = 0; i < features.length; i++) if (current[features[i]] && PATHS[features[i]].test(parsed.pathname)) return features[i];
        // Feed pages added by a remote rule count as For You.
        var path = parsed.pathname.replace(/\\/+$/, '') || '/';
        if (current.forYou && REMOTE_ROUTES.some(function(route) { var base = route.replace(/\\/+$/, ''); return path === base || path.indexOf(base + '/') === 0; })) return 'forYou';
        return null;
      } catch (_) { return null; }
    };
    function ensureStyle() {
      var style = document.getElementById(STYLE_ID);
      if (!style) { var parent = document.head || document.documentElement; if (!parent) return; style = document.createElement('style'); style.id = STYLE_ID; parent.appendChild(style); }
      // Hidden tabs leave no gap: the bottom bar shares its width among the tabs that remain.
      var css = '[' + MARKER + '] { display: none !important; }'
        + '[' + NAV_ROW + '] { display: flex !important; flex-direction: row !important; justify-content: space-around !important; }'
        + '[' + NAV_ROW + '] > :not([' + MARKER + ']):not(style):not(script) { flex: 1 1 0% !important; width: auto !important; min-width: 0 !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; }';
      if (style.textContent !== css) style.textContent = css;
    }
    function matches(rootNode, selector) {
      var results = [];
      try { if (rootNode.matches && rootNode.matches(selector)) results.push(rootNode); if (rootNode.querySelectorAll) results.push.apply(results, rootNode.querySelectorAll(selector)); } catch (_) { /* Selector drift must not interrupt TikTok. */ }
      return results;
    }
    // A bottom-bar icon sits inside its link, and the link inside a slot of the bar. Hide the whole slot (and mark the
    // bar) so the remaining tabs spread out instead of leaving an empty gap.
    function navTarget(node) {
      var link = node.closest('a, button, [role="button"]') || node;
      var slot = link;
      for (var depth = 0; depth < 6; depth++) {
        var row = slot.parentElement;
        if (!row || row === document.body || row === document.documentElement) break;
        var children = Array.from(row.children);
        var tabs = children.filter(function(child) { return child.matches('a, button, [role="button"], [data-e2e]') || child.querySelector('a, button, [role="button"], [data-e2e]'); });
        if (children.length >= 3 && children.length <= 7 && tabs.length >= 3) {
          var rect = row.getBoundingClientRect();
          var atBottom = rect.width > 0 && rect.width > rect.height * 2 && rect.top >= window.innerHeight / 2 && rect.bottom <= window.innerHeight + 64;
          var semantic = row.matches('nav, [role="navigation"], [role="tablist"]');
          if (atBottom || semantic) { if (!row.hasAttribute(NAV_ROW)) row.setAttribute(NAV_ROW, ''); return slot; }
        }
        slot = row;
      }
      return node.closest('a') || node;
    }
    function hide(feature, selectors, rootNode, active, targetFor) {
      var count = 0;
      try {
        selectors.forEach(function(selector) { matches(rootNode, selector).forEach(function(node) {
          var target = targetFor ? targetFor(node) : node;
          if (!target || target === document.body || target === document.documentElement) return;
          if (active) { if (target.getAttribute(MARKER) !== feature) { target.setAttribute(MARKER, feature); count++; } }
          else if (target.getAttribute(MARKER) === feature) target.removeAttribute(MARKER);
        }); });
      } catch (_) { root.post({ type: 'ERROR', scope: 'filter:' + feature }); }
      if (count && feature !== 'appPromo') root.post({ type: 'FILTER_APPLIED', feature: feature, count: count });
    }
    function dismissPrompts(rootNode) {
      SELECTORS.promoDismiss.forEach(function(selector) { matches(rootNode, selector).forEach(function(button) {
        if (root.dismissed.has(button)) return;
        root.dismissed.add(button);
        try { button.click(); } catch (_) {}
      }); });
    }
    function applyFocusUpTikTokFilters(rootNode) {
      if (!rootNode) return;
      ensureStyle();
      // Prompts that send people to the native app are removed in every mode: leaving bypasses every filter.
      hide('appPromo', SELECTORS.appPromo, rootNode, true, navTarget);
      dismissPrompts(rootNode);
      var on = CONFIG.enabled;
      hide('forYou', SELECTORS.forYouNavigation, rootNode, on && CONFIG.forYou, navTarget);
      hide('following', SELECTORS.followingNavigation, rootNode, on && CONFIG.following, navTarget);
      hide('explore', SELECTORS.exploreNavigation, rootNode, on && CONFIG.explore, navTarget);
      var videoPage = /^\\/@[^/]+\\/video\\/\\d+/.test(location.pathname);
      hide('forYou', SELECTORS.nextVideos, rootNode, on && CONFIG.forYou && videoPage, function(node) { return node.querySelector('[data-e2e="video-slide-active"]') ? null : node; });
    }
    root.apply = applyFocusUpTikTokFilters;
    if (root.observer) root.observer.disconnect();
    var pending = [];
    var frame = 0;
    var run = function() { frame = 0; var roots = pending; pending = []; roots.forEach(function(node) { if (node.isConnected) applyFocusUpTikTokFilters(node); }); };
    root.observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        var nodes = record.type === 'attributes' ? [record.target] : Array.from(record.addedNodes);
        nodes.forEach(function(node) { if (node && node.nodeType === 1) pending.push(node); });
      });
      if (pending.length && !frame) frame = requestAnimationFrame(run);
    });
    var initialize = function() { if (!document.documentElement) return; root.observer.observe(document.documentElement, { childList: true, attributes: true, attributeFilter: ['href', 'data-e2e'], subtree: true }); applyFocusUpTikTokFilters(document); root.post({ type: 'READY', observerActive: true }); };
    if (document.documentElement) initialize(); else document.addEventListener('DOMContentLoaded', initialize, { once: true });
    ${tiktokNavigationListener}
  })(); true;`;
}
