import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { ANDROID_APP_BLOCKING, IOS_APP_BLOCKING } from '../../config/release';
import type { ChildAuthorizationResult, NativeProtectionBridge, NativeProtectionStatus } from './types';

const module = requireOptionalNativeModule<NativeProtectionBridge>('FocusUpProtection');
// Without the Accessibility service (Android) or the Screen Time entitlement (iOS) in the build, the app cannot
// block other apps. Usage access, Live Activities and clearing browser data live in the same module and keep working.
const appBlocking = Platform.OS === 'android' ? ANDROID_APP_BLOCKING : Platform.OS === 'ios' ? IOS_APP_BLOCKING : true;
const blocking = appBlocking ? module : null;
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
  /**
   * iOS, supervised phones: asks Apple for Screen Time as a child, which a parent or guardian in Family Sharing
   * approves. Never falls back to the personal (individual) authorization.
   */
  async requestChildAuthorization(): Promise<ChildAuthorizationResult> {
    if (Platform.OS !== 'ios' || !blocking?.requestChildAuthorization) return 'unavailable';
    try {
      const result = await blocking.requestChildAuthorization();
      return (['approved', 'denied', 'notChildAccount', 'restricted', 'networkError', 'unavailable'] as const).find((value) => value === result) ?? 'unavailable';
    } catch { return 'unavailable'; }
  },
  async selectApps(platform: string) { return await blocking?.selectApps(platform) ?? 0; },
  async applyPlan(json: string) { if (!blocking) throw new Error('nativeUnavailable'); await blocking.applyPlan(json); },
  async clearBrowserData() { return await module?.clearBrowserData() ?? false; },
  async reset() { await module?.reset(); },
  /** Whether this build can save and restore a site's sign-in (the account switcher). */
  canSwitchAccounts() { return Boolean(module?.getSiteCookies && module.setSiteCookies && module.clearSiteData); },
  async getSiteCookies(domain: string) { return await module?.getSiteCookies?.(domain) ?? '[]'; },
  async setSiteCookies(domain: string, json: string) { return await module?.setSiteCookies?.(domain, json) ?? false; },
  async clearSiteData(domain: string) { return await module?.clearSiteData?.(domain) ?? false; },
  /** Android: the web view's own user agent, or '' on builds without it. */
  async getWebViewUserAgent() { try { return await module?.getWebViewUserAgent?.() ?? ''; } catch { return ''; } },
};
