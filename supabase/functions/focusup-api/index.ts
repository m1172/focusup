import { readConfig } from '../../../backend/src/config.ts';
import { createEdgeHandler } from '../../../backend/src/edge.ts';
import { createEdgeRateLimit } from '../../../backend/src/edgeRateLimit.ts';

const config = readConfig({
  NODE_ENV: 'production',
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  // Custom names avoid Supabase's reserved SUPABASE_ namespace and disabled
  // legacy JWT keys. Store only the current publishable/secret keys here.
  SUPABASE_PUBLISHABLE_KEY: Deno.env.get('FOCUSUP_PUBLISHABLE_KEY'),
  SUPABASE_SECRET_KEY: Deno.env.get('FOCUSUP_SECRET_KEY'),
  AUTH_REDIRECT_URL: Deno.env.get('AUTH_REDIRECT_URL') ?? 'focusup://auth/callback',
  AUTH_OAUTH_PROVIDERS: Deno.env.get('AUTH_OAUTH_PROVIDERS'),
  CORS_ORIGINS: Deno.env.get('CORS_ORIGINS'),
  TELEGRAM_BOT_TOKEN: Deno.env.get('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_SUPPORT_CHAT_ID: Deno.env.get('TELEGRAM_SUPPORT_CHAT_ID'),
  TELEGRAM_WEBHOOK_SECRET: Deno.env.get('TELEGRAM_WEBHOOK_SECRET'),
  TELEGRAM_LOGIN_CLIENT_ID: Deno.env.get('TELEGRAM_LOGIN_CLIENT_ID'),
  TELEGRAM_LOGIN_CLIENT_SECRET: Deno.env.get('TELEGRAM_LOGIN_CLIENT_SECRET'),
  TELEGRAM_LOGIN_ORIGIN: Deno.env.get('TELEGRAM_LOGIN_ORIGIN'),
  TELEGRAM_LOGIN_KEY: Deno.env.get('TELEGRAM_LOGIN_KEY'),
});

Deno.serve(createEdgeHandler(config, createEdgeRateLimit(config)));
