import type { GestureResponderEvent } from 'react-native';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

/**
 * Development timing for taps: how long the JS thread took to see a touch, and to reach the next frame after it.
 * `nativeEvent.timestamp` and `performance.now()` both count from device boot on iOS, so they can be compared.
 * Enabled in development, or in any build made with EXPO_PUBLIC_PERF_LOGS=1.
 */
export const perfLogsEnabled = __DEV__ || process.env.EXPO_PUBLIC_PERF_LOGS === '1';

let lastTapAt: number | null = null;

export function recordTap(event: GestureResponderEvent) {
  if (!perfLogsEnabled) return;
  const touchedAt = event.nativeEvent.timestamp;
  if (!touchedAt) return;
  lastTapAt = touchedAt;
  const seenAfter = performance.now() - touchedAt;
  requestAnimationFrame(() => {
    const frameAfter = performance.now() - touchedAt;
    // A round trip through the UI runtime (the main thread on iOS) shows whether native work is what delays the update.
    const sentAt = performance.now();
    const report = () => console.log(`[perf] tap: JS saw it after ${Math.round(seenAfter)} ms, next JS frame after ${Math.round(frameAfter)} ms, main thread free after ${Math.round(performance.now() - sentAt)} ms more`);
    scheduleOnUI(() => { 'worklet'; scheduleOnRN(report); });
  });
}

/** Milliseconds since the last recorded tap, for "tap to page on screen" logs. */
export function msSinceLastTap(): number | null {
  return lastTapAt === null ? null : Math.round(performance.now() - lastTapAt);
}

// TEMP-PERF-SAMPLER: remove after measuring.
let samplerStarted = false;
export function startMainThreadSampler() {
  if (samplerStarted) return;
  samplerStarted = true;
  let samples: number[] = [];
  setInterval(() => {
    const sentAt = performance.now();
    const back = () => { samples.push(performance.now() - sentAt); };
    scheduleOnUI(() => { 'worklet'; scheduleOnRN(back); });
  }, 100);
  setInterval(() => {
    if (!samples.length) return;
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    console.log(`[perf] main-thread round trips over 10 s: n=${sorted.length} median=${Math.round(sorted[Math.floor(sorted.length / 2)])} p95=${Math.round(p95)} max=${Math.round(sorted[sorted.length - 1])} over100ms=${sorted.filter((v) => v > 100).length}`);
    samples = [];
  }, 10_000);
}
