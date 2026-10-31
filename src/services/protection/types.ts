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
export type NativeProtectionStatus = { supported: boolean; authorized: boolean; selectedCount: number; active: boolean; protectedPlatforms?: SocialAppId[]; /** iOS: apps picked in Apple's list, protected or not. */ selectedPlatforms?: SocialAppId[] };
export type NativeProtectionBridge = {
  consumePendingLaunch?: () => Promise<string | null>;
  getStatus(): Promise<NativeProtectionStatus>;
  requestAuthorization(): Promise<boolean>;
  selectApps(platform: string): Promise<number>;
  applyPlan(json: string): Promise<void>;
  clearBrowserData(): Promise<boolean>;
  reset(): Promise<void>;
};
