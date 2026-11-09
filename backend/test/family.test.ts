import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildApp } from '../src/app.ts';
import { readConfig } from '../src/config.ts';
import { createEdgeHandler } from '../src/edge.ts';
import { ApiError } from '../src/errors.ts';
import { authenticatedAt, familyDatabaseError, matchFamilyPath, newPairingCode, type FamilyRpc } from '../src/family.ts';
import type { Identity } from '../src/gateway.ts';
import { fakeGateway } from './fixtures.js';

const PARENT = '11111111-1111-4111-8111-111111111111';
const OTHER_PARENT = '22222222-2222-4222-8222-222222222222';
const base = 'https://project.supabase.co/functions/v1/focusup-api';
const config = readConfig({ NODE_ENV: 'test', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key', SUPABASE_SECRET_KEY: 'server-test-secret', FAMILY_ENROLLMENT_ENABLED: 'true' });

/** An access token whose only meaningful part is the sign-in time; the fake gateway "verifies" it. */
function token(userId: string, signedInSecondsAgo: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ sub: userId, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - signedInSecondsAgo }] })}.sig`;
}
const fresh = token(PARENT, 30), stale = token(PARENT, 3600), otherFresh = token(OTHER_PARENT, 30);
const gateway = fakeGateway({
  authenticate: async (value): Promise<Identity> => {
    const sub = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString() || '{}').sub;
    if (sub !== PARENT && sub !== OTHER_PARENT) throw new ApiError(401, 'INVALID_TOKEN', 'Invalid token.');
    return { id: sub, email: null, token: value };
  },
  getProfile: async () => ({ displayName: '', updatedAt: null }),
  getSettings: async () => ({ revision: 0, payload: null, updatedAt: null }),
});

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_app_meta_data jsonb not null default '{}');
    create table auth.identities (user_id uuid not null references auth.users(id) on delete cascade, provider text not null, provider_id text not null);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
  `);
  await db.query('insert into auth.users (id) values ($1), ($2)', [PARENT, OTHER_PARENT]);
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, migrations), 'utf8'));
  await db.query("insert into public.profiles (user_id, display_name) values ($1, 'Dilnoza')", [PARENT]);
  // Same calling convention as Supabase's rpc(): named arguments, JSON values, the server role.
  const rpc: FamilyRpc = async (name, args) => {
    const keys = Object.keys(args);
    const values = keys.map((key) => { const value = args[key]; return value !== null && typeof value === 'object' ? JSON.stringify(value) : value; });
    try {
      await db.exec('set role service_role');
      const result = await db.query<{ result: unknown }>(`select public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(', ')}) as result`, values);
      return result.rows[0]?.result ?? null;
    } catch (error) { throw familyDatabaseError(error as { message?: string }); }
    finally { await db.exec('reset role'); }
  };
  return { db, rpc };
}

const yearsAgo = (years: number, days = 0) => { const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - years); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); };
const policy = (overrides: object = {}) => ({ schemaVersion: 1, protectedApps: ['instagram', 'tiktok'], browsers: {}, downtime: [{ id: 'bed', name: 'Bedtime', start: '21:30', end: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['instagram', 'youtube', 'tiktok'] }], ...overrides });
const report = { platform: 'ios', appVersion: '1.1.0', authorized: true, member: 'child', blockedApps: ['instagram', 'tiktok'], missingApps: [], error: null, timezone: 'Asia/Tashkent', utcOffsetMinutes: -300 };

function edgeClient(rpc: FamilyRpc, hints: string[][] = []) {
  const handler = createEdgeHandler(config, async () => undefined, gateway, undefined, undefined, null, rpc, async (tokens) => { hints.push(tokens); });
  return async (path: string, method = 'GET', body?: unknown, authorization?: string) => {
    const response = await handler(new Request(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(authorization ? { Authorization: authorization } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null };
  };
}

test('family pairing, policies, replacement, removal and adult release work end to end', async (t) => {
  const { db, rpc } = await database(); t.after(() => db.close());
  const hints: string[][] = [];
  const api = edgeClient(rpc, hints);
  const bearer = `Bearer ${fresh}`;

  // Setup checks the country, the consent version and the parent's token.
  assert.equal((await api('/v1/family')).status, 401);
  assert.deepEqual((await api('/v1/family', 'GET', undefined, bearer)).json.children, []);
  assert.equal((await api('/v1/family', 'POST', { country: 'KZ', consentVersion: '2026-11.2' }, bearer)).json.error.code, 'FAMILY_COUNTRY_UNAVAILABLE');
  assert.equal((await api('/v1/family', 'POST', { country: 'UZ', consentVersion: '2025-01' }, bearer)).json.error.code, 'FAMILY_CONSENT_OUTDATED');
  assert.equal((await api('/v1/family/children', 'POST', { nickname: 'Ali', birthDate: yearsAgo(10), consentVersion: '2026-11.2' }, bearer)).json.error.code, 'FAMILY_REQUIRED');
  assert.equal((await api('/v1/family', 'POST', { country: 'UZ', consentVersion: '2026-11.2' }, bearer)).status, 201);

  // Children: under 18 only; a real calendar date.
  assert.equal((await api('/v1/family/children', 'POST', { nickname: 'Too old', birthDate: yearsAgo(18), consentVersion: '2026-11.2' }, bearer)).json.error.code, 'FAMILY_AGE_INVALID');
  assert.equal((await api('/v1/family/children', 'POST', { nickname: 'Bad', birthDate: '2015-02-30', consentVersion: '2026-11.2' }, bearer)).status, 400);
  const young = (await api('/v1/family/children', 'POST', { nickname: 'Ali', birthDate: yearsAgo(10), consentVersion: '2026-11.2' }, bearer)).json;
  const teen = (await api('/v1/family/children', 'POST', { nickname: 'Malika', birthDate: yearsAgo(17, -30), consentVersion: '2026-11.2' }, bearer)).json;
  assert.deepEqual(young.policy.policy.protectedApps, ['instagram', 'youtube', 'tiktok']);
  assert.equal(young.policy.revision, 1);

  // Policies: strict shape, revision checks, and no social browsers under 13.
  const savePolicy = (childId: string, expectedRevision: number, value: object, auth = bearer) => api(`/v1/family/children/${childId}/policy`, 'PUT', { expectedRevision, policy: value }, auth);
  assert.equal((await savePolicy(young.id, 1, policy({ browsers: { youtube: { enabled: true, subscriptionsFocus: true, hideSponsored: true, hideComments: false } } }))).json.error.code, 'FAMILY_UNDER_13_BROWSING');
  assert.equal((await savePolicy(young.id, 1, { ...policy(), script: 'alert(1)' })).status, 400);
  assert.equal((await savePolicy(teen.id, 1, policy({ browsers: { instagram: { enabled: true, followingFocus: true, hideSponsored: true } } }))).json.revision, 2);
  assert.equal((await savePolicy(teen.id, 1, policy())).json.error.code, 'FAMILY_REVISION_CONFLICT');

  // Another family can neither see nor change these children.
  const other = `Bearer ${otherFresh}`;
  assert.deepEqual((await api('/v1/family', 'GET', undefined, other)).json.children, []);
  assert.equal((await savePolicy(teen.id, 2, policy(), other)).json.error.code, 'FAMILY_CHILD_NOT_FOUND');
  assert.equal((await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, other)).json.error.code, 'FAMILY_CHILD_NOT_FOUND');
  assert.equal((await api(`/v1/family/children/${teen.id}`, 'DELETE', undefined, other)).json.error.code, 'FAMILY_CHILD_NOT_FOUND');

  // Pairing: single-use code, then the parent confirms the code the phone shows, with a fresh sign-in.
  const pairing = (await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, bearer)).json;
  assert.match(pairing.code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert.equal((await api('/v1/family/device/claim', 'POST', { code: 'AAAA-AAAA', platform: 'ios' })).json.error.code, 'FAMILY_PAIRING_INVALID');
  const claimed = (await api('/v1/family/device/claim', 'POST', { code: pairing.code.toLowerCase().replace('-', ' '), platform: 'ios' })).json;
  assert.match(claimed.deviceSecret, /^vqd1_[A-Za-z0-9_-]{43}$/);
  assert.match(claimed.confirmationCode, /^\d{6}$/);
  assert.equal(claimed.childNickname, 'Malika'); assert.equal(claimed.parentName, 'Dilnoza');
  assert.equal((await api('/v1/family/device/claim', 'POST', { code: pairing.code, platform: 'ios' })).json.error.code, 'FAMILY_PAIRING_INVALID');
  const phone = `Device ${claimed.deviceSecret}`;
  const sync = (auth: string, body: object = { appliedRevision: null, report: null, pushToken: null }) => api('/v1/family/device/sync', 'POST', body, auth);
  assert.equal((await sync(phone)).json.state, 'pending');

  const approve = (code: string, auth = bearer, childId = teen.id) => api(`/v1/family/children/${childId}/pairing/approve`, 'POST', { confirmationCode: code }, auth);
  const wrong = claimed.confirmationCode === '000000' ? '111111' : '000000';
  assert.equal((await approve(claimed.confirmationCode, `Bearer ${stale}`)).json.error.code, 'REAUTH_REQUIRED');
  assert.equal((await approve(wrong)).json.error.code, 'FAMILY_CONFIRMATION_MISMATCH');
  assert.equal((await approve(claimed.confirmationCode, bearer, young.id)).json.error.code, 'FAMILY_PAIRING_NOT_READY');
  assert.deepEqual((await approve(claimed.confirmationCode)).json, { replaced: false });

  // The phone gets only its own child's rules and cannot use parent routes.
  const active = (await sync(phone, { appliedRevision: 1, report, pushToken: 'ExponentPushToken[phoneA]' })).json;
  assert.equal(active.state, 'active'); assert.equal(active.revision, 2); assert.equal(active.child.nickname, 'Malika');
  assert.equal(active.parentName, 'Dilnoza');
  assert.equal(Object.hasOwn(active, 'secret_hash'), false);
  assert.equal((await api('/v1/family', 'GET', undefined, phone)).status, 401);
  assert.equal((await savePolicy(teen.id, 2, policy(), phone)).status, 401);
  assert.equal((await sync('Device vqd1_' + 'A'.repeat(43))).json.state, 'unknown');
  assert.equal((await sync('Device not-a-secret')).status, 401);
  assert.equal((await sync(phone, { appliedRevision: 1, report: { ...report, browsingHistory: ['x'] }, pushToken: null })).status, 400);

  // "Applied" only after the phone reports the current revision; a revision from the future is ignored.
  let child = (await api('/v1/family', 'GET', undefined, bearer)).json.children.find((item: { id: string }) => item.id === teen.id);
  assert.equal(child.device.appliedRevision, 1); assert.equal(child.device.report.timezone, 'Asia/Tashkent');
  await sync(phone, { appliedRevision: 99, report, pushToken: null });
  child = (await api('/v1/family', 'GET', undefined, bearer)).json.children.find((item: { id: string }) => item.id === teen.id);
  assert.equal(child.device.appliedRevision, 1);
  assert.equal((await savePolicy(teen.id, 2, policy())).json.revision, 3);
  assert.deepEqual(hints.at(-1), ['ExponentPushToken[phoneA]']);
  await sync(phone, { appliedRevision: 3, report, pushToken: null });
  child = (await api('/v1/family', 'GET', undefined, bearer)).json.children.find((item: { id: string }) => item.id === teen.id);
  assert.equal(child.device.appliedRevision, 3);

  // Five wrong confirmation codes end the pairing.
  const second = (await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, bearer)).json;
  const secondClaim = (await api('/v1/family/device/claim', 'POST', { code: second.code, platform: 'android' })).json;
  const notIt = secondClaim.confirmationCode === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 4; attempt++) assert.equal((await approve(notIt)).json.error.code, 'FAMILY_CONFIRMATION_MISMATCH');
  assert.equal((await approve(notIt)).json.error.code, 'FAMILY_PAIRING_ENDED');
  assert.equal((await approve(secondClaim.confirmationCode)).json.error.code, 'FAMILY_PAIRING_NOT_READY');
  assert.equal((await sync(`Device ${secondClaim.deviceSecret}`)).json.state, 'unknown');

  // Expired codes cannot be claimed.
  const expiring = (await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, bearer)).json;
  await db.query("update public.family_pairings set expires_at = now() - interval '1 second'");
  assert.equal((await api('/v1/family/device/claim', 'POST', { code: expiring.code, platform: 'ios' })).json.error.code, 'FAMILY_PAIRING_INVALID');

  // Replacing the phone revokes the old one; it is told so and can confirm.
  const third = (await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, bearer)).json;
  const newPhone = (await api('/v1/family/device/claim', 'POST', { code: third.code, platform: 'android' })).json;
  assert.deepEqual((await approve(newPhone.confirmationCode)).json, { replaced: true });
  assert.equal((await sync(phone)).json.state, 'revoked');
  assert.equal((await api('/v1/family/device/release', 'POST', undefined, phone)).status, 200);
  assert.equal((await sync(phone)).json.state, 'unknown');
  const replacement = `Device ${newPhone.deviceSecret}`;
  assert.equal((await sync(replacement)).json.state, 'active');
  assert.equal((await api('/v1/family/device/release', 'POST', undefined, replacement)).json.error.code, 'FAMILY_NOT_RELEASED');

  // Under 18 the child cannot end supervision; from 18 they can.
  assert.equal((await api('/v1/family/device/end-supervision', 'POST', undefined, replacement)).json.error.code, 'FAMILY_NOT_ADULT');

  // Removing supervision needs a fresh sign-in; the phone is released on its next contact.
  assert.equal((await api(`/v1/family/children/${teen.id}`, 'DELETE', undefined, `Bearer ${stale}`)).json.error.code, 'REAUTH_REQUIRED');
  assert.deepEqual((await api(`/v1/family/children/${teen.id}`, 'DELETE', undefined, bearer)).json, { state: 'pending' });
  assert.equal((await api('/v1/family', 'GET', undefined, bearer)).json.children.find((item: { id: string }) => item.id === teen.id).removalPending, true);
  assert.equal((await savePolicy(teen.id, 3, policy())).json.error.code, 'FAMILY_REMOVAL_PENDING');
  assert.equal((await sync(replacement)).json.state, 'released');
  assert.equal((await api('/v1/family/device/release', 'POST', undefined, replacement)).status, 200);
  assert.equal((await api('/v1/family', 'GET', undefined, bearer)).json.children.some((item: { id: string }) => item.id === teen.id), false);
  // A child without a phone goes at once.
  assert.deepEqual((await api(`/v1/family/children/${young.id}`, 'DELETE', undefined, bearer)).json, { state: 'removed' });

  // Turning 18: the supervised person ends it themselves.
  const adult = (await api('/v1/family/children', 'POST', { nickname: 'Sardor', birthDate: yearsAgo(17), consentVersion: '2026-11.2' }, bearer)).json;
  const adultCode = (await api(`/v1/family/children/${adult.id}/pairing`, 'POST', undefined, bearer)).json;
  const adultPhone = (await api('/v1/family/device/claim', 'POST', { code: adultCode.code, platform: 'ios' })).json;
  await approve(adultPhone.confirmationCode, bearer, adult.id);
  await db.query("update public.family_children set birth_date = current_date - interval '18 years' where id = $1", [adult.id]);
  assert.deepEqual((await api('/v1/family/device/end-supervision', 'POST', undefined, `Device ${adultPhone.deviceSecret}`)).json, { state: 'released' });

  // Export lists consents and children but never secrets; deletion needs a fresh sign-in.
  const exported = (await api('/v1/me/export', 'GET', undefined, bearer)).json;
  assert.equal(exported.family.family.country, 'UZ');
  assert.ok(exported.family.consents.some((item: { kind: string }) => item.kind === 'child_enrollment'));
  assert.doesNotMatch(JSON.stringify(exported), /vqd1_|secret|hash|PushToken/);
  assert.equal((await api('/v1/family', 'DELETE', undefined, `Bearer ${stale}`)).json.error.code, 'REAUTH_REQUIRED');
  assert.deepEqual((await api('/v1/family', 'DELETE', undefined, bearer)).json, { deleted: true });
  assert.equal((await api('/v1/family', 'GET', undefined, bearer)).json.family, null);
  for (const table of ['families', 'family_children', 'family_policies', 'family_pairings', 'family_devices', 'family_consents']) {
    assert.equal(Number((await db.query<{ count: string }>(`select count(*) from public.${table}`)).rows[0]?.count), 0, table);
  }
});

test('family tables and functions are closed to app users; deleting the account removes the family', async (t) => {
  const { db, rpc } = await database(); t.after(() => db.close());
  const api = edgeClient(rpc);
  await api('/v1/family', 'POST', { country: 'UZ', consentVersion: '2026-11.2' }, `Bearer ${fresh}`);
  await api('/v1/family/children', 'POST', { nickname: 'Ali', birthDate: yearsAgo(9), consentVersion: '2026-11.2' }, `Bearer ${fresh}`);
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PARENT]);
    await assert.rejects(db.query('select * from public.family_children'), /permission denied/);
    await assert.rejects(db.query('select * from public.family_devices'), /permission denied/);
    await assert.rejects(db.query('select public.family_overview($1)', [PARENT]), /permission denied/);
    await assert.rejects(db.query("select public.family_device_sync('x', null, null, null)"), /permission denied/);
    await db.exec('reset role');
  }
  await db.query('delete from auth.users where id = $1', [PARENT]);
  assert.equal(Number((await db.query<{ count: string }>('select count(*) from public.family_children')).rows[0]?.count), 0);
});

test('family enrollment stays closed until switched on, and Fastify enforces the same checks', async (t) => {
  const { db, rpc } = await database(); t.after(() => db.close());
  const closed = { ...config, FAMILY_ENROLLMENT_ENABLED: 'false' as const };
  const handler = createEdgeHandler(closed, async () => undefined, gateway, undefined, undefined, null, rpc, async () => undefined);
  const setup = await handler(new Request(base + '/v1/family', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` }, body: JSON.stringify({ country: 'UZ', consentVersion: '2026-11.2' }) }));
  assert.equal((await setup.json()).error.code, 'FAMILY_ENROLLMENT_CLOSED');
  const overview = await (await handler(new Request(base + '/v1/family', { headers: { Authorization: `Bearer ${fresh}` } }))).json();
  assert.equal(overview.enrollmentOpen, false);

  // Without a server key the routes answer 503 instead of failing open.
  const unconfigured = createEdgeHandler(config, async () => undefined, gateway, undefined, undefined, null, null, async () => undefined);
  assert.equal((await unconfigured(new Request(base + '/v1/family', { headers: { Authorization: `Bearer ${fresh}` } }))).status, 503);

  const app = await buildApp(config, gateway, null, rpc, async () => undefined); t.after(() => app.close());
  const inject = (url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', payload?: object, authorization?: string) => app.inject({ url, method, ...(payload ? { payload } : {}), headers: authorization ? { authorization } : {} });
  assert.equal((await inject('/v1/family', 'POST', { country: 'UZ', consentVersion: '2026-11.2' }, `Bearer ${fresh}`)).statusCode, 201);
  const child = (await inject('/v1/family/children', 'POST', { nickname: 'Ali', birthDate: yearsAgo(11), consentVersion: '2026-11.2' }, `Bearer ${fresh}`)).json();
  const blocked = await inject(`/v1/family/children/${child.id}/policy`, 'PUT', { expectedRevision: 1, policy: policy({ browsers: { tiktok: { enabled: true, followingFocus: true } } }) }, `Bearer ${fresh}`);
  assert.equal(blocked.json().error.code, 'FAMILY_UNDER_13_BROWSING');
  assert.equal((await inject('/v1/family/device/sync', 'POST', { appliedRevision: null, report: null, pushToken: null })).json().error.code, 'DEVICE_AUTH_REQUIRED');
  assert.equal((await inject(`/v1/family/children/${child.id}`, 'DELETE', undefined, `Bearer ${stale}`)).json().error.code, 'REAUTH_REQUIRED');
  assert.equal((await inject(`/v1/family/children/not-a-uuid/policy`, 'PUT', { expectedRevision: 1, policy: policy() }, `Bearer ${fresh}`)).statusCode, 400);
});

test('family helpers: codes, sign-in time and path matching', () => {
  const codes = new Set(Array.from({ length: 200 }, () => newPairingCode()));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[A-HJKMNP-Z2-9]{8}$/);
  // Bytes from 248 up are skipped so every character is equally likely.
  assert.equal(newPairingCode(() => Uint8Array.from([255, 248, 0, 30, 31, 61, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), 'A9A9BCDE');
  assert.equal(authenticatedAt(fresh)! > Date.now() / 1000 - 60, true);
  assert.equal(authenticatedAt('not.a.token'), null);
  assert.deepEqual(matchFamilyPath('/v1/family/children/:childId/policy', '/v1/family/children/abc-123/policy'), { childId: 'abc-123' });
  assert.equal(matchFamilyPath('/v1/family/children/:childId', '/v1/family/children/a/b'), null);
});

test('usage reports: totals per day and app, retries and late reports change nothing, 7 days kept', async (t) => {
  const { db, rpc } = await database(); t.after(() => db.close());
  const api = edgeClient(rpc);
  const bearer = `Bearer ${fresh}`;
  await api('/v1/family', 'POST', { country: 'UZ', consentVersion: '2026-11.2' }, bearer);
  const teen = (await api('/v1/family/children', 'POST', { nickname: 'Malika', birthDate: yearsAgo(15), consentVersion: '2026-11.2' }, bearer)).json;
  const withLimits = policy({ browsers: { instagram: { enabled: true, followingFocus: true, hideSponsored: false, hideStories: true, messagesOnly: true } }, limits: { instagram: 45 } });
  assert.equal((await api(`/v1/family/children/${teen.id}/policy`, 'PUT', { expectedRevision: 1, policy: withLimits }, bearer)).json.revision, 2);
  assert.equal((await api(`/v1/family/children/${teen.id}/policy`, 'PUT', { expectedRevision: 2, policy: policy({ limits: { instagram: 1 } }) }, bearer)).status, 400);
  assert.equal((await api(`/v1/family/children/${teen.id}/policy`, 'PUT', { expectedRevision: 2, policy: policy({ limits: { snapchat: 30 } }) }, bearer)).status, 400);
  const pairing = (await api(`/v1/family/children/${teen.id}/pairing`, 'POST', undefined, bearer)).json;
  const claimed = (await api('/v1/family/device/claim', 'POST', { code: pairing.code, platform: 'android' })).json;
  await api(`/v1/family/children/${teen.id}/pairing/approve`, 'POST', { confirmationCode: claimed.confirmationCode }, bearer);
  const phone = `Device ${claimed.deviceSecret}`;
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const sync = (usage: unknown) => api('/v1/family/device/sync', 'POST', { appliedRevision: 2, report: null, pushToken: null, usage }, phone);
  const usageOf = async () => (await api('/v1/family', 'GET', undefined, bearer)).json.children[0].usage as { day: string; platform: string; foregroundMs: number }[];

  assert.equal((await sync({ sequence: 1, days: [{ day: today, apps: { instagram: 600_000 } }, { day: daysAgo(1), apps: { youtube: 1_200_000 } }] })).json.state, 'active');
  assert.equal((await api('/v1/family/device/sync', 'POST', { appliedRevision: 2, report: null, pushToken: null }, phone)).json.state, 'active');
  // The same report again, and an older one that arrived late, change nothing.
  await sync({ sequence: 1, days: [{ day: today, apps: { instagram: 600_000 } }] });
  await sync({ sequence: 2, days: [{ day: today, apps: { instagram: 900_000 } }] });
  await sync({ sequence: 1, days: [{ day: today, apps: { instagram: 100_000 } }] });
  const usage = await usageOf();
  assert.deepEqual(usage.map(({ day, platform, foregroundMs }) => ({ day, platform, foregroundMs })), [
    { day: daysAgo(1), platform: 'youtube', foregroundMs: 1_200_000 },
    { day: today, platform: 'instagram', foregroundMs: 900_000 },
  ]);
  // Only browsing time crosses: no other apps, URLs or a malformed shape.
  assert.equal((await sync({ sequence: 3, days: [{ day: today, apps: { whatsapp: 1 } }] })).status, 400);
  assert.equal((await sync({ sequence: 3, days: [{ day: today, apps: { instagram: 1 }, url: 'https://instagram.com/x' }] })).status, 400);
  assert.equal((await sync({ sequence: 3, days: [{ day: today, apps: { instagram: 86_400_001 } }] })).status, 400);

  // Older than 7 days: not stored, and removed if already there.
  await sync({ sequence: 4, days: [{ day: daysAgo(20), apps: { tiktok: 60_000 } }] });
  await db.query("insert into public.family_usage (child_id, day, platform, foreground_ms) values ($1, current_date - 9, 'tiktok', 1)", [teen.id]);
  await sync({ sequence: 5, days: [] });
  assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.family_usage where day < current_date - 7')).rows[0]?.count, 0);
  assert.equal((await usageOf()).some((row) => row.platform === 'tiktok'), false);

  // Usage is in the parent's export and goes with the child.
  const exported = await rpc('family_export', { p_parent: PARENT }) as { children: { usage: unknown[] }[] };
  assert.equal(exported.children[0]?.usage.length, 2);
  await api(`/v1/family/children/${teen.id}`, 'DELETE', undefined, bearer);
  await api('/v1/family/device/release', 'POST', undefined, phone);
  assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.family_usage')).rows[0]?.count, 0);
});
