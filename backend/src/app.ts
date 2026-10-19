import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import { ApiError } from './errors.js';
import { createGateway, type Gateway, type Identity } from './gateway.js';
import { credentialsSchema, deleteSettingsSchema, idTokenSchema, oauthExchangeSchema, oauthStartSchema, passwordSchema, profileSchema, recoverySchema, refreshSchema, resendSchema, saveSettingsSchema, signupSchema, verifyCodeSchema, verifySchema } from './schemas.js';

declare module 'fastify' {
  interface FastifyRequest { identity: Identity | null }
}

export async function buildApp(config: Config, gateway: Gateway = createGateway(config)) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] },
    // Never include query strings in logs: email verification links can carry tokens.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 65_536,
    requestTimeout: 15_000,
    connectionTimeout: 15_000,
    trustProxy: config.TRUST_PROXY ? config.TRUST_PROXY.split(',').map((value) => value.trim()) : false,
  });
  app.decorateRequest('identity', null);
  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  // In-memory limiter is appropriate for one MVP instance. Use a shared store when scaling.
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({ requestId: request.id, method: request.method, route: request.routeOptions.url, statusCode: reply.statusCode }, 'request completed');
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', fields: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) }, requestId: request.id });
    }
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message }, requestId: request.id });
    const status = typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    // Never log raw upstream errors: they can contain email addresses or credentials.
    if (status >= 500) request.log.error({ requestId: request.id, code: 'INTERNAL_ERROR' }, 'request failed');
    return reply.code(status).send({ error: { code: status === 429 ? 'RATE_LIMITED' : status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR', message: status === 429 ? 'Too many requests. Please wait.' : status < 500 ? 'Invalid request.' : 'The service is temporarily unavailable.' }, requestId: request.id });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' }, requestId: request.id }));

  const authenticate = async (request: FastifyRequest) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match?.[1] || match[1].length > 8192) throw new ApiError(401, 'AUTH_REQUIRED', 'A valid Bearer access token is required.');
    request.identity = await gateway.authenticate(match[1]);
  };
  const identity = (request: FastifyRequest) => {
    if (!request.identity) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    return request.identity;
  };
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async () => { await gateway.ready(); return { status: 'ready' }; });

  app.post('/v1/auth/sign-up', authLimit, async (request, reply) => {
    const result = await gateway.signUp(signupSchema.parse(request.body));
    return reply.code(201).send(result);
  });
  app.post('/v1/auth/sign-in', authLimit, async (request) => gateway.signIn(credentialsSchema.parse(request.body)));
  app.post('/v1/auth/refresh', authLimit, async (request) => gateway.refresh(refreshSchema.parse(request.body).refreshToken));
  const enabledProviders = config.AUTH_OAUTH_PROVIDERS.split(',').map((value) => value.trim()).filter(Boolean);
  app.get('/v1/auth/providers', async () => ({ emailPassword: true, oauth: enabledProviders }));
  app.post('/v1/auth/oauth/start', authLimit, async (request) => {
    const { provider, codeChallenge } = oauthStartSchema.parse(request.body);
    if (!enabledProviders.includes(provider) || !config.AUTH_REDIRECT_URL) throw new ApiError(503, 'PROVIDER_UNAVAILABLE', 'This sign-in provider is not configured.');
    const url = new URL('/auth/v1/authorize', config.SUPABASE_URL);
    url.search = new URLSearchParams({ provider: provider === 'telegram' ? 'custom:telegram' : provider, redirect_to: config.AUTH_REDIRECT_URL, code_challenge: codeChallenge, code_challenge_method: 's256' }).toString();
    return { url: url.toString(), redirectUrl: config.AUTH_REDIRECT_URL };
  });
  app.post('/v1/auth/oauth/exchange', authLimit, async (request) => {
    const { code, codeVerifier } = oauthExchangeSchema.parse(request.body);
    return gateway.exchangeOAuth(code, codeVerifier);
  });
  app.post('/v1/auth/id-token', authLimit, async (request) => {
    const { provider, idToken, nonce } = idTokenSchema.parse(request.body);
    if (!enabledProviders.includes(provider)) throw new ApiError(503, 'PROVIDER_UNAVAILABLE', 'This sign-in provider is not configured.');
    return gateway.signInWithIdToken(provider, idToken, nonce);
  });
  app.post('/v1/auth/verify', authLimit, async (request) => { const body = verifySchema.parse(request.body); return gateway.verify(body.tokenHash, body.type); });
  app.post('/v1/auth/verify-code', authLimit, async (request) => { const body = verifyCodeSchema.parse(request.body); return gateway.verifyCode(body.email, body.token, body.type); });
  app.post('/v1/auth/resend-confirmation', authLimit, async (request, reply) => {
    const body = resendSchema.parse(request.body); await gateway.resendConfirmation(body.email, body.captchaToken);
    return reply.code(202).send({ message: 'If confirmation is needed, a new email has been sent.' });
  });
  app.post('/v1/auth/forgot-password', authLimit, async (request, reply) => {
    const { email, captchaToken } = recoverySchema.parse(request.body);
    await gateway.recover(email, captchaToken);
    return reply.code(202).send({ message: 'If the account exists, password reset instructions have been sent.' });
  });

  await app.register(async (privateApi) => {
    privateApi.addHook('onRequest', authenticate);
    privateApi.post('/auth/sign-out', async (request, reply) => { await gateway.signOut(identity(request)); return reply.code(204).send(); });
    privateApi.patch('/auth/password', async (request, reply) => { await gateway.changePassword(identity(request), passwordSchema.parse(request.body).password); return reply.code(204).send(); });
    privateApi.get('/me', async (request) => {
      const user = identity(request);
      return { id: user.id, email: user.email, profile: await gateway.getProfile(user) };
    });
    privateApi.put('/me/profile', async (request) => gateway.saveProfile(identity(request), profileSchema.parse(request.body).displayName));
    privateApi.get('/me/settings', async (request) => gateway.getSettings(identity(request)));
    privateApi.put('/me/settings', async (request) => {
      const { expectedRevision, payload } = saveSettingsSchema.parse(request.body);
      return gateway.saveSettings(identity(request), expectedRevision, payload);
    });
    privateApi.delete('/me/settings', async (request) => gateway.saveSettings(identity(request), deleteSettingsSchema.parse(request.body).expectedRevision, null));
    privateApi.get('/me/export', async (request) => {
      const user = identity(request);
      const [profile, settings] = await Promise.all([gateway.getProfile(user), gateway.getSettings(user)]);
      return { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email }, profile, settings };
    });
    privateApi.delete('/me', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request, reply) => {
      await gateway.deleteAccount(identity(request));
      return reply.code(204).send();
    });
  }, { prefix: '/v1' });

  // Empty platform overrides preserve the app's tested bundled rules. Deploy reviewed
  // data-only overrides here; never accept executable JavaScript or client writes.
  app.get('/v1/blocker-config', async (_request, reply) => reply.header('Cache-Control', 'public, max-age=900').send({ schemaVersion: 1, platforms: {} }));
  return app;
}
