import { BackendError } from './client';
import type { AuthSession } from './types';

export type SessionState = { ready: boolean; user: AuthSession['user'] | null; recoveryRequired: boolean };
export type StoredSession = { origin: string; refreshToken: string; user: AuthSession['user']; recoveryRequired: boolean };
export type SecretStorage = { read(): Promise<string | null>; write(value: string): Promise<void>; remove(): Promise<void> };

function validUser(value: unknown): value is AuthSession['user'] {
  if (!value || typeof value !== 'object') return false;
  const user = value as AuthSession['user'];
  return typeof user.id === 'string' && /^[a-f0-9-]{36}$/i.test(user.id) && (user.email === null || typeof user.email === 'string' && user.email.length <= 254);
}
function parseStored(raw: string, origin: string): StoredSession | null {
  try {
    const item = JSON.parse(raw) as StoredSession;
    return item.origin === origin && validUser(item.user) && typeof item.refreshToken === 'string' && item.refreshToken.length > 0 && item.refreshToken.length <= 4096 && typeof item.recoveryRequired === 'boolean' ? item : null;
  } catch { return null; }
}

/** Refresh is single-flight. Generation checks and ordered storage operations stop
 * an old refresh/initialization from restoring an account after local sign-out. */
export class SessionManager {
  private state: SessionState = { ready: false, user: null, recoveryRequired: false };
  private session: AuthSession | null = null;
  private stored: StoredSession | null = null;
  private generation = 0;
  private writes = Promise.resolve();
  private initialization: Promise<void> | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  constructor(private options: { origin: string; storage: SecretStorage; refresh: (token: string) => Promise<AuthSession>; onChange: (state: SessionState) => void; now?: () => number }) {}
  getState() { return this.state; }
  /** Best-effort server sign-out must never delay clearing the local account. */
  getCachedAccessToken(): string | null { return this.session?.accessToken ?? null; }
  private publish(state: SessionState) { this.state = state; this.options.onChange(state); }
  private enqueue(operation: () => Promise<void>) { const next = this.writes.then(operation); this.writes = next.catch(() => undefined); return next; }
  initialize(): Promise<void> {
    if (this.initialization) return this.initialization;
    const generation = this.generation;
    this.initialization = (async () => {
      try {
        const raw = await this.options.storage.read();
        if (generation !== this.generation) return;
        const stored = raw ? parseStored(raw, this.options.origin) : null;
        if (raw && !stored) await this.enqueue(() => this.options.storage.remove());
        if (generation !== this.generation) return;
        this.stored = stored;
        this.publish({ ready: true, user: stored?.user ?? null, recoveryRequired: stored?.recoveryRequired ?? false });
      } catch {
        if (generation === this.generation) this.publish({ ready: true, user: null, recoveryRequired: false });
        if (generation === this.generation) this.initialization = null;
        throw new BackendError(0, 'STORAGE_UNAVAILABLE', 'Secure storage is unavailable.');
      }
    })();
    return this.initialization;
  }
  private async commit(session: AuthSession, recoveryRequired: boolean, generation: number): Promise<void> {
    if (!validUser(session.user) || !session.accessToken || !session.refreshToken || session.refreshToken.length > 4096 || session.expiresAt !== null && !Number.isFinite(session.expiresAt)) throw new BackendError(502, 'INVALID_SESSION', 'Invalid authentication response.');
    const stored: StoredSession = { origin: this.options.origin, refreshToken: session.refreshToken, user: session.user, recoveryRequired };
    await this.enqueue(async () => {
      if (generation !== this.generation) throw new BackendError(401, 'SESSION_CHANGED', 'The account changed.');
      try { await this.options.storage.write(JSON.stringify(stored)); }
      catch { throw new BackendError(0, 'STORAGE_UNAVAILABLE', 'Unable to save the session securely.'); }
      if (generation !== this.generation) throw new BackendError(401, 'SESSION_CHANGED', 'The account changed.');
      this.session = session; this.stored = stored;
      this.publish({ ready: true, user: session.user, recoveryRequired });
    });
  }
  /** Capture before a sign-in request; a late response must not override sign-out. */
  beginAuthentication() { return this.generation; }
  async accept(session: AuthSession, recoveryRequired = false, expectedGeneration = this.generation) {
    await this.initialize();
    if (expectedGeneration !== this.generation) throw new BackendError(401, 'SESSION_CHANGED', 'The account changed.');
    const generation = ++this.generation;
    this.refreshPromise = null;
    await this.commit(session, recoveryRequired, generation);
  }
  async getAccessToken(): Promise<string | null> {
    await this.initialize();
    if (!this.stored) return null;
    const now = (this.options.now?.() ?? Date.now()) / 1000;
    if (this.session?.expiresAt && this.session.expiresAt > now + 60) return this.session.accessToken;
    if (this.refreshPromise) return this.refreshPromise;
    const generation = this.generation, stored = this.stored;
    const operation = (async () => {
      try {
        const session = await this.options.refresh(stored.refreshToken);
        if (generation !== this.generation) throw new BackendError(401, 'SESSION_CHANGED', 'The account changed.');
        if (session.user.id !== stored.user.id) throw new BackendError(401, 'INVALID_SESSION', 'The session belongs to another account.');
        await this.commit(session, stored.recoveryRequired, generation);
        return session.accessToken;
      } catch (error) {
        if (generation === this.generation && error instanceof BackendError && (error.status === 401 || error.code === 'STORAGE_UNAVAILABLE')) await this.clear();
        throw error;
      }
    })();
    this.refreshPromise = operation;
    try { return await operation; } finally { if (this.refreshPromise === operation) this.refreshPromise = null; }
  }
  async finishRecovery() {
    await this.getAccessToken();
    if (!this.session) throw new BackendError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    await this.commit(this.session, false, this.generation);
  }
  async clear() {
    ++this.generation; this.session = null; this.stored = null; this.refreshPromise = null;
    this.initialization = Promise.resolve();
    this.publish({ ready: true, user: null, recoveryRequired: false });
    try { await this.enqueue(() => this.options.storage.remove()); }
    catch { throw new BackendError(0, 'STORAGE_UNAVAILABLE', 'Unable to remove the saved session.'); }
  }
}
