import { ageBand, ageOn, isBirthDate, isFamilyPolicy, normalizePolicy, type FamilyPolicy, type SupervisionRules } from '../policy';
import { activeDowntime, applyFamilyToPlan, childProtectionState, familyAppSettings, familyBlockedApps, familyBrowserAccess, familyForcedFilters, familyRequiredApps, nextDowntimeBoundary } from '../resolver';
import type { NativeProtectionPlan } from '../../protection/types';

const policy: FamilyPolicy = {
  schemaVersion: 1,
  protectedApps: ['snapchat'],
  browsers: { instagram: { enabled: true, followingFocus: true, hideSponsored: true }, youtube: { enabled: false, subscriptionsFocus: true, hideSponsored: false, hideComments: true } },
  downtime: [{ id: 'bed', name: 'Bedtime', start: '21:30', end: '07:00', weekdays: [0, 1, 2, 3, 4], apps: ['instagram', 'youtube', 'tiktok'] }],
};
// A Wednesday. Months are 0-based in the Date constructor; all times are the phone's local time.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 10, day, hours, minutes);
const teen: SupervisionRules = { policy, birthDate: '2011-03-15' };
const young: SupervisionRules = { policy, birthDate: '2016-01-01' };

describe('family policy validation', () => {
  it('accepts the server shape and rejects anything extra or out of range', () => {
    expect(isFamilyPolicy(policy)).toBe(true);
    expect(isFamilyPolicy({ ...policy, script: 'x' })).toBe(false);
    expect(isFamilyPolicy({ ...policy, protectedApps: ['instagram', 'instagram'] })).toBe(false);
    expect(isFamilyPolicy({ ...policy, protectedApps: ['myspace'] })).toBe(false);
    expect(isFamilyPolicy({ ...policy, browsers: { instagram: { enabled: true } } })).toBe(false);
    expect(isFamilyPolicy({ ...policy, browsers: { reddit: { enabled: true } } })).toBe(false);
    expect(isFamilyPolicy({ ...policy, downtime: [{ ...policy.downtime[0], start: '25:00' }] })).toBe(false);
    expect(isFamilyPolicy({ ...policy, downtime: [{ ...policy.downtime[0], end: '21:30' }] })).toBe(false);
    expect(isFamilyPolicy({ ...policy, downtime: [policy.downtime[0], policy.downtime[0]] })).toBe(false);
    expect(isFamilyPolicy(null)).toBe(false);
  });

  it('works out age bands on the local calendar, including birthdays and 18', () => {
    expect(isBirthDate('2014-02-29')).toBe(false);
    expect(isBirthDate('2012-02-29')).toBe(true);
    expect(ageOn('2013-11-12', at(11, 12))).toBe(12);
    expect(ageOn('2013-11-12', at(12, 0))).toBe(13);
    expect(ageBand('2013-11-12', at(11, 23, 59))).toBe('child');
    expect(ageBand('2013-11-12', at(12, 0, 1))).toBe('teen');
    expect(ageBand('2008-11-12', at(12, 9))).toBe('adult');
  });

  it('drops browsers for children under 13 when the parent saves', () => {
    expect(normalizePolicy(policy, young.birthDate, at(11, 12)).browsers).toEqual({});
    expect(normalizePolicy(policy, teen.birthDate, at(11, 12)).browsers).toEqual(policy.browsers);
  });
});

describe('family resolver', () => {
  it('keeps short-video feeds blocked and adds the parent filters, free of Pro', () => {
    expect(familyForcedFilters('instagram', teen)).toEqual({ reels: true, explore: true, recommendations: true, suggestedPosts: true, sponsoredPosts: true });
    expect(familyForcedFilters('tiktok', teen)).toEqual({ forYou: true });
    expect(familyForcedFilters('youtube', teen)).toEqual({ shorts: true, homeRecommendations: true, recommendations: true, comments: true });
    expect(familyForcedFilters('instagram', null)).toEqual({});
  });

  it('only adds restrictions: a stronger personal setting stays, a weaker one is overridden', () => {
    const personal = { enabled: false, filters: { reels: false, comments: true }, blockNativeApp: false };
    const merged = familyAppSettings('instagram', personal, teen);
    expect(merged.filters.reels).toBe(true);
    expect(merged.filters.comments).toBe(true);
    expect(merged.blockNativeApp).toBe(true);
    expect(merged.enabled).toBe(true);
    expect(familyAppSettings('instagram', personal, null)).toBe(personal);
  });

  it('blocks the original app while its clean version is on', () => {
    expect(familyBlockedApps(teen).sort()).toEqual(['instagram', 'snapchat']);
    expect(familyRequiredApps(teen).sort()).toEqual(['instagram', 'snapchat', 'tiktok', 'youtube']);
  });

  it('denies every browser under 13 and browsers the parent did not enable', () => {
    expect(familyBrowserAccess('instagram', young, at(11, 12))).toBe('under13');
    expect(familyBrowserAccess('youtube', teen, at(11, 12))).toBe('notEnabled');
    expect(familyBrowserAccess('instagram', teen, at(11, 12))).toBe('allowed');
    expect(familyBrowserAccess('instagram', null, at(11, 12))).toBe('allowed');
  });

  it('closes the browser rather than open an unfiltered feed when the mandatory blocker is off', () => {
    expect(familyBrowserAccess('instagram', teen, at(11, 12), (_app, feature) => feature !== 'reels')).toBe('blockerUnavailable');
  });

  it('handles overnight downtime across midnight and weekday edges', () => {
    // Wednesday 21:30 starts; Thursday 06:59 is still inside; 07:00 is out.
    expect(activeDowntime(teen, 'instagram', at(11, 21, 29))).toBeNull();
    expect(activeDowntime(teen, 'instagram', at(11, 21, 30))?.id).toBe('bed');
    expect(familyBrowserAccess('instagram', teen, at(12, 6, 59))).toBe('downtime');
    expect(familyBrowserAccess('instagram', teen, at(12, 7, 0))).toBe('allowed');
    // Friday night is not a listed day, so Saturday morning is free; Thursday night carries into Friday morning.
    expect(activeDowntime(teen, 'instagram', at(13, 6, 0))?.id).toBe('bed');
    expect(activeDowntime(teen, 'instagram', at(14, 6, 0))).toBeNull();
    expect(activeDowntime(teen, 'snapchat', at(11, 23, 0))).toBeNull();
  });

  it('finds the next downtime boundary on the local clock', () => {
    expect(nextDowntimeBoundary(teen, at(11, 12))).toMatchObject({ at: at(11, 21, 30), kind: 'start' });
    expect(nextDowntimeBoundary(teen, at(11, 22))).toMatchObject({ at: at(12, 7), kind: 'end' });
    // Friday daytime: the next start is Sunday night.
    expect(nextDowntimeBoundary(teen, at(13, 12))).toMatchObject({ at: at(15, 21, 30), kind: 'start' });
    expect(nextDowntimeBoundary(null)).toBeNull();
  });

  it('adds family apps and strict downtime to the native plan, and removes breaks', () => {
    const plan: NativeProtectionPlan = { schemaVersion: 1, locale: 'uz', liveActivity: false, utcOffsetMinutes: -300, baseline: ['tiktok'], websites: {}, adultFilter: false, uninstallProtection: false, dailyLimits: {}, routines: Array.from({ length: 16 }, (_, index) => ({ id: `r${index}`, name: 'x', start: '08:00', end: '09:00', weekdays: [1], apps: ['x'], enabled: true })), strict: null, temporary: { id: 'a', platform: 'instagram', startedAt: 0, endsAt: 1 } };
    const merged = applyFamilyToPlan(plan, teen);
    expect(merged.baseline.sort()).toEqual(['instagram', 'snapchat', 'tiktok']);
    expect(merged.temporary).toBeNull();
    expect(merged.routines).toHaveLength(16);
    expect(merged.routines[0]).toMatchObject({ id: 'family-bed', strict: true, start: '21:30', end: '07:00' });
    expect(applyFamilyToPlan(plan, null)).toBe(plan);
  });

  it('reports Applied only after the phone confirms the current rules and can block every app', () => {
    const report = { authorized: true, member: 'child' as const, platform: 'ios' as const, blockedApps: [], missingApps: [], error: null };
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: null })).toBe('setupNeeded');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 2, report } })).toBe('waiting');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 3, report } })).toBe('applied');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 3, report: { ...report, missingApps: ['tiktok'] } } })).toBe('setupNeeded');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 3, report: { ...report, member: 'individual' } } })).toBe('unavailable');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 3, report: { ...report, authorized: false } } })).toBe('unavailable');
    expect(childProtectionState({ removalPending: false, policyRevision: 3, device: { appliedRevision: 3, report: { ...report, platform: 'android', member: null } } })).toBe('applied');
    expect(childProtectionState({ removalPending: true, policyRevision: 3, device: null })).toBe('removing');
  });
});
