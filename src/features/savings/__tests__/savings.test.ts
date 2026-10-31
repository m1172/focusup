import { appDailySavings, dailySavings, savedSoFar, usualMinutes, wakingProgress, yearlyValue } from '../savings';

const on = (filter: string) => ({ enabled: true, filters: { [filter]: true } });

describe('usual short-video minutes', () => {
  it('splits an onboarding estimate across Instagram, YouTube and TikTok', () => {
    expect(usualMinutes('estimate', 90, null)).toEqual({ instagram: 30, youtube: 30, tiktok: 30 });
  });

  it('uses measured Android minutes per app', () => {
    expect(usualMinutes('measured', 90, { instagram: 50, youtube: 10, tiktok: 40 })).toEqual({ instagram: 50, youtube: 10, tiktok: 40 });
  });
});

describe('daily savings', () => {
  const usual = { instagram: 30, youtube: 20, tiktok: 25 };

  it('counts an app only when clean mode and its short-video filter are on', () => {
    expect(appDailySavings('instagram', on('reels'), usual)).toBe(30);
    expect(appDailySavings('instagram', { enabled: false, filters: { reels: true } }, usual)).toBe(0);
    expect(appDailySavings('instagram', on('explore'), usual)).toBe(0);
    expect(appDailySavings('youtube', on('shorts'), usual)).toBe(20);
    expect(appDailySavings('tiktok', on('forYou'), usual)).toBe(25);
  });

  it('adds the covered apps', () => {
    expect(dailySavings({ instagram: on('reels'), youtube: on('shorts') }, usual)).toBe(50);
    expect(dailySavings({ instagram: on('reels'), youtube: on('shorts'), tiktok: on('forYou') }, usual)).toBe(75);
  });
});

describe('saved so far today', () => {
  it('grows over the waking day', () => {
    expect(wakingProgress(new Date(2026, 9, 19, 6, 0))).toBe(0);
    expect(wakingProgress(new Date(2026, 9, 19, 15, 0))).toBe(0.5);
    expect(wakingProgress(new Date(2026, 9, 19, 23, 30))).toBe(1);
  });

  it('subtracts time spent in the apps and never goes below zero', () => {
    const afternoon = new Date(2026, 9, 19, 15, 0);
    expect(savedSoFar(60, 0, afternoon)).toBe(30);
    expect(savedSoFar(60, 10 * 60_000, afternoon)).toBe(20);
    expect(savedSoFar(60, 90 * 60_000, afternoon)).toBe(0);
  });

  it('expresses a daily saving over a year', () => {
    expect(yearlyValue(60).hours).toBeCloseTo(365.25, 2);
    expect(Math.round(yearlyValue(60).freeDays)).toBe(46);
  });
});
