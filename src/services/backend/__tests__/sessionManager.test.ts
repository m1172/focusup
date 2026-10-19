import { BackendError } from '../client';
import { SessionManager, type StoredSession } from '../sessionManager';
import type { AuthSession } from '../types';

const origin = 'https://api.example.com';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' };
const session = (token = 'access', expiresAt = 2000): AuthSession => ({ accessToken: token, refreshToken: `refresh-${token}`, expiresAt, user });
const stored = (): StoredSession => ({ origin, refreshToken: 'saved-refresh', user, recoveryRequired: false });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(raw: string | null = null, refresh = jest.fn().mockResolvedValue(session('new'))) {
  let value = raw;
  const storage = { read: jest.fn(async () => value), write: jest.fn(async (next: string) => { value = next; }), remove: jest.fn(async () => { value = null; }) };
  const onChange = jest.fn();
  const manager = new SessionManager({ origin, storage, refresh, onChange, now: () => 1_000_000 });
  return { manager, storage, refresh, onChange, value: () => value };
}

test('restores only the bound account metadata and refreshes once for concurrent requests', async () => {
  const pending = deferred<AuthSession>();
  const { manager, storage, refresh } = setup(JSON.stringify(stored()), jest.fn(() => pending.promise));
  await manager.initialize(); expect(refresh).not.toHaveBeenCalled(); expect(manager.getState().user).toEqual(user);
  const first = manager.getAccessToken(), second = manager.getAccessToken();
  await Promise.resolve(); pending.resolve(session('new'));
  await expect(first).resolves.toBe('new'); await expect(second).resolves.toBe('new');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(JSON.parse(storage.write.mock.calls[0][0])).not.toHaveProperty('accessToken');
  expect(JSON.parse(storage.write.mock.calls[0][0]).refreshToken).toBe('refresh-new');
});

test('late refresh cannot sign the user back in after local sign-out', async () => {
  const pending = deferred<AuthSession>();
  const { manager, value } = setup(JSON.stringify(stored()), jest.fn(() => pending.promise));
  const token = manager.getAccessToken(); await manager.initialize(); await Promise.resolve();
  await manager.clear(); pending.resolve(session('late'));
  await expect(token).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(manager.getState().user).toBeNull(); expect(value()).toBeNull();
});

test('offline refresh retains the account; invalid refresh clears it', async () => {
  const refresh = jest.fn().mockRejectedValue(new BackendError(0, 'NETWORK_ERROR', 'offline'));
  const { manager, value } = setup(JSON.stringify(stored()), refresh);
  await expect(manager.getAccessToken()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(manager.getState().user).toEqual(user); expect(value()).not.toBeNull();
  refresh.mockRejectedValue(new BackendError(401, 'AUTH_FAILED', 'invalid'));
  await expect(manager.getAccessToken()).rejects.toMatchObject({ status: 401 });
  expect(manager.getState().user).toBeNull(); expect(value()).toBeNull();
});

test('an old origin or corrupt record is removed without attempting a refresh', async () => {
  for (const raw of ['{broken', JSON.stringify({ ...stored(), origin: 'https://other.example.com' })]) {
    const { manager, value, refresh } = setup(raw);
    await manager.initialize(); expect(manager.getState().user).toBeNull(); expect(value()).toBeNull(); expect(refresh).not.toHaveBeenCalled();
  }
});

test('pending initialization and pending sign-in cannot undo local sign-out', async () => {
  const pending = deferred<string | null>();
  const { manager, storage } = setup(); storage.read.mockImplementation(() => pending.promise);
  const generation = manager.beginAuthentication(), initialization = manager.initialize();
  await manager.clear(); pending.resolve(JSON.stringify(stored())); await initialization;
  await manager.initialize(); expect(manager.getState().user).toBeNull();
  await expect(manager.accept(session(), false, generation)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
});

test('ordered storage deletes a session even if a write was already in progress', async () => {
  const entered = deferred<void>(), release = deferred<void>();
  const { manager, storage } = setup();
  storage.write.mockImplementation(async () => { entered.resolve(); await release.promise; });
  const accepted = manager.accept(session()).catch((error: unknown) => error);
  await entered.promise; const cleared = manager.clear(); release.resolve();
  await expect(accepted).resolves.toMatchObject({ code: 'SESSION_CHANGED' }); await cleared;
  expect(manager.getState().user).toBeNull(); expect(storage.remove).toHaveBeenCalledTimes(1);
});

test('failed secure writes do not publish a new session; recovery survives refresh', async () => {
  const { manager, storage } = setup();
  storage.write.mockRejectedValueOnce(new Error('keychain unavailable'));
  await expect(manager.accept(session())).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  expect(manager.getState().user).toBeNull();
  await manager.accept(session(), true);
  expect(manager.getState().recoveryRequired).toBe(true);
  expect(JSON.parse(storage.write.mock.calls.at(-1)![0]).recoveryRequired).toBe(true);
  await manager.finishRecovery(); expect(manager.getState().recoveryRequired).toBe(false);
});
