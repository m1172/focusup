import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRootNavigationState } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useBrowserHostStore } from '../../store/browserHostStore';
import type { SocialAppId } from '../../types/app';
import { isCleanPlatform } from '../../types/social';
import { BrowserSession } from './BrowserSession';
import { msSinceLastTap, perfLogsEnabled } from '../../services/performance/tapTiming';
import { setSessionReplayPaused } from '../../services/analytics/productAnalytics';

/** A page hidden this long is dropped: it would otherwise keep its connections (and "active now" status) open. */
const KEEP_HIDDEN_MS = 10 * 60_000;
/** Routes presented as sheets over the browser; the page stays visible underneath them. */
const SHEETS_OVER_BROWSER = new Set(['temporary-access']);

type NavigationState = ReturnType<typeof useRootNavigationState>;
type VisibleBrowser = { appId: SocialAppId; url?: string; key: string };

type StackState = { index?: number; routes: { key: string; name: string; params?: object; state?: unknown }[] };

/** The app's root stack sits inside Expo Router's own `__root` navigator: follow focused routes down to it. */
function appStack(state: NavigationState | undefined): StackState | undefined {
  let current = state as StackState | undefined;
  for (let depth = 0; current?.routes?.length && depth < 4; depth += 1) {
    if (current.routes.some((route) => route.name === 'browser/[appId]' || route.name === '(tabs)')) return current;
    current = current.routes[current.index ?? current.routes.length - 1]?.state as StackState | undefined;
  }
  return undefined;
}

/** The browser whose `/browser/[appId]` route is on top of the app stack, if any. */
function visibleBrowser(state: NavigationState | undefined): VisibleBrowser | null {
  const stack = appStack(state);
  if (!stack) return null;
  for (let index = stack.index ?? stack.routes.length - 1; index >= 0; index -= 1) {
    const route = stack.routes[index];
    if (route.name === 'browser/[appId]') {
      const params = (route.params ?? {}) as { appId?: string; url?: string };
      return isCleanPlatform(params.appId) ? { appId: params.appId, url: params.url, key: route.key } : null;
    }
    if (!SHEETS_OVER_BROWSER.has(route.name)) return null;
  }
  return null;
}

/**
 * Keeps each social app's WebView alive above the root stack after its first open, so reopening shows the page
 * where the user left it instead of loading it again. `/browser/[appId]` stays the route (deep links, analytics,
 * back navigation); this layer shows the matching page while that route is on top and hides it otherwise.
 */
export function BrowserLayer() {
  const navigation = useRootNavigationState();
  const target = useMemo(() => visibleBrowser(navigation), [navigation]);
  const browsers = useBrowserHostStore((state) => state.browsers);
  const keep = useBrowserHostStore((state) => state.keep);
  const setHidden = useBrowserHostStore((state) => state.setHidden);
  const release = useBrowserHostStore((state) => state.release);
  const reducedMotion = useReducedMotion();
  const requestedAt = useRef(0);

  useEffect(() => {
    if (!target) return;
    requestedAt.current = Date.now();
    keep(target.appId, target.url);
    // Only a new route (or returning to it) asks for a browser; its params never change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.appId, target?.key, keep]);

  const browserOnScreen = Boolean(target);
  useEffect(() => setSessionReplayPaused(browserOnScreen), [browserOnScreen]);

  const kept = Object.keys(browsers) as SocialAppId[];
  useEffect(() => {
    kept.forEach((appId) => setHidden(appId, target?.appId !== appId));
  }, [kept.join(), target?.appId, setHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memory: hidden pages go first on a warning, and none stays hidden for long.
  useEffect(() => {
    const releaseHidden = (olderThan: number) => {
      const now = Date.now();
      const { browsers: current, release: drop } = useBrowserHostStore.getState();
      (Object.keys(current) as SocialAppId[]).forEach((appId) => {
        const hiddenSince = current[appId]?.hiddenSince;
        if (hiddenSince !== null && hiddenSince !== undefined && now - hiddenSince >= olderThan) drop(appId);
      });
    };
    const hiddenTimes = Object.values(browsers).map((browser) => browser?.hiddenSince).filter((time): time is number => typeof time === 'number');
    const timer = hiddenTimes.length ? setTimeout(() => releaseHidden(KEEP_HIDDEN_MS), Math.max(0, Math.min(...hiddenTimes) + KEEP_HIDDEN_MS - Date.now())) : undefined;
    // Timers do not run while the app is suspended, so check again when it returns.
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') releaseHidden(KEEP_HIDDEN_MS); });
    const memory = AppState.addEventListener('memoryWarning', () => releaseHidden(0));
    return () => { if (timer) clearTimeout(timer); appState.remove(); memory.remove(); };
  }, [browsers]);

  const onTerminated = useCallback((appId: SocialAppId) => release(appId), [release]);

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {kept.map((appId) => {
      const browser = browsers[appId]!;
      const visible = target?.appId === appId;
      return <KeptBrowser key={`${appId}:${browser.generation}`} appId={appId} visible={visible} reducedMotion={reducedMotion}
        initialUrl={browser.initialUrl} requestedUrl={visible ? target.url : undefined} requestKey={visible ? target.key : undefined}
        requestedAt={requestedAt} onTerminated={onTerminated} />;
    })}
  </View>;
}

function KeptBrowser({ appId, visible, reducedMotion, initialUrl, requestedUrl, requestKey, requestedAt, onTerminated }: {
  appId: SocialAppId; visible: boolean; reducedMotion: boolean; initialUrl?: string; requestedUrl?: string; requestKey?: string;
  requestedAt: { current: number }; onTerminated: (appId: SocialAppId) => void;
}) {
  // Same feel as the stack's fade_from_bottom, but quicker: the page is already there.
  const shown = useSharedValue(0);
  const firstShow = useRef(true);
  useEffect(() => {
    shown.value = reducedMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: visible ? 220 : 180, easing: Easing.out(Easing.cubic) });
    if (perfLogsEnabled && visible && !firstShow.current) {
      requestAnimationFrame(() => console.log(`[browser:${appId}] reopened: kept page on screen ${Date.now() - requestedAt.current} ms after the route, ${msSinceLastTap()} ms after the tap`));
    }
    if (visible) firstShow.current = false;
  }, [visible, reducedMotion, shown, appId, requestedAt]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 40 }] }));
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal={visible}
    accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[StyleSheet.absoluteFill, { zIndex: visible ? 1 : 0 }, style]}>
    <BrowserSession appId={appId} initialUrl={initialUrl} active={visible}
      requestedUrl={requestedUrl} requestKey={requestKey} onTerminated={onTerminated} />
  </Animated.View>;
}
