import type { SocialAppId, SocialAppSettings } from '../../types/app';

export type StrictModeDuration = 30 | 60 | 120 | 240;
export type ProtectedPlatform = SocialAppId;
export type StrictModeProtectionSnapshot = Partial<Record<ProtectedPlatform, SocialAppSettings>>;
export type StrictModeSession = {
  id: string;
  startedAt: number;
  endsAt: number;
  protectedPlatforms: ProtectedPlatform[];
  active: true;
  nativeProtectionActive: boolean;
  protectionSnapshot: StrictModeProtectionSnapshot;
};

export function createStrictModeSession(
  durationMinutes: number,
  protectedPlatforms: ProtectedPlatform[],
  snapshot: StrictModeProtectionSnapshot,
  now = Date.now(),
): StrictModeSession {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    throw new RangeError('Strict Mode duration must be between 1 and 1,440 minutes.');
  }
  const platforms = [...new Set(protectedPlatforms)];
  if (!platforms.length) throw new RangeError('Select at least one protected platform.');
  return {
    id: `strict-${now}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: now,
    endsAt: now + durationMinutes * 60_000,
    protectedPlatforms: platforms,
    active: true,
    nativeProtectionActive: false,
    protectionSnapshot: Object.fromEntries(platforms.filter((id) => snapshot[id]).map((id) => [id, { ...snapshot[id]!, filters: { ...snapshot[id]!.filters } }])),
  };
}

export function getRemainingMs(session: Pick<StrictModeSession, 'endsAt'> | null | undefined, now = Date.now()): number {
  return session ? Math.max(0, session.endsAt - now) : 0;
}

export function isStrictModeExpired(session: Pick<StrictModeSession, 'endsAt'> | null | undefined, now = Date.now()): boolean {
  return Boolean(session && session.endsAt <= now);
}

export function normalizeStrictSession(value: unknown): StrictModeSession | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StrictModeSession> & { appIds?: SocialAppId[]; filters?: StrictModeProtectionSnapshot };
  if (typeof candidate.endsAt !== 'number' || !Number.isFinite(candidate.endsAt)) return null;
  const platforms = Array.isArray(candidate.protectedPlatforms)
    ? candidate.protectedPlatforms
    : Array.isArray(candidate.appIds) ? candidate.appIds : [];
  const valid = platforms.filter((id): id is SocialAppId => ['instagram', 'youtube', 'tiktok', 'x', 'reddit', 'snapchat', 'facebook', 'linkedin'].includes(id));
  if (!valid.length) return null;
  const startedAt = typeof candidate.startedAt === 'number' ? candidate.startedAt : candidate.endsAt - 60 * 60_000;
  const protectionSnapshot = candidate.protectionSnapshot ?? Object.fromEntries(valid.map((id) => [id, { enabled: true, filters: candidate.filters?.[id] ?? {} }]));
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `strict-restored-${startedAt}`,
    startedAt,
    endsAt: candidate.endsAt,
    protectedPlatforms: valid,
    active: true,
    nativeProtectionActive: candidate.nativeProtectionActive === true,
    protectionSnapshot,
  };
}
