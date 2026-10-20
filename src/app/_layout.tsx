import { PRO_ENABLED } from '../config/release';
import { useAccountStore } from '../store/accountStore';
import { useLaunchReadiness } from '../hooks/useLaunchReadiness';
import { canEnterApp } from '../services/backend/accessPolicy';
import 'react-native-gesture-handler';
import { isBackendConfigured, refreshAccountSession } from '../services/backend/accountSession';
import i18n from '../i18n';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { router, Stack, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenStatusBar } from '../components/ScreenStatusBar';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppTheme } from '../theme';
import { initializeLocalAnalytics } from '../services/analytics/localAnalytics';
import { restoreInterruptedSession } from '../services/analytics/sessionTracker';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useAppStore } from '../store/appStore';
import { reconcileStrictModeState } from '../services/strict-mode/strictModeController';
import { initializeRemoteBlockerConfig, refreshRemoteBlockerConfig } from '../services/remote-config/remoteBlockerConfig';
import { initializeNotificationHandler } from '../services/notifications/notificationService';
import { reconcileProtection } from '../services/protection/controller';
import { useWellbeingStore } from '../store/wellbeingStore';
import { isClearingFocusUpData } from '../services/privacy/clearFocusUpData';
import { useNativeAppHandoff } from '../hooks/useNativeAppHandoff';
import { AnalyticsObserver } from '../components/AnalyticsObserver';
import { startSettingsSync } from '../services/backend/settingsSyncRuntime';
import { BrowserLayer } from '../features/webview/BrowserLayer';
import { perfLogsEnabled, recordTap, startMainThreadSampler } from '../services/performance/tapTiming';
if (perfLogsEnabled) startMainThreadSampler(); // TEMP-PERF-SAMPLER
import { captureProductEvent, flushProductAnalytics, initializeProductAnalytics, setProductAnalyticsIdentity } from '../services/analytics/productAnalytics';

export { AppErrorBoundary as ErrorBoundary } from '../components/AppErrorBoundary';

// Keep navigation-state observation outside the component that creates Protected groups.
// Navigation updates must not recreate their guard maps and trigger a prune/render loop.
function NativeHandoff({ enabled }: { enabled: boolean }) {
  const navigation = useRootNavigationState();
  useNativeAppHandoff(enabled && Boolean(navigation?.key));
  return null;
}

export default function RootLayout() {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const hydrated = useLaunchReadiness();
  const account = useAccountStore();
  const completed = useAppStore((state) => state.onboardingCompleted);
  const appAllowed = canEnterApp(account, completed, hydrated, isBackendConfigured());

  const language = useAppStore((state) => state.selectedLanguage);
  // Apply the saved language on every entry point (cold start, deep link, notification), not only the splash.
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
    if (account.ready) setProductAnalyticsIdentity(account.user?.id ?? null, language);
  }, [language, account.user?.id, account.ready]);
  const [fontsLoaded, fontError] = useFonts({
    'Manrope-400': require('../../assets/fonts/Manrope-400.ttf'),
    'Manrope-500': require('../../assets/fonts/Manrope-500.ttf'),
    'Manrope-600': require('../../assets/fonts/Manrope-600.ttf'),
    'Manrope-700': require('../../assets/fonts/Manrope-700.ttf'),
    'Manrope-800': require('../../assets/fonts/Manrope-800.ttf'),
  });
  useEffect(() => {
    void initializeLocalAnalytics().then(() => restoreInterruptedSession());
    const stopSettingsSync = startSettingsSync();
    initializeNotificationHandler();
    void refreshAccountSession().then(() => initializeProductAnalytics());
    if (PRO_ENABLED) void useSubscriptionStore.getState().initialize();
    void initializeRemoteBlockerConfig();
    const reconcileNative = () => { if (!isClearingFocusUpData() && useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated()) void reconcileProtection().catch(() => { if (__DEV__) console.warn('[FocusUp Protection] Native plan could not be applied'); }); };
    const nativeHydration = useWellbeingStore.persist.onFinishHydration(reconcileNative);
    const appNativeHydration = useAppStore.persist.onFinishHydration(reconcileNative);
    const appChanges = useAppStore.subscribe((state, previous) => {
      reconcileNative();
      if (!useAppStore.persist.hasHydrated() || isClearingFocusUpData()) return;
      if (state.onboardingCompleted && !previous.onboardingCompleted) captureProductEvent('onboarding_completed');
      for (const appId of ['instagram', 'youtube'] as const) {
        if (state.apps[appId].enabled !== previous.apps[appId].enabled) captureProductEvent('app_protection_changed', { social_platform: appId, enabled: state.apps[appId].enabled });
        for (const [feature, enabled] of Object.entries(state.apps[appId].filters)) {
          if (enabled !== previous.apps[appId].filters[feature]) captureProductEvent('filter_changed', { social_platform: appId, feature, enabled });
        }
      }
    });
    const wellbeingChanges = useWellbeingStore.subscribe(reconcileNative);
    const entitlementChanges = useSubscriptionStore.subscribe(reconcileNative);
    reconcileNative();
    const stopHydrationListener = useAppStore.persist.onFinishHydration(() => { void reconcileStrictModeState(); });
    if (useAppStore.persist.hasHydrated()) void reconcileStrictModeState();
    const reconcileTimer = PRO_ENABLED ? setInterval(() => { if (!isClearingFocusUpData()) { void reconcileStrictModeState(); reconcileNative(); } }, 15_000) : undefined;
    const appStateListener = AppState.addEventListener('change', (state) => { if (state !== 'active') flushProductAnalytics(); if (state === 'active' && !isClearingFocusUpData()) { void reconcileStrictModeState(); void refreshRemoteBlockerConfig(); void refreshAccountSession(); if (PRO_ENABLED) void useSubscriptionStore.getState().refresh(); reconcileNative(); } });
    const notificationListener = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!PRO_ENABLED || !useAccountStore.getState().user || useAccountStore.getState().recoveryRequired) return;
      const data = response.notification.request.content.data;
      if (data?.kind === 'strict-mode-end' || data?.kind === 'wellbeing') captureProductEvent('notification_opened', { kind: data.kind, source: 'notification' });
      if (data?.kind === 'strict-mode-end') router.push('/strict-mode');
      if (data?.kind === 'wellbeing') router.push('/(tabs)/focus');
    });
    return () => { stopSettingsSync(); nativeHydration(); appNativeHydration(); appChanges(); wellbeingChanges(); entitlementChanges(); stopHydrationListener(); clearInterval(reconcileTimer); appStateListener.remove(); notificationListener.remove(); };
  }, []);
  if ((!fontsLoaded && !fontError) || !hydrated || !account.ready) return <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel={i18n.t('cloudAuth.loading')} /></View>;
  return <SafeAreaProvider><View style={{ flex: 1 }} onTouchEnd={perfLogsEnabled ? recordTap : undefined}><AnalyticsObserver /><NativeHandoff enabled={appAllowed && PRO_ENABLED} /><ScreenStatusBar /><Stack screenOptions={{ headerShown: false, statusBarStyle: c.isDark ? 'light' : 'dark', statusBarHidden: false, contentStyle: { backgroundColor: c.background }, animation: reducedMotion ? 'none' : 'fade_from_bottom', animationDuration: 280 }}>
    <Stack.Screen name="index" /><Stack.Screen name="start" />
    <Stack.Protected guard={!completed} redirectTo="/start">
      <Stack.Screen name="onboarding/index" /><Stack.Screen name="onboarding/your-time" /><Stack.Screen name="onboarding/reveal" /><Stack.Screen name="onboarding/reclaim" /><Stack.Screen name="onboarding/how-it-works" /><Stack.Screen name="onboarding/choose-apps" /><Stack.Screen name="onboarding/account" />
    </Stack.Protected>
    <Stack.Protected guard={!appAllowed && !account.recoveryRequired} redirectTo="/start">
      <Stack.Screen name="auth/sign-in" /><Stack.Screen name="auth/sign-up" />
    </Stack.Protected>
    <Stack.Screen name="auth/callback" />
    <Stack.Screen name="privacy" /><Stack.Screen name="help" /><Stack.Screen name="capabilities" />
    <Stack.Protected guard={Boolean(account.user) && isBackendConfigured()} redirectTo="/start">
      <Stack.Screen name="account" />
    </Stack.Protected>
    <Stack.Protected guard={appAllowed} redirectTo="/start">
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="app-settings/[appId]" />
      {/* The page is drawn by BrowserLayer above the stack, so this route must not be a native modal, which would cover it. */}
      <Stack.Screen name="browser/[appId]" options={{ animation: 'fade', animationDuration: 120, statusBarHidden: true }} />
      <Stack.Screen name="permissions" /><Stack.Screen name="language" /><Stack.Screen name="theme" />
      <Stack.Protected guard={PRO_ENABLED} redirectTo="/(tabs)">
        <Stack.Screen name="temporary-access" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.65, 1], sheetGrabberVisible: false }} />
        <Stack.Screen name="strict-mode" /><Stack.Screen name="schedule" /><Stack.Screen name="sleep" /><Stack.Screen name="protection" /><Stack.Screen name="native-app/[appId]" /><Stack.Screen name="pro" />
      </Stack.Protected>
    </Stack.Protected>
  </Stack>{appAllowed ? <BrowserLayer /> : null}</View></SafeAreaProvider>;
}
