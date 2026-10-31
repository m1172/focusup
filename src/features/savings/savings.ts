import type { SocialAppSettings } from '../../types/app';
import { AVAILABLE_APPS } from '../apps/catalog';
import { yearCost } from '../onboarding/dayBudget';

/**
 * Time FocusUp saves, from numbers the user gave or the app measured — nothing invented:
 * - "Usual" short-video time is the onboarding answer (Reels, Shorts and TikTok together) or Android's
 *   measured per-app minutes. An estimate is split evenly across those three apps.
 * - Only the short-video filters (Reels, Shorts, TikTok's For You) claim minutes: that is what the usual time measured.
 *   Other filters reduce distractions but have no number behind them, so they claim none.
 * - Today's savings grow across the waking day and subtract the time actually spent in the clean apps.
 */
export type SavingsAppId = (typeof AVAILABLE_APPS)[number];
export const SHORT_VIDEO_FILTER: Record<SavingsAppId, string> = { instagram: 'reels', youtube: 'shorts', tiktok: 'forYou' };
/** Apps the onboarding short-video question covered. */
const ESTIMATE_SHARES = 3;
export const WAKING_START_HOUR = 7;
export const WAKING_END_HOUR = 23;

export type UsualMinutes = Record<SavingsAppId, number>;

export function usualMinutes(source: 'estimate' | 'measured', shortFormMinutes: number, measured: Partial<Record<string, number>> | null): UsualMinutes {
  if (source === 'measured' && measured) return { instagram: Math.max(0, measured.instagram ?? 0), youtube: Math.max(0, measured.youtube ?? 0), tiktok: Math.max(0, measured.tiktok ?? 0) };
  const share = Math.max(0, shortFormMinutes) / ESTIMATE_SHARES;
  return { instagram: share, youtube: share, tiktok: share };
}

/** Minutes a day this app's settings save: its usual short-video time when clean mode and that filter are on. */
export function appDailySavings(appId: SavingsAppId, settings: SocialAppSettings | undefined, usual: UsualMinutes): number {
  return settings?.enabled && settings.filters[SHORT_VIDEO_FILTER[appId]] ? usual[appId] : 0;
}

export function dailySavings(apps: Partial<Record<SavingsAppId, SocialAppSettings>>, usual: UsualMinutes): number {
  return AVAILABLE_APPS.reduce((sum, id) => sum + appDailySavings(id, apps[id], usual), 0);
}

/** Share of today's waking hours that have passed, 0–1. */
export function wakingProgress(now: Date): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hours - WAKING_START_HOUR) / (WAKING_END_HOUR - WAKING_START_HOUR)));
}

/** Minutes saved so far today: the day's potential so far, minus minutes spent in the clean apps. */
export function savedSoFar(dailyPotentialMinutes: number, usedTodayMs: number, now: Date): number {
  return Math.max(0, Math.round(dailyPotentialMinutes * wakingProgress(now) - usedTodayMs / 60_000));
}

/** A daily saving expressed over a year, reusing the onboarding's 8-free-hours day. */
export function yearlyValue(dailyMinutes: number) {
  const year = yearCost(dailyMinutes);
  return { hours: year.yearHours, freeDays: year.freeDays, books: year.books };
}
