import { createStrictModeSession, getRemainingMs, isStrictModeExpired, normalizeStrictSession } from '../types';
import { getEffectiveAppConfig } from '../../blockers/effective';
import { useAppStore } from '../../../store/appStore';
import { MockNativeAppBlocker } from '../../native-blocking/mockNativeBlocker';
import { reconcileStrictModeState, startStrictMode } from '../strictModeController';
import { useRemoteBlockerConfigStore } from '../../../store/remoteBlockerConfigStore';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));

jest.mock('../../../store/subscriptionStore', () => ({ useSubscriptionStore: { getState: () => ({ isPro: true }) } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

describe('Strict Mode session helpers', () => {
  it('creates timestamp-based sessions and calculates remaining time', () => {
    const session = createStrictModeSession(120, ['instagram'], { instagram: { enabled: true, filters: { reels: false } } }, 10_000);
    expect(session.startedAt).toBe(10_000);
    expect(session.endsAt).toBe(7_210_000);
    expect(getRemainingMs(session, 3_610_000)).toBe(3_600_000);
  });

  it('recognizes expiry and restores a legacy session safely', () => {
    expect(isStrictModeExpired({ endsAt: 1_000 }, 1_001)).toBe(true);
    const restored = normalizeStrictSession({ endsAt: 10_000, appIds: ['instagram'], filters: { instagram: { reels: true } } });
    expect(restored?.protectedPlatforms).toEqual(['instagram']);
    expect(restored?.nativeProtectionActive).toBe(false);
    expect(normalizeStrictSession({ endsAt: 'broken' })).toBeNull();
  });

  it('locks baseline Reels and Shorts protection for selected apps', () => {
    useAppStore.setState({ strictSession: { startedAt: 1, endsAt: Date.now() + 60_000, appIds: ['instagram', 'youtube'], protectedPlatforms: ['instagram', 'youtube'], filters: { instagram: { reels: false }, youtube: { shorts: false } } } });
    useAppStore.getState().setFilter('instagram', 'reels', false);
    expect(useAppStore.getState().apps.instagram.filters.reels).toBe(true);
    expect(getEffectiveAppConfig('instagram').filters.reels).toBe(true);
    expect(getEffectiveAppConfig('youtube').filters.shorts).toBe(true);
    useRemoteBlockerConfigStore.getState().setConfig({ schemaVersion: 1, platforms: { instagram: { version: 4, enabled: true, features: { reels: false } } } }, 'remote');
    expect(getEffectiveAppConfig('instagram').filters.reels).toBe(false);
    useRemoteBlockerConfigStore.getState().setConfig({ schemaVersion: 1, platforms: {} }, 'bundled');
    useAppStore.setState({ strictSession: null });
  });

  it('keeps in-app protection active when native authorization or startup fails', async () => {
    const denied = new MockNativeAppBlocker({ supported: true, authorization: 'denied' });
    const session = await startStrictMode({ durationMinutes: 30, protectedPlatforms: ['instagram'] }, denied);
    expect(session.nativeProtectionActive).toBe(false);
    expect(useAppStore.getState().strictSession?.endsAt).toBeGreaterThan(Date.now());
    await reconcileStrictModeState(Date.now(), denied);
    useAppStore.getState().finishStrict();

    const broken = new MockNativeAppBlocker({ supported: true, authorization: 'authorized', failStart: true });
    const failedStart = await startStrictMode({ durationMinutes: 30, protectedPlatforms: ['youtube'] }, broken);
    expect(failedStart.nativeProtectionActive).toBe(false);
    useAppStore.getState().finishStrict();
  });
});
