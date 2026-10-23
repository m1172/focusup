import type { YouTubeBlockerConfig } from '../../../types/social';
import { normalizeYouTubeBlockerConfig } from './config';
import { youtubeShortsPathPattern } from './detectors';
import { youtubeNavigationListener } from './navigation';
import { youtubeSelectors } from './selectors';
import { youtubeNavigationLayoutScript } from './navigationLayout';
import { socialBrowserRouteScript } from '../../social-browser/routeScript';
import type { RemotePlatformRule } from '../../../store/remoteBlockerConfigStore';

export function generateYouTubeBlockingScript(input: Partial<YouTubeBlockerConfig>, enabled = true, rule?: RemotePlatformRule): string {
  const config = normalizeYouTubeBlockerConfig(input);
  const registry = JSON.stringify({ ...youtubeSelectors, ...rule?.selectors });
  return `(function(){
    'use strict';
    var CONFIG = ${JSON.stringify({ ...config, enabled, behaviorVersion: 1, ruleKey: JSON.stringify([rule?.selectors, rule?.routes]) })};
    var SHORTS_PATH = new RegExp(${JSON.stringify(youtubeShortsPathPattern.source)}, 'i');
    var REMOTE_ROUTES = ${JSON.stringify(rule?.routes ?? [])};
    var SELECTORS = ${registry};
    var MARKER = 'data-focusup-youtube-hidden';
    var STYLE_ID = 'focusup-youtube-clean-styles';
    var DEBUG = ${'__DEV__' in globalThis ? String((globalThis as { __DEV__?: boolean }).__DEV__) : 'false'};
    var root = window.__focusUpYouTube;
    if (!root) { root = { observer: null, navigationInstalled: false, processed: new WeakMap(), configKey: '', apply: null, post: null, config: CONFIG, shouldBlock: null }; window.__focusUpYouTube = root; }
    root.config = CONFIG;
    root.post = function(event) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ platform: 'youtube' }, event))); } catch (_) {} };
    window.__focusUpGetRoute = ${socialBrowserRouteScript};
    function log(message) { if (DEBUG && window.console) console.debug('[FocusUp YouTube] ' + message); }
    function ensureStyle() {
      var style = document.getElementById(STYLE_ID);
      if (!style) { var parent = document.head || document.documentElement; if (!parent) return; style = document.createElement('style'); style.id = STYLE_ID; parent.appendChild(style); }
      var css = '[' + MARKER + '] { display: none !important; }'
        + '[data-focusup-youtube-nav-row] { display: flex !important; flex-direction: row !important; justify-content: space-around !important; gap: 0 !important; }'
        + '[data-focusup-youtube-nav-row] > :not([' + MARKER + ']):not(style):not(script) { flex: 1 1 0% !important; width: 0 !important; min-width: 0 !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; }';
      if (style.textContent !== css) style.textContent = css;
    }
    function restoreHidden() {
      document.querySelectorAll('[' + MARKER + ']').forEach(function(node) { node.removeAttribute(MARKER); });
      document.querySelectorAll('[data-focusup-youtube-nav-row]').forEach(function(node) { node.removeAttribute('data-focusup-youtube-nav-row'); });
      root.processed = new WeakMap();
    }
    function textOf(node) { return ((node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title'))) || (node.textContent || '')).trim().slice(0, 160).toLowerCase(); }
    function semanticHeading(node, terms) {
      if (!node || !node.querySelectorAll) return false;
      var list = node.querySelectorAll('[role="heading"], h1, h2, h3, [aria-label]');
      for (var i = 0; i < list.length && i < 24; i++) { var label = textOf(list[i]); if (terms.some(function(term) { return label === term || label.indexOf(term) === 0; })) return true; }
      return false;
    }
    ${youtubeNavigationLayoutScript}
    function isShortsShelf(node) {
      var tag = (node.tagName || '').toLowerCase();
      if (tag === 'a' && (node.getAttribute('href') || '').indexOf('/shorts/') !== -1) return true;
      return tag.indexOf('reel-shelf') !== -1 || tag === 'ytd-shorts' || tag === 'ytm-shorts-lockup-view-model' || textOf(node).indexOf('shorts') !== -1 || Boolean(node.querySelector && node.querySelector('a[href*="/shorts/"]'));
    }
    function mark(node, feature) {
      if (!node || !node.setAttribute || node === document.documentElement || node === document.body) return false;
      if (node.getAttribute(MARKER) === feature) return false;
      if (node.closest && node.closest('[' + MARKER + ']')) return false;
      node.setAttribute(MARKER, feature); return true;
    }
    function matches(rootNode, selector) {
      var results = [];
      try { if (rootNode.matches && rootNode.matches(selector)) results.push(rootNode); if (rootNode.querySelectorAll) results.push.apply(results, rootNode.querySelectorAll(selector)); } catch (_) { /* Selector drift must not interrupt YouTube. */ }
      return results;
    }
    function hide(feature, selectors, rootNode, active, predicate, targetFor) {
      if (!active || !CONFIG.enabled) return;
      var count = 0;
      try {
        selectors.forEach(function(selector) { matches(rootNode, selector).forEach(function(node) {
          var parent = node.querySelector && node.querySelector('[role="heading"], h1, h2, h3');
          var navigation = selectors === SELECTORS.shortsNavigation;
          var key = feature + ':' + navigation + ':' + CONFIG.enabled + ':' + Object.keys(CONFIG).filter(function(k) { return k !== 'enabled' && CONFIG[k]; }).join(',') + ':' + (node.getAttribute('href') || '') + ':' + textOf(parent || node);
          // Navigation labels can arrive inside an existing slot after its first pass.
          if (!navigation && root.processed.get(node) === key) return;
          root.processed.set(node, key);
          var target = predicate(node) ? targetFor(node) : null;
          if (target && mark(target, feature)) count++;
          else if (!target && node.getAttribute(MARKER) === feature) node.removeAttribute(MARKER);
        }); });
      } catch (_) { root.post({ type: 'ERROR', scope: 'filter:' + feature }); log(feature + ' filter skipped after a DOM error'); }
      if (count) { root.post({ type: 'FILTER_APPLIED', feature: feature, count: count }); log(feature + ' filter applied'); }
    }
    function applyFocusUpYouTubeFilters(rootNode) {
      if (!rootNode) return;
      ensureStyle();
      if (root.configKey !== JSON.stringify(CONFIG)) { restoreHidden(); root.configKey = JSON.stringify(CONFIG); }
      if (!CONFIG.enabled) return;
      var shortsPath = SHORTS_PATH.test(location.pathname);
      hide('shorts', SELECTORS.shortsNavigation, rootNode, CONFIG.shorts && !shortsPath, isShortsLink, shortsNavigationTarget);
      hide('shorts', SELECTORS.shortsShelves, rootNode, CONFIG.shorts && !shortsPath, isShortsShelf, function(node) { return node.closest('ytd-reel-shelf-renderer, ytm-reel-shelf-renderer, ytd-shorts, ytm-shorts-lockup-view-model, ytd-rich-item-renderer, ytd-reel-item-renderer, ytd-video-renderer, ytm-video-with-context-renderer, ytd-compact-video-renderer') || node; });
      var homePage = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].indexOf(location.hostname) !== -1 && (location.pathname === '/' || location.pathname === '/home');
      hide('homeRecommendations', SELECTORS.homeRecommendations, rootNode, CONFIG.homeRecommendations && homePage, function(node) { return true; }, function(node) { return node; });
      var watchPage = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].indexOf(location.hostname) !== -1 && location.pathname === '/watch';
      hide('recommendations', SELECTORS.recommendations, rootNode, CONFIG.recommendations && watchPage, function(node) { return true; }, function(node) { return node.closest('ytd-watch-next-secondary-results-renderer, ytm-watch-next-secondary-results-renderer') || node; });
      hide('comments', SELECTORS.comments, rootNode, CONFIG.comments && watchPage, function(node) { return true; }, function(node) { return node; });
      // Sponsored content remains a no-op until a high-confidence marker is verified.
    }
    root.apply = applyFocusUpYouTubeFilters;
    root.shouldBlock = function(url, currentConfig) { try { var parsed = new URL(url); return Boolean(currentConfig && currentConfig.enabled && currentConfig.shorts && (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com' || parsed.hostname === 'm.youtube.com') && (SHORTS_PATH.test(parsed.pathname) || REMOTE_ROUTES.some(function(route) { return parsed.pathname === route || parsed.pathname.indexOf(route.endsWith('/') ? route : route + '/') === 0; }))); } catch (_) { return false; } };
    if (root.observer) root.observer.disconnect();
    var passScheduled = false;
    var pendingRoots = [];
    var pendingSeen = new WeakSet();
    function scheduleFilterPass(node) {
      if (!node || node.nodeType !== 1) return;
      if (!pendingSeen.has(node)) { pendingSeen.add(node); pendingRoots.push(node); }
      if (passScheduled) return;
      passScheduled = true;
      requestAnimationFrame(function() {
        var roots = pendingRoots; pendingRoots = []; pendingSeen = new WeakSet(); passScheduled = false;
        roots.forEach(function(rootNode) {
          applyFocusUpYouTubeFilters(rootNode);
          var semanticParent = rootNode.parentElement && rootNode.parentElement.closest('ytm-pivot-bar-renderer, ytd-watch-next-secondary-results-renderer, ytm-watch-next-secondary-results-renderer, ytd-comments, ytd-rich-grid-renderer, ytm-rich-grid-renderer, ytd-reel-shelf-renderer, ytm-reel-shelf-renderer');
          if (semanticParent) applyFocusUpYouTubeFilters(semanticParent);
        });
      });
    }
    root.observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        var additions = record.type === 'characterData' ? [record.target.parentElement] : record.type === 'attributes' ? [record.target] : Array.from(record.addedNodes);
        additions.forEach(scheduleFilterPass);
      });
    });
    var initialize = function() { if (!document.documentElement) return; if (CONFIG.enabled) root.observer.observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'aria-label', 'title', 'tab-identifier', 'pivot-identifier'], subtree: true }); applyFocusUpYouTubeFilters(document); root.post({ type: 'READY', observerActive: Boolean(CONFIG.enabled) }); };
    if (document.documentElement) initialize(); else document.addEventListener('DOMContentLoaded', initialize, { once: true });
    ${youtubeNavigationListener}
  })(); true;`;
}
