import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billingSnapshot, createBilling } from '../src/billing.ts';
import { readConfig } from '../src/config.ts';

const id = '11111111-1111-4111-8111-111111111111';
const now = Date.parse('2026-11-09T00:00:00Z');
const expiry = '2026-11-10T00:00:00Z';
const product = 'focusup_family';
function subscriber(sandbox = false, refunded = false) {
  const entitlement = { product_identifier: product, product_plan_identifier: 'monthly', expires_date: '2026-11-08T00:00:00Z' };
  return {
    request_date_ms: now,
    subscriber: {
      entitlements: { pro: entitlement, family: entitlement },
      subscriptions: { [product]: { store: 'play_store', is_sandbox: sandbox, refunded_at: refunded ? expiry : null, grace_period_expires_date: expiry } },
    },
  };
}

test('subscription verification handles Family, grace, expiry, refunds and isolated environments', () => {
  assert.deepEqual(billingSnapshot(subscriber(), false, now), {
    tier: 'family', store: 'android', productId: `${product}:monthly`, expiresAt: new Date(expiry).toISOString(), verifiedAt: now,
  });
  assert.equal(billingSnapshot(subscriber(), false, Date.parse(expiry)).tier, 'free');
  assert.equal(billingSnapshot(subscriber(false, true), false, now).tier, 'free');
  assert.equal(billingSnapshot(subscriber(true), false, now).tier, 'free');
  assert.equal(billingSnapshot(subscriber(true), true, now).tier, 'family');
  // Production counts reviewers' and testers' sandbox purchases next to real ones.
  assert.equal(billingSnapshot(subscriber(true), 'any', now).tier, 'family');
  assert.equal(billingSnapshot(subscriber(), 'any', now).tier, 'family');
  assert.equal(billingSnapshot(subscriber(), true, now).tier, 'free');
  assert.equal(billingSnapshot(subscriber(true, true), 'any', now).tier, 'free');
  const wrongAccount = subscriber();
  assert.equal(billingSnapshot({
    ...wrongAccount, subscriber: { ...wrongAccount.subscriber, original_app_user_id: 'someone-else' },
  }, false, now, id).tier, 'free');
  assert.throws(() => billingSnapshot({ subscriber: {} }, false, now), /temporarily unavailable/);
});

test('webhook verifies authorization, ignores sandbox events and reconciles each event once', async () => {
  const secret = 'test-webhook-secret-with-at-least-32-characters';
  const config = readConfig({
    SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'test', SUPABASE_SECRET_KEY: 'test',
    REVENUECAT_SECRET_KEY: 'test', REVENUECAT_WEBHOOK_SECRET: secret, REVENUECAT_SANDBOX_PURCHASES: 'deny',
  });
  const seen = new Set<unknown>();
  let lookups = 0, writes = 0;
  const billing = createBilling(config, async (method, args) => {
    if (method === 'billing_event_seen') return seen.has(args.p_event);
    if (method === 'billing_event_mark') return seen.add(args.p_event);
    assert.equal(method, 'billing_save');
    assert.equal(args.p_user, id);
    writes++;
    return null;
  }, async (url) => {
    lookups++;
    assert.equal(url, `https://api.revenuecat.com/v1/subscribers/${id}`);
    return Response.json(subscriber());
  });
  const event = { id: 'test-event', type: 'CANCELLATION', app_user_id: id, aliases: [id], environment: 'PRODUCTION' };
  await assert.rejects(billing.webhook('Bearer wrong', { event }), /Invalid webhook authorization/);
  await billing.webhook(`Bearer ${secret}`, { event: { ...event, environment: 'SANDBOX' } });
  assert.equal(lookups, 0);
  await billing.webhook(`Bearer ${secret}`, { event });
  await billing.webhook(`Bearer ${secret}`, { event });
  assert.equal(lookups, 1);
  assert.equal(writes, 1);
});

test('production counts a reviewer\'s sandbox purchase by default; staging never counts a real one', async () => {
  const secret = 'test-webhook-secret-with-at-least-32-characters';
  const base = { SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'test', SUPABASE_SECRET_KEY: 'test', REVENUECAT_SECRET_KEY: 'test', REVENUECAT_WEBHOOK_SECRET: secret };
  const saved: unknown[] = [];
  const rpc = async (method: string, args: Record<string, unknown>) => {
    if (method === 'billing_save') saved.push([args.p_environment, (args.p_snapshot as { tier: string }).tier]);
    return method === 'billing_event_seen' ? false : null;
  };
  // createBilling uses the real clock, so this purchase runs for another day.
  const current = (sandbox: boolean) => {
    const value = subscriber(sandbox);
    value.subscriber.subscriptions[product].grace_period_expires_date = new Date(Date.now() + 86_400_000).toISOString();
    return value;
  };
  const production = createBilling(readConfig(base), rpc, async () => Response.json(current(true)));
  await production.refresh(id);
  await production.webhook(`Bearer ${secret}`, { event: { id: 'sandbox-renewal', type: 'RENEWAL', app_user_id: id, environment: 'SANDBOX' } });
  const strict = createBilling(readConfig({ ...base, REVENUECAT_SANDBOX_PURCHASES: 'deny' }), rpc, async () => Response.json(current(true)));
  await strict.refresh(id);
  const staging = createBilling(readConfig({ ...base, REVENUECAT_ENVIRONMENT: 'SANDBOX' }), rpc, async () => Response.json(current(false)));
  await staging.refresh(id);
  await staging.webhook(`Bearer ${secret}`, { event: { id: 'real-renewal', type: 'RENEWAL', app_user_id: id, environment: 'PRODUCTION' } });
  assert.deepEqual(saved, [['PRODUCTION', 'family'], ['PRODUCTION', 'family'], ['PRODUCTION', 'free'], ['SANDBOX', 'free']]);
});

test('account deletion removes the RevenueCat customer and never fails the deletion', async () => {
  const config = readConfig({ SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'test', SUPABASE_SECRET_KEY: 'test', REVENUECAT_SECRET_KEY: 'test', REVENUECAT_WEBHOOK_SECRET: 'test-webhook-secret-with-at-least-32-characters' });
  const calls: unknown[] = [];
  await createBilling(config, null, async (url, init) => { calls.push([url, init?.method]); return Response.json({ deleted: true }); }).forget(id);
  assert.deepEqual(calls, [[`https://api.revenuecat.com/v1/subscribers/${id}`, 'DELETE']]);
  await createBilling(config, null, async () => { throw new Error('offline'); }).forget(id);
  const off = readConfig({ SUPABASE_URL: 'https://example.com', SUPABASE_PUBLISHABLE_KEY: 'test' });
  await createBilling(off, null, async () => { throw new Error('billing is not configured, so nothing is called'); }).forget(id);
});
