import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { getPlanPackages } from '../revenueCat';
import { hasProEntitlement } from '../entitlements';
import { calculateAnnualSavings, canAccessFeature, canUseFeature } from '../subscriptionService';
import { normalizeSubscriptionError } from '../types';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {}, LOG_LEVEL: { INFO: 'INFO' }, PACKAGE_TYPE: { MONTHLY: 'MONTHLY', ANNUAL: 'ANNUAL' }, PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR', PRODUCT_ALREADY_PURCHASED_ERROR: 'PRODUCT_ALREADY_PURCHASED_ERROR' } }));
jest.mock('react-native-purchases-ui', () => ({ __esModule: true, default: { presentCustomerCenter: jest.fn() } }));

function customerInfo(active: Record<string, object>): Pick<CustomerInfo, 'entitlements'> {
  return { entitlements: { active } } as CustomerInfo;
}

function pkg(price: number, currencyCode: string): PurchasesPackage {
  return {
    identifier: `test-${price}`,
    packageType: 'CUSTOM',
    offeringIdentifier: 'default',
    product: { identifier: `test-product-${price}`, price, currencyCode, priceString: `${currencyCode} ${price}` },
  } as unknown as PurchasesPackage;
}

describe('RevenueCat entitlement', () => {
  it('unlocks Pro only for an active pro entitlement', () => {
    expect(hasProEntitlement(customerInfo({ pro: {} }))).toBe(true);
  });

  it('keeps expired and non-Pro customers free', () => {
    expect(hasProEntitlement(customerInfo({}))).toBe(false);
    expect(hasProEntitlement(null)).toBe(false);
  });
});

describe('subscription feature access', () => {
  it('keeps Reels and Shorts protection free while requiring Pro for other Instagram tools', () => {
    expect(canAccessFeature(false, 'strictMode')).toBe(false);
    expect(canAccessFeature(true, 'strictMode')).toBe(true);
    expect(canUseFeature(false, 'instagramCleanBrowsing')).toBe(false);
    expect(canUseFeature(true, 'instagramCleanBrowsing')).toBe(true);
    expect(canUseFeature(false, 'instagramReels')).toBe(true);
    expect(canUseFeature(true, 'instagramReels')).toBe(true);
    expect(canUseFeature(false, 'instagramExplore')).toBe(false);
    expect(canUseFeature(false, 'instagramSuggestedPosts')).toBe(false);
    expect(canUseFeature(false, 'youtubeShorts')).toBe(true);
    expect(canUseFeature(false, 'youtubeHomeRecommendations')).toBe(false);
    expect(canUseFeature(false, 'youtubeComments')).toBe(false);
    expect(canUseFeature(false, 'advancedStatistics')).toBe(false);
    expect(canUseFeature(true, 'strictMode')).toBe(true);
  });
});

describe('annual savings', () => {
  it('calculates savings from comparable monthly and annual store prices', () => {
    expect(calculateAnnualSavings(pkg(2, 'USD'), pkg(15, 'USD'))).toBe(38);
  });

  it('does not calculate savings when currencies differ', () => {
    expect(calculateAnnualSavings(pkg(2, 'USD'), pkg(15, 'UZS'))).toBeNull();
  });

  it('does not calculate savings for free or invalid annual prices', () => {
    expect(calculateAnnualSavings(pkg(2, 'USD'), pkg(0, 'USD'))).toBeNull();
  });
});

describe('RevenueCat offering normalization', () => {
  const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'monthly', price: 2, priceString: '$2', currencyCode: 'USD' } } as unknown as PurchasesPackage;
  const annual = { identifier: '$rc_annual', packageType: 'ANNUAL', product: { identifier: 'annual', price: 15, priceString: '$15', currencyCode: 'USD' } } as unknown as PurchasesPackage;

  it('supports both plans and either plan on its own, including empty offerings', () => {
    expect(getPlanPackages({ availablePackages: [monthly, annual] } as never)).toEqual({ monthly, annual });
    expect(getPlanPackages({ availablePackages: [monthly] } as never)).toEqual({ monthly, annual: null });
    expect(getPlanPackages({ availablePackages: [annual] } as never)).toEqual({ monthly: null, annual });
    expect(getPlanPackages(null)).toEqual({ monthly: null, annual: null });
    expect(getPlanPackages({ availablePackages: [] } as never)).toEqual({ monthly: null, annual: null });
  });
});

describe('subscription error normalization', () => {
  it('reduces store and RevenueCat failures to safe domain codes', () => {
    expect(normalizeSubscriptionError({ code: 'NETWORK_ERROR' })).toBe('network');
    expect(normalizeSubscriptionError({ code: 'PRODUCT_NOT_AVAILABLE' })).toBe('productUnavailable');
    expect(normalizeSubscriptionError({ code: 'INVALID_API_KEY_CONFIGURATION' })).toBe('configuration');
    expect(normalizeSubscriptionError(new Error('raw native details'))).toBe('unknown');
  });
});
