import type { SocialAppId, SocialAppSettings } from '../../types/app';
import type { ProtectedPlatform, StrictModeProtectionSnapshot } from './types';
import { createStrictModeSession, getRemainingMs, isStrictModeExpired, normalizeStrictSession } from './types';

export { createStrictModeSession, getRemainingMs, isStrictModeExpired, normalizeStrictSession };
export type { ProtectedPlatform, StrictModeSession, StrictModeProtectionSnapshot } from './types';

export function snapshotProtectedSettings(apps: Record<SocialAppId, SocialAppSettings>, platforms: ProtectedPlatform[]): StrictModeProtectionSnapshot {
  return Object.fromEntries(platforms.map((id) => [id, { ...apps[id], filters: { ...apps[id].filters } }]));
}
