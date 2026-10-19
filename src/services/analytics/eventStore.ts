import AsyncStorage from '@react-native-async-storage/async-storage';
import { addLocalDays, getLocalDateKey, splitIntervalByLocalDay } from '../../utils/date';
import type { AnalyticsStorage, BlockedFeature, DailyStatistics, FocusUpAnalyticsEvent, SocialPlatform } from './types';

export const ANALYTICS_SCHEMA_VERSION = 2;
/** Kept as a one-time migration source for the initial monolithic schema. */
export const ANALYTICS_STORAGE_KEY = '@focusup/local-analytics';
export const ANALYTICS_META_KEY = `${ANALYTICS_STORAGE_KEY}/meta`;
/** Legacy monolithic event list; read only during migration. */
export const ANALYTICS_EVENTS_KEY = `${ANALYTICS_STORAGE_KEY}/events`;
const RAW_EVENT_KEY_PREFIX = `${ANALYTICS_STORAGE_KEY}/event-day:`;
const DAILY_KEY_PREFIX = `${ANALYTICS_STORAGE_KEY}/day:`;
const RAW_EVENT_RETENTION_DAYS = 30;
const DAILY_RETENTION_DAYS = 400;
const emptyStorage = (): AnalyticsStorage => ({ schemaVersion: ANALYTICS_SCHEMA_VERSION, events: [], daily: {} });
let cache: AnalyticsStorage | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function emptyDay(dateKey: string): DailyStatistics {
  return { dateKey, cleanModeDurationMs: 0, sessionCount: 0, blockedAttempts: 0, platforms: {}, blockedByFeature: {} };
}

function eventDateKey(event: FocusUpAnalyticsEvent) { return getLocalDateKey(event.timestamp); }
function groupEvents(events: FocusUpAnalyticsEvent[]) {
  const grouped = new Map<string, FocusUpAnalyticsEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    const group = grouped.get(key) ?? [];
    group.push(event);
    grouped.set(key, group);
  }
  return grouped;
}

function dayFor(storage: AnalyticsStorage, dateKey: string): DailyStatistics {
  return storage.daily[dateKey] ?? (storage.daily[dateKey] = emptyDay(dateKey));
}

function addDuration(storage: AnalyticsStorage, platform: SocialPlatform, segments: { start: number; end: number }[]) {
  for (const segment of segments) {
    const split = splitIntervalByLocalDay(segment.start, segment.end);
    for (const [dateKey, durationMs] of Object.entries(split)) {
      const day = dayFor(storage, dateKey);
      const stats = day.platforms[platform] ?? (day.platforms[platform] = { durationMs: 0, sessionCount: 0, blockedAttempts: 0 });
      stats.durationMs += durationMs;
      day.cleanModeDurationMs += durationMs;
    }
  }
}

function addBlocked(storage: AnalyticsStorage, platform: SocialPlatform, feature: BlockedFeature, timestamp: number) {
  const day = dayFor(storage, getLocalDateKey(timestamp));
  const stats = day.platforms[platform] ?? (day.platforms[platform] = { durationMs: 0, sessionCount: 0, blockedAttempts: 0 });
  stats.blockedAttempts += 1;
  day.blockedAttempts += 1;
  day.blockedByFeature[feature] = (day.blockedByFeature[feature] ?? 0) + 1;
}

function applyEvent(storage: AnalyticsStorage, event: FocusUpAnalyticsEvent) {
  if (event.type === 'PROTECTION_EVENT' && event.event === 'temporary_access_completed') {
    const day = dayFor(storage, getLocalDateKey(event.timestamp));
    day.temporaryAccessCount = (day.temporaryAccessCount ?? 0) + 1;
    for (const [dateKey, durationMs] of Object.entries(splitIntervalByLocalDay(event.timestamp - event.durationMs, event.timestamp))) {
      const entry = dayFor(storage, dateKey); entry.temporaryAccessDurationMs = (entry.temporaryAccessDurationMs ?? 0) + durationMs;
    }
  } else if (event.type === 'SESSION_PAUSED') {
    addDuration(storage, event.platform, event.segments);
    if (event.countSession) incrementSessionCount(storage, event.platform, event.startedAt);
  } else if (event.type === 'SESSION_ENDED') {
    addDuration(storage, event.platform, event.segments);
    if (event.countSession) incrementSessionCount(storage, event.platform, event.startedAt);
  } else if (event.type === 'DISTRACTION_BLOCKED') {
    addBlocked(storage, event.platform, event.feature, event.timestamp);
  } else if (event.type === 'BLOCKED_NAVIGATION') {
    addBlocked(storage, event.platform, event.destination, event.timestamp);
  }
}

function incrementSessionCount(storage: AnalyticsStorage, platform: SocialPlatform, startedAt: number) {
  const day = dayFor(storage, getLocalDateKey(startedAt));
  day.sessionCount += 1;
  const stats = day.platforms[platform] ?? (day.platforms[platform] = { durationMs: 0, sessionCount: 0, blockedAttempts: 0 });
  stats.sessionCount += 1;
}

function cleanup(storage: AnalyticsStorage, now: number) {
  const rawCutoff = now - RAW_EVENT_RETENTION_DAYS * 86_400_000;
  storage.events = storage.events.filter((event) => event.timestamp >= rawCutoff);
  const dailyCutoff = getLocalDateKey(addLocalDays(new Date(now), -DAILY_RETENTION_DAYS).getTime());
  for (const dateKey of Object.keys(storage.daily)) if (dateKey < dailyCutoff) delete storage.daily[dateKey];
}

export function isValidAnalyticsEvent(value: unknown): value is FocusUpAnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (typeof event.timestamp !== 'number' || !Number.isFinite(event.timestamp)) return false;
  if (event.type === 'SUBSCRIPTION_EVENT') {
    return ['paywall_viewed', 'plan_selected', 'purchase_started', 'purchase_completed', 'purchase_cancelled', 'purchase_failed', 'restore_started', 'restore_completed'].includes(String(event.event)) &&
      (event.planId === undefined || event.planId === 'monthly' || event.planId === 'annual') &&
      (event.source === undefined || ['settings', 'instagram_clean_browsing', 'instagram_explore', 'instagram_suggested_posts', 'instagram_recommendations', 'youtube_home_recommendations', 'youtube_related_recommendations', 'youtube_comments', 'strict_mode', 'schedules', 'advanced_statistics'].includes(String(event.source)));
  }
  if (event.type === 'STRICT_MODE_EVENT') {
    return Number.isFinite(event.durationMinutes) && Number(event.durationMinutes) >= 0 && Number.isSafeInteger(event.protectedPlatformCount) && Number(event.protectedPlatformCount) >= 0 && ['strict_mode_started', 'strict_mode_completed', 'strict_mode_ended_early'].includes(String(event.event));
  }
  const platforms = ['instagram', 'youtube', 'tiktok', 'x', 'reddit', 'snapchat', 'facebook', 'linkedin'];
  if (!platforms.includes(String(event.platform))) return false;
  if (event.type === 'PROTECTION_EVENT') return ['temporary_access_started', 'temporary_access_completed'].includes(String(event.event)) && typeof event.durationMs === 'number' && Number.isFinite(event.durationMs) && event.durationMs >= 0 && (event.eventId === undefined || typeof event.eventId === 'string');
  if (event.type === 'SESSION_STARTED') return event.sessionId === undefined || typeof event.sessionId === 'string';
  if (event.type === 'SESSION_PAUSED' || event.type === 'SESSION_ENDED') {
    return typeof event.startedAt === 'number' && Number.isFinite(event.startedAt) && Number.isFinite(event.durationMs) && Number(event.durationMs) >= 0 &&
      typeof event.meaningful === 'boolean' && typeof event.countSession === 'boolean' && Array.isArray(event.segments) &&
      event.segments.every((segment) => Boolean(segment) && typeof segment.start === 'number' && Number.isFinite(segment.start) && typeof segment.end === 'number' && Number.isFinite(segment.end) && segment.end >= segment.start) &&
      (event.sessionId === undefined || typeof event.sessionId === 'string') && (event.eventId === undefined || typeof event.eventId === 'string');
  }
  if (event.type === 'DISTRACTION_BLOCKED') return ['reels', 'shorts', 'explore', 'recommendations', 'suggestedPosts'].includes(String(event.feature)) && ['navigation', 'interaction'].includes(String(event.source));
  if (event.type === 'BLOCKED_NAVIGATION') return event.destination === 'reels' || event.destination === 'shorts';
  return false;
}

function decodeLegacy(raw: string | null): AnalyticsStorage {
  if (!raw) return emptyStorage();
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsStorage>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.events) || !parsed.daily || typeof parsed.daily !== 'object') return emptyStorage();
    const daily = Object.fromEntries(Object.entries(parsed.daily).filter((entry): entry is [string, DailyStatistics] => isValidDay(entry[1])));
    return { schemaVersion: ANALYTICS_SCHEMA_VERSION, events: parsed.events.filter(isValidAnalyticsEvent), daily };
  } catch { return emptyStorage(); }
}

function isValidDay(value: unknown): value is DailyStatistics {
  if (!value || typeof value !== 'object') return false;
  const day = value as Partial<DailyStatistics>;
  return typeof day.dateKey === 'string' && typeof day.cleanModeDurationMs === 'number' && typeof day.sessionCount === 'number' && typeof day.blockedAttempts === 'number' && Boolean(day.platforms) && Boolean(day.blockedByFeature);
}

async function load(): Promise<AnalyticsStorage> {
  if (cache) return cache;
  const [metaRaw, keys] = await Promise.all([
    AsyncStorage.getItem(ANALYTICS_META_KEY),
    AsyncStorage.getAllKeys(),
  ]);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as { schemaVersion?: number };
      if (meta.schemaVersion === ANALYTICS_SCHEMA_VERSION || meta.schemaVersion === 1) {
        const dailyKeys = keys.filter((key) => key.startsWith(DAILY_KEY_PREFIX));
        const values = dailyKeys.length ? await AsyncStorage.multiGet(dailyKeys) : [];
        const daily: AnalyticsStorage['daily'] = {};
        for (const [key, value] of values) {
          if (!value) continue;
          try {
            const entry: unknown = JSON.parse(value);
            if (isValidDay(entry)) daily[key.slice(DAILY_KEY_PREFIX.length)] = entry;
          } catch { /* Ignore corrupt dates while preserving other local aggregates. */ }
        }
        const rawEventKeys = keys.filter((key) => key.startsWith(RAW_EVENT_KEY_PREFIX));
        const valuesByDay = rawEventKeys.length ? await AsyncStorage.multiGet(rawEventKeys) : [];
        let events: FocusUpAnalyticsEvent[] = [];
        for (const [, value] of valuesByDay) {
          if (!value) continue;
          try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) events.push(...parsed.filter(isValidAnalyticsEvent)); } catch { /* Ignore a damaged shard; aggregates remain usable. */ }
        }
        // Read the initial v1 event array once, then the next write migrates it to date shards.
        let migrateLegacyEventList = meta.schemaVersion === 1;
        if (!rawEventKeys.length) {
          try { const oldRaw = await AsyncStorage.getItem(ANALYTICS_EVENTS_KEY); const parsed: unknown = JSON.parse(oldRaw ?? '[]'); if (Array.isArray(parsed)) { events = parsed.filter(isValidAnalyticsEvent); migrateLegacyEventList = oldRaw !== null; } } catch { /* Ignore damaged legacy raw events. */ }
        }
        cache = { schemaVersion: ANALYTICS_SCHEMA_VERSION, events, daily };
        if (migrateLegacyEventList) await persist(cache, Object.keys(daily), [], [...groupEvents(events).keys()], [], true);
        return cache;
      }
    } catch { /* Unknown or invalid versions start clean without importing untrusted data. */ }
  }

  const legacy = decodeLegacy(await AsyncStorage.getItem(ANALYTICS_STORAGE_KEY));
  cache = legacy;
  await persist(legacy, Object.keys(legacy.daily), [], [...groupEvents(legacy.events).keys()], [], true);
  await AsyncStorage.removeItem(ANALYTICS_STORAGE_KEY);
  return cache;
}

async function persist(storage: AnalyticsStorage, changedDays: string[], removedDays: string[], changedEventDates: string[], removedEventDates: string[], clearLegacyEvents = false): Promise<void> {
  cache = storage;
  const entries: [string, string][] = [[ANALYTICS_META_KEY, JSON.stringify({ schemaVersion: ANALYTICS_SCHEMA_VERSION })]];
  const groupedEvents = groupEvents(storage.events);
  for (const dateKey of changedEventDates) {
    const events = groupedEvents.get(dateKey) ?? [];
    if (events.length) entries.push([`${RAW_EVENT_KEY_PREFIX}${dateKey}`, JSON.stringify(events)]);
  }
  for (const dateKey of changedDays) {
    const day = storage.daily[dateKey];
    if (day) entries.push([`${DAILY_KEY_PREFIX}${dateKey}`, JSON.stringify(day)]);
  }
  if (entries.length) await AsyncStorage.multiSet(entries);
  if (removedDays.length) await AsyncStorage.multiRemove(removedDays.map((dateKey) => `${DAILY_KEY_PREFIX}${dateKey}`));
  if (removedEventDates.length) await AsyncStorage.multiRemove(removedEventDates.map((dateKey) => `${RAW_EVENT_KEY_PREFIX}${dateKey}`));
  if (clearLegacyEvents) await AsyncStorage.removeItem(ANALYTICS_EVENTS_KEY);
}

async function persistCleanup(storage: AnalyticsStorage, before: { events: string; days: string[] }, now: number) {
  cleanup(storage, now);
  const beforeByDay = groupEvents(JSON.parse(before.events) as FocusUpAnalyticsEvent[]);
  const afterByDay = groupEvents(storage.events);
  const changedEventDates = [...afterByDay.keys()].filter((date) => JSON.stringify(beforeByDay.get(date) ?? []) !== JSON.stringify(afterByDay.get(date) ?? []));
  const removedEventDates = [...beforeByDay.keys()].filter((date) => !afterByDay.has(date));
  const remaining = new Set(Object.keys(storage.daily));
  const removed = before.days.filter((dateKey) => !remaining.has(dateKey));
  if (changedEventDates.length || removedEventDates.length || removed.length) await persist(storage, [], removed, changedEventDates, removedEventDates);
}

export async function getAnalyticsStorage(): Promise<AnalyticsStorage> {
  await writeQueue;
  const storage = await load();
  const before = { events: JSON.stringify(storage.events), days: Object.keys(storage.daily) };
  await persistCleanup(storage, before, Date.now());
  return storage;
}

export async function appendAnalyticsEvent(event: FocusUpAnalyticsEvent): Promise<void> {
  if (!isValidAnalyticsEvent(event)) throw new Error('Invalid analytics event');
  const operation = writeQueue.then(async () => {
    const storage = await load();
    const eventId = 'eventId' in event ? event.eventId : undefined;
    if (eventId && storage.events.some((existing) => 'eventId' in existing && existing.eventId === eventId)) return;
    const before = { days: Object.keys(storage.daily), dayValues: new Map(Object.entries(storage.daily).map(([key, value]) => [key, JSON.stringify(value)])) };
    storage.events.push(event);
    applyEvent(storage, event);
    cleanup(storage, Date.now());
    const changedDays = Object.entries(storage.daily).filter(([key, value]) => before.dayValues.get(key) !== JSON.stringify(value)).map(([key]) => key);
    const remaining = new Set(Object.keys(storage.daily));
    const removedDays = before.days.filter((dateKey) => !remaining.has(dateKey));
    const changedEventDates = [eventDateKey(event)];
    const retainedDates = new Set(groupEvents(storage.events).keys());
    const oldShardKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(RAW_EVENT_KEY_PREFIX)).map((key) => key.slice(RAW_EVENT_KEY_PREFIX.length));
    const removedEventDates = oldShardKeys.filter((dateKey) => !retainedDates.has(dateKey));
    await persist(storage, changedDays, removedDays, changedEventDates, removedEventDates);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
}

export async function cleanupOldAnalyticsEvents(now = Date.now()): Promise<void> {
  const operation = writeQueue.then(async () => {
    const storage = await load();
    const before = { events: JSON.stringify(storage.events), days: Object.keys(storage.daily) };
    await persistCleanup(storage, before, now);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
}

export function resetAnalyticsCache() { cache = null; writeQueue = Promise.resolve(); }

export const resetAnalyticsCacheForTests = resetAnalyticsCache;
