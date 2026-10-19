import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endSession, resetSessionTrackerForTests, restoreInterruptedSession, startSession } from '../sessionTracker';
import { track } from '../localAnalytics';
import type { FocusUpAnalyticsEvent } from '../types';

jest.mock('../localAnalytics', () => ({ track: jest.fn().mockResolvedValue(true) }));

describe('foreground-only Clean Mode session tracking', () => {
  const savedState = AppState.currentState;
  let callback: ((state: AppStateStatus) => void) | undefined;
  let clock = 0;

  beforeEach(async () => {
    await AsyncStorage.clear();
    callback = undefined;
    clock = new Date(2025, 0, 1, 10).getTime();
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      callback = listener;
      return { remove: jest.fn() };
    });
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    (track as jest.Mock).mockClear();
  });

  afterEach(() => {
    resetSessionTrackerForTests();
    jest.restoreAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: savedState });
  });

  it('pauses on background, excludes background time, and resumes in the foreground', async () => {
    await startSession('instagram');
    clock += 4 * 60_000;
    callback?.('background');
    clock += 60 * 60_000;
    callback?.('active');
    clock += 5 * 60_000;
    await endSession('instagram');

    const events = (track as jest.Mock).mock.calls.map(([event]) => event as FocusUpAnalyticsEvent);
    const paused = events.find((event) => event.type === 'SESSION_PAUSED');
    const ended = events.find((event) => event.type === 'SESSION_ENDED');
    expect(paused?.type === 'SESSION_PAUSED' && paused.durationMs).toBe(4 * 60_000);
    expect(paused?.type === 'SESSION_PAUSED' && paused.countSession).toBe(true);
    expect(ended?.type === 'SESSION_ENDED' && ended.durationMs).toBe(9 * 60_000);
    expect(ended?.type === 'SESSION_ENDED' && ended.meaningful).toBe(true);
    expect(ended?.type === 'SESSION_ENDED' && ended.countSession).toBe(false);
  });

  it('avoids duplicate sessions and omits sessions below the 60-second streak threshold', async () => {
    await startSession('youtube');
    await startSession('youtube');
    clock += 10_000;
    await endSession('youtube');
    const events = (track as jest.Mock).mock.calls.map(([event]) => event as FocusUpAnalyticsEvent);
    expect(events.filter((event) => event.type === 'SESSION_STARTED')).toHaveLength(1);
    const ended = events.find((event) => event.type === 'SESSION_ENDED');
    expect(ended?.type === 'SESSION_ENDED' && ended.meaningful).toBe(false);
  });

  it('recovers only checkpointed time after an interrupted foreground session', async () => {
    const start = clock;
    await AsyncStorage.setItem('@focusup/active-analytics-session', JSON.stringify({
      sessionId: 'instagram:checkpoint-test', platform: 'instagram', startedAt: start,
      activeSince: start + 3 * 60_000, totalDurationMs: 3 * 60_000,
      unflushedSegments: [{ start, end: start + 3 * 60_000 }], sessionCountRecorded: true,
      pauseSequence: 0, pendingPauseEvent: null, endingEvent: null,
    }));
    clock += 90 * 60_000;
    await restoreInterruptedSession();
    const ended = (track as jest.Mock).mock.calls.map(([event]) => event as FocusUpAnalyticsEvent).find((event) => event.type === 'SESSION_ENDED');
    expect(ended?.type === 'SESSION_ENDED' && ended.durationMs).toBe(3 * 60_000);
    expect(ended?.type === 'SESSION_ENDED' && ended.segments).toEqual([{ start, end: start + 3 * 60_000 }]);
  });
});
