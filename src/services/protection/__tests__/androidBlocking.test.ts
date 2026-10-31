import { ANDROID_APP_BLOCKING } from '../../../config/release';
import { protectionBridge } from '../nativeBridge';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo', () => {
  const native = {
    getStatus: jest.fn(async () => ({ supported: true, authorized: true, selectedCount: 1, active: true })),
    requestAuthorization: jest.fn(async () => true),
    applyPlan: jest.fn(async () => undefined),
    clearBrowserData: jest.fn(async () => true),
  };
  return { requireOptionalNativeModule: () => native, testNative: native };
});

const native = jest.requireMock('expo').testNative as Record<'getStatus' | 'requestAuthorization' | 'clearBrowserData', jest.Mock>;

describe('Android without the Accessibility service', () => {
  it('is off for this release', () => expect(ANDROID_APP_BLOCKING).toBe(false));

  it('reports real-app blocking as unsupported and never asks for the permission', async () => {
    await expect(protectionBridge.getStatus()).resolves.toMatchObject({ supported: false, authorized: false });
    await expect(protectionBridge.requestAuthorization()).resolves.toBe(false);
    await expect(protectionBridge.applyPlan('{}')).rejects.toThrow('nativeUnavailable');
    expect(native.getStatus).not.toHaveBeenCalled();
    expect(native.requestAuthorization).not.toHaveBeenCalled();
  });

  it('keeps clearing browser data working', async () => {
    await expect(protectionBridge.clearBrowserData()).resolves.toBe(true);
    expect(native.clearBrowserData).toHaveBeenCalled();
  });
});
