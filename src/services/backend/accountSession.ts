import { BackendError, createBackendClient } from './client';
import { SessionManager } from './sessionManager';
import { oauthSecretStorage, secretStorage } from './secretStorage';
import { useAccountStore } from '../../store/accountStore';
import { useProfileStore } from '../../store/profileStore';
import { unregisterSupportPush } from '../notifications/supportPush';
import { captureAppException, initializeProductAnalytics, setProductAnalyticsIdentity } from '../analytics/productAnalytics';

const endpoint = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
let validEndpoint = false;
try { createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__ }); validEndpoint = true; } catch { /* An unconfigured build cannot admit users. */ }
export function isBackendConfigured() { return validEndpoint; }
export function accountApi(): ReturnType<typeof createBackendClient> {
  if (!validEndpoint) throw new BackendError(503, 'NOT_CONFIGURED', 'Cloud accounts are unavailable.');
  return createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAccessToken: () => accountSession.getAccessToken() });
}
export const accountSession: SessionManager = new SessionManager({
  origin: endpoint,
  storage: secretStorage('focusup.account.refresh.v1'),
  refresh: (refreshToken) => accountApi().refresh(refreshToken),
  onChange: (state) => { if (state.ready) setProductAnalyticsIdentity(state.user?.id ?? null); useAccountStore.setState(state); },
});
export async function forgetAccountSession() {
  // While the access token is still known, stop team replies for this account reaching the device.
  const token = accountSession.getCachedAccessToken();
  await unregisterSupportPush(token && validEndpoint ? createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAccessToken: () => token }) : null).catch(() => undefined);
  useProfileStore.getState().setProfile(null);
  const results = await Promise.allSettled([accountSession.clear(), oauthSecretStorage().remove()]);
  if (results.some((result) => result.status === 'rejected')) throw new BackendError(0, 'STORAGE_UNAVAILABLE', 'Unable to remove the saved session.');
}
export async function signOutAccount(): Promise<boolean> {
  const token = accountSession.getCachedAccessToken();
  await forgetAccountSession();
  if (!token || !validEndpoint) return false;
  try {
    await createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAccessToken: () => token }).signOut();
    return true;
  } catch { return false; }
}

/** Network outages retain the securely restored account; rejected tokens clear it in SessionManager. */
export async function refreshAccountSession(): Promise<void> {
  try {
    await accountSession.initialize();
    if (!isBackendConfigured()) { await accountSession.clear(); return; }
    if (accountSession.getState().user) await accountSession.getAccessToken();
  } catch (error) { await initializeProductAnalytics(); captureAppException(error, 'session_restoration'); /* Offline users retain access. */ }
}
