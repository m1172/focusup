import { focusUpMinutesPerDay, nativeTotal, realChange, roundToFive, weekSinceInstall } from '../realChange';

const day = (dateKey: string, minutes: number) => ({ dateKey, cleanModeDurationMs: minutes * 60_000, sessionCount: 1, blockedAttempts: 0, platforms: {}, blockedByFeature: {} });
const baseline = { days: 7, minutes: { instagram: 50, youtube: 40, tiktok: 30 } };

describe('real change against the pre-install baseline', () => {
  it('compares native plus FocusUp minutes with the measured baseline', () => {
    expect(realChange(baseline, { nativeMinutes: { instagram: 20, youtube: 10, tiktok: 30 }, focusUpMinutes: 15 })).toEqual({
      baselineMinutes: 120, nativeMinutes: 60, focusUpMinutes: 15, currentMinutes: 75, savedMinutes: 45, savedShare: 0.375,
    });
  });

  it('reports more time as a negative saving instead of hiding it', () => {
    const change = realChange(baseline, { nativeMinutes: { instagram: 90, youtube: 40, tiktok: 30 }, focusUpMinutes: 20 });
    expect(change?.savedMinutes).toBe(-60);
    expect(change?.savedShare).toBe(-0.5);
  });

  it('counts users who moved back to the native apps', () => {
    expect(realChange(baseline, { nativeMinutes: { instagram: 50, youtube: 40, tiktok: 30 }, focusUpMinutes: 0 })?.savedMinutes).toBe(0);
  });

  it('needs both a baseline and a snapshot', () => {
    expect(realChange(null, { nativeMinutes: { instagram: 1, youtube: 1, tiktok: 1 }, focusUpMinutes: 0 })).toBeNull();
    expect(realChange(baseline, null)).toBeNull();
  });

  it('has no share without baseline minutes', () => {
    expect(realChange({ days: 7, minutes: { instagram: 0, youtube: 0, tiktok: 0 } }, { nativeMinutes: { instagram: 5, youtube: 0, tiktok: 0 }, focusUpMinutes: 0 })?.savedShare).toBeNull();
  });

  it('ignores negative or missing app minutes', () => {
    expect(nativeTotal({ instagram: -5, youtube: 10 })).toBe(10);
  });
});

describe('FocusUp minutes a day', () => {
  const now = new Date(2026, 9, 23, 15);

  it('averages the last days including today', () => {
    const daily = { '2026-10-23': day('2026-10-23', 14), '2026-10-17': day('2026-10-17', 21), '2026-10-16': day('2026-10-16', 700) };
    expect(focusUpMinutesPerDay(daily, 7, now)).toBe(5);
  });

  it('matches a shorter native window', () => {
    expect(focusUpMinutesPerDay({ '2026-10-22': day('2026-10-22', 10), '2026-10-21': day('2026-10-21', 10) }, 2, now)).toBe(5);
    expect(focusUpMinutesPerDay({}, 0, now)).toBe(0);
  });
});

describe('weeks and rounding', () => {
  const installed = new Date(2026, 9, 1, 9).getTime();

  it('counts whole weeks since install', () => {
    expect(weekSinceInstall(installed, installed)).toBe(0);
    expect(weekSinceInstall(installed, installed + 6.9 * 86_400_000)).toBe(0);
    expect(weekSinceInstall(installed, installed + 7 * 86_400_000)).toBe(1);
    expect(weekSinceInstall(installed, installed + 57 * 86_400_000)).toBe(8);
    expect(weekSinceInstall(installed, installed - 86_400_000)).toBe(0);
  });

  it('rounds to five minutes', () => {
    expect(roundToFive(62)).toBe(60);
    expect(roundToFive(63)).toBe(65);
    expect(roundToFive(-2)).toBe(0);
    expect(roundToFive(-58)).toBe(-60);
  });
});
