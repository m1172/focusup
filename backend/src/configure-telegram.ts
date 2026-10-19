import { createClient } from '@supabase/supabase-js';
import { readConfig } from './config.js';

// Explicit provisioning command; importing/running the API never changes providers.
const config = readConfig();
const clientId = process.env.TELEGRAM_CLIENT_ID;
const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;
if (!config.SUPABASE_SECRET_KEY || !clientId || !clientSecret) {
  throw new Error('Set SUPABASE_SECRET_KEY, TELEGRAM_CLIENT_ID and TELEGRAM_CLIENT_SECRET in backend/.env first.');
}
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});
const providers = supabase.auth.admin.customProviders;
const options = {
  name: 'Telegram', client_id: clientId, client_secret: clientSecret,
  issuer: 'https://oauth.telegram.org', scopes: ['openid', 'profile'],
  email_optional: true, enabled: true, pkce_enabled: true, skip_nonce_check: false,
};
try {
  const existing = await providers.getProvider('custom:telegram');
  if (existing.error && existing.error.status !== 404) throw new Error('Unable to read provider configuration.');
  const result = existing.data
    ? await providers.updateProvider('custom:telegram', options)
    : await providers.createProvider({ ...options, provider_type: 'oidc', identifier: 'custom:telegram' });
  if (result.error) throw new Error('Unable to save Telegram OIDC provider. Check Supabase permissions and BotFather credentials.');
  console.log('Telegram provider configured. Register the callback URL shown in Supabase Auth Providers in BotFather, then enable telegram in AUTH_OAUTH_PROVIDERS.');
} catch {
  // Upstream errors can include credential-bearing configuration; keep output generic.
  console.error('Telegram setup failed. Check provider configuration in Supabase and your backend environment.');
  process.exitCode = 1;
}
