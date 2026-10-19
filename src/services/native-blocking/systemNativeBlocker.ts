import type { NativeAppBlocker } from './types';
import { protectionBridge } from '../protection/nativeBridge';
import { reconcileProtection, resetProtectionController } from '../protection/controller';
import { useAppStore } from '../../store/appStore';

export const systemNativeBlocker: NativeAppBlocker = {
  async isSupported() { return (await protectionBridge.getStatus()).supported; },
  async requestAuthorization() { return protectionBridge.requestAuthorization(); },
  async getAuthorizationStatus() { const status = await protectionBridge.getStatus(); return status.authorized ? 'authorized' : 'unknown'; },
  async configureProtectedApps() { /* Opaque tokens are selected explicitly in Protection settings. */ },
  async startBlocking() { resetProtectionController(); await reconcileProtection(); },
  async stopBlocking() { /* Reapply the whole plan after the controller removes the strict interval. */ },
  async getBlockingStatus() { const status = await protectionBridge.getStatus(); const strictApps = useAppStore.getState().strictSession?.appIds ?? []; return { active: status.active && Boolean(status.protectedPlatforms?.some((platform) => strictApps.includes(platform))), supported: status.supported }; },
};
