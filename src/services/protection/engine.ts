import { canUseFeature } from '../subscription/subscriptionService';
import type { FocusSchedule, SocialAppId, StrictSession } from '../../types/app';
import { isScheduleActive, parseClock } from '../schedules/time';
import type { SleepPlan, TemporaryAccess, ProtectionReason, NativeProtectionPlan } from './types';

export const ALL_PLATFORMS: SocialAppId[] = ['instagram', 'youtube', 'tiktok', 'snapchat', 'x', 'facebook', 'linkedin', 'reddit'];
const clock = (value: number) => `${Math.floor(((value % 1440) + 1440) % 1440 / 60)}`.padStart(2, '0') + ':' + `${((value % 60) + 60) % 60}`.padStart(2, '0');

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

export function activeRoutines(routines: FocusSchedule[], now = new Date()): FocusSchedule[] {
  return routines.filter((routine) => isScheduleActive(routine, now.getDay(), now.getHours() * 60 + now.getMinutes()));
}

export function protectionReason(platform: SocialAppId, input: { baseline: SocialAppId[]; routines: FocusSchedule[]; sleep: SleepPlan; strict: StrictSession | null; temporary: TemporaryAccess | null; isPro: boolean }, now = new Date()): ProtectionReason {
  if (!canUseFeature(input.isPro, 'nativeProtection')) return 'unprotected';
  const strict = input.isPro && input.strict && input.strict.endsAt > now.getTime() && (input.strict.protectedPlatforms ?? input.strict.appIds).includes(platform);
  if (strict || input.isPro && activeRoutines(input.routines, now).some((routine) => routine.strict && routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'strict';
  if (input.temporary?.platform === platform && input.temporary.endsAt > now.getTime()) return 'temporary';
  if (input.isPro && activeRoutines([sleepRoutine(input.sleep)], now).some((routine) => routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'sleep';
  if (input.isPro && activeRoutines(input.routines, now).some((routine) => routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) return 'routine';
  return input.isPro && input.baseline.includes(platform) ? 'protected' : 'unprotected';
}

export function buildNativePlan(input: { baseline: SocialAppId[]; routines: FocusSchedule[]; sleep: SleepPlan; strict: StrictSession | null; temporary: TemporaryAccess | null; isPro: boolean }): NativeProtectionPlan {
  const allowed = canUseFeature(input.isPro, 'nativeProtection');
  return { schemaVersion: 1, locale: 'en', liveActivity: false, utcOffsetMinutes: 0, baseline: allowed ? input.baseline : [], routines: allowed ? [...input.routines, sleepRoutine(input.sleep)].filter((item) => item.enabled) : [], strict: allowed && input.strict ? { startedAt: input.strict.startedAt ?? input.strict.endsAt - 30 * 60_000, endsAt: input.strict.endsAt, platforms: (input.strict.protectedPlatforms ?? input.strict.appIds).filter((platform) => input.baseline.includes(platform)) } : null, temporary: allowed ? input.temporary : null };
}
