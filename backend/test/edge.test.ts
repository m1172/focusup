import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEdgeHandler } from '../src/edge.ts';
import { ApiError } from '../src/errors.ts';
import { RateLimitError, rateLimitSubject } from '../src/edgeRateLimit.ts';
import { config, fakeGateway, session, settings, user } from './fixtures.js';
import { createSupportRelay, supportPostText, type SupportRelay } from '../src/telegram.ts';
import type { SupportMessage } from '../src/gateway.ts';
import { createExpoPush, supportReplyPreview, type PushMessage } from '../src/push.ts';

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

const webhookSecret = 'webhook-secret-0123456789abcdef';
const supportConfig = { ...edgeConfig, TELEGRAM_BOT_TOKEN: '123456:' + 'a'.repeat(35), TELEGRAM_SUPPORT_CHAT_ID: '-1001', TELEGRAM_WEBHOOK_SECRET: webhookSecret };
function fakeRelay(posts: string[], replies: string[] = [], fail = false): SupportRelay {
  const real = createSupportRelay(supportConfig, async () => { throw new Error('No network in tests'); });
  return {
    configured: true, isTeamChat: real.isTeamChat, verifyWebhook: real.verifyWebhook,
    post: async (text) => { if (fail) throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Down.'); posts.push(text); return 900 + posts.length; },
    reply: async (_chat, _id, text) => { replies.push(text); },
    acknowledge: async () => {},
  };
}
const webhook = (update: unknown, secret: string | null = webhookSecret) => new Request(base + '/v1/support/telegram', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}) }, body: JSON.stringify(update),
});

test('support chat stores the user message, posts it to the team chat and links the Telegram id', async () => {
  const posts: string[] = []; const links: [number, number][] = []; const buckets: string[] = [];
  const stored: SupportMessage = { id: 7, sender: 'user', body: 'Reels came back', createdAt: '2026-10-20T10:00:00Z' };
  const handler = createEdgeHandler(supportConfig, async (bucket) => { buckets.push(bucket); }, fakeGateway({
    getProfile: async () => ({ displayName: 'Ali', updatedAt: null }),
    addSupportMessage: async (userId, sender, body) => { assert.equal(userId, user.id); assert.equal(sender, 'user'); assert.equal(body, 'Reels came back'); return stored; },
    linkSupportMessage: async (id, telegramId) => { links.push([id, telegramId]); },
    listSupportMessages: async (identity, after) => { assert.equal(identity.id, user.id); assert.equal(after, 7); return [stored]; },
  }), fakeRelay(posts));
  const sent = await handler(request('/v1/support/messages', 'POST', { body: '  Reels came back ', context: 'FocusUp 1.0.0' }, user.token));
  assert.equal(sent.status, 201);
  assert.deepEqual(await sent.json(), stored);
  assert.deepEqual(links, [[7, 901]]);
  assert.match(posts[0]!, /Ali · test@example\.com/);
  assert.match(posts[0]!, /#u11111111/);
  assert.match(posts[0]!, /— FocusUp 1\.0\.0/);
  assert.ok(buckets.some((bucket) => bucket.startsWith('edge:support:') && !bucket.includes(user.id)));
  const listed = await (await handler(request('/v1/support/messages?after=7', 'GET', undefined, user.token))).json();
  assert.deepEqual(listed, { available: true, messages: [stored] });
  assert.equal((await handler(request('/v1/support/messages?after=-1', 'GET', undefined, user.token))).status, 400);
  assert.equal((await handler(request('/v1/support/messages', 'POST', { body: '   ' }, user.token))).status, 400);
  assert.equal((await handler(request('/v1/support/messages', 'POST', { body: 'x'.repeat(2001) }, user.token))).status, 400);
  assert.equal((await handler(request('/v1/support/messages', 'POST', { body: 'hi', userId: 'other' }, user.token))).status, 400);
  assert.equal((await handler(request('/v1/support/messages', 'POST', { body: 'hi' }))).status, 401);
});

test('support chat removes a message Telegram did not accept and answers 503 when the bot is not set up', async () => {
  const removed: number[] = [];
  const gateway = fakeGateway({
    getProfile: async () => ({ displayName: '', updatedAt: null }),
    addSupportMessage: async () => ({ id: 3, sender: 'user', body: 'Hi', createdAt: '' }),
    removeSupportMessage: async (id) => { removed.push(id); },
    listSupportMessages: async () => [],
  });
  const failing = createEdgeHandler(supportConfig, noLimit, gateway, fakeRelay([], [], true));
  assert.equal((await failing(request('/v1/support/messages', 'POST', { body: 'Hi' }, user.token))).status, 503);
  assert.deepEqual(removed, [3]);
  const unconfigured = createEdgeHandler(edgeConfig, noLimit, gateway);
  assert.equal((await unconfigured(request('/v1/support/messages', 'POST', { body: 'Hi' }, user.token))).status, 503);
  assert.deepEqual(await (await unconfigured(request('/v1/support/messages', 'GET', undefined, user.token))).json(), { available: false, messages: [] });
  assert.equal((await unconfigured(webhook({}))).status, 401);
});

test('telegram webhook turns team replies into answers and ignores forged or unrelated updates', async () => {
  const saved: [string, string, string, number | undefined][] = []; const replies: string[] = [];
  const handler = createEdgeHandler(supportConfig, noLimit, fakeGateway({
    findSupportThread: async (telegramId) => telegramId === 901 ? user.id : null,
    addSupportMessage: async (userId, sender, body, telegramId) => { saved.push([userId, sender, body, telegramId]); return saved.length === 1 ? { id: 8, sender, body, createdAt: '' } : null; },
  }), fakeRelay([], replies));
  const reply = (text: string | undefined, chat = -1001, replyTo: number | undefined = 901, id = 950) => ({ message: { message_id: id, chat: { id: chat }, ...(text !== undefined ? { text } : {}), ...(replyTo ? { reply_to_message: { message_id: replyTo } } : {}) } });
  for (const secret of [null, 'wrong-secret-0123456789abcdef', webhookSecret + 'x']) assert.equal((await handler(webhook(reply('Hi'), secret))).status, 401);
  assert.equal((await handler(webhook(reply(' It is fixed now ')))).status, 200);
  assert.deepEqual(saved, [[user.id, 'support', 'It is fixed now', 950]]);
  // Telegram retries: the same Telegram id is stored once (the gateway reports the duplicate as null).
  assert.equal((await handler(webhook(reply('It is fixed now')))).status, 200);
  for (const update of [reply('Hi', 555), reply('Hi', -1001, 0), reply('Hi', -1001, 12345), {}, { edited_message: {} }]) {
    assert.equal((await handler(webhook(update))).status, 200);
  }
  assert.equal(saved.length, 2);
  assert.equal((await handler(webhook(reply(undefined)))).status, 200);
  assert.deepEqual(replies, ['Only text replies reach the app.']);
});

test('support post text is plain and tagged, and the relay hides Telegram failures', async () => {
  const text = supportPostText({ userId: user.id, email: null, displayName: '', body: '<b>hi</b>' });
  assert.match(text, /^💬 FocusUp user\n#u11111111\n\n<b>hi<\/b>/);
  const calls: string[] = [];
  const relay = createSupportRelay(supportConfig, async (input, init) => {
    calls.push(String(input)); assert.equal(JSON.parse(String(init?.body)).parse_mode, undefined);
    return Response.json({ ok: false, description: 'Bad Request: chat not found' }, { status: 400 });
  });
  await assert.rejects(relay.post('hello'), (error: ApiError) => error.statusCode === 503 && !error.message.includes('chat not found'));
  assert.ok(calls[0]!.endsWith('/sendMessage'));
  assert.equal(createSupportRelay(edgeConfig).configured, false);
});

test('push-token routes save and remove only the signed-in user\'s token and validate its shape', async () => {
  const saved: [string, string, string][] = []; const removed: [string, string][] = [];
  const handler = createEdgeHandler(supportConfig, noLimit, fakeGateway({
    saveSupportPushToken: async (userId, token, platform) => { saved.push([userId, token, platform]); },
    removeSupportPushToken: async (userId, token) => { removed.push([userId, token]); },
  }), fakeRelay([]));
  const token = 'ExponentPushToken[abcDEF123_-xyz]';
  assert.equal((await handler(request('/v1/support/push-token', 'PUT', { token, platform: 'ios' }, user.token))).status, 204);
  assert.deepEqual(saved, [[user.id, token, 'ios']]);
  for (const body of [{ token: 'not-a-token', platform: 'ios' }, { token, platform: 'web' }, { token, platform: 'android', userId: 'other' }, { token: 'ExponentPushToken[a]b]', platform: 'ios' }]) {
    assert.equal((await handler(request('/v1/support/push-token', 'PUT', body, user.token))).status, 400);
  }
  assert.equal((await handler(request('/v1/support/push-token', 'PUT', { token, platform: 'ios' }))).status, 401);
  assert.equal((await handler(request('/v1/support/push-token', 'DELETE', { token }, user.token))).status, 204);
  assert.deepEqual(removed, [[user.id, token]]);
  assert.equal(saved.length, 1);
});

test('a saved team reply notifies the user\'s devices, forgets unregistered tokens and survives push failures', async () => {
  const pushes: [string[], PushMessage][] = []; const forgotten: string[][] = []; let saves = 0;
  let pushFails = false;
  const handler = createEdgeHandler(supportConfig, noLimit, fakeGateway({
    findSupportThread: async () => user.id,
    addSupportMessage: async (_userId, sender, body) => (++saves === 2 ? null : { id: 8 + saves, sender, body, createdAt: '' }),
    listSupportPushTokens: async (userId) => { assert.equal(userId, user.id); return ['ExponentPushToken[one]', 'ExponentPushToken[two]']; },
    forgetSupportPushTokens: async (tokens) => { forgotten.push(tokens); },
  }), fakeRelay([]), async (tokens, message) => {
    if (pushFails) throw new Error('Expo is down');
    pushes.push([tokens, message]); return ['ExponentPushToken[two]'];
  });
  const reply = (text: string, id: number) => ({ message: { message_id: id, chat: { id: -1001 }, text, reply_to_message: { message_id: 901 } } });
  const long = 'Thanks for writing!\n\nWe found the problem: ' + 'x'.repeat(200);
  assert.equal((await handler(webhook(reply(long, 950)))).status, 200);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0]![0], ['ExponentPushToken[one]', 'ExponentPushToken[two]']);
  assert.equal(pushes[0]![1].title, 'FocusUp');
  assert.deepEqual(pushes[0]![1].data, { kind: 'support-reply', url: '/support' });
  assert.equal(Array.from(pushes[0]![1].body).length, 100);
  assert.match(pushes[0]![1].body, /^Thanks for writing! We found the problem: x+…$/);
  assert.deepEqual(forgotten, [['ExponentPushToken[two]']]);
  // A retried webhook (duplicate reply) sends nothing new.
  assert.equal((await handler(webhook(reply(long, 950)))).status, 200);
  assert.equal(pushes.length, 1);
  pushFails = true;
  assert.equal((await handler(webhook(reply('Second answer', 951)))).status, 200);
});

test('expo push sends one batch and reports only unregistered devices', async () => {
  const calls: { url: string; body: unknown[] }[] = [];
  const push = createExpoPush(async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({ data: [{ status: 'ok', id: 'a' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }] });
  });
  const tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[c]'];
  assert.deepEqual(await push(tokens, { title: 'FocusUp', body: 'Hi', data: { kind: 'support-reply' } }), ['ExponentPushToken[b]']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://exp.host/--/api/v2/push/send');
  assert.deepEqual(calls[0]!.body[0], { to: 'ExponentPushToken[a]', title: 'FocusUp', body: 'Hi', data: { kind: 'support-reply' }, channelId: 'default', priority: 'high' });
  assert.deepEqual(await push([], { title: 'FocusUp', body: 'Hi', data: {} }), []);
  assert.equal(calls.length, 1);
  await assert.rejects(createExpoPush(async () => new Response('busy', { status: 503 }))(tokens, { title: 'FocusUp', body: 'Hi', data: {} }));
  assert.equal(supportReplyPreview('  Short\nreply  '), 'Short reply');
  assert.equal(supportReplyPreview('👍'.repeat(150)), '👍'.repeat(99) + '…');
});
