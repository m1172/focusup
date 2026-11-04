import { activeRoutines, blockedWebsites, breaksLeft, buildNativePlan, localDayKey, createTemporaryAccess, protectionReason, shortVideoBlockedApps, sleepRoutine, validateSleepPlan } from '../engine';
import { defaultSleepPlan } from '../../../store/wellbeingStore';
import type { FocusSchedule } from '../../../types/app';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));

const monday = new Date(2026, 9, 12, 22, 0);
const routine: FocusSchedule = { id: 'work', name: 'Work', enabled: true, start: '22:00', end: '07:00', weekdays: [1], apps: ['instagram', 'youtube'], allowedApps: ['youtube'] };
const input = { baseline: ['instagram'] as const, routines: [routine], sleep: defaultSleepPlan, strict: null, temporary: null, isPro: true };

describe('local protection policy', () => {
  it('keeps an overnight routine tied to the day it starts, including the following morning', () => {
    expect(activeRoutines([routine], monday)).toHaveLength(1);
    expect(activeRoutines([routine], new Date(2026, 9, 13, 6, 59))).toHaveLength(1);
    expect(activeRoutines([routine], new Date(2026, 9, 13, 7, 0))).toHaveLength(0);
    expect(activeRoutines([routine], new Date(2026, 9, 13, 22))).toHaveLength(0);
  });
  it('moves a sleep routine to the previous calendar day when wind-down crosses midnight', () => {
    const sleep = { ...defaultSleepPlan, enabled: true, bedtime: '00:15', wakeTime: '08:00', weekdays: [1] };
    const rule = sleepRoutine(sleep);
    expect(rule.start).toBe('23:45'); expect(rule.end).toBe('08:30'); expect(rule.weekdays).toEqual([0]);
    expect(activeRoutines([rule], new Date(2026, 9, 11, 23, 50))).toHaveLength(1);
    expect(activeRoutines([rule], new Date(2026, 9, 12, 8, 31))).toHaveLength(0);
  });
  it('rejects sleep schedules whose buffers span an entire day', () => {
    expect(validateSleepPlan({ ...defaultSleepPlan, bedtime: '08:00', wakeTime: '07:59' })).toBe(false);
    expect(validateSleepPlan(defaultSleepPlan)).toBe(true);
  });
  it('restores baseline protection after temporary access, and lets a break lift Hard Mode only while it lasts', () => {
    const now = monday.getTime(); const temporary = createTemporaryAccess('instagram', 15, 15, now);
    const state = { ...input, baseline: ['instagram'] as ('instagram')[], temporary };
    expect(protectionReason('instagram', state, monday)).toBe('temporary');
    expect(protectionReason('instagram', state, new Date(now + 15 * 60_000))).toBe('routine');
    const hard = { ...state, strict: { endsAt: now + 30 * 60_000, appIds: ['instagram'] as ('instagram')[], filters: {} } };
    expect(protectionReason('instagram', hard, monday)).toBe('temporary');
    expect(protectionReason('instagram', hard, new Date(now + 15 * 60_000))).toBe('strict');
  });
  it('does not let an allowed app in one routine bypass a separate baseline rule', () => {
    expect(protectionReason('youtube', { ...input, baseline: ['youtube'] }, monday)).toBe('protected');
    expect(protectionReason('youtube', { ...input, baseline: [] }, monday)).toBe('unprotected');
  });
  it('gives active strict routines precedence over access windows, while preserving allowed exceptions', () => {
    const temporary = createTemporaryAccess('instagram', 15, 15, monday.getTime());
    const state = { ...input, baseline: [], routines: [{ ...routine, strict: true }], temporary };
    expect(protectionReason('instagram', state, monday)).toBe('strict');
    expect(protectionReason('instagram', state, new Date(2026, 9, 13, 7))).toBe('unprotected');
    expect(protectionReason('youtube', { ...state, temporary: { ...temporary, platform: 'youtube' } }, monday)).toBe('temporary');
  });
  it('does not create native Pro protections for a Free customer', () => {
    const plan = buildNativePlan({ ...input, baseline: ['instagram'], isPro: false });
    expect(plan.baseline).toEqual([]); expect(plan.routines).toEqual([]); expect(plan.strict).toBeNull();
  });
  it('blocks the original app for everyone while its Reels or Shorts filter is on', () => {
    const apps = { instagram: { enabled: true, filters: { reels: true } }, youtube: { enabled: true, filters: { shorts: false } } };
    expect(shortVideoBlockedApps(apps)).toEqual(['instagram']);
    expect(shortVideoBlockedApps({ ...apps, instagram: { enabled: false, filters: { reels: true } } })).toEqual([]);
    const plan = buildNativePlan({ ...input, baseline: ['tiktok'], filterBlocked: shortVideoBlockedApps(apps), isPro: false });
    expect(plan.baseline).toEqual(['instagram']); expect(plan.routines).toEqual([]); expect(plan.temporary).toBeNull();
    expect(protectionReason('instagram', { ...input, baseline: [], filterBlocked: ['instagram'], isPro: false }, monday)).toBe('protected');
    expect(protectionReason('youtube', { ...input, baseline: [], filterBlocked: ['instagram'], isPro: false }, monday)).toBe('unprotected');
  });

  it('blocks the original TikTok app for everyone while its For You filter is on', () => {
    expect(shortVideoBlockedApps({ tiktok: { enabled: true, filters: { forYou: true } } })).toEqual(['tiktok']);
    expect(shortVideoBlockedApps({ tiktok: { enabled: true, filters: { forYou: false, following: true } } })).toEqual([]);
    const plan = buildNativePlan({ ...input, baseline: [], filterBlocked: ['tiktok'], isPro: false });
    expect(plan.baseline).toEqual(['tiktok']);
  });
  it('enforces platform minimums and rejects malformed temporary durations', () => {
    expect(() => createTemporaryAccess('instagram', 5, 15)).toThrow();
    expect(() => createTemporaryAccess('instagram', Number.NaN, 1)).toThrow();
    expect(() => createTemporaryAccess('instagram', 121, 1)).toThrow();
    expect(createTemporaryAccess('instagram', 5, 1, 1000).endsAt).toBe(301000);
  });

  it('blocks the original app from its own switch, independent of the feed filter', () => {
    expect(shortVideoBlockedApps({ instagram: { enabled: true, filters: { reels: true }, blockNativeApp: false } })).toEqual([]);
    expect(shortVideoBlockedApps({ youtube: { enabled: false, filters: {}, blockNativeApp: true } })).toEqual(['youtube']);
  });

  it('lists website domains only for apps whose website switch is on', () => {
    const websites = blockedWebsites({ instagram: { enabled: false, filters: {}, blockWebsite: true }, youtube: { enabled: true, filters: {}, blockWebsite: false } });
    expect(Object.keys(websites)).toEqual(['instagram']);
    expect(websites.instagram).toContain('www.instagram.com');
    // Website blocking is Pro: Free customers' saved switches stay stored but inactive.
    expect(buildNativePlan({ ...input, baseline: [], websites, isPro: false }).websites).toEqual({});
    // WEBSITE_BLOCKING is off: iOS's web filter would also block Vaqtim's own browser, so even Pro sends no domains.
    expect(buildNativePlan({ ...input, baseline: [], websites, isPro: true }).websites).toEqual({});
  });

  it('keeps device-wide Pro settings off for Free customers', () => {
    const free = buildNativePlan({ ...input, baseline: [], adultFilter: true, uninstallProtection: true, isPro: false });
    expect(free.adultFilter).toBe(false); expect(free.uninstallProtection).toBe(false);
    const pro = buildNativePlan({ ...input, baseline: [], adultFilter: true, uninstallProtection: true, isPro: true });
    expect(pro.adultFilter).toBe(true); expect(pro.uninstallProtection).toBe(true);
  });

  it('counts breaks per local day', () => {
    const today = new Date(2026, 9, 12, 9);
    expect(breaksLeft({ day: '', count: 0 }, today)).toBe(2);
    expect(breaksLeft({ day: localDayKey(today), count: 1 }, today)).toBe(1);
    expect(breaksLeft({ day: localDayKey(today), count: 2 }, today)).toBe(0);
    expect(breaksLeft({ day: localDayKey(today), count: 2 }, new Date(2026, 9, 13, 0, 1))).toBe(2);
  });
});
