import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANALYTICS_STORAGE_KEY, appendAnalyticsEvent, getAnalyticsStorage, resetAnalyticsCacheForTests } from '../eventStore';
import { calculatePeriodStatistics, getDailyStatistics, getMonthlyStatistics, getSafeComparisonPercent, getStreakDays, getWeeklyStatistics, getYearlyStatistics } from '../statisticsCalculator';
import { addLocalDays, getLocalDateKey, splitIntervalByLocalDay, startOfPeriod } from '../../../utils/date';
import { getSavedTimeEstimate, resetBlockedAttemptDedupForTests, trackBlockedNavigation } from '../localAnalytics';
import type { DailyStatistics } from '../types';

const emptyDay = (dateKey: string, durationMs = 0, sessionCount = 0): DailyStatistics => ({
  dateKey,
  cleanModeDurationMs: durationMs,
  sessionCount,
  blockedAttempts: 0,
  platforms: {},
  blockedByFeature: {},
});

describe('local calendar dates and analytics aggregation', () => {
  it('splits a session over local midnight without assuming a fixed UTC offset', () => {
    const start = new Date(2025, 0, 2, 23, 55).getTime();
    const end = new Date(2025, 0, 3, 0, 5).getTime();
    const split = splitIntervalByLocalDay(start, end);
    expect(split[getLocalDateKey(start)]).toBe(5 * 60_000);
    expect(split[getLocalDateKey(end)]).toBe(5 * 60_000);
  });

  it('uses local calendar boundaries around daylight-saving transitions', () => {
    const start = new Date(2025, 2, 30, 23, 55).getTime();
    const end = new Date(2025, 2, 31, 0, 5).getTime();
    const split = splitIntervalByLocalDay(start, end);
    expect(Object.values(split)).toEqual([5 * 60_000, 5 * 60_000]);
  });

  it('aggregates daily and weekly usage, platform totals, and blocked attempts from real events', async () => {
    await AsyncStorage.clear();
    resetAnalyticsCacheForTests();
    const currentWeekStart = startOfPeriod('week', new Date());
    const priorDay = addLocalDays(currentWeekStart, 2);
    const start = new Date(priorDay.getFullYear(), priorDay.getMonth(), priorDay.getDate(), 23, 55).getTime();
    const nextDay = addLocalDays(priorDay, 1);
    const end = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 0, 5).getTime();
    await appendAnalyticsEvent({ type: 'SESSION_STARTED', platform: 'instagram', timestamp: start });
    await appendAnalyticsEvent({ type: 'SESSION_ENDED', platform: 'instagram', timestamp: end, startedAt: start, durationMs: 10 * 60_000, meaningful: true, countSession: true, segments: [{ start, end }] });
    await appendAnalyticsEvent({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', destination: 'reels', timestamp: end });
    const stored = await getAnalyticsStorage();
    const dayOne = getDailyStatistics(stored.daily, new Date(start));
    const dayTwo = getDailyStatistics(stored.daily, new Date(end));
    const week = getWeeklyStatistics(stored.daily, new Date(end));
    expect(dayOne.cleanModeDurationMs).toBe(5 * 60_000);
    expect(dayTwo.cleanModeDurationMs).toBe(5 * 60_000);
    expect(dayTwo.blockedAttempts).toBe(1);
    expect(dayTwo.blockedByFeature.reels).toBe(1);
    expect(week.cleanModeDurationMs).toBe(10 * 60_000);
    expect(week.platforms).toEqual([{ platform: 'instagram', durationMs: 10 * 60_000, sessionCount: 1, blockedAttempts: 1 }]);
  });

  it('adds foreground segments from pause and resume checkpoints without counting the gap', async () => {
    await AsyncStorage.clear();
    resetAnalyticsCacheForTests();
    const start = new Date().setHours(10, 0, 0, 0);
    const pauseAt = start + 4 * 60_000;
    const resumeAt = pauseAt + 60 * 60_000;
    const end = resumeAt + 5 * 60_000;
    await appendAnalyticsEvent({ type: 'SESSION_STARTED', platform: 'youtube', timestamp: start });
    await appendAnalyticsEvent({ type: 'SESSION_PAUSED', platform: 'youtube', timestamp: pauseAt, startedAt: start, durationMs: 4 * 60_000, meaningful: true, countSession: true, segments: [{ start, end: pauseAt }] });
    await appendAnalyticsEvent({ type: 'SESSION_ENDED', platform: 'youtube', timestamp: end, startedAt: start, durationMs: 9 * 60_000, meaningful: true, countSession: false, segments: [{ start: resumeAt, end }] });
    const stored = await getAnalyticsStorage();
    const today = getDailyStatistics(stored.daily, new Date(start));
    expect(today.cleanModeDurationMs).toBe(9 * 60_000);
    expect(today.sessionCount).toBe(1);
  });

  it('calculates month and year periods using local calendar boundaries', () => {
    const start = new Date(2025, 0, 31, 20).getTime();
    const nextMonth = new Date(2025, 1, 1, 0, 10).getTime();
    const daily = {
      [getLocalDateKey(start)]: emptyDay(getLocalDateKey(start), 3_000),
      [getLocalDateKey(nextMonth)]: emptyDay(getLocalDateKey(nextMonth), 7_000),
    };
    expect(getMonthlyStatistics(daily, new Date(2025, 0, 15)).cleanModeDurationMs).toBe(3_000);
    expect(getYearlyStatistics(daily, new Date(2025, 0, 15)).cleanModeDurationMs).toBe(10_000);
    expect(calculatePeriodStatistics(daily, 'month', new Date(2025, 1, 5)).timeline.length).toBe(28);
  });

  it('requires a meaningful recorded session on each streak day', () => {
    const today = new Date(2025, 6, 10, 12);
    const yesterday = addLocalDays(today, -1);
    const twoDaysAgo = addLocalDays(today, -2);
    const daily = {
      [getLocalDateKey(today)]: emptyDay(getLocalDateKey(today), 90_000, 1),
      [getLocalDateKey(yesterday)]: emptyDay(getLocalDateKey(yesterday), 120_000, 1),
      [getLocalDateKey(twoDaysAgo)]: emptyDay(getLocalDateKey(twoDaysAgo), 180_000, 0),
    };
    expect(getStreakDays(daily, today)).toBe(3);
    expect(getStreakDays({ [getLocalDateKey(today)]: emptyDay(getLocalDateKey(today), 59_999, 1) }, today)).toBe(0);
  });

  it('deduplicates a repeated blocked navigation callback inside the short window', async () => {
    await AsyncStorage.clear();
    resetAnalyticsCacheForTests();
    resetBlockedAttemptDedupForTests();
    const timestamp = Date.now();
    expect(await trackBlockedNavigation('instagram', 'reels', timestamp)).toBe(true);
    expect(await trackBlockedNavigation('instagram', 'reels', timestamp + 200)).toBe(false);
    expect(await trackBlockedNavigation('instagram', 'reels', timestamp + 900)).toBe(true);
    expect((await getAnalyticsStorage()).daily[getLocalDateKey(timestamp)].blockedAttempts).toBe(2);
  });
  it('aggregates access windows independently of social-browser usage and deduplicates completion retries', async () => {
    await AsyncStorage.clear(); resetAnalyticsCacheForTests();
    const timestamp = Date.now();
    const event = { type: 'PROTECTION_EVENT' as const, event: 'temporary_access_completed' as const, platform: 'instagram' as const, durationMs: 5 * 60_000, timestamp, eventId: 'test-window:completed' };
    await appendAnalyticsEvent(event); await appendAnalyticsEvent(event);
    const period = getDailyStatistics((await getAnalyticsStorage()).daily, new Date(timestamp));
    expect(period.temporaryAccessCount).toBe(1);
    expect(period.temporaryAccessDurationMs).toBe(5 * 60_000);
    expect(period.cleanModeDurationMs).toBe(0);
  });

  it('does not derive an estimated saved-time value in the MVP', () => {
    expect(getSavedTimeEstimate()).toBeNull();
  });

  it('hides comparisons with little prior data or implausibly large percentage swings', () => {
    expect(getSafeComparisonPercent(60 * 60_000, 10 * 60_000, 5, 3)).toBeUndefined();
    expect(getSafeComparisonPercent(12 * 60 * 60_000, 60 * 60_000, 5, 3)).toBeUndefined();
    expect(getSafeComparisonPercent(90 * 60_000, 60 * 60_000, 5, 3)).toBe(50);
  });
});

describe('analytics event retention', () => {
  beforeEach(async () => { await AsyncStorage.clear(); resetAnalyticsCacheForTests(); });

  it('keeps recent raw events only and never records browsing identifiers', async () => {
    const now = Date.now();
    await appendAnalyticsEvent({ type: 'SESSION_STARTED', platform: 'youtube', timestamp: now - 40 * 86_400_000 });
    await appendAnalyticsEvent({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', destination: 'shorts', timestamp: now });
    const stored = await getAnalyticsStorage();
    expect(stored.schemaVersion).toBe(2);
    expect(stored.events).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toMatch(/youtube\.com|search_query|videoId|username|cookie|token/i);
  });

  it('prunes daily aggregates older than the retention window', async () => {
    const now = Date.now();
    const oldStart = now - 401 * 86_400_000;
    await appendAnalyticsEvent({
      type: 'SESSION_ENDED', platform: 'instagram', timestamp: oldStart + 10_000, startedAt: oldStart,
      durationMs: 120_000, meaningful: true, countSession: true, segments: [{ start: oldStart, end: oldStart + 120_000 }],
    });
    const stored = await getAnalyticsStorage();
    expect(Object.keys(stored.daily)).toHaveLength(0);
  });

  it('migrates the initial versioned local store into bounded event and per-day keys', async () => {
    const timestamp = Date.now();
    const dateKey = getLocalDateKey(timestamp);
    await AsyncStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      events: [{ type: 'BLOCKED_NAVIGATION', platform: 'youtube', destination: 'shorts', timestamp }],
      daily: { [dateKey]: emptyDay(dateKey, 60_000, 1) },
    }));
    const stored = await getAnalyticsStorage();
    expect(stored.events).toHaveLength(1);
    expect(stored.daily[dateKey].cleanModeDurationMs).toBe(60_000);
    expect(await AsyncStorage.getItem(ANALYTICS_STORAGE_KEY)).toBeNull();
  });

  it('migrates version 1 event and daily keys to date-sharded version 2 storage', async () => {
    const timestamp = Date.now();
    const dateKey = getLocalDateKey(timestamp);
    await AsyncStorage.setItem(`${ANALYTICS_STORAGE_KEY}/meta`, JSON.stringify({ schemaVersion: 1 }));
    await AsyncStorage.setItem(`${ANALYTICS_STORAGE_KEY}/events`, JSON.stringify([{ type: 'BLOCKED_NAVIGATION', platform: 'instagram', destination: 'reels', timestamp }]));
    await AsyncStorage.setItem(`${ANALYTICS_STORAGE_KEY}/day:${dateKey}`, JSON.stringify({ ...emptyDay(dateKey), blockedAttempts: 1, blockedByFeature: { reels: 1 } }));
    const stored = await getAnalyticsStorage();
    expect(stored.schemaVersion).toBe(2);
    expect(stored.events).toHaveLength(1);
    expect(stored.daily[dateKey].blockedAttempts).toBe(1);
    expect(await AsyncStorage.getItem(`${ANALYTICS_STORAGE_KEY}/events`)).toBeNull();
    expect(await AsyncStorage.getItem(`${ANALYTICS_STORAGE_KEY}/event-day:${dateKey}`)).not.toBeNull();
  });
});
