import type { Gateway, Identity, Session } from '../src/gateway.js';
import { readConfig } from '../src/config.js';
import { ApiError } from '../src/errors.js';
import { settingsSchema } from '../src/schemas.js';

export const config = readConfig({ NODE_ENV: 'test', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key' });
export const user: Identity = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com', token: 'valid-token' };
export const session: Session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 1800000000, user: { id: user.id, email: user.email } };
export const settings = settingsSchema.parse({
  schemaVersion: 1,
  preferences: {
    selectedLanguage: 'uz', themeMode: 'system',
    apps: Object.fromEntries(['instagram', 'youtube', 'tiktok', 'x', 'reddit', 'snapchat', 'facebook', 'linkedin'].map((id) => [id, { enabled: id === 'instagram', filters: {} }])),
    schedules: [{ id: 'morning', name: 'Morning', start: '08:00', end: '09:00', weekdays: [1, 2, 3, 4, 5], apps: ['instagram'], enabled: true }],
    dailyGoalMinutes: 60, goalNotifications: false, completionNotifications: false,
  },
  wellbeing: { launchDestination: 'home', sleep: { enabled: false, bedtime: '22:30', wakeTime: '07:00', windDownMinutes: 30, morningMinutes: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['instagram', 'youtube'], allowedApps: [], notify: false } },
});
const unused = async (): Promise<never> => { throw new Error('Unexpected gateway call'); };
export function fakeGateway(overrides: Partial<Gateway> = {}): Gateway {
  return {
    authenticate: async (token) => { if (token !== user.token) throw new ApiError(401, 'INVALID_TOKEN', 'Invalid token.'); return user; },
    signUp: unused, signIn: unused, refresh: unused, exchangeOAuth: unused, signInWithIdToken: unused,
    verify: unused, verifyCode: unused, resendConfirmation: unused, recover: unused, changePassword: unused, signOut: unused,
    getProfile: unused, saveProfile: unused, getSettings: unused, saveSettings: unused,
    deleteAccount: unused, ready: async () => {}, ...overrides,
  };
}
