import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import type { Settings } from './schemas.ts';

export type Session = { accessToken: string; refreshToken: string; expiresAt: number | null; user: { id: string; email: string | null } };
export type Backup = { revision: number; payload: Settings | null; updatedAt: string | null };
export type Profile = { displayName: string; updatedAt: string | null };
export type Identity = { id: string; email: string | null; token: string };
export type Credentials = { email: string; password: string; captchaToken?: string };
export interface Gateway {
  authenticate(token: string): Promise<Identity>;
  signUp(credentials: Credentials): Promise<{ session: Session | null; confirmationRequired: boolean }>;
  signIn(credentials: Credentials): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  exchangeOAuth(code: string, codeVerifier: string): Promise<Session>;
  signInWithIdToken(provider: 'apple' | 'google', token: string, nonce: string): Promise<Session>;
  verify(tokenHash: string, type: 'email' | 'recovery'): Promise<Session>;
  verifyCode(email: string, token: string, type: 'signup' | 'recovery'): Promise<Session>;
  resendConfirmation(email: string, captchaToken?: string): Promise<void>;
  recover(email: string, captchaToken?: string): Promise<void>;
  changePassword(identity: Identity, password: string): Promise<void>;
  signOut(identity: Identity): Promise<void>;
  getProfile(identity: Identity): Promise<Profile>;
  saveProfile(identity: Identity, displayName: string): Promise<Profile>;
  getSettings(identity: Identity): Promise<Backup>;
  saveSettings(identity: Identity, expectedRevision: number, payload: Settings | null): Promise<Backup>;
  deleteAccount(identity: Identity): Promise<void>;
  ready(): Promise<void>;
}

function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === 'PT409' || error.code === '40001') throw new ApiError(409, 'REVISION_CONFLICT', 'Cloud settings changed. Read the latest revision before saving again.');
  if (error.code === '23514') throw new ApiError(400, 'INVALID_SETTINGS', 'Settings exceed cloud storage limits.');
  throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Cloud storage is temporarily unavailable.');
}
function authError(error: { status?: number } | null, fallback = 'Authentication failed.') {
  if (!error) return;
  if (error.status === 429) throw new ApiError(429, 'AUTH_RATE_LIMITED', 'Please wait before trying again.');
  if (!error.status || error.status >= 500) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  throw new ApiError(401, 'AUTH_FAILED', fallback);
}
function sessionDto(session: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: { id: string; email?: string } } | null): Session {
  if (!session) throw new ApiError(401, 'SESSION_REQUIRED', 'A valid session is required.');
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at ?? (typeof session.expires_in === 'number' ? Math.floor(Date.now() / 1000) + session.expires_in : null), user: { id: session.user.id, email: session.user.email ?? null } };
}
function backupDto(row: { revision: number; payload: Settings | null; updated_at: string } | null): Backup {
  return { revision: row?.revision ?? 0, payload: row?.payload ?? null, updatedAt: row?.updated_at ?? null };
}

export function createGateway(config: Config): Gateway {
  // Auth methods mutate SDK state, so every operation gets an isolated client.
  const client = (token?: string, secret = false): SupabaseClient => createClient(config.SUPABASE_URL, secret ? config.SUPABASE_SECRET_KEY! : config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) }),
    },
  });
  const authRequest = async (path: string, method: string, body: unknown, token?: string) => {
    let response: Response;
    try {
      response = await fetch(new URL(`/auth/v1/${path}`, config.SUPABASE_URL), {
        method, headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    }
    authError(response.ok ? null : { status: response.status });
    return response.json();
  };
  return {
    async authenticate(token) {
      const { data, error } = await client().auth.getUser(token);
      authError(error);
      if (!data.user) throw new ApiError(401, 'INVALID_TOKEN', 'A valid access token is required.');
      return { id: data.user.id, email: data.user.email ?? null, token };
    },
    async signUp({ email, password, captchaToken }) {
      const { data, error } = await client().auth.signUp({ email, password, options: { captchaToken, emailRedirectTo: config.AUTH_REDIRECT_URL } });
      authError(error, 'Unable to create an account. Check your email or try signing in.');
      return { session: data.session ? sessionDto(data.session) : null, confirmationRequired: !data.session };
    },
    async signIn({ email, password, captchaToken }) {
      const { data, error } = await client().auth.signInWithPassword({ email, password, options: { captchaToken } });
      authError(error, 'Invalid email or password, or email confirmation is required.');
      return sessionDto(data.session);
    },
    async refresh(refreshToken) {
      const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
      authError(error);
      return sessionDto(data.session);
    },
    async exchangeOAuth(code, codeVerifier) {
      return sessionDto(await authRequest('token?grant_type=pkce', 'POST', { auth_code: code, code_verifier: codeVerifier }));
    },
    async signInWithIdToken(provider, token, nonce) {
      const { data, error } = await client().auth.signInWithIdToken({ provider, token, nonce });
      authError(error);
      return sessionDto(data.session);
    },
    async verify(tokenHash, type) {
      const { data, error } = await client().auth.verifyOtp({ token_hash: tokenHash, type });
      authError(error);
      return sessionDto(data.session);
    },
    async verifyCode(email, token, type) {
      const { data, error } = await client().auth.verifyOtp({ email, token, type: type === 'signup' ? 'email' : type });
      authError(error);
      return sessionDto(data.session);
    },
    async resendConfirmation(email, captchaToken) {
      const { error } = await client().auth.resend({ type: 'signup', email, options: { captchaToken, emailRedirectTo: config.AUTH_REDIRECT_URL } });
      if (error && (!error.status || error.status >= 500 || error.status === 429 || error.code === 'captcha_failed')) authError(error);
    },
    async recover(email, captchaToken) {
      const { error } = await client().auth.resetPasswordForEmail(email, { captchaToken, redirectTo: config.AUTH_REDIRECT_URL });
      // Same response for known and unknown accounts, but do report outages/throttling.
      if (error && (!error.status || error.status >= 500 || error.status === 429)) authError(error);
    },
    async changePassword(identity, password) {
      // updateUser() requires an SDK-managed refresh-token session; this stateless
      // backend calls the same Auth endpoint with the verified access token.
      await authRequest('user', 'PUT', { password }, identity.token);
    },
    async signOut(identity) {
      // A publishable key is sufficient to revoke the authenticated user's sessions.
      const { error } = await client().auth.admin.signOut(identity.token, 'global');
      authError(error);
    },
    async getProfile(identity) {
      const { data, error } = await client(identity.token).from('profiles').select('display_name, updated_at').eq('user_id', identity.id).maybeSingle();
      databaseError(error);
      return { displayName: data?.display_name ?? '', updatedAt: data?.updated_at ?? null };
    },
    async saveProfile(identity, displayName) {
      const { data, error } = await client(identity.token).from('profiles').upsert({ user_id: identity.id, display_name: displayName }, { onConflict: 'user_id' }).select('display_name, updated_at').single();
      databaseError(error);
      return { displayName: data!.display_name, updatedAt: data!.updated_at };
    },
    async getSettings(identity) {
      const { data, error } = await client(identity.token).from('user_settings').select('revision, payload, updated_at').eq('user_id', identity.id).maybeSingle();
      databaseError(error);
      return backupDto(data);
    },
    async saveSettings(identity, expectedRevision, payload) {
      const { data, error } = await client(identity.token).rpc('save_user_settings', { expected_revision: expectedRevision, new_payload: payload });
      databaseError(error);
      if (!data?.[0]) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Cloud storage is temporarily unavailable.');
      return backupDto(data[0]);
    },
    async deleteAccount(identity) {
      if (!config.SUPABASE_SECRET_KEY) throw new ApiError(503, 'ACCOUNT_DELETION_UNAVAILABLE', 'Account deletion is not configured on this server.');
      const { error } = await client(undefined, true).auth.admin.deleteUser(identity.id);
      authError(error, 'Unable to delete this account.');
    },
    async ready() {
      // Check table access without reading rows. A GET preserves upstream errors
      // that can be lost on HEAD responses when the schema is not ready.
      const { error } = await client().from('user_settings').select('user_id').limit(0);
      databaseError(error);
    },
  };
}
