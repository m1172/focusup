import * as Notifications from 'expo-notifications';
import { useAppStore } from '../../../store/appStore';
import { useWellbeingStore } from '../../../store/wellbeingStore';
import { reconcileProtection } from '../../protection/controller';
import { captureSettingsBackup } from '../settingsBackup';
import { isCloudBackup, isCloudSettings } from '../settingsValidation';
import { restoreCloudSettings } from '../restoreSettings';

jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }) }));
jest.mock('../../protection/controller', () => ({ reconcileProtection: jest.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  jest.spyOn(useAppStore.persist, 'hasHydrated').mockReturnValue(true);
  jest.spyOn(useWellbeingStore.persist, 'hasHydrated').mockReturnValue(true);
  useAppStore.setState(useAppStore.getInitialState());
  useWellbeingStore.setState(useWellbeingStore.getInitialState());
  jest.mocked(reconcileProtection).mockReset().mockResolvedValue(undefined);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
});
afterEach(() => { jest.restoreAllMocks(); });

test('validates the complete backup and rejects privilege flags, missing apps and invalid schedules', () => {
  const snapshot = captureSettingsBackup();
  expect(isCloudSettings(snapshot)).toBe(true);
  expect(isCloudBackup({ revision: 0, payload: null, updatedAt: null })).toBe(true);
  expect(isCloudBackup({ revision: -1, payload: snapshot, updatedAt: null })).toBe(false);
  expect(isCloudSettings({ ...snapshot, pro: true })).toBe(false);
  expect(isCloudSettings({ ...snapshot, preferences: { ...snapshot.preferences, apps: {} } })).toBe(false);
  expect(isCloudSettings({ ...snapshot, preferences: { ...snapshot.preferences, schedules: [{ id: 'bad', start: '30:00' }] } })).toBe(false);
});

test('restores preferences while preserving native selections, active access and purchase-independent state', async () => {
  const snapshot = captureSettingsBackup(); snapshot.preferences.themeMode = 'dark'; snapshot.preferences.completionNotifications = true; snapshot.preferences.goalNotifications = true;
  const temporary = { id: 'access', platform: 'youtube' as const, startedAt: Date.now(), endsAt: Date.now() + 60_000 };
  const expiredStrict = { endsAt: Date.now() - 1, appIds: ['youtube' as const], filters: {} };
  useWellbeingStore.setState({ nativeApps: ['youtube'], liveActivity: true, temporary });
  useAppStore.setState({ strictSession: expiredStrict, onboardingCompleted: true });
  await restoreCloudSettings(snapshot);
  expect(useAppStore.getState().themeMode).toBe('dark');
  expect(useAppStore.getState().strictSession).toBe(expiredStrict);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(useAppStore.getState().completionNotifications).toBe(false);
  expect(useAppStore.getState().goalNotifications).toBe(true);
  expect(useWellbeingStore.getState()).toMatchObject({ nativeApps: ['youtube'], liveActivity: true, temporary });
  expect(reconcileProtection).toHaveBeenCalledTimes(1);
});

test('does not change any settings during an active strict session', async () => {
  const snapshot = captureSettingsBackup(); snapshot.preferences.themeMode = 'dark';
  useAppStore.setState({ strictSession: { endsAt: Date.now() + 60_000, appIds: ['instagram'], filters: {} } });
  await expect(restoreCloudSettings(snapshot)).rejects.toMatchObject({ code: 'STRICT_ACTIVE' });
  expect(useAppStore.getState().themeMode).toBe('system');
  expect(reconcileProtection).not.toHaveBeenCalled();
});

test('rolls back local preferences if applying native protection fails', async () => {
  const original = captureSettingsBackup(), snapshot = captureSettingsBackup(); snapshot.preferences.themeMode = 'dark';
  jest.mocked(reconcileProtection).mockRejectedValueOnce(new Error('native failed'));
  await expect(restoreCloudSettings(snapshot)).rejects.toMatchObject({ code: 'RESTORE_FAILED' });
  expect(captureSettingsBackup()).toEqual(original);
  expect(reconcileProtection).toHaveBeenCalledTimes(2);
});
