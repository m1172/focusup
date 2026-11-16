import { useSubscriptionStore } from '../store/subscriptionStore';

export function useSubscription() {
  return useSubscriptionStore();
}
