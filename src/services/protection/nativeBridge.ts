import { requireOptionalNativeModule } from 'expo';
import type { NativeProtectionBridge, NativeProtectionStatus } from './types';

const module = requireOptionalNativeModule<NativeProtectionBridge>('FocusUpProtection');
const unavailable: NativeProtectionStatus = { supported: false, authorized: false, selectedCount: 0, active: false };
export const protectionBridge = {
  async consumePendingLaunch(): Promise<'instagram' | 'youtube' | 'protection' | null> {
    try {
      const target = await module?.consumePendingLaunch?.();
      return target === 'instagram' || target === 'youtube' || target === 'protection' ? target : null;
    } catch { return null; }
  },
  async getStatus() { try { return await module?.getStatus() ?? unavailable; } catch { return unavailable; } },
  async requestAuthorization() { return await module?.requestAuthorization() ?? false; },
  async selectApps(platform: string) { return await module?.selectApps(platform) ?? 0; },
  async applyPlan(json: string) { if (!module) throw new Error('nativeUnavailable'); await module.applyPlan(json); },
  async clearBrowserData() { return await module?.clearBrowserData() ?? false; },
  async reset() { await module?.reset(); },
};
