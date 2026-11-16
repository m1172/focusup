import { createClient } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
export function loginReplay(config: Config) {
  return async (hash: string, expiresAt: number): Promise<boolean> => {
    if (!config.SUPABASE_SECRET_KEY) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc('consume_login_result', { p_hash: hash, p_expires_at: new Date(expiresAt).toISOString() }).abortSignal(AbortSignal.timeout(8000));
    if (error || typeof data !== 'boolean') throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    return data;
  };
}
