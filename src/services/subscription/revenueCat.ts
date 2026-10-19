import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PACKAGE_TYPE, PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { DEFAULT_OFFERING_ID, getRevenueCatApiKey, getRevenueCatConfigurationError } from './subscriptionConfig';
import { hasProEntitlement } from './entitlements';
import type { PlanId, PurchaseResult, SubscriptionService } from './types';

export { hasProEntitlement } from './entitlements';

let configured = false;
let listenerInstalled = false;
let customerInfoListener: ((info: CustomerInfo) => void) | undefined;
const revenueCatCustomerInfoListener = (info: CustomerInfo) => customerInfoListener?.(info);

function getPlanId(pkg: PurchasesPackage): PlanId | null {
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'annual';
  const identifier = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (identifier.includes('annual') || identifier.includes('year')) return 'annual';
  if (identifier.includes('monthly') || identifier.includes('month')) return 'monthly';
  return null;
}

export function getPlanPackages(offering: PurchasesOffering | null): { monthly: PurchasesPackage | null; annual: PurchasesPackage | null } {
  const plans: { monthly: PurchasesPackage | null; annual: PurchasesPackage | null } = { monthly: null, annual: null };
  for (const pkg of offering?.availablePackages ?? []) {
    const plan = getPlanId(pkg);
    if (plan) plans[plan] = pkg;
  }
  return plans;
}

function isCancelledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && String(error.code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export const revenueCatSubscriptionService: SubscriptionService = {
  async initialize() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (configured) return;
    const configurationError = getRevenueCatConfigurationError();
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) throw new Error(configurationError ?? 'RevenueCat is unavailable on this platform.');

    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey });
    configured = true;
    if (__DEV__) console.info('[FocusUp Subscription] RevenueCat configured');
  },

  async getOfferings() {
    if (!configured) return null;
    const offerings = await Purchases.getOfferings();
    const current = offerings.current ?? offerings.all[DEFAULT_OFFERING_ID] ?? null;
    if (!current) {
      if (__DEV__) console.error('[FocusUp Subscription] No RevenueCat current Offering was returned. Check RevenueCat products and Offering configuration.');
      return null;
    }
    if (__DEV__) console.info('[FocusUp Subscription] Offering loaded');
    return current;
  },

  async getCustomerInfo() {
    if (!configured) throw new Error('RevenueCat is not initialized.');
    return Purchases.getCustomerInfo();
  },

  async purchasePackage(packageId: string): Promise<PurchaseResult> {
    if (!configured) return { status: 'unavailable', message: 'RevenueCat is not initialized.' };
    const offering = (await Purchases.getOfferings()).current;
    const pkg = offering?.availablePackages.find((item) => item.identifier === packageId || item.product.identifier === packageId);
    if (!pkg) return { status: 'unavailable', message: 'This subscription plan is currently unavailable.' };
    try {
      const result = await Purchases.purchasePackage(pkg);
      return hasProEntitlement(result.customerInfo)
        ? { status: 'purchased', customerInfo: result.customerInfo }
        : { status: 'pending', customerInfo: result.customerInfo };
    } catch (error) {
      if (isCancelledError(error)) return { status: 'cancelled' };
      // Already owned products can be refreshed and recognized without asking the user to buy again.
      if (typeof error === 'object' && error !== null && 'code' in error && String(error.code) === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        const customerInfo = await Purchases.getCustomerInfo();
        return hasProEntitlement(customerInfo) ? { status: 'purchased', customerInfo } : { status: 'pending', customerInfo };
      }
      throw error;
    }
  },

  async restorePurchases() {
    if (!configured) throw new Error('RevenueCat is not initialized.');
    return Purchases.restorePurchases();
  },

  async isPro() {
    return hasProEntitlement(await this.getCustomerInfo());
  },
};

export function setRevenueCatCustomerInfoListener(listener: (info: CustomerInfo) => void) {
  customerInfoListener = listener;
  if (configured && !listenerInstalled) {
    Purchases.addCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
    listenerInstalled = true;
  }
}

export function installRevenueCatCustomerInfoListener() {
  if (configured && !listenerInstalled) {
    Purchases.addCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
    listenerInstalled = true;
  }
}

export function removeRevenueCatCustomerInfoListener() {
  if (listenerInstalled) Purchases.removeCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
  listenerInstalled = false;
  customerInfoListener = undefined;
}

export function isRevenueCatConfigured() { return configured; }

export async function presentSubscriptionCustomerCenter(): Promise<void> {
  if (!configured) throw new Error('RevenueCat is not initialized.');
  await RevenueCatUI.presentCustomerCenter();
}

/** Reserved for a future FocusUp account system; never pass social-platform identities. */
export async function identifySubscriptionUser(userId: string): Promise<CustomerInfo> {
  if (!configured) throw new Error('RevenueCat is not initialized.');
  const safeId = userId.trim();
  if (!safeId || safeId.length > 100) throw new Error('A valid FocusUp account ID is required.');
  const result = await Purchases.logIn(safeId);
  customerInfoListener?.(result.customerInfo);
  return result.customerInfo;
}

export async function resetSubscriptionUser(): Promise<CustomerInfo> {
  if (!configured) throw new Error('RevenueCat is not initialized.');
  const customerInfo = await Purchases.logOut();
  customerInfoListener?.(customerInfo);
  return customerInfo;
}
