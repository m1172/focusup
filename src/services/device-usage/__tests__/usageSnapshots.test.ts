import AsyncStorage from '@react-native-async-storage/async-storage';
import { androidUsage } from '../androidUsage';
import { captureProductEvent } from '../../analytics/productAnalytics';
import { getAnalyticsStorage } from '../../analytics/eventStore';
import { isClearingFocusUpData } from '../../privacy/clearFocusUpData';
import { loadLatestRealChange, loadUsageHistory, takeUsageSnapshot, USAGE_HISTORY_KEY } from '../usageSnapshots';

let mockOS = 'android';
let mockOnboardingCompleted = true;
const mockOnboarding = { source: 'measured' as 'measured' | 'estimate', shortFormMinutes: 90, measured: null as unknown, measuredAt: null as number | null };
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('../androidUsage', () => ({ androidUsage: { supported: true, hasAccess: jest.fn(), read: jest.fn() } }));
jest.mock('../../analytics/productAnalytics', () => ({ captureProductEvent: jest.fn() }));
jest.mock('../../analytics/eventStore', () => ({ getAnalyticsStorage: jest.fn() }));
jest.mock('../../privacy/clearFocusUpData', () => ({ isClearingFocusUpData: jest.fn() }));
jest.mock('../../../store/appStore', () => ({ useAppStore: { persist: { hasHydrated: () => true }, getState: () => ({ onboardingCompleted: mockOnboardingCompleted }) } }));
jest.mock('../../../store/onboardingStore', () => ({
  ...jest.requireActual('../../../store/onboardingStore'),
  useOnboardingStore: { persist: { hasHydrated: () => true }, getState: () => mockOnboarding },
}));

const usage = jest.mocked(androidUsage);
const capture = jest.mocked(captureProductEvent);
const installed = new Date(2026, 9, 1, 9);
const at = (dayOffset: number, hour = 12) => new Date(2026, 9, 1 + dayOffset, hour);
const cleanDay = (dateKey: string, minutes: number) => ({ dateKey, cleanModeDurationMs: minutes * 60_000, sessionCount: 1, blockedAttempts: 0, platforms: {}, blockedByFeature: {} });

beforeEach(async () => {
  await AsyncStorage.clear();
  mockOS = 'android'; mockOnboardingCompleted = true;
  Object.assign(mockOnboarding, { source: 'measured', measured: { days: 7, minutes: { instagram: 50, youtube: 40, tiktok: 30 } }, measuredAt: installed.getTime() });
  (usage as { supported: boolean }).supported = true;
  usage.hasAccess.mockResolvedValue(true);
  usage.read.mockResolvedValue({ days: 7, minutes: { instagram: 20, youtube: 12, tiktok: 31 } });
  capture.mockReturnValue(true);
  jest.mocked(isClearingFocusUpData).mockReturnValue(false);
  jest.mocked(getAnalyticsStorage).mockResolvedValue({ schemaVersion: 2, events: [], daily: { '2026-10-01': cleanDay('2026-10-01', 14), '2026-10-08': cleanDay('2026-10-08', 70) } });
});

describe('daily snapshot', () => {
  it('stores native and FocusUp minutes and sends a rounded weekly summary', async () => {
    await takeUsageSnapshot(at(0));
    expect(usage.read).toHaveBeenCalledWith(7);
    expect((await loadUsageHistory())?.snapshots).toEqual([{ at: at(0).getTime(), dateKey: '2026-10-01', days: 7, nativeMinutes: { instagram: 20, youtube: 12, tiktok: 31 }, focusUpMinutes: 2 }]);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('usage_weekly', {
      week_since_install: 0, install_date_source: 'baseline', baseline_source: 'measured',
      baseline_minutes: 120, current_total_minutes: 65, native_minutes: 65, focusup_minutes: 0, saved_minutes: 55, days_measured: 7,
    });
  });

  it('reads Android usage at most once a day', async () => {
    await takeUsageSnapshot(at(0, 9));
    await takeUsageSnapshot(at(0, 22));
    expect(usage.read).toHaveBeenCalledTimes(1);
    await takeUsageSnapshot(at(1, 8));
    expect(usage.read).toHaveBeenCalledTimes(2);
    expect((await loadUsageHistory())?.snapshots.map((item) => item.dateKey)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('runs one read when activations overlap', async () => {
    await Promise.all([takeUsageSnapshot(at(0)), takeUsageSnapshot(at(0))]);
    expect(usage.read).toHaveBeenCalledTimes(1);
  });

  it('keeps a bounded history', async () => {
    for (let dayOffset = 0; dayOffset < 125; dayOffset += 1) await takeUsageSnapshot(at(dayOffset));
    const history = await loadUsageHistory();
    expect(history?.snapshots).toHaveLength(120);
    expect(history?.snapshots[0].dateKey).toBe('2026-10-06');
  });

  it.each([
    ['on iOS', () => { mockOS = 'ios'; }],
    ['without the native module', () => { (usage as { supported: boolean }).supported = false; }],
    ['without Usage access', () => { usage.hasAccess.mockResolvedValue(false); }],
    ['before onboarding is done', () => { mockOnboardingCompleted = false; }],
    ['while FocusUp data is being cleared', () => { jest.mocked(isClearingFocusUpData).mockReturnValue(true); }],
  ])('does nothing %s', async (_name, arrange) => {
    arrange();
    await takeUsageSnapshot(at(0));
    expect(usage.read).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(USAGE_HISTORY_KEY)).toBeNull();
  });

  it('writes nothing when Android returns no usage', async () => {
    usage.read.mockResolvedValue(null);
    await takeUsageSnapshot(at(0));
    expect(await AsyncStorage.getItem(USAGE_HISTORY_KEY)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not write the history back when a clear starts during the read', async () => {
    usage.read.mockImplementation(async () => { jest.mocked(isClearingFocusUpData).mockReturnValue(true); return { days: 7, minutes: { instagram: 1, youtube: 1, tiktok: 1 } }; });
    await takeUsageSnapshot(at(0));
    expect(await AsyncStorage.getItem(USAGE_HISTORY_KEY)).toBeNull();
  });
});

describe('weekly event', () => {
  it('is sent at most once per week since install', async () => {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) await takeUsageSnapshot(at(dayOffset));
    expect(capture).toHaveBeenCalledTimes(1);
    await takeUsageSnapshot(at(7));
    await takeUsageSnapshot(at(8));
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenLastCalledWith('usage_weekly', expect.objectContaining({ week_since_install: 1, focusup_minutes: 10 }));
    await takeUsageSnapshot(at(30));
    expect(capture).toHaveBeenLastCalledWith('usage_weekly', expect.objectContaining({ week_since_install: 4 }));
    expect(capture).toHaveBeenCalledTimes(3);
  });

  it('retries on a later day when it could not be sent, e.g. without consent', async () => {
    capture.mockReturnValue(false);
    await takeUsageSnapshot(at(0));
    expect((await loadUsageHistory())?.lastWeeklyEventWeek).toBeNull();
    capture.mockReturnValue(true);
    await takeUsageSnapshot(at(0, 18));
    expect(capture).toHaveBeenCalledTimes(2);
    expect((await loadUsageHistory())?.lastWeeklyEventWeek).toBe(0);
    await takeUsageSnapshot(at(1));
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('dates install from the first snapshot when the baseline has no date', async () => {
    mockOnboarding.measuredAt = null;
    await takeUsageSnapshot(at(20));
    await takeUsageSnapshot(at(27));
    expect(capture.mock.calls.map(([, properties]) => [properties?.week_since_install, properties?.install_date_source])).toEqual([[0, 'first_snapshot'], [1, 'first_snapshot']]);
  });

  it('flags a self-reported baseline', async () => {
    Object.assign(mockOnboarding, { source: 'estimate', measured: null, shortFormMinutes: 92 });
    await takeUsageSnapshot(at(0));
    expect(capture).toHaveBeenCalledWith('usage_weekly', expect.objectContaining({ baseline_source: 'estimate', baseline_minutes: 90 }));
  });
});

describe('latest real change', () => {
  it('compares the newest snapshot with the onboarding baseline', async () => {
    await takeUsageSnapshot(at(0));
    expect(await loadLatestRealChange()).toMatchObject({ baselineMinutes: 120, nativeMinutes: 63, focusUpMinutes: 2, currentMinutes: 65, savedMinutes: 55 });
  });

  it('is null before any snapshot or with unreadable history', async () => {
    expect(await loadLatestRealChange()).toBeNull();
    await AsyncStorage.setItem(USAGE_HISTORY_KEY, '{not json');
    expect(await loadUsageHistory()).toBeNull();
  });
});
