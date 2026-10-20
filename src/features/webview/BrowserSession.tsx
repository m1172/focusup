import { PRO_ENABLED } from '../../config/release';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { ProtectedScreen } from '../protection/ProtectedScreen';
import { Text } from '../../components/Typography';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import type { WebViewNavigation } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { appCatalog } from '../apps/catalog';
import { CleanSocialWebView, type CleanSocialWebViewHandle } from './CleanSocialWebView';
import { getEffectiveAppConfig } from '../../services/blockers/effective';
import { isPlatformLocked, reconcileStrictModeState } from '../../services/strict-mode/strictModeController';
import { useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';
import { isHomeYouTubeUrl } from '../../services/blockers/youtube';
import { getSocialBrowserRoute, normalizeSocialBrowserLink, socialBrowserHome } from '../../services/social-browser/navigation';
import { startSession, endSession } from '../../services/analytics/sessionTracker';
import { trackBlockedNavigation } from '../../services/analytics/localAnalytics';
import { useAppStore } from '../../store/appStore';
import { useBrowserHostStore } from '../../store/browserHostStore';
import { useAppTheme } from '../../theme';
import type { SocialAppId } from '../../types/app';
import type { SocialWebViewEvent } from '../../types/social';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { BrowserFloatingMenu } from './BrowserFloatingMenu';
import { BrowserSessionBar } from './BrowserSessionBar';
import { BrowserLinkSheet } from './BrowserLinkSheet';

function safePath(platform: SocialAppId, url?: string) {
  if (!url) return '';
  return getSocialBrowserRoute(platform, url);
}

type Props = {
  appId: SocialAppId;
  initialUrl?: string;
  /** On screen and focused. A hidden session keeps its page but tracks no time and plays nothing. */
  active: boolean;
  /** A link a newer `/browser/[appId]` route asked for; `requestKey` changes once per route. */
  requestedUrl?: string;
  requestKey?: string;
  /** The page's web process died while hidden: the layer drops it and mounts a fresh one on the next open. */
  onTerminated: (appId: SocialAppId) => void;
};

/** One social app's browser. The root browser layer keeps it mounted between opens. */
export const BrowserSession = memo(function BrowserSession({ appId, initialUrl: rawInitialUrl, active, requestedUrl, requestKey, onTerminated }: Props) {
  const app = appCatalog[appId];
  const { t } = useTranslation();
  const c = useAppTheme();
  const webRef = useRef<CleanSocialWebViewHandle>(null);
  const [navigation, setNavigation] = useState<WebViewNavigation | null>(null);
  const [showProtection, setShowProtection] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [initialUrl] = useState(() => normalizeSocialBrowserLink(appId, rawInitialUrl ?? '') ?? socialBrowserHome[appId === 'youtube' ? 'youtube' : 'instagram']);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [fullScreen, setFullScreen] = useState(true);
  const [linkSheetVisible, setLinkSheetVisible] = useState(false);
  const [contentCounts, setContentCounts] = useState({ ads: 0, suggested: 0 });
  const [currentRoute, setCurrentRoute] = useState(() => safePath(appId, initialUrl) || 'feed');
  /** Each open gets its own session-bar clock, as when every open mounted a new screen. */
  const [openCount, setOpenCount] = useState(0);
  const filters = useAppStore((state) => state.apps[appId]?.filters ?? {});
  const enabled = useAppStore((state) => state.apps[appId]?.enabled ?? false);
  const schedules = useAppStore((state) => state.schedules);
  const strict = useAppStore((state) => state.strictSession);
  const remoteConfigRevision = useRemoteBlockerConfigStore((state) => state.revision);
  const sleepPlan = useWellbeingStore((state) => state.sleep);
  const pro = useSubscriptionStore((state) => state.isPro);
  const setDiagnostics = useAppStore((state) => state.setWebViewDiagnostics);
  const setStatusBarHidden = useBrowserHostStore((state) => state.setStatusBarHidden);
  const [, refresh] = useState(0);
  const effective = getEffectiveAppConfig(appId);
  const cleanModeEnabled = effective.enabled;
  const activeFilters = effective.filters;
  const showHomeCleanMessage = appId === 'youtube' && cleanModeEnabled && activeFilters.homeRecommendations && isHomeYouTubeUrl(navigation?.url ?? '');
  const chromeHidden = fullScreen && !showProtection && !linkSheetVisible;

  // Schedules and strict mode change the effective blockers over time; a hidden page catches up when it is shown.
  useEffect(() => {
    if (!active) return undefined;
    void reconcileStrictModeState(); refresh((n) => n + 1);
    const interval = setInterval(() => { void reconcileStrictModeState(); refresh((n) => n + 1); }, 15_000);
    return () => clearInterval(interval);
  }, [active, schedules, strict, enabled, filters, remoteConfigRevision, sleepPlan, pro]);

  useEffect(() => () => setDiagnostics(appId, null), [appId, setDiagnostics]);

  useEffect(() => {
    if (active) { setOpenCount((n) => n + 1); webRef.current?.revalidate(); return; }
    // Leaving closes transient UI, like unmounting the old screen did.
    setShowProtection(false); setMenuExpanded(false); setLinkSheetVisible(false);
  }, [active]);

  const handledRequest = useRef(requestKey);
  useEffect(() => {
    if (!active || !requestKey || handledRequest.current === requestKey) return;
    handledRequest.current = requestKey;
    if (requestedUrl) webRef.current?.navigate(requestedUrl);
  }, [active, requestKey, requestedUrl]);

  useEffect(() => { if (active) setStatusBarHidden(chromeHidden); }, [active, chromeHidden, setStatusBarHidden]);

  useEffect(() => {
    if (active && cleanModeEnabled && pageReady && !showProtection && !linkSheetVisible) void startSession(appId, true);
    else void endSession(appId);
  }, [appId, active, cleanModeEnabled, pageReady, showProtection, linkSheetVisible]);
  useEffect(() => () => { void endSession(appId); }, [appId]);

  const openSettings = useCallback(() => router.push({ pathname: '/app-settings/[appId]', params: { appId, returnToBrowser: '1' } }), [appId]);
  const leaveBrowser = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }, []);
  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return undefined;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showProtection) setShowProtection(false);
      else if (menuExpanded) setMenuExpanded(false);
      else if (navigation?.canGoBack) webRef.current?.goBack(); else leaveBrowser();
      return true;
    });
    return () => listener.remove();
  }, [active, navigation?.canGoBack, leaveBrowser, showProtection, menuExpanded]);

  const openWebsite = (url: string) => {
    webRef.current?.navigate(url);
    setMenuExpanded(false);
  };

  const blockDetectedContent = () => {
    if (!PRO_ENABLED) return;
    if (!canUseFeature(pro, 'instagramCleanBrowsing')) { router.push({ pathname: '/pro', params: { source: 'instagram_clean_browsing' } }); return; }
    if (isPlatformLocked(appId) || (cleanModeEnabled && activeFilters.sponsoredPosts && activeFilters.suggestedPosts)) { openSettings(); return; }
    useAppStore.getState().setAppEnabled(appId, true);
    useAppStore.getState().setFilter(appId, 'sponsoredPosts', true);
    useAppStore.getState().setFilter(appId, 'suggestedPosts', true);
  };

  const openAccount = () => {
    setMenuExpanded(false);
    Alert.alert(t('browser.accounts'), t('browser.accountBody', { name: app?.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('browser.manageAccount'), onPress: () => openWebsite(appId === 'instagram' ? 'https://www.instagram.com/accounts/edit/' : 'https://m.youtube.com/account') },
    ]);
  };

  const handleEvent = (event: SocialWebViewEvent) => {
    if (event.type === 'CONTENT_DETECTED') {
      setContentCounts((counts) => ({ ...counts, [event.feature === 'sponsoredPosts' ? 'ads' : 'suggested']: counts[event.feature === 'sponsoredPosts' ? 'ads' : 'suggested'] + event.count }));
      return;
    }
    const current = useAppStore.getState().webViewDiagnostics[appId];
    const base = current ?? { currentUrl: safePath(appId, navigation?.url), cleanMode: cleanModeEnabled, injectedScriptActive: false, observerActive: false, lastInjectionAt: '', blockerConfig: activeFilters };
    if (event.type === 'READY') {
      setDiagnostics(appId, {
        ...base,
        currentUrl: base.currentUrl || safePath(appId, navigation?.url),
        cleanMode: cleanModeEnabled,
        injectedScriptActive: true,
        observerActive: event.observerActive,
        lastInjectionAt: new Date().toLocaleTimeString(),
        blockerConfig: activeFilters,
      });
    } else if (event.type === 'FILTER_APPLIED') {
      setDiagnostics(appId, { ...base, lastFilterPassAt: new Date().toLocaleTimeString(), filterCounts: { ...base.filterCounts, [event.feature]: (base.filterCounts?.[event.feature] ?? 0) + event.count } });
    } else if (event.type === 'URL_CHANGED') {
      setCurrentRoute(event.route);
      setDiagnostics(appId, { ...base, currentUrl: event.route, cleanMode: cleanModeEnabled, blockerConfig: activeFilters });
    } else if (event.type === 'BLOCKED_NAVIGATION') {
      setShowProtection(true);
      setDiagnostics(appId, { ...base, lastFilterPassAt: new Date().toLocaleTimeString() });
      if (event.platform === 'instagram' && event.feature === 'reels') void trackBlockedNavigation('instagram', 'reels');
      if (event.platform === 'youtube' && event.feature === 'shorts') void trackBlockedNavigation('youtube', 'shorts');
    }
  };

  const handleNavigation = (value: WebViewNavigation) => {
    setNavigation(value);
    setCurrentRoute(getSocialBrowserRoute(appId, value.url));
    const current = useAppStore.getState().webViewDiagnostics[appId];
    if (current) setDiagnostics(appId, { ...current, currentUrl: safePath(appId, value.url) });
  };

  if (!app?.supported) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><Text style={{ color: c.text, padding: 24 }}>{t('unavailable')}</Text></SafeAreaView>;

  return <View style={{ flex: 1, backgroundColor: c.background }}>
    {Platform.OS !== 'ios' && active ? <StatusBar hidden={chromeHidden} style={c.isDark ? 'light' : 'dark'} animated /> : null}
    <SafeAreaView edges={fullScreen ? [] : ['top', 'left', 'right']}
      accessibilityElementsHidden={showProtection} importantForAccessibility={showProtection ? 'no-hide-descendants' : 'auto'}
      style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1 }}>
        <BrowserSessionBar key={openCount} active={active && pageReady && !showProtection && !linkSheetVisible}
          visible={PRO_ENABLED && !fullScreen && appId === 'instagram' && pageReady && currentRoute === 'feed'}
          ads={contentCounts.ads} suggested={contentCounts.suggested}
          filtered={cleanModeEnabled && Boolean(activeFilters.sponsoredPosts) && (Boolean(activeFilters.suggestedPosts) || !pro)}
          onBlock={blockDetectedContent} onLeave={leaveBrowser} />
        {!fullScreen && showHomeCleanMessage ? <View style={{ backgroundColor: c.primarySoft, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{t('youtubeHomeCleanMessage')}</Text>
        </View> : null}
        <CleanSocialWebView ref={webRef} platform={appId} initialUrl={initialUrl}
          fullScreen={fullScreen} active={active}
          blockerConfig={activeFilters} enabled={cleanModeEnabled}
          onNavigationChange={handleNavigation} onEvent={handleEvent}
          onSettings={openSettings} onPageReadyChange={setPageReady}
          onContentProcessGone={active ? undefined : () => onTerminated(appId)} />
        <BrowserFloatingMenu expanded={menuExpanded}
          fullScreen={fullScreen} onToggleFullScreen={() => { setFullScreen((value) => !value); setMenuExpanded(false); }}
          canGoBack={Boolean(navigation?.canGoBack)} canGoForward={Boolean(navigation?.canGoForward)}
          onToggle={() => setMenuExpanded((value) => !value)}
          onBack={() => { setMenuExpanded(false); if (navigation?.canGoBack) webRef.current?.goBack(); else leaveBrowser(); }}
          onHome={() => { setMenuExpanded(false); router.dismissTo('/(tabs)'); }} onReload={() => { setMenuExpanded(false); webRef.current?.reload(); }}
          onForward={() => { setMenuExpanded(false); webRef.current?.goForward(); }}
          onAccount={openAccount} onLink={() => { setMenuExpanded(false); setLinkSheetVisible(true); }}
          onSettings={() => { setMenuExpanded(false); openSettings(); }} />
      </View>
    </SafeAreaView>
    <BrowserLinkSheet appId={appId} name={app.name} visible={linkSheetVisible}
      onClose={() => setLinkSheetVisible(false)} onOpen={openWebsite} />
    {showProtection ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.background }}>
      <ProtectedScreen appId={appId} onReturn={() => setShowProtection(false)} />
    </View> : null}
  </View>;
});
