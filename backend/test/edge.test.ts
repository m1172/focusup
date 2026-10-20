import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEdgeHandler } from '../src/edge.ts';
import { ApiError } from '../src/errors.ts';
import { RateLimitError, rateLimitSubject } from '../src/edgeRateLimit.ts';
import { config, fakeGateway, session, settings, user } from './fixtures.js';

const edgeConfig = { ...config, SUPABASE_SECRET_KEY: 'server-test-secret', AUTH_REDIRECT_URL: 'focusup://auth/callback' };
const base = 'https://project.supabase.co/functions/v1/focusup-api';
const noLimit = async () => {};
const request = (path: string, method = 'GET', body?: unknown, token?: string) => new Request(base + path, {
  method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

test('edge API serves public routes and rejects missing, forged and server tokens on private routes', async () => {
  let profileCalls = 0;
  const handler = createEdgeHandler(edgeConfig, noLimit, fakeGateway({ getProfile: async () => { profileCalls++; return { displayName: 'Owner', updatedAt: null }; } }));
  assert.equal((await handler(request('/health'))).status, 200);
  assert.deepEqual(await (await handler(request('/v1/auth/providers'))).json(), { emailPassword: true, oauth: [] });
  for (const token of [undefined, 'forged-token', 'server-test-secret']) assert.equal((await handler(request('/v1/me', 'GET', undefined, token))).status, 401);
  assert.equal(profileCalls, 0);
  const response = await handler(request('/v1/me', 'GET', undefined, user.token));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, user.id);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await handler(new Request('https://project.supabase.co/focusup-api/health'))).status, 200);
  assert.equal((await handler(new Request('https://project.supabase.co/another-function/health'))).status, 404);
});

test('edge API preserves login, settings revisions, export and bodyless deletion contracts', async () => {
  const handler = createEdgeHandler(edgeConfig, noLimit, fakeGateway({
    signIn: async () => session,
    getProfile: async () => ({ displayName: 'Owner', updatedAt: null }),
    getSettings: async () => ({ revision: 0, payload: null, updatedAt: null }),
    saveSettings: async (identity, revision, payload) => {
      assert.equal(identity.id, user.id);
      if (revision !== 0) throw new ApiError(409, 'REVISION_CONFLICT', 'Read the latest revision.');
      return { revision: 1, payload, updatedAt: null };
    },
    signOut: async () => {}, deleteAccount: async () => {},
  }));
  assert.deepEqual(await (await handler(request('/v1/auth/sign-in', 'POST', { email: 'test@example.com', password: 'password' }))).json(), session);
  assert.equal((await handler(request('/v1/me/settings', 'PUT', { expectedRevision: 0, payload: settings }, user.token))).status, 200);
  assert.equal((await handler(request('/v1/me/settings', 'PUT', { expectedRevision: 1, payload: settings }, user.token))).status, 409);
  assert.equal((await handler(request('/v1/me/settings', 'PUT', { expectedRevision: 0, payload: settings, userId: 'other-user' }, user.token))).status, 400);
  const exported = await (await handler(request('/v1/me/export', 'GET', undefined, user.token))).json();
  assert.equal(exported.account.id, user.id);
  for (const [path, method] of [['/v1/auth/sign-out', 'POST'], ['/v1/me', 'DELETE']]) {
    const response = await handler(request(path!, method, undefined, user.token));
    assert.equal(response.status, 204); assert.equal(await response.text(), '');
    const forwardedEmpty = new Request(base + path, { method, headers: { Authorization: `Bearer ${user.token}` }, body: new Uint8Array() });
    assert.equal((await handler(forwardedEmpty)).status, 204);
  }
});

test('edge API bounds streamed bodies, rejects malformed JSON, and enforces exact CORS origins', async () => {
  const handler = createEdgeHandler({ ...edgeConfig, CORS_ORIGINS: 'https://app.example.com' }, noLimit, fakeGateway());
  const malformed = new Request(base + '/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal((await handler(malformed)).status, 400);
  const oversized = new Request(base + '/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(65_536) }) });
  assert.equal((await handler(oversized)).status, 413);
  const wrongType = new Request(base + '/v1/auth/sign-in', { method: 'POST', body: '{}' });
  assert.equal((await handler(wrongType)).status, 415);
  for (const origin of ['https://app.example.com.evil.test', 'https://evil.test']) {
    assert.equal((await handler(new Request(base + '/v1/auth/providers', { headers: { Origin: origin } }))).status, 403);
  }
  const preflight = await handler(new Request(base + '/v1/me', { method: 'OPTIONS', headers: { Origin: 'https://app.example.com' } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://app.example.com');
});

test('edge rate limits are shared, fail closed, redact subjects and ignore spoofable client IP headers', async () => {
  const buckets: string[] = [];
  const handler = createEdgeHandler(edgeConfig, async (bucket) => { buckets.push(bucket); }, fakeGateway({ signIn: async () => session }));
  for (const ip of ['1.2.3.4', '5.6.7.8']) {
    const req = request('/v1/auth/sign-in', 'POST', { email: 'test@example.com', password: 'password' });
    req.headers.set('X-Forwarded-For', ip); req.headers.set('CF-Connecting-IP', ip);
    assert.equal((await handler(req)).status, 200);
  }
  assert.equal(buckets[1], buckets[3]);
  assert.ok(!buckets.some((bucket) => /test@|1\.2\.3\.4|password/.test(bucket)));
  assert.notEqual(await rateLimitSubject('secret-one', 'test@example.com'), await rateLimitSubject('secret-two', 'test@example.com'));
  const blocked = createEdgeHandler(edgeConfig, async () => { throw new RateLimitError(45); }, fakeGateway());
  const limited = await blocked(request('/v1/auth/sign-in', 'POST', {}));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '45');
  const unavailable = createEdgeHandler(edgeConfig, async () => { throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Unavailable.'); }, fakeGateway());
  assert.equal((await unavailable(request('/v1/auth/sign-in', 'POST', {}))).status, 503);
});
