import type { PostHogOptions } from 'posthog-react-native';

const mockStorage = { getItem: jest.fn(), setItem: jest.fn() };
const mockClient = {
  ready: jest.fn(), optIn: jest.fn(), optOut: jest.fn(), reset: jest.fn(),
  capture: jest.fn(), screen: jest.fn(), identify: jest.fn(), register: jest.fn(),
  captureException: jest.fn(), stopSessionRecording: jest.fn(), startSessionRecording: jest.fn(), flush: jest.fn(),
  getDistinctId: jest.fn(), getAnonymousId: jest.fn(),
};
const mockPostHog = jest.fn<typeof mockClient, [string, PostHogOptions]>(() => mockClient);
let mockOS = 'ios';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: mockStorage }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoVersion: null } }));
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('posthog-react-native', () => ({
  __esModule: true, default: mockPostHog,
  PostHogPersistedProperty: { OptedOut: 'opted_out', InstalledAppBuild: 'installed_app_build', InstalledAppVersion: 'installed_app_version', DeviceId: 'device_id' },
}));

let analytics: typeof import('../productAnalytics');
const originalKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const originalHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
  process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
  mockOS = 'ios';
  mockClient.getDistinctId.mockReturnValue('anonymous'); mockClient.getAnonymousId.mockReturnValue('anonymous');
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined);
  for (const method of ['ready', 'optIn', 'optOut', 'screen', 'stopSessionRecording', 'startSessionRecording', 'flush'] as const) mockClient[method].mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Reload env-backed config for each scenario.
  analytics = require('../productAnalytics');
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY; else process.env.EXPO_PUBLIC_POSTHOG_KEY = originalKey;
  if (originalHost === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_HOST; else process.env.EXPO_PUBLIC_POSTHOG_HOST = originalHost;
});
const options = () => mockPostHog.mock.calls[0]?.[1] as PostHogOptions | undefined;

test.each(['ios', 'android'])('configures replay and JS/native errors on %s', async (os) => {
  mockOS = os;
  await analytics.initializeProductAnalytics();
  expect(options()).toMatchObject({ host: 'https://eu.i.posthog.com', enableSessionReplay: true, disableRemoteFeatureFlags: true,
    sessionReplayConfig: { sampleRate: 1, throttleDelayMs: 1000, maskAllTextInputs: false, maskAllImages: false, captureLog: false, captureNetworkTelemetry: false },
    errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true, nativeCrashes: true, androidNdkCrashes: true, console: [] } } });
});

test('an unconfigured build never initializes PostHog', async () => {
  delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Exercise a build without a project key.
  const unconfigured: typeof analytics = require('../productAnalytics');
  await unconfigured.initializeProductAnalytics();
  unconfigured.captureProductEvent('auth_started');
  expect(mockPostHog).not.toHaveBeenCalled(); expect(mockClient.capture).not.toHaveBeenCalled();
});

test('a saved opt-out prevents SDK construction and all capture until opt-in', async () => {
  mockStorage.getItem.mockResolvedValue('denied');
  await analytics.initializeProductAnalytics();
  analytics.captureProductEvent('auth_started');
  analytics.captureAppException(new Error('failed'), 'test');
  expect(mockPostHog).not.toHaveBeenCalled(); expect(mockClient.captureException).not.toHaveBeenCalled();
  mockStorage.getItem.mockResolvedValue('granted');
  await analytics.setAnalyticsConsent(true);
  expect(mockPostHog).toHaveBeenCalledTimes(1);
  expect(mockClient.startSessionRecording).toHaveBeenCalled();
});

test('opt-out persists, stops replay, preserves SDK opt-out during reset, and gates exceptions', async () => {
  await analytics.initializeProductAnalytics();
  await analytics.setAnalyticsConsent(false);
  mockClient.capture.mockClear();
  analytics.captureProductEvent('onboarding_completed');
  analytics.captureAppException(new Error('failed'), 'test');
  expect(mockStorage.setItem).toHaveBeenCalledWith('@focusup/observability-consent', 'denied');
  expect(mockClient.stopSessionRecording).toHaveBeenCalled();
  expect(mockClient.reset).toHaveBeenCalledWith(expect.arrayContaining(['opted_out']));
  expect(mockClient.capture).not.toHaveBeenCalled(); expect(mockClient.captureException).not.toHaveBeenCalled();
});

test('consent storage failure fails closed without constructing the SDK', async () => {
  mockStorage.getItem.mockRejectedValue(new Error('unavailable'));
  await analytics.initializeProductAnalytics();
  expect(analytics.getAnalyticsConsent()).toBe(false); expect(mockPostHog).not.toHaveBeenCalled();
});

test('replay is stopped even when the SDK opt-out operation rejects', async () => {
  await analytics.initializeProductAnalytics();
  mockClient.optOut.mockRejectedValueOnce(new Error('SDK failure'));
  await expect(analytics.setAnalyticsConsent(false)).rejects.toThrow('SDK failure');
  expect(mockClient.stopSessionRecording).toHaveBeenCalled();
  expect(analytics.getAnalyticsConsent()).toBe(false);
  expect(mockStorage.setItem).toHaveBeenCalledWith('@focusup/observability-consent', 'denied');
});

test('screen names do not contain dynamic values or query strings and consecutive screens deduplicate', async () => {
  expect(analytics.screenNameForSegments(['(tabs)', 'statistics'])).toBe('Statistics');
  expect(analytics.screenNameForSegments(['browser', '[appId]'])).toBe('Social browser');
  expect(analytics.screenNameForSegments(['auth', 'callback'])).toBe('Auth callback');
  expect(analytics.screenNameForSegments(['secret@example.com'])).toBe('Unknown screen');
  analytics.trackProductScreen('Home');
  await analytics.initializeProductAnalytics();
  analytics.trackProductScreen('Home'); analytics.trackProductScreen('Settings'); analytics.trackProductScreen('Settings');
  expect(mockClient.screen.mock.calls.map(([screen]) => screen)).toEqual(['Home', 'Settings']);
});

test('sign-out and account switching reset identity before identifying the next account', async () => {
  analytics.setProductAnalyticsIdentity('user-a', 'en');
  await analytics.initializeProductAnalytics();
  expect(mockClient.identify).toHaveBeenCalledWith('user-a', { preferred_language: 'en' });
  analytics.setProductAnalyticsIdentity('user-b', 'ru');
  expect(mockClient.reset).toHaveBeenCalledTimes(1);
  expect(mockClient.identify).toHaveBeenLastCalledWith('user-b', { preferred_language: 'ru' });
  analytics.setProductAnalyticsIdentity(null);
  expect(mockClient.reset).toHaveBeenCalledTimes(2);
});

test('a stale SDK identity is reset when no account was restored', async () => {
  mockClient.getDistinctId.mockReturnValue('old-user');
  await analytics.initializeProductAnalytics();
  expect(mockClient.reset).toHaveBeenCalledTimes(1);
  expect(mockClient.identify).not.toHaveBeenCalled();
});

test('local sessions send only coarse durations, never timestamps, IDs or segments', async () => {
  await analytics.initializeProductAnalytics();
  analytics.captureLocalProductEvent({ type: 'SESSION_ENDED', platform: 'instagram', durationMs: 180_000, timestamp: 1000, startedAt: 0, segments: [{ start: 0, end: 180_000 }], meaningful: true, countSession: true, sessionId: 'private-session' });
  expect(mockClient.capture).toHaveBeenCalledWith('clean_session_ended', expect.objectContaining({ social_platform: 'instagram', duration_range: '1_5m', meaningful: true }));
  const serialized = JSON.stringify(mockClient.capture.mock.calls);
  for (const field of ['timestamp', 'sessionId', 'private-session', 'segments', '180000']) expect(serialized).not.toContain(field);
});

test('before_send redacts nested PII and diagnostics while keeping the SDK ingestion token', async () => {
  await analytics.initializeProductAnalytics();
  const beforeSend = options()!.before_send as Exclude<PostHogOptions['before_send'], unknown[] | undefined>;
  const result = beforeSend({ event: '$exception', properties: { token: 'phc_test', email: 'private@example.com', nested: { password: 'secret', access_token: 'secret', safe: true }, $exception_list: [{ value: 'private@example.com https://example.com/?code=secret Bearer secret' }] } });
  expect(result!.properties).toMatchObject({ token: 'phc_test', nested: { safe: true } });
  expect(JSON.stringify(result)).not.toMatch(/private@example|example.com|Bearer secret|"password"|access_token/);
  await analytics.setAnalyticsConsent(false);
  expect(beforeSend({ event: 'late_event' })).toBeNull();
});

test('manual exceptions redact error text and deduplicate repeated reports', async () => {
  await analytics.initializeProductAnalytics();
  const error = new Error('Failed for person@example.com at https://example.com/?code=abc');
  analytics.captureAppException(error, 'session_restoration'); analytics.captureAppException(error, 'session_restoration');
  expect(mockClient.captureException).toHaveBeenCalledTimes(1);
  expect(mockClient.captureException.mock.calls[0][0].message).not.toMatch(/person@example|code=abc/);
});
