import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGateway } from '../src/gateway.js';
import { config, user } from './fixtures.js';

test('gateway verifies identity with Auth and preserves user RLS for data requests', async (t) => {
  const calls: { url: string; auth: string | null; key: string | null }[] = [];
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    const url = String(input); const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get('authorization'), key: headers.get('apikey') });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated' });
    return Response.json({ display_name: 'Owner', updated_at: 'now' });
  };
  const gateway = createGateway({ ...config, SUPABASE_SECRET_KEY: 'admin-key' });
  const identity = await gateway.authenticate(user.token);
  assert.equal(identity.id, user.id);
  await gateway.getProfile(identity);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.auth, `Bearer ${user.token}`);
  assert.equal(calls[1]?.auth, `Bearer ${user.token}`);
  assert.equal(calls[1]?.key, config.SUPABASE_PUBLISHABLE_KEY);
  assert.ok(calls[1]?.url.includes(`user_id=eq.${user.id}`));
  assert.ok(calls.every((call) => call.auth !== 'Bearer admin-key' && call.key !== 'admin-key'));
});

test('PKCE exchange and password changes use stateless Auth endpoints', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    if (String(input).includes('grant_type=pkce')) return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: { id: user.id } });
    return Response.json({ id: user.id });
  };
  const gateway = createGateway(config);
  const session = await gateway.exchangeOAuth('provider-code', 'private-verifier');
  assert.equal(session.accessToken, 'new-access'); assert.equal(session.user.email, null);
  assert.ok(session.expiresAt && session.expiresAt > Date.now() / 1000 + 3500);
  assert.deepEqual(calls[0]?.body, { auth_code: 'provider-code', code_verifier: 'private-verifier' });
  await gateway.changePassword(user, 'long-new-password');
  assert.equal(calls[1]?.headers.get('authorization'), `Bearer ${user.token}`);
  assert.deepEqual(calls[1]?.body, { password: 'long-new-password' });
});

test('account deletion is disabled without a secret and uses admin credentials only for verified owner', async (t) => {
  await assert.rejects(createGateway(config).deleteAccount(user), { statusCode: 503, code: 'ACCOUNT_DELETION_UNAVAILABLE' });
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${config.SUPABASE_URL}/auth/v1/admin/users/${user.id}`);
    assert.equal(init?.method, 'DELETE');
    assert.equal(new Headers(init?.headers).get('apikey'), 'server-secret');
    return Response.json({ id: user.id });
  };
  await createGateway({ ...config, SUPABASE_SECRET_KEY: 'server-secret' }).deleteAccount(user);
});

test('upstream database failures do not expose details', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ code: 'XX000', message: 'private connection credentials' }, { status: 500 });
  await assert.rejects(createGateway(config).getSettings(user), { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: 'Cloud storage is temporarily unavailable.' });
});

test('settings revision conflicts retain their actionable status', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  for (const code of ['PT409', '40001']) {
    globalThis.fetch = async () => Response.json({ code, message: 'Settings revision conflict' }, { status: 409 });
    await assert.rejects(createGateway(config).saveSettings(user, 0, null), { statusCode: 409, code: 'REVISION_CONFLICT' });
  }
});

test('readiness rejects a missing migration without reading user data', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let migrated = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method, 'GET');
    assert.equal(url.pathname, '/rest/v1/user_settings');
    assert.equal(url.searchParams.get('select'), 'user_id');
    assert.equal(url.searchParams.get('limit'), '0');
    assert.equal(new Headers(init?.headers).get('apikey'), config.SUPABASE_PUBLISHABLE_KEY);
    return migrated ? Response.json([]) : Response.json({ code: 'PGRST205', message: 'Table missing from schema cache' }, { status: 404 });
  };
  const gateway = createGateway(config);
  await assert.rejects(gateway.ready(), { statusCode: 503, code: 'DATABASE_UNAVAILABLE' });
  migrated = true;
  await gateway.ready();
});

test('signup verification uses the current email OTP type in Supabase Auth', async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${config.SUPABASE_URL}/auth/v1/verify`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.email, 'user@example.com'); assert.equal(body.token, '123456'); assert.equal(body.type, 'email');
    return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user: { id: user.id } });
  };
  assert.equal((await createGateway(config).verifyCode('user@example.com', '123456', 'signup')).accessToken, 'access');
});
