import type { NativeAppBlocker, NativeAuthorizationStatus } from './types';
import type { ProtectedPlatform, StrictModeSession } from '../strict-mode/types';

export class MockNativeAppBlocker implements NativeAppBlocker {
  active = false;
  supported: boolean;
  authorization: NativeAuthorizationStatus;
  failStart = false;
  constructor(options: { supported?: boolean; authorization?: NativeAuthorizationStatus; failStart?: boolean } = {}) {
    this.supported = options.supported ?? false;
    this.authorization = options.authorization ?? 'unknown';
    this.failStart = options.failStart ?? false;
  }
  async isSupported() { return this.supported; }
  async requestAuthorization() { return this.authorization === 'authorized'; }
  async getAuthorizationStatus() { return this.authorization; }
  async configureProtectedApps(_platforms: ProtectedPlatform[]) {}
  async startBlocking(_session: StrictModeSession) { if (this.failStart) throw new Error('mock blocker failure'); this.active = true; }
  async stopBlocking() { this.active = false; }
  async getBlockingStatus() { return { active: this.active, supported: this.supported }; }
}
