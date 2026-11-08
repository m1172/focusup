import { canEnterApp, entryDestination } from '../accessPolicy';
import type { SessionState } from '../sessionManager';

const guest: SessionState = { ready: true, user: null, recoveryRequired: false };
const signedIn: SessionState = { ...guest, user: { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' } };

test('new users can onboard but registration pending confirmation grants no app access', () => {
  expect(entryDestination(guest, false, 'instagram')).toBeNull();
  expect(canEnterApp(guest, false, true, true)).toBe(false);
  expect(canEnterApp(guest, true, true, true)).toBe(false);
});

test('existing guests must sign in regardless of saved launch destination', () => {
  expect(entryDestination(guest, true, 'instagram')).toBe('/auth/sign-in');
  expect(entryDestination(guest, true, 'home')).toBe('/auth/sign-in');
});

test('only hydrated, configured, authenticated, onboarded sessions enter the app', () => {
  expect(canEnterApp(signedIn, true, true, true)).toBe(true);
  expect(canEnterApp(signedIn, false, true, true)).toBe(false);
  expect(canEnterApp(signedIn, true, false, true)).toBe(false);
  expect(canEnterApp(signedIn, true, true, false)).toBe(false);
  expect(canEnterApp({ ...signedIn, ready: false }, true, true, true)).toBe(false);
});

test('a securely restored account can launch offline without an in-memory access token', () => {
  expect(canEnterApp(signedIn, true, true, true)).toBe(true);
  expect(entryDestination(signedIn, true, 'instagram')).toEqual({ pathname: '/browser/[appId]', params: { appId: 'instagram' } });
  expect(entryDestination(signedIn, true, 'home')).toBe('/(tabs)');
  expect(entryDestination(signedIn, false, 'home')).toBe('/onboarding');
});

test('recovery sessions cannot use the app until password reset finishes', () => {
  const recovery = { ...signedIn, recoveryRequired: true };
  expect(canEnterApp(recovery, true, true, true)).toBe(false);
  expect(entryDestination(recovery, false, 'youtube')).toBe('/account');
  expect(entryDestination(recovery, true, 'youtube')).toBe('/account');
});

test('sign-out, deletion and invalid-token transitions revoke access immediately', () => {
  expect(canEnterApp(signedIn, true, true, true)).toBe(true);
  expect(canEnterApp(guest, true, true, true)).toBe(false);
  expect(entryDestination(guest, true, 'youtube')).toBe('/auth/sign-in');
});

test('a supervised child phone enters without an account or onboarding; a waiting phone returns to the pairing screen', () => {
  expect(canEnterApp(guest, false, true, true, 'child')).toBe(true);
  expect(canEnterApp(guest, false, true, false, 'child')).toBe(true);
  expect(canEnterApp(guest, false, false, true, 'child')).toBe(false);
  expect(canEnterApp(guest, false, true, true, 'pending')).toBe(false);
  expect(canEnterApp(signedIn, true, true, true, 'pending')).toBe(false);
  expect(entryDestination(guest, false, 'instagram', 'child')).toBe('/(tabs)');
  expect(entryDestination(guest, false, 'home', 'pending')).toBe('/family/connect');
  expect(entryDestination(signedIn, true, 'home', 'none')).toBe('/(tabs)');
});
