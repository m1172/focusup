import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import type { PurchasesOffering } from 'react-native-purchases';
import { PRO_ENABLED } from '../config/release';
import { secretStorage } from '../services/backend/secretStorage';
import { accountApi } from '../services/backend/accountSession';
import { getPlanPackages, revenueCatSubscriptionService as billing, identifySubscriptionUser, resetSubscriptionUser, isRevenueCatConfigured } from '../services/subscription/revenueCat';
import { normalizeSubscriptionError, type PaidTier, type PlanId, type SubscriptionErrorCode, type SubscriptionStatus } from '../services/subscription/types';
import { useAccountStore } from './accountStore';
import { useFamilyStore } from './familyStore';

type Pending = { productId: string; until: number };
type PurchaseOutcome = 'active' | 'pending' | 'scheduled' | 'cancelled' | 'unavailable';
type SubscriptionState = {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  status: SubscriptionStatus | null;
  offerings: Record<PaidTier, PurchasesOffering | null>;
  error: SubscriptionErrorCode | null;
  pending: Pending | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  purchase: (tier: PaidTier, plan: PlanId) => Promise<PurchaseOutcome>;
  restore: () => Promise<PurchaseOutcome>;
};

const empty = {
  isInitialized: false, isLoading: false, isPro: false, status: null,
  offerings: { pro: null, family: null }, error: null, pending: null,
};
const account = () => {
  const session = useAccountStore.getState();
  return session.ready && !session.recoveryRequired && useFamilyStore.getState().role === 'none' ? session.user?.id ?? null : null;
};
const verifiedStorage = (id: string) => secretStorage(`vaqtim.billing.verified.${id}`);
const pendingKey = (id: string) => `vaqtim:billing:pending:${id}`;
const productMatches = (expected: string, actual: string | null) => actual === expected;
const pendingWindow = 4 * 24 * 60 * 60 * 1000;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  let owner: string | null = null;
  let sdkOwner: string | null = null;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let refreshInFlight: Promise<void> | null = null;
  let cacheLoaded = false;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const enqueue = <T,>(run: () => Promise<T>) => {
    const task = queue.then(run);
    queue = task.catch(() => undefined);
    return task;
  };
  const current = (id: string, epoch: number) => account() === id && generation === epoch;

  function applyStatus(status: SubscriptionStatus) {
    clearTimeout(expiryTimer);
    const remaining = status.expiresAt ? Date.parse(status.expiresAt) - Date.now() : 0;
    set({ status, isPro: status.tier !== 'free' && remaining > 0 });
    if (remaining > 0) {
      expiryTimer = setTimeout(() => {
        if (Date.parse(status.expiresAt!) <= Date.now()) set({ status: null, isPro: false });
        else applyStatus(status);
        void get().refresh();
      }, Math.min(remaining, 2_147_000_000));
    }
  }

  async function reconcile(id: string, epoch: number) {
    if (!current(id, epoch)) return null;
    const status = await accountApi().refreshSubscription();
    if (!current(id, epoch)) return null;
    applyStatus(status);
    await verifiedStorage(id).write(JSON.stringify(status)).catch(() => undefined);
    if (!current(id, epoch)) return null;
    const pending = get().pending;
    if (pending && (productMatches(pending.productId, status.productId) || pending.until <= Date.now())) {
      set({ pending: null });
      await AsyncStorage.removeItem(pendingKey(id)).catch(() => undefined);
    }
    return status;
  }

  const refresh = (): Promise<void> => {
    if (!PRO_ENABLED || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      set({ ...empty, isInitialized: true });
      return Promise.resolve();
    }
    const id = account();
    if (id !== owner) {
      const previousOwner = owner;
      if (previousOwner) void enqueue(() => verifiedStorage(previousOwner).remove().catch(() => undefined));
      owner = id;
      cacheLoaded = false;
      generation++;
      refreshInFlight = null;
      clearTimeout(expiryTimer);
      set(empty);
    }
    const epoch = generation;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = enqueue(async () => {
      if (!id) {
        if (sdkOwner && isRevenueCatConfigured()) {
          await resetSubscriptionUser();
          sdkOwner = null;
        }
        return;
      }
      if (!current(id, epoch)) return;
      set({ isLoading: true, error: null });
      try {
        if (!cacheLoaded) {
          const saved = await verifiedStorage(id).read().catch(() => null);
          if (!current(id, epoch)) return;
          cacheLoaded = true;
          if (saved) {
            try {
              const cached = JSON.parse(saved) as SubscriptionStatus;
              if (cached.tier === 'free' || (['pro', 'family'].includes(cached.tier) && Date.parse(cached.expiresAt ?? '') > Date.now())) applyStatus(cached);
            } catch { /* A malformed cache does not grant paid access. */ }
          }
          set({ isInitialized: true });
        }
        if (sdkOwner !== id) {
          if (isRevenueCatConfigured()) await identifySubscriptionUser(id);
          else await billing.initialize(id);
          sdkOwner = id;
          const saved = await AsyncStorage.getItem(pendingKey(id)).catch(() => null);
          if (!current(id, epoch)) return;
          if (saved) {
            try {
              const pending = JSON.parse(saved) as Pending;
              if (typeof pending.productId === 'string' && pending.until > Date.now()) set({ pending });
            } catch { /* Ignore malformed purchase state. */ }
          }
        }
        if (!get().status) {
          const cached = await accountApi().getSubscription().catch(() => null);
          if (!current(id, epoch)) return;
          if (cached) applyStatus(cached);
        }
        const [pro, family] = await Promise.all([billing.getOfferings('pro'), billing.getOfferings('family')]);
        if (!current(id, epoch)) return;
        set({ offerings: { pro, family } });
        await reconcile(id, epoch);
      } catch (error) {
        if (current(id, epoch)) set({ error: normalizeSubscriptionError(error) });
      } finally {
        if (current(id, epoch)) set({ isLoading: false, isInitialized: true });
      }
    }).catch(() => undefined).finally(() => { if (generation === epoch) refreshInFlight = null; });
    return refreshInFlight;
  };

  // Invalidate synchronously on account/role changes, even if a native checkout is still open.
  useAccountStore.subscribe(() => { if (PRO_ENABLED && account() !== owner) void refresh(); });
  useFamilyStore.subscribe(() => { if (PRO_ENABLED && account() !== owner) void refresh(); });

  const transact = (run: (id: string, epoch: number) => Promise<PurchaseOutcome>): Promise<PurchaseOutcome> => {
    const id = account();
    const epoch = generation;
    if (!PRO_ENABLED || !id || id !== sdkOwner || id !== owner || get().isLoading) return Promise.resolve('unavailable');
    set({ isLoading: true });
    return enqueue(async () => {
      if (!current(id, epoch)) return 'unavailable';
      try { return await run(id, epoch); }
      finally { if (current(id, epoch)) set({ isLoading: false }); }
    });
  };

  return {
    ...empty, initialize: refresh, refresh,
    purchase: (tier, plan) => transact(async (id, epoch) => {
      if (get().pending) return 'pending';
      const pkg = getPlanPackages(get().offerings[tier])[plan];
      if (!pkg) return 'unavailable';
      // Reconcile again before checkout to catch purchases made on another phone.
      const previous = await reconcile(id, epoch);
      if (!previous || (previous.store && previous.store !== Platform.OS) || productMatches(pkg.product.identifier, previous.productId)) return 'unavailable';
      const result = await billing.purchasePackage(pkg.identifier, tier, previous);
      if (result.status !== 'purchased' && result.status !== 'pending') return result.status;
      const pending = { productId: pkg.product.identifier, until: Date.now() + pendingWindow };
      if (current(id, epoch)) set({ pending });
      await AsyncStorage.setItem(pendingKey(id), JSON.stringify(pending)).catch(() => undefined);
      if (!current(id, epoch)) return 'pending';
      const status = await reconcile(id, epoch).catch(() => null);
      return status && productMatches(pending.productId, status.productId) ? 'active' : 'pending';
    }),
    restore: () => transact(async (id, epoch) => {
      const info = await billing.restorePurchases();
      if (!current(id, epoch)) return 'unavailable';
      const entitlement = info.entitlements.active.family ?? info.entitlements.active.pro;
      if (entitlement) {
        const productId = entitlement.productPlanIdentifier && !entitlement.productIdentifier.includes(':')
          ? `${entitlement.productIdentifier}:${entitlement.productPlanIdentifier}` : entitlement.productIdentifier;
        const pending = { productId, until: Date.now() + pendingWindow };
        set({ pending });
        await AsyncStorage.setItem(pendingKey(id), JSON.stringify(pending)).catch(() => undefined);
      }
      const status = await reconcile(id, epoch).catch(() => null);
      if (!status || get().pending) return 'pending';
      return status.tier === 'free' ? 'unavailable' : 'active';
    }),
  };
});
