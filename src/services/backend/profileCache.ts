import { useProfileStore } from '../../store/profileStore';
import { accountApi } from './accountSession';

/** The name changes only when the user edits it (saved here at once), so a day-old copy is fresh enough. */
const MAX_AGE_MS = 24 * 60 * 60_000;
let inFlight: { userId: string; request: Promise<string | null> } | null = null;

const hydrated = () => useProfileStore.persist.hasHydrated() ? Promise.resolve()
  : new Promise<void>((resolve) => { const stop = useProfileStore.persist.onFinishHydration(() => { stop(); resolve(); }); });

/** The saved display name for this user, or '' when none is saved yet. */
export function cachedDisplayName(userId: string | undefined): string {
  const profile = useProfileStore.getState().profile;
  return userId && profile?.userId === userId ? profile.displayName : '';
}

/** Saves a name the server confirmed, e.g. after the user edits it. */
export function rememberProfile(userId: string, displayName: string) {
  useProfileStore.getState().setProfile({ userId, displayName, fetchedAt: Date.now() });
}

/**
 * Returns the display name, asking the server only when nothing fresh is saved for this user.
 * Concurrent callers (Settings and Account opening together) share one request.
 */
export async function loadProfile(userId: string): Promise<string | null> {
  await hydrated();
  const saved = useProfileStore.getState().profile;
  if (saved?.userId === userId && Date.now() - saved.fetchedAt < MAX_AGE_MS) return saved.displayName;
  if (inFlight?.userId === userId) return inFlight.request;
  const request = accountApi().getAccount().then((account) => {
    if (account.id !== userId) return null;
    rememberProfile(userId, account.profile.displayName);
    return account.profile.displayName;
  }).finally(() => { if (inFlight?.request === request) inFlight = null; });
  inFlight = { userId, request };
  return request;
}
