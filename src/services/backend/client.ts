import type { Account, AccountExport, AccountProfile, AuthSession, CloudBackup, CloudSettings, Credentials, OAuthProvider } from './types';

export class BackendError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

type Options = {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Explicit opt-in for a local development server. Keep false in distributed builds. */
  allowInsecureHttp?: boolean;
  fetch?: typeof fetch;
};

/** Tokens are supplied by the caller. This client never persists passwords or tokens,
 * retries writes, or uploads data in the background. Store refresh tokens securely
 * when adding the account UI, and serialize refresh calls to avoid token reuse. */
export function createBackendClient(options: Options) {
  const base = new URL(options.baseUrl);
  if (base.protocol !== 'https:' && !(options.allowInsecureHttp && base.protocol === 'http:')) throw new Error('Backend URL must use HTTPS.');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Backend URL must be an origin without credentials, a path, or query parameters.');
  const fetcher = options.fetch ?? fetch;

  async function request<T>(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<T> {
    const token = authenticated ? await options.getAccessToken?.() : null;
    if (authenticated && !token) throw new BackendError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(new URL(path, base).toString(), {
        method, headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
      });
      if (response.status === 204) return undefined as T;
      const decoded: unknown = await response.json();
      if (!response.ok) {
        const detail = decoded && typeof decoded === 'object' && 'error' in decoded ? decoded.error : null;
        const code = detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string' ? detail.code : 'REQUEST_FAILED';
        const message = detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string' ? detail.message : 'Unable to complete the request.';
        throw new BackendError(response.status, code, message);
      }
      return decoded as T;
    } catch (error) {
      if (error instanceof BackendError) throw error;
      throw new BackendError(0, 'NETWORK_ERROR', 'Unable to reach FocusUp. Please try again.');
    } finally { clearTimeout(timer); }
  }

  return {
    getProviders: () => request<{ emailPassword: boolean; oauth: OAuthProvider[] }>('/v1/auth/providers', 'GET', undefined, false),
    signUp: (credentials: Credentials) => request<{ session: AuthSession | null; confirmationRequired: boolean }>('/v1/auth/sign-up', 'POST', credentials, false),
    signIn: (credentials: Credentials) => request<AuthSession>('/v1/auth/sign-in', 'POST', credentials, false),
    refresh: (refreshToken: string) => request<AuthSession>('/v1/auth/refresh', 'POST', { refreshToken }, false),
    verifyEmail: (tokenHash: string, type: 'email' | 'recovery') => request<AuthSession>('/v1/auth/verify', 'POST', { tokenHash, type }, false),
    verifyCode: (email: string, token: string, type: 'signup' | 'recovery') => request<AuthSession>('/v1/auth/verify-code', 'POST', { email, token, type }, false),
    resendConfirmation: (email: string, captchaToken?: string) => request<{ message: string }>('/v1/auth/resend-confirmation', 'POST', { email, captchaToken }, false),
    forgotPassword: (email: string, captchaToken?: string) => request<{ message: string }>('/v1/auth/forgot-password', 'POST', { email, captchaToken }, false),
    changePassword: (password: string) => request<void>('/v1/auth/password', 'PATCH', { password }),
    startOAuth: (provider: OAuthProvider, codeChallenge: string) => request<{ url: string; redirectUrl: string }>('/v1/auth/oauth/start', 'POST', { provider, codeChallenge }, false),
    exchangeOAuth: (code: string, codeVerifier: string) => request<AuthSession>('/v1/auth/oauth/exchange', 'POST', { code, codeVerifier }, false),
    signInWithIdToken: (provider: 'apple' | 'google', idToken: string, nonce: string) => request<AuthSession>('/v1/auth/id-token', 'POST', { provider, idToken, nonce }, false),
    signOut: () => request<void>('/v1/auth/sign-out', 'POST'),
    getAccount: () => request<Account>('/v1/me'),
    saveProfile: (displayName: string) => request<AccountProfile>('/v1/me/profile', 'PUT', { displayName }),
    getSettings: () => request<CloudBackup>('/v1/me/settings'),
    saveSettings: (expectedRevision: number, payload: CloudSettings) => request<CloudBackup>('/v1/me/settings', 'PUT', { expectedRevision, payload }),
    deleteSettings: (expectedRevision: number) => request<CloudBackup>('/v1/me/settings', 'DELETE', { expectedRevision }),
    exportAccount: () => request<AccountExport>('/v1/me/export'),
    deleteAccount: () => request<void>('/v1/me', 'DELETE'),
  };
}
