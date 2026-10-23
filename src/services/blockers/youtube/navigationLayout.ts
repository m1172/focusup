import { youtubeShortsPathPattern } from './detectors';

/** Page-world helpers: hide a whole Shorts tab and let the remaining mobile tabs share the row. */
export const youtubeNavigationLayoutScript = String.raw`
    var SHORTS_PATH = new RegExp(${JSON.stringify(youtubeShortsPathPattern.source)}, 'i');
    var PIVOT_ITEM = 'ytm-pivot-bar-item-renderer, yt-pivot-bar-item-view-model';
    function isShortsLink(node) {
      if (node.matches('[tab-identifier="shorts"], [pivot-identifier="shorts"]')) return true;
      var links = node.matches('a[href]') ? [node] : Array.from(node.querySelectorAll('a[href]'));
      if (links.some(function(link) {
        try {
          var url = new URL(link.getAttribute('href'), location.origin);
          return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].indexOf(url.hostname) !== -1 && SHORTS_PATH.test(url.pathname);
        } catch (_) { return false; }
      })) return true;
      var navigation = node.closest('ytm-pivot-bar-renderer, nav, [role="navigation"]');
      return Boolean(navigation && (textOf(node) === 'shorts' || node.querySelector('[aria-label="Shorts" i], [title="Shorts" i]')));
    }
    function shortsNavigationTarget(node) {
      var bar = node.closest('ytm-pivot-bar-renderer');
      if (bar) {
        var item = node.closest(PIVOT_ITEM) || node.closest('[role="tab"], .pivot-bar-item-tab') || node;
        for (var slot = item; slot && slot !== bar; slot = slot.parentElement) {
          var row = slot.parentElement;
          if (!row || !bar.contains(row)) break;
          var children = Array.from(row.children);
          if (children.length < 2 || !children.every(function(child) {
            return child.matches(PIVOT_ITEM + ', a, button, [role="tab"], .pivot-bar-item-tab') || child.querySelector(PIVOT_ITEM + ', a, button, [role="tab"]');
          })) continue;
          if (!row.hasAttribute('data-focusup-youtube-nav-row')) row.setAttribute('data-focusup-youtube-nav-row', '');
          return slot;
        }
        return item;
      }
      return node.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, nav [role="listitem"], nav li')
        || node.closest('ytd-reel-item-renderer, ytm-shorts-lockup-view-model, ytd-rich-item-renderer, ytd-video-renderer, ytm-video-with-context-renderer, ytd-compact-video-renderer, [role="listitem"]') || node;
    }
`;
