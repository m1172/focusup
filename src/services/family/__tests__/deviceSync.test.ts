import { Platform } from 'react-native';
import { BackendError } from '../../backend/client';
import { reconcileProtection } from '../../protection/controller';
import { protectionBridge } from '../../protection/nativeBridge';
import { useFamilyStore } from '../../../store/familyStore';
import { useAppStore } from '../../../store/appStore';
import { getEffectiveAppConfig } from '../../blockers/effective';
import { buildFamilyReport, claimFamilyCode, syncFamilyDevice } from '../deviceSync';
import type { FamilyPolicy } from '../policy';

const mockApi = { claimFamilyPairing: jest.fn(), syncFamilyDevice: jest.fn(), releaseFamilyDevice: jest.fn(), endFamilySupervision: jest.fn() };
const mockSecrets = new Map<string, string>();
const mockCalls: string[] = [];
jest.mock('../../backend/client', () => {
  const actual = jest.requireActual('../../backend/client');
  return { ...actual, createBackendClient: (options: { getAuthorization?: () => string | null }) => new Proxy(mockApi, { get: (target, key: string) => (...args: unknown[]) => { mockCalls.push(`${key}:${options.getAuthorization?.() ?? ''}`); return (target as Record<string, (...a: unknown[]) => unknown>)[key]!(...args); } }) };
});
jest.mock('../../backend/secretStorage', () => ({ secretStorage: (key: string) => ({
  read: async () => mockSecrets.get(key) ?? null,
  write: async (value: string) => { mockSecrets.set(key, value); },
  remove: async () => { mockCalls.push('secret:remove'); mockSecrets.delete(key); },
}) }));
jest.mock('../../backend/accountSession', () => ({ isBackendConfigured: () => true }));
jest.mock('../../../store/subscriptionStore', () => ({ useSubscriptionStore: { getState: () => ({ isPro: false }) } }));
jest.mock('../../protection/controller', () => ({ reconcileProtection: jest.fn(async () => true) }));
jest.mock('../../protection/nativeBridge', () => ({ protectionBridge: { getStatus: jest.fn() } }));
jest.mock('../../../features/protection/nativeAppSetup', () => ({
  nativeBlockState: (status: { authorized: boolean; member?: string; selectedPlatforms?: string[] }, app: string) => !status.authorized || status.member !== 'child' ? 'needsPermission' : status.selectedPlatforms?.includes(app) ? 'active' : 'needsSelection',
}));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn(async () => ({ granted: false })), addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })), IosAuthorizationStatus: { PROVISIONAL: 3 } }));

const secret = 'vqd1_' + 'a'.repeat(43);
const policy: FamilyPolicy = { schemaVersion: 1, protectedApps: ['instagram'], browsers: {}, downtime: [{ id: 'bed', name: 'Bed', start: '22:00', end: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['youtube'] }] };
const active = (revision = 2, value: unknown = policy) => ({ state: 'active', child: { nickname: 'Ali', birthDate: '2014-05-01' }, parentName: 'Dilnoza', revision, policy: value });
const bridge = jest.mocked(protectionBridge);

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
  mockSecrets.clear(); mockCalls.length = 0;
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  jest.mocked(reconcileProtection).mockReset().mockResolvedValue(true);
  bridge.getStatus.mockResolvedValue({ supported: true, authorized: true, selectedCount: 2, active: true, member: 'child', selectedPlatforms: ['instagram', 'youtube'] });
  useFamilyStore.setState({ role: 'none', pending: null, supervision: null, appliedRevision: null, lastSyncAt: null, notice: null });
  useAppStore.setState(useAppStore.getInitialState());
});

const supervise = async () => {
  mockApi.claimFamilyPairing.mockResolvedValue({ deviceSecret: secret, confirmationCode: '123456', childNickname: 'Ali', parentName: 'Dilnoza', expiresAt: new Date(Date.now() + 600_000).toISOString() });
  await claimFamilyCode('ABCD-EFGH');
  mockApi.syncFamilyDevice.mockResolvedValue(active());
  await syncFamilyDevice();
};

test('claiming keeps the secret out of app storage and waits for the parent', async () => {
  mockApi.claimFamilyPairing.mockResolvedValue({ deviceSecret: secret, confirmationCode: '123456', childNickname: 'Ali', parentName: 'Dilnoza', expiresAt: new Date(Date.now() + 600_000).toISOString() });
  await claimFamilyCode('abcd-efgh');
  expect(mockApi.claimFamilyPairing).toHaveBeenCalledWith('abcd-efgh', 'ios');
  expect(mockSecrets.get('focusup.family.device.v1')).toBe(secret);
  expect(useFamilyStore.getState()).toMatchObject({ role: 'pending', pending: { confirmationCode: '123456' } });
  expect(JSON.stringify(useFamilyStore.getState())).not.toContain(secret);
  mockApi.syncFamilyDevice.mockResolvedValue({ state: 'pending', childNickname: 'Ali' });
  await syncFamilyDevice();
  expect(useFamilyStore.getState().role).toBe('pending');
  expect(mockCalls).toContain(`syncFamilyDevice:Device ${secret}`);
});

test('reports Applied only after native blocking accepted the rules, then tells the parent at once', async () => {
  await supervise();
  expect(useFamilyStore.getState()).toMatchObject({ role: 'child', appliedRevision: 2, supervision: { revision: 2, parentName: 'Dilnoza' } });
  // The follow-up check-in carries the applied revision and a report without browsing data.
  const followUp = mockApi.syncFamilyDevice.mock.calls.at(-1)![0];
  expect(followUp.appliedRevision).toBe(2);
  expect(Object.keys(followUp.report).sort()).toEqual(['appVersion', 'authorized', 'blockedApps', 'error', 'member', 'missingApps', 'platform', 'timezone', 'utcOffsetMinutes']);
  expect(followUp.report).toMatchObject({ authorized: true, member: 'child', blockedApps: ['instagram', 'youtube'], missingApps: [], error: null });
});

test('a failed native apply keeps the old revision and reports the failure', async () => {
  await supervise();
  jest.mocked(reconcileProtection).mockResolvedValue(false);
  mockApi.syncFamilyDevice.mockResolvedValue(active(3));
  await syncFamilyDevice();
  expect(useFamilyStore.getState()).toMatchObject({ appliedRevision: 2, supervision: { revision: 3 } });
  await syncFamilyDevice();
  expect(mockApi.syncFamilyDevice.mock.calls.at(-1)![0]).toMatchObject({ appliedRevision: 2, report: { error: 'APPLY_FAILED' } });
});

test('offline or missed pushes keep the saved rules in force', async () => {
  await supervise();
  mockApi.syncFamilyDevice.mockRejectedValue(new BackendError(0, 'NETWORK_ERROR', 'offline'));
  await syncFamilyDevice();
  expect(useFamilyStore.getState()).toMatchObject({ role: 'child', supervision: { revision: 2 } });
  expect(mockSecrets.has('focusup.family.device.v1')).toBe(true);
});

test('rules the server sends in a wrong shape are ignored', async () => {
  await supervise();
  mockApi.syncFamilyDevice.mockResolvedValue(active(9, { ...policy, protectedApps: [], extra: 'x' }));
  await syncFamilyDevice();
  expect(useFamilyStore.getState().supervision?.revision).toBe(2);
});

test('removal: the server is told first, then the family rules are lifted', async () => {
  await supervise();
  mockApi.syncFamilyDevice.mockResolvedValue({ state: 'released' });
  mockApi.releaseFamilyDevice.mockRejectedValueOnce(new BackendError(0, 'NETWORK_ERROR', 'offline'));
  await syncFamilyDevice().catch(() => undefined);
  // Not confirmed yet: still supervised, still holding the secret.
  expect(useFamilyStore.getState().role).toBe('child');
  expect(mockSecrets.has('focusup.family.device.v1')).toBe(true);
  mockApi.releaseFamilyDevice.mockResolvedValue({ ok: true });
  mockCalls.length = 0;
  await syncFamilyDevice();
  expect(mockCalls.indexOf(`releaseFamilyDevice:Device ${secret}`)).toBeLessThan(mockCalls.indexOf('secret:remove'));
  expect(useFamilyStore.getState()).toMatchObject({ role: 'none', supervision: null, notice: 'released' });
  expect(reconcileProtection).toHaveBeenCalled();
});

test('a replaced phone is told so; an unconfirmed claim just ends', async () => {
  await supervise();
  mockApi.syncFamilyDevice.mockResolvedValue({ state: 'revoked' });
  mockApi.releaseFamilyDevice.mockResolvedValue({ ok: true });
  await syncFamilyDevice();
  expect(useFamilyStore.getState()).toMatchObject({ role: 'none', notice: 'revoked' });

  mockSecrets.set('focusup.family.device.v1', secret);
  useFamilyStore.setState({ role: 'pending', pending: { childNickname: 'Ali', parentName: '', confirmationCode: '123456', expiresAt: Date.now() }, notice: null });
  mockApi.syncFamilyDevice.mockResolvedValue({ state: 'unknown' });
  await syncFamilyDevice();
  expect(useFamilyStore.getState()).toMatchObject({ role: 'none', notice: null });
  expect(mockApi.releaseFamilyDevice).toHaveBeenCalledTimes(1);
});

test('a personal iPhone authorization does not count as supervised blocking', async () => {
  await supervise();
  bridge.getStatus.mockResolvedValue({ supported: true, authorized: true, selectedCount: 2, active: true, member: 'individual', selectedPlatforms: ['instagram', 'youtube'] });
  expect(await buildFamilyReport()).toMatchObject({ authorized: false, member: 'individual', blockedApps: [], missingApps: ['instagram', 'youtube'] });
});

test('restoring a personal backup cannot weaken the family rules', async () => {
  await supervise();
  // What restoreCloudSettings does with a backup that has everything off.
  useAppStore.setState({ apps: { ...useAppStore.getState().apps, instagram: { enabled: false, filters: { reels: false }, blockNativeApp: false } } });
  expect(getEffectiveAppConfig('instagram').filters.reels).toBe(true);
  expect(useFamilyStore.getState().supervision?.policy).toEqual(policy);
  // In-app switches cannot turn a parent's block off either.
  useAppStore.getState().setBlocking('instagram', 'blockNativeApp', true);
  useAppStore.getState().setBlocking('instagram', 'blockNativeApp', false);
  expect(useAppStore.getState().apps.instagram.blockNativeApp).toBe(true);
  useAppStore.getState().setFilter('instagram', 'reels', false);
  expect(useAppStore.getState().apps.instagram.filters.reels).toBe(false);
  useAppStore.getState().setFilter('instagram', 'reels', true);
  useAppStore.getState().setFilter('instagram', 'reels', false);
  expect(useAppStore.getState().apps.instagram.filters.reels).toBe(true);
});
