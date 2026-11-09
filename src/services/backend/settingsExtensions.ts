import type { SocialAppId } from '../../types/app';
import type { CloudBackup, CloudSettings, CloudSettingsExtensions } from './types';

/**
 * Backups made by this build keep the newer settings in `extensions` (backend/src/settingsCompat.ts):
 * grayscale, daily limits and the filters the first backup format doesn't know. The old fields stay exactly
 * as before, so servers that haven't been updated still accept the rest of the backup.
 */
export const EXTENSION_FILTERS = ['stories', 'messagesOnly'] as const;
const isExtensionFilter = (key: string) => (EXTENSION_FILTERS as readonly string[]).includes(key);

type Filters = Record<string, boolean>;
const withoutExtensionFilters = (filters: Filters | undefined) => filters ? Object.fromEntries(Object.entries(filters).filter(([key]) => !isExtensionFilter(key))) : filters;

/** Moves the newer filters out of the old fields and adds grayscale and daily limits. */
export function addExtensions(settings: CloudSettings, local: { grayscale: boolean; dailyLimits: Partial<Record<SocialAppId, number>> }): CloudSettings {
  const filters: NonNullable<CloudSettingsExtensions['filters']> = {};
  const apps = Object.fromEntries(Object.entries(settings.preferences.apps).map(([appId, app]) => {
    const moved = Object.fromEntries(Object.entries(app.filters).filter(([key]) => isExtensionFilter(key)));
    if (Object.keys(moved).length) filters[appId as SocialAppId] = moved;
    return [appId, { ...app, filters: withoutExtensionFilters(app.filters) ?? {} }];
  })) as CloudSettings['preferences']['apps'];
  // Routine filters are copies of an app's filters; the newer ones aren't kept per routine.
  const schedules = settings.preferences.schedules.map((schedule) => schedule.filters
    ? { ...schedule, filters: Object.fromEntries(Object.entries(schedule.filters).map(([appId, value]) => [appId, withoutExtensionFilters(value) ?? {}])) }
    : schedule);
  const extensions: CloudSettingsExtensions = { version: 1, grayscale: local.grayscale, dailyLimits: { ...local.dailyLimits } };
  if (Object.keys(filters).length) extensions.filters = filters;
  return { ...settings, preferences: { ...settings.preferences, apps, schedules }, extensions };
}

/** The settings a backup restores, with its extensions put back into the app filters. Null fields mean "keep what's on the phone". */
export function readExtensions(settings: CloudSettings) {
  const extensions = settings.extensions;
  const apps = Object.fromEntries(Object.entries(settings.preferences.apps).map(([appId, app]) => [appId, { ...app, filters: { ...app.filters, ...(extensions?.filters?.[appId as SocialAppId] ?? {}) } }])) as CloudSettings['preferences']['apps'];
  return { apps, grayscale: extensions?.grayscale ?? null, dailyLimits: extensions?.dailyLimits ?? null };
}

export function withoutExtensions(settings: CloudSettings): CloudSettings {
  const copy = { ...settings };
  delete copy.extensions;
  return copy;
}

const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String(error.code) : '';

/**
 * A server that hasn't been updated rejects `extensions` (VALIDATION_ERROR). Then the backup is saved without
 * them, so everything else is still backed up; the extensions are sent again on the next change.
 */
export async function saveCompatible(save: (revision: number, payload: CloudSettings) => Promise<CloudBackup>, revision: number, payload: CloudSettings): Promise<CloudBackup> {
  try { return await save(revision, payload); }
  catch (error) {
    if (!payload.extensions || errorCode(error) !== 'VALIDATION_ERROR') throw error;
    return save(revision, withoutExtensions(payload));
  }
}
