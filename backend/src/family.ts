import { createClient } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import type { Identity } from './gateway.ts';
import { addChildSchema, approvePairingSchema, childParamsSchema, claimSchema, deviceSyncSchema, familySetupSchema, savePolicySchema, starterFamilyPolicy } from './familySchemas.ts';

/**
 * Vaqtim Family routes, shared by the Fastify app and the production Edge Function so both
 * validate and authorize the same way. Parents use their account token. A child's phone has
 * no account: it holds a random device secret (sent as `Authorization: Device <secret>`), and
 * the server keeps only its SHA-256 hash. Every database step is one server-role function.
 */

/** Calls one `public.family_*` function with named arguments. */
export type FamilyRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
/** Counts one request against a shared per-minute bucket; throws when the bucket is full. */
export type FamilyLimit = (bucket: string, max: number) => Promise<void>;
/** Sends content-free "check for new rules" pushes. Must never throw. */
export type FamilyRefreshHint = (tokens: string[]) => Promise<void>;

export type FamilyRequest = { params: Record<string, string>; body: unknown; user: Identity | null; authorization: string | null };
export type FamilyResult = { status?: number; data?: unknown };
export type FamilyRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** `parent`: a verified account token. `device`: a child phone's secret. `public`: neither. */
  auth: 'parent' | 'device' | 'public';
  /** The route needs a JSON body. */
  body: boolean;
  /** Requests per minute for one parent, one phone, or (public) everyone together. */
  limit: number;
  run: (request: FamilyRequest) => Promise<FamilyResult>;
};

export const FAMILY_CONSENT_VERSION = '2026-11.1';
const PAIRING_SECONDS = 600;
/** Pairing approval, phone replacement and removal need a sign-in from the last 10 minutes. */
export const FRESH_AUTH_SECONDS = 600;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEVICE_SECRET = /^vqd1_[A-Za-z0-9_-]{43}$/;

const errors: Record<string, [number, string]> = {
  FAMILY_REQUIRED: [409, 'Set up Vaqtim Family first.'],
  FAMILY_CHILD_LIMIT: [409, 'A family can have up to 8 children.'],
  FAMILY_AGE_INVALID: [400, 'Children must be under 18.'],
  FAMILY_CHILD_NOT_FOUND: [404, 'This child is not in your family.'],
  FAMILY_REVISION_CONFLICT: [409, 'These rules changed. Load the latest rules before saving again.'],
  FAMILY_REMOVAL_PENDING: [409, 'Supervision is being removed for this child.'],
  FAMILY_UNDER_13_BROWSING: [400, 'Children under 13 cannot use social browsers in Vaqtim.'],
  FAMILY_PAIRING_INVALID: [400, 'This code is wrong or has expired. Ask your parent for a new code.'],
  FAMILY_PAIRING_NOT_READY: [409, 'The child’s phone has not entered the code yet, or the code expired.'],
  FAMILY_NOT_RELEASED: [409, 'This phone is still supervised.'],
  FAMILY_NOT_ADULT: [403, 'Supervision can be ended here from age 18.'],
  FAMILY_DEVICE_REVOKED: [401, 'This phone is no longer connected to a family.'],
};

/** Maps database errors raised as `FAMILY_*` messages; everything else is an outage. */
export function familyDatabaseError(error: { message?: string } | null | undefined): ApiError {
  const code = error?.message && /^FAMILY_[A-Z0-9_]+$/.test(error.message) ? error.message : '';
  const known = errors[code];
  return known ? new ApiError(known[0], code, known[1]) : new ApiError(503, 'DATABASE_UNAVAILABLE', 'Family data is temporarily unavailable.');
}

/** Supabase's `rpc()` with the server role. Never passes user tokens. */
export function createFamilyRpc(config: Config): FamilyRpc | null {
  if (!config.SUPABASE_SECRET_KEY) return null;
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return async (name, args) => {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
    if (error) throw familyDatabaseError(error);
    return data;
  };
}

/** Content-free data pushes. iOS may delay or drop them; the phone also checks every 30 seconds while open. */
export function createExpoRefreshHint(fetcher: typeof fetch = fetch): FamilyRefreshHint {
  return async (tokens) => {
    if (!tokens.length) return;
    try {
      await fetcher('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
        body: JSON.stringify(tokens.slice(0, 10).map((to) => ({ to, data: { kind: 'family-refresh' }, _contentAvailable: true, priority: 'high' }))),
      });
    } catch { /* A missed hint only delays the update until the next check. */ }
  };
}

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
export async function sha256(value: string) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function base64url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Eight characters without look-alikes (no I, L, O, 0, 1): about 40 bits, valid for ten minutes. */
export function newPairingCode(random: (length: number) => Uint8Array = (length) => crypto.getRandomValues(new Uint8Array(length))): string {
  let code = '';
  while (code.length < 8) {
    for (const byte of random(16)) {
      // 248 = 8 * 31: dropping higher bytes keeps every character equally likely.
      if (byte < 248 && code.length < 8) code += CODE_ALPHABET[byte % 31];
    }
  }
  return code;
}
function newConfirmationCode() {
  const values = crypto.getRandomValues(new Uint32Array(1));
  return String(values[0]! % 1_000_000).padStart(6, '0');
}
function newDeviceSecret() { return `vqd1_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`; }

/**
 * When the parent last proved who they are (signed in), from the access token Auth already verified.
 * Refreshing a session keeps this time, so a long-lived session is not "fresh".
 */
export function authenticatedAt(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { amr?: { timestamp?: unknown }[] };
    const times = Array.isArray(json.amr) ? json.amr.map((entry) => entry?.timestamp).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
    return times.length ? Math.max(...times) : null;
  } catch { return null; }
}

/** Parsed `Authorization: Device <secret>`. Anything else is rejected before the database. */
export function deviceSecret(authorization: string | null): string {
  const value = /^Device (\S+)$/.exec(authorization ?? '')?.[1];
  if (!value || !DEVICE_SECRET.test(value)) throw new ApiError(401, 'DEVICE_AUTH_REQUIRED', 'This phone is not connected to a family.');
  return value;
}

type Options = {
  config: Config;
  rpc: FamilyRpc | null;
  limit: FamilyLimit;
  hint?: FamilyRefreshHint;
  now?: () => number;
};

/** True when new families may be set up and phones paired. Removal, deletion and syncing always work. */
export function familyEnrollmentOpen(config: Config) { return config.FAMILY_ENROLLMENT_ENABLED === 'true'; }
export function familyCountries(config: Config) { return config.FAMILY_COUNTRIES.split(',').map((value) => value.trim()).filter((value) => /^[A-Z]{2}$/.test(value)); }

export function createFamilyApi({ config, rpc, limit, hint = async () => undefined, now = Date.now }: Options) {
  const call = async (name: string, args: Record<string, unknown>) => {
    if (!rpc || !config.SUPABASE_SECRET_KEY) throw new ApiError(503, 'FAMILY_UNAVAILABLE', 'Vaqtim Family is not available on this server.');
    return rpc(name, args);
  };
  const codeHash = (purpose: string, value: string) => hmac(config.SUPABASE_SECRET_KEY ?? '', `family:${purpose}:${value}`);
  const subject = async (value: string) => (await sha256(`family-limit:${value}`)).slice(0, 40);
  const requireEnrollment = () => { if (!familyEnrollmentOpen(config)) throw new ApiError(503, 'FAMILY_ENROLLMENT_CLOSED', 'Vaqtim Family is not open yet.'); };
  const parent = (request: FamilyRequest) => {
    if (!request.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    return request.user;
  };
  const freshParent = (request: FamilyRequest) => {
    const user = parent(request);
    const signedInAt = authenticatedAt(user.token);
    if (!signedInAt || now() / 1000 - signedInAt > FRESH_AUTH_SECONDS) throw new ApiError(403, 'REAUTH_REQUIRED', 'Sign in again to confirm this change.');
    return user;
  };
  const child = (request: FamilyRequest) => childParamsSchema.parse(request.params).childId;

  const routes: FamilyRoute[] = [];
  const route = (method: FamilyRoute['method'], path: string, auth: FamilyRoute['auth'], perMinute: number, run: FamilyRoute['run'], body = false) => {
    const name = `${method.toLowerCase()}-${path.replace(/^\/v1\/family\/?/, '').replace(/:[a-zA-Z]+/g, 'id').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root'}`;
    routes.push({ method, path, auth, body, limit: perMinute, run: async (request) => {
      const who = auth === 'parent' ? `parent:${parent(request).id}` : auth === 'device' ? `device:${deviceSecret(request.authorization)}` : 'everyone';
      await limit(`edge:family:${name}:${await subject(who)}`.slice(0, 160), perMinute);
      return run(request);
    } });
  };

  route('GET', '/v1/family', 'parent', 60, async (request) => ({
    data: { enrollmentOpen: familyEnrollmentOpen(config), countries: familyCountries(config), consentVersion: FAMILY_CONSENT_VERSION, ...await call('family_overview', { p_parent: parent(request).id }) as object },
  }));
  route('POST', '/v1/family', 'parent', 10, async (request) => {
    const user = parent(request);
    const body = familySetupSchema.parse(request.body);
    requireEnrollment();
    if (!familyCountries(config).includes(body.country)) throw new ApiError(403, 'FAMILY_COUNTRY_UNAVAILABLE', 'Vaqtim Family is not available in this country yet.');
    if (body.consentVersion !== FAMILY_CONSENT_VERSION) throw new ApiError(409, 'FAMILY_CONSENT_OUTDATED', 'Read and accept the current terms.');
    return { status: 201, data: await call('family_setup', { p_parent: user.id, p_country: body.country, p_consent_version: body.consentVersion }) };
  }, true);
  route('DELETE', '/v1/family', 'parent', 3, async (request) => ({ data: await call('family_delete', { p_parent: freshParent(request).id }) }));
  route('POST', '/v1/family/children', 'parent', 10, async (request) => {
    const user = parent(request);
    const body = addChildSchema.parse(request.body);
    requireEnrollment();
    if (body.consentVersion !== FAMILY_CONSENT_VERSION) throw new ApiError(409, 'FAMILY_CONSENT_OUTDATED', 'Read and accept the current terms.');
    return { status: 201, data: await call('family_add_child', { p_parent: user.id, p_nickname: body.nickname, p_birth_date: body.birthDate, p_policy: starterFamilyPolicy, p_consent_version: body.consentVersion }) };
  }, true);
  route('PUT', '/v1/family/children/:childId/policy', 'parent', 30, async (request) => {
    const user = parent(request);
    const childId = child(request);
    const body = savePolicySchema.parse(request.body);
    const saved = await call('family_save_policy', { p_parent: user.id, p_child: childId, p_expected_revision: body.expectedRevision, p_policy: body.policy }) as { revision: number; policy: unknown; updatedAt: string; pushTokens?: string[] };
    await hint(Array.isArray(saved.pushTokens) ? saved.pushTokens : []);
    return { data: { revision: saved.revision, policy: saved.policy, updatedAt: saved.updatedAt } };
  }, true);
  route('DELETE', '/v1/family/children/:childId', 'parent', 5, async (request) => ({ data: await call('family_remove_child', { p_parent: freshParent(request).id, p_child: child(request) }) }));
  route('POST', '/v1/family/children/:childId/pairing', 'parent', 10, async (request) => {
    const user = parent(request);
    const childId = child(request);
    requireEnrollment();
    const code = newPairingCode();
    const started = await call('family_start_pairing', { p_parent: user.id, p_child: childId, p_code_hash: await codeHash('pairing', code), p_ttl_seconds: PAIRING_SECONDS }) as { expiresAt: string };
    return { status: 201, data: { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt: started.expiresAt } };
  });
  route('DELETE', '/v1/family/children/:childId/pairing', 'parent', 20, async (request) => ({ data: await call('family_cancel_pairing', { p_parent: parent(request).id, p_child: child(request) }) }));
  route('POST', '/v1/family/children/:childId/pairing/approve', 'parent', 10, async (request) => {
    const user = freshParent(request);
    const childId = child(request);
    const body = approvePairingSchema.parse(request.body);
    const result = await call('family_approve_pairing', { p_parent: user.id, p_child: childId, p_confirmation_hash: await codeHash('confirm', body.confirmationCode) }) as { ok: boolean; attemptsLeft?: number; replaced?: boolean };
    if (!result.ok) throw new ApiError(400, result.attemptsLeft ? 'FAMILY_CONFIRMATION_MISMATCH' : 'FAMILY_PAIRING_ENDED', result.attemptsLeft ? 'The code does not match the child’s phone.' : 'Too many wrong codes. Start pairing again.');
    return { data: { replaced: Boolean(result.replaced) } };
  }, true);

  // The child's phone. Claiming is public: the code itself is the proof, and it works once.
  route('POST', '/v1/family/device/claim', 'public', 60, async (request) => {
    const body = claimSchema.parse(request.body);
    requireEnrollment();
    const secret = newDeviceSecret();
    // Shown on the child's phone; the parent types it to prove they are looking at the right phone.
    const confirmationCode = newConfirmationCode();
    const claimed = await call('family_claim_pairing', { p_code_hash: await codeHash('pairing', body.code), p_secret_hash: await sha256(secret), p_confirmation_hash: await codeHash('confirm', confirmationCode), p_platform: body.platform }) as { childNickname: string; parentName: string; expiresAt: string };
    return { status: 201, data: { deviceSecret: secret, confirmationCode, childNickname: claimed.childNickname, parentName: claimed.parentName, expiresAt: claimed.expiresAt } };
  }, true);
  route('POST', '/v1/family/device/sync', 'device', 30, async (request) => {
    const secret = deviceSecret(request.authorization);
    const body = deviceSyncSchema.parse(request.body);
    return { data: await call('family_device_sync', { p_secret_hash: await sha256(secret), p_applied_revision: body.appliedRevision, p_report: body.report, p_push_token: body.pushToken }) };
  }, true);
  route('POST', '/v1/family/device/release', 'device', 10, async (request) => ({ data: await call('family_release_ack', { p_secret_hash: await sha256(deviceSecret(request.authorization)) }) }));
  route('POST', '/v1/family/device/end-supervision', 'device', 5, async (request) => ({ data: await call('family_end_supervision', { p_secret_hash: await sha256(deviceSecret(request.authorization)) }) }));

  return {
    routes,
    /** The parent's family records for the account export, or null without a family (or a family backend). */
    async exportFor(user: Identity): Promise<unknown> {
      if (!rpc || !config.SUPABASE_SECRET_KEY) return null;
      return rpc('family_export', { p_parent: user.id });
    },
  };
}

/** `/v1/family/children/:childId` → a matcher for a concrete path. */
export function matchFamilyPath(pattern: string, path: string): Record<string, string> | null {
  const names: string[] = [];
  const source = pattern.split('/').map((part) => {
    if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    names.push(part.slice(1));
    return '([0-9A-Za-z-]{1,64})';
  }).join('/');
  const match = new RegExp(`^${source}$`).exec(path);
  return match ? Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])) : null;
}
