import { ApiError } from './errors.ts';

/**
 * Telegram login without Supabase's hosted OAuth page, so Telegram only ever sees our own domain
 * (TELEGRAM_LOGIN_ORIGIN: the Vaqtim website, whose Pages Function forwards the callback here).
 *
 * 1. start():    app → oauth.telegram.org, with an encrypted `state` holding the app's PKCE challenge.
 * 2. callback(): Telegram → our domain → here. We exchange the code, verify the ID token and send the
 *                app a short-lived, encrypted one-time code (no tokens ever travel in a URL).
 * 3. redeem():   the app posts that code with its PKCE verifier; the caller then mints a session.
 */
export const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
const AUTHORIZE_URL = `${TELEGRAM_ISSUER}/auth`;
const TOKEN_URL = `${TELEGRAM_ISSUER}/token`;
const JWKS_URL = `${TELEGRAM_ISSUER}/.well-known/jwks.json`;
export const TELEGRAM_CODE_PREFIX = 'tg1.';
const STATE_TTL_MS = 10 * 60_000;
const RESULT_TTL_MS = 2 * 60_000;
const CLOCK_SKEW_S = 60;

export type TelegramLoginConfig = { clientId: string; clientSecret: string; origin: string; key: string; appRedirectUrl: string };
export type TelegramProfile = { id: string; name?: string; username?: string; picture?: string };
type Fetcher = typeof fetch;
type State = { c: string; v: string; n: string; e: number };
type Result = { c: string; s: string; nm?: string; u?: string; p?: string; e: number };
type Jwk = JsonWebKey & { kid?: string; alg?: string };

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (text: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('bad base64url');
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
};
const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export const pkceChallenge = async (verifier: string) => b64url(await sha256(verifier));

export function createTelegramLogin(config: TelegramLoginConfig, fetcher: Fetcher = fetch, now: () => number = Date.now) {
  const redirectUri = `${config.origin.replace(/\/+$/, '')}/telegram/callback`;
  const appRedirect = (params: Record<string, string>) => {
    const url = new URL(config.appRedirectUrl);
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  };
  // One AES-GCM key from the configured secret; `purpose` is bound as associated data so a state can't pass as a result.
  let aesKey: Promise<CryptoKey> | null = null;
  const key = () => (aesKey ??= sha256(config.key).then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])));
  const seal = async (purpose: string, value: object) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, await key(), encoder.encode(JSON.stringify(value))));
    const out = new Uint8Array(iv.length + sealed.length);
    out.set(iv); out.set(sealed, iv.length);
    return b64url(out);
  };
  const open = async <T extends { e: number }>(purpose: string, text: string): Promise<T> => {
    try {
      const bytes = fromB64url(text);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(purpose) }, await key(), bytes.slice(12));
      const value = JSON.parse(new TextDecoder().decode(plain)) as T;
      if (typeof value.e !== 'number' || value.e < now()) throw new Error('expired');
      return value;
    } catch { throw new ApiError(400, 'INVALID_CALLBACK', 'Start a new sign-in attempt.'); }
  };

  let jwks: { keys: Jwk[]; at: number } | null = null;
  const signingKey = async (kid: string | undefined, alg: string) => {
    if (!jwks || now() - jwks.at > 60 * 60_000 || !jwks.keys.some((k) => k.kid === kid)) {
      const response = await fetcher(JWKS_URL, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('jwks unavailable');
      jwks = { keys: ((await response.json()) as { keys: Jwk[] }).keys, at: now() };
    }
    const jwk = jwks.keys.find((k) => k.kid === kid && (!k.alg || k.alg === alg));
    if (!jwk) throw new Error('unknown key');
    // WebCrypto rejects some JOSE-only members, so import just the key material.
    const material = Object.fromEntries(Object.entries({ kty: jwk.kty, n: jwk.n, e: jwk.e, crv: jwk.crv, x: jwk.x, y: jwk.y }).filter(([, value]) => value !== undefined)) as JsonWebKey;
    if (alg === 'RS256') return { key: await crypto.subtle.importKey('jwk', material, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']), params: { name: 'RSASSA-PKCS1-v1_5' } };
    if (alg === 'ES256') return { key: await crypto.subtle.importKey('jwk', material, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), params: { name: 'ECDSA', hash: 'SHA-256' } };
    if (alg === 'EdDSA') return { key: await crypto.subtle.importKey('jwk', material, { name: 'Ed25519' }, false, ['verify']), params: { name: 'Ed25519' } };
    throw new Error('unsupported alg');
  };
  /** Checks Telegram's signature and the standard claims; returns the user's public profile. */
  const verifyIdToken = async (token: string, nonce: string): Promise<TelegramProfile> => {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('malformed token');
    const header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]!))) as { alg?: string; kid?: string };
    const { key: publicKey, params } = await signingKey(header.kid, header.alg ?? '');
    const valid = await crypto.subtle.verify(params, publicKey, fromB64url(parts[2]!), encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new Error('bad signature');
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]!))) as Record<string, unknown>;
    const seconds = now() / 1000;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== TELEGRAM_ISSUER || !audience.includes(config.clientId) || typeof claims.exp !== 'number' || claims.exp < seconds - CLOCK_SKEW_S
      || (typeof claims.iat === 'number' && claims.iat > seconds + CLOCK_SKEW_S) || claims.nonce !== nonce) throw new Error('bad claims');
    const sub = claims.sub;
    if ((typeof sub !== 'string' && typeof sub !== 'number') || !/^\d{1,20}$/.test(String(sub))) throw new Error('bad subject');
    const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
    const picture = text(claims.picture, 500);
    return { id: String(sub), name: text(claims.name, 80), username: text(claims.preferred_username, 64), picture: picture?.startsWith('https://') ? picture : undefined };
  };

  return {
    redirectUri,
    /** The Telegram login page to open, carrying the app's PKCE challenge inside the encrypted state. */
    async start(appChallenge: string) {
      const state: State = { c: appChallenge, v: randomToken(), n: randomToken(16), e: now() + STATE_TTL_MS };
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid profile',
        state: await seal('state', state), nonce: state.n, code_challenge: await pkceChallenge(state.v), code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },
    /** Handles Telegram's redirect and returns where to send the browser next: always the app, with a code or an error. */
    async callback(requestUrl: URL): Promise<string> {
      const params = requestUrl.searchParams;
      if (params.has('error')) return appRedirect({ error: 'access_denied' });
      const code = params.get('code'), stateText = params.get('state');
      if (!code || !stateText || code.length > 2048 || stateText.length > 2048) return appRedirect({ error: 'invalid_request' });
      let state: State;
      try { state = await open<State>('state', stateText); } catch { return appRedirect({ error: 'invalid_request' }); }
      try {
        const response = await fetcher(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}` },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: config.clientId, code_verifier: state.v }).toString(),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('token exchange failed');
        const tokens = await response.json() as { id_token?: unknown };
        if (typeof tokens.id_token !== 'string') throw new Error('no id token');
        const profile = await verifyIdToken(tokens.id_token, state.n);
        const result: Result = { c: state.c, s: profile.id, nm: profile.name, u: profile.username, p: profile.picture, e: now() + RESULT_TTL_MS };
        return appRedirect({ code: TELEGRAM_CODE_PREFIX + await seal('result', result) });
      } catch {
        // Never echo upstream details into the redirect.
        return appRedirect({ error: 'server_error' });
      }
    },
    /** Opens a one-time code from callback() after checking the app's PKCE verifier. */
    async redeem(code: string, verifier: string): Promise<TelegramProfile> {
      if (!code.startsWith(TELEGRAM_CODE_PREFIX)) throw new ApiError(400, 'INVALID_CALLBACK', 'Start a new sign-in attempt.');
      const result = await open<Result>('result', code.slice(TELEGRAM_CODE_PREFIX.length));
      if (result.c !== await pkceChallenge(verifier)) throw new ApiError(400, 'INVALID_CALLBACK', 'Start a new sign-in attempt.');
      return { id: result.s, name: result.nm, username: result.u, picture: result.p };
    },
  };
}
export type TelegramLogin = ReturnType<typeof createTelegramLogin>;
