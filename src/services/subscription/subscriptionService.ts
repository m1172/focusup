import { PRO_ENABLED, WEBSITE_BLOCKING } from '../../config/release';
import type { PurchasesPackage } from 'react-native-purchases';

export const FEATURE_ACCESS = {
  instagramCleanBrowsing: 'pro',
  instagramReels: 'free',
  instagramExplore: 'pro',
  instagramSuggestedPosts: 'pro',
  instagramRecommendations: 'pro',
  instagramHomeFeed: 'pro',
  youtubeShorts: 'free',
  youtubeHomeRecommendations: 'pro',
  youtubeRelatedRecommendations: 'pro',
  youtubeComments: 'pro',
  tiktokForYou: 'free',
  // Turning the Reels/Shorts/For You block off. Free users keep it on all the time.
  shortVideoControl: 'pro',
  blockNativeShortVideoApp: 'free',
  blockWebsiteVersion: 'pro',
  adultContentFilter: 'pro',
  uninstallProtection: 'pro',
  grayscale: 'pro',
  dailyLimits: 'pro',
  tiktokFollowing: 'pro',
  tiktokExplore: 'pro',
  strictMode: 'pro',
  schedules: 'pro',
  advancedStatistics: 'pro',
  advancedInsights: 'pro',
  nativeProtection: 'pro',
  temporaryAccess: 'pro',
  sleepMode: 'pro',
} as const;

export type SubscriptionFeature = keyof typeof FEATURE_ACCESS;

/** Visibility differs from entitlement access: a future Pro release can show locked controls. */
export function isFeatureAvailable(feature: SubscriptionFeature, proEnabled = PRO_ENABLED): boolean {
  if (feature === 'blockWebsiteVersion' && !WEBSITE_BLOCKING) return false;
  return FEATURE_ACCESS[feature] === 'free' || proEnabled;
}

export function canUseFeature(isPro: boolean, feature: SubscriptionFeature, proEnabled = PRO_ENABLED): boolean {
  if (feature === 'blockWebsiteVersion' && !WEBSITE_BLOCKING) return false;
  return FEATURE_ACCESS[feature] === 'free' || (proEnabled && isPro);
}

export function calculateAnnualSavings(monthly: PurchasesPackage | null | undefined, annual: PurchasesPackage | null | undefined): number | null {
  if (!monthly || !annual) return null;
  const monthProduct = monthly.product;
  const annualProduct = annual.product;
  const currency = 'currencyCode' in monthProduct ? monthProduct.currencyCode : undefined;
  const annualCurrency = 'currencyCode' in annualProduct ? annualProduct.currencyCode : undefined;
  const monthPrice = 'price' in monthProduct ? monthProduct.price : undefined;
  const annualPrice = 'price' in annualProduct ? annualProduct.price : undefined;
  if (!currency || currency !== annualCurrency || typeof monthPrice !== 'number' || typeof annualPrice !== 'number' || monthPrice <= 0 || annualPrice <= 0) return null;
  const monthlyAnnualized = monthPrice * 12;
  if (monthlyAnnualized <= annualPrice) return null;
  return Math.round(((monthlyAnnualized - annualPrice) / monthlyAnnualized) * 100);
}

export type ProFeature = SubscriptionFeature;

export function canAccessFeature(isPro: boolean, feature: ProFeature): boolean {
  return canUseFeature(isPro, feature);
}
