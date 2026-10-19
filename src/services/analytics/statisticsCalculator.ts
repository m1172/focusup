import type { Period } from '../../types/app';
import { addLocalDays, enumerateLocalDays, getLocalDateKey, startOfPeriod, endOfPeriod } from '../../utils/date';
import type { AnalyticsStorage, DailyStatistics, PeriodStatistics, SocialPlatform } from './types';
import { MAX_COMPARISON_CHANGE_PERCENT, MIN_COMPARISON_BASELINE_MS, MIN_MEANINGFUL_SESSION_MS } from './constants';

function aggregateDays(days: DailyStatistics[]): Omit<PeriodStatistics, 'period' | 'startDate' | 'endDate' | 'timeline'> {
  const platforms: Partial<Record<SocialPlatform, { platform: SocialPlatform; durationMs: number; sessionCount: number; blockedAttempts: number }>> = {};
  const blockedByFeature: PeriodStatistics['blockedByFeature'] = {};
  let cleanModeDurationMs = 0;
  let sessionCount = 0;
  let blockedAttempts = 0;
  let temporaryAccessCount = 0, temporaryAccessDurationMs = 0;
  for (const day of days) {
    cleanModeDurationMs += day.cleanModeDurationMs;
    sessionCount += day.sessionCount;
    blockedAttempts += day.blockedAttempts;
    temporaryAccessCount += day.temporaryAccessCount ?? 0;
    temporaryAccessDurationMs += day.temporaryAccessDurationMs ?? 0;
    for (const [id, values] of Object.entries(day.platforms)) {
      const platform = id as SocialPlatform;
      const current = platforms[platform] ?? (platforms[platform] = { platform, durationMs: 0, sessionCount: 0, blockedAttempts: 0 });
      current.durationMs += values?.durationMs ?? 0;
      current.sessionCount += values?.sessionCount ?? 0;
      current.blockedAttempts += values?.blockedAttempts ?? 0;
    }
    for (const [feature, count] of Object.entries(day.blockedByFeature)) {
      blockedByFeature[feature as keyof typeof blockedByFeature] = (blockedByFeature[feature as keyof typeof blockedByFeature] ?? 0) + (count ?? 0);
    }
  }
  return { cleanModeDurationMs, sessionCount, blockedAttempts, temporaryAccessCount, temporaryAccessDurationMs, platforms: Object.values(platforms).filter((entry) => entry && (entry.durationMs > 0 || entry.sessionCount > 0 || entry.blockedAttempts > 0)), blockedByFeature };
}

function bucketDates(period: Period, start: Date, end: Date): Date[] {
  if (period === 'year') return Array.from({ length: 12 }, (_, month) => new Date(start.getFullYear(), month, 1));
  if (period === 'day') return [start];
  return enumerateLocalDays(start, end);
}

function getDaysInBucket(period: Period, bucketStart: Date, nextBucketStart: Date, daily: AnalyticsStorage['daily']): DailyStatistics[] {
  if (period === 'year') {
    const days = enumerateLocalDays(bucketStart, nextBucketStart);
    return days.map((date) => daily[getLocalDateKey(date)]).filter((value): value is DailyStatistics => Boolean(value));
  }
  const entry = daily[getLocalDateKey(bucketStart)];
  return entry ? [entry] : [];
}

export function calculatePeriodStatistics(daily: AnalyticsStorage['daily'], period: Period, now = new Date()): PeriodStatistics {
  const startDate = startOfPeriod(period, now);
  const endDate = endOfPeriod(period, now);
  const buckets = bucketDates(period, startDate, endDate);
  const nextBucket = (date: Date) => period === 'year'
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : period === 'day'
      ? addLocalDays(date, 1)
      : date;
  const timeline = buckets.map((timestamp) => {
    let days: DailyStatistics[];
    if (period === 'week' || period === 'month') {
      const day = daily[getLocalDateKey(timestamp)];
      days = day ? [day] : [];
    } else {
      days = getDaysInBucket(period, timestamp, nextBucket(timestamp), daily);
    }
    return { timestamp: timestamp.getTime(), durationMs: aggregateDays(days).cleanModeDurationMs };
  });
  const allDates = enumerateLocalDays(startDate, endDate);
  const periodDays = allDates.map((date) => daily[getLocalDateKey(date)]).filter((value): value is DailyStatistics => Boolean(value));
  return { period, startDate, endDate, ...aggregateDays(periodDays), timeline };
}

export function getDailyStatistics(daily: AnalyticsStorage['daily'], now = new Date()) { return calculatePeriodStatistics(daily, 'day', now); }
export function getWeeklyStatistics(daily: AnalyticsStorage['daily'], now = new Date()) { return calculatePeriodStatistics(daily, 'week', now); }
export function getMonthlyStatistics(daily: AnalyticsStorage['daily'], now = new Date()) { return calculatePeriodStatistics(daily, 'month', now); }
export function getYearlyStatistics(daily: AnalyticsStorage['daily'], now = new Date()) { return calculatePeriodStatistics(daily, 'year', now); }

export function getStreakDays(daily: AnalyticsStorage['daily'], now = new Date()): number {
  const today = startOfPeriod('day', now);
  const todayEntry = daily[getLocalDateKey(today)];
  const hasValidSession = (entry: DailyStatistics | undefined) => Boolean(entry && entry.cleanModeDurationMs >= MIN_MEANINGFUL_SESSION_MS);
  const start = hasValidSession(todayEntry) ? today : addLocalDays(today, -1);
  let streak = 0;
  for (let date = start; ; date = addLocalDays(date, -1)) {
    const entry = daily[getLocalDateKey(date)];
    if (!hasValidSession(entry)) return streak;
    streak += 1;
  }
}

export function getPreviousPeriodStatistics(daily: AnalyticsStorage['daily'], period: Period, now = new Date()): PeriodStatistics {
  const currentStart = startOfPeriod(period, now);
  const previousStart = period === 'day' || period === 'week'
    ? addLocalDays(currentStart, period === 'day' ? -1 : -7)
    : period === 'month'
      ? new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
      : new Date(currentStart.getFullYear() - 1, 0, 1);
  const previousEnd = currentStart;
  const days = enumerateLocalDays(previousStart, previousEnd).map((date) => daily[getLocalDateKey(date)]).filter((value): value is DailyStatistics => Boolean(value));
  return { period, startDate: previousStart, endDate: previousEnd, ...aggregateDays(days), timeline: [] };
}

export function getActiveDayCount(daily: AnalyticsStorage['daily'], start: Date, end: Date): number {
  return enumerateLocalDays(start, end).filter((date) => (daily[getLocalDateKey(date)]?.cleanModeDurationMs ?? 0) > 0).length;
}

export function getSafeComparisonPercent(currentDurationMs: number, previousDurationMs: number, previousActiveDays: number, minimumActiveDays: number): number | undefined {
  if (previousDurationMs < MIN_COMPARISON_BASELINE_MS || previousActiveDays < minimumActiveDays) return undefined;
  const percent = Math.round(((currentDurationMs - previousDurationMs) / previousDurationMs) * 100);
  return Math.abs(percent) <= MAX_COMPARISON_CHANGE_PERCENT ? percent : undefined;
}
