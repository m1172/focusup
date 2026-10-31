/**
 * No Reel scrolling anywhere: a Reel opened from DMs, the feed, a profile, Explore or a link plays,
 * but swiping to the next one is stopped. Covers individual Reel pages and any viewport-sized,
 * vertically snapping video list (Instagram's Reels viewer), including overlays that keep the URL.
 */
export const instagramDmReelSwipeScript = String.raw`
    var isIndividualReelPath = function(path) { return /^\/(?:[^/]+\/)?(?:reel|reels)\/[^/]+\/?$/i.test(path); };
    var dmReelLockAttribute = 'data-focusup-dm-reel-lock';
    root.dmReelSwipeGuardEnabled = Boolean(CONFIG.enabled && CONFIG.reels);
    if (!root.dmReelScrollLocks) root.dmReelScrollLocks = new Map();
    // Kept for the navigation listener; the lock no longer depends on where the Reel was opened from.
    root.updateDmReelSwipeState = function() {};
    root.isDmReelContext = function() { return Boolean(root.dmReelSwipeGuardEnabled) && !root.authenticationPage; };
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
      // Reels viewers are viewport-sized, vertically snapping lists of videos.
      // The Home feed, DM threads and inline attachments are ordinary, non-snapping scrollers.
      document.querySelectorAll('video').forEach(function(video) {
        // Only on-screen videos can be a Reel being watched; skipping the rest keeps feed scrolling cheap.
        var box = video.getBoundingClientRect();
        if (box.bottom <= 0 || box.top >= viewportHeight || box.height === 0) return;
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
    // Measuring videos forces a layout. Feed videos change the page every frame, so the check runs at most every
    // 250 ms; a swipe still checks immediately on touchstart before it can move to the next Reel.
    root.scheduleDmReelScrollLocks = function() {
      if (root.dmReelLockScheduled) return;
      root.dmReelLockScheduled = true;
      var run = function() { root.dmReelLockScheduled = false; root.dmReelLockSyncedAt = Date.now(); root.syncDmReelScrollLocks(); };
      var wait = 250 - (Date.now() - (root.dmReelLockSyncedAt || 0));
      if (wait <= 0) requestAnimationFrame(run); else setTimeout(function() { requestAnimationFrame(run); }, wait);
    };
    root.isDmReelGestureTarget = function(target) {
      if (!root.isDmReelContext()) return false;
      var element = target && (target.nodeType === 1 ? target : target.parentElement);
      if (!element || !element.closest) return false;
      // Comment sheets and text fields on a Reel page still scroll and type normally.
      if (isIndividualReelPath(location.pathname)) return !element.closest('[role="dialog"], textarea, input, [contenteditable="true"]');
      return Boolean(element.closest('[' + dmReelLockAttribute + ']'));
    };
    root.scheduleDmReelScrollLocks();
    if (!root.dmReelOverlayListenerInstalled) {
      root.dmReelOverlayListenerInstalled = true;
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
