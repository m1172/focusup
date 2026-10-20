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
});

Deno.serve(createEdgeHandler(config, createEdgeRateLimit(config)));
