import { router } from 'expo-router';
import { leaveAuth, takeReturningSignIn } from '../navigation';
import { useAppStore } from '../../../store/appStore';
import { useAccountStore } from '../../../store/accountStore';
import { useWellbeingStore } from '../../../store/wellbeingStore';
import { useOnboardingStore } from '../../../store/onboardingStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
const mockGetSettings = jest.fn();
jest.mock('../../../services/backend/accountSession', () => ({ accountApi: () => ({ getSettings: mockGetSettings }) }));
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' };

beforeEach(() => {
  mockGetSettings.mockReset().mockResolvedValue({ revision: 0, payload: null, updatedAt: null });
  takeReturningSignIn();
  useAccountStore.setState({ ready: true, user: null, recoveryRequired: false });
  useAppStore.setState({ onboardingCompleted: false });
  useWellbeingStore.setState({ launchDestination: 'home' });
  useOnboardingStore.setState({ source: 'estimate', shortFormMinutes: 90, cut: 0.5 });
});

test('pending registration cannot finish onboarding or navigate into the app', async () => {
  await leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenCalledWith('/auth/sign-in');
});

test('verified registration finishes onboarding and respects the saved launch destination', async () => {
  useAccountStore.setState({ user });
  useWellbeingStore.setState({ launchDestination: 'youtube' });
  await leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/browser/[appId]', params: { appId: 'youtube' } });
});

test('existing guests signing in enter Home without replaying onboarding', async () => {
  useAppStore.setState({ onboardingCompleted: true });
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});

test('a new account signing in before setup goes to onboarding', async () => {
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenCalledWith('/onboarding');
});

test('recovery never completes onboarding until a password reset succeeds', async () => {
  useAccountStore.setState({ user, recoveryRequired: true });
  await leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenLastCalledWith('/account');
  useAccountStore.setState({ recoveryRequired: false });
  await leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)');
});

test('an account that finished onboarding skips it on a new phone and gets its daily time back', async () => {
  mockGetSettings.mockResolvedValue({ revision: 3, payload: { schemaVersion: 1, onboarding: { completed: true, usualMinutes: 150, cut: 0.75 } }, updatedAt: '2026-11-03T10:00:00Z' });
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)');
  expect(useOnboardingStore.getState()).toMatchObject({ source: 'estimate', shortFormMinutes: 150, cut: 0.75 });
  // Not counted as a finished onboarding in analytics, and only once.
  expect(takeReturningSignIn()).toBe(true);
  expect(takeReturningSignIn()).toBe(false);
});

test('an account that stopped partway through onboarding goes through it again', async () => {
  mockGetSettings.mockResolvedValue({ revision: 1, payload: { schemaVersion: 1, onboarding: { completed: false, usualMinutes: 90, cut: 0.5 } }, updatedAt: '2026-11-03T10:00:00Z' });
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenLastCalledWith('/onboarding');
});

test('a backup from before onboarding was saved still counts as finished', async () => {
  mockGetSettings.mockResolvedValue({ revision: 3, payload: { schemaVersion: 1 }, updatedAt: '2026-10-30T10:00:00Z' });
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(useOnboardingStore.getState().shortFormMinutes).toBe(90);
});

test('when the backup check fails, onboarding stays', async () => {
  mockGetSettings.mockRejectedValue(new Error('offline'));
  useAccountStore.setState({ user });
  await leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenLastCalledWith('/onboarding');
});

test('finishing onboarding does not ask the server and counts as a finished onboarding', async () => {
  useAccountStore.setState({ user });
  await leaveAuth(true);
  expect(mockGetSettings).not.toHaveBeenCalled();
  expect(takeReturningSignIn()).toBe(false);
});
