import { Platform } from 'react-native';

export const PRO_ENTITLEMENT_ID = 'pro';
export const DEFAULT_OFFERING_ID = 'default';
export const SUBSCRIPTION_TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? '';
export const SUBSCRIPTION_PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '';

export const subscriptionProductIdExamples = {
  ios: { monthly: 'focusup_pro_monthly', annual: 'focusup_pro_annual' },
  android: { monthly: 'focusup_pro_monthly', annual: 'focusup_pro_annual' },
} as const;

export function getRevenueCatApiKey(platform: string = Platform.OS): string | undefined {
  if (platform === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (platform === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return undefined;
}

export function getRevenueCatConfigurationError(platform: string = Platform.OS): string | null {
  if (platform !== 'ios' && platform !== 'android') return null;
  if (!getRevenueCatApiKey(platform)) {
    return `RevenueCat ${platform === 'ios' ? 'iOS' : 'Android'} public SDK key is not configured.`;
  }
  return null;
}

export function hasRevenueCatPublicKey(platform: string = Platform.OS): boolean {
  return Boolean(getRevenueCatApiKey(platform));
}

export function getConfiguredLegalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}
