import type { InstagramBlockerConfig } from '../../../types/social';
import { normalizeInstagramBlockerConfig } from './config';
import { instagramNavigationListener } from './navigation';
import { instagramSelectors } from './selectors';
import { socialBrowserRouteScript } from '../../social-browser/routeScript';
import type { RemotePlatformRule } from '../../../store/remoteBlockerConfigStore';
import { instagramAuthenticationRoutePattern, instagramReelsFeedRoutePattern } from './url';
import { instagramSponsoredPostScript } from './content';
import { instagramNavigationLayoutScript } from './navigationLayout';
import { instagramSearchScript } from './search';
import { instagramDmReelSwipeScript } from './dmReels';

export function generateInstagramBlockingScript(input: Partial<Record<string, boolean>> | InstagramBlockerConfig, enabled = true, rule?: RemotePlatformRule, focusedSearch = true): string {
  const config = normalizeInstagramBlockerConfig(input);
  const selectorRegistry = JSON.stringify({ ...instagramSelectors, ...rule?.selectors });
  return String.raw`(function(){
    'use strict';
    var isAuthenticationRoute = function(url) {
      try {
        var parsed = new URL(url, 'https://www.instagram.com');
        return ['instagram.com', 'www.instagram.com'].indexOf(parsed.hostname) !== -1 && new RegExp(${JSON.stringify(instagramAuthenticationRoutePattern)}, 'i').test(parsed.pathname);
      } catch (_) { return false; }
    };
    var isSponsoredPost = ${instagramSponsoredPostScript};
    var isReelsUrl = function(url) {
      try {
        var parsed = new URL(url, location.origin);
        return ['instagram.com', 'www.instagram.com'].indexOf(parsed.hostname) !== -1 && new RegExp(${JSON.stringify(instagramReelsFeedRoutePattern)}, 'i').test(parsed.pathname);
      } catch (_) { return false; }
    };
    var currentHost = window.location.hostname.toLowerCase();
    if (currentHost !== 'instagram.com' && !currentHost.endsWith('.instagram.com')) return true;
    var CONFIG = ${JSON.stringify({ ...config, enabled, focusedSearch, behaviorVersion: 7, ruleKey: JSON.stringify([rule?.selectors, rule?.routes]) })};
    var SELECTORS = ${selectorRegistry};
    var STYLE_ID = 'focusup-instagram-clean-styles';
    var MARKER = 'data-focusup-hidden';
    var ROOT_KEY = '__focusUpInstagram';
    var DEBUG = ${'__DEV__' in globalThis ? String((globalThis as { __DEV__?: boolean }).__DEV__) : 'false'};
    var root = window[ROOT_KEY];
    if (!root) {
      root = { observer: null, navigationInstalled: false, authenticationPage: false, processed: new WeakMap(), configKey: '', apply: null, post: null, config: CONFIG, shouldBlock: null };
      window[ROOT_KEY] = root;
    }
    root.config = CONFIG;
    if (!root.detectedContent) root.detectedContent = new WeakMap();
    root.post = function(event) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ platform: 'instagram' }, event))); } catch (_) {} };
    window.__focusUpGetRoute = ${socialBrowserRouteScript};
    ${instagramDmReelSwipeScript}
    function log(message) { if (DEBUG && window.console) console.debug('[FocusUp Instagram] ' + message); }
    function ensureStyle() {
      var style = document.getElementById(STYLE_ID);
      if (!style) { var parent = document.head || document.documentElement; if (!parent) return; style = document.createElement('style'); style.id = STYLE_ID; parent.appendChild(style); }
      var css = '[' + MARKER + '] { display: none !important; }'
        + '[data-focusup-dm-reel-lock] { overflow-y: hidden !important; scroll-snap-type: none !important; touch-action: pan-x pinch-zoom !important; overscroll-behavior-y: none !important; }'
        + '[data-focusup-nav-row] { display: flex !important; flex-direction: row !important; justify-content: space-around !important; gap: 0 !important; }'
        + '[data-focusup-nav-row] > [data-focusup-nav-item]:not([' + MARKER + ']) { display: flex !important; flex: 1 1 0% !important; width: 0 !important; min-width: 0 !important; max-width: none !important; align-items: center !important; justify-content: center !important; }';
      if (style.textContent !== css) style.textContent = css;
    }
    function restoreHidden() {
      document.querySelectorAll('[' + MARKER + ']').forEach(function(node) { node.removeAttribute(MARKER); });
      document.querySelectorAll('[data-focusup-nav-row], [data-focusup-nav-item]').forEach(function(node) { node.removeAttribute('data-focusup-nav-row'); node.removeAttribute('data-focusup-nav-item'); });
      root.processed = new WeakMap();
    }
    function textOf(node) {
      if (!node) return '';
      var label = node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title'));
      if (label) return label.trim().slice(0, 160).toLowerCase();
      return (node.textContent || '').trim().slice(0, 160).toLowerCase();
    }
    function signatureOf(node) {
      var heading = node.querySelector && node.querySelector('[role="heading"], h1, h2, h3, h4');
      return (node.getAttribute('href') || '') + ':' + (node.getAttribute('aria-label') || '') + ':' + (heading && heading.textContent || '').trim().slice(0, 120);
    }
    function hasHeadingEvidence(node, phrases) {
      if (!node || !node.querySelectorAll) return false;
      var labels = node.querySelectorAll('[role="heading"], h1, h2, h3, h4, [aria-label]');
      for (var i = 0; i < labels.length && i < 30; i++) {
        var label = textOf(labels[i]);
        if (phrases.some(function(phrase) { return label === phrase || label.indexOf(phrase) === 0; })) return true;
      }
      return false;
    }
    function mark(node, feature) {
      if (!node || !node.setAttribute || node === document.documentElement || node === document.body) return false;
      if (node.getAttribute(MARKER) === feature) return false;
      if (node.closest && node.closest('[' + MARKER + ']')) return false;
      node.setAttribute(MARKER, feature);
      return true;
    }
    function matchesWithin(rootNode, selector) {
      var out = [];
      try {
        if (rootNode.matches && rootNode.matches(selector)) out.push(rootNode);
        if (rootNode.querySelectorAll) out.push.apply(out, rootNode.querySelectorAll(selector));
      } catch (_) { /* A selector may stop being valid after a site change; skip it. */ }
      return out;
    }
    ${instagramNavigationLayoutScript}
    ${instagramSearchScript}
    function isSuggestedPost(article) {
      return hasHeadingEvidence(article, ['suggested for you', 'recommended for you', 'suggested post', 'публикации для вас', 'рекомендации для вас', 'вам может понравиться', 'siz uchun tavsiya']);
    }
    function isRecommendationSection(section) {
      return hasHeadingEvidence(section, ['suggested for you', 'recommended for you', 'people you may know', 'suggested accounts', 'рекомендации для вас', 'рекомендуемые аккаунты', 'похожие аккаунты', 'siz uchun tavsiyalar']);
    }
    function detectContent(rootNode) {
      var counts = { sponsoredPosts: 0, suggestedPosts: 0 };
      matchesWithin(rootNode, 'article, [role="article"]').forEach(function(post) {
        var link = post.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        var identity = link ? link.getAttribute('href') : '';
        var previous = root.detectedContent.get(post);
        if (!previous || previous.identity !== identity) previous = { identity: identity, sponsoredPosts: false, suggestedPosts: false };
        if (!previous.sponsoredPosts && isSponsoredPost(post)) { counts.sponsoredPosts++; previous.sponsoredPosts = true; }
        if (!previous.suggestedPosts && isSuggestedPost(post)) { counts.suggestedPosts++; previous.suggestedPosts = true; }
        root.detectedContent.set(post, previous);
      });
      Object.keys(counts).forEach(function(feature) { if (counts[feature]) root.post({ type: 'CONTENT_DETECTED', feature: feature, count: counts[feature] }); });
    }
    function applyFeature(feature, rootNode, matcher) {
      if (!CONFIG.enabled || !CONFIG[feature]) return 0;
      var count = 0;
      try {
        SELECTORS[feature].forEach(function(selector) {
          matchesWithin(rootNode, selector).forEach(function(candidate) {
            var key = feature + ':' + CONFIG.enabled + ':' + Object.keys(CONFIG).filter(function(name) { return name !== 'enabled' && CONFIG[name]; }).join(',') + ':' + signatureOf(candidate) + (feature === 'sponsoredPosts' ? ':' + isSponsoredPost(candidate) : '');
            if (root.processed.get(candidate) === key && feature !== 'reels' && feature !== 'explore') return;
            root.processed.set(candidate, key);
            var target = matcher(candidate);
            if (target) { if (mark(target, feature)) count++; }
            else if (candidate.getAttribute(MARKER) === feature) candidate.removeAttribute(MARKER);
          });
        });
      } catch (_) { root.post({ type: 'ERROR', scope: 'filter:' + feature }); log(feature + ' filter skipped after a DOM error'); }
      if (count) { root.post({ type: 'FILTER_APPLIED', feature: feature, count: count }); log(feature + ' filter applied'); }
      return count;
    }
    function applyFocusUpFilters(rootNode) {
      if (!rootNode) return;
      ensureStyle();
      if (isAuthenticationRoute(location.href)) {
        if (!root.authenticationPage) restoreHidden();
        root.authenticationPage = true;
        return;
      }
      root.authenticationPage = false;
      root.scheduleDmReelScrollLocks();
      root.openPendingSearch();
      if (root.configKey !== JSON.stringify(CONFIG)) { restoreHidden(); root.configKey = JSON.stringify(CONFIG); }
      if (location.pathname === '/') detectContent(rootNode);
      if (!CONFIG.enabled) return;
      applyFeature('reels', rootNode, function(candidate) {
        var link = candidate.closest('a, button, [role="button"], [role="tab"]') || candidate;
        // Reels filtering controls the dedicated feed entry point, never Home media or profile grids.
        if (link.closest('article, [role="article"], [role="tablist"]')) return null;
        var href = link.getAttribute('href') || '';
        var label = (candidate.getAttribute('aria-label') || link.getAttribute('aria-label') || '').toLowerCase();
        var feedEntry = false;
        try { var destination = new URL(href, location.origin); feedEntry = ['instagram.com', 'www.instagram.com'].indexOf(destination.hostname) !== -1 && new RegExp(${JSON.stringify(instagramReelsFeedRoutePattern)}, 'i').test(destination.pathname); } catch (_) {}
        var navigationIcon = link.closest('nav, [role="navigation"], footer') && /^(?:instagram )?reels?$/.test(label);
        if (!feedEntry && !navigationIcon) return null;
        return navigationSlotFor(link);
      });
      applyFeature('explore', rootNode, function(link) {
        var href = link.getAttribute('href') || '';
        var label = (link.getAttribute('aria-label') || '').toLowerCase();
        if (href.toLowerCase().indexOf('/explore/') === -1 && !label.includes('explore')) return null;
        if (href.toLowerCase().indexOf('/explore/search') !== -1 || label.includes('search') || link.querySelector('[aria-label*="Search" i], [aria-label*="Поиск" i], [aria-label*="Qidir" i]')) return null;
        return navigationSlotFor(link);
      });
      applyFeature('suggestedPosts', rootNode, function(post) { return isSuggestedPost(post) ? post : null; });
      applyFeature('recommendations', rootNode, function(section) { return isRecommendationSection(section) ? section : null; });
      var isHomeFeed = location.pathname === '/';
      if (!isHomeFeed) document.querySelectorAll('[' + MARKER + '="homeFeed"]').forEach(function(node) { node.removeAttribute(MARKER); root.processed.delete(node); });
      if (isHomeFeed) applyFeature('homeFeed', rootNode, function(post) { return post.querySelector('a[href*="/p/"], a[href*="/reel/"]') && !post.querySelector('[role="tablist"]') ? post : null; });
      if (isHomeFeed) applyFeature('sponsoredPosts', rootNode, function(post) { return isSponsoredPost(post) ? post : null; });
    }
    root.apply = applyFocusUpFilters;
    root.shouldBlock = function(url, currentConfig) { return Boolean(currentConfig && currentConfig.enabled && currentConfig.reels && !isAuthenticationRoute(url) && !isAuthenticationRoute(location.href) && isReelsUrl(url)); };
    root.update = function(next) {
      CONFIG = Object.assign({}, next || {});
      root.config = CONFIG;
      root.dmReelSwipeGuardEnabled = Boolean(CONFIG.enabled && CONFIG.reels);
      root.syncDmReelScrollLocks();
      root.configKey = '';
      restoreHidden();
      syncObserver();
      applyFocusUpFilters(document);
    };
    if (root.observer) root.observer.disconnect();
    var passScheduled = false;
    var slowPassTimer = null;
    var lastPassAt = 0;
    var pendingRoots = [];
    var pendingSeen = new WeakSet();
    // New content and label changes are filtered on the next frame so they never show. Text edits (video timers,
    // like and view counts) arrive many times a second; filtering each one every frame kept the CPU busy.
    var TEXT_PASS_MS = 300;
    var runFilterPass = function() {
      passScheduled = false; lastPassAt = Date.now();
      var roots = pendingRoots; pendingRoots = []; pendingSeen = new WeakSet();
      roots.forEach(function(rootNode) {
        applyFocusUpFilters(rootNode);
        var semanticParent = rootNode.parentElement && rootNode.parentElement.closest('article, section, [role="article"], [role="region"], [role="group"], nav');
        if (semanticParent) applyFocusUpFilters(semanticParent);
      });
    };
    var scheduleFilterPass = function(node, urgent) {
      if (!node || node.nodeType !== 1) return;
      if (!pendingSeen.has(node)) { pendingSeen.add(node); pendingRoots.push(node); }
      if (passScheduled) return;
      var wait = urgent ? 0 : TEXT_PASS_MS - (Date.now() - lastPassAt);
      if (wait <= 0) {
        if (slowPassTimer) { clearTimeout(slowPassTimer); slowPassTimer = null; }
        passScheduled = true; requestAnimationFrame(runFilterPass); return;
      }
      if (!slowPassTimer) slowPassTimer = setTimeout(function() { slowPassTimer = null; if (!passScheduled) { passScheduled = true; requestAnimationFrame(runFilterPass); } }, wait);
    };
    root.observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        var nodes = record.type === 'characterData' ? [record.target.parentElement] : record.type === 'attributes' ? [record.target] : Array.from(record.addedNodes);
        nodes.forEach(function(node) { scheduleFilterPass(node, record.type !== 'characterData'); });
      });
    });
    var syncObserver = function() {
      if (!root.observer) return;
      root.observer.disconnect();
      if (document.documentElement) root.observer.observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'aria-label', 'title'], subtree: true });
    };
    var finishInitialization = function() {
      if (!document.documentElement) return;
      syncObserver();
      applyFocusUpFilters(document);
      root.post({ type: 'READY', observerActive: Boolean(root.observer) });
      log('Clean Mode initialized');
    };
    if (document.documentElement) finishInitialization(); else document.addEventListener('DOMContentLoaded', finishInitialization, { once: true });
    ${instagramNavigationListener}
  })(); true;`;
}
