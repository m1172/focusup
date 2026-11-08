import type { FocusSchedule, SocialAppId } from '../../types/app';

export type SleepPlan = {
  enabled: boolean;
  bedtime: string;
  wakeTime: string;
  windDownMinutes: number;
  morningMinutes: number;
  weekdays: number[];
  apps: SocialAppId[];
  allowedApps: SocialAppId[];
  notify: boolean;
};
export type TemporaryAccess = { id: string; platform: SocialAppId; startedAt: number; endsAt: number };
export type NativeProtectionPlan = {
  schemaVersion: 1;
  locale: 'uz' | 'ru' | 'en';
  liveActivity: boolean;
  utcOffsetMinutes: number;
  baseline: SocialAppId[];
  /** Website domains blocked system-wide on iOS, per platform; a platform's temporary access lifts its websites too. */
  websites: Partial<Record<SocialAppId, string[]>>;
  /** iOS: Apple's adult-website filter. */
  adultFilter: boolean;
  /** iOS: Vaqtim cannot be deleted while this is on. */
  uninstallProtection: boolean;
  /** Minutes a day per app before the original app is blocked until midnight. */
  dailyLimits: Partial<Record<SocialAppId, number>>;
  routines: FocusSchedule[];
  strict: { startedAt: number; endsAt: number; platforms: SocialAppId[] } | null;
  temporary: TemporaryAccess | null;
};
export type ProtectionReason = 'unprotected' | 'protected' | 'routine' | 'sleep' | 'strict' | 'temporary';
export type NativeProtectionStatus = { supported: boolean; authorized: boolean; selectedCount: number; active: boolean; protectedPlatforms?: SocialAppId[]; /** iOS: apps picked in Apple's list, protected or not. */ selectedPlatforms?: SocialAppId[];
  /** iOS: which Screen Time authorization Vaqtim last received. Missing on builds before Vaqtim Family. */
  member?: 'child' | 'individual' | null };
/** iOS: the result of asking for Screen Time as a supervised child (a parent approves with their Apple ID). */
export type ChildAuthorizationResult = 'approved' | 'denied' | 'notChildAccount' | 'restricted' | 'networkError' | 'unavailable';
export type NativeProtectionBridge = {
  consumePendingLaunch?: () => Promise<string | null>;
  getStatus(): Promise<NativeProtectionStatus>;
  requestAuthorization(): Promise<boolean>;
  /** iOS: Screen Time for a child in Family Sharing. Builds before Vaqtim Family do not have it. */
  requestChildAuthorization?: () => Promise<string>;
  selectApps(platform: string): Promise<number>;
  applyPlan(json: string): Promise<void>;
  clearBrowserData(): Promise<boolean>;
  /** Builds before the account switcher do not have these three. Cookies cross as a JSON string. */
  getSiteCookies?: (domain: string) => Promise<string>;
  /** Android: the web view's default user agent. */
  getWebViewUserAgent?: () => Promise<string>;
  setSiteCookies?: (domain: string, json: string) => Promise<boolean>;
  clearSiteData?: (domain: string) => Promise<boolean>;
  reset(): Promise<void>;
};
