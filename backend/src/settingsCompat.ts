import type { Backup } from './gateway.ts';
import type { Settings } from './schemas.ts';

/**
 * Settings backups have two client versions:
 * 1. builds before November 2026: no `extensions`, and their strict check rejects a backup that has one;
 * 2. newer builds send `x-vaqtim-settings: 2` and keep grayscale, daily limits and the newer filters in `extensions`.
 */
export const SETTINGS_VERSION_HEADER = 'x-vaqtim-settings';

export function settingsClientVersion(value: string | string[] | null | undefined): 1 | 2 {
  return (Array.isArray(value) ? value[0] : value) === '2' ? 2 : 1;
}

/** Older builds never see `extensions`, so their own check keeps accepting the backup. */
export function backupForClient(backup: Backup, version: 1 | 2): Backup {
  if (version === 2 || !backup.payload?.extensions) return backup;
  const payload = { ...backup.payload };
  delete payload.extensions;
  return { ...backup, payload };
}

/**
 * A save from an older build has no `extensions`. Keep the stored ones so that build can't erase settings
 * it doesn't know about. Only when the save is based on the current revision; otherwise the save fails anyway.
 */
export async function payloadToSave(payload: Settings, expectedRevision: number, version: 1 | 2, current: () => Promise<Backup>): Promise<Settings> {
  if (version === 2 || payload.extensions) return payload;
  const stored = await current();
  if (stored.revision !== expectedRevision || !stored.payload?.extensions) return payload;
  return { ...payload, extensions: stored.payload.extensions };
}
