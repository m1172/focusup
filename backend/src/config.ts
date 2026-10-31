import { z } from 'zod';
import process from 'node:process';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.string().default(''),
  AUTH_REDIRECT_URL: z.url().optional(),
  AUTH_OAUTH_PROVIDERS: z.string().default(''),
  // Support chat relay. All three are needed; without them the chat routes answer 503.
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{30,}$/).optional(),
  TELEGRAM_SUPPORT_CHAT_ID: z.string().regex(/^-?\d{1,20}$/).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{24,256}$/).optional(),
  // Telegram login on our own domain. All four are needed; without them Telegram uses Supabase's hosted OAuth.
  TELEGRAM_LOGIN_CLIENT_ID: z.string().regex(/^\d{1,20}$/).optional(),
  TELEGRAM_LOGIN_CLIENT_SECRET: z.string().min(16).max(512).optional(),
  // Public site whose /telegram/callback forwards here (website/functions/telegram/callback.ts), e.g. https://vaqtim.pages.dev
  TELEGRAM_LOGIN_ORIGIN: z.url().optional(),
  // At least 32 random characters; encrypts the login state and the one-time code.
  TELEGRAM_LOGIN_KEY: z.string().min(32).max(512).optional(),
});
export type Config = z.infer<typeof envSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(Object.fromEntries(Object.entries(env).filter(([, value]) => value !== '')));
  if (!result.success) {
    // Print field names only; validation errors must not expose secret values.
    throw new Error(`Invalid backend environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  const config = result.data;
  const url = new URL(config.SUPABASE_URL);
  if (url.protocol !== 'https:' && !(config.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) {
    throw new Error('SUPABASE_URL must use HTTPS (HTTP localhost is allowed in development)');
  }
  for (const origin of config.CORS_ORIGINS.split(',').filter(Boolean)) {
    if (new URL(origin.trim()).origin !== origin.trim()) throw new Error('CORS_ORIGINS must contain exact origins');
  }
  if (config.AUTH_OAUTH_PROVIDERS.split(',').map((value) => value.trim()).filter(Boolean).some((value) => !['google', 'apple', 'telegram'].includes(value))) {
    throw new Error('AUTH_OAUTH_PROVIDERS supports google, apple, telegram');
  }
  if (config.TELEGRAM_LOGIN_ORIGIN && new URL(config.TELEGRAM_LOGIN_ORIGIN).protocol !== 'https:') throw new Error('TELEGRAM_LOGIN_ORIGIN must use HTTPS');
  return config;
}

/** Telegram login settings when all four values are set, else null (Supabase's hosted Telegram OAuth is used). */
export function telegramLoginConfig(config: Config) {
  const { TELEGRAM_LOGIN_CLIENT_ID: clientId, TELEGRAM_LOGIN_CLIENT_SECRET: clientSecret, TELEGRAM_LOGIN_ORIGIN: origin, TELEGRAM_LOGIN_KEY: key, AUTH_REDIRECT_URL: appRedirectUrl } = config;
  return clientId && clientSecret && origin && key && appRedirectUrl ? { clientId, clientSecret, origin, key, appRedirectUrl } : null;
}
