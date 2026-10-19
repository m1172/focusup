import type { StrictModeSession, ProtectedPlatform } from '../strict-mode/types';

export type NativeAuthorizationStatus = 'unknown' | 'authorized' | 'denied' | 'restricted';
export interface NativeAppBlocker {
  isSupported(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  getAuthorizationStatus(): Promise<NativeAuthorizationStatus>;
  configureProtectedApps(platforms: ProtectedPlatform[]): Promise<void>;
  startBlocking(session: StrictModeSession): Promise<void>;
  stopBlocking(): Promise<void>;
  getBlockingStatus(): Promise<{ active: boolean; supported: boolean }>;
}
