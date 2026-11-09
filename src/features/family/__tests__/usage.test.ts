import { childDay, summarizeUsage, USAGE_STALE_MS } from '../usage';
import type { FamilyPolicy } from '../../../services/family/policy';

const policy: FamilyPolicy = { schemaVersion: 1, protectedApps: [], browsers: { instagram: { enabled: true, followingFocus: true, hideSponsored: false } }, downtime: [], limits: { instagram: 30 } };
// 20:30 UTC on 8 November is 01:30 on 9 November in Tashkent (UTC+5, offset -300).
const now = Date.parse('2026-11-08T20:30:00Z');

describe('family usage dashboard', () => {
  it('uses the child’s own calendar day', () => {
    expect(childDay(now, -300)).toBe('2026-11-09');
    expect(childDay(now, 0)).toBe('2026-11-08');
    expect(childDay(now, -300, 6)).toBe('2026-11-03');
  });

  it('shows minutes against the limit and never turns a missing day into zero', () => {
    const rows = [
      { day: '2026-11-09', platform: 'instagram' as const, foregroundMs: 31 * 60_000, updatedAt: '2026-11-08T20:29:00Z' },
      { day: '2026-11-07', platform: 'youtube' as const, foregroundMs: 12 * 60_000, updatedAt: '2026-11-07T10:00:00Z' },
    ];
    const summary = summarizeUsage(rows, policy, -300, now);
    expect(summary.today.instagram).toEqual({ minutes: 31, limit: 30, overLimit: true });
    expect(summary.today.youtube).toEqual({ minutes: 0, limit: null, overLimit: false });
    expect(summary.days.map((day) => day.reported)).toEqual([true, false, true, false, false, false, false]);
    expect(summary.stale).toBe(false);
  });

  it('marks old or missing reports as stale, with today unknown', () => {
    const empty = summarizeUsage([], policy, -300, now);
    expect(empty.today.instagram.minutes).toBeNull();
    expect(empty.stale).toBe(true);
    const old = summarizeUsage([{ day: '2026-11-09', platform: 'instagram', foregroundMs: 60_000, updatedAt: new Date(now - USAGE_STALE_MS - 1).toISOString() }], policy, -300, now);
    expect(old.stale).toBe(true);
  });
});
