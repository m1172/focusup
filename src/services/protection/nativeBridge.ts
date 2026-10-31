import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { ANDROID_APP_BLOCKING } from '../../config/release';
import type { NativeProtectionBridge, NativeProtectionStatus } from './types';

const module = requireOptionalNativeModule<NativeProtectionBridge>('FocusUpProtection');
// Without the Accessibility service in the build, Android cannot block other apps. Usage access and
// clearing browser data live in the same module and keep working.
const blocking = Platform.OS === 'android' && !ANDROID_APP_BLOCKING ? null : module;
const pendingLaunches = ['instagram', 'youtube', 'tiktok', 'protection', 'instagram:open', 'instagram:link', 'youtube:open', 'youtube:link', 'tiktok:open', 'tiktok:link'] as const;
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
  async getStatus() { try { return await blocking?.getStatus() ?? unavailable; } catch { return unavailable; } },
  async requestAuthorization() { return await blocking?.requestAuthorization() ?? false; },
  async selectApps(platform: string) { return await blocking?.selectApps(platform) ?? 0; },
  async applyPlan(json: string) { if (!blocking) throw new Error('nativeUnavailable'); await blocking.applyPlan(json); },
  async clearBrowserData() { return await module?.clearBrowserData() ?? false; },
  async reset() { await module?.reset(); },
};
