import type { SubscriptionStatus } from './types';

/** Must match `android.package` in app.json (checked by the test). */
export const ANDROID_PACKAGE = 'com.m1172.focusup';

/**
 * The store page where the subscription can be changed or cancelled. Null when it was bought on the other
 * platform: this phone's store can't manage it, and Apple doesn't allow naming another store in the app.
 */
export function manageSubscriptionUrl(status: Pick<SubscriptionStatus, 'store' | 'productId'> | null, platform: string): string | null {
  if (!status?.store || status.store !== platform) return null;
  if (platform === 'ios') return 'https://apps.apple.com/account/subscriptions';
  // Play product IDs arrive as "product:basePlan"; the deep link takes the product part.
  const sku = status.productId?.split(':')[0];
  return `https://play.google.com/store/account/subscriptions${sku ? `?sku=${encodeURIComponent(sku)}&package=${ANDROID_PACKAGE}` : ''}`;
}
