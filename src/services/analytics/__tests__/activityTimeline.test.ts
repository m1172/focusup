import { getDailyActivityTimeline } from '../activityTimeline';
import type { FocusUpAnalyticsEvent } from '../types';

const today = new Date(2026, 9, 16, 12);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const recorded = (segments: { start: number; end: number }[]): FocusUpAnalyticsEvent => ({
  type: 'SESSION_ENDED', platform: 'instagram', startedAt: segments[0].start,
  timestamp: segments[segments.length - 1].end, durationMs: 0,
  meaningful: true, countSession: true, segments,
});

describe('daily activity timeline', () => {
  it('splits active time at bucket boundaries and excludes the pause between segments', () => {
    const timeline = getDailyActivityTimeline([recorded([
      { start: at(16, 8, 30), end: at(16, 9, 15) },
      { start: at(16, 10), end: at(16, 10, 10) },
    ])], today);
    expect(timeline[2].durationMs).toBe(30 * 60_000);
    expect(timeline[3].durationMs).toBe(25 * 60_000);
    expect(timeline.reduce((sum, item) => sum + item.durationMs, 0)).toBe(55 * 60_000);
  });
  it('clips cross-midnight segments to the selected local day', () => {
    const timeline = getDailyActivityTimeline([recorded([
      { start: at(15, 23, 30), end: at(16, 0, 10) },
      { start: at(16, 23, 45), end: at(17, 0, 30) },
    ])], today);
    expect(timeline[0].durationMs).toBe(10 * 60_000);
    expect(timeline[7].durationMs).toBe(15 * 60_000);
  });
  it('keeps empty activity at zero and does not count blocked attempts as active time', () => {
    const timeline = getDailyActivityTimeline([{ type: 'BLOCKED_NAVIGATION', platform: 'instagram', destination: 'reels', timestamp: at(16, 9) }], today);
    expect(timeline).toHaveLength(8);
    expect(timeline.every((item) => item.durationMs === 0)).toBe(true);
  });
});
