import { useSubscription } from './useSubscription';
import { canUseFeature, type SubscriptionFeature } from '../services/subscription/subscriptionService';

export function useFeatureAccess(feature: SubscriptionFeature) {
  const isPro = useSubscription().isPro;
  return { allowed: canUseFeature(isPro, feature), reason: canUseFeature(isPro, feature) ? null : 'pro' as const };
}
