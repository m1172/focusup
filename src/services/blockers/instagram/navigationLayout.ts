/** Page-world source: remove the entire navigation slot, then share its width among the remaining items. */
export const instagramNavigationLayoutScript = String.raw`
    function isMainNavigationLink(link) {
      try {
        var url = new URL(link.getAttribute('href'), location.origin);
        if (url.origin !== location.origin) return false;
        var path = url.pathname;
        return path === '/' || /^\/(?:explore(?:\/search)?|reels|direct\/inbox)\/?$/.test(path) || /^\/[^/]+\/?$/.test(path);
      } catch (_) { return false; }
    }
    function navigationSlotFor(link) {
      var slot = link;
      for (var depth = 0; depth < 7 && slot.parentElement; depth++, slot = slot.parentElement) {
        var row = slot.parentElement;
        if (row === document.body || row === document.documentElement) break;
        var children = Array.from(row.children);
        if (children.length < 3 || children.length > 7) continue;
        var items = children.filter(function(child) {
          var links = child.matches('a[href]') ? [child] : Array.from(child.querySelectorAll('a[href]'));
          return links.length === 1 && isMainNavigationLink(links[0]);
        });
        if (items.length < 3 || items.indexOf(slot) === -1) continue;
        var rect = row.getBoundingClientRect();
        var atBottom = rect.width > 0 && rect.width > rect.height * 2 && rect.top >= window.innerHeight / 2 && rect.bottom <= window.innerHeight + 64;
        var semanticRow = row.matches('nav, [role="navigation"]') && rect.width === 0;
        if (!atBottom && !semanticRow) continue;
        if (!row.hasAttribute('data-focusup-nav-row')) row.setAttribute('data-focusup-nav-row', '');
        items.forEach(function(item) { if (!item.hasAttribute('data-focusup-nav-item')) item.setAttribute('data-focusup-nav-item', ''); });
        return slot;
      }
      return link.closest('nav li, nav [role="listitem"]') || link;
    }
`;
