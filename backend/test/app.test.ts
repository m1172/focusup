import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';
import { readConfig } from '../src/config.js';
import { config, fakeGateway, session, settings, user } from './fixtures.js';

const authorization = `Bearer ${user.token}`;

test('all account endpoints reject missing and invalid bearer tokens', async (t) => {
  const app = await buildApp(config, fakeGateway()); t.after(() => app.close());
  const routes = [
    ['GET', '/v1/me'], ['PUT', '/v1/me/profile'], ['GET', '/v1/me/settings'], ['PUT', '/v1/me/settings'],
    ['DELETE', '/v1/me/settings'], ['GET', '/v1/me/export'], ['DELETE', '/v1/me'], ['PATCH', '/v1/auth/password'], ['POST', '/v1/auth/sign-out'],
  ] as const;
  for (const [method, url] of routes) {
    for (const headers of [{}, { authorization: 'Bearer invalid-token' }]) {
      const response = await app.inject({ method, url, headers });
      assert.equal(response.statusCode, 401, `${method} ${url}`);
      assert.equal(response.headers['cache-control'], 'no-store');
    }
  }
});

test('settings validate ownership, private data, schedules and revision before writing', async (t) => {
  const calls: unknown[] = [];
  const app = await buildApp(config, fakeGateway({ saveSettings: async (...args) => { calls.push(args); return { revision: 1, payload: settings, updatedAt: 'now' }; } })); t.after(() => app.close());
  for (const payload of [
    { expectedRevision: 0, payload: { ...settings, userId: 'someone-else' } },
    { expectedRevision: -1, payload: settings },
    { expectedRevision: 0, payload: { ...settings, browsingHistory: ['private'] } },
    { expectedRevision: 0, payload: { ...settings, preferences: { ...settings.preferences, pro: true } } },
    { expectedRevision: 0, payload: { ...settings, preferences: { ...settings.preferences, schedules: [{ ...settings.preferences.schedules[0], start: '25:00' }] } } },
  ]) {
    assert.equal((await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization }, payload })).statusCode, 400);
  }
  assert.equal(calls.length, 0);
  const response = await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization }, payload: { expectedRevision: 0, payload: settings } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [[user, 0, settings]]);
});

test('revision conflicts are explicit and backup deletion keeps the expected revision', async (t) => {
  let deleted = false;
  const app = await buildApp(config, fakeGateway({ saveSettings: async (identity, revision, payload) => {
    assert.equal(identity.id, user.id);
    if (revision === 0) throw new ApiError(409, 'REVISION_CONFLICT', 'Reload cloud settings.');
    assert.equal(payload, null); deleted = true; return { revision: revision + 1, payload: null, updatedAt: 'now' };
  } })); t.after(() => app.close());
  const conflict = await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization }, payload: { expectedRevision: 0, payload: settings } });
  assert.equal(conflict.statusCode, 409); assert.equal(conflict.json().error.code, 'REVISION_CONFLICT');
  const response = await app.inject({ method: 'DELETE', url: '/v1/me/settings', headers: { authorization }, payload: { expectedRevision: 1 } });
  assert.equal(response.json().revision, 2); assert.equal(deleted, true);
});

test('signup requires a strong password and represents email confirmation', async (t) => {
  const app = await buildApp(config, fakeGateway({ signUp: async () => ({ session: null, confirmationRequired: true }) })); t.after(() => app.close());
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/sign-up', payload: { email: 'user@example.com', password: 'short' } })).statusCode, 400);
  const response = await app.inject({ method: 'POST', url: '/v1/auth/sign-up', payload: { email: 'user@example.com', password: 'twelve-characters' } });
  assert.equal(response.statusCode, 201); assert.deepEqual(response.json(), { session: null, confirmationRequired: true });
});

test('OAuth uses fixed callbacks, PKCE and the correct Telegram custom provider', async (t) => {
  const app = await buildApp({ ...config, AUTH_OAUTH_PROVIDERS: 'google,apple,telegram', AUTH_REDIRECT_URL: 'focusup://auth/callback' }, fakeGateway({ exchangeOAuth: async (code, verifier) => { assert.equal(code, 'one-time-code'); assert.equal(verifier, 'v'.repeat(43)); return session; } })); t.after(() => app.close());
  for (const provider of ['google', 'apple', 'telegram']) {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/oauth/start', payload: { provider, codeChallenge: 'c'.repeat(43) } });
    assert.equal(response.statusCode, 200);
    const url = new URL(response.json().url);
    assert.equal(url.origin, config.SUPABASE_URL); assert.equal(url.searchParams.get('provider'), provider === 'telegram' ? 'custom:telegram' : provider);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256'); assert.equal(url.searchParams.get('redirect_to'), 'focusup://auth/callback');
  }
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/oauth/start', payload: { provider: 'telegram', codeChallenge: 'x' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/oauth/start', payload: { provider: 'google', codeChallenge: 'c'.repeat(43), redirectUrl: 'https://evil.example' } })).statusCode, 400);
  const exchanged = await app.inject({ method: 'POST', url: '/v1/auth/oauth/exchange', payload: { code: 'one-time-code', codeVerifier: 'v'.repeat(43) } });
  assert.deepEqual(exchanged.json(), session);
});

test('unconfigured providers fail closed and native tokens require a nonce', async (t) => {
  const app = await buildApp(config, fakeGateway()); t.after(() => app.close());
  assert.deepEqual((await app.inject('/v1/auth/providers')).json(), { emailPassword: true, oauth: [] });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/oauth/start', payload: { provider: 'apple', codeChallenge: 'c'.repeat(43) } })).statusCode, 503);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/id-token', payload: { provider: 'apple', idToken: 'untrusted' } })).statusCode, 400);
});

test('rate limiting and body limits constrain auth requests', async (t) => {
  const app = await buildApp(config, fakeGateway({ signIn: async () => session })); t.after(() => app.close());
  for (let i = 0; i < 10; i++) assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/sign-in', payload: { email: 'user@example.com', password: 'password' } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/sign-in', payload: { email: 'user@example.com', password: 'password' } })).statusCode, 429);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: 'x'.repeat(70_000) } })).statusCode, 413);
});

test('account deletion only passes the verified identity; upstream errors remain private', async (t) => {
  let deleted: unknown;
  const app = await buildApp(config, fakeGateway({ deleteAccount: async (identity) => { deleted = identity; }, getProfile: async () => { throw new Error('secret-service-key password private-email'); } })); t.after(() => app.close());
  const response = await app.inject({ method: 'DELETE', url: '/v1/me', headers: { authorization } });
  assert.equal(response.statusCode, 204); assert.deepEqual(deleted, user);
  const failed = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization } });
  assert.equal(failed.statusCode, 500); assert.doesNotMatch(failed.body, /secret-service-key|password|private-email/);
});

test('health and readiness differ, CORS is restricted, config is data-only', async (t) => {
  const app = await buildApp({ ...config, CORS_ORIGINS: 'https://app.example.com' }, fakeGateway({ ready: async () => { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Unavailable.'); } })); t.after(() => app.close());
  assert.equal((await app.inject('/health')).statusCode, 200); assert.equal((await app.inject('/ready')).statusCode, 503);
  assert.equal((await app.inject({ url: '/health', headers: { origin: 'https://evil.example' } })).headers['access-control-allow-origin'], undefined);
  assert.equal((await app.inject({ url: '/health', headers: { origin: 'https://app.example.com' } })).headers['access-control-allow-origin'], 'https://app.example.com');
  const rules = await app.inject('/v1/blocker-config'); assert.deepEqual(rules.json(), { schemaVersion: 1, platforms: {} });
  assert.equal(rules.headers['cache-control'], 'public, max-age=900');
});

test('environment validation rejects insecure production URLs without exposing values', () => {
  assert.throws(() => readConfig({ SUPABASE_URL: 'http://localhost:54321', SUPABASE_PUBLISHABLE_KEY: 'secret', NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => readConfig({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: '' }), /SUPABASE_PUBLISHABLE_KEY/);
});

test('email verification codes are constrained and retain the requested recovery flow', async (t) => {
  const calls: unknown[] = [];
  const app = await buildApp(config, fakeGateway({ verifyCode: async (...args) => { calls.push(args); return session; }, resendConfirmation: async () => {} })); t.after(() => app.close());
  for (const payload of [{ email: 'user@example.com', token: 'wrong', type: 'recovery' }, { email: 'user@example.com', token: '123456', type: 'admin' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/verify-code', payload })).statusCode, 400);
  }
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify-code', payload: { email: 'user@example.com', token: '123456', type: 'recovery' } });
  assert.deepEqual(verified.json(), session);
  assert.deepEqual(calls, [['user@example.com', '123456', 'recovery']]);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/resend-confirmation', payload: { email: 'user@example.com' } })).statusCode, 202);
});
