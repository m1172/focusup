import { ZodError } from 'zod';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import { createGateway, type Gateway, type Identity } from './gateway.ts';
import { RateLimitError, rateLimitSubject, type ConsumeLimit } from './edgeRateLimit.ts';
import { credentialsSchema, deleteSettingsSchema, idTokenSchema, oauthExchangeSchema, oauthStartSchema, passwordSchema, profileSchema, pushTokenSchema, recoverySchema, removePushTokenSchema, refreshSchema, resendSchema, saveSettingsSchema, signupSchema, supportCursorSchema, supportMessageSchema, verifyCodeSchema, verifySchema } from './schemas.ts';
import { createExpoPush, supportReplyPreview, type PushSender } from './push.ts';
import { createSupportRelay, supportPostText, type SupportRelay, type TelegramUpdate } from './telegram.ts';

type Result = { data?: unknown; status?: number };
type Route = { private?: boolean; auth?: boolean; body?: boolean; run: (body: unknown, user: Identity, request: Request) => Promise<Result> };
const BODY_LIMIT = 65_536;

async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.split(';')[0]?.trim().match(/^application\/json$/i)) {
    throw new ApiError(415, 'INVALID_REQUEST', 'Use application/json.');
  }
  if (Number(request.headers.get('content-length')) > BODY_LIMIT) throw new ApiError(413, 'INVALID_REQUEST', 'Request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'INVALID_REQUEST', 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, 10_000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new ApiError(408, 'INVALID_REQUEST', 'Request body timed out.');
      if (done) break;
      length += value.byteLength;
      if (length > BODY_LIMIT) { void reader.cancel().catch(() => undefined); throw new ApiError(413, 'INVALID_REQUEST', 'Request body is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON body.'); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

/** Fetch-based API used by the Supabase runtime. Public login routes deliberately
 * have no platform JWT requirement; every private route verifies the user's
 * token through Auth, and the gateway uses that token for RLS-scoped data access. */
export function createEdgeHandler(config: Config, consumeLimit: ConsumeLimit, gateway: Gateway = createGateway(config), relay: SupportRelay = createSupportRelay(config), push: PushSender = createExpoPush()) {
  if (!config.SUPABASE_SECRET_KEY) throw new Error('Edge API requires a server secret key');
  const secret = config.SUPABASE_SECRET_KEY;
  const origins = config.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  const providers = config.AUTH_OAUTH_PROVIDERS.split(',').map((value) => value.trim()).filter(Boolean);
  const routes = new Map<string, Route>();
  const route = (method: string, path: string, run: Route['run'], options: Omit<Route, 'run'> = {}) => routes.set(`${method} ${path}`, { run, ...options });
  const auth = { auth: true, body: true };
  const privateRoute = { private: true };
  const privateBody = { private: true, body: true };

  route('GET', '/health', async () => ({ data: { status: 'ok' } }));
  route('GET', '/ready', async () => { await consumeLimit('edge:readiness', 60); await gateway.ready(); return { data: { status: 'ready' } }; });
  route('GET', '/v1/auth/providers', async () => ({ data: { emailPassword: true, oauth: providers } }));
  route('POST', '/v1/auth/sign-up', async (body) => ({ status: 201, data: await gateway.signUp(signupSchema.parse(body)) }), auth);
  route('POST', '/v1/auth/sign-in', async (body) => ({ data: await gateway.signIn(credentialsSchema.parse(body)) }), auth);
  route('POST', '/v1/auth/refresh', async (body) => ({ data: await gateway.refresh(refreshSchema.parse(body).refreshToken) }), auth);
  route('POST', '/v1/auth/oauth/start', async (body) => {
    const { provider, codeChallenge } = oauthStartSchema.parse(body);
    if (!providers.includes(provider) || !config.AUTH_REDIRECT_URL) throw new ApiError(503, 'PROVIDER_UNAVAILABLE', 'This sign-in provider is not configured.');
    const url = new URL('/auth/v1/authorize', config.SUPABASE_URL);
    url.search = new URLSearchParams({ provider: provider === 'telegram' ? 'custom:telegram' : provider, redirect_to: config.AUTH_REDIRECT_URL, code_challenge: codeChallenge, code_challenge_method: 's256' }).toString();
    return { data: { url: url.toString(), redirectUrl: config.AUTH_REDIRECT_URL } };
  }, auth);
  route('POST', '/v1/auth/oauth/exchange', async (body) => { const value = oauthExchangeSchema.parse(body); return { data: await gateway.exchangeOAuth(value.code, value.codeVerifier) }; }, auth);
  route('POST', '/v1/auth/id-token', async (body) => {
    const value = idTokenSchema.parse(body);
    if (!providers.includes(value.provider)) throw new ApiError(503, 'PROVIDER_UNAVAILABLE', 'This sign-in provider is not configured.');
    return { data: await gateway.signInWithIdToken(value.provider, value.idToken, value.nonce) };
  }, auth);
  route('POST', '/v1/auth/verify', async (body) => { const value = verifySchema.parse(body); return { data: await gateway.verify(value.tokenHash, value.type) }; }, auth);
  route('POST', '/v1/auth/verify-code', async (body) => { const value = verifyCodeSchema.parse(body); return { data: await gateway.verifyCode(value.email, value.token, value.type) }; }, auth);
  route('POST', '/v1/auth/resend-confirmation', async (body) => {
    const value = resendSchema.parse(body); await gateway.resendConfirmation(value.email, value.captchaToken);
    return { status: 202, data: { message: 'If confirmation is needed, a new email has been sent.' } };
  }, auth);
  route('POST', '/v1/auth/forgot-password', async (body) => {
    const value = recoverySchema.parse(body); await gateway.recover(value.email, value.captchaToken);
    return { status: 202, data: { message: 'If the account exists, password reset instructions have been sent.' } };
  }, auth);
  route('POST', '/v1/auth/sign-out', async (_body, user) => { await gateway.signOut(user); return { status: 204 }; }, privateRoute);
  route('PATCH', '/v1/auth/password', async (body, user) => { await gateway.changePassword(user, passwordSchema.parse(body).password); return { status: 204 }; }, privateBody);
  route('GET', '/v1/me', async (_body, user) => ({ data: { id: user.id, email: user.email, profile: await gateway.getProfile(user) } }), privateRoute);
  route('PUT', '/v1/me/profile', async (body, user) => ({ data: await gateway.saveProfile(user, profileSchema.parse(body).displayName) }), privateBody);
  route('GET', '/v1/me/settings', async (_body, user) => ({ data: await gateway.getSettings(user) }), privateRoute);
  route('PUT', '/v1/me/settings', async (body, user) => {
    const value = saveSettingsSchema.parse(body); return { data: await gateway.saveSettings(user, value.expectedRevision, value.payload) };
  }, privateBody);
  route('DELETE', '/v1/me/settings', async (body, user) => ({ data: await gateway.saveSettings(user, deleteSettingsSchema.parse(body).expectedRevision, null) }), privateBody);
  route('GET', '/v1/me/export', async (_body, user) => {
    const [profile, settings] = await Promise.all([gateway.getProfile(user), gateway.getSettings(user)]);
    return { data: { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email }, profile, settings } };
  }, privateRoute);
  route('DELETE', '/v1/me', async (_body, user) => {
    await consumeLimit(`edge:delete:${await rateLimitSubject(secret, user.id)}`, 3);
    await gateway.deleteAccount(user); return { status: 204 };
  }, privateRoute);

  // Support chat: users write here, the bot posts each message to the team's
  // Telegram chat, and a Telegram reply to that post comes back via the webhook.
  const supportUnavailable = () => new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support chat is not available right now.');
  route('GET', '/v1/support/messages', async (_body, user, request) => {
    const after = supportCursorSchema.parse(new URL(request.url).searchParams.get('after') ?? 0);
    return { data: { available: relay.configured, messages: await gateway.listSupportMessages(user, after) } };
  }, privateRoute);
  route('POST', '/v1/support/messages', async (body, user) => {
    const value = supportMessageSchema.parse(body);
    if (!relay.configured) throw supportUnavailable();
    await consumeLimit(`edge:support:${await rateLimitSubject(secret, user.id)}`, 8);
    const profile = await gateway.getProfile(user).catch(() => ({ displayName: '' }));
    const message = await gateway.addSupportMessage(user.id, 'user', value.body);
    if (!message) throw supportUnavailable();
    try {
      const telegramId = await relay.post(supportPostText({ userId: user.id, email: user.email, displayName: profile.displayName, body: value.body, context: value.context }));
      await gateway.linkSupportMessage(message.id, telegramId);
    } catch (error) {
      // A message the team never received must not look sent in the app.
      await gateway.removeSupportMessage(message.id).catch(() => undefined);
      throw error;
    }
    return { status: 201, data: message };
  }, privateBody);
  // Reply notifications: the app registers its Expo push token once the user allows it.
  route('PUT', '/v1/support/push-token', async (body, user) => {
    const value = pushTokenSchema.parse(body);
    await gateway.saveSupportPushToken(user.id, value.token, value.platform); return { status: 204 };
  }, privateBody);
  route('DELETE', '/v1/support/push-token', async (body, user) => {
    await gateway.removeSupportPushToken(user.id, removePushTokenSchema.parse(body).token); return { status: 204 };
  }, privateBody);
  // A missed notification must never fail the webhook: the reply is saved and the chat shows it.
  const notifyReply = async (userId: string, body: string) => {
    try {
      const tokens = await gateway.listSupportPushTokens(userId);
      const gone = await push(tokens, { title: 'Vaqtim', body: supportReplyPreview(body), data: { kind: 'support-reply', url: '/support' } });
      await gateway.forgetSupportPushTokens(gone);
    } catch { /* Ignored. */ }
  };
  route('POST', '/v1/support/telegram', async (body, _user, request) => {
    if (!relay.verifyWebhook(request.headers.get('x-telegram-bot-api-secret-token'))) throw new ApiError(401, 'INVALID_WEBHOOK', 'Unknown webhook.');
    await consumeLimit('edge:telegram', 600);
    const ok = { data: { ok: true } };
    const message = (body && typeof body === 'object' ? (body as TelegramUpdate).message : undefined);
    // Only replies inside the team chat become answers; everything else is acknowledged and dropped.
    if (!message?.reply_to_message || !relay.isTeamChat(message.chat.id)) return ok;
    const userId = await gateway.findSupportThread(message.reply_to_message.message_id);
    if (!userId) return ok;
    const text = message.text?.trim();
    if (!text) { await relay.reply(message.chat.id, message.message_id, 'Only text replies reach the app.'); return ok; }
    const saved = await gateway.addSupportMessage(userId, 'support', text.slice(0, 2000), message.message_id);
    if (saved) await Promise.all([relay.acknowledge(message.message_id), notifyReply(userId, saved.body)]);
    return ok;
  }, { body: true });
  route('GET', '/v1/blocker-config', async () => ({ data: { schemaVersion: 1, platforms: {} } }));

  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Request-Id': requestId });
    const origin = request.headers.get('origin');
    if (origin && origins.includes(origin)) { headers.set('Access-Control-Allow-Origin', origin); headers.set('Vary', 'Origin'); }
    const respond = (data: unknown, status = 200) => status === 204 ? new Response(null, { status, headers }) : Response.json(data, { status, headers });
    try {
      if (origin && !origins.includes(origin)) throw new ApiError(403, 'ORIGIN_FORBIDDEN', 'This origin is not allowed.');
      if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
        return respond(undefined, 204);
      }
      // Hosted and local gateways may include /functions/v1 in the incoming URL.
      const pathname = new URL(request.url).pathname;
      const mount = ['/functions/v1/focusup-api', '/focusup-api'].find((prefix) => pathname.startsWith(prefix + '/'));
      const path = mount ? pathname.slice(mount.length) : '';
      const handler = routes.get(`${request.method} ${path}`);
      if (!handler) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.');
      let user: Identity | undefined;
      if (handler.private) {
        const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
        if (!token || token.length > 8192) throw new ApiError(401, 'AUTH_REQUIRED', 'A valid Bearer access token is required.');
        await consumeLimit('edge:protected-global', 1200);
        user = await gateway.authenticate(token);
        await consumeLimit(`edge:user:${await rateLimitSubject(secret, user.id)}`, 120);
      }
      if (handler.auth) await consumeLimit('edge:auth-global', 120);
      // Supabase's proxy can forward an empty stream even when the caller sent
      // no body. Parse JSON only on routes that require a JSON payload.
      const body = handler.body ? await jsonBody(request) : undefined;
      if (handler.auth && body && typeof body === 'object') {
        const value = body as Record<string, unknown>;
        const subject = typeof value.email === 'string' ? `email:${value.email.trim().toLowerCase()}` : typeof value.refreshToken === 'string' ? `refresh:${value.refreshToken}` : null;
        if (subject) await consumeLimit(`edge:auth:${await rateLimitSubject(secret, subject)}`, 10);
      }
      // Private handlers only receive identities returned by Auth, never body IDs.
      const result = await handler.run(body, user!, request);
      if (path === '/v1/blocker-config') headers.set('Cache-Control', 'public, max-age=900');
      return respond(result.data, result.status);
    } catch (error) {
      if (error instanceof RateLimitError) headers.set('Retry-After', String(error.retryAfter));
      if (error instanceof ZodError) return respond({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', fields: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) }, requestId }, 400);
      if (error instanceof ApiError) return respond({ error: { code: error.code, message: error.message }, requestId }, error.statusCode);
      // Do not log bodies, query strings, tokens, or raw upstream errors.
      console.error(JSON.stringify({ requestId, code: 'INTERNAL_ERROR' }));
      return respond({ error: { code: 'INTERNAL_ERROR', message: 'The service is temporarily unavailable.' }, requestId }, 500);
    }
  };
}
