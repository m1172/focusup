import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export type PaidTier = 'pro' | 'family';
export type SubscriptionTier = 'free' | PaidTier;
export type SubscriptionStatus = {
  tier: SubscriptionTier;
  expiresAt: string | null;
  store: 'ios' | 'android' | null;
  productId: string | null;
  familyChildAllowance: number;
};
export type PlanId = 'monthly' | 'annual';
export type PaywallSource = 'settings' | 'instagram_clean_browsing' | 'instagram_explore' | 'instagram_suggested_posts' | 'instagram_recommendations' | 'youtube_home_recommendations' | 'youtube_related_recommendations' | 'youtube_comments' | 'tiktok_feeds' | 'strict_mode' | 'schedules' | 'advanced_statistics';
export type SubscriptionPackage = PurchasesPackage & { planId: PlanId };
export type SubscriptionOffering = PurchasesOffering;
export type SubscriptionCustomerInfo = CustomerInfo;

export type PurchaseResult =
  | { status: 'purchased'; customerInfo: CustomerInfo }
  | { status: 'cancelled'; customerInfo?: CustomerInfo }
  | { status: 'pending'; customerInfo?: CustomerInfo }
  | { status: 'scheduled' }
  | { status: 'unavailable'; message: string };

export type SubscriptionErrorCode = 'cancelled' | 'network' | 'productUnavailable' | 'configuration' | 'ownership' | 'unknown';

export function normalizeSubscriptionError(error: unknown): SubscriptionErrorCode {
  if (typeof error !== 'object' || error === null) return 'unknown';
  const code = ('code' in error ? String(error.code) : '').toLowerCase();
  const message = ('message' in error ? String(error.message) : '').toLowerCase();
  const diagnostic = `${code} ${message}`;
  if (['7', '13'].includes(code) || diagnostic.includes('receipt_already_in_use') || diagnostic.includes('receipt_in_use_by_other_subscriber')) return 'ownership';
  if (diagnostic.includes('cancel')) return 'cancelled';
  if (diagnostic.includes('network') || diagnostic.includes('offline')) return 'network';
  if (diagnostic.includes('product') || diagnostic.includes('offering')) return 'productUnavailable';
  if (diagnostic.includes('configuration') || diagnostic.includes('invalid_api_key') || diagnostic.includes('public sdk key is not configured')) return 'configuration';
  return 'unknown';
}

export interface SubscriptionService {
  initialize(userId?: string): Promise<void>;
  getOfferings(tier?: PaidTier): Promise<SubscriptionOffering | null>;
  getCustomerInfo(): Promise<SubscriptionCustomerInfo>;
  purchasePackage(packageId: string, tier?: PaidTier, previous?: SubscriptionStatus): Promise<PurchaseResult>;
  restorePurchases(): Promise<SubscriptionCustomerInfo>;
  isPro(): Promise<boolean>;
}
