import { PRO_ENABLED } from '../../config/release';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE, STORE_REPLACEMENT_MODE, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { DEFAULT_OFFERING_ID, getRevenueCatApiKey, getRevenueCatConfigurationError } from './subscriptionConfig';
import { hasProEntitlement } from './entitlements';
import type { PaidTier, PurchaseResult, SubscriptionService } from './types';

export { hasProEntitlement } from './entitlements';

let configured = false;
let listenerInstalled = false;
let customerInfoListener: ((info: CustomerInfo) => void) | undefined;
const revenueCatCustomerInfoListener = (info: CustomerInfo) => customerInfoListener?.(info);

const offeringIds = { pro: DEFAULT_OFFERING_ID, family: 'family' } as const;
const offeringsByTier = new Map<PaidTier, PurchasesOffering>();
export function getPlanPackages(offering: PurchasesOffering | null) {
  const packages = offering?.availablePackages ?? [];
  return {
    monthly: packages.find((pkg) => pkg.identifier === '$rc_monthly') ?? null,
    annual: packages.find((pkg) => pkg.identifier === '$rc_annual') ?? null,
  };
}

export function confirmsProduct(info: CustomerInfo, tier: PaidTier, pkg: PurchasesPackage) {
  const active = info.entitlements.active[tier];
  if (!active) return false;
  const [product, plan] = pkg.product.identifier.split(':');
  return active.productIdentifier === pkg.product.identifier
    || (Boolean(plan) && active.productIdentifier === product && active.productPlanIdentifier === plan);
}

function isCancelledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && String(error.code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export const revenueCatSubscriptionService: SubscriptionService = {
  async initialize(userId) {
    if (!PRO_ENABLED) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (configured) return;
    const configurationError = getRevenueCatConfigurationError();
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) throw new Error(configurationError ?? 'RevenueCat is unavailable on this platform.');

    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.INFO);
    if (!userId) throw new Error('A Vaqtim account is required.');
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    if (__DEV__) console.info('[FocusUp Subscription] RevenueCat configured');
  },

  async getOfferings(tier = 'pro') {
    if (!PRO_ENABLED || !configured) return null;
    const offering = (await Purchases.getOfferings()).all[offeringIds[tier]] ?? null;
    if (offering) offeringsByTier.set(tier, offering);
    else offeringsByTier.delete(tier);
    return offering;
  },

  async getCustomerInfo() {
    if (!PRO_ENABLED || !configured) throw new Error('RevenueCat is not initialized.');
    return Purchases.getCustomerInfo();
  },

  async purchasePackage(packageId, tier = 'pro', previous): Promise<PurchaseResult> {
    if (!PRO_ENABLED || !configured) return { status: 'unavailable', message: 'RevenueCat is not initialized.' };
    const pkg = offeringsByTier.get(tier)?.availablePackages.find((item) => item.identifier === packageId);
    if (!pkg || (previous?.store && previous.store !== Platform.OS)) return { status: 'unavailable', message: 'This subscription plan is currently unavailable.' };
    const productChange = Platform.OS === 'android' && previous?.store === 'android' && previous.productId
      ? {
        oldProductIdentifier: previous.productId,
        replacementMode: previous.productId.split(':')[0] === pkg.product.identifier.split(':')[0]
          ? STORE_REPLACEMENT_MODE.WITHOUT_PRORATION
          : previous.tier === 'pro' && tier === 'family' ? STORE_REPLACEMENT_MODE.CHARGE_FULL_PRICE : STORE_REPLACEMENT_MODE.DEFERRED,
      } : null;
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg, null, productChange);
      if (confirmsProduct(customerInfo, tier, pkg)) return { status: 'purchased', customerInfo };
      const deferred = productChange?.replacementMode === STORE_REPLACEMENT_MODE.DEFERRED
        || (Platform.OS === 'ios' && previous?.productId && (previous.tier === tier || previous.tier === 'family'));
      if (deferred) return { status: 'scheduled' };
      return { status: 'pending', customerInfo };
    } catch (error) {
      if (isCancelledError(error)) return { status: 'cancelled' };
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { status: 'pending' };
      if (code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        const customerInfo = await Purchases.getCustomerInfo();
        return confirmsProduct(customerInfo, tier, pkg) ? { status: 'purchased', customerInfo } : { status: 'pending', customerInfo };
      }
      throw error;
    }
  },

  async restorePurchases() {
    if (!PRO_ENABLED || !configured) throw new Error('RevenueCat is not initialized.');
    return Purchases.restorePurchases();
  },

  async isPro() {
    if (!PRO_ENABLED) return false;
    return hasProEntitlement(await this.getCustomerInfo());
  },
};

export function setRevenueCatCustomerInfoListener(listener: (info: CustomerInfo) => void) {
  if (!PRO_ENABLED) return;
  customerInfoListener = listener;
  if (PRO_ENABLED && configured && !listenerInstalled) {
    Purchases.addCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
    listenerInstalled = true;
  }
}

export function installRevenueCatCustomerInfoListener() {
  if (PRO_ENABLED && configured && !listenerInstalled) {
    Purchases.addCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
    listenerInstalled = true;
  }
}

export function removeRevenueCatCustomerInfoListener() {
  if (listenerInstalled) Purchases.removeCustomerInfoUpdateListener(revenueCatCustomerInfoListener);
  listenerInstalled = false;
  customerInfoListener = undefined;
}

export function isRevenueCatConfigured() { return PRO_ENABLED && configured; }

export async function presentSubscriptionCustomerCenter(): Promise<void> {
  if (!PRO_ENABLED || !configured) throw new Error('RevenueCat is not initialized.');
  await RevenueCatUI.presentCustomerCenter();
}

/** Only use a Vaqtim account ID. */
export async function identifySubscriptionUser(userId: string): Promise<CustomerInfo> {
  if (!PRO_ENABLED || !configured) throw new Error('RevenueCat is not initialized.');
  const safeId = userId.trim();
  if (!safeId || safeId.length > 100) throw new Error('A valid FocusUp account ID is required.');
  const result = await Purchases.logIn(safeId);
  offeringsByTier.clear();
  return result.customerInfo;
}

export async function resetSubscriptionUser(): Promise<CustomerInfo> {
  if (!PRO_ENABLED || !configured) throw new Error('RevenueCat is not initialized.');
  const customerInfo = await Purchases.logOut();
  offeringsByTier.clear();
  return customerInfo;
}
