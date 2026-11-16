import type { PurchasesOffering } from 'react-native-purchases';
import { useAccountStore } from '../../../store/accountStore';
import { useSubscriptionStore } from '../../../store/subscriptionStore';
import type { SubscriptionStatus } from '../types';

const mockRefresh = jest.fn<Promise<SubscriptionStatus>, []>();
const mockPurchase = jest.fn();
const mockInitialize = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
const mockIdentify = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
const mockReset = jest.fn(async () => undefined);
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../backend/secretStorage', () => ({ secretStorage: () => ({
  read: async () => null, write: async () => undefined, remove: async () => undefined,
}) }));
jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));
jest.mock('../../backend/accountSession', () => ({ accountApi: () => ({
  getSubscription: async () => null,
  refreshSubscription: () => mockRefresh(),
}) }));
jest.mock('../revenueCat', () => ({
  getPlanPackages: (offering: PurchasesOffering) => ({ monthly: offering?.availablePackages[0], annual: null }),
  isRevenueCatConfigured: () => mockInitialize.mock.calls.length > 0,
  identifySubscriptionUser: (id: string) => mockIdentify(id),
  resetSubscriptionUser: () => mockReset(),
  revenueCatSubscriptionService: {
    initialize: (id: string) => mockInitialize(id),
    getOfferings: async (tier: string) => ({ availablePackages: [{ identifier: '$rc_monthly', product: { identifier: tier } }] }),
    purchasePackage: (...args: unknown[]) => mockPurchase(...args),
  },
}));

const free: SubscriptionStatus = { tier: 'free', store: null, productId: null, expiresAt: null, familyChildAllowance: 0 };
const family: SubscriptionStatus = { tier: 'family', store: 'ios', productId: 'family', expiresAt: new Date(Date.now() + 600_000).toISOString(), familyChildAllowance: 3 };
const login = (id: string | null) => useAccountStore.setState({ ready: true, user: id ? { id, email: null } : null });
const state = useSubscriptionStore.getState;

test('checkout awaits server confirmation and ignores a delayed update after an account switch', async () => {
  mockRefresh.mockResolvedValue(free);
  login('account-a');
  await state().initialize();
  expect(state()).toMatchObject({ isInitialized: true, error: null, status: free });
  expect(mockInitialize).toHaveBeenCalledWith('account-a');

  mockPurchase.mockResolvedValue({ status: 'purchased' });
  mockRefresh.mockResolvedValueOnce(free).mockRejectedValueOnce(new Error('Verification delayed'));
  expect(await state().purchase('family', 'monthly')).toBe('pending');
  expect(state().isPro).toBe(false);
  expect(await state().purchase('family', 'monthly')).toBe('pending');
  expect(mockPurchase).toHaveBeenCalledTimes(1);

  mockRefresh.mockResolvedValueOnce(family);
  await state().refresh();
  expect(state()).toMatchObject({ isPro: true, pending: null, status: { tier: 'family' } });

  let resolveOld!: (value: SubscriptionStatus) => void;
  let startOld!: () => void;
  const oldStarted = new Promise<void>((resolve) => { startOld = resolve; });
  mockRefresh.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; startOld(); }));
  const old = state().refresh();
  await oldStarted;
  login('account-b');
  expect(state()).toMatchObject({ isPro: false, status: null });
  resolveOld(family);
  await old;
  await state().refresh();
  expect(mockIdentify).toHaveBeenCalledWith('account-b');
  expect(state()).toMatchObject({ isPro: false, status: free });

  mockRefresh.mockResolvedValueOnce({ ...family, store: 'android' });
  expect(await state().purchase('pro', 'monthly')).toBe('unavailable');
  expect(mockPurchase).toHaveBeenCalledTimes(1);
  login(null);
  await state().refresh();
  expect(mockReset).toHaveBeenCalledTimes(1);
});
