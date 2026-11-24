import { Alert, Platform } from 'react-native';
import { protectionBridge } from '../../../services/protection/nativeBridge';
import { useProtectionStatusStore } from '../../../store/protectionStatusStore';
import type { NativeProtectionStatus } from '../../../services/protection/types';
import { enableAfterNativeBlock, ensureNativeAuthorization, isRealAppBlocked, nativeBlockState, permissionMessageMustContinue } from '../nativeAppSetup';

jest.mock('../../../services/protection/nativeBridge', () => ({ protectionBridge: { getStatus: jest.fn(), requestAuthorization: jest.fn(), selectApps: jest.fn() } }));
jest.mock('../../../services/protection/controller', () => ({ reconcileProtection: jest.fn(async () => undefined), resetProtectionController: jest.fn() }));

const bridge = jest.mocked(protectionBridge);
const status = (patch: Partial<NativeProtectionStatus>): NativeProtectionStatus => ({ supported: true, authorized: false, selectedCount: 0, active: false, ...patch });
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
// Accept = the last button. Decline = the cancel button, where the message has one.
const answer = (accept: boolean) => jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
  const button = accept ? buttons?.[buttons.length - 1] : buttons?.find((item) => item.style === 'cancel');
  button?.onPress?.();
});

describe('Reels/Shorts blocking starts with the original app blocked', () => {
  beforeEach(() => { setOS('ios'); useProtectionStatusStore.getState().setStatus(status({ supported: false })); });

  it('treats an app picked on iOS as ready even before its filter protects it', () => {
    expect(nativeBlockState(status({ authorized: true, selectedPlatforms: ['instagram'] }), 'instagram')).toBe('active');
    expect(nativeBlockState(status({ authorized: true, selectedPlatforms: [] }), 'instagram')).toBe('needsSelection');
    setOS('android');
    expect(nativeBlockState(status({ authorized: true }), 'instagram')).toBe('active');
  });

  it('turns the filter on directly where other apps cannot be blocked', async () => {
    bridge.getStatus.mockResolvedValue(status({ supported: false }));
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith(false);
    expect(enable).toHaveBeenCalledWith(false);
  });

  it('on iOS, the message before the Screen Time request has one button and always leads to the request', async () => {
    expect(permissionMessageMustContinue('ios')).toBe(true);
    expect(permissionMessageMustContinue('android')).toBe(false);
    bridge.getStatus.mockResolvedValue(status({}));
    bridge.requestAuthorization.mockResolvedValue(false);
    const alert = answer(true);
    const enable = jest.fn();
    expect(await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable)).toBe('needsPermission');
    const [, , buttons, options] = alert.mock.calls[0]!;
    expect(buttons).toHaveLength(1);
    expect(buttons?.[0]?.style).toBeUndefined();
    expect(options?.cancelable).toBe(false);
    expect(bridge.requestAuthorization).toHaveBeenCalledTimes(1);
    // Refusing in Apple's own prompt keeps the filter off.
    expect(enable).not.toHaveBeenCalled();
  });

  it('on iOS, the settings message before the Screen Time request cannot be skipped either', async () => {
    bridge.getStatus.mockResolvedValue(status({}));
    bridge.requestAuthorization.mockResolvedValue(false);
    const alert = answer(true);
    expect(await ensureNativeAuthorization()).toBe('needsPermission');
    expect(alert.mock.calls[0]![2]).toHaveLength(1);
    expect(bridge.requestAuthorization).toHaveBeenCalledTimes(1);
  });

  it('on Android, keeps the filter off when the user declines the disclosure', async () => {
    setOS('android');
    bridge.getStatus.mockResolvedValue(status({}));
    const alert = answer(false);
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
    expect(alert.mock.calls[0]![2]).toHaveLength(2);
    expect(enable).not.toHaveBeenCalled();
    expect(bridge.requestAuthorization).not.toHaveBeenCalled();
  });

  it('turns the filter on after iOS permission and the app is picked', async () => {
    bridge.getStatus.mockResolvedValueOnce(status({})).mockResolvedValueOnce(status({ authorized: true })).mockResolvedValue(status({ authorized: true, selectedPlatforms: ['instagram'] }));
    bridge.requestAuthorization.mockResolvedValue(true);
    bridge.selectApps.mockResolvedValue(1);
    answer(true);
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
    expect(bridge.selectApps).toHaveBeenCalledWith('instagram');
    expect(enable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith(true);
  });

  it('counts a picked app as ready on builds that do not report picked apps', async () => {
    bridge.getStatus.mockResolvedValue(status({ authorized: true }));
    bridge.selectApps.mockResolvedValue(1);
    answer(true);
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith(true);
  });

  it('keeps the filter off when the app is not picked in Apple’s list', async () => {
    bridge.getStatus.mockResolvedValue(status({ authorized: true }));
    bridge.selectApps.mockResolvedValue(0);
    answer(true);
    const enable = jest.fn();
    await enableAfterNativeBlock('youtube', 'YouTube', 'Shorts', enable);
    expect(enable).not.toHaveBeenCalled();
  });

  it('on Android, turns the filter on once the user returns with the service enabled', async () => {
    setOS('android');
    bridge.getStatus.mockResolvedValue(status({}));
    bridge.requestAuthorization.mockResolvedValue(false);
    answer(true);
    const enable = jest.fn();
    await enableAfterNativeBlock('youtube', 'YouTube', 'Shorts', enable);
    expect(enable).not.toHaveBeenCalled();
    useProtectionStatusStore.getState().setStatus(status({ authorized: true }));
    expect(enable).toHaveBeenCalledTimes(1);
    useProtectionStatusStore.getState().setStatus(status({ authorized: true, active: true }));
    expect(enable).toHaveBeenCalledTimes(1);
  });
});

describe('An app counts as added only while its real app is blocked', () => {
  beforeEach(() => setOS('ios'));

  it('is added on iOS only with Screen Time access and the app picked in Apple’s list', () => {
    expect(isRealAppBlocked('instagram', true, status({ authorized: true, selectedPlatforms: ['instagram'] }), true)).toBe(true);
    expect(isRealAppBlocked('instagram', true, status({ authorized: true, selectedPlatforms: [] }), true)).toBe(false);
    expect(isRealAppBlocked('instagram', true, status({ authorized: false, selectedPlatforms: ['instagram'] }), true)).toBe(false);
  });

  it('is never added where the phone cannot block apps, or with the block switched off', () => {
    expect(isRealAppBlocked('instagram', true, status({ supported: false }), true)).toBe(false);
    expect(isRealAppBlocked('instagram', false, status({ authorized: true, selectedPlatforms: ['instagram'] }), true)).toBe(false);
  });

  it('trusts the saved switch until the phone first answers, so nothing flashes as removed on launch', () => {
    expect(isRealAppBlocked('instagram', true, status({ supported: false }), false)).toBe(true);
  });

  it('on Android, needs the Accessibility service', () => {
    setOS('android');
    expect(isRealAppBlocked('tiktok', true, status({ authorized: true }), true)).toBe(true);
    expect(isRealAppBlocked('tiktok', true, status({ authorized: false }), true)).toBe(false);
  });
});
