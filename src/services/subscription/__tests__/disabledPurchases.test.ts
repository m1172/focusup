import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { revenueCatSubscriptionService, identifySubscriptionUser, resetSubscriptionUser, presentSubscriptionCustomerCenter, installRevenueCatCustomerInfoListener, setRevenueCatCustomerInfoListener, isRevenueCatConfigured } from '../revenueCat';
import { useSubscriptionStore } from '../../../store/subscriptionStore';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {
  configure: jest.fn(), setLogLevel: jest.fn(), getOfferings: jest.fn(), getCustomerInfo: jest.fn(), purchasePackage: jest.fn(), restorePurchases: jest.fn(), addCustomerInfoUpdateListener: jest.fn(), logIn: jest.fn(), logOut: jest.fn(),
}, LOG_LEVEL: { INFO: 'INFO' }, PACKAGE_TYPE: {}, PURCHASES_ERROR_CODE: {} }));
jest.mock('react-native-purchases-ui', () => ({ __esModule: true, default: { presentCustomerCenter: jest.fn() } }));

test('disabled Pro never initializes billing, reads offerings, attaches listeners or purchases', async () => {
  await revenueCatSubscriptionService.initialize();
  await useSubscriptionStore.getState().initialize();
  await useSubscriptionStore.getState().refresh();
  expect(await revenueCatSubscriptionService.getOfferings()).toBeNull();
  expect(await revenueCatSubscriptionService.isPro()).toBe(false);
  expect(await revenueCatSubscriptionService.purchasePackage('monthly')).toMatchObject({ status: 'unavailable' });
  await expect(revenueCatSubscriptionService.restorePurchases()).rejects.toThrow();
  await expect(revenueCatSubscriptionService.getCustomerInfo()).rejects.toThrow();
  await expect(presentSubscriptionCustomerCenter()).rejects.toThrow();
  await expect(identifySubscriptionUser('account')).rejects.toThrow();
  await expect(resetSubscriptionUser()).rejects.toThrow();
  setRevenueCatCustomerInfoListener(jest.fn());
  installRevenueCatCustomerInfoListener();
  expect(isRevenueCatConfigured()).toBe(false);
  for (const method of Object.values(Purchases)) expect(method).not.toHaveBeenCalled();
  expect(RevenueCatUI.presentCustomerCenter).not.toHaveBeenCalled();
  expect(useSubscriptionStore.getState()).toMatchObject({ isPro: false, isInitialized: true, isLoading: false, error: null });
});
