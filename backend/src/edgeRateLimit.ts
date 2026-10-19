import { createClient } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';

export type ConsumeLimit = (bucket: string, max: number) => Promise<void>;
export class RateLimitError extends ApiError {
  constructor(public retryAfter: number) { super(429, 'RATE_LIMITED', 'Too many requests. Please wait.'); }
}

/** One atomic, shared counter across all workers. Only the server role can call
 * this RPC; user tokens are never passed to this client. */
export function createEdgeRateLimit(config: Config): ConsumeLimit {
  if (!config.SUPABASE_SECRET_KEY) throw new Error('Edge API requires a server secret key');
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async (bucket, max) => {
    const { data, error } = await client.rpc('consume_api_rate_limit', {
      bucket_key: bucket, request_limit: max,
    }).abortSignal(AbortSignal.timeout(8000));
    const result = data?.[0];
    if (error || typeof result?.allowed !== 'boolean' || !Number.isInteger(result?.retry_after_seconds)) {
      throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'The service is temporarily unavailable.');
    }
    if (!result.allowed) throw new RateLimitError(Math.max(1, result.retry_after_seconds));
  };
}

/** Avoid storing emails, refresh tokens, or client IPs in throttle records. */
export async function rateLimitSubject(secret: string, subject: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(subject));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
