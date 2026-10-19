import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { track } from './localAnalytics';
import { isValidAnalyticsEvent } from './eventStore';
import { MIN_MEANINGFUL_SESSION_MS, ACTIVE_SESSION_CHECKPOINT_MS } from './constants';
import type { ActiveTimeSegment, FocusUpAnalyticsEvent, SocialPlatform } from './types';

const ACTIVE_SESSION_STORAGE_KEY = '@focusup/active-analytics-session';
type SessionPauseEvent = Extract<FocusUpAnalyticsEvent, { type: 'SESSION_PAUSED' }>;
type SessionEndEvent = Extract<FocusUpAnalyticsEvent, { type: 'SESSION_ENDED' }>;
type ActiveSession = {
  sessionId: string;
  platform: SocialPlatform;
  startedAt: number;
  activeSince: number | null;
  totalDurationMs: number;
  unflushedSegments: ActiveTimeSegment[];
  sessionCountRecorded: boolean;
  pauseSequence: number;
  pendingPauseEvent: SessionPauseEvent | null;
  endingEvent: SessionEndEvent | null;
};

let current: ActiveSession | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let checkpointTimer: ReturnType<typeof setInterval> | null = null;
let lifecycleQueue: Promise<void> = Promise.resolve();

function runSerial<T>(operation: () => Promise<T>): Promise<T> {
  const task = lifecycleQueue.then(operation);
  lifecycleQueue = task.then(() => undefined, () => undefined);
  return task;
}

function closeActiveSegment(now: number): ActiveTimeSegment | null {
  if (!current || current.activeSince === null) return null;
  const segment = { start: current.activeSince, end: Math.max(now, current.activeSince) };
  current.totalDurationMs += segment.end - segment.start;
  if (segment.end > segment.start) current.unflushedSegments.push(segment);
  current.activeSince = null;
  return segment;
}

async function persistCurrent(): Promise<boolean> {
  if (!current) return false;
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

async function clearPersistedSession(): Promise<void> {
  try { await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY); } catch { /* A stale record is idempotently reconciled on the next launch. */ }
}

function clearCheckpointTimer() {
  if (checkpointTimer) clearInterval(checkpointTimer);
  checkpointTimer = null;
}

function startCheckpointTimer() {
  clearCheckpointTimer();
  checkpointTimer = setInterval(() => {
    void runSerial(async () => {
      if (!current || current.endingEvent || current.activeSince === null) return;
      const now = Date.now();
      closeActiveSegment(now);
      current.activeSince = now;
      await persistCurrent();
    });
  }, ACTIVE_SESSION_CHECKPOINT_MS);
}

async function flushPausedSegments(now: number): Promise<void> {
  if (!current || current.endingEvent) return;
  closeActiveSegment(now);
  if (!current.unflushedSegments.length && !current.pendingPauseEvent) {
    await persistCurrent();
    return;
  }
  const segments = current.unflushedSegments;
  const durationMs = segments.reduce((sum, item) => sum + item.end - item.start, 0);
  const meaningful = current.totalDurationMs >= MIN_MEANINGFUL_SESSION_MS;
  const countSession = meaningful && !current.sessionCountRecorded;
  if (countSession) current.sessionCountRecorded = true;
  const event: SessionPauseEvent = current.pendingPauseEvent ?? {
    type: 'SESSION_PAUSED',
    platform: current.platform,
    timestamp: now,
    startedAt: current.startedAt,
    durationMs,
    meaningful,
    countSession,
    segments: [...segments],
    sessionId: current.sessionId,
    eventId: `${current.sessionId}:pause:${current.pauseSequence + 1}`,
  };
  current.pendingPauseEvent = event;
  current.pauseSequence += 1;
  if (!(await persistCurrent())) return;
  if (!(await track(event))) return;
  current.unflushedSegments = [];
  current.pendingPauseEvent = null;
  await persistCurrent();
}

async function finishCurrent(now: number): Promise<void> {
  if (!current) return;
  if (current.pendingPauseEvent) await flushPausedSegments(now);
  if (!current || current.pendingPauseEvent) return;
  closeActiveSegment(now);
  const meaningful = current.totalDurationMs >= MIN_MEANINGFUL_SESSION_MS;
  const event: SessionEndEvent = current.endingEvent ?? {
    type: 'SESSION_ENDED',
    platform: current.platform,
    timestamp: now,
    startedAt: current.startedAt,
    durationMs: current.totalDurationMs,
    meaningful,
    countSession: meaningful && !current.sessionCountRecorded,
    segments: [...current.unflushedSegments],
    sessionId: current.sessionId,
    eventId: `${current.sessionId}:end`,
  };
  current.endingEvent = event;
  if (!(await persistCurrent())) return;
  if (!(await track(event))) return;
  current = null;
  clearCheckpointTimer();
  await clearPersistedSession();
}

function handleAppState(next: AppStateStatus) {
  const observedAt = Date.now();
  void runSerial(async () => {
    if (!current || current.endingEvent) return;
    if (next === 'active' && current.activeSince === null) {
      current.activeSince = observedAt;
      startCheckpointTimer();
      await persistCurrent();
    } else if (next !== 'active' && current.activeSince !== null) {
      clearCheckpointTimer();
      await flushPausedSegments(observedAt);
    }
  });
}

function ensureAppStateListener() {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', handleAppState);
}

export async function startSession(platform: SocialPlatform, cleanModeActive = true): Promise<void> {
  if (!cleanModeActive) return;
  ensureAppStateListener();
  await runSerial(async () => {
    if (current?.platform === platform && !current.endingEvent) return;
    if (current) {
      await finishCurrent(Date.now());
      if (current) return;
    }
    const timestamp = Date.now();
    const sessionId = `${platform}:${timestamp}:${Math.random().toString(36).slice(2, 8)}`;
    const session: ActiveSession = {
      sessionId,
      platform,
      startedAt: timestamp,
      activeSince: AppState.currentState === 'active' ? timestamp : null,
      totalDurationMs: 0,
      unflushedSegments: [],
      sessionCountRecorded: false,
      pauseSequence: 0,
      pendingPauseEvent: null,
      endingEvent: null,
    };
    current = session;
    await track({ type: 'SESSION_STARTED', platform, timestamp, sessionId });
    await persistCurrent();
    if (session.activeSince !== null) startCheckpointTimer();
  });
}

export async function pauseSession(): Promise<void> {
  await runSerial(async () => {
    if (!current) return;
    clearCheckpointTimer();
    await flushPausedSegments(Date.now());
  });
}

export async function resumeSession(): Promise<void> {
  const timestamp = Date.now();
  await runSerial(async () => {
    if (!current || current.endingEvent || current.activeSince !== null) return;
    current.activeSince = timestamp;
    await persistCurrent();
    startCheckpointTimer();
  });
}

export async function endSession(platform?: SocialPlatform): Promise<void> {
  await runSerial(async () => {
    if (!current || (platform && platform !== current.platform)) return;
    clearCheckpointTimer();
    await finishCurrent(Date.now());
  });
}

function validSegmentList(value: unknown): value is ActiveTimeSegment[] {
  return Array.isArray(value) && value.every((segment) => Boolean(segment) && typeof segment.start === 'number' && typeof segment.end === 'number' && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end >= segment.start);
}

function isActiveSession(value: unknown): value is ActiveSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ActiveSession>;
  return typeof item.sessionId === 'string' && ['instagram', 'youtube', 'tiktok', 'x', 'reddit'].includes(String(item.platform)) &&
    typeof item.startedAt === 'number' && Number.isFinite(item.startedAt) &&
    (item.activeSince === null || (typeof item.activeSince === 'number' && Number.isFinite(item.activeSince))) &&
    typeof item.totalDurationMs === 'number' && Number.isFinite(item.totalDurationMs) && item.totalDurationMs >= 0 &&
    validSegmentList(item.unflushedSegments) && typeof item.sessionCountRecorded === 'boolean' &&
    typeof item.pauseSequence === 'number' && Number.isSafeInteger(item.pauseSequence) && item.pauseSequence >= 0 &&
    (item.pendingPauseEvent === null || (isValidAnalyticsEvent(item.pendingPauseEvent) && item.pendingPauseEvent.type === 'SESSION_PAUSED')) &&
    (item.endingEvent === null || (isValidAnalyticsEvent(item.endingEvent) && item.endingEvent.type === 'SESSION_ENDED'));
}

export async function restoreInterruptedSession(): Promise<void> {
  await runSerial(async () => {
    let raw: string | null;
    try { raw = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY); } catch { return; }
    if (!raw) return;
    let restored: unknown;
    try { restored = JSON.parse(raw); } catch { await clearPersistedSession(); return; }
    if (!isActiveSession(restored)) { await clearPersistedSession(); return; }
    current = { ...restored, activeSince: null, pendingPauseEvent: restored.pendingPauseEvent ?? null, endingEvent: restored.endingEvent ?? null };
    if (current.pendingPauseEvent) await flushPausedSegments(Date.now());
    if (!current || current.pendingPauseEvent) return;
    // Recover only segments checkpointed before termination; elapsed time since the last checkpoint is discarded.
    await finishCurrent(Date.now());
  });
}

export function getMinimumMeaningfulSessionMs() { return MIN_MEANINGFUL_SESSION_MS; }
export function getActiveSessionForTests() { return current; }
export function getActiveSessionSnapshot() {
  return current ? { platform: current.platform, startedAt: current.startedAt, accumulatedActiveMs: current.totalDurationMs, isForeground: current.activeSince !== null } : null;
}
export function resetSessionTracker() {
  appStateSubscription?.remove();
  appStateSubscription = null;
  clearCheckpointTimer();
  current = null;
  lifecycleQueue = Promise.resolve();
  void clearPersistedSession();
}

export const resetSessionTrackerForTests = resetSessionTracker;
