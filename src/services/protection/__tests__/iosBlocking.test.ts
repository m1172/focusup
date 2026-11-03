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

describe('iOS with the Screen Time entitlement', () => {
  it('is on, so connecting an app asks for Screen Time first', () => expect(IOS_APP_BLOCKING).toBe(true));

  it('passes status, permission and app selection through to Screen Time', async () => {
    await expect(protectionBridge.getStatus()).resolves.toMatchObject({ supported: true, authorized: true });
    await expect(protectionBridge.requestAuthorization()).resolves.toBe(true);
    await expect(protectionBridge.selectApps('youtube')).resolves.toBe(1);
    expect(native.getStatus).toHaveBeenCalled();
    expect(native.requestAuthorization).toHaveBeenCalled();
    expect(native.selectApps).toHaveBeenCalledWith('youtube');
  });

  it('keeps the rest of the module working', async () => {
    await expect(protectionBridge.clearBrowserData()).resolves.toBe(true);
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBe('youtube');
    expect(native.clearBrowserData).toHaveBeenCalled();
  });
});

describe('website blocking (Screen Time web filter)', () => {
  it('is off, so Vaqtim never blocks the sites its own browser opens', () => {
    const { WEBSITE_BLOCKING } = jest.requireActual('../../../config/release');
    const { canUseFeature, isFeatureAvailable } = jest.requireActual('../../subscription/subscriptionService');
    const { buildNativePlan } = jest.requireActual('../engine');
    expect(WEBSITE_BLOCKING).toBe(false);
    expect(isFeatureAvailable('blockWebsiteVersion', true)).toBe(false);
    expect(canUseFeature(true, 'blockWebsiteVersion', true)).toBe(false);
    expect(buildNativePlan({ baseline: [], websites: { instagram: ['instagram.com'] }, isPro: true } as never).websites).toEqual({});
  });
});
