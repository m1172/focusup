import { canUseFeature } from '../subscription/subscriptionService';
import type { FocusSchedule, SocialAppId, SocialAppSettings, StrictSession } from '../../types/app';
import { isScheduleActive, parseClock } from '../schedules/time';
import type { SleepPlan, TemporaryAccess, ProtectionReason, NativeProtectionPlan } from './types';

export const ALL_PLATFORMS: SocialAppId[] = ['instagram', 'youtube', 'tiktok', 'snapchat', 'x', 'facebook', 'linkedin', 'reddit'];
const clock = (value: number) => `${Math.floor(((value % 1440) + 1440) % 1440 / 60)}`.padStart(2, '0') + ':' + `${((value % 60) + 60) % 60}`.padStart(2, '0');

/** Each short-video app's feed filter. Blocking these apps, their feeds and their websites is free in every release. */
export const SHORT_VIDEO_FILTERS: Partial<Record<SocialAppId, string>> = { instagram: 'reels', youtube: 'shorts', tiktok: 'forYou' };

/** Websites blocked by an app's "Block the website" switch. Subdomains are listed because iOS matches exact domains. */
export const WEBSITE_DOMAINS: Partial<Record<SocialAppId, string[]>> = {
  instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
};

/** Original apps that open FocusUp instead. Settings saved before the switch existed follow the old rule: clean mode and the feed filter. */
export function shortVideoBlockedApps(apps: Partial<Record<SocialAppId, SocialAppSettings>>): SocialAppId[] {
  return (Object.keys(SHORT_VIDEO_FILTERS) as SocialAppId[]).filter((id) => {
    const app = apps[id];
    return app?.blockNativeApp ?? Boolean(app?.enabled && app.filters[SHORT_VIDEO_FILTERS[id]!]);
  });
}

/** Website domains to block, per platform, from each app's "Block the website" switch. */
export function blockedWebsites(apps: Partial<Record<SocialAppId, SocialAppSettings>>): Partial<Record<SocialAppId, string[]>> {
  return Object.fromEntries((Object.keys(WEBSITE_DOMAINS) as SocialAppId[]).filter((id) => apps[id]?.blockWebsite).map((id) => [id, WEBSITE_DOMAINS[id]!]));
}

export function sleepRoutine(sleep: SleepPlan): FocusSchedule {
  const bedtime = parseClock(sleep.bedtime);
  const wake = parseClock(sleep.wakeTime);
  const shiftedDays = sleep.weekdays.map((day) => (day + (bedtime - sleep.windDownMinutes < 0 ? 6 : 0)) % 7);
  return { id: 'focusup-sleep', name: 'Sleep', enabled: sleep.enabled, start: clock(bedtime - sleep.windDownMinutes), end: clock(wake + sleep.morningMinutes), weekdays: shiftedDays, apps: sleep.apps, allowedApps: sleep.allowedApps, notify: sleep.notify };
}

export function validateSleepPlan(value: unknown): value is SleepPlan {
  if (!value || typeof value !== 'object') return false;
  const sleep = value as SleepPlan;
  if (typeof sleep.bedtime !== 'string' || typeof sleep.wakeTime !== 'string' || typeof sleep.enabled !== 'boolean' || typeof sleep.notify !== 'boolean' || !Array.isArray(sleep.weekdays) || !Array.isArray(sleep.apps) || !Array.isArray(sleep.allowedApps) || ![...sleep.apps, ...sleep.allowedApps].every((app) => ALL_PLATFORMS.includes(app))) return false;
  const bed = parseClock(sleep.bedtime), wake = parseClock(sleep.wakeTime);
  if (!Number.isFinite(bed) || !Number.isFinite(wake) || bed === wake) return false;
  if (![sleep.windDownMinutes, sleep.morningMinutes].every((value) => Number.isInteger(value) && value >= 0 && value <= 180)) return false;
  const total = ((wake - bed + 1440) % 1440) + sleep.windDownMinutes + sleep.morningMinutes;
  return total >= 15 && total < 1440 && sleep.weekdays.length > 0 && sleep.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && sleep.apps.length > 0;
}

export function createTemporaryAccess(platform: SocialAppId, minutes: number, minimumMinutes: number, now = Date.now()): TemporaryAccess {
  if (!ALL_PLATFORMS.includes(platform) || !Number.isInteger(minutes) || minutes < minimumMinutes || minutes > 120) throw new RangeError('Invalid temporary access duration');
  return { id: `access-${now}`, platform, startedAt: now, endsAt: now + minutes * 60_000 };
}

/** Breaks a day while Hard Mode is on. */
export const BREAKS_PER_DAY = 2;
export const BREAK_MINUTES = [5, 10, 15] as const;

/** Local calendar day used to count breaks. */
export function localDayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function breaksLeft(breaks: { day: string; count: number }, now = new Date()): number {
  return Math.max(0, BREAKS_PER_DAY - (breaks.day === localDayKey(now) ? breaks.count : 0));
}

export function activeRoutines(routines: FocusSchedule[], now = new Date()): FocusSchedule[] {
  return routines.filter((routine) => isScheduleActive(routine, now.getDay(), now.getHours() * 60 + now.getMinutes()));
}

type PlanInput = { baseline: SocialAppId[]; filterBlocked?: SocialAppId[]; websites?: Partial<Record<SocialAppId, string[]>>; adultFilter?: boolean; uninstallProtection?: boolean; dailyLimits?: Partial<Record<SocialAppId, number>>; routines: FocusSchedule[]; sleep: SleepPlan; strict: StrictSession | null; temporary: TemporaryAccess | null; isPro: boolean };

export function protectionReason(platform: SocialAppId, input: PlanInput, now = new Date()): ProtectionReason {
  if (!canUseFeature(input.isPro, 'nativeProtection')) return input.filterBlocked?.includes(platform) ? 'protected' : 'unprotected';
  const strict = input.isPro && input.strict && input.strict.endsAt > now.getTime() && (input.strict.protectedPlatforms ?? input.strict.appIds).includes(platform);
  if (input.isPro && activeRoutines(input.routines, now).some((routine) => routine.strict && routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'strict';
  // A break lifts Hard Mode for its one app; strict routines above still win.
  if (input.temporary?.platform === platform && input.temporary.endsAt > now.getTime()) return 'temporary';
  if (strict) return 'strict';
  if (input.isPro && activeRoutines([sleepRoutine(input.sleep)], now).some((routine) => routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'sleep';
  if (input.isPro && activeRoutines(input.routines, now).some((routine) => routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'routine';
  return input.filterBlocked?.includes(platform) || input.isPro && input.baseline.includes(platform) ? 'protected' : 'unprotected';
}

export function buildNativePlan(input: PlanInput): NativeProtectionPlan {
  const allowed = canUseFeature(input.isPro, 'nativeProtection');
  // Short-video blocking protects its original app for everyone; Pro adds other apps, routines and timed modes.
  const baseline = [...new Set([...(input.filterBlocked ?? []), ...(allowed ? input.baseline : [])])];
  return { schemaVersion: 1, locale: 'en', liveActivity: false, utcOffsetMinutes: 0, baseline, websites: canUseFeature(input.isPro, 'blockWebsiteVersion') ? input.websites ?? {} : {}, adultFilter: canUseFeature(input.isPro, 'adultContentFilter') && Boolean(input.adultFilter), uninstallProtection: canUseFeature(input.isPro, 'uninstallProtection') && Boolean(input.uninstallProtection), dailyLimits: canUseFeature(input.isPro, 'dailyLimits') ? input.dailyLimits ?? {} : {}, routines: allowed ? [...input.routines, sleepRoutine(input.sleep)].filter((item) => item.enabled) : [], strict: allowed && input.strict ? { startedAt: input.strict.startedAt ?? input.strict.endsAt - 30 * 60_000, endsAt: input.strict.endsAt, platforms: (input.strict.protectedPlatforms ?? input.strict.appIds).filter((platform) => baseline.includes(platform)) } : null, temporary: allowed ? input.temporary : null };
}
