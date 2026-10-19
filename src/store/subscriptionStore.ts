import { create } from 'zustand';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { revenueCatSubscriptionService, hasProEntitlement, installRevenueCatCustomerInfoListener, setRevenueCatCustomerInfoListener } from '../services/subscription/revenueCat';
import { normalizeSubscriptionError, type SubscriptionErrorCode } from '../services/subscription/types';

type SubscriptionState = {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  error: SubscriptionErrorCode | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setCustomerInfo: (customerInfo: CustomerInfo) => void;
};

let initialization: Promise<void> | null = null;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const setCustomerInfo = (customerInfo: CustomerInfo) => set({ customerInfo, isPro: hasProEntitlement(customerInfo), error: null });

  return {
    isInitialized: false,
    isLoading: false,
    isPro: false,
    customerInfo: null,
    offering: null,
    error: null,
    setCustomerInfo,
    initialize: async () => {
      if (get().isInitialized) return;
      if (initialization) return initialization;
      initialization = (async () => {
        set({ isLoading: true, error: null });
        try {
          await revenueCatSubscriptionService.initialize();
          setRevenueCatCustomerInfoListener(setCustomerInfo);
          installRevenueCatCustomerInfoListener();
          const [customerInfo, offering] = await Promise.all([
            revenueCatSubscriptionService.getCustomerInfo().catch(() => null),
            revenueCatSubscriptionService.getOfferings().catch(() => null),
          ]);
          if (customerInfo) setCustomerInfo(customerInfo);
          set({ offering, isInitialized: true, isLoading: false });
          if (offering) console.info('[FocusUp RevenueCat] offerings loaded');
          if (customerInfo) console.info(`[FocusUp RevenueCat] entitlement active: ${hasProEntitlement(customerInfo) ? 'pro' : 'none'}`);
        } catch (error) {
          const code = normalizeSubscriptionError(error);
          if (__DEV__) {
            if (code === 'configuration') {
              const message = error instanceof Error ? error.message : 'RevenueCat public SDK key is missing.';
              console.warn(`[FocusUp Subscription] ${message} Subscription purchases are disabled; free features remain available.`);
            } else {
              console.error(`[FocusUp Subscription] Initialization failed (${code})`);
            }
          }
          set({ error: code, isInitialized: true, isLoading: false });
        } finally {
          initialization = null;
        }
      })();
      return initialization;
    },
    refresh: async () => {
      if (!get().isInitialized) return get().initialize();
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const [customerInfo, offering] = await Promise.all([
          revenueCatSubscriptionService.getCustomerInfo(),
          revenueCatSubscriptionService.getOfferings(),
        ]);
        setCustomerInfo(customerInfo);
        set({ offering, isLoading: false });
      } catch (error) {
        set({ error: normalizeSubscriptionError(error), isLoading: false });
      }
    },
  };
});
