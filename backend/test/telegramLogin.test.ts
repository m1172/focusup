import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTelegramLogin, pkceChallenge, TELEGRAM_CODE_PREFIX, TELEGRAM_ISSUER } from '../src/telegramLogin.ts';
import { createEdgeHandler } from '../src/edge.ts';
import { config, fakeGateway, session } from './fixtures.js';

const settings = { clientId: '7700112233', clientSecret: 'telegram-client-secret-value', origin: 'https://auth.example.com', key: 'k'.repeat(40), appRedirectUrl: 'focusup://auth/callback' };
const verifier = 'v'.repeat(43);
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const json = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** A fake Telegram: ES256 key pair, JWKS and a token endpoint that returns `claims` signed with it. */
async function fakeTelegram(claims: (nonce: string) => Record<string, unknown>, options: { badSignature?: boolean; tokenStatus?: number } = {}) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const publicJwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-es256', alg: 'ES256' };
  const calls: { url: string; body?: string; auth?: string | null }[] = [];
  let nonce = '';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined, auth: new Headers(init?.headers).get('authorization') });
    if (url.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [publicJwk] });
    if (url === `${TELEGRAM_ISSUER}/token`) {
      if (options.tokenStatus) return new Response('nope', { status: options.tokenStatus });
      const head = json({ alg: 'ES256', kid: 'test-es256', typ: 'JWT' }), body = json(claims(nonce));
      const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(`${head}.${body}`)));
      if (options.badSignature) signature[0] = signature[0]! ^ 0xff;
      return Response.json({ id_token: `${head}.${body}.${b64url(signature)}`, access_token: 'x' });
    }
    return new Response('unexpected', { status: 500 });
  }) as typeof fetch;
  return { fetcher, calls, setNonce: (value: string) => { nonce = value; } };
}
const validClaims = (nonce: string) => ({ iss: TELEGRAM_ISSUER, aud: settings.clientId, sub: '123456789', exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), nonce, name: 'Ali Valiyev', preferred_username: 'ali', picture: 'https://t.me/i/userpic/ali.jpg' });

async function startAndCallback(login: ReturnType<typeof createTelegramLogin>, telegram: Awaited<ReturnType<typeof fakeTelegram>>, extra: Record<string, string> = {}) {
  const authorize = new URL(await login.start(await pkceChallenge(verifier)));
  telegram.setNonce(authorize.searchParams.get('nonce')!);
  const callback = new URL(`${settings.origin}/telegram/callback`);
  callback.search = new URLSearchParams({ code: 'telegram-code', state: authorize.searchParams.get('state')!, ...extra }).toString();
  return { authorize, redirect: new URL(await login.callback(callback)) };
}

test('Telegram login: our domain is the redirect, Telegram never sees the app PKCE verifier, and the app redeems a one-time code', async () => {
  const telegram = await fakeTelegram(validClaims);
  const login = createTelegramLogin(settings, telegram.fetcher);
  const { authorize, redirect } = await startAndCallback(login, telegram);
  assert.equal(authorize.origin + authorize.pathname, `${TELEGRAM_ISSUER}/auth`);
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://auth.example.com/telegram/callback');
  assert.equal(authorize.searchParams.get('scope'), 'openid profile');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(!authorize.toString().includes(await pkceChallenge(verifier)), 'the app challenge stays inside the encrypted state');

  const token = telegram.calls.find((call) => call.url.endsWith('/token'))!;
  assert.match(token.auth ?? '', /^Basic /);
  assert.equal(new URLSearchParams(token.body).get('redirect_uri'), 'https://auth.example.com/telegram/callback');

  assert.equal(`${redirect.protocol}//${redirect.host}${redirect.pathname}`, 'focusup://auth/callback');
  const code = redirect.searchParams.get('code')!;
  assert.ok(code.startsWith(TELEGRAM_CODE_PREFIX));
  assert.ok(!code.includes('123456789') && !code.includes('Ali'), 'the code is encrypted');
  assert.deepEqual(await login.redeem(code, verifier), { id: '123456789', name: 'Ali Valiyev', username: 'ali', picture: 'https://t.me/i/userpic/ali.jpg' });
  await assert.rejects(login.redeem(code, 'w'.repeat(43)), /new sign-in/);
  await assert.rejects(login.redeem(`${code.slice(0, -2)}AA`, verifier), /new sign-in/);
});

test('Telegram login sends the app an error, never details, for refusals, tampering and bad tokens', async () => {
  const cases: [string, Awaited<ReturnType<typeof fakeTelegram>>, Record<string, string>, string][] = [
    ['user refused', await fakeTelegram(validClaims), { error: 'access_denied' }, 'access_denied'],
    ['bad signature', await fakeTelegram(validClaims, { badSignature: true }), {}, 'server_error'],
    ['wrong nonce', await fakeTelegram((nonce) => ({ ...validClaims(nonce), nonce: 'other' })), {}, 'server_error'],
    ['wrong audience', await fakeTelegram((nonce) => ({ ...validClaims(nonce), aud: '999' })), {}, 'server_error'],
    ['expired token', await fakeTelegram((nonce) => ({ ...validClaims(nonce), exp: Math.floor(Date.now() / 1000) - 3600 })), {}, 'server_error'],
    ['token endpoint failure', await fakeTelegram(validClaims, { tokenStatus: 400 }), {}, 'server_error'],
  ];
  for (const [name, telegram, extra, expected] of cases) {
    const { redirect } = await startAndCallback(createTelegramLogin(settings, telegram.fetcher), telegram, extra);
    assert.equal(redirect.searchParams.get('error'), expected, name);
    assert.equal(redirect.searchParams.get('code'), null, name);
  }
  const login = createTelegramLogin(settings, (await fakeTelegram(validClaims)).fetcher);
  const tampered = new URL(`${settings.origin}/telegram/callback?code=x&state=${'A'.repeat(80)}`);
  assert.equal(new URL(await login.callback(tampered)).searchParams.get('error'), 'invalid_request');
});

test('Telegram login state and codes expire', async () => {
  let clock = Date.now();
  const telegram = await fakeTelegram(validClaims);
  const login = createTelegramLogin(settings, telegram.fetcher, () => clock);
  const { redirect } = await startAndCallback(login, telegram);
  clock += 3 * 60_000;
  await assert.rejects(login.redeem(redirect.searchParams.get('code')!, verifier), /new sign-in/);
  const authorize = new URL(await login.start(await pkceChallenge(verifier)));
  clock += 11 * 60_000;
  const late = new URL(`${settings.origin}/telegram/callback?code=x&state=${authorize.searchParams.get('state')}`);
  assert.equal(new URL(await login.callback(late)).searchParams.get('error'), 'invalid_request');
});

test('edge API routes Telegram through our domain when configured and falls back to Supabase otherwise', async () => {
  const base = 'https://project.supabase.co/functions/v1/focusup-api';
  const edgeConfig = { ...config, SUPABASE_SECRET_KEY: 'server-test-secret', AUTH_REDIRECT_URL: 'focusup://auth/callback', AUTH_OAUTH_PROVIDERS: 'telegram' };
  const telegram = await fakeTelegram(validClaims);
  const login = createTelegramLogin(settings, telegram.fetcher);
  let signedIn: { id: string; domain: string } | null = null;
  const gateway = fakeGateway({ signInWithTelegram: async (profile, domain) => { signedIn = { id: profile.id, domain }; return session; } });
  const noLimit = async () => {};
  const handler = createEdgeHandler(edgeConfig, noLimit, gateway, undefined, undefined, login);
  const post = (path: string, body: unknown) => handler(new Request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

  const started = await (await post('/v1/auth/oauth/start', { provider: 'telegram', codeChallenge: await pkceChallenge(verifier) })).json();
  assert.equal(new URL(started.url).origin, TELEGRAM_ISSUER);
  assert.equal(started.redirectUrl, 'focusup://auth/callback');
  const state = new URL(started.url).searchParams;
  telegram.setNonce(state.get('nonce')!);

  const callback = await handler(new Request(`${base}/v1/auth/telegram/callback?code=telegram-code&state=${encodeURIComponent(state.get('state')!)}`));
  assert.equal(callback.status, 302);
  const code = new URL(callback.headers.get('location')!).searchParams.get('code')!;
  assert.deepEqual(await (await post('/v1/auth/oauth/exchange', { code, codeVerifier: verifier })).json(), session);
  assert.deepEqual(signedIn, { id: '123456789', domain: 'auth.example.com' });

  const fallback = createEdgeHandler(edgeConfig, noLimit, gateway, undefined, undefined, null);
  const supabase = await (await fallback(new Request(base + '/v1/auth/oauth/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'telegram', codeChallenge: await pkceChallenge(verifier) }) }))).json();
  assert.equal(new URL(supabase.url).hostname, 'project.supabase.co');
  assert.equal((await fallback(new Request(`${base}/v1/auth/telegram/callback?code=x&state=y`))).status, 404);
});
