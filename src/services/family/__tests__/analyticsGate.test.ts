import { useAccountStore } from '../../../store/accountStore';
import { useAppStore } from '../../../store/appStore';
import { useFamilyStore } from '../../../store/familyStore';
import { familyAnalyticsRole } from '../analyticsGate';

let mockFamilyEnabled = true;
jest.mock('../../../config/release', () => ({ PRO_ENABLED: false, get FAMILY_ENABLED() { return mockFamilyEnabled; } }));
jest.mock('../../analytics/productAnalytics', () => ({ initializeProductAnalytics: jest.fn(), setAnalyticsRoleGate: jest.fn(), shutDownProductAnalytics: jest.fn() }));
jest.mock('../../../store/subscriptionStore', () => ({ useSubscriptionStore: { getState: () => ({ isPro: false }) } }));

beforeEach(() => {
  mockFamilyEnabled = true;
  useFamilyStore.setState({ role: 'none', personalChosen: false });
  useAccountStore.setState({ ready: true, user: null, recoveryRequired: false });
  useAppStore.setState({ onboardingCompleted: false });
});

test('a fresh install waits until someone chooses the personal path', () => {
  expect(familyAnalyticsRole()).toBe('unknown');
  useFamilyStore.getState().choosePersonal();
  expect(familyAnalyticsRole()).toBe('personal');
  useFamilyStore.getState().chooseChildPath();
  expect(familyAnalyticsRole()).toBe('unknown');
});

test('signed-in and onboarded phones are personal; pairing and supervised phones never are', () => {
  useAppStore.setState({ onboardingCompleted: true });
  expect(familyAnalyticsRole()).toBe('personal');
  useFamilyStore.setState({ role: 'pending' });
  expect(familyAnalyticsRole()).toBe('supervised');
  useFamilyStore.setState({ role: 'child', personalChosen: true });
  useAccountStore.setState({ ready: true, user: { id: '11111111-1111-4111-8111-111111111111', email: null }, recoveryRequired: false });
  expect(familyAnalyticsRole()).toBe('supervised');
});

test('builds without the family path keep analytics as before', () => {
  mockFamilyEnabled = false;
  expect(familyAnalyticsRole()).toBe('personal');
});
