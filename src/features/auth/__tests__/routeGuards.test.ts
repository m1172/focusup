import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import RootLayout from '../../../app/_layout';
import type { SessionState } from '../../../services/backend/sessionManager';

// The project uses React DOM for web, without its separate optional type package.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional server renderer has no installed declarations.
const { renderToStaticMarkup } = require('react-dom/server.node') as { renderToStaticMarkup: (node: import('react').ReactNode) => string };

const originalDevelopmentMode = __DEV__;
let mockAccount: SessionState;
let mockCompleted = true;
let mockHydrated = true;
let mockConfigured = true;
let mockProEnabled = false;

jest.mock('../../../config/release', () => ({ get PRO_ENABLED() { return mockProEnabled; } }));
jest.mock('../../../store/accountStore', () => ({ useAccountStore: () => mockAccount }));
jest.mock('../../../store/appStore', () => ({ useAppStore: (select: (value: object) => unknown) => select({ selectedLanguage: 'en', onboardingCompleted: mockCompleted }) }));
jest.mock('../../../store/wellbeingStore', () => ({ useWellbeingStore: {} }));
jest.mock('../../../store/subscriptionStore', () => ({ useSubscriptionStore: {} }));
jest.mock('../../../hooks/useLaunchReadiness', () => ({ useLaunchReadiness: () => mockHydrated }));
jest.mock('../../../hooks/useNativeAppHandoff', () => ({ useNativeAppHandoff: jest.fn() }));
jest.mock('../../../services/backend/accountSession', () => ({ isBackendConfigured: () => mockConfigured, refreshAccountSession: jest.fn() }));
jest.mock('../../../services/analytics/localAnalytics', () => ({}));
jest.mock('../../../services/analytics/sessionTracker', () => ({}));
jest.mock('../../../services/strict-mode/strictModeController', () => ({}));
jest.mock('../../../services/remote-config/remoteBlockerConfig', () => ({}));
jest.mock('../../../services/notifications/notificationService', () => ({}));
jest.mock('../../../services/protection/controller', () => ({}));
jest.mock('../../../services/privacy/clearFocusUpData', () => ({}));
jest.mock('../../../i18n', () => ({ __esModule: true, default: { language: 'en', t: (key: string) => key } }));
jest.mock('../../../theme', () => ({ useAppTheme: () => ({ background: '#fff' }) }));
jest.mock('../../../components/ScreenStatusBar', () => ({ ScreenStatusBar: () => null }));
jest.mock('../../../features/webview/BrowserLayer', () => ({ BrowserLayer: () => null }));
jest.mock('../../../services/performance/tapTiming', () => ({ perfLogsEnabled: false, recordTap: jest.fn(), startMainThreadSampler: jest.fn() }));
jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { View: { value: ({ children }: { children: import('react').ReactNode }) => children, enumerable: true }, ActivityIndicator: { value: () => null, enumerable: true } }));
jest.mock('expo-notifications', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }: { children: import('react').ReactNode }) => children }));
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factories cannot capture module imports.
  const React = require('react') as typeof import('react');
  const Stack = Object.assign(({ children }: { children: import('react').ReactNode }) => children, {
    // Expo Router supplies navigation/history pruning; these tests exercise our actual guard declarations.
    Protected: ({ guard, children }: { guard: boolean; children: import('react').ReactNode }) => guard ? children : null,
    Screen: ({ name }: { name: string }) => React.createElement('span', null, name + ';'),
  });
  return { Stack, router: {}, useRootNavigationState: () => undefined, useSegments: () => ['(tabs)'] };
});

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' };
const routes = () => renderToStaticMarkup(createElement(RootLayout)).match(/(?<=<span>).*?(?=<\/span>)/g) ?? [];

beforeEach(() => {
  Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true, writable: true });
  mockAccount = { ready: true, user, recoveryRequired: false };
  mockCompleted = true; mockHydrated = true; mockConfigured = true; mockProEnabled = false;
});

afterEach(() => { Object.defineProperty(globalThis, '__DEV__', { value: originalDevelopmentMode, configurable: true, writable: true }); });

test('fresh users see onboarding and authentication while every app entry point stays protected', () => {
  mockAccount.user = null; mockCompleted = false;
  const tree = routes();
  expect(tree).toContain('onboarding/account;');
  expect(tree).toContain('auth/sign-in;');
  for (const route of ['(tabs)', 'browser/[appId]', 'app-settings/[appId]', 'account', 'permissions']) expect(tree).not.toContain(`${route};`);
  for (const route of ['privacy', 'help', 'auth/callback']) expect(tree).toContain(`${route};`);
});

test('existing guests and pending email verification cannot enter through saved routes or deep links', () => {
  mockAccount.user = null;
  const tree = routes();
  expect(tree).toContain('auth/sign-up;');
  expect(tree).not.toContain('onboarding/index;');
  expect(tree).not.toContain('browser/[appId];');
  expect(tree).not.toContain('(tabs);');
});

test('hydration and backend configuration must be ready before app screens mount', () => {
  mockHydrated = false;
  expect(routes()).not.toContain('browser/[appId];');
  mockHydrated = true; mockAccount.ready = false;
  expect(routes()).not.toContain('(tabs);');
  mockAccount.ready = true; mockConfigured = false;
  expect(routes()).not.toContain('(tabs);');
});

test('restored accounts get free screens while premium deep links remain unavailable', () => {
  const tree = routes();
  expect(tree).toContain('(tabs);'); expect(tree).toContain('browser/[appId];');
  for (const route of ['pro', 'protection', 'native-app/[appId]', 'sleep', 'schedule', 'strict-mode', 'temporary-access']) expect(tree).not.toContain(`${route};`);
});

test('recovery sessions expose account reset and public help, but no app screens', () => {
  mockAccount.recoveryRequired = true;
  const tree = routes();
  expect(tree).toContain('account;'); expect(tree).toContain('help;');
  expect(tree).not.toContain('(tabs);'); expect(tree).not.toContain('browser/[appId];');
});

test('revoking the account removes all protected routes from the navigator', () => {
  expect(routes()).toContain('browser/[appId];');
  mockAccount = { ready: true, user: null, recoveryRequired: false };
  const signedOut = routes();
  expect(signedOut).not.toContain('browser/[appId];'); expect(signedOut).not.toContain('account;');
  expect(signedOut).toContain('auth/sign-in;');
});

test('retained Pro screens can be restored through the release flag after authentication', () => {
  mockProEnabled = true;
  const tree = routes();
  expect(tree).toContain('strict-mode;'); expect(tree).toContain('pro;');
  mockAccount.user = null;
  expect(routes()).not.toContain('pro;');
});


test('every root route is explicitly declared so an omitted route cannot become public automatically', () => {
  const collect = (directory: string, prefix = ''): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name.startsWith('(') ? [prefix + entry.name] : collect(join(directory, entry.name), prefix + entry.name + '/');
    return entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' ? [prefix + entry.name.slice(0, -4)] : [];
  });
  mockProEnabled = true;
  const declared = new Set(routes().map((route) => route.slice(0, -1)));
  mockAccount.user = null; mockCompleted = false;
  routes().forEach((route) => declared.add(route.slice(0, -1)));
  expect([...declared].sort()).toEqual(collect(join(__dirname, '../../../app')).sort());
});


test('development builds cannot bypass authentication', () => {
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true, writable: true });
  mockAccount.user = null;
  expect(routes()).not.toContain('(tabs);');
  expect(routes()).not.toContain('browser/[appId];');
});
