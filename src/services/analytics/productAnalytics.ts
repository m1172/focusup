import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import PostHog, { PostHogPersistedProperty, type PostHogOptions } from 'posthog-react-native';
import type { FocusUpAnalyticsEvent } from './types';

const CONSENT_KEY = '@focusup/observability-consent';
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? '';
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';
export const isProductAnalyticsConfigured = Boolean(key && /^https:\/\/[^/]+\/?$/.test(host));
let client: PostHog | null = null;
let initialization: Promise<void> | null = null;
let consent = true;
let consentLoaded = false;
let identity: string | null = null;
let appliedIdentity: string | null = null;
let language = 'uz';
let currentScreen: string | undefined;
let previousScreen: string | undefined;
let sentScreen: string | undefined;
let consentRevision = 0;
const listeners = new Set<() => void>();

export function subscribeAnalyticsConsent(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getAnalyticsConsent() { return consentLoaded && consent; }
function notify() { listeners.forEach((listener) => listener()); }

// Applied to JS SDK events too, including autocaptured exceptions. Replay pixels and
// native crash payloads bypass this hook: sensitive UI must be masked separately.
const sensitiveKey = /email|password|passwd|authorization|cookie|secret|credential|search.?term|query|full.?url|access.?token|refresh.?token|identity.?token|^token$|^name$|^full.?name$|^\$device_name$/i;
export function redactDiagnosticText(text: string): string {
  return text
    .replace(/\b(?:Bearer\s+)[\w.~-]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[redacted]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[email]')
    .replace(/(?:https?:\/\/|focusup:\/\/)[^\s)]+/gi, '[url]')
    .replace(/((?:password|token|secret|code|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 8000);
}
export function sanitizeAnalyticsProperties(value: unknown, depth = 0): unknown {
  if (depth > 12) return undefined;
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeAnalyticsProperties(item, depth + 1));
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value).filter(([name]) => !sensitiveKey.test(name)).map(([name, item]) => [name, sanitizeAnalyticsProperties(item, depth + 1)]));
}

export function durationRange(ms: number) {
  if (ms < 60_000) return 'under_1m';
  if (ms < 5 * 60_000) return '1_5m';
  if (ms < 15 * 60_000) return '5_15m';
  if (ms < 30 * 60_000) return '15_30m';
  if (ms < 60 * 60_000) return '30_60m';
  return '60m_plus';
}

type ProductEvent =
  | 'onboarding_started' | 'onboarding_completed' | 'auth_started' | 'auth_succeeded' | 'auth_failed'
  | 'notification_permission_requested' | 'notification_permission_result' | 'notification_opened'
  | 'app_protection_changed' | 'filter_changed' | 'browser_failed'
  | 'clean_session_started' | 'clean_session_paused' | 'clean_session_ended' | 'distraction_blocked'
  | 'temporary_access_started' | 'temporary_access_completed'
  | 'strict_mode_started' | 'strict_mode_completed' | 'strict_mode_ended_early'
  | 'paywall_viewed' | 'subscription_plan_selected' | 'purchase_started' | 'purchase_completed'
  | 'purchase_cancelled' | 'purchase_failed' | 'restore_started' | 'purchase_restored';
type Properties = Record<string, string | number | boolean | undefined>;
function safely(action: () => void) { try { action(); } catch { /* Observability must never interrupt the app. */ } }
function context() { return { screen: currentScreen ?? null, previous_screen: previousScreen ?? null }; }

export function captureProductEvent(event: ProductEvent, properties: Properties = {}) {
  if (!consentLoaded || !consent || !client) return;
  safely(() => client?.capture(event, { ...context(), ...properties }));
}

function applyIdentity() {
  if (!client || !consent) return;
  const persistedId = client.getDistinctId();
  const persistedUserChanged = persistedId !== client.getAnonymousId() && persistedId !== identity;
  if ((appliedIdentity && appliedIdentity !== identity) || persistedUserChanged) {
    client.reset();
    sentScreen = undefined;
  }
  appliedIdentity = identity;
  client.register({ environment: process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production'), platform: Platform.OS, preferred_language: language });
  if (identity) client.identify(identity, { preferred_language: language });
}

export function setProductAnalyticsIdentity(userId: string | null, preferredLanguage = language) {
  const changed = identity !== userId || language !== preferredLanguage;
  identity = userId; language = preferredLanguage;
  if (changed) safely(applyIdentity);
}

export async function initializeProductAnalytics(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    const revision = consentRevision;
    try {
      const saved = await AsyncStorage.getItem(CONSENT_KEY);
      if (revision === consentRevision) consent = saved !== 'denied';
      consentLoaded = true;
      if (!isProductAnalyticsConfigured || !consent) return;
      const native = (Platform.OS === 'ios' || Platform.OS === 'android') && !Constants.expoVersion;
      const options: PostHogOptions = {
        host, customStorage: AsyncStorage,
        defaultOptIn: consent,
        captureAppLifecycleEvents: true,
        capturePushNotificationSubscriptions: false,
        capturePushNotificationOpened: false,
        preloadFeatureFlags: false,
        disableRemoteFeatureFlags: true,
        disableGeoip: false,
        enableSessionReplay: native && consent,
        sessionReplayConfig: {
          maskAllTextInputs: false, maskAllImages: false, maskAllSandboxedViews: true,
          captureLog: false, captureNetworkTelemetry: false,
          sampleRate: 1, throttleDelayMs: 1000,
        },
        errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: [], nativeCrashes: native, androidNdkCrashes: native } },
        before_send: (event) => {
          if (!consent) return null;
          const properties = sanitizeAnalyticsProperties({ ...context(), ...event.properties }) as typeof event.properties;
          // The SDK's ingestion token is required; custom event secrets are never allowed.
          if (event.properties?.token) properties!.token = key;
          return { ...event, properties, $set: sanitizeAnalyticsProperties(event.$set) as typeof event.$set, $set_once: sanitizeAnalyticsProperties(event.$set_once) as typeof event.$set_once };
        },
      };
      client = new PostHog(key, options);
      await client.ready();
      if (!consent) await client.optOut();
      else { await client.optIn(); applyIdentity(); sendScreen(); }
    } catch {
      // Fail closed when consent storage or the SDK is unavailable.
      consent = false; consentLoaded = true;
      if (client) { await client.stopSessionRecording().catch(() => undefined); await client.optOut().catch(() => undefined); }
    } finally { notify(); }
  })();
  return initialization;
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  const revision = ++consentRevision;
  consent = granted; notify();
  let storageError: unknown;
  try { await AsyncStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); }
  catch (error) { storageError = error; if (granted) { consent = false; notify(); throw error; } }
  // An opted-out launch never constructs the SDK. Construct it on a later opt-in.
  if (granted && !client) {
    await initializeProductAnalytics();
    if (!client && consent) { initialization = null; await initializeProductAnalytics(); }
  }
  try {
    if (revision !== consentRevision) return;
    if (granted && !consent) throw new Error('Analytics initialization failed');
    if (client) {
      if (!granted) {
        try { await client.optOut(); }
        finally { if (revision === consentRevision) await client.stopSessionRecording(); }
        if (revision !== consentRevision) return;
        client.reset([PostHogPersistedProperty.OptedOut, PostHogPersistedProperty.InstalledAppBuild, PostHogPersistedProperty.InstalledAppVersion, PostHogPersistedProperty.DeviceId]);
        appliedIdentity = null; sentScreen = undefined;
      } else {
        await client.optIn();
        if (revision !== consentRevision) return;
        applyIdentity(); sendScreen();
        if ((Platform.OS === 'ios' || Platform.OS === 'android') && !Constants.expoVersion) await client.startSessionRecording();
      }
    }
    if (storageError) throw storageError;
  } finally { notify(); }
}

/** No URLs, query strings, codes or arbitrary dynamic route values go to PostHog. */
export function screenNameForSegments(segments: readonly string[]): string {
  const route = segments.filter((part) => !part.startsWith('(')).join('/') || 'index';
  const screens: Record<string, string> = {
    index: 'Home', start: 'Launch', apps: 'Apps', statistics: 'Statistics', focus: 'Focus', settings: 'Settings',
    'browser/[appId]': 'Social browser', 'app-settings/[appId]': 'App settings', 'native-app/[appId]': 'Native app',
    'onboarding/index': 'Welcome', 'onboarding/your-time': 'Onboarding time', 'onboarding/reveal': 'Onboarding results',
    'onboarding/reclaim': 'Onboarding goal', 'onboarding/how-it-works': 'Onboarding explanation', 'onboarding/choose-apps': 'Onboarding apps', 'onboarding/account': 'Onboarding account',
    'auth/sign-in': 'Sign in', 'auth/sign-up': 'Sign up', 'auth/callback': 'Auth callback',
    account: 'Account', privacy: 'Privacy', help: 'Help', capabilities: 'Capabilities', permissions: 'Permissions',
    language: 'Language', theme: 'Theme', pro: 'Subscription', 'strict-mode': 'Strict mode',
    schedule: 'Schedule', sleep: 'Sleep', protection: 'Protection', 'temporary-access': 'Temporary access',
  };
  return screens[route] || 'Unknown screen';
}
function sendScreen() {
  if (!client || !consentLoaded || !consent || !currentScreen || sentScreen === currentScreen) return;
  safely(() => {
    sentScreen = currentScreen;
    void client!.screen(currentScreen!, context()).catch(() => undefined);
  });
}
export function trackProductScreen(screen: string) {
  if (screen !== currentScreen) { previousScreen = currentScreen; currentScreen = screen; }
  sendScreen();
}

export function captureLocalProductEvent(event: FocusUpAnalyticsEvent) {
  switch (event.type) {
    case 'SESSION_STARTED': captureProductEvent('clean_session_started', { social_platform: event.platform }); break;
    case 'SESSION_PAUSED': case 'SESSION_ENDED':
      captureProductEvent(event.type === 'SESSION_ENDED' ? 'clean_session_ended' : 'clean_session_paused', { social_platform: event.platform, duration_range: durationRange(event.durationMs), meaningful: event.meaningful }); break;
    case 'BLOCKED_NAVIGATION': captureProductEvent('distraction_blocked', { social_platform: event.platform, feature: event.destination, source: 'navigation' }); break;
    case 'DISTRACTION_BLOCKED': captureProductEvent('distraction_blocked', { social_platform: event.platform, feature: event.feature, source: event.source }); break;
    case 'STRICT_MODE_EVENT': captureProductEvent(event.event, { duration_range: durationRange(event.durationMinutes * 60_000), protected_platform_count: event.protectedPlatformCount }); break;
    case 'PROTECTION_EVENT': captureProductEvent(event.event, { social_platform: event.platform, duration_range: durationRange(event.durationMs) }); break;
    case 'SUBSCRIPTION_EVENT': captureProductEvent(event.event === 'plan_selected' ? 'subscription_plan_selected' : event.event === 'restore_completed' ? 'purchase_restored' : event.event, { plan: event.planId, source: event.source }); break;
  }
}

const recentErrors = new Map<string, number>();
export function captureAppException(error: unknown, source: string) {
  if (!client || !consentLoaded || !consent) return;
  safely(() => {
    const safe = new Error(redactDiagnosticText(error instanceof Error ? error.message : String(error)));
    safe.name = error instanceof Error ? redactDiagnosticText(error.name) : 'Error';
    if (error instanceof Error && error.stack) safe.stack = redactDiagnosticText(error.stack);
    const fingerprint = `${safe.name}:${safe.message}:${safe.stack}`;
    const now = Date.now();
    for (const [id, at] of recentErrors) if (now - at > 10_000) recentErrors.delete(id);
    if (recentErrors.has(fingerprint)) return;
    recentErrors.set(fingerprint, now);
    client?.captureException(safe, { ...context(), source });
  });
}
export function flushProductAnalytics() { if (client && consent) safely(() => { void client!.flush().catch(() => undefined); }); }
