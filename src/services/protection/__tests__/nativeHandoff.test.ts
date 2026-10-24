import { protectionBridge } from '../nativeBridge';

jest.mock('expo', () => {
  const native = { consumePendingLaunch: jest.fn() };
  return { requireOptionalNativeModule: () => native, testNative: native };
});

const native = jest.requireMock('expo').testNative as { consumePendingLaunch?: jest.Mock };

describe('native shield handoff', () => {
  beforeEach(() => { native.consumePendingLaunch = jest.fn(); });

  it.each(['instagram', 'youtube', 'protection', 'instagram:open', 'instagram:link', 'youtube:open', 'youtube:link'] as const)('accepts the supported %s destination', async (target) => {
    native.consumePendingLaunch!.mockResolvedValue(target);
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBe(target);
  });

  it.each(['', null, undefined, '/browser/instagram?private=value', 'https://example.com', { platform: 'instagram' }, 'instagram:delete', 'tiktok:open', 'protection:open'])('rejects arbitrary native payloads: %p', async (target) => {
    native.consumePendingLaunch!.mockResolvedValue(target);
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBeNull();
  });

  it('continues normally with a binary built before shield handoff support', async () => {
    delete native.consumePendingLaunch;
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBeNull();
  });

  it('does not interrupt normal launch when the native request fails', async () => {
    native.consumePendingLaunch!.mockRejectedValue(new Error('unavailable'));
    await expect(protectionBridge.consumePendingLaunch()).resolves.toBeNull();
  });
});
