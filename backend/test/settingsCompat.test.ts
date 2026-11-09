import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { createEdgeHandler } from '../src/edge.js';
import type { Backup } from '../src/gateway.js';
import type { Settings } from '../src/schemas.js';
import { config, fakeGateway, settings, user } from './fixtures.js';

const authorization = `Bearer ${user.token}`;
const extensions = { version: 1 as const, grayscale: true, dailyLimits: { instagram: 30 }, filters: { instagram: { stories: true, messagesOnly: false } } };
const withExtensions: Settings = { ...settings, extensions };

function memoryGateway(initial: Settings | null) {
  let stored: Backup = { revision: initial ? 1 : 0, payload: initial, updatedAt: initial ? 'then' : null };
  const saves: (Settings | null)[] = [];
  return {
    saves,
    gateway: fakeGateway({
      getSettings: async () => stored,
      saveSettings: async (_identity, revision, payload) => { saves.push(payload); stored = { revision: revision + 1, payload, updatedAt: 'now' }; return stored; },
    }),
  };
}

test('only builds that send the version header see backup extensions', async (t) => {
  const { gateway } = memoryGateway(withExtensions);
  const app = await buildApp(config, gateway); t.after(() => app.close());
  const legacy = await app.inject({ method: 'GET', url: '/v1/me/settings', headers: { authorization } });
  assert.equal(legacy.statusCode, 200);
  assert.equal(legacy.json().payload.extensions, undefined);
  const current = await app.inject({ method: 'GET', url: '/v1/me/settings', headers: { authorization, 'x-vaqtim-settings': '2' } });
  assert.deepEqual(current.json().payload.extensions, extensions);
});

test('a save from an older build keeps the stored extensions; a new build can change them', async (t) => {
  const { gateway, saves } = memoryGateway(withExtensions);
  const app = await buildApp(config, gateway); t.after(() => app.close());
  const legacy = await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization }, payload: { expectedRevision: 1, payload: settings } });
  assert.equal(legacy.statusCode, 200);
  assert.deepEqual(saves[0]?.extensions, extensions);
  assert.equal(legacy.json().payload.extensions, undefined);
  const changed = { ...extensions, grayscale: false };
  const current = await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization, 'x-vaqtim-settings': '2' }, payload: { expectedRevision: 2, payload: { ...settings, extensions: changed } } });
  assert.equal(current.statusCode, 200);
  assert.deepEqual(saves[1]?.extensions, changed);
});

test('extensions are strict: unknown filters or out-of-range limits are rejected', async (t) => {
  const { gateway, saves } = memoryGateway(null);
  const app = await buildApp(config, gateway); t.after(() => app.close());
  for (const bad of [{ ...extensions, filters: { instagram: { reels: false } } }, { ...extensions, dailyLimits: { instagram: 0 } }, { ...extensions, version: 2 }, { ...extensions, extra: true }]) {
    const response = await app.inject({ method: 'PUT', url: '/v1/me/settings', headers: { authorization, 'x-vaqtim-settings': '2' }, payload: { expectedRevision: 0, payload: { ...settings, extensions: bad } } });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(saves.length, 0);
});

test('the Edge Function follows the same rules', async () => {
  const { gateway, saves } = memoryGateway(withExtensions);
  const handler = createEdgeHandler({ ...config, SUPABASE_SECRET_KEY: 'server-test-secret', AUTH_REDIRECT_URL: 'focusup://auth/callback' }, async () => {}, gateway);
  const request = (method: string, body?: unknown, version?: string) => handler(new Request('https://project.supabase.co/functions/v1/focusup-api/v1/me/settings', {
    method, headers: { authorization, 'content-type': 'application/json', ...(version ? { 'x-vaqtim-settings': version } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const legacy = await (await request('GET')).json() as Backup;
  assert.equal(legacy.payload?.extensions, undefined);
  const current = await (await request('GET', undefined, '2')).json() as Backup;
  assert.deepEqual(current.payload?.extensions, extensions);
  const saved = await request('PUT', { expectedRevision: 1, payload: settings });
  assert.equal(saved.status, 200);
  assert.deepEqual(saves[0]?.extensions, extensions);
});
