import 'react-native-gesture-handler';
import { accountSession } from '../services/backend/accountSession';
import i18n from '../i18n';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { AppState } from 'react-native';
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

export default function RootLayout() {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const navigation = useRootNavigationState();
  useNativeAppHandoff(Boolean(navigation?.key));
  const language = useAppStore((state) => state.selectedLanguage);
  // Apply the saved language on every entry point (cold start, deep link, notification), not only the splash.
  useEffect(() => { if (i18n.language !== language) void i18n.changeLanguage(language); }, [language]);
  const [fontsLoaded, fontError] = useFonts({
    'Manrope-400': require('../../assets/fonts/Manrope-400.ttf'),
    'Manrope-500': require('../../assets/fonts/Manrope-500.ttf'),
    'Manrope-600': require('../../assets/fonts/Manrope-600.ttf'),
    'Manrope-700': require('../../assets/fonts/Manrope-700.ttf'),
    'Manrope-800': require('../../assets/fonts/Manrope-800.ttf'),
  });
  useEffect(() => {
    void initializeLocalAnalytics().then(() => restoreInterruptedSession());
    initializeNotificationHandler();
    void accountSession.initialize().catch(() => undefined);
    void useSubscriptionStore.getState().initialize();
    void initializeRemoteBlockerConfig();
    const reconcileNative = () => { if (!isClearingFocusUpData() && useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated()) void reconcileProtection().catch(() => { if (__DEV__) console.warn('[FocusUp Protection] Native plan could not be applied'); }); };
    const nativeHydration = useWellbeingStore.persist.onFinishHydration(reconcileNative);
    const appNativeHydration = useAppStore.persist.onFinishHydration(reconcileNative);
    const appChanges = useAppStore.subscribe(reconcileNative);
    const wellbeingChanges = useWellbeingStore.subscribe(reconcileNative);
    const entitlementChanges = useSubscriptionStore.subscribe(reconcileNative);
    reconcileNative();
    const stopHydrationListener = useAppStore.persist.onFinishHydration(() => { void reconcileStrictModeState(); });
    if (useAppStore.persist.hasHydrated()) void reconcileStrictModeState();
    const reconcileTimer = setInterval(() => { if (!isClearingFocusUpData()) { void reconcileStrictModeState(); reconcileNative(); } }, 15_000);
    const appStateListener = AppState.addEventListener('change', (state) => { if (state === 'active' && !isClearingFocusUpData()) { void reconcileStrictModeState(); void refreshRemoteBlockerConfig(); void useSubscriptionStore.getState().refresh(); reconcileNative(); } });
    const notificationListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.kind === 'strict-mode-end') router.push('/strict-mode');
      if (data?.kind === 'wellbeing') router.push('/(tabs)/focus');
    });
    return () => { nativeHydration(); appNativeHydration(); appChanges(); wellbeingChanges(); entitlementChanges(); stopHydrationListener(); clearInterval(reconcileTimer); appStateListener.remove(); notificationListener.remove(); };
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><ScreenStatusBar /><Stack screenOptions={{ headerShown: false, statusBarStyle: c.isDark ? 'light' : 'dark', statusBarHidden: false, contentStyle: { backgroundColor: c.background }, animation: reducedMotion ? 'none' : 'fade_from_bottom', animationDuration: 280 }}><Stack.Screen name="index" /><Stack.Screen name="onboarding/index" /><Stack.Screen name="onboarding/your-time" /><Stack.Screen name="onboarding/age" /><Stack.Screen name="onboarding/reveal" /><Stack.Screen name="onboarding/reclaim" /><Stack.Screen name="onboarding/how-it-works" /><Stack.Screen name="onboarding/choose-apps" /><Stack.Screen name="onboarding/account" /><Stack.Screen name="(tabs)" /><Stack.Screen name="app-settings/[appId]" /><Stack.Screen name="browser/[appId]" options={{ presentation: 'fullScreenModal', statusBarHidden: true }} /><Stack.Screen name="temporary-access" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.65, 1], sheetGrabberVisible: false }} /><Stack.Screen name="permissions" /><Stack.Screen name="strict-mode" /><Stack.Screen name="schedule" /><Stack.Screen name="language" /><Stack.Screen name="theme" /><Stack.Screen name="pro" /><Stack.Screen name="privacy" /><Stack.Screen name="account" /><Stack.Screen name="auth/sign-in" /><Stack.Screen name="auth/sign-up" /><Stack.Screen name="auth/callback" /><Stack.Screen name="help" /></Stack></SafeAreaProvider>;
}
