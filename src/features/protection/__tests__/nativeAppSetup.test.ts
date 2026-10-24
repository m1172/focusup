import { Alert, Platform } from 'react-native';
import { protectionBridge } from '../../../services/protection/nativeBridge';
import { useProtectionStatusStore } from '../../../store/protectionStatusStore';
import type { NativeProtectionStatus } from '../../../services/protection/types';
import { enableAfterNativeBlock, nativeBlockState } from '../nativeAppSetup';

jest.mock('../../../services/protection/nativeBridge', () => ({ protectionBridge: { getStatus: jest.fn(), requestAuthorization: jest.fn(), selectApps: jest.fn() } }));
jest.mock('../../../services/protection/controller', () => ({ reconcileProtection: jest.fn(async () => undefined), resetProtectionController: jest.fn() }));

const bridge = jest.mocked(protectionBridge);
const status = (patch: Partial<NativeProtectionStatus>): NativeProtectionStatus => ({ supported: true, authorized: false, selectedCount: 0, active: false, ...patch });
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
const answer = (accept: boolean) => jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.[accept ? 1 : 0]?.onPress?.(); });

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
  });

  it('keeps the filter off when the user declines blocking the app', async () => {
    bridge.getStatus.mockResolvedValue(status({}));
    answer(false);
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
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
  });

  it('counts a picked app as ready on builds that do not report picked apps', async () => {
    bridge.getStatus.mockResolvedValue(status({ authorized: true }));
    bridge.selectApps.mockResolvedValue(1);
    answer(true);
    const enable = jest.fn();
    await enableAfterNativeBlock('instagram', 'Instagram', 'Reels', enable);
    expect(enable).toHaveBeenCalledTimes(1);
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
