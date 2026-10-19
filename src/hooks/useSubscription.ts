import { useCallback } from 'react';
import { revenueCatSubscriptionService } from '../services/subscription/revenueCat';
import type { PurchaseResult } from '../services/subscription/types';
import { useSubscriptionStore } from '../store/subscriptionStore';

export function useSubscription() {
  const state = useSubscriptionStore();
  const setCustomerInfo = useSubscriptionStore((current) => current.setCustomerInfo);
  const purchase = useCallback(async (packageId: string): Promise<PurchaseResult> => {
    const result = await revenueCatSubscriptionService.purchasePackage(packageId);
    if (result.status === 'purchased' || result.status === 'pending') setCustomerInfo(result.customerInfo);
    return result;
  }, [setCustomerInfo]);
  const restore = useCallback(async () => {
    const customerInfo = await revenueCatSubscriptionService.restorePurchases();
    setCustomerInfo(customerInfo);
    return customerInfo;
  }, [setCustomerInfo]);
  return { ...state, purchase, restore };
}
