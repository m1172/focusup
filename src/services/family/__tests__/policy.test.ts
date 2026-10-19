import { familyCapabilities, isValidFamilyPolicy } from '../policy';

const policy = { version: 1, revision: 1, profileId: 'child_profile_1', apps: { instagram: { available: true, dailyLimitMinutes: 30, allowMultipleAccounts: false, filters: { reels: true, savedPosts: true } } }, downtime: [{ start: '22:00', end: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6] }] };
it('validates bounded family policy data without claiming remote enforcement exists', () => {
  expect(isValidFamilyPolicy(policy)).toBe(true);
  expect(isValidFamilyPolicy(null)).toBe(false);
  expect(isValidFamilyPolicy({ ...policy, downtime: [{ start: 'bad', end: '07:00', weekdays: [9] }] })).toBe(false);
  expect(isValidFamilyPolicy({ ...policy, apps: { instagram: { ...policy.apps.instagram, dailyLimitMinutes: -1 } } })).toBe(false);
  expect(isValidFamilyPolicy({ ...policy, apps: { instagram: { ...policy.apps.instagram, filters: { script: true } } } })).toBe(false);
  expect(familyCapabilities.remoteEnforcement).toBe(false);
});
