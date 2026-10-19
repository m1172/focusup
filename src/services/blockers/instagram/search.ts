/** Open Instagram's own search/recent view after its bottom Search tab navigates to Explore. */
export const instagramSearchScript = String.raw`
    var SEARCH_REQUEST_KEY = 'focusup-instagram-open-search';
    if (root.pendingSearch === undefined) {
      try { root.pendingSearch = sessionStorage.getItem(SEARCH_REQUEST_KEY) === '1'; } catch (_) { root.pendingSearch = false; }
    }
    var isSearchPath = function() { return /^\/(?:explore(?:\/search)?|search)\/?$/.test(location.pathname); };
    var visibleSearchInput = function() {
      var inputs = document.querySelectorAll('input[type="search"], input[placeholder="Search" i], input[aria-label="Search" i], input[placeholder="Поиск" i], input[aria-label="Поиск" i], input[placeholder*="Qidir" i], input[aria-label*="Qidir" i]');
      return Array.from(inputs).find(function(node) {
        var style = window.getComputedStyle(node);
        return !node.disabled && !node.closest('[hidden], [aria-hidden="true"]') && style.display !== 'none' && style.visibility !== 'hidden';
      });
    };
    root.clearSearchRequest = function() {
      root.pendingSearch = false;
      try { sessionStorage.removeItem(SEARCH_REQUEST_KEY); } catch (_) {}
    };
    root.openPendingSearch = function() {
      if (!root.config.enabled || !root.config.focusedSearch) { root.clearSearchRequest(); return false; }
      if (!root.pendingSearch || !isSearchPath()) return false;
      var input = visibleSearchInput();
      if (!input) return false;
      root.clearSearchRequest();
      // Activate Instagram's Recent view without raising the keyboard for a tab tap.
      // A later, deliberate tap on the input retains the normal typing behavior.
      var inputMode = input.getAttribute('inputmode');
      input.setAttribute('inputmode', 'none');
      input.click();
      input.focus({ preventScroll: true });
      input.blur();
      if (inputMode === null) input.removeAttribute('inputmode'); else input.setAttribute('inputmode', inputMode);
      return true;
    };
    root.returnFromSearchToHome = function() {
      root.clearSearchRequest();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      var home = Array.from(document.querySelectorAll('a[href]')).find(function(link) {
        if (link.closest('article, [role="article"], [role="dialog"]')) return false;
        try {
          var url = new URL(link.href, location.origin);
          if (url.origin !== location.origin || url.pathname !== '/') return false;
          var slot = navigationSlotFor(link);
          return slot.parentElement && slot.parentElement.hasAttribute('data-focusup-nav-row');
        } catch (_) { return false; }
      });
      if (home) home.click(); else location.assign('/');
    };
    if (!root.searchNavigationInstalled) {
      root.searchNavigationInstalled = true;
      document.addEventListener('click', function(event) {
        if (!root.config.enabled || !root.config.focusedSearch) return;
        var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
        var action = target && target.closest('button, [role="button"], a[href]');
        if (action && isSearchPath()) {
          var label = (action.getAttribute('aria-label') || action.textContent || '').trim().toLowerCase();
          var input = visibleSearchInput();
          var dialog = action.closest('[role="dialog"]');
          if (input && (!dialog || dialog.contains(input)) && /^(?:cancel|cancel search|отмена|отменить|bekor qilish|bekor)$/.test(label)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            root.returnFromSearchToHome();
            return;
          }
        }
        var link = target && target.closest('a[href]');
        if (!link || link.closest('article, [role="article"], [role="tablist"]')) return;
        try {
          var url = new URL(link.href, location.origin);
          if (url.origin !== location.origin || !/^\/(?:explore(?:\/search)?|search)\/?$/.test(url.pathname)) return;
          var slot = navigationSlotFor(link);
          if (!slot.parentElement || !slot.parentElement.hasAttribute('data-focusup-nav-row')) return;
        } catch (_) { return; }
        root.pendingSearch = true;
        try { sessionStorage.setItem(SEARCH_REQUEST_KEY, '1'); } catch (_) {}
        if (root.openPendingSearch()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    }
`;
