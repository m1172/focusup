import { requireOptionalNativeModule } from 'expo';
import type { NativeProtectionBridge, NativeProtectionStatus } from './types';

const module = requireOptionalNativeModule<NativeProtectionBridge>('FocusUpProtection');
const pendingLaunches = ['instagram', 'youtube', 'protection', 'instagram:open', 'instagram:link', 'youtube:open', 'youtube:link'] as const;
export type PendingLaunch = typeof pendingLaunches[number];
const unavailable: NativeProtectionStatus = { supported: false, authorized: false, selectedCount: 0, active: false };
export const protectionBridge = {
  /** What the iOS shield asked for: the handoff page (`instagram`), the website (`instagram:open`) or the link box (`instagram:link`). */
  async consumePendingLaunch(): Promise<PendingLaunch | null> {
    try {
      const target = await module?.consumePendingLaunch?.();
      return typeof target === 'string' && (pendingLaunches as readonly string[]).includes(target) ? target as PendingLaunch : null;
    } catch { return null; }
  },
  async getStatus() { try { return await module?.getStatus() ?? unavailable; } catch { return unavailable; } },
  async requestAuthorization() { return await module?.requestAuthorization() ?? false; },
  async selectApps(platform: string) { return await module?.selectApps(platform) ?? 0; },
  async applyPlan(json: string) { if (!module) throw new Error('nativeUnavailable'); await module.applyPlan(json); },
  async clearBrowserData() { return await module?.clearBrowserData() ?? false; },
  async reset() { await module?.reset(); },
};
