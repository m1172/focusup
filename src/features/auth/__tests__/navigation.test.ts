import { router } from 'expo-router';
import { leaveAuth } from '../navigation';
import { useAppStore } from '../../../store/appStore';
import { useAccountStore } from '../../../store/accountStore';
import { useWellbeingStore } from '../../../store/wellbeingStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' };

beforeEach(() => {
  useAccountStore.setState({ ready: true, user: null, recoveryRequired: false });
  useAppStore.setState({ onboardingCompleted: false });
  useWellbeingStore.setState({ launchDestination: 'home' });
});

test('pending registration cannot finish onboarding or navigate into the app', () => {
  leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenCalledWith('/auth/sign-in');
});

test('verified registration finishes onboarding and respects the saved launch destination', () => {
  useAccountStore.setState({ user });
  useWellbeingStore.setState({ launchDestination: 'youtube' });
  leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/browser/[appId]', params: { appId: 'youtube' } });
});

test('existing guests signing in enter Home without replaying onboarding', () => {
  useAppStore.setState({ onboardingCompleted: true });
  useAccountStore.setState({ user });
  leaveAuth(false);
  expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});

test('direct authentication before setup returns the user to onboarding', () => {
  useAccountStore.setState({ user });
  leaveAuth(false);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenCalledWith('/onboarding');
});

test('recovery never completes onboarding until a password reset succeeds', () => {
  useAccountStore.setState({ user, recoveryRequired: true });
  leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(false);
  expect(router.replace).toHaveBeenLastCalledWith('/account');
  useAccountStore.setState({ recoveryRequired: false });
  leaveAuth(true);
  expect(useAppStore.getState().onboardingCompleted).toBe(true);
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)');
});
