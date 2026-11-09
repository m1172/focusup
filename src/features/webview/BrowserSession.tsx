import { PRO_ENABLED } from '../../config/release';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { ProtectedScreen } from '../protection/ProtectedScreen';
import { FamilyBrowserBlocked, useFamilyBrowserAccess } from '../family/browserAccess';
import { useFamilyStore } from '../../store/familyStore';
import { familyDailyLimit } from '../../services/family/resolver';
import { Text } from '../../components/Typography';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, View } from 'react-native';
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
import { isCleanPlatform, type SocialWebViewEvent } from '../../types/social';
import { useDailyLimitReached } from '../protection/dailyLimit';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { BrowserFloatingMenu } from './BrowserFloatingMenu';
import { BrowserSessionBar } from './BrowserSessionBar';
import { BrowserLinkSheet } from './BrowserLinkSheet';
import { BrowserTopStrip, isDarkColor } from './BrowserTopStrip';
import { InstagramTabBar } from './InstagramTabBar';
import { InstagramAccountsSheet } from './InstagramAccountsSheet';
import { useInstagramAccountsStore } from '../../store/instagramAccountsStore';
import { addInstagramAccount, INSTAGRAM_HOME, INSTAGRAM_LOGIN, instagramAccountDetected, switchInstagramAccount } from '../../services/social-browser/instagramAccounts';

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

/**
 * One social app's browser. The root browser layer keeps it mounted between opens. On a supervised phone the page is
 * replaced (unmounted, so playback stops) whenever the family rules close this browser, e.g. at the start of bedtime.
 */
export const BrowserSession = memo(function BrowserSession(props: Props) {
  const access = useFamilyBrowserAccess(props.appId);
  if (access !== 'allowed') return <FamilyBrowserBlocked appId={props.appId} reason={access} />;
  return <BrowserPage {...props} />;
});

const BrowserPage = memo(function BrowserPage({ appId, initialUrl: rawInitialUrl, active, requestedUrl, requestKey, onTerminated }: Props) {
  const app = appCatalog[appId];
  const { t } = useTranslation();
  const c = useAppTheme();
  const webRef = useRef<CleanSocialWebViewHandle>(null);
  const [navigation, setNavigation] = useState<WebViewNavigation | null>(null);
  const [showProtection, setShowProtection] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [initialUrl] = useState(() => normalizeSocialBrowserLink(appId, rawInitialUrl ?? '') ?? socialBrowserHome[isCleanPlatform(appId) ? appId : 'instagram']);
  // The parent's limit (Vaqtim Family) and the personal one both count; the smaller wins.
  const familyLimit = useFamilyStore((state) => familyDailyLimit(appId, state.role === 'child' && state.supervision ? { policy: state.supervision.policy, birthDate: state.supervision.birthDate } : null));
  const limitReached = useDailyLimitReached(appId, familyLimit);
  const [menuExpanded, setMenuExpanded] = useState(false);
  /** Full screen hides the status bar and the session strip; the page itself always reaches the bottom edge. */
  const [fullScreen, setFullScreen] = useState(false);
  const [appearance, setAppearance] = useState(() => ({ backgroundColor: c.background, isStory: false }));
  /** Posts (Instagram) or videos (YouTube, TikTok) seen in this open, for the session strip. */
  const [seen, setSeen] = useState(0);
  /** Instagram shows its own bottom tab bar on this page. */
  const [instagramNav, setInstagramNav] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const lastVideo = useRef('');
  const avatar = useInstagramAccountsStore((state) => state.slots.find((slot) => slot.id === state.activeId)?.avatar ?? '');
  const username = useInstagramAccountsStore((state) => state.slots.find((slot) => slot.id === state.activeId)?.username ?? '');
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
  const setStatusBarStyle = useBrowserHostStore((state) => state.setStatusBarStyle);
  const statusBarStyle = isDarkColor(appearance.backgroundColor) ? 'light' : 'dark';
  const [, refresh] = useState(0);
  const effective = getEffectiveAppConfig(appId);
  const cleanModeEnabled = effective.enabled;
  const activeFilters = effective.filters;
  const showHomeCleanMessage = appId === 'youtube' && cleanModeEnabled && activeFilters.homeRecommendations && isHomeYouTubeUrl(navigation?.url ?? '');
  const chromeHidden = fullScreen && !showProtection && !linkSheetVisible;
  const showInstagramTabBar = appId === 'instagram' && currentRoute === 'inbox' && !instagramNav;

  // Schedules and strict mode change the effective blockers over time; a hidden page catches up when it is shown.
  useEffect(() => {
    if (!active) return undefined;
    void reconcileStrictModeState(); refresh((n) => n + 1);
    const interval = setInterval(() => { void reconcileStrictModeState(); refresh((n) => n + 1); }, 15_000);
    return () => clearInterval(interval);
  }, [active, schedules, strict, enabled, filters, remoteConfigRevision, sleepPlan, pro]);

  useEffect(() => () => setDiagnostics(appId, null), [appId, setDiagnostics]);

  useEffect(() => {
    if (active) { setOpenCount((n) => n + 1); setSeen(0); lastVideo.current = ''; webRef.current?.revalidate(); return; }
    // Leaving closes transient UI, like unmounting the old screen did.
    setShowProtection(false); setMenuExpanded(false); setLinkSheetVisible(false); setAccountsOpen(false);
  }, [active]);

  const handledRequest = useRef(requestKey);
  useEffect(() => {
    if (!active || !requestKey || handledRequest.current === requestKey) return;
    handledRequest.current = requestKey;
    if (requestedUrl) webRef.current?.navigate(requestedUrl);
  }, [active, requestKey, requestedUrl]);

  useEffect(() => { if (active) setStatusBarHidden(chromeHidden); }, [active, chromeHidden, setStatusBarHidden]);
  useEffect(() => { if (active) setStatusBarStyle(statusBarStyle); }, [active, statusBarStyle, setStatusBarStyle]);

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

  const manageAccountUrl = appId === 'instagram' ? 'https://www.instagram.com/accounts/edit/' : appId === 'tiktok' ? 'https://www.tiktok.com/setting' : 'https://m.youtube.com/account';
  const switchAccount = (id: string) => {
    setAccountsOpen(false);
    void switchInstagramAccount(id).then((switched) => {
      if (switched) webRef.current?.navigate(INSTAGRAM_HOME);
      else Alert.alert(t('browser.switchAccount'), t('browser.switchFailed'));
    }).catch(() => Alert.alert(t('browser.switchAccount'), t('browser.switchFailed')));
  };
  const addAccount = () => {
    setAccountsOpen(false);
    void addInstagramAccount().then((added) => { if (added) webRef.current?.navigate(INSTAGRAM_LOGIN); })
      .catch(() => Alert.alert(t('browser.switchAccount'), t('browser.switchFailed')));
  };
  const openAccount = () => {
    setMenuExpanded(false);
    if (appId === 'instagram') { setAccountsOpen(true); return; }
    Alert.alert(t('browser.accounts'), t('browser.accountBody', { name: app?.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('browser.manageAccount'), onPress: () => openWebsite(manageAccountUrl) },
    ]);
  };

  const handleEvent = (event: SocialWebViewEvent) => {
    if (event.type === 'POSTS_SEEN') { setSeen((count) => count + event.count); return; }
    if (event.type === 'ACCOUNT') { void instagramAccountDetected(event.username, event.avatar); return; }
    if (event.type === 'NAV_BAR') { setInstagramNav(event.visible); return; }
    if (event.type === 'OPEN_ACCOUNTS') { setMenuExpanded(false); setAccountsOpen(true); return; }
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
      if (event.platform === 'instagram' && (event.feature === 'reels' || event.feature === 'explore')) void trackBlockedNavigation('instagram', event.feature);
      if (event.platform === 'youtube' && event.feature === 'shorts') void trackBlockedNavigation('youtube', 'shorts');
      if (event.platform === 'tiktok') void trackBlockedNavigation('tiktok', event.feature);
    }
  };

  const handleNavigation = (value: WebViewNavigation) => {
    setNavigation(value);
    const route = getSocialBrowserRoute(appId, value.url);
    // Each different video page counts once; the URL is compared here and never stored.
    const video = route === 'watch' && appId !== 'instagram' ? value.url.split('#')[0] ?? '' : '';
    if (video && video !== lastVideo.current) setSeen((count) => count + 1);
    lastVideo.current = video || lastVideo.current;
    setCurrentRoute(route);
    const current = useAppStore.getState().webViewDiagnostics[appId];
    if (current) setDiagnostics(appId, { ...current, currentUrl: safePath(appId, value.url) });
  };

  if (!app?.supported) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><Text style={{ color: c.text, padding: 24 }}>{t('unavailable')}</Text></SafeAreaView>;
  if (limitReached) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{t('ui.limitReached')}</Text>
    <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{t(familyLimit ? 'family.limitReachedBody' : 'ui.dailyLimitsBody')}</Text>
    <Pressable accessibilityRole="button" onPress={leaveBrowser} style={{ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 22, backgroundColor: c.soft }}>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>{t('browser.leave')}</Text>
    </Pressable>
  </SafeAreaView>;

  return <View style={{ flex: 1, backgroundColor: c.background }}>
    {Platform.OS !== 'ios' && active ? <StatusBar hidden={chromeHidden} style={statusBarStyle} animated /> : null}
    <SafeAreaView edges={[]}
      accessibilityElementsHidden={showProtection} importantForAccessibility={showProtection ? 'no-hide-descendants' : 'auto'}
      style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1 }}>
        {!fullScreen && !appearance.isStory ? <BrowserTopStrip key={`strip-${openCount}`} active={active && pageReady && !showProtection && !linkSheetVisible}
          background={appearance.backgroundColor} count={seen} unit={appId === 'instagram' ? 'posts' : 'videos'} /> : null}
        <BrowserSessionBar key={openCount} active={active && pageReady && !showProtection && !linkSheetVisible}
          visible={PRO_ENABLED && !fullScreen && appId === 'instagram' && pageReady && currentRoute === 'feed'}
          ads={contentCounts.ads} suggested={contentCounts.suggested}
          filtered={cleanModeEnabled && Boolean(activeFilters.sponsoredPosts) && (Boolean(activeFilters.suggestedPosts) || !pro)}
          onBlock={blockDetectedContent} onLeave={leaveBrowser} />
        {!fullScreen && showHomeCleanMessage ? <View style={{ backgroundColor: c.primarySoft, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{t('youtubeHomeCleanMessage')}</Text>
        </View> : null}
        <CleanSocialWebView ref={webRef} platform={appId} initialUrl={initialUrl}
          fullScreen coverTop={fullScreen || appearance.isStory} onAppearanceChange={setAppearance} active={active}
          padBottom={Platform.OS === 'android' && !showInstagramTabBar}
          blockerConfig={activeFilters} enabled={effective.blocking}
          onNavigationChange={handleNavigation} onEvent={handleEvent}
          onSettings={openSettings} onPageReadyChange={setPageReady}
          onContentProcessGone={active ? undefined : () => onTerminated(appId)} />
        {showInstagramTabBar ? <InstagramTabBar background={appearance.backgroundColor} avatar={avatar}
          onHome={() => openWebsite(INSTAGRAM_HOME)} onSearch={() => openWebsite('https://www.instagram.com/explore/')}
          onProfile={() => openWebsite(username ? `https://www.instagram.com/${username}/` : 'https://www.instagram.com/accounts/edit/')} /> : null}
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
    {appId === 'instagram' ? <InstagramAccountsSheet visible={accountsOpen} onClose={() => setAccountsOpen(false)}
      onSwitch={switchAccount} onAdd={addAccount} onManage={() => openWebsite(manageAccountUrl)} /> : null}
    <BrowserLinkSheet appId={appId} name={app.name} visible={linkSheetVisible}
      onClose={() => setLinkSheetVisible(false)} onOpen={openWebsite} />
    {showProtection ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.background }}>
      <ProtectedScreen appId={appId} onReturn={() => setShowProtection(false)} />
    </View> : null}
  </View>;
});
