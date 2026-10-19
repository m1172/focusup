import { BackendError, createBackendClient } from './client';
import { SessionManager } from './sessionManager';
import { oauthSecretStorage, secretStorage } from './secretStorage';
import { useAccountStore } from '../../store/accountStore';

const endpoint = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
let validEndpoint = false;
try { createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__ }); validEndpoint = true; } catch { /* Local features remain usable without cloud configuration. */ }
export function isBackendConfigured() { return validEndpoint; }
export function accountApi(): ReturnType<typeof createBackendClient> {
  if (!validEndpoint) throw new BackendError(503, 'NOT_CONFIGURED', 'Cloud accounts are unavailable.');
  return createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAccessToken: () => accountSession.getAccessToken() });
}
export const accountSession: SessionManager = new SessionManager({
  origin: endpoint,
  storage: secretStorage('focusup.account.refresh.v1'),
  refresh: (refreshToken) => accountApi().refresh(refreshToken),
  onChange: (state) => useAccountStore.setState(state),
});
export async function forgetAccountSession() {
  const results = await Promise.allSettled([accountSession.clear(), oauthSecretStorage().remove()]);
  if (results.some((result) => result.status === 'rejected')) throw new BackendError(0, 'STORAGE_UNAVAILABLE', 'Unable to remove the saved session.');
}
export async function signOutAccount(): Promise<boolean> {
  let token: string | null = null;
  try { token = await accountSession.getAccessToken(); } catch { /* Local sign-out still works offline. */ }
  await forgetAccountSession();
  if (!token || !validEndpoint) return false;
  try {
    await createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAccessToken: () => token }).signOut();
    return true;
  } catch { return false; }
}
