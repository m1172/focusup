import { IOS_APP_BLOCKING } from '../../../config/release';
import { protectionBridge } from '../nativeBridge';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo', () => {
  const native = {
    getStatus: jest.fn(async () => ({ supported: true, authorized: true, selectedCount: 1, active: true })),
    requestAuthorization: jest.fn(async () => true),
    selectApps: jest.fn(async () => 1),
    applyPlan: jest.fn(async () => undefined),
    clearBrowserData: jest.fn(async () => true),
    consumePendingLaunch: jest.fn(async () => 'youtube'),
  };
  return { requireOptionalNativeModule: () => native, testNative: native };
});

const native = jest.requireMock('expo').testNative as Record<'getStatus' | 'requestAuthorization' | 'selectApps' | 'clearBrowserData', jest.Mock>;

describe('iOS without the Screen Time entitlement', () => {
  it('is off for this release', () => expect(IOS_APP_BLOCKING).toBe(false));

  it('reports real-app blocking as unsupported and never asks for Screen Time', async () => {
    await expect(protectionBridge.getStatus()).resolves.toMatchObject({ supported: false, authorized: false });
    await expect(protectionBridge.requestAuthorization()).resolves.toBe(false);
    await expect(protectionBridge.selectApps('youtube')).resolves.toBe(0);
    await expect(protectionBridge.applyPlan('{}')).rejects.toThrow('nativeUnavailable');
    expect(native.getStatus).not.toHaveBeenCalled();
    expect(native.requestAuthorization).not.toHaveBeenCalled();
    expect(native.selectApps).not.toHaveBeenCalled();
  });

  it('keeps the rest of the module working', async () => {
    await expect(protectionBridge.clearBrowserData()).resolves.toBe(true);
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBe('youtube');
    expect(native.clearBrowserData).toHaveBeenCalled();
  });
});
