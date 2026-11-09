import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFamilyPolicy, normalizePolicy, type FamilyPolicy, type SupervisionRules } from '../policy';
import { familyDailyLimit, familyForcedFilters } from '../resolver';
import { appendAnalyticsEvent, resetAnalyticsCacheForTests } from '../../analytics/eventStore';
import { getLocalDateKey } from '../../../utils/date';

jest.mock('../../backend/client', () => ({ BackendError: class extends Error {}, createBackendClient: jest.fn() }));
jest.mock('../../backend/accountSession', () => ({ isBackendConfigured: () => false }));
jest.mock('../../protection/controller', () => ({ reconcileProtection: jest.fn(async () => true) }));
jest.mock('../../protection/nativeBridge', () => ({ protectionBridge: { getStatus: jest.fn() } }));
jest.mock('../../../features/protection/nativeAppSetup', () => ({ nativeBlockState: jest.fn() }));
jest.mock('expo-notifications', () => ({ IosAuthorizationStatus: { PROVISIONAL: 3 }, addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the mocks above.
const { buildFamilyUsage } = require('../deviceSync') as typeof import('../deviceSync');

const policy: FamilyPolicy = {
  schemaVersion: 1, protectedApps: [], downtime: [],
  browsers: { instagram: { enabled: true, followingFocus: false, hideSponsored: false, hideStories: true, messagesOnly: true }, youtube: { enabled: true, subscriptionsFocus: false, hideSponsored: false, hideComments: false, hideExplore: true } },
  limits: { instagram: 45 },
};
const teen: SupervisionRules = { policy, birthDate: '2011-03-15' };

describe('family limits and browsing modes', () => {
  it('validates limits and the newer browser options', () => {
    expect(isFamilyPolicy(policy)).toBe(true);
    expect(isFamilyPolicy({ ...policy, limits: { instagram: 1 } })).toBe(false);
    expect(isFamilyPolicy({ ...policy, limits: { snapchat: 30 } })).toBe(false);
    expect(isFamilyPolicy({ ...policy, browsers: { instagram: { enabled: true, followingFocus: false, hideSponsored: false, hideStories: 'yes' } } })).toBe(false);
    // Phones that never saw the newer options still accept rules without them.
    expect(isFamilyPolicy({ ...policy, limits: undefined, browsers: { instagram: { enabled: true, followingFocus: false, hideSponsored: false } } })).toBe(true);
  });

  it('forces Stories, messages-only and YouTube Explore filters and reads the limit', () => {
    expect(familyForcedFilters('instagram', teen)).toMatchObject({ reels: true, stories: true, messagesOnly: true });
    expect(familyForcedFilters('youtube', teen)).toMatchObject({ shorts: true, explore: true });
    expect(familyDailyLimit('instagram', teen)).toBe(45);
    expect(familyDailyLimit('youtube', teen)).toBeNull();
    expect(familyDailyLimit('instagram', null)).toBeNull();
  });

  it('keeps limits only for browsers the child can open', () => {
    expect(normalizePolicy({ ...policy, limits: { instagram: 45, tiktok: 30 } }, teen.birthDate).limits).toEqual({ instagram: 45 });
    expect(normalizePolicy(policy, '2017-01-01').limits).toBeUndefined();
  });
});

describe('usage report', () => {
  beforeEach(async () => { await AsyncStorage.clear(); resetAnalyticsCacheForTests(); });

  it('sends 7 local days of browser time per app and nothing else', async () => {
    const now = new Date(new Date().setHours(15, 0, 0, 0));
    const start = now.getTime() - 20 * 60_000;
    await appendAnalyticsEvent({ type: 'SESSION_ENDED', platform: 'instagram', timestamp: now.getTime(), startedAt: start, durationMs: 20 * 60_000, meaningful: true, countSession: true, segments: [{ start, end: now.getTime() }] });
    await appendAnalyticsEvent({ type: 'SESSION_ENDED', platform: 'x', timestamp: now.getTime(), startedAt: start, durationMs: 20 * 60_000, meaningful: true, countSession: true, segments: [{ start, end: now.getTime() }] });
    const days = await buildFamilyUsage(now);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: getLocalDateKey(now), apps: { instagram: 20 * 60_000, youtube: 0, tiktok: 0 } });
    expect(days.every((day) => Object.keys(day.apps).every((app) => ['instagram', 'youtube', 'tiktok'].includes(app)))).toBe(true);
    expect(JSON.stringify(days)).not.toMatch(/https?:|search|@/);
  });
});
