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
  return config;
}
