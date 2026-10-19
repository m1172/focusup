/** Lock the video list inside Instagram's DM Reel overlay, including viewers that keep the DM URL. */
export const instagramDmReelSwipeScript = String.raw`
    var isIndividualReelPath = function(path) { return /^\/(?:[^/]+\/)?(?:reel|reels)\/[^/]+\/?$/i.test(path); };
    var isDirectPath = function(path) { return /^\/direct(?:\/|$)/i.test(path); };
    var dmReelSwipeStorageKey = 'focusup-instagram-dm-reel-swipe';
    var dmReelLockAttribute = 'data-focusup-dm-reel-lock';
    root.dmReelSwipeGuardEnabled = Boolean(CONFIG.enabled && CONFIG.reels);
    if (!root.dmReelScrollLocks) root.dmReelScrollLocks = new Map();
    root.updateDmReelSwipeState = function(path) {
      var previousPath = root.dmReelPreviousPath;
      root.dmReelPreviousPath = path;
      if (isIndividualReelPath(path)) {
        if (isDirectPath(previousPath || '')) root.dmReelSwipeActive = true;
        if (!root.dmReelSwipeActive) {
          try { root.dmReelSwipeActive = sessionStorage.getItem(dmReelSwipeStorageKey) === '1'; } catch (_) { root.dmReelSwipeActive = false; }
        }
      } else root.dmReelSwipeActive = false;
      try { sessionStorage.removeItem(dmReelSwipeStorageKey); } catch (_) {}
    };
    root.updateDmReelSwipeState(location.pathname);
    root.isDmReelContext = function() {
      return root.dmReelSwipeGuardEnabled && (isDirectPath(location.pathname) || (root.dmReelSwipeActive && isIndividualReelPath(location.pathname)));
    };
    root.syncDmReelScrollLocks = function() {
      var inContext = root.isDmReelContext();
      var viewportHeight = window.innerHeight, viewportWidth = window.innerWidth;
      var isViewerSized = function(node) {
        var rect = node.getBoundingClientRect();
        return rect.height >= viewportHeight * 0.6 && rect.width >= viewportWidth * 0.65 && rect.bottom > 0 && rect.top < viewportHeight;
      };
      root.dmReelScrollLocks.forEach(function(_, node) {
        if (!inContext || !node.isConnected || !isViewerSized(node)) {
          node.removeAttribute(dmReelLockAttribute);
          root.dmReelScrollLocks.delete(node);
        }
      });
      if (!inContext) return;
      // Shared Reels use a viewport-sized, vertically snapping list inside /direct/t/.
      // The conversation and inline attachments are ordinary, non-snapping scrollers.
      document.querySelectorAll('video').forEach(function(video) {
        for (var node = video.parentElement; node && node !== document.body; node = node.parentElement) {
          if (root.dmReelScrollLocks.has(node)) break;
          var style = getComputedStyle(node);
          if (/^(?:y|both|block)(?:\s|$)/.test(style.scrollSnapType) && /^(?:auto|scroll)$/.test(style.overflowY) && isViewerSized(node)) {
            root.dmReelScrollLocks.set(node, { top: node.scrollTop });
            node.setAttribute(dmReelLockAttribute, '');
            break;
          }
        }
      });
    };
    root.scheduleDmReelScrollLocks = function() {
      if (root.dmReelLockScheduled) return;
      root.dmReelLockScheduled = true;
      requestAnimationFrame(function() { root.dmReelLockScheduled = false; root.syncDmReelScrollLocks(); });
    };
    root.isDmReelGestureTarget = function(target) {
      if (!root.isDmReelContext()) return false;
      if (root.dmReelSwipeActive && isIndividualReelPath(location.pathname)) return true;
      return Boolean(target && target.closest && target.closest('[' + dmReelLockAttribute + ']'));
    };
    root.scheduleDmReelScrollLocks();
    if (!root.dmReelOverlayListenerInstalled) {
      root.dmReelOverlayListenerInstalled = true;
      document.addEventListener('click', function(event) {
        if (!isDirectPath(location.pathname)) return;
        var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
        var link = target && target.closest('a[href]');
        if (!link) return;
        try {
          var destination = new URL(link.href, location.origin);
          if (destination.origin === location.origin && isIndividualReelPath(destination.pathname)) sessionStorage.setItem(dmReelSwipeStorageKey, '1');
        } catch (_) {}
      }, true);
      var touchStart = null;
      document.addEventListener('touchstart', function(event) {
        root.syncDmReelScrollLocks();
        if (!root.isDmReelGestureTarget(event.target) || event.touches.length !== 1) { touchStart = null; return; }
        touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, vertical: false };
      }, { capture: true, passive: true });
      document.addEventListener('touchmove', function(event) {
        if (!touchStart || !root.isDmReelGestureTarget(event.target) || event.touches.length !== 1) return;
        var deltaX = event.touches[0].clientX - touchStart.x;
        var deltaY = event.touches[0].clientY - touchStart.y;
        if (Math.abs(deltaY) > 6 && Math.abs(deltaY) > Math.abs(deltaX)) touchStart.vertical = true;
        if (!touchStart.vertical) return;
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true, passive: false });
      document.addEventListener('touchend', function(event) {
        if (touchStart && touchStart.vertical && root.isDmReelGestureTarget(event.target)) {
          if (event.cancelable) event.preventDefault();
          event.stopImmediatePropagation();
        }
        touchStart = null;
      }, { capture: true, passive: false });
      document.addEventListener('touchcancel', function() { touchStart = null; }, { capture: true, passive: true });
      document.addEventListener('wheel', function(event) {
        root.syncDmReelScrollLocks();
        if (!root.isDmReelGestureTarget(event.target) || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true, passive: false });
      document.addEventListener('scroll', function(event) {
        var lock = root.dmReelScrollLocks.get(event.target);
        if (lock && root.isDmReelContext() && event.target.scrollTop !== lock.top) event.target.scrollTop = lock.top;
      }, true);
    }
`;
