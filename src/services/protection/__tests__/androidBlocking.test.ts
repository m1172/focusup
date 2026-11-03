import { ANDROID_APP_BLOCKING } from '../../../config/release';
import { protectionBridge } from '../nativeBridge';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo', () => {
  const native = {
    getStatus: jest.fn(async () => ({ supported: true, authorized: true, selectedCount: 1, active: true })),
    requestAuthorization: jest.fn(async () => true),
    selectApps: jest.fn(async () => 1),
    applyPlan: jest.fn(async () => undefined),
    clearBrowserData: jest.fn(async () => true),
  };
  return { requireOptionalNativeModule: () => native, testNative: native };
});

const native = jest.requireMock('expo').testNative as Record<'getStatus' | 'requestAuthorization' | 'applyPlan' | 'clearBrowserData', jest.Mock>;

describe('Android with the Accessibility service', () => {
  it('is on, so adding an app on the Protect tab blocks the real app, the same as iOS', () => expect(ANDROID_APP_BLOCKING).toBe(true));

  it('keeps the Accessibility service in the build and gives Android its own runtime for over-the-air updates', () => {
    const { expo } = jest.requireActual('../../../../app.json');
    const plugin = expo.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === './plugins/withAndroidAccessibility');
    expect(plugin?.[1]).toEqual({ enabled: true });
    expect(expo.android.runtimeVersion).toBe('1.0.0-accessibility');
  });

  it('passes status, permission and the blocking plan through to the service', async () => {
    await expect(protectionBridge.getStatus()).resolves.toMatchObject({ supported: true, authorized: true });
    await expect(protectionBridge.requestAuthorization()).resolves.toBe(true);
    await protectionBridge.applyPlan('{}');
    expect(native.getStatus).toHaveBeenCalled();
    expect(native.requestAuthorization).toHaveBeenCalled();
    expect(native.applyPlan).toHaveBeenCalledWith('{}');
  });

  it('keeps clearing browser data working', async () => {
    await expect(protectionBridge.clearBrowserData()).resolves.toBe(true);
    expect(native.clearBrowserData).toHaveBeenCalled();
  });
});
