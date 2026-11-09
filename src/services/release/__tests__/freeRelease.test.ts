import { PRO_ENABLED } from '../../../config/release';
import { canUseFeature, FEATURE_ACCESS, isFeatureAvailable, type SubscriptionFeature } from '../../subscription/subscriptionService';
import { buildNativePlan, shortVideoBlockedApps } from '../../protection/engine';
import { defaultSleepPlan, useWellbeingStore } from '../../../store/wellbeingStore';
import { useAppStore } from '../../../store/appStore';
import { useSubscriptionStore } from '../../../store/subscriptionStore';
import { getEffectiveAppConfig } from '../../blockers/effective';
import { isPlatformLocked, reconcileStrictModeState } from '../../strict-mode/strictModeController';
import { reconcileProtection, resetProtectionController } from '../../protection/controller';
import { captureSettingsBackup } from '../../backend/settingsBackup';
import { restoreCloudSettings } from '../../backend/restoreSettings';
import { protectionBridge } from '../../protection/nativeBridge';
import * as Notifications from 'expo-notifications';
import { scheduleStrictModeCompletion } from '../../notifications/notificationService';
import { scheduleWellbeingNotifications } from '../../notifications/wellbeingNotifications';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {}, LOG_LEVEL: {}, PACKAGE_TYPE: {}, PURCHASES_ERROR_CODE: {} }));
jest.mock('react-native-purchases-ui', () => ({ __esModule: true, default: {} }));
jest.mock('../../protection/nativeBridge', () => ({ protectionBridge: {
  getStatus: jest.fn().mockResolvedValue({ supported: true, authorized: true, active: true }),
  applyPlan: jest.fn().mockResolvedValue(undefined),
} }));
jest.mock('../../analytics/localAnalytics', () => ({ track: jest.fn().mockResolvedValue(true) }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([
    { identifier: 'strict', content: { data: { kind: 'strict-mode-end' } } },
    { identifier: 'focusup-wellbeing:routine', content: { data: { kind: 'wellbeing' } } },
    { identifier: 'other', content: { data: {} } },
  ]),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: { PROVISIONAL: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetProtectionController();
  useAppStore.setState(useAppStore.getInitialState());
  useWellbeingStore.setState(useWellbeingStore.getInitialState());
  useSubscriptionStore.setState({ isPro: true }); // Even a stale entitlement cannot enable hidden code.
});

test('the release hides every Pro feature for both free and cached Pro users', () => {
  expect(PRO_ENABLED).toBe(false);
  // Website blocking is switched off on its own (WEBSITE_BLOCKING); see the protection tests.
  for (const feature of (Object.keys(FEATURE_ACCESS) as SubscriptionFeature[]).filter((name) => name !== 'blockWebsiteVersion')) {
    const free = FEATURE_ACCESS[feature] === 'free';
    expect(isFeatureAvailable(feature)).toBe(free);
    expect(canUseFeature(false, feature)).toBe(free);
    expect(canUseFeature(true, feature)).toBe(free);
    // The retained Pro-enabled policy still enforces entitlements.
    expect(isFeatureAvailable(feature, true)).toBe(true);
    expect(canUseFeature(false, feature, true)).toBe(free);
    expect(canUseFeature(true, feature, true)).toBe(true);
  }
});

test('saved premium filters and strict intervals stay stored but inactive; free filters apply', () => {
  useAppStore.setState({ strictSession: { endsAt: Date.now() + 60_000, appIds: ['instagram'], filters: { instagram: { explore: true } } } });
  useAppStore.getState().setFilter('instagram', 'reels', true);
  useAppStore.getState().setFilter('instagram', 'explore', true);
  useAppStore.getState().setFilter('youtube', 'comments', true);
  useAppStore.getState().setAppEnabled('instagram', true);
  useAppStore.getState().setAppEnabled('youtube', true);
  const before = JSON.stringify(captureSettingsBackup());
  expect(isPlatformLocked('instagram')).toBe(false);
  expect(getEffectiveAppConfig('instagram').filters).toMatchObject({ reels: true, explore: true });
  expect(getEffectiveAppConfig('youtube').filters.comments).toBe(false);
  expect(JSON.stringify(captureSettingsBackup())).toBe(before);
  expect(useAppStore.getState().strictSession).not.toBeNull();
});

test('native plans keep free sleep and routines but ignore saved extra apps, strict and temporary access', async () => {
  const temporary = { id: 'old', platform: 'instagram' as const, startedAt: Date.now(), endsAt: Date.now() + 60_000 };
  const strict = { endsAt: Date.now() + 60_000, appIds: ['instagram' as const], filters: {} };
  useWellbeingStore.setState({ nativeApps: ['instagram'], sleep: { ...defaultSleepPlan, enabled: true }, temporary, liveActivity: true });
  const apps = useAppStore.getState().apps;
  useAppStore.setState({ strictSession: strict, completionNotifications: true, apps: { ...apps, instagram: { ...apps.instagram, enabled: true }, youtube: { ...apps.youtube, enabled: true } } });
  const input = { baseline: ['instagram' as const], routines: useAppStore.getState().schedules, sleep: useWellbeingStore.getState().sleep, strict, temporary, isPro: true };
  expect(buildNativePlan(input)).toMatchObject({ baseline: [], strict: null, temporary: null });
  expect(buildNativePlan(input).routines.map((routine) => routine.id)).toContain('focusup-sleep');
  expect(buildNativePlan(input).routines.every((routine) => !routine.strict)).toBe(true);
  await reconcileStrictModeState();
  await reconcileProtection();
  expect(protectionBridge.applyPlan).toHaveBeenCalledWith(expect.any(String));
  // Only the free Reels/Shorts filters block original apps; saved Pro protections stay inactive.
  expect(JSON.parse(jest.mocked(protectionBridge.applyPlan).mock.calls[0][0])).toMatchObject({ baseline: ['instagram', 'youtube'], strict: null, temporary: null, liveActivity: false });
  expect(useWellbeingStore.getState()).toMatchObject({ nativeApps: ['instagram'], temporary, liveActivity: true });
  expect(useAppStore.getState().strictSession).toBe(strict);
});

test('old premium reminders are cancelled and no new ones are scheduled', async () => {
  await scheduleStrictModeCompletion(Date.now() + 60_000);
  await scheduleWellbeingNotifications({ schemaVersion: 1, locale: 'en', utcOffsetMinutes: 0, liveActivity: false, baseline: [], websites: {}, adultFilter: false, uninstallProtection: false, dailyLimits: {}, strict: null, temporary: null, routines: [] });
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('strict');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('focusup-wellbeing:routine');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('backup restore preserves hidden preferences without activating them or retaining old locks', async () => {
  jest.spyOn(useAppStore.persist, 'hasHydrated').mockReturnValue(true);
  jest.spyOn(useWellbeingStore.persist, 'hasHydrated').mockReturnValue(true);
  const backup = captureSettingsBackup();
  backup.preferences.apps.youtube.filters.comments = true;
  backup.preferences.apps.youtube.enabled = true;
  backup.preferences.completionNotifications = true;
  backup.wellbeing.sleep.enabled = true;
  backup.wellbeing.sleep.notify = true;
  useAppStore.setState({ strictSession: { endsAt: Date.now() + 60_000, appIds: ['instagram'], filters: {} } });
  await restoreCloudSettings(backup);
  expect(captureSettingsBackup()).toEqual(backup);
  expect(getEffectiveAppConfig('youtube').filters.comments).toBeFalsy();
  // Sleep Mode is free, so its opted-in reminders come back; no Hard Mode reminder is scheduled.
  const scheduled = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([request]) => request.identifier);
  expect(scheduled.length).toBeGreaterThan(0);
  expect(scheduled.every((id) => id?.startsWith('focusup-wellbeing:focusup-sleep:'))).toBe(true);
  jest.restoreAllMocks();
});

test('new users start with Instagram and YouTube uncleaned, so no original app is blocked', () => {
  const { apps } = useAppStore.getInitialState();
  expect(apps.instagram.enabled).toBe(false);
  expect(apps.youtube.enabled).toBe(false);
  expect(shortVideoBlockedApps(apps)).toEqual([]);
});
