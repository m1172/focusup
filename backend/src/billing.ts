import { z } from 'zod';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import { sha256, type FamilyRpc } from './family.ts';

const date = z.iso.datetime({ offset: true });
const snapshotSchema = z.object({
  request_date_ms: z.number().int().positive(),
  subscriber: z.object({
    original_app_user_id: z.string().optional(),
    entitlements: z.record(z.string(), z.object({
      product_identifier: z.string(), product_plan_identifier: z.string().nullish(),
      expires_date: date.nullable(), grace_period_expires_date: date.nullish(),
    })),
    subscriptions: z.record(z.string(), z.object({
      store: z.string(), is_sandbox: z.boolean(), grace_period_expires_date: date.nullish(),
      ownership_type: z.string().nullish(),
      refunded_at: date.nullish(), product_plan_identifier: z.string().nullish(),
    })),
  }),
});
const eventSchema = z.object({ event: z.object({
  id: z.string().min(1).max(128), type: z.string(), environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
  app_user_id: z.string().optional(), aliases: z.array(z.string()).max(100).optional(),
  transferred_from: z.array(z.string()).max(100).optional(), transferred_to: z.array(z.string()).max(100).optional(),
}) });
const unavailable = () => new ApiError(503, 'BILLING_UNAVAILABLE', 'Subscription verification is temporarily unavailable.');

/**
 * `sandbox` says which store environment counts: true = test purchases only (staging), false = real purchases
 * only, 'any' = both. Production uses 'any' by default, because App Store and Google Play reviewers, TestFlight
 * and Play licence testers all buy in the store sandbox from the production build.
 */
export function billingSnapshot(raw: unknown, sandbox: boolean | 'any', now = Date.now(), userId?: string) {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) throw unavailable();
  const { subscriber, request_date_ms } = parsed.data;
  const free = { tier: 'free', expiresAt: null, store: null, productId: null, verifiedAt: request_date_ms } as const;
  if (userId && subscriber.original_app_user_id && subscriber.original_app_user_id !== userId) return free;
  for (const tier of ['family', 'pro'] as const) {
    const entitlement = subscriber.entitlements[tier];
    if (!entitlement?.expires_date) continue;
    const product = entitlement.product_identifier;
    const plan = entitlement.product_plan_identifier;
    const subscription = (plan ? subscriber.subscriptions[`${product}:${plan}`] : undefined) ?? subscriber.subscriptions[product];
    if (!subscription || (sandbox !== 'any' && subscription.is_sandbox !== sandbox) || subscription.refunded_at || subscription.ownership_type === 'FAMILY_SHARED') continue;
    const store = subscription.store === 'app_store' ? 'ios' : subscription.store === 'play_store' ? 'android' : null;
    if (!store) continue;
    const expiry = Math.max(Date.parse(entitlement.expires_date),
      Date.parse(entitlement.grace_period_expires_date ?? subscription.grace_period_expires_date ?? '') || 0);
    if (expiry <= now) continue;
    const basePlan = plan ?? subscription.product_plan_identifier;
    const productId = store === 'android' && basePlan && !product.includes(':') ? `${product}:${basePlan}` : product;
    return { tier, expiresAt: new Date(expiry).toISOString(), store, productId, verifiedAt: request_date_ms };
  }
  return free;
}

export function createBilling(config: Config, rpc: FamilyRpc | null, fetcher: typeof fetch = fetch) {
  const sandbox = config.REVENUECAT_ENVIRONMENT === 'SANDBOX';
  const environment = sandbox ? 'SANDBOX' : 'PRODUCTION';
  // Staging takes test purchases only. Production also takes them unless REVENUECAT_SANDBOX_PURCHASES=deny;
  // RevenueCat's "Allow testing entitlements for" project setting narrows who may make them.
  const accepted = sandbox ? true : config.REVENUECAT_SANDBOX_PURCHASES === 'deny' ? false : 'any';
  const call = async (name: string, args: Record<string, unknown>) => {
    if (!rpc || !config.REVENUECAT_SECRET_KEY || !config.REVENUECAT_WEBHOOK_SECRET) throw unavailable();
    return rpc(name, args);
  };
  const get = (id: string) => call('billing_get', { p_user: id, p_environment: environment });
  const refresh = async (id: string) => {
    if (!rpc || !config.REVENUECAT_SECRET_KEY || !config.REVENUECAT_WEBHOOK_SECRET) throw unavailable();
    const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${config.REVENUECAT_SECRET_KEY}` }, signal: AbortSignal.timeout(5000),
    }).catch(() => { throw unavailable(); });
    if (!response.ok) throw unavailable();
    const snapshot = billingSnapshot(await response.json().catch(() => { throw unavailable(); }), accepted, Date.now(), id);
    return call('billing_save', { p_user: id, p_environment: environment, p_snapshot: snapshot });
  };
  return {
    get, refresh,
    /** After account deletion: removes the RevenueCat customer, so a store purchase that is still running can be restored to a new account. */
    async forget(id: string) {
      if (!config.REVENUECAT_SECRET_KEY) return;
      await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${config.REVENUECAT_SECRET_KEY}` }, signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    },
    async webhook(authorization: string | null, body: unknown) {
      const secret = config.REVENUECAT_WEBHOOK_SECRET;
      if (!secret) throw unavailable();
      const [actual, expected] = await Promise.all([sha256(authorization ?? ''), sha256(`Bearer ${secret}`)]);
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
      if (difference) throw new ApiError(401, 'WEBHOOK_UNAUTHORIZED', 'Invalid webhook authorization.');
      const { event } = eventSchema.parse(body);
      if (event.type === 'TEST' || (event.environment && event.environment !== environment && accepted !== 'any')) return { ok: true };
      // Transfer events can omit environment and the primary ID. Verify every affected account against RevenueCat.
      if (!event.environment && event.type !== 'TRANSFER') return { ok: true };
      if (await call('billing_event_seen', { p_environment: environment, p_event: event.id })) return { ok: true };
      const ids = [...new Set([event.app_user_id, ...event.aliases ?? [], ...event.transferred_from ?? [], ...event.transferred_to ?? []])]
        .filter((id): id is string => Boolean(id && z.uuid().safeParse(id).success));
      for (const id of ids) await refresh(id);
      await call('billing_event_mark', { p_environment: environment, p_event: event.id });
      return { ok: true };
    },
  };
}
