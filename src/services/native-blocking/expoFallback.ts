import type { NativeAppBlocker } from './types';

/** Honest Expo fallback: in-app filtering can work, but this cannot restrict other apps. */
export const expoFallbackBlocker: NativeAppBlocker = {
  async isSupported() { return false; },
  async requestAuthorization() { return false; },
  async getAuthorizationStatus() { return 'unknown'; },
  async configureProtectedApps() {},
  async startBlocking() {},
  async stopBlocking() {},
  async getBlockingStatus() { return { active: false, supported: false }; },
};
