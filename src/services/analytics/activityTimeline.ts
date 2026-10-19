import type { FocusUpAnalyticsEvent } from './types';

/** Split recorded active segments into local three-hour buckets; paused time is excluded. */
export function getDailyActivityTimeline(events: FocusUpAnalyticsEvent[], now = new Date()) {
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), index * 3).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), (index + 1) * 3).getTime();
    return { timestamp, end, durationMs: 0 };
  });
  for (const event of events) {
    if (event.type !== 'SESSION_PAUSED' && event.type !== 'SESSION_ENDED') continue;
    for (const segment of event.segments) {
      for (const bucket of buckets) {
        bucket.durationMs += Math.max(0, Math.min(segment.end, bucket.end) - Math.max(segment.start, bucket.timestamp));
      }
    }
  }
  return buckets.map(({ timestamp, durationMs }) => ({ timestamp, durationMs }));
}
